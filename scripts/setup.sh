#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== PhishGuard setup =="

if ! command -v python3 >/dev/null; then
  echo "python3 is required" >&2
  exit 1
fi
if ! command -v node >/dev/null; then
  echo "node is required" >&2
  exit 1
fi

python3 -m pip install -q -r requirements.txt
bash scripts/download_data.sh

if [[ ! -f models/url_only_best.joblib ]]; then
  echo "Training URL-only + full-feature models (set PHISHGUARD_MAX_ROWS to cap sample size)…"
  python3 -m ml.train
else
  echo "Model artifact already present — skip training (delete models/url_only_best.joblib to retrain)."
fi

(
  cd web
  if [[ ! -d node_modules ]]; then
    npm install --silent
  fi
)

cat <<'MSG'

Setup complete.

Start backend:
  cd /workspace && python3 -m uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload

Start frontend:
  cd /workspace/web && npm run dev

Chrome extension (dev):
  1. Open chrome://extensions
  2. Enable Developer mode
  3. Load unpacked → select the extension/ folder

MSG
