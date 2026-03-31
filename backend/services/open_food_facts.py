"""Open Food Facts API v2 client.

Docs: https://world.openfoodfacts.org/data
No API key required. Rate limit: reasonable use.
"""
from __future__ import annotations

import httpx
from ..models.product import Product, NutritionFacts, NovaGroup

BASE_URL = "https://world.openfoodfacts.org/api/v2/product"
USER_AGENT = "PoshanScan/0.1 (child-food-scoring; contact@poshanapp.com)"

ARTIFICIAL_DYE_TAGS = {
    "en:e102", "en:e104", "en:e110", "en:e122", "en:e124", "en:e129",
    "en:e131", "en:e132", "en:e133", "en:e142",
    "en:red-40", "en:yellow-5", "en:yellow-6", "en:blue-1", "en:blue-2",
}


def _parse_nova(raw: dict) -> NovaGroup:
    val = raw.get("nova_group") or raw.get("nova_groups")
    try:
        return NovaGroup(int(val))
    except (ValueError, TypeError):
        return NovaGroup.ULTRA_PROCESSED


def _parse_nutrition(raw_nutriments: dict, serving_g: float | None) -> NutritionFacts:
    """Extract per-serving nutrition from OFF nutriments dict."""
    # OFF uses _serving suffix when serving size is declared, else per_100g
    suffix = "_serving" if serving_g else "_100g"

    def get(key: str) -> float:
        v = raw_nutriments.get(f"{key}{suffix}") or raw_nutriments.get(key, 0)
        try:
            return float(v)
        except (ValueError, TypeError):
            return 0.0

    return NutritionFacts(
        sodium_mg=get("sodium") * 1000,  # OFF stores in grams
        added_sugar_g=get("added-sugars"),
        total_sugar_g=get("sugars"),
        iron_mg=get("iron") * 1000,      # grams → mg
        calcium_mg=get("calcium") * 1000,
        zinc_mg=get("zinc") * 1000,
        protein_g=get("proteins"),
        fiber_g=get("fiber"),
        calories=get("energy-kcal"),
        fat_g=get("fat"),
        saturated_fat_g=get("saturated-fat"),
    )


def _has_artificial_flavor(ingredients_text: str) -> bool:
    text = (ingredients_text or "").lower()
    return "artificial flavor" in text or "artificial flavour" in text or "natural & artificial" in text


def _has_artificial_dyes(additives_tags: list[str]) -> bool:
    return bool(set(additives_tags or []) & ARTIFICIAL_DYE_TAGS)


async def lookup_barcode(barcode: str) -> Product | None:
    """Fetch product from Open Food Facts by barcode. Returns None if not found."""
    url = f"{BASE_URL}/{barcode}.json"
    params = {
        "fields": (
            "product_name,brands,categories,serving_size,serving_quantity,"
            "nutriments,nova_group,additives_tags,ingredients_text,image_url"
        )
    }
    async with httpx.AsyncClient(timeout=8.0) as client:
        try:
            resp = await client.get(url, params=params, headers={"User-Agent": USER_AGENT})
            resp.raise_for_status()
        except (httpx.HTTPError, httpx.TimeoutException):
            return None

    data = resp.json()
    if data.get("status") != 1:
        return None

    p = data.get("product", {})
    serving_g_raw = p.get("serving_quantity")
    serving_g = float(serving_g_raw) if serving_g_raw else None
    nutriments = p.get("nutriments", {})
    additives = p.get("additives_tags", [])
    ingredients_text = p.get("ingredients_text", "")
    nutrition = _parse_nutrition(nutriments, serving_g)
    nutrition.artificial_flavor = _has_artificial_flavor(ingredients_text)
    nutrition.artificial_dyes = _has_artificial_dyes(additives)

    return Product(
        name=p.get("product_name") or "Unknown Product",
        brand=p.get("brands"),
        category=p.get("categories"),
        barcode=barcode,
        nova_group=_parse_nova(p),
        ingredients_text=ingredients_text,
        image_url=p.get("image_url"),
        data_source="open_food_facts",
        nutrition=nutrition,
        additives_tags=additives,
    )
