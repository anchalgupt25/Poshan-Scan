#!/usr/bin/env bash
# Start Poshan Scan backend — run from poshan-scan root OR from this dir.
# Usage: ./backend/start.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR" || exit 1
"$SCRIPT_DIR/.venv/bin/python" -m uvicorn backend.main:app \n  --host 127.0.0.1 --port 8000 --reload