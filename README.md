# PhishGuard

End-to-end phishing URL detection on the [PhiUSIIL Phishing URL dataset](https://archive.ics.uci.edu/dataset/967/phiusiil+phishing+url+dataset) (UCI id **967**). Two modeling tracks:

| Track | Features | Purpose |
| --- | --- | --- |
| **Full-feature** | URL-derived columns from CSV (excludes post-fetch HTML/crawl fields) | Strong offline benchmark without page-content leakage |
| **URL-only** | Lexical features parsed from the raw URL string | Production API, web UI, and Chrome extension |

## Quick start (one command)

```bash
bash scripts/setup.sh
```

Then in two terminals:

```bash
# API (URL-only model)
python3 -m uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload

# Web UI (Geist-style dark theme)
cd web && npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Train models

```bash
bash scripts/download_data.sh
PHISHGUARD_MAX_ROWS=60000 python3 -m ml.train
```

Artifacts:

- `models/url_only_best.joblib` — best URL-only pipeline (joblib)
- `models/training_summary.json` — test metrics & unsupervised summary
- `EXPERIMENTS.md` — comparison table
- `BUILD_LOG.md` — timestamped run log
- `reports/` — permutation importance & SHAP JSON

Evaluation protocol:

- Stratified subsample (configurable via `PHISHGUARD_MAX_ROWS`)
- **Domain-grouped** 80/20 hold-out (no shared host between train & test)
- **StratifiedGroupKFold** (k=5) CV on training split with mean ± std logged

Models compared: majority class & logistic regression baselines; kNN; decision tree; linear SVM; random forest (OOB); AdaBoost; gradient boosting; XGBoost/LightGBM when installed; MLP with early stopping. Unsupervised: PCA, k-means + silhouette, GMM, DBSCAN.

Explainability: permutation importance and SHAP (see `reports/`). Limitations and responsible ML notes are in `EXPERIMENTS.md`.

## Chrome extension

See [extension/README.md](extension/README.md). Load unpacked from `extension/` while the API runs on port 8000.

## Demo assets

- [demo/test_urls.md](demo/test_urls.md) — lookalikes, Safe Browsing test URLs, sample dataset strings
- [demo/pages/](demo/pages/) — harmless local HTML pages mimicking phishing copy (no exfiltration)

## Project layout

```
ml/           Training code & URL feature extractor
api/          FastAPI prediction service
web/          Next.js frontend
extension/    Chrome MV3 extension
demo/         Test URLs & local HTML fixtures
scripts/      setup.sh, download_data.sh
```

## Dataset

PhiUSIIL contains ~235k labeled URLs with lexical and (for many rows) crawled page statistics. We **exclude** crawl/HTML-derived columns from the full-feature track and never use them in the URL-only track, so deployed scoring cannot depend on unavailable live-page features.

## License

See repository license. PhiUSIIL dataset terms apply to downloaded data.
