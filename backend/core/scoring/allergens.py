"""Allergen detection.

Replaces a naive substring match that was effectively non-functional: the app
stores allergen *category* ids ("dairy", "treenut"), and no ingredient list
contains those words. A child profile flagged for dairy would sail past
"Whey, Sodium Caseinate, Butter Oil", while "egg" matched inside "eggplant".

Three things make detection actually work here:

1. **An ontology.** Each allergen category maps to the words that really appear
   on labels, including hidden and regional names — ghee and paneer for dairy,
   semolina and seitan for wheat, albumin for egg.

2. **Structured data first.** Open Food Facts publishes curated `allergens_tags`
   and `traces_tags` per product. That is a human-checked signal and it beats
   parsing free text, so we use it when present and fall back to text.

3. **Word-boundary matching.** Substring matching is what produced the eggplant
   false positive. Terms match on word boundaries, and each category carries
   explicit exclusions for words that contain an allergen term but aren't one.

`contains` and `may_contain` stay separate all the way to the UI: "made in a
facility that also processes peanuts" is a different decision for a parent than
"contains peanuts", and collapsing them would be dishonest.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass(frozen=True)
class AllergenDef:
    id: str
    label: str
    # Words/phrases that indicate presence. Matched on word boundaries.
    terms: tuple[str, ...]
    # Words containing a term above that are NOT this allergen ("eggplant").
    exclusions: tuple[str, ...] = ()
    # Open Food Facts tag values that map to this category.
    off_tags: tuple[str, ...] = ()


# ─── Ontology ────────────────────────────────────────────────────────────────
# Covers the US "Big 9", the EU 14, and names common on Indian packaging.

ALLERGENS: tuple[AllergenDef, ...] = (
    AllergenDef(
        id="dairy", label="Dairy",
        terms=(
            "milk", "milks", "dairy", "butter", "buttermilk", "butterfat", "butter oil",
            "cream", "creamer", "cheese", "yogurt", "yoghurt", "curd", "curds",
            "whey", "casein", "caseinate", "caseinates", "sodium caseinate",
            "calcium caseinate", "lactose", "lactalbumin", "lactoglobulin",
            "ghee", "paneer", "khoya", "mawa", "condensed milk", "evaporated milk",
            "milk solids", "milk powder", "skim milk", "nonfat milk", "custard",
            "half and half", "kefir", "ricotta", "mozzarella", "parmesan",
        ),
        exclusions=("coconut milk", "almond milk", "soy milk", "oat milk",
                    "rice milk", "cashew milk", "cocoa butter", "shea butter",
                    "peanut butter", "apple butter", "milk thistle", "milkweed"),
        off_tags=("en:milk",),
    ),
    AllergenDef(
        id="egg", label="Egg",
        terms=(
            "egg", "eggs", "egg white", "egg whites", "egg yolk", "egg yolks",
            "albumin", "albumen", "ovalbumin", "globulin", "livetin",
            "lysozyme", "mayonnaise", "meringue", "egg powder", "dried egg",
            "whole egg", "egg solids",
        ),
        # The bug that started this: eggplant is a nightshade, not an egg.
        exclusions=("eggplant", "eggplants", "egg substitute", "egg replacer",
                    "egg-free", "eggnog flavor"),
        off_tags=("en:eggs",),
    ),
    AllergenDef(
        id="peanut", label="Peanut",
        terms=(
            "peanut", "peanuts", "peanut butter", "peanut oil", "peanut flour",
            "groundnut", "groundnuts", "arachis", "arachis oil", "monkey nut",
            "beer nuts", "mandelonas",
        ),
        off_tags=("en:peanuts",),
    ),
    AllergenDef(
        id="treenut", label="Tree nuts",
        terms=(
            "tree nut", "tree nuts", "almond", "almonds", "cashew", "cashews",
            "walnut", "walnuts", "pecan", "pecans", "pistachio", "pistachios",
            "hazelnut", "hazelnuts", "filbert", "filberts", "macadamia",
            "brazil nut", "brazil nuts", "pine nut", "pine nuts", "pignoli",
            "chestnut", "chestnuts", "praline", "marzipan", "nougat",
            "nut butter", "mixed nuts", "gianduja",
        ),
        # "nut" alone is too loose — it hits nutmeg, nutrition, butternut.
        exclusions=("nutmeg", "nutrition", "nutritional", "butternut",
                    "water chestnut", "nut-free", "coconut", "coconuts"),
        off_tags=("en:nuts", "en:tree-nuts", "en:almonds", "en:cashew-nuts",
                  "en:walnuts", "en:pecan-nuts", "en:pistachio-nuts",
                  "en:hazelnuts", "en:macadamia-nuts", "en:brazil-nuts"),
    ),
    AllergenDef(
        id="wheat", label="Wheat / gluten",
        terms=(
            "wheat", "gluten", "flour", "wheat flour", "whole wheat", "durum",
            "semolina", "spelt", "farro", "kamut", "einkorn", "emmer",
            "barley", "rye", "malt", "malt extract", "malted barley",
            "triticale", "bulgur", "couscous", "seitan", "farina",
            "graham flour", "atta", "maida", "suji", "rava", "bran",
            "wheat starch", "wheat protein", "vital wheat gluten",
        ),
        exclusions=("gluten-free", "gluten free", "wheat-free", "rice flour",
                    "corn flour", "almond flour", "coconut flour", "chickpea flour",
                    "buckwheat", "oat flour", "tapioca flour", "potato flour",
                    "gram flour", "besan"),
        off_tags=("en:gluten", "en:wheat", "en:barley", "en:rye", "en:oats"),
    ),
    AllergenDef(
        id="soy", label="Soy",
        terms=(
            "soy", "soya", "soybean", "soybeans", "soy bean", "soy protein",
            "soy flour", "soy sauce", "soybean oil", "soya oil", "tofu",
            "tempeh", "miso", "edamame", "natto", "tamari", "textured vegetable protein",
            "tvp", "soy lecithin", "hydrolyzed soy protein", "soy isolate",
        ),
        exclusions=("soy-free", "soy free"),
        off_tags=("en:soybeans", "en:soy",),
    ),
    AllergenDef(
        id="sesame", label="Sesame",
        terms=("sesame", "sesame seed", "sesame seeds", "sesame oil", "tahini",
               "til", "gingelly", "benne", "halva", "hummus"),
        off_tags=("en:sesame-seeds", "en:sesame"),
    ),
    AllergenDef(
        id="fish", label="Fish",
        terms=("fish", "anchovy", "anchovies", "cod", "salmon", "tuna",
               "tilapia", "haddock", "halibut", "sardine", "sardines",
               "mackerel", "trout", "bass", "pollock", "worcestershire",
               "fish sauce", "fish oil", "surimi", "caviar", "roe"),
        exclusions=("fish-free", "shellfish", "cuttlefish", "jellyfish"),
        off_tags=("en:fish",),
    ),
    AllergenDef(
        id="shellfish", label="Shellfish",
        terms=("shellfish", "shrimp", "prawn", "prawns", "crab", "lobster",
               "crayfish", "crawfish", "langoustine", "krill",
               "clam", "clams", "mussel", "mussels", "oyster", "oysters",
               "scallop", "scallops", "squid", "calamari", "octopus",
               "snail", "escargot", "abalone", "cuttlefish"),
        off_tags=("en:crustaceans", "en:molluscs", "en:shellfish"),
    ),
    AllergenDef(
        id="mustard", label="Mustard",
        terms=("mustard", "mustard seed", "mustard seeds", "mustard flour",
               "dijon", "sarson", "rai", "kasundi"),
        off_tags=("en:mustard",),
    ),
    AllergenDef(
        id="celery", label="Celery",
        terms=("celery", "celeriac", "celery seed", "celery salt", "celery root"),
        off_tags=("en:celery",),
    ),
    AllergenDef(
        id="sulfite", label="Sulfites",
        terms=("sulfite", "sulfites", "sulphite", "sulphites",
               "sulfur dioxide", "sulphur dioxide", "sodium sulfite",
               "sodium bisulfite", "sodium metabisulfite",
               "potassium bisulfite", "potassium metabisulfite", "e220", "e221",
               "e222", "e223", "e224", "e225", "e226", "e227", "e228"),
        off_tags=("en:sulphur-dioxide-and-sulphites",),
    ),
    AllergenDef(
        id="lupin", label="Lupin",
        terms=("lupin", "lupine", "lupin flour", "lupin bean"),
        off_tags=("en:lupin",),
    ),
    AllergenDef(
        id="corn", label="Corn",
        terms=("corn", "maize", "corn syrup", "corn starch", "cornstarch",
               "corn flour", "cornmeal", "hominy", "masa", "polenta",
               "high fructose corn syrup", "dextrose", "maltodextrin"),
        exclusions=("corn-free", "peppercorn", "peppercorns", "cornish"),
        off_tags=("en:corn", "en:maize"),
    ),
    AllergenDef(
        id="coconut", label="Coconut",
        terms=("coconut", "coconuts", "coconut oil", "coconut milk",
               "coconut cream", "copra", "nariyal", "desiccated coconut"),
        off_tags=("en:coconut",),
    ),
)

_BY_ID = {a.id: a for a in ALLERGENS}

# Legacy ids that older child profiles may still carry.
_ALIASES = {
    "treenuts": "treenut", "tree_nut": "treenut", "tree-nuts": "treenut",
    "nuts": "treenut", "milk": "dairy", "gluten": "wheat",
    "soybean": "soy", "soya": "soy", "peanuts": "peanut", "eggs": "egg",
}


def resolve(allergen_id: str) -> AllergenDef | None:
    """Map a stored id to its definition, tolerating aliases and labels."""
    if not allergen_id:
        return None
    key = allergen_id.strip().lower().replace(" ", "").replace("/", "")
    if key in _BY_ID:
        return _BY_ID[key]
    if key in _ALIASES:
        return _BY_ID[_ALIASES[key]]
    # Match on label ("Tree nuts" → treenut)
    for a in ALLERGENS:
        if a.label.lower().replace(" ", "").replace("/", "") == key:
            return a
    return None


# ─── Matching ────────────────────────────────────────────────────────────────

def _boundary_pattern(term: str) -> re.Pattern:
    """Word-boundary regex for a term. Multi-word terms allow flexible
    whitespace/hyphenation, so "butter oil" matches "butter-oil"."""
    parts = [re.escape(p) for p in term.split()]
    return re.compile(r"\b" + r"[\s\-]+".join(parts) + r"s?\b", re.IGNORECASE)


# Built once — these patterns are hot on every scan.
_TERM_PATTERNS: dict[str, list[tuple[str, re.Pattern]]] = {
    a.id: [(t, _boundary_pattern(t)) for t in a.terms] for a in ALLERGENS
}
_EXCLUSION_PATTERNS: dict[str, list[re.Pattern]] = {
    a.id: [_boundary_pattern(e) for e in a.exclusions] for a in ALLERGENS
}


def _mask_exclusions(text: str, allergen: AllergenDef) -> str:
    """Blank out excluded phrases before scanning for terms.

    Masking rather than post-filtering means "eggplant parmesan with egg" still
    flags the real egg: only the excluded phrase is removed, not the whole line.
    """
    out = text
    for pat in _EXCLUSION_PATTERNS[allergen.id]:
        out = pat.sub(" ", out)
    return out


# "May contain" / cross-contamination phrasing, kept distinct from "contains".
_TRACE_MARKERS = re.compile(
    r"(may\s+contain|may\s+also\s+contain|manufactured\s+(?:in|on)|"
    r"produced\s+(?:in|on)|processed\s+(?:in|on)|shared\s+(?:equipment|facility|line)|"
    r"same\s+(?:equipment|facility|line)|traces?\s+of)",
    re.IGNORECASE,
)


def _split_contains_and_traces(ingredients_text: str) -> tuple[str, str]:
    """Split an ingredient statement into the definite part and the advisory part.

    Everything from the first cross-contamination marker onward is advisory.
    """
    if not ingredients_text:
        return "", ""
    m = _TRACE_MARKERS.search(ingredients_text)
    if not m:
        return ingredients_text, ""
    return ingredients_text[: m.start()], ingredients_text[m.start():]


@dataclass
class AllergenHit:
    allergen_id: str
    label: str
    # "contains" = definite; "may_contain" = advisory / cross-contamination
    certainty: str
    # Where we learned it: "off_tag" (curated) or "ingredients" (parsed text)
    source: str
    # The specific words that triggered it, for showing the parent
    matched_terms: list[str] = field(default_factory=list)


def detect(
    child_allergens: list[str],
    ingredients_text: str | None,
    off_allergens_tags: list[str] | None = None,
    off_traces_tags: list[str] | None = None,
) -> list[AllergenHit]:
    """Find which of the child's allergens this product contains.

    Structured OFF tags are trusted first — they're curated. Ingredient text is
    parsed as a fallback and as a supplement, since OFF coverage is uneven and
    USDA products carry no allergen tags at all.
    """
    if not child_allergens:
        return []

    defs: list[AllergenDef] = []
    unknown: list[str] = []
    for raw in child_allergens:
        d = resolve(raw)
        if d is not None:
            defs.append(d)
        elif raw and raw.strip():
            # Free-text entry a parent typed that isn't in the ontology
            # ("kiwi", "food colouring"). We can't expand it into hidden
            # names, but a literal word-boundary match is far better than
            # ignoring it — and ignoring it silently would be the dangerous
            # option for something a parent deliberately entered.
            unknown.append(raw.strip())

    if not defs and not unknown:
        return []

    off_tags = {t.strip().lower() for t in (off_allergens_tags or [])}
    trace_tags = {t.strip().lower() for t in (off_traces_tags or [])}

    contains_text, traces_text = _split_contains_and_traces(ingredients_text or "")

    hits: dict[str, AllergenHit] = {}

    for d in defs:
        # 1) Curated structured data wins.
        if off_tags & set(d.off_tags):
            hits[d.id] = AllergenHit(d.id, d.label, "contains", "off_tag")
            continue

        # 2) Definite portion of the ingredient statement.
        scan = _mask_exclusions(contains_text, d)
        matched = [term for term, pat in _TERM_PATTERNS[d.id] if pat.search(scan)]
        if matched:
            hits[d.id] = AllergenHit(d.id, d.label, "contains", "ingredients", matched[:4])
            continue

        # 3) Advisory only — curated traces, or the "may contain" tail.
        if trace_tags & set(d.off_tags):
            hits[d.id] = AllergenHit(d.id, d.label, "may_contain", "off_tag")
            continue

        trace_scan = _mask_exclusions(traces_text, d)
        trace_matched = [term for term, pat in _TERM_PATTERNS[d.id] if pat.search(trace_scan)]
        if trace_matched:
            hits[d.id] = AllergenHit(d.id, d.label, "may_contain", "ingredients", trace_matched[:4])

    # Free-text allergens: literal word-boundary match, no ontology expansion.
    for term in unknown:
        key = f"custom:{term.lower()}"
        if key in hits:
            continue
        pat = _boundary_pattern(term)
        if pat.search(contains_text):
            hits[key] = AllergenHit(key, term, "contains", "ingredients", [term])
        elif pat.search(traces_text):
            hits[key] = AllergenHit(key, term, "may_contain", "ingredients", [term])

    # Definite hits first, then alphabetical, so the UI ordering is stable.
    return sorted(hits.values(), key=lambda h: (h.certainty != "contains", h.label))


def catalog() -> list[dict]:
    """Allergen list for the onboarding picker."""
    return [{"id": a.id, "label": a.label} for a in ALLERGENS]
