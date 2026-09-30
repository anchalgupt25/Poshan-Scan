"""Child profile CRUD endpoints.

Ownership: rows are matched on the signed-in email when available, falling back
to the legacy per-browser session id for rows created before account linking
existed. See api/routes/ownership.py for the rationale.

Every by-id route verifies ownership before reading or writing. Child profiles
contain a name, age band, and allergen list, so an unscoped id lookup would
leak another family's health data.
"""
from __future__ import annotations

import json
from fastapi import APIRouter, HTTPException, Header
from typing import Optional

from ...models.child import ChildProfileCreate, ChildProfile, ChildProfileUpdate
from ...db.database import get_db, fetch_one, fetch_all, execute, decode_json_field
from .ownership import resolve_owner

router = APIRouter(prefix="/children", tags=["children"])


def _row_to_profile(row: dict) -> ChildProfile:
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


async def _owned_child_or_404(db, child_id: int, owner) -> dict:
    """Fetch a child scoped to the caller. 404 (not 403) when not theirs, so we
    don't confirm the existence of other families' records."""
    pred, params = owner.where()
    row = await fetch_one(
        db,
        f"SELECT * FROM children WHERE id = ? AND {pred}",
        (child_id, *params),
    )
    if not row:
        raise HTTPException(status_code=404, detail="Child not found")
    return row


@router.post("/", response_model=ChildProfile, status_code=201)
async def create_child(
    profile: ChildProfileCreate,
    x_session_id: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Create a child profile, attributed to the signed-in account when present."""
    owner = resolve_owner(authorization, x_session_id)
    db = await get_db()
    try:
        row_id = await execute(
            db,
            """INSERT INTO children
               (user_session, user_email, name, age_band, gender, diet_type, allergies, goals, cuisine)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                owner.write_session,
                owner.write_email,
                profile.name,
                profile.age_band.value,
                profile.gender.value,
                profile.diet_type.value,
                json.dumps(profile.allergies),
                json.dumps([g.value for g in profile.goals]),
                profile.cuisine,
            ),
        )
        row = await fetch_one(db, "SELECT * FROM children WHERE id = ?", (row_id,))
        return _row_to_profile(row)
    finally:
        await db.close()


@router.get("/{child_id}", response_model=ChildProfile)
async def get_child(
    child_id: int,
    x_session_id: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    owner = resolve_owner(authorization, x_session_id)
    db = await get_db()
    try:
        return _row_to_profile(await _owned_child_or_404(db, child_id, owner))
    finally:
        await db.close()


@router.get("/", response_model=list[ChildProfile])
async def list_children(
    x_session_id: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """List the caller's children (account-linked, with legacy session fallback)."""
    owner = resolve_owner(authorization, x_session_id)
    db = await get_db()
    try:
        pred, params = owner.where()
        rows = await fetch_all(
            db,
            f"SELECT * FROM children WHERE {pred} ORDER BY id",
            tuple(params),
        )
        return [_row_to_profile(r) for r in rows]
    finally:
        await db.close()


@router.put("/{child_id}", response_model=ChildProfile)
async def update_child(
    child_id: int,
    update: ChildProfileUpdate,
    x_session_id: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    owner = resolve_owner(authorization, x_session_id)
    db = await get_db()
    try:
        row = await _owned_child_or_404(db, child_id, owner)

        fields = update.model_dump(exclude_none=True)
        if not fields:
            return _row_to_profile(row)

        set_clause = ", ".join(f"{k} = ?" for k in fields)
        values = []
        for k, v in fields.items():
            if isinstance(v, list):
                values.append(json.dumps([i.value if hasattr(i, "value") else i for i in v]))
            elif hasattr(v, "value"):
                values.append(v.value)
            else:
                values.append(v)
        values.append(child_id)

        await execute(db, f"UPDATE children SET {set_clause} WHERE id = ?", tuple(values))
        row = await fetch_one(db, "SELECT * FROM children WHERE id = ?", (child_id,))
        return _row_to_profile(row)
    finally:
        await db.close()


@router.delete("/{child_id}", status_code=204)
async def delete_child(
    child_id: int,
    x_session_id: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Delete one child profile and its scan history. Scoped to the caller."""
    owner = resolve_owner(authorization, x_session_id)
    db = await get_db()
    try:
        await _owned_child_or_404(db, child_id, owner)
        await execute(db, "DELETE FROM scans WHERE child_id = ?", (child_id,))
        await execute(db, "DELETE FROM children WHERE id = ?", (child_id,))
    finally:
        await db.close()
