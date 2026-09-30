"""Row ownership resolution.

Historically `children.user_session` / `scans.user_session` held a random id
generated in the browser's localStorage. That worked for a single-browser web
beta but breaks badly for a native app: reinstalling regenerates the id, so the
user silently loses every child profile and scan. It also made account deletion
impossible to implement correctly, because there was no link from an email to
its rows.

The fix is additive rather than a hard cutover:

  * every new row records `user_email` (when the request is authenticated)
  * reads match on `user_email` OR the legacy `user_session`
  * nothing is deleted, and the existing web beta keeps working untouched

Once the legacy rows have aged out, the `user_session` half of the predicate
can be dropped.
"""
from __future__ import annotations

from typing import Optional

from ...services.auth_tokens import verify_token


def bearer_email(authorization: Optional[str]) -> Optional[str]:
    """Extract a verified email from an Authorization header, or None."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    payload = verify_token(authorization[7:].strip())
    email = (payload or {}).get("sub")
    return email.strip().lower() if email else None


class Owner:
    """Who a request belongs to, and how to match their rows.

    `email` is the durable identity (may be None for unauthenticated requests).
    `session` is the legacy per-browser id, still honoured for old rows.
    """

    __slots__ = ("email", "session")

    def __init__(self, email: Optional[str], session: Optional[str]):
        self.email = email
        self.session = session or "anonymous"

    # ─── Write side ───────────────────────────────────────────────────────

    @property
    def write_email(self) -> Optional[str]:
        """Value to store in the user_email column on insert."""
        return self.email

    @property
    def write_session(self) -> str:
        """Value to store in the legacy user_session column on insert.

        Still written so that a signed-out web session behaves as before, and
        so rollback to the previous code path stays possible.
        """
        return self.session

    # ─── Read side ────────────────────────────────────────────────────────

    def where(self, table_alias: str = "") -> tuple[str, list]:
        """Build a SQL predicate + params matching this owner's rows.

        Returns e.g. ("(user_email = ? OR user_session = ?)", ["a@b.com", "sess-x"])
        or, when unauthenticated, ("user_session = ?", ["sess-x"]).
        """
        p = f"{table_alias}." if table_alias else ""
        if self.email:
            return (
                f"({p}user_email = ? OR {p}user_session = ?)",
                [self.email, self.session],
            )
        return (f"{p}user_session = ?", [self.session])

    def __repr__(self) -> str:  # pragma: no cover - debug aid
        return f"Owner(email={self.email!r}, session={self.session!r})"


def resolve_owner(
    authorization: Optional[str] = None,
    x_session_id: Optional[str] = None,
) -> Owner:
    """Build an Owner from the request's auth header and session header."""
    return Owner(bearer_email(authorization), x_session_id)
