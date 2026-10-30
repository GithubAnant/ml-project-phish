# PhishGuard Build Log

Chronological record of implementation decisions and training results.

## Log
- `2026-10-30 07:06:18 UTC` — Training `LinearSVM` on url_only track…
- `2026-10-30 07:06:18 UTC` — url_only/DecisionTree: test acc=99.52%, CV acc=99.55%±0.02%
- `2026-10-30 07:05:58 UTC` — Training `DecisionTree` on url_only track…
- `2026-10-30 07:05:58 UTC` — url_only/kNN: test acc=99.33%, CV acc=99.35%±0.01%
- `2026-10-30 07:05:05 UTC` — Training `kNN` on url_only track…
- `2026-10-30 07:05:01 UTC` — url_only/LogisticRegression (baseline): test acc=99.34%, CV acc=99.41%±0.01%
- `2026-10-30 07:04:38 UTC` — Training `LogisticRegression (baseline)` on url_only track…
- `2026-10-30 07:04:38 UTC` — url_only/MajorityClass (baseline): test acc=57.19%, CV acc=57.19%±0.00%
- `2026-10-30 07:04:18 UTC` — Training `MajorityClass (baseline)` on url_only track…
- `2026-10-30 07:04:12 UTC` — === Track: url_only ===
- `2026-10-30 07:04:12 UTC` — Using stratified sample of 175795 rows (PHISHGUARD_MAX_ROWS=60000).
- `2026-10-30 07:04:12 UTC` — Loaded 235795 rows from PhiUSIIL dataset.
- `2026-10-30 07:04:12 UTC` — Starting training run.
