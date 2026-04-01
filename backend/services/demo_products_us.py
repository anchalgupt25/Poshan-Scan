"""US / International market demo products.

Barcodes are standard UPC-A / EAN-13 values.
Nutrition data based on published product labels.
"""
from __future__ import annotations
from ..models.product import Product, NutritionFacts, NovaGroup

US_PRODUCTS: dict[str, Product] = {

    # ── Gerber Graduates Puffs Strawberry Apple ─────────────────────────────
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

    # ── Happy Baby Organics Puffs ────────────────────────────────────────
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

    # ── Cheerios Original ────────────────────────────────────────────────
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

    # ── Goldfish Cheddar Crackers ───────────────────────────────────────────
    "014100044208": Product(
        name="Pepperidge Farm Goldfish Cheddar Crackers",
        brand="Pepperidge Farm",
        barcode="014100044208",
        nova_group=NovaGroup.ULTRA_PROCESSED,
        ingredients_text=(
            "Enriched wheat flour, cheddar cheese, vegetable oils "
            "(canola, sunflower), salt, yeast, sugar, spices, "
            "natural flavors, lactic acid"
        ),
        data_source="demo",
        nutrition=NutritionFacts(
            sodium_mg=230, added_sugar_g=0, total_sugar_g=0,
            iron_mg=1.8, calcium_mg=20, zinc_mg=0.3,
            protein_g=4.0, fiber_g=1.0, calories=140,
            fat_g=5.0, saturated_fat_g=1.0,
        ),
        additives_tags=[],
    ),

    # ── Annie's Shells & Real Aged Cheddar ──────────────────────────────────
    "013562300945": Product(
        name="Annie's Shells & Real Aged Cheddar",
        brand="Annie's",
        barcode="013562300945",
        nova_group=NovaGroup.PROCESSED,
        ingredients_text=(
            "Organic pasta (wheat flour, egg whites), cheddar cheese "
            "(pasteurised milk, cheese cultures, salt, enzymes), "
            "whey, butter, salt"
        ),
        data_source="demo",
        nutrition=NutritionFacts(
            sodium_mg=450, added_sugar_g=5.0, total_sugar_g=6.0,
            iron_mg=2.0, calcium_mg=200, zinc_mg=1.0,
            protein_g=9.0, fiber_g=2.0, calories=250,
            fat_g=3.0, saturated_fat_g=1.5,
        ),
        additives_tags=[],
    ),

    # ── Kellogg's Froot Loops (artificial dye showcase) ────────────────────
    "038000199271": Product(
        name="Kellogg's Froot Loops",
        brand="Kellogg's",
        barcode="038000199271",
        nova_group=NovaGroup.ULTRA_PROCESSED,
        ingredients_text=(
            "Sugar, corn flour blend, wheat flour, whole grain oat flour, "
            "oat hull fiber, salt, soluble corn fiber, Red 40, "
            "Blue 2, Yellow 6, Blue 1, BHT for freshness, "
            "natural flavor, vitamin C, vitamin E"
        ),
        data_source="demo",
        nutrition=NutritionFacts(
            sodium_mg=150, added_sugar_g=12.0, total_sugar_g=13.0,
            iron_mg=8.0, calcium_mg=0, zinc_mg=1.5,
            protein_g=1.5, fiber_g=3.0, calories=110,
            fat_g=1.0, saturated_fat_g=0,
        ),
        additives_tags=["en:e129", "en:e133", "en:e110", "en:e131"],
    ),

    # ── Quaker Old Fashioned Rolled Oats ────────────────────────────────────
    "030000010625": Product(
        name="Quaker Old Fashioned Rolled Oats",
        brand="Quaker",
        barcode="030000010625",
        nova_group=NovaGroup.CULINARY,
        ingredients_text="100% Rolled Whole Grain Oats",
        data_source="demo",
        nutrition=NutritionFacts(
            sodium_mg=0, added_sugar_g=0, total_sugar_g=1.0,
            iron_mg=2.0, calcium_mg=20, zinc_mg=1.4,
            protein_g=5.0, fiber_g=4.0, calories=150,
            fat_g=3.0, saturated_fat_g=0.5,
        ),
        additives_tags=[],
    ),

    # ── Fruit Roll-Ups Strawberry ───────────────────────────────────────────
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
        additives_tags=["en:e129", "en:e102", "en:e133"],
    ),

    # ── Earth's Best Organic Teething Biscuits ──────────────────────────────
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

    # ── Nutella ───────────────────────────────────────────────────────────
    "009800895030": Product(
        name="Nutella Hazelnut Spread with Cocoa",
        brand="Ferrero",
        barcode="009800895030",
        nova_group=NovaGroup.ULTRA_PROCESSED,
        ingredients_text=(
            "Sugar, palm oil, hazelnuts (13%), cocoa powder (7.4%), "
            "skim milk powder, reduced minerals whey powder, "
            "soy lecithin, vanillin (artificial flavor)"
        ),
        data_source="demo",
        nutrition=NutritionFacts(
            sodium_mg=15, added_sugar_g=21.5, total_sugar_g=22.0,
            iron_mg=1.0, calcium_mg=50, zinc_mg=0.3,
            protein_g=2.0, fiber_g=1.5, calories=200,
            fat_g=12.0, saturated_fat_g=4.0,
        ),
        additives_tags=["en:e322"],
    ),
}

# Search key → barcode for US products
US_NAME_INDEX: dict[str, str] = {
    "gerber puffs": "015000043321",
    "gerber graduates puffs": "015000043321",
    "happy baby puffs": "016000196391",
    "cheerios": "016000121027",
    "goldfish": "014100044208",
    "goldfish crackers": "014100044208",
    "annies mac": "013562300945",
    "mac and cheese": "013562300945",
    "froot loops": "038000199271",
    "fruit loops": "038000199271",
    "quaker oats": "030000010625",
    "oatmeal": "030000010625",
    "fruit roll ups": "040000521501",
    "fruit roll-ups": "040000521501",
    "earths best biscuits": "023923304203",
    "earth's best teething": "023923304203",
    "nutella": "009800895030",
}

# Preferred barcodes for "not found" suggestions when barcode is US
US_SUGGESTIONS = [
    "016000121027",  # Cheerios
    "015000043321",  # Gerber Puffs
    "014100044208",  # Goldfish
    "030000010625",  # Quaker Oats
    "013562300945",  # Annie's Mac
]
