"""Score result models — output of the deterministic scoring engine."""
from __future__ import annotations

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class Grade(str, Enum):
    A = "A"
    B = "B"
    C = "C"
    D = "D"


GRADE_LABELS = {
    Grade.A: "Good Choice",
    Grade.B: "Good With Notes",
    Grade.C: "Use With Caution",
    Grade.D: "Avoid",
}


class ScoreDimensions(BaseModel):
    nutrition: int  # 0–100
    ingredients: int  # 0–100
    processing: int  # 0–100
    age_safety: int  # 0–100


class IngredientFlag(BaseModel):
    severity: str  # "red" | "orange" | "green"
    code: str
    title: str
    detail: str
    source_citation: Optional[str] = None


class NutrientInsight(BaseModel):
    name: str
    value: str
    unit: str
    pct_of_daily: Optional[int] = None  # % of child's daily limit
    status: str  # "good" | "caution" | "warn" | "neutral"


class AllergenAlert(BaseModel):
    """A match between the child's allergen list and this product.

    Surfaced as its own field rather than buried among the ingredient flags,
    because the results screen shows these at the top in a dedicated banner —
    it is the single most safety-relevant thing on the page.
    """
    allergen_id: str
    label: str
    # "contains"    — listed as an ingredient, or a curated allergen tag
    # "may_contain" — cross-contamination advisory only
    certainty: str
    # "off_tag" (curated database) | "ingredients" (parsed from the label)
    source: str
    matched_terms: list[str] = Field(default_factory=list)


class ScoreResult(BaseModel):
    score: int  # 0–100 headline score
    grade: Grade
    grade_label: str
    dimensions: ScoreDimensions
    flags: list[IngredientFlag]
    nutrient_insights: list[NutrientInsight]
    # Empty when the child has no allergens set, or none were found.
    allergen_alerts: list[AllergenAlert] = Field(default_factory=list)
    scan_source: str = "barcode"  # "barcode" | "ocr_label" | "manual"
    ocr_confidence: Optional[str] = None  # Only for OCR scans
    # Narration — stub text for now, Claude fills this when key is available
    verdict_text: Optional[str] = None
