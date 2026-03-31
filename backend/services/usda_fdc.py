"""USDA FoodData Central API client — fallback when OFF doesn't have a product.

Docs: https://fdc.nal.usda.gov/api-guide.html
Free API key: https://fdc.nal.usda.gov/api-guide.html#bkmk-1
Rate limit: 1,000 req/hour with key.
"""
from __future__ import annotations

import os
import httpx
from ..models.product import Product, NutritionFacts, NovaGroup

BASE_URL = "https://api.nal.usda.gov/fdc/v1"

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


async def search_by_name(query: str, page_size: int = 5) -> list[Product]:
    """Search USDA FDC by product name. Returns up to page_size results."""
    api_key = os.getenv("USDA_FDC_API_KEY", "DEMO_KEY")
    url = f"{BASE_URL}/foods/search"
    params = {
        "api_key": api_key,
        "query": query,
        "dataType": "Branded,Foundation",
        "pageSize": page_size,
    }
    async with httpx.AsyncClient(timeout=8.0) as client:
        try:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
        except (httpx.HTTPError, httpx.TimeoutException):
            return []

    data = resp.json()
    results = []
    for food in data.get("foods", []):
        nutrition = _extract_nutrients(food.get("foodNutrients", []))
        results.append(Product(
            name=food.get("description") or food.get("lowercaseDescription") or "Unknown",
            brand=food.get("brandOwner") or food.get("brandName"),
            barcode=food.get("gtinUpc"),
            nova_group=NovaGroup.ULTRA_PROCESSED,  # USDA doesn't provide NOVA
            ingredients_text=food.get("ingredients"),
            data_source="usda_fdc",
            nutrition=nutrition,
            additives_tags=[],
        ))
    return results


async def lookup_barcode(barcode: str) -> Product | None:
    """Search USDA FDC by UPC barcode (via branded foods search)."""
    results = await search_by_name(barcode, page_size=1)
    if results and results[0].barcode == barcode:
        return results[0]
    return None
