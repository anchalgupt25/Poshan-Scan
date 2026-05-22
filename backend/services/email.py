"""Email delivery for OTP codes.

Production: uses Resend (https://resend.com — 100 emails/day free).
Dev / no key: logs the OTP to stdout so testing works without signup.

Set RESEND_API_KEY in backend/.env to enable real email delivery.
Set RESEND_FROM (e.g. 'Nouri Scan <onboarding@resend.dev>') for the sender.
"""
from __future__ import annotations

import logging
import os
from typing import Tuple

import httpx

logger = logging.getLogger(__name__)

_RESEND_API   = "https://api.resend.com/emails"
_DEFAULT_FROM = "Nouri Scan <onboarding@resend.dev>"


async def send_otp_email(to_email: str, code: str) -> Tuple[bool, str]:
    """Send a 6-digit OTP to `to_email`. Returns (ok, message_or_id).

    Without RESEND_API_KEY, just logs the code (dev mode).
    """
    api_key = os.getenv("RESEND_API_KEY", "").strip()
    sender  = os.getenv("RESEND_FROM", _DEFAULT_FROM)

    if not api_key:
        # Dev fallback — print the OTP so the developer can sign in
        logger.warning("=" * 60)
        logger.warning("RESEND_API_KEY not set — printing OTP to console.")
        logger.warning("Email: %s    OTP: %s", to_email, code)
        logger.warning("Set RESEND_API_KEY in backend/.env for real email.")
        logger.warning("=" * 60)
        print(f"\n📧 OTP for {to_email}: {code}\n")
        return True, "dev-console"

    subject = f"Your Nouri Scan code: {code}"
    html = f"""<!DOCTYPE html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; background:#FBF6EE; padding:40px 20px;">
  <div style="max-width:480px; margin:0 auto; background:#fff; border-radius:20px; padding:36px; box-shadow:0 8px 24px rgba(58,46,38,0.10);">
    <h1 style="font-family:Georgia,serif; font-size:28px; color:#8B3A28; margin:0 0 8px;">Nouri<em style="color:#D8694A;">Scan</em></h1>
    <p style="font-size:14px; color:#6A5A4E; margin:0 0 24px;">Your sign-in code</p>
    <div style="font-size:38px; font-weight:700; letter-spacing:8px; color:#3A2E26; text-align:center; padding:24px; background:#F4E9D7; border-radius:14px;">{code}</div>
    <p style="font-size:13px; color:#9E8E7E; margin-top:24px; line-height:1.5;">
      Enter this code in the Nouri Scan app to sign in. It expires in 10 minutes. If you didn't request this, you can safely ignore it.
    </p>
  </div>
</body></html>"""

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                _RESEND_API,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": sender,
                    "to": [to_email],
                    "subject": subject,
                    "html": html,
                    "text": f"Your Nouri Scan code: {code}\n\nIt expires in 10 minutes.",
                },
            )
            if r.status_code >= 400:
                logger.error("Resend error %s: %s", r.status_code, r.text[:300])
                return False, f"resend error {r.status_code}"
            data = r.json()
            return True, data.get("id", "sent")
    except Exception as e:
        logger.exception("Resend send failed")
        return False, str(e)
