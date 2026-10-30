#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="$ROOT/data"
mkdir -p "$DATA_DIR"
ZIP="$DATA_DIR/phiusiil.zip"
CSV="$DATA_DIR/PhiUSIIL_Phishing_URL_Dataset.csv"
if [[ -f "$CSV" ]]; then
  echo "Dataset already present: $CSV"
  exit 0
fi
echo "Downloading PhiUSIIL Phishing URL dataset (UCI id 967)..."
curl -fsSL "https://archive.ics.uci.edu/static/public/967/phiusiil+phishing+url+dataset.zip" -o "$ZIP"
unzip -o -q "$ZIP" -d "$DATA_DIR"
rm -f "$ZIP"
echo "Saved: $CSV"
