"""Regression tests for allergen detection.

This is safety-critical: the results screen shows allergen warnings
prominently, so a false negative here can lead a parent to feed their child
something dangerous. Every case below except the last group was a real failure
of the original substring matcher.

Run directly (no pytest needed):
    .venv/bin/python backend/tests/test_allergens.py

Or with pytest if it's installed:
    pytest backend/tests/test_allergens.py
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.core.scoring.allergens import detect, resolve, catalog  # noqa: E402


# (description, child_allergens, ingredients, off_tags, off_traces,
#  expected_allergen_ids, expected_certainty)
CASES = [
    # ─── Hidden names the old substring matcher missed entirely ───
    ("hidden dairy names", ["dairy"],
     "Sugar, Whey Protein Concentrate, Sodium Caseinate, Butter Oil",
     None, None, {"dairy"}, "contains"),
    ("tree nuts listed by species", ["treenut"],
     "Almonds, Cashews, Sugar, Sea Salt", None, None, {"treenut"}, "contains"),
    ("category id vs label word", ["dairy"],
     "Sugar, Skim Milk Powder, Cocoa", None, None, {"dairy"}, "contains"),
    ("semolina is wheat", ["wheat"],
     "Semolina, Water, Salt", None, None, {"wheat"}, "contains"),
    ("ghee is dairy", ["dairy"],
     "Ghee, Wheat Flour, Sugar, Cardamom", None, None, {"dairy"}, "contains"),
    ("paneer is dairy", ["dairy"],
     "Paneer, Tomato, Onion, Spices", None, None, {"dairy"}, "contains"),
    ("soy lecithin is soy", ["soy"],
     "Sugar, Cocoa, Soy Lecithin", None, None, {"soy"}, "contains"),
    ("tahini is sesame", ["sesame"],
     "Chickpeas, Tahini, Lemon Juice", None, None, {"sesame"}, "contains"),

    # ─── False positives the old matcher produced ───
    ("eggplant is not egg", ["egg"],
     "Eggplant, Olive Oil, Garlic, Salt", None, None, set(), None),
    ("coconut is not a tree nut here", ["treenut"],
     "Coconut Oil, Sugar, Salt", None, None, set(), None),
    ("nutmeg is not a tree nut", ["treenut"],
     "Flour, Sugar, Nutmeg, Cinnamon", None, None, set(), None),
    ("almond milk is not dairy", ["dairy"],
     "Almond Milk, Sugar, Sea Salt", None, None, set(), None),
    ("cocoa butter is not dairy", ["dairy"],
     "Cocoa Butter, Sugar, Vanilla", None, None, set(), None),
    ("peanut butter is not dairy", ["dairy"],
     "Peanut Butter, Salt", None, None, set(), None),
    ("gluten-free is not wheat", ["wheat"],
     "Gluten-Free Oat Flour, Rice Flour, Sugar", None, None, set(), None),
    ("shellfish is not fish", ["fish"],
     "Shellfish Extract, Salt", None, None, set(), None),

    # ─── "Contains" vs "may contain" must stay distinct ───
    ("may contain is advisory", ["peanut"],
     "Oats, Sugar, Salt. May contain peanuts.", None, None,
     {"peanut"}, "may_contain"),
    ("shared facility is advisory", ["treenut"],
     "Oats, Honey. Manufactured in a facility that also processes tree nuts.",
     None, None, {"treenut"}, "may_contain"),
    ("definite beats advisory in same text", ["dairy"],
     "Milk, Sugar. May contain milk.", None, None, {"dairy"}, "contains"),

    # ─── Structured Open Food Facts data ───
    ("off tag alone is enough", ["dairy"], "", ["en:milk"], None,
     {"dairy"}, "contains"),
    ("off traces tag is advisory", ["egg"], "", None, ["en:eggs"],
     {"egg"}, "may_contain"),
    ("real nutella data", ["treenut", "dairy"],
     "Sugar, Palm Oil, Hazelnuts, Skim Milk Powder, Cocoa",
     ["en:milk", "en:nuts", "en:soybeans"], None,
     {"treenut", "dairy"}, "contains"),

    # ─── Scoping ───
    ("no allergies configured", [], "Milk, Eggs, Peanuts", None, None, set(), None),
    ("only the child's own allergens", ["fish"],
     "Milk, Sugar, Wheat Flour", None, None, set(), None),
    ("empty ingredients is safe", ["dairy"], None, None, None, set(), None),
]


def test_detection_cases():
    failures = []
    for desc, allergies, ing, tags, traces, expect_ids, expect_cert in CASES:
        hits = detect(allergies, ing, tags, traces)
        got = {h.allergen_id for h in hits}
        if got != expect_ids:
            failures.append(f"{desc}: expected {expect_ids or 'no hits'}, got {got or 'no hits'}")
            continue
        if expect_cert and not all(h.certainty == expect_cert for h in hits):
            actual = {h.certainty for h in hits}
            failures.append(f"{desc}: expected certainty {expect_cert}, got {actual}")
    assert not failures, "Allergen detection regressions:\n  " + "\n  ".join(failures)


def test_legacy_ids_still_resolve():
    """Profiles created before the ontology existed must keep working."""
    for legacy, expected in [
        ("treenuts", "treenut"), ("tree-nuts", "treenut"), ("nuts", "treenut"),
        ("milk", "dairy"), ("gluten", "wheat"), ("soya", "soy"),
        ("Tree nuts", "treenut"), ("Wheat / gluten", "wheat"),
    ]:
        d = resolve(legacy)
        assert d is not None, f"{legacy!r} did not resolve"
        assert d.id == expected, f"{legacy!r} resolved to {d.id}, expected {expected}"


def test_freetext_allergen_falls_back_to_literal_match():
    """A parent typing a rare allergen must still get checked.

    We can't expand "kiwi" into hidden names the way we do for dairy, but a
    literal match beats silently ignoring something they deliberately entered.
    """
    assert resolve("kiwi") is None, "kiwi should not be in the ontology"

    hits = detect(["kiwi"], "Apple Juice, Kiwi Puree, Sugar")
    assert len(hits) == 1, f"expected kiwi to be flagged, got {hits}"
    assert hits[0].certainty == "contains"
    assert hits[0].label == "kiwi"

    # Must not fire on unrelated products
    assert detect(["kiwi"], "Apple Juice, Sugar") == []

    # And must respect the may-contain split
    trace = detect(["kiwi"], "Apple Juice, Sugar. May contain kiwi.")
    assert len(trace) == 1 and trace[0].certainty == "may_contain"


def test_freetext_and_ontology_allergens_together():
    hits = detect(["dairy", "kiwi"], "Whey Protein, Kiwi Puree, Sugar")
    ids = {h.allergen_id for h in hits}
    assert "dairy" in ids, "ontology allergen missed"
    assert any(i.startswith("custom:") for i in ids), "free-text allergen missed"


def test_catalog_shape():
    items = catalog()
    assert len(items) >= 14, f"expected the Big 9 plus extras, got {len(items)}"
    assert all("id" in i and "label" in i for i in items)
    ids = [i["id"] for i in items]
    assert len(ids) == len(set(ids)), "duplicate allergen ids"
    for required in ("dairy", "egg", "peanut", "treenut", "wheat",
                     "soy", "sesame", "fish", "shellfish"):
        assert required in ids, f"missing US Big 9 allergen: {required}"


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    failed = 0
    for t in tests:
        try:
            t()
            print(f"  ✓ {t.__name__}")
        except AssertionError as e:
            failed += 1
            print(f"  ✗ {t.__name__}\n      {e}")
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    sys.exit(1 if failed else 0)
