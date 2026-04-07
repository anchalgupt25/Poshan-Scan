"""SQLite database setup using aiosqlite. Migrations-free for MVP."""
from __future__ import annotations

import aiosqlite
import json
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "poshan.sqlite"

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
"""


# Additive migrations: add columns that didn't exist in older DB versions.
# Using IF NOT EXISTS guard-style; SQLite doesn't support that for columns,
# so we catch OperationalError (column already exists) gracefully.
_ADDITIVE_MIGRATIONS = [
    "ALTER TABLE products_cache ADD COLUMN image_url TEXT",
]


async def get_db() -> aiosqlite.Connection:
    """Get a database connection. Use as a dependency in FastAPI routes."""
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    await db.executescript(CREATE_TABLES_SQL)
    await db.commit()

    # Run additive migrations — safe to run every startup
    for migration in _ADDITIVE_MIGRATIONS:
        try:
            await db.execute(migration)
            await db.commit()
        except Exception:
            pass  # Column already exists — that's fine

    return db


async def fetch_one(db: aiosqlite.Connection, sql: str, params: tuple = ()) -> dict | None:
    async with db.execute(sql, params) as cur:
        row = await cur.fetchone()
        return dict(row) if row else None


async def fetch_all(db: aiosqlite.Connection, sql: str, params: tuple = ()) -> list[dict]:
    async with db.execute(sql, params) as cur:
        rows = await cur.fetchall()
        return [dict(r) for r in rows]


async def execute(db: aiosqlite.Connection, sql: str, params: tuple = ()) -> int:
    """Execute and commit, returning lastrowid."""
    async with db.execute(sql, params) as cur:
        await db.commit()
        return cur.lastrowid or 0


def decode_json_field(raw: str | None, default):
    """Safely decode a JSON string field from the DB."""
    if not raw:
        return default
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return default
