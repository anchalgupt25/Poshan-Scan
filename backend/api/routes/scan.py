"""Scan endpoints: barcode lookup, OCR text parse, and manual search.

All product resolution is delegated to services.product_resolver — this
module owns only the HTTP layer (request parsing, DB session, response shape).

Flow for barcode:
  product_resolver.resolve_barcode() → score_product() → log scan → return
Flow for search:
  product_resolver.resolve_search() → score_product() per result → return
"""
from __future__ import annotations

import json
from typing import Optional
from fastapi import APIRouter, HTTPException, Header, Query

from ...models.product import Product, NutritionFacts, OcrScanRequest, NovaGroup
from ...models.score import ScoreResult
from ...db.database import get_db, fetch_one, fetch_all, execute, decode_json_field
from ...services.product_resolver import resolve_barcode, resolve_search, build_not_found_response
from ...core.scoring.engine import score_product
from ...models.child import ChildProfile
import os

router = APIRouter(prefix="/scan", tags=["scan"])


# ---------------------------------------------------------------------------
# Child helper — local to routes, reads only DB
# ---------------------------------------------------------------------------

async def _get_child(db, child_id: int | None) -> ChildProfile | None:
    """Fetch child profile if child_id provided."""
    if not child_id:
        return None
    row = await fetch_one(db, "SELECT * FROM children WHERE id = ?", (child_id,))
    if not row:
        return None
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


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/barcode/{barcode}")
async def scan_barcode(
    barcode: str,
    child_id: Optional[int] = Query(default=None),
    x_session_id: Optional[str] = Header(default=None),
) -> dict:
    """Look up a barcode and score it for the given child profile.

    Resolution chain: cache → Open Food Facts → USDA FDC → demo fallback.
    Product is automatically cached after first live API hit.
    """
    db = await get_db()
    try:
        product, source = await resolve_barcode(db, barcode)

        if not product:
            return build_not_found_response(barcode)

        child = await _get_child(db, child_id)
        result = score_product(child, product) if child else None

        session = x_session_id or "anonymous"
        await execute(
            db,
            "INSERT INTO scans (user_session, child_id, barcode, scan_type, score_result) "
            "VALUES (?, ?, ?, ?, ?)",
            (session, child_id, barcode, "barcode",
             json.dumps(result.model_dump() if result else {})),
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
async def scan_ocr(
    body: OcrScanRequest,
    x_session_id: Optional[str] = Header(default=None),
) -> dict:
    """Accept OCR text from client ML Kit, build a partial product, score it.

    Nutritional data is limited — ingredient flags only until LLM key is added.
    """
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
            "ocr_note": (
                "Nutritional data limited — ingredient flags only. "
                "Add LLM key for full OCR parsing."
            ),
        }
    finally:
        await db.close()


@router.get("/search")
async def search_products(
    q: str = Query(..., min_length=2),
    child_id: Optional[int] = Query(default=None),
) -> dict:
    """Product name search across Open Food Facts + USDA FDC.

    OFF is tried first (best global / Indian coverage), then USDA (US brands).
    Falls back to demo product bank when both APIs are unreachable.
    """
    products, source = await resolve_search(q, page_size=8)

    if not products:
        return {
            "products": [],
            "scores": [],
            "data_source": "none",
            "note": "No products found. Try a more specific name or barcode scan.",
        }

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
        "data_source": source,
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
