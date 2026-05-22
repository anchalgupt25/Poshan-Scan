# 🌿 Poshan Scan

> **Scan packaged food labels. Get an instant, age-appropriate nutrition score for your child.**

A mobile-first PWA that lets parents scan a barcode (or photo) and immediately know if the product is appropriate for their child's age, diet, and allergies — backed by USDA FoodData Central and Open Food Facts, scored against USDA DRI, AAP, and WHO guidelines.

> ⚕️ **Disclaimer:** All output is educational information only — not medical advice. Always consult your paediatrician.

---

## ✨ Features

- **Barcode scanner** — ZXing-powered, works in-browser camera
- **Photo scan** — OCR label scanning fallback (ML Kit-style)
- **Manual search** — Text search across 4M+ products
- **Age-aware scoring** — Different thresholds for 6–12mo, 1–2yr, 2–4yr, 4–6yr
- **Ingredient watchlist** — Honey (under 1yr), artificial dyes, trans fats, BVO, potassium bromate, and more
- **Allergen alerts** — Flags your child's known allergens
- **Child profiles** — Multiple children, gender, diet type (veg/non-veg/vegan), allergies
- **Scan history** — Per-child history with give/skip decision logging
- **Offline-first** — Demo product bank for 25 US+Indian products when APIs are unreachable
- **PWA** — Installable on iPhone/Android home screen

---

## 🏗️ Architecture

```
poshan-scan/
├── backend/                  # FastAPI (Python 3.11+)
│   ├── api/routes/
│   │   ├── scan.py           # Barcode, OCR, search, history endpoints
│   │   └── children.py       # Child profile CRUD
│   ├── core/
│   │   ├── scoring/
│   │   │   ├── engine.py     # Deterministic scoring engine (no LLM needed)
│   │   │   └── dimensions.py # Nutrition / ingredients / processing / age-safety
│   │   └── data/
│   │       ├── dri_targets.json          # USDA DRI by age band
│   │       └── ingredient_watchlist.json # AAP + WHO flagged ingredients
│   ├── services/
│   │   ├── product_resolver.py  # Unified lookup chain (cache→OFF→USDA→demo)
│   │   ├── open_food_facts.py   # OFF API v2 client (3M+ global products)
│   │   ├── usda_fdc.py          # USDA FoodData Central client (1M US branded)
│   │   └── demo_products*.py    # Offline fallback bank
│   ├── models/               # Pydantic models: Product, Child, Score
│   ├── db/database.py        # SQLite via aiosqlite (zero-config)
│   └── main.py               # FastAPI app entry point
│
└── frontend/                 # Vanilla JS + Vite PWA
    ├── src/
    │   ├── app/              # Main app, profile, result screens
    │   ├── scanner/          # Barcode + photo scan logic
    │   └── api/client.js     # Backend API client
    └── index.html            # Single-page PWA shell
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- `uv` (recommended) or `pip`

### 1. Backend

```bash
cd backend

# Install dependencies
uv venv && source .venv/bin/activate
uv pip install -e .

# Configure environment
cp .env.example .env
# Edit .env — add your USDA FDC API key (free, see below)

# Start the API server
./start.sh
# or: python -m uvicorn backend.main:app --reload (from repo root)
```

Backend runs at **http://localhost:8000** · API docs at **http://localhost:8000/docs**

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at **http://localhost:5173**

---

## 🔐 Email-OTP auth + invite codes

Closed-beta gate: only people with a valid invite code can sign up. After the first sign-in, returning visitors get a 30-day session.

**Flow:** email + invite code → 6-digit OTP via email → 30-day session token.

### Setup

1. **Resend (email delivery)** — sign up at https://resend.com (free 100/day, no card). Settings → API Keys → Create. Paste into `backend/.env` as `RESEND_API_KEY=re_...`. Without a key, OTPs print to the backend console (dev mode).
2. **Invite codes** — edit `INVITE_CODES` in `backend/.env`. Comma-separated, case-insensitive. Share with beta testers.
3. **Auth secret** — `AUTH_SECRET` is auto-generated on first install. **Regenerate for production:**
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(48))"
   ```

### Endpoints

| Endpoint | Purpose |
|---|---|
| `POST /auth/request-otp` `{email, invite_code}` | Validates invite, sends 6-digit OTP, returns `{ok, expires_in_minutes, delivery}` |
| `POST /auth/verify-otp` `{email, code}` | Returns `{token, email}` on success |
| `GET  /auth/me` `Authorization: Bearer <token>` | Returns `{email, authenticated}` |
| `POST /auth/logout` | No-op server-side; frontend just discards the token |

Rate limit: max 5 OTP requests per email per hour. OTP TTL: 10 minutes.

---

## 🔑 API Keys

### USDA FoodData Central (recommended, free)
- **Get key:** https://fdc.nal.usda.gov/api-guide.html#bkmk-1
- **Rate:** 1,000 req/hour with key vs 30/min on `DEMO_KEY`
- **Coverage:** ~1M US branded foods with UPC barcodes (FDA/USDA regulated labels)
- Add to `backend/.env` as `USDA_FDC_API_KEY=your_key`

### Open Food Facts (no key needed!)
- **Coverage:** 3M+ products globally — US grocery, Indian packaged foods, EU, and more
- **Bonus:** NOVA group, additives/E-numbers, allergen tags built in
- Just make sure you're not behind a proxy that blocks `world.openfoodfacts.org`

---

## 🚀 Deploy to Render (one-time, ~10 min)

This repo ships with `render.yaml` — a Render Blueprint that deploys both services for free.

### Step 1 — Push to GitHub

```bash
# First-time setup (one of these):
brew install gh && gh auth login
# OR generate a Personal Access Token at github.com/settings/tokens (scope: repo)

git push -u origin nouri-scan-react
```

### Step 2 — Sign up for Render

Go to https://render.com → "Sign in with GitHub" → grant access to the `Poshan-Scan` repo.

### Step 3 — Create the Blueprint

1. From the Render dashboard: **New** → **Blueprint**
2. Pick the `Poshan-Scan` repo and the `nouri-scan-react` branch
3. Render reads `render.yaml` and shows two pending services: `nouri-scan-api` and `nouri-scan`
4. Click **Apply** — both will start building

### Step 4 — Add your secrets

After the first build starts, open `nouri-scan-api` service → **Environment** tab and paste:

| Key | Value |
|---|---|
| `USDA_FDC_API_KEY` | Your USDA key |
| `ANTHROPIC_API_KEY` | Your `sk-ant-...` key |
| `RESEND_API_KEY` | Your `re_...` key |
| `INVITE_CODES` | e.g. `NOURI-FAMILY,NOURI-BETA,POSHAN-2026` |
| `FRONTEND_URL` | (fill in after Step 5) |

`AUTH_SECRET` is generated automatically by Render — leave it alone.

### Step 5 — Wire the frontend to the API

After both services finish their first build, you'll get URLs like:
- API:  `https://nouri-scan-api.onrender.com`
- Site: `https://nouri-scan.onrender.com`

Now back-link them:
1. **API service → Environment**: set `FRONTEND_URL=https://nouri-scan.onrender.com` (no trailing slash). Save → it'll redeploy.
2. **Frontend service → Environment**: set `VITE_API_BASE_URL=https://nouri-scan-api.onrender.com`. Save → it'll rebuild.

Wait ~3 minutes for both redeploys to finish.

### Step 6 — Share the link

Open `https://nouri-scan.onrender.com` → enter your invite code → sign in. Share the URL + one of the invite codes with anyone you want to give beta access to.

### Free-tier caveats

- **Backend sleeps after 15 min** of inactivity. First visitor after a sleep waits ~30s for cold start. After that, it's snappy. Not a problem for casual beta testers — paid tier ($7/mo) eliminates this if you go bigger.
- **SQLite on disk** persists across restarts (1 GB free). For very high write volumes, swap to Render Postgres free tier later.
- **Email delivery**: Resend free is 100/day — easily covers a closed beta. They block bounces, so use real emails.

### Cost projection

| Stage | Render | Resend | Anthropic | Total |
|---|---|---|---|---|
| Closed beta (5-20 users) | $0 (free) | $0 | ~$0.50/mo | ~$0.50/mo |
| Public soft-launch (~500 users) | $7/mo (paid plan) | $0 | ~$5/mo | ~$12/mo |

---

## 📊 Scoring Engine

Pure deterministic Python — no LLM required. Weights per PRD:

| Dimension | Weight | What it measures |
|---|---|---|
| Nutrition | 35% | Sodium, iron, calcium, zinc, protein vs USDA DRI for age |
| Ingredients | 35% | Watchlist hits, added sugar, artificial additives |
| Processing | 20% | NOVA group (1=unprocessed → 4=ultra-processed) |
| Age Safety | 10% | Age-specific threshold violations |

**Hard gates** (score capped at 40 regardless of nutrition):
- Honey (under 1 year)
- Partially hydrogenated oils (trans fats)
- Brominated vegetable oil (BVO)
- Potassium bromate
- Whole nuts (under 4 years)

**Grade bands:** A (≥80) · B (≥65) · C (≥45) · D (<45)

---

## 🌐 Product Resolution Chain

Every barcode lookup goes through:

```
1. SQLite cache          → instant, no network
2. Open Food Facts       → 3M+ global, NOVA + additives
3. USDA FoodData Central → 1M US branded, authoritative nutrition
4. Demo product bank     → offline fallback (25 US+Indian products)
```

Search uses the same chain (OFF first, then USDA, then demo).

---

## 🛠️ Development Notes

### Offline / Demo Mode
Set `POSHAN_DEMO_MODE=1` in `.env` to skip real API calls. Great for:
- Working on restricted corporate networks
- UI development without burning API rate limits

### Proxy Support
Both API clients respect `HTTP_PROXY` / `HTTPS_PROXY` environment variables:
```env
HTTP_PROXY=http://proxy.example.com:8080
HTTPS_PROXY=http://proxy.example.com:8080
```

### Database
Zero-config SQLite at `backend/poshan.sqlite` (git-ignored). Schema auto-creates on first run. Additive column migrations run safely on every startup.

### Adding More Products to Demo Bank
Edit `backend/services/demo_products_in.py` (Indian products) or `demo_products_us.py` (US products).

---

## 🗺️ Roadmap

- [ ] LLM narration layer (Claude via Element LLM Gateway) for richer verdict text
- [ ] Full OCR nutrition panel parsing (currently ingredient-flags only)
- [ ] Barcode image upload for server-side decode
- [ ] Comparison mode (scan two products side by side)
- [ ] Weekly nutrition summary across scan history
- [ ] Push notifications for recalled products

---

## 📚 Data Sources & References

- [USDA FoodData Central](https://fdc.nal.usda.gov/) — branded food nutrition data
- [Open Food Facts](https://world.openfoodfacts.org/) — global crowd-sourced product database
- [USDA Dietary Reference Intakes](https://www.nal.usda.gov/human-nutrition-and-food-safety/dri-calculator) — DRI targets by age/gender
- [AAP Nutrition Guidelines](https://publications.aap.org/pediatrics) — age-specific food safety thresholds
- [WHO NOVA Classification](https://www.who.int/) — food processing level scoring

---

## 🐶 Built with

FastAPI · Pydantic · aiosqlite · httpx · Vite · ZXing · Tailwind CSS

---

*Educational information only — not medical advice.*
