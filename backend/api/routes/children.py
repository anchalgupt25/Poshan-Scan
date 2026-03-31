"""Child profile CRUD endpoints."""
from __future__ import annotations

import json
from fastapi import APIRouter, HTTPException, Header
from typing import Optional

from ...models.child import ChildProfileCreate, ChildProfile, ChildProfileUpdate
from ...db.database import get_db, fetch_one, fetch_all, execute, decode_json_field

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


@router.post("/", response_model=ChildProfile, status_code=201)
async def create_child(
    profile: ChildProfileCreate,
    x_session_id: Optional[str] = Header(default=None),
):
    """Create a child profile. Session ID used as anonymous user identifier."""
    session = x_session_id or "anonymous"
    db = await get_db()
    try:
        row_id = await execute(
            db,
            """INSERT INTO children
               (user_session, name, age_band, gender, diet_type, allergies, goals, cuisine)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                session,
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
async def get_child(child_id: int, x_session_id: Optional[str] = Header(default=None)):
    db = await get_db()
    try:
        row = await fetch_one(db, "SELECT * FROM children WHERE id = ?", (child_id,))
        if not row:
            raise HTTPException(status_code=404, detail="Child not found")
        return _row_to_profile(row)
    finally:
        await db.close()


@router.get("/", response_model=list[ChildProfile])
async def list_children(x_session_id: Optional[str] = Header(default=None)):
    """List all children for the current session."""
    session = x_session_id or "anonymous"
    db = await get_db()
    try:
        rows = await fetch_all(db, "SELECT * FROM children WHERE user_session = ?", (session,))
        return [_row_to_profile(r) for r in rows]
    finally:
        await db.close()


@router.put("/{child_id}", response_model=ChildProfile)
async def update_child(
    child_id: int,
    update: ChildProfileUpdate,
    x_session_id: Optional[str] = Header(default=None),
):
    db = await get_db()
    try:
        row = await fetch_one(db, "SELECT * FROM children WHERE id = ?", (child_id,))
        if not row:
            raise HTTPException(status_code=404, detail="Child not found")

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
async def delete_child(child_id: int):
    db = await get_db()
    try:
        await execute(db, "DELETE FROM children WHERE id = ?", (child_id,))
        await execute(db, "DELETE FROM scans WHERE child_id = ?", (child_id,))
    finally:
        await db.close()
