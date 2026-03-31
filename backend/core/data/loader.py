"""Load and cache DRI targets + ingredient watchlist from JSON files."""
from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

DATA_DIR = Path(__file__).parent


@dataclass
class AgeBandConfig:
    id: str
    label: str
    sodium_mg_daily_ai: float
    sodium_per_serve_soft_pct: float
    sodium_per_serve_hard_pct: float
    iron_mg_daily_rda: float
    iron_per_serve_good_mg: float
    calcium_mg_daily_ai: float
    zinc_mg_daily_rda: float
    added_sugar_g_caution_per_serve: float
    match_labels: list[str]


@lru_cache(maxsize=1)
def _load_dri_raw() -> dict:
    with open(DATA_DIR / "dri_targets.json") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def load_watchlist() -> list[dict]:
    with open(DATA_DIR / "ingredient_watchlist.json") as f:
        data = json.load(f)
    return data.get("ingredients", [])


def _band_from_raw(raw: dict) -> AgeBandConfig:
    return AgeBandConfig(
        id=raw["id"],
        label=raw["label"],
        sodium_mg_daily_ai=float(raw.get("sodium_mg_daily_ai", 800)),
        sodium_per_serve_soft_pct=float(raw.get("sodium_per_serve_soft_pct", 0.14)),
        sodium_per_serve_hard_pct=float(raw.get("sodium_per_serve_hard_pct", 0.25)),
        iron_mg_daily_rda=float(raw.get("iron_mg_daily_rda", 7.0)),
        iron_per_serve_good_mg=float(raw.get("iron_per_serve_good_mg", 2.0)),
        calcium_mg_daily_ai=float(raw.get("calcium_mg_daily_ai", 700)),
        zinc_mg_daily_rda=float(raw.get("zinc_mg_daily_rda", 3.0)),
        added_sugar_g_caution_per_serve=float(raw.get("added_sugar_g_caution_per_serve", 0)),
        match_labels=raw.get("match_labels", []),
    )


def get_age_band(label: str) -> AgeBandConfig:
    """Look up age band config by its UI label string."""
    dri = _load_dri_raw()
    for raw in dri.get("bands", []):
        if label in raw.get("match_labels", []):
            return _band_from_raw(raw)
    # Fallback: 1-2y is safest default (stricter sodium/sugar)
    fallback = next((b for b in dri["bands"] if b["id"] == "1-2y"), dri["bands"][0])
    return _band_from_raw(fallback)
