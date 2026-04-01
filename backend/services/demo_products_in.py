"""Indian market demo products.

All barcodes start with 890 (Indian EAN prefix).
Nutrition data based on published product labels.
"""
from __future__ import annotations
from ..models.product import Product, NutritionFacts, NovaGroup

INDIAN_PRODUCTS: dict[str, Product] = {

    # ── Nestlé Maggi 2-Minute Noodles Masala ─────────────────────────────
    "8901058852362": Product(
        name="Maggi 2-Minute Noodles Masala",
        brand="Nestlé",
        barcode="8901058852362",
        nova_group=NovaGroup.ULTRA_PROCESSED,
        ingredients_text=(
            "Wheat flour (maida), palm oil, salt, sugar, tapioca starch, "
            "maltodextrin, flavour enhancers (INS 627, INS 631), "
            "spices and condiments, onion powder, garlic powder, "
            "acidity regulators (INS 330, INS 331)"
        ),
        data_source="demo",
        nutrition=NutritionFacts(
            sodium_mg=794, added_sugar_g=1.4, total_sugar_g=2.1,
            iron_mg=2.4, calcium_mg=15, zinc_mg=0.4,
            protein_g=6.8, fiber_g=2.2, calories=296,
            fat_g=13.0, saturated_fat_g=6.0,
        ),
        additives_tags=["en:e627", "en:e631", "en:e330"],
    ),

    # ── Nestlé Cerelac Wheat (6+ months) ─────────────────────────────────
    "8901058000068": Product(
        name="Nestlé Cerelac Fortified Baby Cereal Wheat",
        brand="Nestlé",
        barcode="8901058000068",
        nova_group=NovaGroup.PROCESSED,
        ingredients_text=(
            "Wheat flour, skimmed milk powder, sugar, vegetable oils "
            "(palm, sunflower), calcium carbonate, ferrous sulphate, "
            "zinc sulphate, vitamin C, vitamin D3, folic acid, iodine"
        ),
        data_source="demo",
        nutrition=NutritionFacts(
            sodium_mg=32, added_sugar_g=3.2, total_sugar_g=6.8,
            iron_mg=8.0, calcium_mg=220, zinc_mg=2.0,
            protein_g=3.8, fiber_g=0.8, calories=100,
            fat_g=3.0, saturated_fat_g=1.2,
        ),
        additives_tags=[],
    ),

    # ── Nestlé Cerelac Rice (6+ months) ──────────────────────────────────
    "8901058000044": Product(
        name="Nestlé Cerelac Fortified Baby Cereal Rice",
        brand="Nestlé",
        barcode="8901058000044",
        nova_group=NovaGroup.PROCESSED,
        ingredients_text=(
            "Rice flour, skimmed milk powder, sugar, vegetable oils, "
            "calcium carbonate, ferrous sulphate, zinc sulphate, "
            "vitamin C, vitamin D3, vitamin B12, folic acid"
        ),
        data_source="demo",
        nutrition=NutritionFacts(
            sodium_mg=28, added_sugar_g=2.8, total_sugar_g=6.0,
            iron_mg=8.5, calcium_mg=210, zinc_mg=1.8,
            protein_g=2.6, fiber_g=0.4, calories=96,
            fat_g=2.8, saturated_fat_g=1.1,
        ),
        additives_tags=[],
    ),

    # ── Parle-G Original Gluco Biscuits ──────────────────────────────────
    "8901015005332": Product(
        name="Parle-G Original Gluco Biscuits",
        brand="Parle",
        barcode="8901015005332",
        nova_group=NovaGroup.ULTRA_PROCESSED,
        ingredients_text=(
            "Wheat flour (atta), sugar, edible vegetable oil "
            "(partially hydrogenated), invert syrup, leavening agents "
            "(500ii, 503ii), milk solids, salt, dough conditioner (223)"
        ),
        data_source="demo",
        nutrition=NutritionFacts(
            sodium_mg=136, added_sugar_g=12.0, total_sugar_g=13.5,
            iron_mg=0.9, calcium_mg=60, zinc_mg=0.3,
            protein_g=3.8, fiber_g=0.8, calories=250,
            fat_g=8.0, saturated_fat_g=4.0,
        ),
        additives_tags=["en:e223"],
    ),

    # ── Cadbury Bournvita 5 Star Magic ─────────────────────────────────
    "8901396024512": Product(
        name="Cadbury Bournvita 5 Star Magic",
        brand="Mondelez",
        barcode="8901396024512",
        nova_group=NovaGroup.ULTRA_PROCESSED,
        ingredients_text=(
            "Sugar, cocoa solids, malt extract, liquid glucose, milk solids, "
            "vitamins (B2, B9, B12, C, D), minerals (iron, calcium, "
            "phosphorus, magnesium), wheat flour, dextrose, salt, "
            "colour (150d caramel), artificial flavouring"
        ),
        data_source="demo",
        nutrition=NutritionFacts(
            sodium_mg=65, added_sugar_g=19.0, total_sugar_g=20.5,
            iron_mg=7.5, calcium_mg=280, zinc_mg=1.2,
            protein_g=4.5, fiber_g=1.0, calories=380,
            fat_g=3.5, saturated_fat_g=1.5,
        ),
        additives_tags=["en:e150d"],
    ),

    # ── Horlicks Original ─────────────────────────────────────────────────
    "8901063016014": Product(
        name="Horlicks Original Health & Nutrition Drink",
        brand="GlaxoSmithKline",
        barcode="8901063016014",
        nova_group=NovaGroup.ULTRA_PROCESSED,
        ingredients_text=(
            "Wheat flour, malted barley, milk solids, sugar, salt, "
            "vitamins (A, B1, B2, B3, B6, B9, B12, C, D3), "
            "minerals (calcium, iron, zinc, iodine, magnesium, copper)"
        ),
        data_source="demo",
        nutrition=NutritionFacts(
            sodium_mg=115, added_sugar_g=4.5, total_sugar_g=8.0,
            iron_mg=8.4, calcium_mg=400, zinc_mg=3.0,
            protein_g=4.8, fiber_g=1.2, calories=126,
            fat_g=1.8, saturated_fat_g=0.8,
        ),
        additives_tags=[],
    ),

    # ── Nestlé Milo ────────────────────────────────────────────────────
    "8901058154660": Product(
        name="Nestlé Milo Energy Drink",
        brand="Nestlé",
        barcode="8901058154660",
        nova_group=NovaGroup.ULTRA_PROCESSED,
        ingredients_text=(
            "Malt extract (barley), sugar, skimmed milk powder, cocoa, "
            "palm oil, glucose syrup, vitamins (B2, B3, B6, B12, C, D), "
            "minerals (iron, calcium, phosphorus, copper, zinc)"
        ),
        data_source="demo",
        nutrition=NutritionFacts(
            sodium_mg=90, added_sugar_g=17.0, total_sugar_g=18.5,
            iron_mg=5.4, calcium_mg=267, zinc_mg=2.5,
            protein_g=3.3, fiber_g=0.8, calories=116,
            fat_g=1.2, saturated_fat_g=0.5,
        ),
        additives_tags=[],
    ),

    # ── Britannia Marie Gold ─────────────────────────────────────────────
    "8901063027003": Product(
        name="Britannia Marie Gold Biscuits",
        brand="Britannia",
        barcode="8901063027003",
        nova_group=NovaGroup.ULTRA_PROCESSED,
        ingredients_text=(
            "Wheat flour (maida), sugar, edible vegetable oil (palm), "
            "invert syrup, raising agents (500ii, 503ii), salt, "
            "dough conditioner (223), emulsifier (322)"
        ),
        data_source="demo",
        nutrition=NutritionFacts(
            sodium_mg=200, added_sugar_g=8.0, total_sugar_g=9.5,
            iron_mg=1.0, calcium_mg=40, zinc_mg=0.2,
            protein_g=4.0, fiber_g=1.0, calories=223,
            fat_g=7.0, saturated_fat_g=3.5,
        ),
        additives_tags=["en:e223", "en:e322"],
    ),

    # ── Kurkure Masala Munch ─────────────────────────────────────────────
    "8901491045056": Product(
        name="Kurkure Masala Munch",
        brand="PepsiCo",
        barcode="8901491045056",
        nova_group=NovaGroup.ULTRA_PROCESSED,
        ingredients_text=(
            "Rice meal, edible vegetable oil (palm), corn meal, seasoning "
            "(salt, spices, flavour enhancers (INS 621 MSG, INS 627, INS 631), "
            "sugar, acidity regulator (INS 330), artificial flavours)"
        ),
        data_source="demo",
        nutrition=NutritionFacts(
            sodium_mg=340, added_sugar_g=1.5, total_sugar_g=2.0,
            iron_mg=0.5, calcium_mg=5, zinc_mg=0.1,
            protein_g=2.0, fiber_g=0.5, calories=142,
            fat_g=8.5, saturated_fat_g=4.0,
        ),
        additives_tags=["en:e621", "en:e627", "en:e631", "en:e330"],
    ),

    # ── Lay's India Classic Salted ─────────────────────────────────────────
    "8901491500060": Product(
        name="Lay's Classic Salted Chips",
        brand="PepsiCo",
        barcode="8901491500060",
        nova_group=NovaGroup.ULTRA_PROCESSED,
        ingredients_text="Potatoes, edible vegetable oil (palm / sunflower), salt",
        data_source="demo",
        nutrition=NutritionFacts(
            sodium_mg=170, added_sugar_g=0, total_sugar_g=0.3,
            iron_mg=0.3, calcium_mg=10, zinc_mg=0.2,
            protein_g=2.0, fiber_g=1.5, calories=160,
            fat_g=10.0, saturated_fat_g=4.5,
        ),
        additives_tags=[],
    ),

    # ── Cadbury Dairy Milk ───────────────────────────────────────────────
    "8901579001094": Product(
        name="Cadbury Dairy Milk Chocolate",
        brand="Mondelez",
        barcode="8901579001094",
        nova_group=NovaGroup.ULTRA_PROCESSED,
        ingredients_text=(
            "Sugar, cocoa butter, milk solids, cocoa solids, "
            "emulsifier (E442 PGPR), vanilla flavouring"
        ),
        data_source="demo",
        nutrition=NutritionFacts(
            sodium_mg=60, added_sugar_g=27.0, total_sugar_g=28.0,
            iron_mg=0.8, calcium_mg=180, zinc_mg=0.5,
            protein_g=4.0, fiber_g=0.5, calories=243,
            fat_g=14.0, saturated_fat_g=8.5,
        ),
        additives_tags=["en:e442"],
    ),

    # ── Sunfeast Yippee Noodles ───────────────────────────────────────────
    "8901030864001": Product(
        name="Sunfeast Yippee Magic Masala Noodles",
        brand="ITC",
        barcode="8901030864001",
        nova_group=NovaGroup.ULTRA_PROCESSED,
        ingredients_text=(
            "Wheat flour, edible vegetable oil (palm), iodised salt, "
            "sugar, spices, flavour enhancers (INS 627, INS 631), "
            "maltodextrin, onion powder, acidity regulator (INS 330)"
        ),
        data_source="demo",
        nutrition=NutritionFacts(
            sodium_mg=750, added_sugar_g=1.2, total_sugar_g=2.0,
            iron_mg=1.8, calcium_mg=20, zinc_mg=0.3,
            protein_g=7.0, fiber_g=1.8, calories=320,
            fat_g=14.0, saturated_fat_g=6.5,
        ),
        additives_tags=["en:e627", "en:e631", "en:e330"],
    ),

    # ── Dabur 100% Pure Honey ────────────────────────────────────────────
    "8901207310019": Product(
        name="Dabur 100% Pure Honey",
        brand="Dabur",
        barcode="8901207310019",
        nova_group=NovaGroup.UNPROCESSED,
        ingredients_text="100% Pure Honey",
        data_source="demo",
        nutrition=NutritionFacts(
            sodium_mg=4, added_sugar_g=0, total_sugar_g=17.0,
            iron_mg=0.1, calcium_mg=6, zinc_mg=0.1,
            protein_g=0.1, fiber_g=0.2, calories=64,
            fat_g=0, saturated_fat_g=0,
        ),
        additives_tags=[],
    ),

    # ── PediaSure Vanilla Delight ─────────────────────────────────────────
    "8901396050268": Product(
        name="PediaSure Vanilla Delight",
        brand="Abbott",
        barcode="8901396050268",
        nova_group=NovaGroup.ULTRA_PROCESSED,
        ingredients_text=(
            "Corn maltodextrin, sugar, sodium caseinate, soy protein isolate, "
            "high oleic sunflower oil, calcium phosphate, potassium citrate, "
            "vitamins (A, D, E, K, C, B1, B2, B3, B6, B12, folic acid), "
            "minerals (iron, zinc, iodine, selenium, manganese)"
        ),
        data_source="demo",
        nutrition=NutritionFacts(
            sodium_mg=110, added_sugar_g=8.5, total_sugar_g=14.0,
            iron_mg=4.0, calcium_mg=300, zinc_mg=2.5,
            protein_g=7.0, fiber_g=1.5, calories=240,
            fat_g=9.0, saturated_fat_g=1.5,
        ),
        additives_tags=[],
    ),

    # ── Amul Kool Flavoured Milk (Elaichi) ──────────────────────────────────
    "8906002631000": Product(
        name="Amul Kool Flavoured Milk (Elaichi)",
        brand="Amul",
        barcode="8906002631000",
        nova_group=NovaGroup.PROCESSED,
        ingredients_text=(
            "Toned milk, sugar, elaichi (cardamom) flavour, "
            "stabilizer (INS 407 carrageenan)"
        ),
        data_source="demo",
        nutrition=NutritionFacts(
            sodium_mg=55, added_sugar_g=6.5, total_sugar_g=11.0,
            iron_mg=0.1, calcium_mg=120, zinc_mg=0.4,
            protein_g=3.2, fiber_g=0, calories=72,
            fat_g=1.5, saturated_fat_g=1.0,
        ),
        additives_tags=["en:e407"],
    ),

    # ── Kissan Mixed Fruit Jam ────────────────────────────────────────────
    "8901030865000": Product(
        name="Kissan Mixed Fruit Jam",
        brand="HUL (Kissan)",
        barcode="8901030865000",
        nova_group=NovaGroup.PROCESSED,
        ingredients_text=(
            "Sugar, mixed fruit pulp (papaya, mango, guava, apple), "
            "pectin, citric acid, sodium benzoate (preservative), "
            "artificial mixed fruit flavour, colour (Ponceau 4R)"
        ),
        data_source="demo",
        nutrition=NutritionFacts(
            sodium_mg=20, added_sugar_g=22.0, total_sugar_g=24.0,
            iron_mg=0.3, calcium_mg=10, zinc_mg=0,
            protein_g=0.2, fiber_g=0.5, calories=100,
            fat_g=0.1, saturated_fat_g=0,
        ),
        additives_tags=["en:e211", "en:e124"],
    ),

    # ── Haldiram's Aloo Bhujia ──────────────────────────────────────────
    "8906022100013": Product(
        name="Haldiram's Aloo Bhujia",
        brand="Haldiram's",
        barcode="8906022100013",
        nova_group=NovaGroup.ULTRA_PROCESSED,
        ingredients_text=(
            "Besan (chickpea flour), potatoes, edible vegetable oil (palm), "
            "salt, spices (black pepper, coriander, cumin, chilli powder), "
            "acidity regulator (citric acid)"
        ),
        data_source="demo",
        nutrition=NutritionFacts(
            sodium_mg=380, added_sugar_g=0.5, total_sugar_g=1.2,
            iron_mg=1.8, calcium_mg=30, zinc_mg=0.5,
            protein_g=4.5, fiber_g=2.0, calories=200,
            fat_g=12.0, saturated_fat_g=5.5,
        ),
        additives_tags=[],
    ),

    # ── Complan Royale Chocolate ─────────────────────────────────────────
    "8901030000012": Product(
        name="Complan Royale Chocolate Growth Drink",
        brand="Zydus Wellness",
        barcode="8901030000012",
        nova_group=NovaGroup.ULTRA_PROCESSED,
        ingredients_text=(
            "Skimmed milk powder, sugar, cocoa powder, wheat flour, "
            "maltodextrin, glucose, soy protein, vitamins (A, C, D, E, K, "
            "B1, B2, B3, B6, B9, B12), minerals (iron, calcium, zinc, iodine)"
        ),
        data_source="demo",
        nutrition=NutritionFacts(
            sodium_mg=80, added_sugar_g=10.0, total_sugar_g=15.0,
            iron_mg=3.0, calcium_mg=240, zinc_mg=1.5,
            protein_g=6.0, fiber_g=0.5, calories=130,
            fat_g=1.5, saturated_fat_g=0.8,
        ),
        additives_tags=[],
    ),

    # ── Mother Dairy Set Dahi ─────────────────────────────────────────────
    "8906002630010": Product(
        name="Mother Dairy Set Dahi (Natural Yogurt)",
        brand="Mother Dairy",
        barcode="8906002630010",
        nova_group=NovaGroup.CULINARY,
        ingredients_text=(
            "Standardised milk, active yogurt cultures "
            "(Lactobacillus bulgaricus, Streptococcus thermophilus)"
        ),
        data_source="demo",
        nutrition=NutritionFacts(
            sodium_mg=45, added_sugar_g=0, total_sugar_g=4.5,
            iron_mg=0.1, calcium_mg=120, zinc_mg=0.4,
            protein_g=3.5, fiber_g=0, calories=90,
            fat_g=4.5, saturated_fat_g=3.0,
        ),
        additives_tags=[],
    ),

    # ── Britannia Good Day Butter Biscuits ────────────────────────────────
    "8901063130009": Product(
        name="Britannia Good Day Butter Biscuits",
        brand="Britannia",
        barcode="8901063130009",
        nova_group=NovaGroup.ULTRA_PROCESSED,
        ingredients_text=(
            "Wheat flour, sugar, edible vegetable oil (palm), butter (3%), "
            "invert syrup, salt, raising agents (500ii, 503ii), "
            "emulsifier (322), dough conditioner (223), artificial butter flavour"
        ),
        data_source="demo",
        nutrition=NutritionFacts(
            sodium_mg=190, added_sugar_g=11.0, total_sugar_g=12.5,
            iron_mg=0.8, calcium_mg=30, zinc_mg=0.2,
            protein_g=3.5, fiber_g=0.8, calories=240,
            fat_g=10.0, saturated_fat_g=5.0,
        ),
        additives_tags=["en:e322", "en:e223"],
    ),
}

# Search key → barcode for Indian products
INDIAN_NAME_INDEX: dict[str, str] = {
    "maggi": "8901058852362",
    "maggi noodles": "8901058852362",
    "cerelac wheat": "8901058000068",
    "cerelac rice": "8901058000044",
    "cerelac": "8901058000068",
    "parle g": "8901015005332",
    "parle-g": "8901015005332",
    "bournvita": "8901396024512",
    "horlicks": "8901063016014",
    "milo": "8901058154660",
    "nestle milo": "8901058154660",
    "marie gold": "8901063027003",
    "britannia marie": "8901063027003",
    "kurkure": "8901491045056",
    "lays india": "8901491500060",
    "lays": "8901491500060",
    "cadbury dairy milk": "8901579001094",
    "dairy milk": "8901579001094",
    "yippee": "8901030864001",
    "sunfeast yippee": "8901030864001",
    "dabur honey": "8901207310019",
    "honey": "8901207310019",
    "pediasure": "8901396050268",
    "amul kool": "8906002631000",
    "kissan jam": "8901030865000",
    "haldirams": "8906022100013",
    "haldiram": "8906022100013",
    "aloo bhujia": "8906022100013",
    "complan": "8901030000012",
    "mother dairy dahi": "8906002630010",
    "dahi": "8906002630010",
    "yogurt": "8906002630010",
    "good day": "8901063130009",
}

# Preferred barcodes for "not found" suggestions when barcode is Indian
INDIAN_SUGGESTIONS = [
    "8901058852362",  # Maggi
    "8901058000068",  # Cerelac Wheat
    "8901015005332",  # Parle-G
    "8901396024512",  # Bournvita
    "8901063016014",  # Horlicks
]
