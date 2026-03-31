"""Poshan Scan deterministic scoring engine.

Pure Python — no I/O, no LLM. Scores are consistent, auditable, and
defensible. Claude is called OUTSIDE this module for narration only.

Weights (from scoring-rules.json philosophy):
  Nutrition  35%  — sodium, iron, calcium, zinc vs. DRI
  Ingredients 25% — watchlist hits, added sugar, artificial additives
  Processing  20% — NOVA group 1–4
  Age Safety  20% — age-specific threshold violations
"""
from __future__ import annotations

from ..data.loader import get_age_band, load_watchlist
from ...models.product import Product, NutritionFacts
from ...models.child import ChildProfile
from ...models.score import Grade, GRADE_LABELS, ScoreDimensions, ScoreResult, IngredientFlag
from .dimensions import (
    clamp, score_nutrition, score_ingredients, score_processing, score_age_safety,
)


# Dimension weights from PRD Section 3.1 — must sum to 1.0
# Nutrition 35%, Ingredients 35%, Processing 20%, Age Safety 10%
WEIGHTS = {
    "nutrition": 0.35,
    "ingredients": 0.35,
    "processing": 0.20,
    "age_safety": 0.10,
}


def _grade_from_score(score: int) -> Grade:
    """Grade thresholds per PRD Section 3.2."""
    if score >= 80:
        return Grade.A   # Good for regular use
    if score >= 65:
        return Grade.B   # Fine a few times a week
    if score >= 45:
        return Grade.C   # Occasional treat only
    return Grade.D       # Consider skipping


# Hard-gate ingredient IDs — these cap the overall score at 40
# regardless of other dimensions (PRD Section 3.1 Critical Rule)
_HARD_GATE_IDS = {"honey_under_1yr", "partially_hydrogenated_oils",
                   "brominated_vegetable_oil", "potassium_bromate",
                   "whole_nuts_under_4yr"}


def _check_watchlist(ingredients_text: str, child: ChildProfile) -> list[IngredientFlag]:
    """Cross-reference ingredient text against the watchlist."""
    watchlist = load_watchlist()
    flags: list[IngredientFlag] = []
    text_lower = (ingredients_text or "").lower()

    for entry in watchlist:
        age_months = _age_band_to_months(child.age_band.value)
        max_flag = entry.get("age_max_flag_months")
        min_flag = entry.get("age_min_flag_months", 0)

        if age_months < min_flag:
            continue
        if max_flag is not None and age_months >= max_flag:
            continue

        aliases = [a.lower() for a in entry.get("aliases", [])] + [entry["name"].lower()]
        matched = any(alias in text_lower for alias in aliases)
        if not matched:
            continue

        severity_map = {"hard_stop": "red", "high": "orange", "medium": "orange", "low": "green"}
        flags.append(IngredientFlag(
            severity=severity_map.get(entry["severity"], "orange"),
            code=entry["id"],
            title=entry["name"],
            detail=entry["flag_reason"],
            source_citation=entry.get("source_citation"),
        ))

    return flags


def _has_hard_gate_trigger(flags: list[IngredientFlag]) -> bool:
    """Return True if any flag is a PRD hard gate (caps overall score to 40)."""
    return any(f.code in _HARD_GATE_IDS for f in flags)


def _age_band_to_months(age_band_label: str) -> int:
    """Convert age band label to representative months for watchlist filtering."""
    mapping = {
        "6–12 months": 9,
        "6-12 months": 9,
        "1–2 years": 18,
        "1-2 years": 18,
        "2–4 years": 30,
        "2-4 years": 30,
        "4–6 years": 54,
        "4-6 years": 54,
    }
    return mapping.get(age_band_label, 18)


def _build_verdict_text(score: int, grade: Grade, child: ChildProfile, product: Product) -> str:
    """Rule-based verdict text. Claude will replace this when key is available."""
    name = child.name
    age = child.age_band.value
    product_name = product.name

    if grade == Grade.A:
        return (
            f"Good news! {product_name} scores well for {name} at {age}. "
            "It meets age-appropriate nutrition standards. "
            "This is educational information only — not medical advice."
        )
    if grade == Grade.B:
        return (
            f"{product_name} is generally suitable for {name} at {age} with some notes. "
            "Check the highlighted nutrients and make a call based on the full day's diet. "
            "This is educational information only — not medical advice."
        )
    if grade == Grade.C:
        return (
            f"{product_name} has some concerns for {name} at {age}. "
            "Review the flagged ingredients and nutrients. Occasional use may be fine depending on overall diet. "
            "This is educational information only — not medical advice."
        )
    return (
        f"{product_name} has significant concerns for {name} at {age}. "
        "Review the red flags below carefully. "
        "This is educational information only — not medical advice."
    )


def score_product(child: ChildProfile, product: Product) -> ScoreResult:
    """Main scoring function. Returns a full ScoreResult."""
    band = get_age_band(child.age_band.value)
    facts: NutritionFacts = product.nutrition

    # Check allergy flags
    allergy_flags: list[IngredientFlag] = []
    if product.ingredients_text:
        for allergy in child.allergies:
            if allergy.lower() in (product.ingredients_text or "").lower():
                allergy_flags.append(IngredientFlag(
                    severity="red",
                    code="allergen_match",
                    title=f"Contains {allergy} (Allergy Alert)",
                    detail=f"This product may contain {allergy}, which is listed as an allergy for {child.name}.",
                    source_citation=None,
                ))

    # Watchlist scan
    watchlist_flags = _check_watchlist(product.ingredients_text or "", child)
    all_ingredient_flags = allergy_flags + watchlist_flags

    # Dimension scores
    nutrition_score, nutrient_insights = score_nutrition(facts, band)
    ingredient_score, ingredient_flags, sugar_insights = score_ingredients(facts, band, all_ingredient_flags)
    processing_score = score_processing(facts, product.nova_group.value)
    age_safety_score = score_age_safety(facts, band)

    # Weighted overall
    overall = clamp(
        WEIGHTS["nutrition"] * nutrition_score
        + WEIGHTS["ingredients"] * ingredient_score
        + WEIGHTS["processing"] * processing_score
        + WEIGHTS["age_safety"] * age_safety_score,
        0, 100,
    )

    # PRD Section 3.1 Critical Rule: hard gate caps score at 40
    # Prevents high nutrition score masking an age-unsafe product.
    hard_gate_triggered = _has_hard_gate_trigger(all_ingredient_flags + watchlist_flags)
    if hard_gate_triggered:
        overall = min(overall, 40)

    grade = _grade_from_score(overall)
    all_insights = nutrient_insights + sugar_insights

    return ScoreResult(
        score=overall,
        grade=grade,
        grade_label=GRADE_LABELS[grade],
        dimensions=ScoreDimensions(
            nutrition=nutrition_score,
            ingredients=ingredient_score,
            processing=processing_score,
            age_safety=age_safety_score,
        ),
        flags=ingredient_flags,
        nutrient_insights=all_insights,
        verdict_text=_build_verdict_text(overall, grade, child, product),
    )
