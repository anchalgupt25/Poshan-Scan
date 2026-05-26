"""Database layer with two pluggable backends:

  • aiosqlite — local file SQLite for dev / first-run / offline mode.
  • libsql_client — Turso (cloud SQLite-compatible) for production
    persistence. Free forever, ~9GB storage, edge-replicated.

The right backend is chosen at runtime from env vars:
  TURSO_DATABASE_URL + TURSO_AUTH_TOKEN  →  Turso (cloud, persistent)
  otherwise                              →  aiosqlite local file

Schema is identical between the two — libsql IS SQLite, just synced.
"""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any, Iterable

logger = logging.getLogger(__name__)

# ───────── Backend selection ─────────

_TURSO_URL   = os.getenv("TURSO_DATABASE_URL", "").strip()
_TURSO_TOKEN = os.getenv("TURSO_AUTH_TOKEN", "").strip()
USE_TURSO    = bool(_TURSO_URL and _TURSO_TOKEN)

_default_db = Path(__file__).parent.parent / "poshan.sqlite"
DB_PATH = Path(os.getenv("DB_PATH", str(_default_db)))
if not USE_TURSO:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

CREATE_TABLES_SQL = """
CREATE TABLE IF NOT EXISTS children (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_session TEXT NOT NULL,
    name        TEXT NOT NULL,
    age_band    TEXT NOT NULL,
    gender      TEXT NOT NULL,
    diet_type   TEXT NOT NULL DEFAULT 'Pure Veg',
    allergies   TEXT NOT NULL DEFAULT '[]',
    goals       TEXT NOT NULL DEFAULT '[]',
    cuisine     TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products_cache (
    barcode      TEXT PRIMARY KEY,
    product_name TEXT NOT NULL,
    brand        TEXT,
    ingredients_text TEXT,
    nutriments   TEXT NOT NULL DEFAULT '{}',
    additives_tags TEXT NOT NULL DEFAULT '[]',
    nova_group   INTEGER DEFAULT 4,
    data_source  TEXT NOT NULL DEFAULT 'unknown',
    image_url    TEXT,
    cached_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scans (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_session TEXT NOT NULL,
    child_id     INTEGER,
    barcode      TEXT,
    scan_type    TEXT NOT NULL DEFAULT 'barcode',
    score_result TEXT NOT NULL DEFAULT '{}',
    parent_decision TEXT DEFAULT 'undecided',
    scanned_at   TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (child_id) REFERENCES children(id)
);

CREATE TABLE IF NOT EXISTS auth_users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    email       TEXT NOT NULL UNIQUE COLLATE NOCASE,
    invite_code TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS auth_otps (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    email       TEXT NOT NULL COLLATE NOCASE,
    code_hash   TEXT NOT NULL,
    expires_at  TEXT NOT NULL,
    consumed    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_auth_otps_email ON auth_otps(email);
"""

# Additive migrations — guard with try/except, both backends ignore "column exists"
_ADDITIVE_MIGRATIONS = [
    "ALTER TABLE products_cache ADD COLUMN image_url TEXT",
]

# Parse `CREATE TABLES SQL` into individual statements for Turso (which
# doesn't have executescript). aiosqlite uses it as-is.
def _split_statements(script: str) -> list[str]:
    return [s.strip() for s in script.split(";") if s.strip()]


# ═══════════════════════════════════════════════════════════════════════════
#  Adapter pattern — both backends expose the same interface to route code:
#    db = await get_db()
#    row = await fetch_one(db, sql, params)
#    rows = await fetch_all(db, sql, params)
#    new_id = await execute(db, sql, params)
#    await db.close()
# ═══════════════════════════════════════════════════════════════════════════


class _TursoAdapter:
    """Thin wrapper that mimics aiosqlite.Connection for route code.

    Uses the async libsql Client directly — no sync-wrap-in-threadpool
    indirection. The Client is a long-lived singleton; we DON'T close it
    per-request (the route's try/finally just calls a no-op close).
    """

    def __init__(self, client):
        self._client = client

    async def execute_query(self, sql: str, params: Iterable = ()) -> list[dict]:
        result = await self._client.execute(sql, list(params))
        cols = result.columns
        return [dict(zip(cols, row)) for row in result.rows]

    async def execute_write(self, sql: str, params: Iterable = ()) -> int:
        result = await self._client.execute(sql, list(params))
        return result.last_insert_rowid or 0

    async def executescript(self, script: str) -> None:
        for stmt in _split_statements(script):
            # Skip pure-comment chunks
            if not any(line.strip() and not line.strip().startswith("--") for line in stmt.splitlines()):
                continue
            try:
                await self._client.execute(stmt)
            except Exception as e:
                msg = str(e).lower()
                if "already exists" in msg or "duplicate column" in msg:
                    continue
                raise

    async def commit(self) -> None:
        # Turso auto-commits each execute. No-op.
        pass

    async def close(self) -> None:
        # Singleton client — don't close per-request.
        pass


class _SqliteAdapter:
    """Wrapper around aiosqlite.Connection with the same surface as _TursoAdapter."""

    def __init__(self, conn):
        self._conn = conn

    async def execute_query(self, sql: str, params: Iterable = ()) -> list[dict]:
        async with self._conn.execute(sql, tuple(params)) as cur:
            rows = await cur.fetchall()
            return [dict(r) for r in rows]

    async def execute_write(self, sql: str, params: Iterable = ()) -> int:
        async with self._conn.execute(sql, tuple(params)) as cur:
            await self._conn.commit()
            return cur.lastrowid or 0

    async def executescript(self, script: str) -> None:
        await self._conn.executescript(script)
        await self._conn.commit()
        # Run additive migrations
        for migration in _ADDITIVE_MIGRATIONS:
            try:
                await self._conn.execute(migration)
                await self._conn.commit()
            except Exception:
                pass

    async def commit(self) -> None:
        await self._conn.commit()

    async def close(self) -> None:
        await self._conn.close()


# Schema initialization runs once per process startup.
_schema_initialized = False
_turso_client = None


async def _ensure_schema(adapter) -> None:
    global _schema_initialized
    if _schema_initialized:
        return
    await adapter.executescript(CREATE_TABLES_SQL)
    if USE_TURSO:
        # Run additive migrations against Turso too
        for migration in _ADDITIVE_MIGRATIONS:
            try:
                await adapter.execute_write(migration)
            except Exception:
                pass
    _schema_initialized = True
    logger.info("DB schema initialized (backend=%s)", "turso" if USE_TURSO else "sqlite")


def _normalize_turso_url(raw: str) -> str:
    """Force HTTPS transport.

    `libsql://...` defaults to WebSocket (Hrana). WebSockets are sometimes
    blocked or flaky on shared hosting (Render free, Heroku, etc.). HTTPS
    transport is universally reachable. Rewrite scheme to https:// so the
    client uses the HTTP JSON API instead.
    """
    if raw.startswith("libsql://"):
        return "https://" + raw[len("libsql://"):]
    return raw


async def get_db():
    """Return a per-request DB adapter. Use as `db = await get_db()`."""
    if USE_TURSO:
        global _turso_client
        if _turso_client is None:
            import libsql_client
            normalized = _normalize_turso_url(_TURSO_URL)
            try:
                _turso_client = libsql_client.create_client(
                    url=normalized,
                    auth_token=_TURSO_TOKEN,
                )
                logger.info("Turso client created (transport=https) for %s",
                            normalized.split('@')[-1])
            except Exception:
                logger.exception("Failed to create Turso client (url=%s)", normalized)
                raise
        adapter = _TursoAdapter(_turso_client)
    else:
        import aiosqlite
        conn = await aiosqlite.connect(DB_PATH)
        conn.row_factory = aiosqlite.Row
        adapter = _SqliteAdapter(conn)

    try:
        await _ensure_schema(adapter)
    except Exception:
        logger.exception("Schema initialization failed (backend=%s)",
                         "turso" if USE_TURSO else "sqlite")
        raise
    return adapter


# ───────── Public helpers used by routes ─────────


async def fetch_one(db, sql: str, params: tuple = ()) -> dict | None:
    rows = await db.execute_query(sql, params)
    return rows[0] if rows else None


async def fetch_all(db, sql: str, params: tuple = ()) -> list[dict]:
    return await db.execute_query(sql, params)


async def execute(db, sql: str, params: tuple = ()) -> int:
    return await db.execute_write(sql, params)


def decode_json_field(raw: str | None, default):
    """Safely decode a JSON string field from the DB."""
    if not raw:
        return default
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return default
