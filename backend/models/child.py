"""Child profile models."""
from __future__ import annotations

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class AgeBand(str, Enum):
    SIX_TO_TWELVE_MONTHS = "6–12 months"
    ONE_TO_TWO_YEARS = "1–2 years"
    TWO_TO_FOUR_YEARS = "2–4 years"
    FOUR_TO_SIX_YEARS = "4–6 years"


class Gender(str, Enum):
    BOY = "Boy"
    GIRL = "Girl"


class DietType(str, Enum):
    PURE_VEG = "Pure Veg"
    VEG_EGGS = "Veg + Eggs"
    JAIN = "Jain"


class NutritionGoal(str, Enum):
    BRAIN_DEVELOPMENT = "Brain Development"
    BONE_STRENGTH = "Bone Strength & Height"
    IMMUNITY = "Immunity"
    HEART_METABOLIC = "Heart & Metabolic Health"
    PHYSICAL_GROWTH = "Physical Growth"


class ChildProfileCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    age_band: AgeBand
    gender: Gender
    diet_type: DietType = DietType.PURE_VEG
    allergies: list[str] = Field(default_factory=list)
    goals: list[NutritionGoal] = Field(default_factory=list)
    cuisine: Optional[str] = None


class ChildProfile(ChildProfileCreate):
    id: int
    user_session: str  # Anonymous session ID — no account required for MVP

    model_config = {"from_attributes": True}


class ChildProfileUpdate(BaseModel):
    name: Optional[str] = None
    age_band: Optional[AgeBand] = None
    gender: Optional[Gender] = None
    diet_type: Optional[DietType] = None
    allergies: Optional[list[str]] = None
    goals: Optional[list[NutritionGoal]] = None
    cuisine: Optional[str] = None
