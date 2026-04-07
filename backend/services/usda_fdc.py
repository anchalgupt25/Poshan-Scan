"""USDA FoodData Central API client — fallback when OFF doesn't have a product.

Docs: https://fdc.nal.usda.gov/api-guide.html
Free API key: https://fdc.nal.usda.gov/api-guide.html#bkmk-1
Rate limit: 1,000 req/hour with key (30/min on DEMO_KEY).

Coverage:
  - ~1M US branded foods with UPC/GTIN codes
  - Foundation & SR Legacy data (raw commodity foods, no barcodes)
  - Key authority: USDA, FDA, regulated US packaged food labels
"""
from __future__ import annotations

import os
import httpx
from ..models.product import Product, NutritionFacts, NovaGroup

BASE_URL = "https://api.nal.usda.gov/fdc/v1"

# Respect HTTP_PROXY / HTTPS_PROXY env vars (needed on Walmart corp network)
_PROXIES: dict | None = None
_http_proxy = os.getenv("HTTP_PROXY") or os.getenv("http_proxy")
_https_proxy = os.getenv("HTTPS_PROXY") or os.getenv("https_proxy")
if _http_proxy or _https_proxy:
    _PROXIES = {}
    if _http_proxy:
        _PROXIES["http://"] = _http_proxy
    if _https_proxy:
        _PROXIES["https://"] = _https_proxy

# NIH nutrient IDs for key nutrients
NUTRIENT_IDS = {
    "sodium_mg": 1093,
    "iron_mg": 1089,
    "calcium_mg": 1087,
    "zinc_mg": 1095,
    "protein_g": 1003,
    "fiber_g": 1079,
    "fat_g": 1004,
    "saturated_fat_g": 1258,
    "total_sugar_g": 2000,
    "added_sugar_g": 1235,
    "calories": 1008,
}


def _extract_nutrients(food_nutrients: list[dict]) -> NutritionFacts:
    """Build NutritionFacts from USDA foodNutrients array."""
    by_id = {
        n.get("nutrient", {}).get("id") or n.get("nutrientId"): n.get("amount", 0.0)
        for n in food_nutrients
    }

    def get(nutrient_key: str) -> float:
        nid = NUTRIENT_IDS.get(nutrient_key)
        return float(by_id.get(nid, 0.0))

    return NutritionFacts(
        sodium_mg=get("sodium_mg"),
        iron_mg=get("iron_mg"),
        calcium_mg=get("calcium_mg"),
        zinc_mg=get("zinc_mg"),
        protein_g=get("protein_g"),
        fiber_g=get("fiber_g"),
        fat_g=get("fat_g"),
        saturated_fat_g=get("saturated_fat_g"),
        total_sugar_g=get("total_sugar_g"),
        added_sugar_g=get("added_sugar_g"),
        calories=get("calories"),
    )


def _api_key() -> str:
    return os.getenv("USDA_FDC_API_KEY", "DEMO_KEY")


def _normalize_upc(upc: str) -> str:
    """Strip leading zeros for loose barcode matching (UPC-A vs EAN-13 edge cases)."""
    return upc.lstrip("0")


def _food_to_product(food: dict, barcode: str | None = None) -> Product:
    """Convert a USDA FDC food dict to a Product model."""
    nutrition = _extract_nutrients(food.get("foodNutrients", []))
    return Product(
        name=food.get("description") or food.get("lowercaseDescription") or "Unknown",
        brand=food.get("brandOwner") or food.get("brandName"),
        barcode=barcode or food.get("gtinUpc"),
        nova_group=NovaGroup.ULTRA_PROCESSED,  # USDA doesn't provide NOVA classification
        ingredients_text=food.get("ingredients"),
        data_source="usda_fdc",
        nutrition=nutrition,
        additives_tags=[],
    )


async def lookup_barcode(barcode: str) -> Product | None:
    """Look up a product by UPC/EAN barcode in USDA Branded Foods database.

    USDA FDC stores barcodes as `gtinUpc`. We search with the raw barcode as
    the query (Branded dataType) and find the first result whose gtinUpc
    matches after stripping leading zeros (handles UPC-A vs EAN-13 padding).
    """
    url = f"{BASE_URL}/foods/search"
    params = {
        "api_key": _api_key(),
        "query": barcode,
        "dataType": "Branded",
        "pageSize": 10,  # small page — we just need the UPC match
    }
    client_kwargs: dict = {"timeout": 8.0}
    if _PROXIES:
        client_kwargs["proxies"] = _PROXIES

    async with httpx.AsyncClient(**client_kwargs) as client:
        try:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
        except (httpx.HTTPError, httpx.TimeoutException):
            return None

    norm_barcode = _normalize_upc(barcode)
    for food in resp.json().get("foods", []):
        gtin = food.get("gtinUpc", "")
        if gtin and _normalize_upc(gtin) == norm_barcode:
            return _food_to_product(food, barcode=barcode)
    return None


async def search_by_name(query: str, page_size: int = 8) -> list[Product]:
    """Search USDA FDC by product name. Covers branded + foundation foods.

    Good for US packaged goods, cereals, baby food regulated under FDA/USDA.
    """
    url = f"{BASE_URL}/foods/search"
    params = {
        "api_key": _api_key(),
        "query": query,
        "dataType": "Branded,Foundation",
        "pageSize": page_size,
    }
    client_kwargs: dict = {"timeout": 8.0}
    if _PROXIES:
        client_kwargs["proxies"] = _PROXIES

    async with httpx.AsyncClient(**client_kwargs) as client:
        try:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
        except (httpx.HTTPError, httpx.TimeoutException):
            return []

    return [_food_to_product(food) for food in resp.json().get("foods", [])]
