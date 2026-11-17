#!/usr/bin/env bash
# One-shot demo stack for presentations (~fast train + API + web).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PY="${ROOT}/.venv/bin/python"
PIP="${ROOT}/.venv/bin/pip"

if [[ ! -x "$PY" ]]; then
  python3 -m venv .venv
fi

"$PIP" install -q numpy pandas scikit-learn joblib fastapi uvicorn pydantic

if [[ ! -f data/PhiUSIIL_Phishing_URL_Dataset.csv ]]; then
  bash scripts/download_data.sh
fi

if [[ ! -f models/url_only_best.joblib ]]; then
  echo "Fast training (url_only, 12k rows, 3 models)…"
  PHISHGUARD_TRACKS=url_only \
    PHISHGUARD_MAX_ROWS=12000 \
    PHISHGUARD_MODELS="LogisticRegression (baseline),kNN,DecisionTree" \
    "$PY" -m ml.train
fi

trap 'kill 0' EXIT
echo "API  → http://127.0.0.1:8000"
echo "Web  → http://localhost:3000"
"$PY" -m uvicorn api.main:app --host 127.0.0.1 --port 8000 &
(
  cd web
  if [[ ! -d node_modules ]]; then
    pnpm install --ignore-workspace
  fi
  pnpm exec next dev -p 3000
)