"""Unified product resolution layer for Poshan Scan.

Single Responsibility: owns the full barcode/search resolution chain so that
scan.py stays thin and nothing else needs to know how we find products.

Resolution order for barcode lookup:
  1. SQLite cache  (instant, no network)
  2. Open Food Facts  (3M+ global products; NOVA + additives; great for IN/US)
  3. USDA FoodData Central  (1M US branded foods; authoritative nutrition data)
  4. Demo product bank  (offline / dev fallback only)

Resolution order for text search:
  1. Open Food Facts search  (fastest, widest global coverage)
  2. USDA FDC search  (authoritative US nutrition; good FDA/USDA regulated items)
  3. Demo product bank  (offline / dev fallback only)

Data authorities referenced:
  - USDA FoodData Central  (FDC) — FDA regulated US branded foods
  - Open Food Facts  — crowd-sourced global; aligned with NOVA, EU, IN regulations
  - AAP-cited studies use OFF and USDA as primary ingredient data sources
"""
from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING

from ..models.product import Product, NutritionFacts, NovaGroup
from ..db.database import fetch_one, execute, decode_json_field
from . import open_food_facts, usda_fdc
from .demo_products import lookup_demo_barcode, search_demo_products, get_demo_suggestions

if TYPE_CHECKING:
    import aiosqlite

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Cache helpers
# ---------------------------------------------------------------------------

async def load_cached_product(db: "aiosqlite.Connection", barcode: str) -> Product | None:
    """Load product from SQLite cache by barcode. Returns None on miss."""
    row = await fetch_one(db, "SELECT * FROM products_cache WHERE barcode = ?", (barcode,))
    if not row:
        return None
    nutrition_data = decode_json_field(row.get("nutriments"), {})
    return Product(
        name=row["product_name"],
        brand=row.get("brand"),
        barcode=row["barcode"],
        nova_group=NovaGroup(row.get("nova_group", 4)),
        ingredients_text=row.get("ingredients_text"),
        image_url=row.get("image_url"),
        data_source=row.get("data_source", "cache"),
        nutrition=NutritionFacts(**nutrition_data) if nutrition_data else NutritionFacts(),
        additives_tags=decode_json_field(row.get("additives_tags"), []),
    )


async def cache_product(db: "aiosqlite.Connection", product: Product) -> None:
    """Upsert a resolved product into the local cache for fast future lookups."""
    if not product.barcode:
        return
    await execute(
        db,
        """INSERT OR REPLACE INTO products_cache
           (barcode, product_name, brand, ingredients_text, nutriments,
            additives_tags, nova_group, data_source, image_url)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            product.barcode,
            product.name,
            product.brand,
            product.ingredients_text,
            json.dumps(product.nutrition.model_dump()),
            json.dumps(product.additives_tags),
            product.nova_group.value,
            product.data_source,
            product.image_url,
        ),
    )


# ---------------------------------------------------------------------------
# Resolution strategies
# ---------------------------------------------------------------------------

async def resolve_barcode(
    db: "aiosqlite.Connection",
    barcode: str,
) -> tuple[Product | None, str]:
    """Resolve a product from barcode using the full lookup chain.

    Returns (product, source_label) where source_label is one of:
      "cache" | "open_food_facts" | "usda_fdc" | "demo" | "not_found"
    """
    # 1. Cache — fastest path
    product = await load_cached_product(db, barcode)
    if product:
        logger.debug("Cache hit for barcode %s", barcode)
        return product, "cache"

    # 2. Open Food Facts — 3M+ products, great NOVA + additives coverage
    product = await open_food_facts.lookup_barcode(barcode)
    if product:
        logger.info("OFF hit for barcode %s (%s)", barcode, product.name)
        await cache_product(db, product)
        return product, "open_food_facts"

    # 3. USDA FDC — authoritative for US FDA-regulated branded foods
    product = await usda_fdc.lookup_barcode(barcode)
    if product:
        logger.info("USDA FDC hit for barcode %s (%s)", barcode, product.name)
        await cache_product(db, product)
        return product, "usda_fdc"

    # 4. Demo bank — offline / corporate network / dev fallback
    product = lookup_demo_barcode(barcode)
    if product:
        logger.debug("Demo fallback for barcode %s", barcode)
        return product, "demo"

    return None, "not_found"


async def resolve_search(query: str, page_size: int = 8) -> tuple[list[Product], str]:
    """Search for products by name using the best available source.

    Returns (products, source_label).
    Tries OFF first (broader global coverage), then USDA, then demo.
    """
    # 1. Open Food Facts search — strongest global + Indian product coverage
    products = await open_food_facts.search_by_name(query, page_size=page_size)
    if products:
        return products, "open_food_facts"

    # 2. USDA FDC search — strongest US branded food coverage
    products = await usda_fdc.search_by_name(query, page_size=page_size)
    if products:
        return products, "usda_fdc"

    # 3. Demo fallback
    products = search_demo_products(query)
    return products, "demo"


def build_not_found_response(barcode: str) -> dict:
    """Build the graceful 'not found' response with demo suggestions."""
    suggestions = get_demo_suggestions(barcode, count=3)
    return {
        "product": None,
        "score": None,
        "data_source": "not_found",
        "demo_mode": False,
        "not_found": True,
        "barcode": barcode,
        "coverage_note": (
            "Product not found in Open Food Facts or USDA FDC databases. "
            "You can add it at https://world.openfoodfacts.org/cgi/product.pl"
        ),
        "suggestions": [
            {"product": p.model_dump(), "score": None}
            for p in suggestions
        ],
    }
