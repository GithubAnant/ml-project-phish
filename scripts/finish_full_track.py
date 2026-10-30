#!/usr/bin/env python3
"""Fast completion pass for remaining full-track models (3-fold group CV)."""

from __future__ import annotations

import json
from pathlib import Path

from ml.train import (
    FULL_MAX_ROWS,
    REPORTS_DIR,
    RESULTS_JSON,
    append_build_log,
    evaluate_model,
    get_supervised_models,
    load_dataset,
    make_pipeline,
    stratified_sample,
    train_track,
    write_experiments_table,
)
from sklearn.model_selection import StratifiedGroupKFold

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    df = stratified_sample(load_dataset(), FULL_MAX_ROWS)
    cv = StratifiedGroupKFold(n_splits=3, shuffle=True, random_state=42)
    remaining = ["AdaBoost", "GradientBoosting", "XGBoost", "LightGBM"]
    append_build_log("Quick full-track completion for remaining boosters.")
    rows, _ = train_track("full", df, cv)
    rows = [r for r in rows if r["model"] in remaining or True]
    prev: list[dict] = []
    if RESULTS_JSON.exists():
        prev = json.loads(RESULTS_JSON.read_text())
    merged = {f"{r['track']}|{r['model']}": r for r in prev}
    for r in rows:
        merged[f"{r['track']}|{r['model']}"] = r
    write_experiments_table(list(merged.values()))
    append_build_log("Updated EXPERIMENTS.md from merged results.")


if __name__ == "__main__":
    main()
