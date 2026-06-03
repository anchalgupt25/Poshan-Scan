"""Admin-only analytics endpoints.

Gated by a bearer token (env var ADMIN_TOKEN). All endpoints require:
  Authorization: Bearer <ADMIN_TOKEN>

Generate a secret on first deploy:
  python -c "import secrets; print(secrets.token_urlsafe(32))"
Set it in Render → nouri-scan-api → Environment → ADMIN_TOKEN=<value>
"""
from __future__ import annotations

import os
from typing import Optional

from fastapi import APIRouter, Header, HTTPException

from ...db.database import fetch_all, fetch_one, get_db

router = APIRouter(prefix="/admin", tags=["admin"])


def _require_admin(authorization: Optional[str]) -> None:
    """Verify the bearer token matches ADMIN_TOKEN env var."""
    expected = os.getenv("ADMIN_TOKEN", "").strip()
    if not expected:
        raise HTTPException(status_code=503, detail="Admin not configured (set ADMIN_TOKEN env var).")
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Bearer token required.")
    provided = authorization[7:].strip()
    if provided != expected:
        raise HTTPException(status_code=403, detail="Invalid admin token.")


@router.get("/stats")
async def stats(authorization: Optional[str] = Header(default=None)) -> dict:
    """Headline numbers: signups, active users, scans, kids."""
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
        signups_7d = (await fetch_one(
            db,
            "SELECT COUNT(*) AS n FROM auth_users WHERE created_at >= datetime('now', '-7 days')",
            (),
        ))["n"]
        otps_pending = (await fetch_one(
            db,
            "SELECT COUNT(*) AS n FROM auth_otps WHERE consumed = 0 AND expires_at >= datetime('now')",
            (),
        ))["n"]
        return {
            "users": {
                "total_signups": users_total,
                "returned_at_least_once": users_returned,
                "signups_last_7d": signups_7d,
            },
            "kids": {"total_profiles": kids_total},
            "scans": {"total": scans_total, "last_24h": scans_24h},
            "otps": {"pending_unconsumed": otps_pending},
        }
    finally:
        await db.close()


@router.get("/users")
async def list_users(
    authorization: Optional[str] = Header(default=None),
    limit: int = 100,
) -> list[dict]:
    """List signed-up users in order of most recent activity."""
    _require_admin(authorization)
    db = await get_db()
    try:
        rows = await fetch_all(
            db,
            """SELECT u.id, u.email, u.invite_code, u.created_at, u.last_login_at,
                      COUNT(DISTINCT c.id) AS kids,
                      COUNT(DISTINCT s.id) AS scans
                 FROM auth_users u
                 LEFT JOIN children c ON c.user_session = u.email
                 LEFT JOIN scans    s ON s.user_session = u.email
                 GROUP BY u.id, u.email, u.invite_code, u.created_at, u.last_login_at
                 ORDER BY COALESCE(u.last_login_at, u.created_at) DESC
                 LIMIT ?""",
            (limit,),
        )
        return rows
    finally:
        await db.close()


@router.get("/signups-by-day")
async def signups_by_day(authorization: Optional[str] = Header(default=None)) -> list[dict]:
    """Histogram of signups per day, most recent first."""
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
    """Histogram of scans per day."""
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
    """Most-scanned products across all users."""
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
