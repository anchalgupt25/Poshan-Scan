"""Nouri chat endpoint — AI nutritionist bot for post-scan Q&A.

Two contexts:
  result  → parent just saw a scan score; bot explains it
  home    → parent reviewing history; bot surfaces patterns

LLM flow:
  1. Build rich system prompt from child profile + scan + history.
  2. POST to Element LLM Gateway (if ELEMENT_LLM_API_KEY is set).
  3. On failure / missing key  → intelligent rule-based fallback engine.

Disclaimer: all output is educational information only — not medical advice.
"""
from __future__ import annotations

import json
import os
import re
from typing import Any

import httpx
from fastapi import APIRouter

from ...db.database import get_db, fetch_one, decode_json_field
from ...models.child import ChildProfile

router = APIRouter(prefix="/nouri", tags=["nouri"])

_LLM_API_KEY  = os.getenv("ELEMENT_LLM_API_KEY", "")
_LLM_API_URL  = os.getenv(
    "ELEMENT_LLM_API_URL",
    "https://api.element.walmart.com/v1/chat/completions",
)
_LLM_MODEL    = os.getenv("ELEMENT_LLM_MODEL", "gpt-4o-mini")
_DISCLAIMER   = "Educational information only — not medical advice."

# ─── Route ────────────────────────────────────────────────────────────────────


class ChatRequest:
    """Thin dataclass parsed manually to avoid Pydantic version issues."""

    def __init__(self, body: dict) -> None:
        self.context:      str       = body.get("context", "result")
        self.message:      str       = (body.get("message") or "").strip()
        self.child_id:     int | None = body.get("child_id")
        self.scan_data:    dict | None = body.get("scan_data")
        self.scan_history: list      = body.get("scan_history") or []
        self.history:      list      = body.get("history") or []


from fastapi import Request


@router.post("/chat")
async def nouri_chat(request: Request) -> dict:
    """Accept a chat message and return Nouri's response.

    Returns { text: str, chips: list[str] }.
    """
    body = await request.json()
    req  = ChatRequest(body)

    child = await _load_child(req.child_id)

    # Greet sentinel  (__greet or __greet:flag)
    is_greet   = req.message.startswith("__greet")
    greet_mode = req.message.split(":")[-1] if ":" in req.message else "tab"

    if _LLM_API_KEY:
        try:
            return await _llm_response(req, child, is_greet, greet_mode)
        except Exception:
            pass  # Fall through to rule-based

    return _rule_based_response(req, child, is_greet, greet_mode)


# ─── Child loader ─────────────────────────────────────────────────────────────


async def _load_child(child_id: int | None) -> ChildProfile | None:
    if not child_id:
        return None
    db = await get_db()
    try:
        row = await fetch_one(db, "SELECT * FROM children WHERE id = ?", (child_id,))
        if not row:
            return None
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
    finally:
        await db.close()


# ─── LLM call ────────────────────────────────────────────────────────────────


async def _llm_response(
    req: ChatRequest,
    child: ChildProfile | None,
    is_greet: bool,
    greet_mode: str,
) -> dict:
    system = _build_system_prompt(child, req.scan_data, req.scan_history, req.context)

    messages = [{"role": "system", "content": system}]
    for h in req.history:
        role = "assistant" if h.get("role") == "nouri" else "user"
        messages.append({"role": role, "content": h.get("content", "")})

    user_msg = _greet_user_msg(greet_mode, req.context) if is_greet else req.message
    messages.append({"role": "user", "content": user_msg})

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            _LLM_API_URL,
            headers={"Authorization": f"Bearer {_LLM_API_KEY}", "Content-Type": "application/json"},
            json={
                "model":       _LLM_MODEL,
                "messages":    messages,
                "temperature": 0.4,
                "max_tokens":  400,
            },
        )
        resp.raise_for_status()
        data = resp.json()

    text  = data["choices"][0]["message"]["content"].strip()
    chips = _extract_chips(text) or _default_chips(req.context, req.scan_data)
    # Strip chip block from text if present
    text  = re.sub(r"\[CHIPS\].*$", "", text, flags=re.DOTALL).strip()
    return {"text": text, "chips": chips}


def _greet_user_msg(greet_mode: str, context: str) -> str:
    if context == "home":
        return "Please give me a brief overview of this child's recent scan patterns and what to watch."
    phrases = {
        "flag": "The parent just tapped on a red flag in the scan. Open with what the main concern is.",
        "tab":  "The parent tapped 'Ask Nouri' tab on the result screen. Give an opening summary of the score.",
        "auto": "Auto-open because red flags were detected. Highlight the most urgent concern concisely.",
    }
    return phrases.get(greet_mode, phrases["tab"])


def _build_system_prompt(
    child: ChildProfile | None,
    scan_data: dict | None,
    scan_history: list,
    context: str,
) -> str:
    lines = [
        "You are Nouri, an AI nutritionist assistant inside a children's food safety app.",
        "Tone: informational, empathetic, and clear. Not conversational — do not use filler phrases.",
        "Use bold (**word**) to highlight key numbers, nutrients, or product names.",
        "Keep responses under 80 words. Never diagnose or prescribe.",
        f"Disclaimer appended to every response (internally): {_DISCLAIMER}",
        "",
    ]

    if child:
        goals_str    = ", ".join(child.goals) if child.goals else "none specified"
        allergies_str = ", ".join(child.allergies) if child.allergies else "none"
        lines += [
            f"## Child Profile",
            f"Name: {child.name}",
            f"Age band: {child.age_band}",
            f"Gender: {child.gender}",
            f"Diet type: {child.diet_type}",
            f"Allergies: {allergies_str}",
            f"Health goals: {goals_str}",
            f"Cuisine background: {child.cuisine or 'not specified'}",
            "",
        ]

    if context == "result" and scan_data:
        product = scan_data.get("product") or {}
        score   = scan_data.get("score") or {}
        flags   = score.get("flags") or []
        dims    = score.get("dimensions") or {}
        nutrients = score.get("nutrient_insights") or []

        lines += [
            "## Current Scan",
            f"Product: {product.get('name', 'Unknown')}",
            f"Brand: {product.get('brand', '')}",
            f"Category: {product.get('category', '')}",
            f"Overall score: {score.get('score', 'N/A')}/100",
            f"Grade: {score.get('grade', '?')} — {score.get('grade_label', '')}",
            f"Verdict: {score.get('verdict_text', '')}",
            "",
            "### Flags",
        ]
        for f in flags:
            lines.append(f"- [{f.get('severity','').upper()}] {f.get('title','')} — {f.get('detail','')}")

        lines += ["", "### Score dimensions (0-100)"]
        for k, v in dims.items():
            lines.append(f"- {k}: {v}")

        lines += ["", "### Nutrient insights (top items)"]
        for n in nutrients[:6]:
            pct = f"{n.get('pct_of_daily')}% of daily" if n.get("pct_of_daily") else ""
            lines.append(
                f"- {n.get('name')}: {n.get('value')}{n.get('unit','')} {pct} — status: {n.get('status','')}"
            )
        lines.append("")

    if scan_history:
        lines.append("## Recent Scan History (last scans)")
        for h in scan_history[:8]:
            lines.append(
                f"- {h.get('name','Product')} — score {h.get('score','?')}/100, "
                f"grade {h.get('grade','?')}, flag: {h.get('topFlag') or 'none'}, "
                f"decision: {h.get('decision') or 'undecided'}"
            )
        lines.append("")

    lines += [
        "## Response format",
        "If suggesting follow-up questions, end with exactly this block (3 chips max, short phrases):",
        "[CHIPS]",
        "chip 1",
        "chip 2",
        "chip 3",
    ]

    return "\n".join(lines)


def _extract_chips(text: str) -> list[str]:
    match = re.search(r"\[CHIPS\]\s*(.*?)$", text, re.DOTALL)
    if not match:
        return []
    return [c.strip() for c in match.group(1).strip().splitlines() if c.strip()][:3]


# ─── Rule-based fallback ──────────────────────────────────────────────────────


def _rule_based_response(
    req: ChatRequest,
    child: ChildProfile | None,
    is_greet: bool,
    greet_mode: str,
) -> dict:
    name    = child.name if child else "your child"
    age     = child.age_band if child else ""
    goals   = child.goals if child else []
    scan    = req.scan_data or {}
    product = scan.get("product") or {}
    score   = scan.get("score") or {}
    flags   = score.get("flags") or []
    dims    = score.get("dimensions") or {}
    history = req.scan_history or []

    if req.context == "result":
        return _result_response(
            req.message, name, age, goals, product, score, flags, dims, is_greet, greet_mode
        )
    return _home_response(req.message, name, age, goals, history, is_greet)


def _result_response(
    message: str,
    name: str,
    age: str,
    goals: list,
    product: dict,
    score: dict,
    flags: list,
    dims: dict,
    is_greet: bool,
    greet_mode: str,
) -> dict:
    pname    = product.get("name", "this product")
    sc_num   = score.get("score", 0)
    grade    = score.get("grade", "?")
    verdict  = score.get("verdict_text", "")
    red_flags  = [f for f in flags if f.get("severity") == "red"]
    nutrients  = score.get("nutrient_insights") or []

    # ── Greeting ──────────────────────────────────────────────────────────────
    if is_greet:
        if greet_mode == "flag" and red_flags:
            f0    = red_flags[0]
            title = f0.get("title", "")
            detail = f0.get("detail", "")
            text  = (
                f"The main concern for {name} is <strong>{title}</strong>. "
                f"{detail}"
            )
            chips = _flag_chips(red_flags, flags, goals)
        else:
            grade_note = _grade_note(grade)
            text = (
                f"<strong>Grade {grade} ({sc_num}/100)</strong> for {name}. "
                f"{grade_note} "
                f"{verdict or ''}"
            )
            chips = _tab_chips(red_flags, goals, dims)
        return {"text": text.strip(), "chips": chips}

    # ── Keyword routing ───────────────────────────────────────────────────────
    msg = message.lower()

    if any(w in msg for w in ["sodium", "salt"]):
        sodium = _get_nutrient(nutrients, "sodium")
        limit  = _sodium_limit(age)
        if sodium:
            pct = sodium.get("pct_of_daily", 0) or 0
            return {
                "text": (
                    f"<strong>Sodium</strong> in this product is "
                    f"<strong>{sodium['value']}{sodium.get('unit','mg')}</strong> "
                    f"— about <strong>{pct}% of {name}'s daily limit</strong> ({limit}mg/day for {age}). "
                    f"Kidneys are still developing at this age, so lower-sodium alternatives are worth seeking."
                ),
                "chips": ["What counts as high sodium?", "Best lower-sodium swaps?"],
            }
        return {"text": f"The daily sodium limit for {age} is <strong>{limit}mg</strong>.", "chips": []}

    if any(w in msg for w in ["sugar", "sweet"]):
        sugar = _get_nutrient(nutrients, "sugar") or _get_nutrient(nutrients, "added sugar")
        if sugar:
            return {
                "text": (
                    f"This product has <strong>{sugar['value']}{sugar.get('unit','g')} of sugar</strong> "
                    f"per serving. For {name} at {age}, added sugar provides no nutritional benefit "
                    f"and can displace nutrient-dense foods. Minimising it is recommended by AAP."
                ),
                "chips": ["What's a safe sugar limit?", "How does this compare to other snacks?"],
            }

    if any(w in msg for w in ["iron", "brain"]):
        iron = _get_nutrient(nutrients, "iron")
        brain_goal = any("brain" in g.lower() for g in goals)
        brain_note = " This directly supports your brain development goal." if brain_goal else ""
        if iron:
            return {
                "text": (
                    f"<strong>Iron: {iron['value']}{iron.get('unit','mg')}</strong> "
                    f"— {iron.get('pct_of_daily', 0) or 0}% of daily need.{brain_note} "
                    f"Pairing with vitamin C (e.g. a small piece of fruit) improves iron absorption significantly."
                ),
                "chips": ["Is this iron well-absorbed?", "Other iron-rich foods for this age?"],
            }

    if any(w in msg for w in ["safe", "okay", "ok", "eat", "give"]):
        return {
            "text": (
                f"Grade <strong>{grade}</strong> means "
                f"{'this is a good option' if grade in ('A','B') else 'use occasionally' if grade == 'C' else 'worth avoiding for regular use'}. "
                f"{verdict}"
            ),
            "chips": _flag_chips(red_flags, flags, goals)[:2],
        }

    if any(w in msg for w in ["process", "nova", "ultra"]):
        processing = dims.get("processing", 0)
        return {
            "text": (
                f"The processing score is <strong>{processing}/100</strong>. "
                f"NOVA Group 4 (ultra-processed) products contain industrial ingredients not found in home cooking. "
                f"AAP recommends minimising ultra-processed foods in the first two years for microbiome health."
            ),
            "chips": ["What does NOVA Group mean?", "Is ultra-processed always bad?"],
        }

    if any(w in msg for w in ["score", "grade", "how", "work", "calculate"]):
        return {
            "text": (
                f"The score combines <strong>Nutrition ({dims.get('nutrition',0)})</strong>, "
                f"<strong>Ingredients ({dims.get('ingredients',0)})</strong>, "
                f"<strong>Processing ({dims.get('processing',0)})</strong>, and "
                f"<strong>Age Safety ({dims.get('age_safety',0)})</strong> — "
                f"each weighted against WHO/AAP thresholds for {name}'s age and goals."
            ),
            "chips": ["What lowers the score most?", "What would improve the grade?"],
        }

    # Generic fallback
    return {
        "text": (
            f"Based on {name}'s profile and this product's data, "
            f"the most notable finding is <strong>{red_flags[0]['title'] if red_flags else 'the overall score of ' + str(sc_num) + '/100'}</strong>. "
            f"Ask about a specific nutrient or concern for a more precise answer."
        ),
        "chips": _tab_chips(red_flags, goals, dims)[:3],
    }


def _home_response(
    message: str,
    name: str,
    age: str,
    goals: list,
    history: list,
    is_greet: bool,
) -> dict:
    week_items = _this_week(history)
    with_scores = [h for h in week_items if h.get("score") is not None]
    avg = (
        round(sum(h["score"] for h in with_scores) / len(with_scores))
        if with_scores else None
    )
    flag_counts: dict[str, int] = {}
    for h in week_items:
        tf = h.get("topFlag")
        if tf:
            flag_counts[tf] = flag_counts.get(tf, 0) + 1
    top_flag = max(flag_counts, key=flag_counts.get) if flag_counts else None

    if is_greet:
        if not week_items:
            return {
                "text": (
                    f"No scans yet this week for {name}. "
                    f"Scan a product to start building a nutrition picture."
                ),
                "chips": ["How does scoring work?", "What should I look for?"],
            }
        flag_note = f" <strong>{top_flag}</strong> is the most common concern." if top_flag else ""
        return {
            "text": (
                f"{name}'s scans average <strong>{avg}/100</strong> this week "
                f"across {len(week_items)} product{'s' if len(week_items) != 1 else ''}."
                f"{flag_note}"
            ),
            "chips": [
                "Which products should I swap?",
                f"Is {name} getting enough iron?",
                "What's a good weekly average?",
            ],
        }

    msg = message.lower()

    if any(w in msg for w in ["swap", "replace", "instead", "better", "alternative"]):
        d_items = [h for h in history if h.get("grade") == "D"]
        c_items = [h for h in history if h.get("grade") == "C"]
        priority = (d_items + c_items)[:2]
        if priority:
            names = " and ".join(f"<strong>{p['name']} ({p.get('grade','?')}, {p.get('score','?')}/100)</strong>" for p in priority)
            return {
                "text": (
                    f"Start with {names} — these score lowest. "
                    f"Look for alternatives with no red flags, lower sodium, and minimal ultra-processing."
                ),
                "chips": ["What makes a good replacement?", "Show me an A-grade example"],
            }
        return {
            "text": f"No D-grade products in recent scans for {name}. Current choices look reasonable.",
            "chips": ["What would push scores higher?"],
        }

    if any(w in msg for w in ["iron", "zinc", "calcium", "nutrient"]):
        brain = any("brain" in g.lower() for g in goals)
        if brain:
            return {
                "text": (
                    f"For {name}'s brain development goal, <strong>iron and zinc</strong> are the priority nutrients. "
                    f"Iron need: ~10–11mg/day; zinc: ~3mg/day. "
                    f"For a vegetarian diet, lentils and fortified cereals are key sources."
                ),
                "chips": ["What products cover iron well?", "How much zinc is enough?"],
            }
        return {
            "text": (
                f"Key nutrients for {age}: calcium (700–1000mg/day), iron (7–10mg/day), "
                f"zinc (3mg/day), and vitamin D (600IU/day). "
                f"Scan labels to see how products contribute."
            ),
            "chips": ["Which scanned product had the best nutrients?"],
        }

    if any(w in msg for w in ["pattern", "average", "overall", "week", "trend"]):
        if avg is None:
            return {"text": f"Not enough scans this week to show a pattern for {name}.", "chips": []}
        quality = "strong" if avg >= 70 else "moderate" if avg >= 50 else "worth improving"
        flag_note = f" The main recurring concern is <strong>{top_flag}</strong>." if top_flag else ""
        return {
            "text": (
                f"This week's average for {name} is <strong>{avg}/100</strong> — {quality}.{flag_note} "
                f"Aim for 70+ with no D-grade products for a healthy week."
            ),
            "chips": ["What would push the average up?", "Which was the best scan?"],
        }

    return {
        "text": (
            f"Based on {name}'s scan history, "
            f"{'the average is ' + str(avg) + '/100 this week. ' if avg else ''}"
            f"Ask about a specific nutrient, product, or pattern for more detail."
        ),
        "chips": ["What are the main concerns?", "Which products are best?"],
    }


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _get_nutrient(nutrients: list, name: str) -> dict | None:
    name_lower = name.lower()
    for n in nutrients:
        if name_lower in (n.get("name") or "").lower():
            return n
    return None


def _sodium_limit(age_band: str) -> int:
    band = age_band.lower()
    if "6" in band and "12" in band:
        return 370
    if "1" in band and "2" in band:
        return 800
    if "2" in band and "4" in band:
        return 1000
    return 1200


def _grade_note(grade: str) -> str:
    notes = {
        "A": "A strong choice.",
        "B": "A reasonable option with minor notes.",
        "C": "Occasional use is fine — not ideal as a staple.",
        "D": "Worth avoiding or keeping very infrequent.",
    }
    return notes.get((grade or "C").upper(), "")


def _flag_chips(red_flags: list, all_flags: list, goals: list) -> list[str]:
    chips: list[str] = []
    if red_flags:
        chips.append(f"Why is {red_flags[0].get('title','this')[:30]} a concern?")
    if len(red_flags) > 1:
        chips.append(f"What about {red_flags[1].get('title','the other flag')[:30]}?")
    if any("brain" in g.lower() for g in goals):
        chips.append("Does brain development goal change the score?")
    elif any("immun" in g.lower() for g in goals):
        chips.append("How does this affect immunity?")
    return chips[:3]


def _tab_chips(red_flags: list, goals: list, dims: dict) -> list[str]:
    chips: list[str] = []
    if red_flags:
        chips.append(f"What are the main concerns?")
    lowest_dim = min(dims, key=dims.get) if dims else None
    if lowest_dim:
        chips.append(f"Why did {lowest_dim} score low?")
    chips.append("What would an A-grade look like?")
    return chips[:3]


def _default_chips(context: str, scan_data: dict | None) -> list[str]:
    if context == "result":
        return ["What are the main concerns?", "Is this safe for their age?", "What would improve the grade?"]
    return ["What patterns do you see?", "Which products should I swap?", "How is nutrition overall?"]


def _this_week(history: list) -> list:
    from datetime import datetime, timedelta, timezone
    cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    return [h for h in history if (h.get("time") or "") >= cutoff]
