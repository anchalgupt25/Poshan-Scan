"""Nouri Scan — FastAPI backend.

Child food scoring API. Deterministic scoring, no LLM needed to start.
Nouri chatbot: rule-based engine with Element LLM Gateway hook
(set ELEMENT_LLM_API_KEY env var to enable).

Disclaimer: All output is educational information only — not medical advice.
"""
from __future__ import annotations

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from .api.routes import auth, children, scan, nouri

load_dotenv()

app = FastAPI(
    title="Nouri Scan API",
    description="Child food scoring + Nouri nutritionist bot — educational information only, not medical advice.",
    version="0.2.0",
)

# CORS configuration.
#
# Strategy: a fixed safe-by-default list of known origins (production custom
# domain + Render preview URL + local dev) PLUS anything operators add via
# FRONTEND_URL env var. Hardcoding the production origins means a typo or a
# missed redeploy of the env var doesn't break the live site.
#
# We also use `allow_origin_regex` so any *.onrender.com preview deploy and
# any subdomain of nouriscan.app (e.g. www., staging.) auto-works without
# additional configuration.
_default_origins = [
    "https://nouriscan.app",
    "https://www.nouriscan.app",
    "https://nouri-scan.onrender.com",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
]
_env_origins = [u.strip() for u in os.getenv("FRONTEND_URL", "").split(",") if u.strip()]
_allow_origins = list(dict.fromkeys(_default_origins + _env_origins))

_allow_origin_regex = r"https://([a-z0-9-]+\.)?nouriscan\.app|https://[a-z0-9-]+\.onrender\.com"

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_origin_regex=_allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router)
app.include_router(children.router)
app.include_router(scan.router)
app.include_router(nouri.router)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "app": "Nouri Scan",
        "disclaimer": "Educational information only — not medical advice.",
    }


@app.get("/health/db")
async def db_health():
    """Quick DB connectivity probe — surfaces the actual exception (not a
    bare 500) so we can debug Turso/SQLite connectivity from any browser.
    """
    import traceback
    from .db.database import get_db, USE_TURSO, fetch_one
    try:
        db = await get_db()
        try:
            row = await fetch_one(db, "SELECT 1 AS n", ())
        finally:
            await db.close()
        return {"ok": True, "backend": "turso" if USE_TURSO else "sqlite", "probe": row}
    except Exception as e:
        return {
            "ok": False,
            "backend": "turso" if USE_TURSO else "sqlite",
            "error_type": type(e).__name__,
            "error": str(e),
            "trace": traceback.format_exc().splitlines()[-6:],
        }


@app.get("/")
async def root():
    return {
        "message": "Nouri Scan API is running 🌱",
        "docs": "/docs",
        "disclaimer": "Educational information only — not medical advice.",
    }
