"""Demo product catalogue for POSHAN_DEMO_MODE.

Realistic products from US market that Indian parents scan regularly.
Used when external APIs are unreachable (e.g. corporate network).
Each product mirrors what OFF / USDA would return for a real barcode.
"""
from __future__ import annotations

from ..models.product import Product, NutritionFacts, NovaGroup

# Keyed by barcode for instant lookup.
_DEMO_PRODUCTS: dict[str, Product] = {
    # Gerber Graduates Puffs — Strawberry Apple (15000043321)
    "015000043321": Product(
        name="Gerber Graduates Puffs Strawberry Apple",
        brand="Gerber",
        barcode="015000043321",
        nova_group=NovaGroup.ULTRA_PROCESSED,
        ingredients_text=(
            "Whole grain oat flour, rice flour, wheat flour, sugar, "
            "maltodextrin, natural flavors, vitamin E (tocopherol), "
            "pyridoxine hydrochloride, folic acid"
        ),
        data_source="demo",
        nutrition=NutritionFacts(
            sodium_mg=35, added_sugar_g=1.5, total_sugar_g=2.0,
            iron_mg=2.7, calcium_mg=0, zinc_mg=0.6,
            protein_g=1.0, fiber_g=0.5, calories=25,
            fat_g=0.5, saturated_fat_g=0,
        ),
        additives_tags=[],
    ),
    # Happy Baby Organics Puffs — Apple & Broccoli
    "016000196391": Product(
        name="Happy Baby Organics Puffs Apple & Broccoli",
        brand="Happy Baby",
        barcode="016000196391",
        nova_group=NovaGroup.ULTRA_PROCESSED,
        ingredients_text=(
            "Organic whole grain brown rice flour, organic apple powder, "
            "organic broccoli powder, organic sunflower oil, vitamin E"
        ),
        data_source="demo",
        nutrition=NutritionFacts(
            sodium_mg=30, added_sugar_g=0, total_sugar_g=1.5,
            iron_mg=0.5, calcium_mg=10, zinc_mg=0.2,
            protein_g=1.2, fiber_g=0.8, calories=22,
            fat_g=0.8, saturated_fat_g=0,
        ),
        additives_tags=[],
    ),
    # Cheerios Original
    "016000121027": Product(
        name="Cheerios Original",
        brand="General Mills",
        barcode="016000121027",
        nova_group=NovaGroup.ULTRA_PROCESSED,
        ingredients_text=(
            "Whole grain oats, modified corn starch, sugar, oat bran, "
            "salt, calcium carbonate, iron and zinc (minerals), "
            "vitamin C (sodium ascorbate), vitamin E (mixed tocopherols)"
        ),
        data_source="demo",
        nutrition=NutritionFacts(
            sodium_mg=140, added_sugar_g=1.0, total_sugar_g=2.0,
            iron_mg=12.0, calcium_mg=130, zinc_mg=3.8,
            protein_g=3.0, fiber_g=3.0, calories=100,
            fat_g=2.0, saturated_fat_g=0.5,
        ),
        additives_tags=[],
    ),
    # Fruit Roll-Ups Strawberry (artificial dye product)
    "040000521501": Product(
        name="Fruit Roll-Ups Strawberry Flavored",
        brand="Betty Crocker",
        barcode="040000521501",
        nova_group=NovaGroup.ULTRA_PROCESSED,
        ingredients_text=(
            "Pears from concentrate, corn syrup, dried corn syrup, "
            "sugar, partially hydrogenated cottonseed oil, citric acid, "
            "sodium citrate, acetylated monoglycerides, fruit pectin, "
            "malic acid, dextrose, Red 40, Yellow 5, Blue 1"
        ),
        data_source="demo",
        nutrition=NutritionFacts(
            sodium_mg=55, added_sugar_g=10.0, total_sugar_g=11.0,
            iron_mg=0, calcium_mg=0, zinc_mg=0,
            protein_g=0, fiber_g=0, calories=50,
            fat_g=0.5, saturated_fat_g=0,
        ),
        additives_tags=["en:e129", "en:e102", "en:e133"],  # Red 40, Yellow 5, Blue 1
    ),
    # Earth's Best Organic Teething Biscuits — cleaner product
    "023923304203": Product(
        name="Earth's Best Organic Teething Biscuits",
        brand="Earth's Best",
        barcode="023923304203",
        nova_group=NovaGroup.PROCESSED,
        ingredients_text=(
            "Organic whole wheat flour, organic rice flour, organic oat flour, "
            "organic sugar, organic palm oil, organic molasses, sea salt"
        ),
        data_source="demo",
        nutrition=NutritionFacts(
            sodium_mg=25, added_sugar_g=2.0, total_sugar_g=3.0,
            iron_mg=2.0, calcium_mg=20, zinc_mg=0.5,
            protein_g=2.0, fiber_g=1.5, calories=45,
            fat_g=1.5, saturated_fat_g=0.5,
        ),
        additives_tags=[],
    ),
    # Gerber Good Start Formula — honey concern
    "050000006558": Product(
        name="Nature's One Baby's Only Organic Toddler Formula",
        brand="Nature's One",
        barcode="050000006558",
        nova_group=NovaGroup.ULTRA_PROCESSED,
        ingredients_text=(
            "Organic nonfat milk, organic lactose, organic high oleic sunflower oil, "
            "organic soybean oil, organic coconut oil, honey, "
            "potassium citrate, calcium carbonate, sodium chloride"
        ),
        data_source="demo",
        nutrition=NutritionFacts(
            sodium_mg=110, added_sugar_g=8.5, total_sugar_g=10.0,
            iron_mg=3.0, calcium_mg=500, zinc_mg=2.5,
            protein_g=5.0, fiber_g=0, calories=120,
            fat_g=5.0, saturated_fat_g=2.0,
        ),
        additives_tags=[],
    ),
}

# Well-known name → barcode mapping for search-mode demo
_DEMO_BY_NAME: dict[str, str] = {
    "gerber puffs": "015000043321",
    "gerber graduates puffs": "015000043321",
    "happy baby puffs": "016000196391",
    "cheerios": "016000121027",
    "fruit roll ups": "040000521501",
    "fruit roll-ups": "040000521501",
    "earths best biscuits": "023923304203",
    "earth's best teething": "023923304203",
}


def lookup_demo_barcode(barcode: str) -> Product | None:
    """Return a demo product by barcode, or None."""
    return _DEMO_PRODUCTS.get(barcode)


def search_demo_products(query: str) -> list[Product]:
    """Return demo products that fuzzy-match a name query."""
    q = query.lower()
    matched: list[Product] = []
    for key, barcode in _DEMO_BY_NAME.items():
        if q in key or any(w in key for w in q.split()):
            p = _DEMO_PRODUCTS.get(barcode)
            if p and p not in matched:
                matched.append(p)
    return matched[:5]


def get_demo_product_list() -> list[Product]:
    """All demo products (for home-screen demo state)."""
    return list(_DEMO_PRODUCTS.values())