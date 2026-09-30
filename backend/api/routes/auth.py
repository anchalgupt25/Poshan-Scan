"""Email-OTP auth + invite-code gate.

Flow:
  1. POST /auth/request-otp  { email, invite_code }
     → validates invite, generates OTP, emails it, stores hash with 10-min expiry
  2. POST /auth/verify-otp   { email, code }
     → checks hash + expiry, marks consumed, issues 30-day session token
  3. GET  /auth/me           Authorization: Bearer <token>
     → returns the authenticated email (or 401)
  4. POST /auth/logout       no-op on the server (stateless tokens) — frontend
     just discards the token.

Invite codes are read from INVITE_CODES env var (comma-separated).
"""
from __future__ import annotations

import hmac
import logging
import os
import time
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request

from ...db.database import execute, fetch_all, fetch_one, get_db
from ...services.auth_tokens import generate_otp, hash_otp, issue_token, verify_token
from ...services.email import send_otp_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

_OTP_TTL_MINUTES = int(os.getenv("OTP_TTL_MINUTES", "10"))
_OTP_MAX_PER_HOUR = int(os.getenv("OTP_MAX_PER_HOUR", "5"))


def _allowed_invite_codes() -> set[str]:
    raw = os.getenv("INVITE_CODES", "")
    return {c.strip().upper() for c in raw.split(",") if c.strip()}


def _review_account() -> tuple[Optional[str], Optional[str]]:
    """App Store review bypass account.

    NouriScan is invite-gated and signs users in with an emailed OTP, so an
    Apple reviewer cannot get past the front door on their own — that is a
    Guideline 2.1 rejection. When REVIEW_EMAIL and REVIEW_OTP are both set,
    that one address skips the invite gate and accepts that one fixed code
    without an email being sent.

    Deliberately narrow: disabled unless both vars are present, scoped to a
    single address, and every use is logged. Unset both after approval.
    """
    email = (os.getenv("REVIEW_EMAIL") or "").strip().lower()
    otp = (os.getenv("REVIEW_OTP") or "").strip()
    if not email or not otp:
        return None, None
    # Refuse an obviously guessable code so this can't become a real backdoor.
    if len(otp) < 6:
        return None, None
    return email, otp


def _is_review_email(email: str) -> bool:
    review_email, _ = _review_account()
    return bool(review_email) and email.strip().lower() == review_email


def _persistent_known_emails() -> set[str]:
    """Env-var-backed list of emails that are pre-approved to skip the invite
    gate. Stopgap until the DB is on persistent storage (Render free tier wipes
    SQLite on every redeploy). Operator updates KNOWN_USERS in the dashboard
    as new beta testers sign up.

    Format: comma-separated emails, case-insensitive.
    Example:  KNOWN_USERS=anchalgupt25@gmail.com,test@example.com
    """
    raw = os.getenv("KNOWN_USERS", "")
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


# ─── Endpoints ────────────────────────────────────────────────────────────────


@router.post("/request-otp")
async def request_otp(request: Request) -> dict:
    body = await request.json()
    email = (body.get("email") or "").strip().lower()
    code  = (body.get("invite_code") or body.get("inviteCode") or "").strip().upper()

    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Valid email is required.")

    # App Store reviewer: no invite code, no email round-trip, fixed OTP.
    if _is_review_email(email):
        logger.warning("App Store review account requested a code: %s", email)
        db = await get_db()
        try:
            exists = await fetch_one(db, "SELECT id FROM auth_users WHERE email = ?", (email,))
            if not exists:
                await execute(
                    db,
                    "INSERT INTO auth_users (email, invite_code) VALUES (?, ?)",
                    (email, "APP_REVIEW"),
                )
        finally:
            await db.close()
        return {
            "ok": True,
            "expires_in_minutes": _OTP_TTL_MINUTES,
            "delivery": "review-account",
            "is_returning_user": True,
        }

    db = await get_db()
    try:
        # Existing users (already registered with a valid invite code) can
        # sign in with just email — no need to re-enter the invite code.
        existing = await fetch_one(db, "SELECT id FROM auth_users WHERE email = ?", (email,))

        # Stopgap: also accept emails listed in KNOWN_USERS env var. This
        # survives Render redeploys (ephemeral SQLite) so returning beta
        # testers don't lose access just because the DB was wiped.
        if not existing and email in _persistent_known_emails():
            await execute(
                db,
                "INSERT INTO auth_users (email, invite_code) VALUES (?, ?)",
                (email, "PRESEEDED"),
            )
            existing = await fetch_one(db, "SELECT id FROM auth_users WHERE email = ?", (email,))

        if not existing:
            # New email — invite code is required and must be on the allowlist.
            if not code:
                raise HTTPException(
                    status_code=400,
                    detail="Invite code required for new accounts. If you signed up before, just enter your email.",
                )
            allowed = _allowed_invite_codes()
            if allowed and code not in allowed:
                raise HTTPException(
                    status_code=403,
                    detail="That invite code isn't valid. Double-check or request one.",
                )

        # Rate-limit: max N OTP requests per email per hour
        recent = await fetch_one(
            db,
            "SELECT COUNT(*) AS n FROM auth_otps WHERE email = ? AND created_at >= datetime('now', '-1 hour')",
            (email,),
        )
        if (recent or {}).get("n", 0) >= _OTP_MAX_PER_HOUR:
            raise HTTPException(status_code=429, detail="Too many code requests. Try again in an hour.")

        otp = generate_otp()
        expires_at = (datetime.utcnow() + timedelta(minutes=_OTP_TTL_MINUTES)).strftime("%Y-%m-%d %H:%M:%S")
        await execute(
            db,
            "INSERT INTO auth_otps (email, code_hash, expires_at) VALUES (?, ?, ?)",
            (email, hash_otp(otp), expires_at),
        )

        # Insert the user record on first signup so future visits skip the code
        if not existing:
            await execute(
                db,
                "INSERT INTO auth_users (email, invite_code) VALUES (?, ?)",
                (email, code),
            )

        ok, info = await send_otp_email(email, otp)
        if not ok:
            raise HTTPException(status_code=502, detail=f"Could not send email. ({info})")

        return {
            "ok": True,
            "expires_in_minutes": _OTP_TTL_MINUTES,
            "delivery": "console" if info == "dev-console" else "email",
            "is_returning_user": existing is not None,
        }
    finally:
        await db.close()


@router.post("/verify-otp")
async def verify_otp(request: Request) -> dict:
    body = await request.json()
    email = (body.get("email") or "").strip().lower()
    code  = (body.get("code") or body.get("otp") or "").strip()

    if not email or not code:
        raise HTTPException(status_code=400, detail="Email and code are required.")

    # App Store reviewer: accept the one configured fixed code for that one
    # configured address. Compared in constant time so the code can't be
    # recovered by timing the endpoint.
    if _is_review_email(email):
        _, review_otp = _review_account()
        if review_otp and hmac.compare_digest(code, review_otp):
            logger.warning("App Store review account signed in: %s", email)
            db = await get_db()
            try:
                await execute(
                    db,
                    "UPDATE auth_users SET last_login_at = datetime('now') WHERE email = ?",
                    (email,),
                )
            finally:
                await db.close()
            return {"ok": True, "token": issue_token(email), "email": email}
        raise HTTPException(status_code=400, detail="That code is incorrect. Try again or request a new one.")

    db = await get_db()
    try:
        row = await fetch_one(
            db,
            """SELECT id, code_hash, expires_at, consumed FROM auth_otps
               WHERE email = ? AND consumed = 0
               ORDER BY id DESC LIMIT 1""",
            (email,),
        )
        if not row:
            raise HTTPException(status_code=400, detail="No code requested for this email. Request a new one.")

        if row["code_hash"] != hash_otp(code):
            raise HTTPException(status_code=400, detail="That code is incorrect. Try again or request a new one.")

        # Expiry check
        if row["expires_at"] < datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"):
            raise HTTPException(status_code=400, detail="That code has expired. Request a new one.")

        # Mark consumed + update last login
        await execute(db, "UPDATE auth_otps SET consumed = 1 WHERE id = ?", (row["id"],))
        await execute(db, "UPDATE auth_users SET last_login_at = datetime('now') WHERE email = ?", (email,))

        token = issue_token(email)
        return {"ok": True, "token": token, "email": email}
    finally:
        await db.close()


def _bearer_email(authorization: Optional[str]) -> Optional[str]:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    payload = verify_token(authorization[7:].strip())
    return payload.get("sub") if payload else None


async def require_auth(authorization: Optional[str] = Header(default=None)) -> str:
    """FastAPI dependency that yields the authenticated email or 401."""
    email = _bearer_email(authorization)
    if not email:
        raise HTTPException(status_code=401, detail="Authentication required.")
    return email


def _admin_emails_set() -> set[str]:
    raw = os.getenv("ADMIN_EMAILS", "")
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


@router.get("/me")
async def whoami(authorization: Optional[str] = Header(default=None)) -> dict:
    email = _bearer_email(authorization)
    if not email:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    return {
        "email": email,
        "authenticated": True,
        "is_admin": email.lower() in _admin_emails_set(),
    }


@router.post("/logout")
async def logout() -> dict:
    # Tokens are stateless. Client just discards. Return success for UX symmetry.
    return {"ok": True}


@router.get("/account/summary")
async def account_summary(authorization: Optional[str] = Header(default=None)) -> dict:
    """What deleting this account would remove.

    Shown on the delete-confirmation screen so the user is told exactly what
    they're about to lose before they confirm.
    """
    email = _bearer_email(authorization)
    if not email:
        raise HTTPException(status_code=401, detail="Not authenticated.")

    db = await get_db()
    try:
        kids = await fetch_one(
            db, "SELECT COUNT(*) AS n FROM children WHERE user_email = ?", (email,)
        )
        scans = await fetch_one(
            db, "SELECT COUNT(*) AS n FROM scans WHERE user_email = ?", (email,)
        )
        user = await fetch_one(
            db, "SELECT created_at FROM auth_users WHERE email = ?", (email,)
        )
        return {
            "email": email,
            "children": (kids or {}).get("n", 0),
            "scans": (scans or {}).get("n", 0),
            "member_since": (user or {}).get("created_at"),
        }
    finally:
        await db.close()


@router.delete("/account")
async def delete_account(
    authorization: Optional[str] = Header(default=None),
    x_session_id: Optional[str] = Header(default=None),
) -> dict:
    """Permanently delete the signed-in account and all of its data.

    Required by App Store Review Guideline 5.1.1(v): any app that supports
    account creation must let the user delete that account from inside the app.

    Deletes, in dependency order:
      * scans          — scan history rows
      * children       — child profiles (name, age band, allergens)
      * auth_otps      — any outstanding one-time codes
      * auth_users     — the account record itself

    Rows are matched by user_email and, for profiles created before account
    linking existed, by the caller's legacy session id. products_cache is left
    alone: it holds only public nutrition data keyed by barcode, with nothing
    personal and no link to any user.

    This is irreversible and there is no soft-delete or grace period, which is
    what the guideline asks for.
    """
    email = _bearer_email(authorization)
    if not email:
        raise HTTPException(status_code=401, detail="Authentication required.")

    session = x_session_id or "anonymous"
    db = await get_db()
    try:
        # Child ids owned by this account, including legacy session-keyed rows.
        owned = await fetch_all(
            db,
            """SELECT id FROM children
               WHERE user_email = ?
                  OR (user_email IS NULL AND user_session = ?)""",
            (email, session),
        )
        child_ids = [r["id"] for r in owned]

        deleted_scans = 0
        for cid in child_ids:
            await execute(db, "DELETE FROM scans WHERE child_id = ?", (cid,))
            deleted_scans += 1

        # Scans attributed directly to the account (child_id may be NULL for
        # scans taken before a profile existed).
        await execute(db, "DELETE FROM scans WHERE user_email = ?", (email,))
        await execute(
            db,
            "DELETE FROM scans WHERE user_email IS NULL AND user_session = ?",
            (session,),
        )

        await execute(db, "DELETE FROM children WHERE user_email = ?", (email,))
        await execute(
            db,
            "DELETE FROM children WHERE user_email IS NULL AND user_session = ?",
            (session,),
        )

        await execute(db, "DELETE FROM auth_otps WHERE email = ?", (email,))
        await execute(db, "DELETE FROM auth_users WHERE email = ?", (email,))

        logger.info(
            "Account deleted: %s (children=%d, scan rows cleared for %d profiles)",
            email, len(child_ids), deleted_scans,
        )

        return {
            "ok": True,
            "deleted": {"email": email, "children": len(child_ids)},
            "message": "Your account and all associated data have been permanently deleted.",
        }
    finally:
        await db.close()
