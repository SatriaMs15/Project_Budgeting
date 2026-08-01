#!/usr/bin/env bash
#
# Run the budgeting app locally.
#   ./run.sh          → dev server with hot reload (default)
#   ./run.sh build    → production build, then start
#
# Handles the usual snags: installs deps if missing, checks required env
# vars, and frees port 3000 if a previous dev server is still holding it.
set -euo pipefail

cd "$(dirname "$0")"

PORT="${PORT:-3000}"
MODE="${1:-dev}"

# --- 1. Dependencies -------------------------------------------------------
if [ ! -d node_modules ]; then
  echo "→ Installing dependencies (first run)…"
  npm install
fi

# --- 2. Environment --------------------------------------------------------
if [ ! -f .env.local ]; then
  echo "✗ .env.local is missing. It needs:"
  echo "    NEXT_PUBLIC_SUPABASE_URL=…"
  echo "    NEXT_PUBLIC_SUPABASE_ANON_KEY=…"
  echo "    GEMINI_API_KEY=…        # optional: enables AI import"
  exit 1
fi

for key in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY; do
  if ! grep -q "^${key}=" .env.local; then
    echo "✗ .env.local is missing ${key}"
    exit 1
  fi
done

if ! grep -q "^GEMINI_API_KEY=" .env.local; then
  echo "⚠ No GEMINI_API_KEY — AI import is off; CSV import still works."
fi

# --- 3. Free the port ------------------------------------------------------
if lsof -ti:"$PORT" >/dev/null 2>&1; then
  echo "→ Port $PORT is in use; stopping the old process…"
  lsof -ti:"$PORT" | xargs kill -9 2>/dev/null || true
  sleep 1
fi

# --- 4. Go -----------------------------------------------------------------
echo "→ Starting the app on http://localhost:$PORT"
echo "  (Reminder: if pages hang, your Supabase project may be paused —"
echo "   unpause it at supabase.com/dashboard.)"
echo

if [ "$MODE" = "build" ]; then
  npm run build
  exec npx next start -p "$PORT"
else
  exec npx next dev -p "$PORT"
fi
