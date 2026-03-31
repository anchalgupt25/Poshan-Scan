"""Poshan Scan — FastAPI backend.

Child food scoring API. Deterministic scoring, no LLM needed to start.
Claude narration layer added when Element LLM Gateway key is available.

Disclaimer: All output is educational information only — not medical advice.
"""
from __future__ import annotations

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from .api.routes import children, scan

load_dotenv()

app = FastAPI(
    title="Poshan Scan API",
    description="Child food scoring — educational information only, not medical advice.",
    version="0.1.0",
)

# CORS — allow local Vite dev server and any future PWA origin
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url, "http://localhost:5174", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(children.router)
app.include_router(scan.router)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "app": "Poshan Scan",
        "disclaimer": "Educational information only — not medical advice.",
    }


@app.get("/")
async def root():
    return {
        "message": "Poshan Scan API is running 🔬",
        "docs": "/docs",
        "disclaimer": "Educational information only — not medical advice.",
    }
