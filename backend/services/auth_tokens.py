"""HMAC-signed session tokens — JWT alternative without adding a dependency.

Token format: base64url(payload).base64url(signature)
Payload: JSON { sub: email, exp: unix-ts }
Signature: HMAC-SHA256(payload, AUTH_SECRET)

Tokens are 30-day lifetime by default.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time

# 30 days default; override with AUTH_SESSION_DAYS env var.
_DEFAULT_TTL_SECS = int(os.getenv("AUTH_SESSION_DAYS", "30")) * 86400


def _secret() -> bytes:
    """Return the signing secret (bytes). Auto-generated on first use if missing."""
    s = os.getenv("AUTH_SECRET", "")
    if not s:
        # Dev fallback — DO NOT use in production. Warn the operator.
        s = "nouri-scan-dev-secret-please-override"
    return s.encode("utf-8")


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64url_decode(s: str) -> bytes:
    padding = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + padding)


def issue_token(email: str, ttl_secs: int | None = None) -> str:
    """Issue a session token for `email`. Default TTL: 30 days."""
    payload = {"sub": email, "exp": int(time.time()) + (ttl_secs or _DEFAULT_TTL_SECS)}
    body = _b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    sig = _b64url(hmac.new(_secret(), body.encode("ascii"), hashlib.sha256).digest())
    return f"{body}.{sig}"


def verify_token(token: str) -> dict | None:
    """Return the payload dict if the token is valid + unexpired, else None."""
    if not token or "." not in token:
        return None
    body, sig = token.rsplit(".", 1)
    expected = _b64url(hmac.new(_secret(), body.encode("ascii"), hashlib.sha256).digest())
    if not hmac.compare_digest(expected, sig):
        return None
    try:
        payload = json.loads(_b64url_decode(body))
    except Exception:
        return None
    if payload.get("exp", 0) < int(time.time()):
        return None
    return payload


def hash_otp(code: str) -> str:
    """Hash an OTP for at-rest storage (no plaintext OTPs in DB)."""
    return hashlib.sha256((_secret() + code.encode("utf-8")).strip()).hexdigest()


def generate_otp() -> str:
    """6-digit numeric OTP, cryptographically random."""
    return f"{secrets.randbelow(1_000_000):06d}"
