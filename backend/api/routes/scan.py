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
import os
import re
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Header, Query, Request

from ...models.product import Product, NutritionFacts, OcrScanRequest, NovaGroup
from ...models.score import ScoreResult
from ...db.database import get_db, fetch_one, fetch_all, execute, decode_json_field
from ...services.product_resolver import resolve_barcode, resolve_search, build_not_found_response
from ...core.scoring.engine import score_product
from ...models.child import ChildProfile

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


@router.post("/ocr-image")
async def scan_ocr_image(request: Request) -> dict:
    """Parse a nutrition label photo using Claude Vision.

    Body: { imageBase64: str, mimeType?: str, child_id?: int }
    Returns: { product, score, source: 'photo-ocr' }
    Requires ANTHROPIC_API_KEY env var.
    """
    body = await request.json()
    image_b64 = body.get("imageBase64") or body.get("image_base64")
    mime_type = body.get("mimeType") or body.get("mime_type") or "image/jpeg"
    child_id  = body.get("child_id")

    if not image_b64:
        raise HTTPException(status_code=400, detail="imageBase64 is required")

    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail=(
                "Photo label scanning needs an Anthropic API key for Claude Vision. "
                "Set ANTHROPIC_API_KEY in backend/.env to enable. For now, "
                "use barcode entry or product link instead."
            ),
        )

    clean_b64 = re.sub(r"^data:[^;]+;base64,", "", image_b64)

    system = (
        "You are an OCR assistant for Nouri Scan. The user uploaded a photo of a "
        "packaged food product's nutrition facts panel and/or ingredients list. "
        "Read the image carefully and extract data as JSON.\n\n"
        "Return ONLY valid JSON (no markdown, no commentary) in this shape:\n"
        "{\n"
        '  "name": "Product name",\n'
        '  "brand": "Brand or empty string",\n'
        '  "ingredients": "Full ingredients list as one string",\n'
        '  "servingSizeG": number,\n'
        '  "calories": number,\n'
        '  "sodiumMg": number,\n'
        '  "addedSugarG": number,\n'
        '  "totalSugarG": number,\n'
        '  "ironMg": number,\n'
        '  "calciumMg": number,\n'
        '  "proteinG": number,\n'
        '  "fiberG": number,\n'
        '  "fatG": number,\n'
        '  "artificialFlavor": boolean,\n'
        '  "artificialDyes": boolean,\n'
        '  "novaGroupGuess": 1|2|3|4\n'
        "}\n\n"
        "Rules: convert DV percentages to absolute values (sodium DV=2300mg, "
        "fiber DV=28g, iron DV=18mg, calcium DV=1300mg). If unreadable, use 0 or "
        "empty string. Output ONLY the JSON object."
    )

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-sonnet-4-5",
                "max_tokens": 1500,
                "system": system,
                "messages": [{
                    "role": "user",
                    "content": [
                        {"type": "image", "source": {
                            "type": "base64", "media_type": mime_type, "data": clean_b64,
                        }},
                        {"type": "text", "text": "Extract nutrition data. JSON only."},
                    ],
                }],
            },
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Claude Vision error: {resp.text[:300]}")
        data = resp.json()

    text = data["content"][0]["text"]
    cleaned = re.sub(r"^```json\s*", "", text.strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r"```$", "", cleaned).strip()
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail=f"OCR returned non-JSON: {text[:300]}")

    nova_int = int(parsed.get("novaGroupGuess", 4))
    nutrition = NutritionFacts(
        calories          = float(parsed.get("calories", 0)),
        sodium_mg         = float(parsed.get("sodiumMg", 0)),
        added_sugar_g     = float(parsed.get("addedSugarG", 0)),
        total_sugar_g     = float(parsed.get("totalSugarG", 0)),
        iron_mg           = float(parsed.get("ironMg", 0)),
        calcium_mg        = float(parsed.get("calciumMg", 0)),
        protein_g         = float(parsed.get("proteinG", 0)),
        fiber_g           = float(parsed.get("fiberG", 0)),
        fat_g             = float(parsed.get("fatG", 0)),
        artificial_flavor = bool(parsed.get("artificialFlavor")),
        artificial_dyes   = bool(parsed.get("artificialDyes")),
        ultra_processed_hint = nova_int >= 4,
    )
    product = Product(
        name             = parsed.get("name") or "Scanned Product",
        brand            = parsed.get("brand") or "",
        ingredients_text = parsed.get("ingredients") or "",
        nova_group       = NovaGroup(nova_int) if 1 <= nova_int <= 4 else NovaGroup.ULTRA_PROCESSED,
        nutrition        = nutrition,
        data_source      = "photo-ocr",
    )

    db = await get_db()
    try:
        child = await _get_child(db, child_id)
        result = score_product(child, product) if child else None
    finally:
        await db.close()

    return {
        "product": product.model_dump(),
        "score":   result.model_dump() if result else None,
        "source":  "photo-ocr",
    }


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
