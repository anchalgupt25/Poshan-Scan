"""Individual scoring dimension calculators.

All functions are pure — no I/O, no side effects, easy to unit test.
Each returns a score 0–100.
"""
from __future__ import annotations

import math
from ..data.loader import AgeBandConfig
from ...models.product import NutritionFacts
from ...models.score import IngredientFlag, NutrientInsight


def clamp(value: float, low: float, high: float) -> int:
    return int(max(low, min(high, value)))


def score_from_ratio(ratio: float, good_below: float, bad_above: float) -> int:
    """Linear penalty: 100 at or below good_below, 0 at or above bad_above."""
    if ratio <= good_below:
        return 100
    if ratio >= bad_above:
        return 0
    t = (ratio - good_below) / (bad_above - good_below)
    return clamp(100 * (1 - t), 0, 100)


def score_nutrition(facts: NutritionFacts, band: AgeBandConfig) -> tuple[int, list[NutrientInsight]]:
    """Score nutritional content vs. age-appropriate DRI targets."""
    insights: list[NutrientInsight] = []

    # — Sodium —
    sodium_ratio = facts.sodium_mg / band.sodium_mg_daily_ai if band.sodium_mg_daily_ai else 0
    sodium_score = score_from_ratio(sodium_ratio, band.sodium_per_serve_soft_pct, band.sodium_per_serve_hard_pct)
    sodium_pct = round(sodium_ratio * 100)
    insights.append(NutrientInsight(
        name="Sodium",
        value=f"{facts.sodium_mg:.0f}",
        unit="mg",
        pct_of_daily=sodium_pct,
        status="good" if sodium_ratio <= band.sodium_per_serve_soft_pct else
               "caution" if sodium_ratio <= band.sodium_per_serve_hard_pct else "warn",
    ))

    # — Iron —
    iron_daily = band.iron_mg_daily_rda or 7.0
    iron_pct = round((facts.iron_mg / iron_daily) * 100) if iron_daily else 0
    iron_score = 100 if facts.iron_mg >= band.iron_per_serve_good_mg else \
                 75 if facts.iron_mg > 0 else 55
    insights.append(NutrientInsight(
        name="Iron",
        value=f"{facts.iron_mg:.1f}",
        unit="mg",
        pct_of_daily=iron_pct,
        status="good" if facts.iron_mg >= band.iron_per_serve_good_mg else
               "caution" if facts.iron_mg > 0 else "neutral",
    ))

    # — Calcium —
    calcium_daily = band.calcium_mg_daily_ai or 700.0
    calcium_pct = round((facts.calcium_mg / calcium_daily) * 100) if calcium_daily else 0
    insights.append(NutrientInsight(
        name="Calcium",
        value=f"{facts.calcium_mg:.0f}",
        unit="mg",
        pct_of_daily=calcium_pct,
        status="good" if calcium_pct >= 10 else "neutral",
    ))

    # — Protein —
    # Pediatric RDA ranges: 11g (6-12mo) → 13g (1-3y) → 19g (4-6y) → 24g (9-13y).
    # Per-serving "good" = ≥3g (toddler) or ≥5g (older child).
    protein_daily = getattr(band, "protein_g_daily_rda", None) or 13.0
    protein_pct = round((facts.protein_g / protein_daily) * 100) if protein_daily else 0
    insights.append(NutrientInsight(
        name="Protein",
        value=f"{facts.protein_g:.1f}",
        unit="g",
        pct_of_daily=protein_pct,
        status="good" if facts.protein_g >= 3 else
               "caution" if facts.protein_g > 0 else "neutral",
    ))

    # — Fiber —
    fiber_daily = getattr(band, "fiber_g_daily_ai", None) or 19.0
    fiber_pct = round((facts.fiber_g / fiber_daily) * 100) if fiber_daily else 0
    insights.append(NutrientInsight(
        name="Fiber",
        value=f"{facts.fiber_g:.1f}",
        unit="g",
        pct_of_daily=fiber_pct,
        status="good" if facts.fiber_g >= 2 else "neutral",
    ))

    # — Zinc — kept for backwards compatibility but no longer in top-4
    zinc_daily = band.zinc_mg_daily_rda or 3.0
    zinc_pct = round((facts.zinc_mg / zinc_daily) * 100) if zinc_daily else 0
    insights.append(NutrientInsight(
        name="Zinc",
        value=f"{facts.zinc_mg:.1f}",
        unit="mg",
        pct_of_daily=zinc_pct,
        status="good" if zinc_pct >= 10 else "neutral",
    ))

    # Weighted nutrition score: sodium 55%, iron 45%
    nutrition_score = clamp(0.55 * sodium_score + 0.45 * iron_score, 0, 100)
    return nutrition_score, insights


def score_ingredients(
    facts: NutritionFacts,
    band: AgeBandConfig,
    watchlist_flags: list[IngredientFlag],
) -> tuple[int, list[IngredientFlag]]:
    """Score ingredients vs. watchlist + added sugar."""
    flags: list[IngredientFlag] = list(watchlist_flags)  # copy

    # Added sugar penalty
    caution_g = band.added_sugar_g_caution_per_serve
    sugar_flags: list[IngredientFlag] = []
    if caution_g == 0 and facts.added_sugar_g > 0:
        # Under-2: ANY added sugar is flagged (AAP 2016)
        sugar_flags.append(IngredientFlag(
            severity="red",
            code="added_sugar_under2",
            title="Added Sugar (AAP: Avoid Under 2)",
            detail=(
                f"{facts.added_sugar_g:.1f}g added sugar per serving. "
                "AAP 2016 recommends zero added sugar for children under 2 years."
            ),
            source_citation="AAP Clinical Report, Added Sugars 2016",
        ))
    elif caution_g > 0 and facts.added_sugar_g > caution_g * 2:
        sugar_flags.append(IngredientFlag(
            severity="red",
            code="high_added_sugar",
            title="Very High Added Sugar",
            detail=f"{facts.added_sugar_g:.1f}g added sugar is {facts.added_sugar_g / caution_g:.1f}x the caution threshold for this age.",
            source_citation="WHO Free Sugars Guideline 2015; AAP",
        ))
    elif caution_g > 0 and facts.added_sugar_g > caution_g:
        sugar_flags.append(IngredientFlag(
            severity="orange",
            code="moderate_added_sugar",
            title="Moderate Added Sugar",
            detail=f"{facts.added_sugar_g:.1f}g added sugar per serving. Limit to occasional use.",
            source_citation="WHO Free Sugars Guideline 2015",
        ))

    flags = sugar_flags + flags  # Sugar flags first

    # Also add insight for added sugar
    insights_extra: list[NutrientInsight] = []
    insights_extra.append(NutrientInsight(
        name="Added Sugar",
        value=f"{facts.added_sugar_g:.1f}",
        unit="g",
        pct_of_daily=None,
        status="warn" if (caution_g == 0 and facts.added_sugar_g > 0) or
                         (caution_g > 0 and facts.added_sugar_g > caution_g) else "good",
    ))

    # Penalty calculation
    hard_stop_count = sum(1 for f in watchlist_flags if f.severity == "red")
    high_count = sum(1 for f in watchlist_flags if f.severity == "orange")
    sugar_penalty = 0 if not sugar_flags else (35 if caution_g == 0 and facts.added_sugar_g > 0 else 18)
    artificial_flavor_penalty = 12 if facts.artificial_flavor else 0
    artificial_dye_penalty = 18 if facts.artificial_dyes else 0
    watchlist_penalty = hard_stop_count * 30 + high_count * 15

    ingredient_score = clamp(
        100 - sugar_penalty - artificial_flavor_penalty - artificial_dye_penalty - watchlist_penalty,
        0, 100,
    )
    return ingredient_score, flags, insights_extra


NOVA_PENALTIES = {1: 0, 2: 5, 3: 15, 4: 35}


def score_processing(facts: NutritionFacts, nova_group: int) -> int:
    """Score based on NOVA food processing classification."""
    penalty = NOVA_PENALTIES.get(nova_group, 35)
    ultra_hint_penalty = 10 if facts.ultra_processed_hint else 0
    return clamp(100 - penalty - ultra_hint_penalty, 0, 100)


def score_age_safety(facts: NutritionFacts, band: AgeBandConfig) -> int:
    """Age-specific safety score: harder thresholds for younger children."""
    sodium_ratio = facts.sodium_mg / band.sodium_mg_daily_ai if band.sodium_mg_daily_ai else 0
    caution_g = band.added_sugar_g_caution_per_serve

    penalty = 0
    if sodium_ratio > band.sodium_per_serve_hard_pct:
        penalty += 40
    elif sodium_ratio > band.sodium_per_serve_soft_pct:
        penalty += 18

    if caution_g == 0 and facts.added_sugar_g > 0:
        penalty += 30  # AAP: zero added sugar under 2
    elif caution_g > 0 and facts.added_sugar_g > caution_g:
        penalty += 12

    return clamp(100 - penalty, 0, 100)
