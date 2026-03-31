"""Product and nutrition fact models."""
from __future__ import annotations

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class NovaGroup(int, Enum):
    UNPROCESSED = 1
    CULINARY = 2
    PROCESSED = 3
    ULTRA_PROCESSED = 4


class NutritionFacts(BaseModel):
    """Per-serving nutrition facts used by the scoring engine."""
    sodium_mg: float = 0.0
    added_sugar_g: float = 0.0
    total_sugar_g: float = 0.0
    iron_mg: float = 0.0
    calcium_mg: float = 0.0
    zinc_mg: float = 0.0
    protein_g: float = 0.0
    fiber_g: float = 0.0
    calories: float = 0.0
    fat_g: float = 0.0
    saturated_fat_g: float = 0.0

    # Ingredient flags parsed from label
    artificial_flavor: bool = False
    artificial_dyes: bool = False
    ultra_processed_hint: bool = False


class ProductBase(BaseModel):
    name: str
    brand: Optional[str] = None
    subtitle: Optional[str] = None
    category: Optional[str] = None
    barcode: Optional[str] = None
    nova_group: NovaGroup = NovaGroup.ULTRA_PROCESSED
    ingredients_text: Optional[str] = None
    image_url: Optional[str] = None
    data_source: str = "unknown"  # "open_food_facts" | "usda" | "manual"


class Product(ProductBase):
    nutrition: NutritionFacts = Field(default_factory=NutritionFacts)
    additives_tags: list[str] = Field(default_factory=list)


class BarcodeRequest(BaseModel):
    barcode: str
    child_id: Optional[int] = None  # If provided, score against this child


class OcrScanRequest(BaseModel):
    raw_text: str  # Text extracted from label photo by client-side ML Kit
    child_id: Optional[int] = None
