"""Admin-only analytics endpoints.

Two equally-valid ways to authenticate, picked whichever is convenient:

  1. Bearer <ADMIN_TOKEN>  — static secret in ADMIN_TOKEN env var (curl/CLI)
  2. Bearer <session>      — a regular signed-in user whose email is on
                             the ADMIN_EMAILS allowlist (used by the
                             in-app admin screen)

ADMIN_EMAILS is a comma-separated env var, e.g.
  ADMIN_EMAILS=anchalgupt25@gmail.com,cofounder@nouriscan.app
"""
from __future__ import annotations

import os
from typing import Optional

from fastapi import APIRouter, Header, HTTPException

from ...db.database import fetch_all, fetch_one, get_db
from ...services.auth_tokens import verify_token

router = APIRouter(prefix="/admin", tags=["admin"])


def _admin_emails() -> set[str]:
    raw = os.getenv("ADMIN_EMAILS", "")
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


def _require_admin(authorization: Optional[str]) -> str:
    """Verify the caller is an admin. Returns the admin identity (email or
    'token-auth' for the static token path).
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Bearer token required.")
    provided = authorization[7:].strip()

    # Path 1 — static admin token
    expected = os.getenv("ADMIN_TOKEN", "").strip()
    if expected and provided == expected:
        return "token-auth"

    # Path 2 — signed-in user whose email is on the admin allowlist
    payload = verify_token(provided)
    if payload:
        email = (payload.get("sub") or "").lower().strip()
        if email and email in _admin_emails():
            return email

    raise HTTPException(status_code=403, detail="Not an admin.")


# ─── Endpoints ────────────────────────────────────────────────────────────────


@router.get("/stats")
async def stats(authorization: Optional[str] = Header(default=None)) -> dict:
    """Headline numbers."""
    _require_admin(authorization)
    db = await get_db()
    try:
        users_total = (await fetch_one(db, "SELECT COUNT(*) AS n FROM auth_users", ()))["n"]
        users_returned = (await fetch_one(
            db,
            "SELECT COUNT(*) AS n FROM auth_users WHERE last_login_at IS NOT NULL",
            (),
        ))["n"]
        kids_total = (await fetch_one(db, "SELECT COUNT(*) AS n FROM children", ()))["n"]
        scans_total = (await fetch_one(db, "SELECT COUNT(*) AS n FROM scans", ()))["n"]
        scans_24h = (await fetch_one(
            db,
            "SELECT COUNT(*) AS n FROM scans WHERE scanned_at >= datetime('now', '-1 day')",
            (),
        ))["n"]
        scans_7d = (await fetch_one(
            db,
            "SELECT COUNT(*) AS n FROM scans WHERE scanned_at >= datetime('now', '-7 days')",
            (),
        ))["n"]
        signups_7d = (await fetch_one(
            db,
            "SELECT COUNT(*) AS n FROM auth_users WHERE created_at >= datetime('now', '-7 days')",
            (),
        ))["n"]
        image_uploads = (await fetch_one(
            db,
            "SELECT COUNT(*) AS n FROM scans WHERE scan_type IN ('ocr_label', 'photo-ocr', 'photo')",
            (),
        ))["n"]
        unique_products = (await fetch_one(
            db,
            "SELECT COUNT(DISTINCT barcode) AS n FROM scans WHERE barcode IS NOT NULL AND barcode != ''",
            (),
        ))["n"]
        return {
            "users": {
                "total_signups": users_total,
                "returned_at_least_once": users_returned,
                "signups_last_7d": signups_7d,
            },
            "kids": {"total_profiles": kids_total},
            "scans": {
                "total": scans_total,
                "last_24h": scans_24h,
                "last_7d": scans_7d,
                "unique_products": unique_products,
                "image_uploads": image_uploads,
            },
        }
    finally:
        await db.close()


@router.get("/users")
async def list_users(
    authorization: Optional[str] = Header(default=None),
    limit: int = 100,
) -> list[dict]:
    """List signed-up users with kid/scan/image counts."""
    _require_admin(authorization)
    db = await get_db()
    try:
        rows = await fetch_all(
            db,
            """SELECT u.id,
                      u.email,
                      u.invite_code,
                      u.created_at,
                      u.last_login_at,
                      COUNT(DISTINCT c.id) AS kids,
                      COUNT(DISTINCT s.id) AS total_scans,
                      COUNT(DISTINCT s.barcode) AS unique_scans,
                      SUM(CASE WHEN s.scan_type IN ('ocr_label', 'photo-ocr', 'photo') THEN 1 ELSE 0 END) AS image_uploads
                 FROM auth_users u
                 LEFT JOIN children c ON c.user_session = u.email
                 LEFT JOIN scans    s ON s.user_session = u.email
                 GROUP BY u.id, u.email, u.invite_code, u.created_at, u.last_login_at
                 ORDER BY COALESCE(u.last_login_at, u.created_at) DESC
                 LIMIT ?""",
            (limit,),
        )
        # Defensive: SUM() returns None on empty row sets in libsql.
        for r in rows:
            r["image_uploads"] = r.get("image_uploads") or 0
            r["total_scans"] = r.get("total_scans") or 0
            r["unique_scans"] = r.get("unique_scans") or 0
            r["kids"] = r.get("kids") or 0
        return rows
    finally:
        await db.close()


@router.get("/signups-by-day")
async def signups_by_day(authorization: Optional[str] = Header(default=None)) -> list[dict]:
    _require_admin(authorization)
    db = await get_db()
    try:
        return await fetch_all(
            db,
            """SELECT DATE(created_at) AS day, COUNT(*) AS signups
                 FROM auth_users
                GROUP BY DATE(created_at)
                ORDER BY day DESC""",
            (),
        )
    finally:
        await db.close()


@router.get("/scans-by-day")
async def scans_by_day(authorization: Optional[str] = Header(default=None)) -> list[dict]:
    _require_admin(authorization)
    db = await get_db()
    try:
        return await fetch_all(
            db,
            """SELECT DATE(scanned_at) AS day, COUNT(*) AS scans
                 FROM scans
                GROUP BY DATE(scanned_at)
                ORDER BY day DESC""",
            (),
        )
    finally:
        await db.close()


@router.get("/top-products")
async def top_products(
    authorization: Optional[str] = Header(default=None),
    limit: int = 25,
) -> list[dict]:
    _require_admin(authorization)
    db = await get_db()
    try:
        return await fetch_all(
            db,
            """SELECT json_extract(score_result, '$.product_name') AS product,
                      json_extract(score_result, '$.brand') AS brand,
                      COUNT(*) AS times_scanned
                 FROM scans
                WHERE json_extract(score_result, '$.product_name') IS NOT NULL
                GROUP BY product, brand
                ORDER BY times_scanned DESC
                LIMIT ?""",
            (limit,),
        )
    finally:
        await db.close()
