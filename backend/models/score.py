"""Score result models — output of the deterministic scoring engine."""
from __future__ import annotations

from enum import Enum
from typing import Optional
from pydantic import BaseModel


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


class ScoreResult(BaseModel):
    score: int  # 0–100 headline score
    grade: Grade
    grade_label: str
    dimensions: ScoreDimensions
    flags: list[IngredientFlag]
    nutrient_insights: list[NutrientInsight]
    scan_source: str = "barcode"  # "barcode" | "ocr_label" | "manual"
    ocr_confidence: Optional[str] = None  # Only for OCR scans
    # Narration — stub text for now, Claude fills this when key is available
    verdict_text: Optional[str] = None
