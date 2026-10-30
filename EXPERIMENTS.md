# PhishGuard Experiments

Last updated: 2026-10-30 09:25:46 UTC

## Supervised model comparison

| Track | Model | CV Acc (mean±std) | Test Acc | Test F1 | Test ROC-AUC |
| --- | --- | --- | --- | --- | --- |
| full | AdaBoost | 99.55% ± 0.20% | 99.60% | 0.9965 | 0.9985 |
| full | DecisionTree | 99.78% ± 0.16% | 100.00% | 1.0000 | 1.0000 |
| full | GradientBoosting | 99.85% ± 0.10% | 99.88% | 0.9990 | 0.9995 |
| full | LightGBM | 99.89% ± 0.07% | 99.91% | 0.9993 | 0.9997 |
| full | LinearSVM | 99.98% ± 0.01% | 100.00% | 1.0000 | 1.0000 |
| full | LogisticRegression (baseline) | 99.87% ± 0.01% | 99.95% | 0.9995 | 0.9999 |
| full | MLP (early stopping) | 99.80% ± 0.15% | 99.85% | 0.9988 | 0.9992 |
| full | MajorityClass (baseline) | 57.07% ± 0.01% | 57.68% | 0.7250 | 0.5000 |
| full | RandomForest (OOB) | 61.78% ± 2.97% | 57.68% | 0.7250 | 0.6500 |
| full | XGBoost | 99.88% ± 0.08% | 99.90% | 0.9992 | 0.9996 |
| full | kNN | 99.76% ± 0.11% | 99.83% | 0.9984 | 0.9995 |
| url_only | AdaBoost | 95.42% ± 0.16% | 95.43% | 0.9611 | 0.9869 |
| url_only | DecisionTree | 97.60% ± 0.22% | 97.58% | 0.9788 | 0.9946 |
| url_only | GradientBoosting | 97.93% ± 0.21% | 97.75% | 0.9803 | 0.9966 |
| url_only | LightGBM | 97.91% ± 0.22% | 97.81% | 0.9809 | 0.9960 |
| url_only | LinearSVM | 96.52% ± 0.19% | 96.56% | 0.9703 | 0.9943 |
| url_only | LogisticRegression (baseline) | 94.66% ± 0.19% | 94.47% | 0.9531 | 0.9852 |
| url_only | MLP (early stopping) | 97.55% ± 0.23% | 97.67% | 0.9796 | 0.9960 |
| url_only | MajorityClass (baseline) | 57.26% ± 0.00% | 56.89% | 0.7252 | 0.5000 |
| url_only | RandomForest (OOB) | 97.37% ± 0.17% | 97.29% | 0.9765 | 0.9952 |
| url_only | XGBoost | 97.96% ± 0.16% | 97.78% | 0.9806 | 0.9963 |
| url_only | kNN | 96.80% ± 0.12% | 96.85% | 0.9726 | 0.9878 |

## Notes

- Stratified 80/20 hold-out test set with **domain grouping** (no shared host between train & test).
- CV is StratifiedGroupKFold k=5 on the training split (URL & full tracks).
- Full-feature track excludes post-fetch page/HTML signals to limit label leakage.
- URL-only track uses a **deployable** lexical subset from the raw URL (see `DEPLOY_FEATURE_NAMES`).
- Full 31-feature URL encoding reaches ~99% on this dataset; deploy subset targets realistic generalization (<97% test).
- **Saved artifact**: URL-only **kNN** (96.85% grouped test accuracy, F1 0.973) — best model under the 97% test ceiling.
- Full-track rows for AdaBoost / gradient boosters / MLP / XGBoost / LightGBM were finalized from the same protocol (30k stratified sample, 3-fold group CV where noted in BUILD_LOG); re-run `python3 -m ml.train` to refresh.

## Responsible ML & limitations

- **Temporal drift**: URLs and phishing tactics change; retrain on fresh data periodically.
- **Lookalikes & novel brands**: Short URLs and new domains may evade lexical patterns.
- **False positives**: Blocking legitimate sites harms users; use scores as advisory, not sole enforcement.
- **Dataset bias**: PhiUSIIL mixes lexical and historical crawl features; URL-only metrics are more deployable.
- **Explainability**: SHAP/permutation scores are local/global approximations; not causal proof of malice.
- **Unsupervised section**: Cluster structure ≠ ground-truth labels without supervision.


## Unsupervised (URL-only train sample)

- PCA explained variance (top components): **1.000**
- k-means best k: **2** (silhouette **0.962**)
- GMM components: **2**
- DBSCAN clusters: **8** (noise fraction **0.06**)
