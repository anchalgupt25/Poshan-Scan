"""Demo product catalogue orchestrator — fully offline, no external API calls.

Delegates product data to:
  - demo_products_in.py  (Indian market, barcode prefix 890)
  - demo_products_us.py  (US / international market)
"""
from __future__ import annotations

from ..models.product import Product
from .demo_products_in import INDIAN_PRODUCTS, INDIAN_NAME_INDEX, INDIAN_SUGGESTIONS
from .demo_products_us import US_PRODUCTS, US_NAME_INDEX, US_SUGGESTIONS

# Merged catalogue — single lookup dict
_ALL_PRODUCTS: dict[str, Product] = {**INDIAN_PRODUCTS, **US_PRODUCTS}
_ALL_NAME_INDEX: dict[str, str] = {**INDIAN_NAME_INDEX, **US_NAME_INDEX}


def lookup_demo_barcode(barcode: str) -> Product | None:
    """Return a demo product by exact barcode, or None."""
    return _ALL_PRODUCTS.get(barcode)


def get_demo_suggestions(barcode: str, count: int = 3) -> list[Product]:
    """Return contextually relevant demo products when a barcode isn’t found.

    Detects Indian barcodes (prefix 890) and returns market-relevant suggestions.
    """
    priority_barcodes = INDIAN_SUGGESTIONS if barcode.startswith("890") else US_SUGGESTIONS
    suggestions: list[Product] = []
    for bc in priority_barcodes:
        p = _ALL_PRODUCTS.get(bc)
        if p:
            suggestions.append(p)
        if len(suggestions) >= count:
            break
    return suggestions


def search_demo_products(query: str) -> list[Product]:
    """Fuzzy-match product name against the full catalogue."""
    q = query.lower().strip()
    matched: list[Product] = []
    seen: set[str] = set()

    # Exact / substring key match first
    for key, barcode in _ALL_NAME_INDEX.items():
        if q in key or all(w in key for w in q.split() if len(w) > 2):
            p = _ALL_PRODUCTS.get(barcode)
            if p and barcode not in seen:
                matched.append(p)
                seen.add(barcode)

    # Fallback: scan product names directly
    if not matched:
        for bc, p in _ALL_PRODUCTS.items():
            if any(w in p.name.lower() for w in q.split() if len(w) > 2):
                if bc not in seen:
                    matched.append(p)
                    seen.add(bc)

    return matched[:6]


def get_demo_product_list() -> list[Product]:
    """All demo products (for home-screen demo state)."""
    return list(_ALL_PRODUCTS.values())
