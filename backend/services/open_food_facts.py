"""Open Food Facts API v2 client.

Docs: https://world.openfoodfacts.org/data
No API key required. Rate limit: reasonable use (~10 req/s).

Coverage:
  - 3M+ products globally (US, IN, EU, CN, and more)
  - Strong on US grocery, Indian packaged foods, EU labelled products
  - NOVA classification, additives/e-numbers, allergen tags built-in
  - Trusted by: researchers, AAP-referenced studies, regulatory bodies

Proxy: reads HTTP_PROXY / HTTPS_PROXY from environment automatically.
Set POSHAN_DEMO_MODE=1 to skip real API calls and return None (trigger demo fallback).
"""
from __future__ import annotations

import os
import httpx
from ..models.product import Product, NutritionFacts, NovaGroup

BASE_URL = "https://world.openfoodfacts.org/api/v2/product"
USER_AGENT = "PoshanScan/0.1 (child-food-scoring; contact@poshanapp.com)"

# Respect HTTP_PROXY / HTTPS_PROXY environment variables (needed on Walmart corp network)
_PROXIES: dict | None = None
_http_proxy = os.getenv("HTTP_PROXY") or os.getenv("http_proxy")
_https_proxy = os.getenv("HTTPS_PROXY") or os.getenv("https_proxy")
if _http_proxy or _https_proxy:
    _PROXIES = {}
    if _http_proxy:
        _PROXIES["http://"] = _http_proxy
    if _https_proxy:
        _PROXIES["https://"] = _https_proxy

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


_SEARCH_URL = "https://world.openfoodfacts.org/api/v2/search"
_PRODUCT_FIELDS = (
    "product_name,brands,categories,serving_size,serving_quantity,"
    "nutriments,nova_group,additives_tags,ingredients_text,image_url,code"
)


def _raw_to_product(p: dict, barcode: str | None = None) -> Product | None:
    """Convert an OFF product dict to our Product model."""
    name = p.get("product_name") or p.get("abbreviated_product_name")
    if not name:
        return None  # Skip products without a name — not useful

    serving_g_raw = p.get("serving_quantity")
    serving_g = float(serving_g_raw) if serving_g_raw else None
    nutriments = p.get("nutriments", {})
    additives = p.get("additives_tags", [])
    ingredients_text = p.get("ingredients_text", "")

    nutrition = _parse_nutrition(nutriments, serving_g)
    nutrition.artificial_flavor = _has_artificial_flavor(ingredients_text)
    nutrition.artificial_dyes = _has_artificial_dyes(additives)

    return Product(
        name=name,
        brand=p.get("brands"),
        category=p.get("categories"),
        barcode=barcode or p.get("code") or p.get("_id"),
        nova_group=_parse_nova(p),
        ingredients_text=ingredients_text,
        image_url=p.get("image_url") or p.get("image_front_url"),
        data_source="open_food_facts",
        nutrition=nutrition,
        additives_tags=additives,
    )


async def search_by_name(query: str, page_size: int = 8) -> list[Product]:
    """Full-text product search via OFF v2 search API.

    Great for Indian packaged foods, US snacks, EU products — 3M+ items.
    Returns up to page_size results sorted by OFF completeness score.
    """
    if os.getenv("POSHAN_DEMO_MODE"):
        return []

    params = {
        "search_terms": query,
        "fields": _PRODUCT_FIELDS,
        "page_size": page_size,
        "sort_by": "unique_scans_n",  # Most-scanned = most likely correct data
    }
    client_kwargs: dict = {"timeout": 8.0}
    if _PROXIES:
        client_kwargs["proxies"] = _PROXIES

    async with httpx.AsyncClient(**client_kwargs) as client:
        try:
            resp = await client.get(
                _SEARCH_URL, params=params,
                headers={"User-Agent": USER_AGENT},
            )
            resp.raise_for_status()
        except (httpx.HTTPError, httpx.TimeoutException):
            return []

    products = []
    for p in resp.json().get("products", []):
        product = _raw_to_product(p)
        if product:
            products.append(product)
    return products


async def lookup_barcode(barcode: str) -> Product | None:
    """Fetch product from Open Food Facts by barcode. Returns None if not found."""
    if os.getenv("POSHAN_DEMO_MODE"):
        return None  # Demo mode: skip real API, let scan.py use demo data

    url = f"{BASE_URL}/{barcode}.json"
    params = {"fields": _PRODUCT_FIELDS}
    client_kwargs: dict = {"timeout": 8.0}
    if _PROXIES:
        client_kwargs["proxies"] = _PROXIES

    async with httpx.AsyncClient(**client_kwargs) as client:
        try:
            resp = await client.get(url, params=params, headers={"User-Agent": USER_AGENT})
            resp.raise_for_status()
        except (httpx.HTTPError, httpx.TimeoutException):
            return None

    data = resp.json()
    if data.get("status") != 1:
        return None

    return _raw_to_product(data.get("product", {}), barcode=barcode)
