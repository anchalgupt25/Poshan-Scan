"""Scan endpoints: barcode lookup, OCR text parse, and manual search.

Flow:
  1. Check products_cache (SQLite)
  2. Try Open Food Facts
  3. Fallback to USDA FDC
  4. Run scoring engine
  5. Cache result and return
"""
from __future__ import annotations

import json
from typing import Optional
from fastapi import APIRouter, HTTPException, Header, Query

from ...models.product import Product, NutritionFacts, OcrScanRequest, NovaGroup
from ...models.score import ScoreResult
from ...db.database import get_db, fetch_one, fetch_all, execute, decode_json_field
from ...services import open_food_facts, usda_fdc
from ...services.demo_products import lookup_demo_barcode, search_demo_products
from ...core.scoring.engine import score_product
from ...models.child import ChildProfile
import os

router = APIRouter(prefix="/scan", tags=["scan"])


async def _get_child(db, child_id: int | None) -> ChildProfile | None:
    """Fetch child profile if child_id provided."""
    if not child_id:
        return None
    row = await fetch_one(db, "SELECT * FROM children WHERE id = ?", (child_id,))
    if not row:
        return None
    from ...db.database import decode_json_field
    return ChildProfile(
        id=row["id"],
        user_session=row["user_session"],
        name=row["name"],
        age_band=row["age_band"],
        gender=row["gender"],
        diet_type=row["diet_type"],
        allergies=decode_json_field(row.get("allergies"), []),
        goals=decode_json_field(row.get("goals"), []),
        cuisine=row.get("cuisine"),
    )


async def _cache_product(db, product: Product):
    """Upsert product into products_cache."""
    if not product.barcode:
        return
    await execute(
        db,
        """INSERT OR REPLACE INTO products_cache
           (barcode, product_name, brand, ingredients_text, nutriments, additives_tags, nova_group, data_source)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            product.barcode,
            product.name,
            product.brand,
            product.ingredients_text,
            json.dumps(product.nutrition.model_dump()),
            json.dumps(product.additives_tags),
            product.nova_group.value,
            product.data_source,
        ),
    )


async def _load_cached_product(db, barcode: str) -> Product | None:
    """Load product from SQLite cache."""
    row = await fetch_one(db, "SELECT * FROM products_cache WHERE barcode = ?", (barcode,))
    if not row:
        return None
    nutrition_data = decode_json_field(row.get("nutriments"), {})
    return Product(
        name=row["product_name"],
        brand=row.get("brand"),
        barcode=row["barcode"],
        nova_group=NovaGroup(row.get("nova_group", 4)),
        ingredients_text=row.get("ingredients_text"),
        data_source=row.get("data_source", "cache"),
        nutrition=NutritionFacts(**nutrition_data) if nutrition_data else NutritionFacts(),
        additives_tags=decode_json_field(row.get("additives_tags"), []),
    )


@router.get("/barcode/{barcode}")
async def scan_barcode(
    barcode: str,
    child_id: Optional[int] = Query(default=None),
    x_session_id: Optional[str] = Header(default=None),
) -> dict:
    """Look up a barcode, score for the child if child_id provided."""
    db = await get_db()
    try:
        # 1. Cache check
        product = await _load_cached_product(db, barcode)
        source = "cache"

        # 2. Open Food Facts
        if not product:
            product = await open_food_facts.lookup_barcode(barcode)
            source = "open_food_facts"

        # 3. USDA fallback
        if not product:
            product = await usda_fdc.lookup_barcode(barcode)
            source = "usda_fdc"

        # 4. Demo-mode fallback (corporate network / offline dev)
        if not product:
            product = lookup_demo_barcode(barcode)
            source = "demo"

        if not product:
            raise HTTPException(status_code=404, detail="Product not found in any database")

        # Cache it for next time
        if source != "cache":
            await _cache_product(db, product)

        child = await _get_child(db, child_id)
        result = score_product(child, product) if child else None

        # Log scan
        session = x_session_id or "anonymous"
        await execute(
            db,
            "INSERT INTO scans (user_session, child_id, barcode, scan_type, score_result) VALUES (?, ?, ?, ?, ?)",
            (session, child_id, barcode, "barcode", json.dumps(result.model_dump() if result else {})),
        )

        return {
            "product": product.model_dump(),
            "score": result.model_dump() if result else None,
            "data_source": source,
            "demo_mode": source == "demo",
        }
    finally:
        await db.close()


@router.post("/ocr")
async def scan_ocr(body: OcrScanRequest, x_session_id: Optional[str] = Header(default=None)) -> dict:
    """Accept OCR text from client ML Kit, build a partial product, score it."""
    # Stub product from raw OCR text — Claude will structure this when key available
    product = Product(
        name="Scanned Product (OCR)",
        ingredients_text=body.raw_text,
        nova_group=NovaGroup.ULTRA_PROCESSED,  # Conservative default
        data_source="ocr_label",
    )

    db = await get_db()
    try:
        child = await _get_child(db, body.child_id)
        result = score_product(child, product) if child else None
        if result:
            result.scan_source = "ocr_label"
            result.ocr_confidence = "partial"

        return {
            "product": product.model_dump(),
            "score": result.model_dump() if result else None,
            "ocr_note": "Nutritional data limited — ingredient flags only. Add LLM key for full OCR parsing.",
        }
    finally:
        await db.close()


@router.get("/search")
async def search_products(
    q: str = Query(..., min_length=2),
    child_id: Optional[int] = Query(default=None),
) -> dict:
    """Manual product name search via USDA FDC (demo fallback when offline)."""
    products = await usda_fdc.search_by_name(q, page_size=8)
    # Demo fallback if USDA unreachable
    if not products:
        products = search_demo_products(q)
    if not products:
        return {"products": [], "scores": [], "note": "No products found. Try a different name."}

    db = await get_db()
    try:
        child = await _get_child(db, child_id)
        scores = [
            score_product(child, p).model_dump() if child else None
            for p in products
        ]
    finally:
        await db.close()

    return {
        "products": [p.model_dump() for p in products],
        "scores": scores,
    }


@router.get("/history/{child_id}")
async def get_scan_history(
    child_id: int,
    limit: int = Query(default=20, le=100),
    x_session_id: Optional[str] = Header(default=None),
) -> list[dict]:
    """Paginated scan history for a child."""
    db = await get_db()
    try:
        rows = await fetch_all(
            db,
            "SELECT * FROM scans WHERE child_id = ? ORDER BY scanned_at DESC LIMIT ?",
            (child_id, limit),
        )
        return [
            {
                "id": r["id"],
                "barcode": r.get("barcode"),
                "scan_type": r.get("scan_type"),
                "score_result": decode_json_field(r.get("score_result"), {}),
                "parent_decision": r.get("parent_decision"),
                "scanned_at": r.get("scanned_at"),
            }
            for r in rows
        ]
    finally:
        await db.close()


@router.patch("/history/{scan_id}/decision")
async def log_decision(scan_id: int, decision: str = Query(...)) -> dict:
    """Log parent's give/skip decision for a scan."""
    if decision not in ("give", "skip", "undecided"):
        raise HTTPException(status_code=422, detail="Decision must be give, skip, or undecided")
    db = await get_db()
    try:
        await execute(db, "UPDATE scans SET parent_decision = ? WHERE id = ?", (decision, scan_id))
        return {"ok": True}
    finally:
        await db.close()
