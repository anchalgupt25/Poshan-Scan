#!/usr/bin/env bash
# Nouri Scan — one-command launcher
#
# First run: installs both backend (Python via uv) and frontend (npm) deps.
# Subsequent runs: skips install and just starts both servers.
#
# Backend: FastAPI on http://localhost:8000
# Frontend: Vite on http://localhost:5173

set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

# Locate uv (fallback to pip if uv is missing)
UV_BIN="$(command -v uv || true)"
[ -z "$UV_BIN" ] && [ -x "$HOME/.langflow/uv/uv" ] && UV_BIN="$HOME/.langflow/uv/uv"

# ─── Backend setup ───────────────────────────────────────────
if [ ! -d ".venv" ]; then
  echo "📦 Setting up backend Python env..."
  if [ -n "$UV_BIN" ]; then
    "$UV_BIN" venv
    "$UV_BIN" pip install -e .
  else
    python3 -m venv .venv
    .venv/bin/python -m pip install -e .
  fi
fi

# ─── Frontend setup ──────────────────────────────────────────
if [ ! -d "frontend/node_modules" ]; then
  echo "📦 Installing frontend deps..."
  cd frontend && npm install && cd ..
fi

# ─── Launch both ─────────────────────────────────────────────
echo ""
echo "🚀 Starting Nouri Scan..."
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:8000  (docs at /docs)"
echo ""

# Start backend in background, frontend in foreground
.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload &
BACKEND_PID=$!

trap "echo 'Stopping...'; kill $BACKEND_PID 2>/dev/null; exit 0" INT TERM

cd frontend && npm run dev
