"""Train & evaluate PhishGuard models (full-feature and URL-only tracks)."""

from __future__ import annotations

import json
import os
import warnings
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.cluster import DBSCAN, KMeans
from sklearn.compose import ColumnTransformer
from sklearn.decomposition import PCA
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import (
    AdaBoostClassifier,
    GradientBoostingClassifier,
    RandomForestClassifier,
)
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.mixture import GaussianMixture
from sklearn.model_selection import StratifiedKFold, cross_validate, train_test_split
from sklearn.neighbors import KNeighborsClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.svm import LinearSVC
from sklearn.tree import DecisionTreeClassifier
from sklearn.inspection import permutation_importance

from ml.data import load_dataset, prepare_full_features, prepare_url_only
from ml.url_features import URLFeatureExtractor

warnings.filterwarnings("ignore", category=UserWarning)

ROOT = Path(__file__).resolve().parents[1]
MODELS_DIR = ROOT / "models"
REPORTS_DIR = ROOT / "reports"
BUILD_LOG = ROOT / "BUILD_LOG.md"
EXPERIMENTS = ROOT / "EXPERIMENTS.md"

RANDOM_STATE = 42
TEST_SIZE = 0.2
N_SPLITS = 5
MAX_ROWS = int(os.environ.get("PHISHGUARD_MAX_ROWS", "80000"))


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")


def append_build_log(message: str) -> None:
    line = f"- `{_utc_now()}` — {message}\n"
    if BUILD_LOG.exists():
        content = BUILD_LOG.read_text()
        if "## Log" in content:
            content = content.replace("## Log\n", f"## Log\n{line}", 1)
        else:
            content += f"\n## Log\n{line}"
        BUILD_LOG.write_text(content)
    else:
        BUILD_LOG.write_text(f"# PhishGuard Build Log\n\n## Log\n{line}")


def _optional_boosters():
    models = {}
    try:
        from xgboost import XGBClassifier

        models["XGBoost"] = XGBClassifier(
            n_estimators=120,
            max_depth=6,
            learning_rate=0.1,
            subsample=0.8,
            colsample_bytree=0.8,
            eval_metric="logloss",
            random_state=RANDOM_STATE,
            n_jobs=-1,
        )
    except ImportError:
        pass
    try:
        from lightgbm import LGBMClassifier

        models["LightGBM"] = LGBMClassifier(
            n_estimators=120,
            max_depth=-1,
            learning_rate=0.1,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=RANDOM_STATE,
            n_jobs=-1,
            verbose=-1,
        )
    except ImportError:
        pass
    return models


def build_full_pipeline(X: pd.DataFrame) -> Pipeline:
    cat_cols = [c for c in X.columns if X[c].dtype == object]
    num_cols = [c for c in X.columns if c not in cat_cols]

    numeric = Pipeline(
        [
            ("imputer", SimpleImputer(strategy="median")),
            ("scale", StandardScaler()),
        ]
    )
    categorical = Pipeline(
        [
            ("imputer", SimpleImputer(strategy="most_frequent")),
            (
                "onehot",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
            ),
        ]
    )
    preprocess = ColumnTransformer(
        [
            ("num", numeric, num_cols),
            ("cat", categorical, cat_cols),
        ]
    )
    return preprocess


def get_supervised_models(track: str) -> dict:
    models = {
        "MajorityClass (baseline)": DummyClassifier(strategy="most_frequent"),
        "LogisticRegression (baseline)": LogisticRegression(
            max_iter=500, random_state=RANDOM_STATE, n_jobs=-1
        ),
        "kNN": KNeighborsClassifier(n_neighbors=11, weights="distance", n_jobs=-1),
        "DecisionTree": DecisionTreeClassifier(
            max_depth=18, min_samples_leaf=20, random_state=RANDOM_STATE
        ),
        "LinearSVM": LinearSVC(max_iter=3000, random_state=RANDOM_STATE),
        "RandomForest (OOB)": RandomForestClassifier(
            n_estimators=120,
            max_depth=20,
            min_samples_leaf=5,
            oob_score=True,
            random_state=RANDOM_STATE,
            n_jobs=-1,
        ),
        "AdaBoost": AdaBoostClassifier(
            n_estimators=80, learning_rate=0.6, random_state=RANDOM_STATE
        ),
        "GradientBoosting": GradientBoostingClassifier(
            n_estimators=100, max_depth=5, learning_rate=0.1, random_state=RANDOM_STATE
        ),
        "MLP (early stopping)": MLPClassifier(
            hidden_layer_sizes=(128, 64),
            max_iter=200,
            early_stopping=True,
            validation_fraction=0.1,
            n_iter_no_change=8,
            random_state=RANDOM_STATE,
        ),
    }
    models.update(_optional_boosters())
    if track == "url_only":
        # Slightly shallower trees to avoid overfitting URL-only signal
        models["DecisionTree"] = DecisionTreeClassifier(
            max_depth=12, min_samples_leaf=30, random_state=RANDOM_STATE
        )
    return models


def make_pipeline(preprocess, estimator) -> Pipeline:
    return Pipeline([("preprocess", preprocess), ("model", estimator)])


def evaluate_model(pipe, X_train, y_train, X_test, y_test, cv) -> dict:
    scoring = {
        "accuracy": "accuracy",
        "precision": "precision",
        "recall": "recall",
        "f1": "f1",
        "roc_auc": "roc_auc",
    }
    cv_res = cross_validate(
        pipe, X_train, y_train, cv=cv, scoring=scoring, n_jobs=-1, error_score="raise"
    )
    pipe.fit(X_train, y_train)
    y_pred = pipe.predict(X_test)
    if hasattr(pipe, "predict_proba"):
        y_score = pipe.predict_proba(X_test)[:, 1]
    elif hasattr(pipe.named_steps["model"], "decision_function"):
        y_score = pipe.decision_function(X_test)
    else:
        y_score = y_pred.astype(float)

    try:
        test_roc_auc = float(roc_auc_score(y_test, y_score))
    except ValueError:
        test_roc_auc = float("nan")

    return {
        "cv_accuracy_mean": float(np.mean(cv_res["test_accuracy"])),
        "cv_accuracy_std": float(np.std(cv_res["test_accuracy"])),
        "cv_f1_mean": float(np.mean(cv_res["test_f1"])),
        "cv_f1_std": float(np.std(cv_res["test_f1"])),
        "test_accuracy": float(accuracy_score(y_test, y_pred)),
        "test_precision": float(precision_score(y_test, y_pred, zero_division=0)),
        "test_recall": float(recall_score(y_test, y_pred, zero_division=0)),
        "test_f1": float(f1_score(y_test, y_pred, zero_division=0)),
        "test_roc_auc": test_roc_auc,
        "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
        "classification_report": classification_report(y_test, y_pred, digits=4),
        "fitted_pipeline": pipe,
        "y_pred": y_pred,
        "y_score": y_score,
    }


def run_unsupervised(X_matrix: np.ndarray, y_true: np.ndarray) -> dict:
    """PCA + k-means (silhouette) + GMM + DBSCAN on a subsample."""
    from sklearn.metrics import silhouette_score

    rng = np.random.RandomState(RANDOM_STATE)
    n = min(5000, X_matrix.shape[0])
    idx = rng.choice(X_matrix.shape[0], size=n, replace=False)
    Xs = StandardScaler().fit_transform(X_matrix[idx])
    yt = y_true[idx]

    pca = PCA(n_components=min(10, Xs.shape[1]), random_state=RANDOM_STATE)
    Xp = pca.fit_transform(Xs)
    var_ratio = pca.explained_variance_ratio_.sum()

    best_k = 2
    best_sil = -1.0
    sil_scores = {}
    for k in range(2, 8):
        km = KMeans(n_clusters=k, random_state=RANDOM_STATE, n_init=10)
        labels = km.fit_predict(Xp)
        sil = silhouette_score(Xp, labels)
        sil_scores[k] = float(sil)
        if sil > best_sil:
            best_sil = sil
            best_k = k

    gmm = GaussianMixture(n_components=2, random_state=RANDOM_STATE)
    gmm_labels = gmm.fit_predict(Xp)

    db = DBSCAN(eps=1.5, min_samples=25)
    db_labels = db.fit_predict(Xp)
    n_db_clusters = len(set(db_labels)) - (1 if -1 in db_labels else 0)

    return {
        "pca_explained_variance_top10": float(var_ratio),
        "kmeans_best_k": best_k,
        "kmeans_silhouette_by_k": sil_scores,
        "kmeans_best_silhouette": float(best_sil),
        "gmm_n_components": 2,
        "dbscan_n_clusters": int(n_db_clusters),
        "dbscan_noise_fraction": float(np.mean(db_labels == -1)),
        "note": "Unsupervised labels do not match phishing ground truth directly; used for structure exploration.",
        "phishing_rate_in_sample": float(yt.mean()),
    }


def save_explainability(
    name: str,
    pipe: Pipeline,
    X_test,
    y_test,
    track: str,
    out_dir: Path,
) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    model = pipe.named_steps["model"]
    pre = pipe.named_steps["preprocess"]

    try:
        X_t = pre.transform(X_test)
        if hasattr(X_t, "toarray"):
            X_t = X_t.toarray()
        r = permutation_importance(
            model,
            X_t,
            y_test,
            n_repeats=5,
            random_state=RANDOM_STATE,
            n_jobs=-1,
        )
        imp = {
            "model": name,
            "track": track,
            "importance_mean": r.importances_mean.tolist(),
            "importance_std": r.importances_std.tolist(),
        }
        (out_dir / f"perm_importance_{track}_{name.replace(' ', '_')}.json").write_text(
            json.dumps(imp, indent=2)
        )
    except Exception as exc:
        append_build_log(f"Permutation importance skipped for {name}: {exc}")

    try:
        import shap

        X_sample = X_test[:200] if len(X_test) > 200 else X_test
        X_t = pre.transform(X_sample)
        if hasattr(X_t, "toarray"):
            X_t = X_t.toarray()
        if hasattr(model, "predict_proba"):
            explainer = shap.Explainer(model.predict_proba, X_t)
            sv = explainer(X_t)
            # class 1 (phishing)
            vals = np.abs(sv.values[:, :, 1]).mean(axis=0)
            shap_payload = {"model": name, "track": track, "mean_abs_shap_class1": vals.tolist()}
            (out_dir / f"shap_{track}_{name.replace(' ', '_')}.json").write_text(
                json.dumps(shap_payload, indent=2)
            )
    except Exception as exc:
        append_build_log(f"SHAP skipped for {name}: {exc}")


def write_experiments_table(all_results: list[dict]) -> None:
    lines = [
        "# PhishGuard Experiments",
        "",
        f"Last updated: {_utc_now()}",
        "",
        "## Supervised model comparison",
        "",
        "| Track | Model | CV Acc (mean±std) | Test Acc | Test F1 | Test ROC-AUC |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for row in all_results:
        cv = f"{row['cv_accuracy_mean']*100:.2f}% ± {row['cv_accuracy_std']*100:.2f}%"
        lines.append(
            f"| {row['track']} | {row['model']} | {cv} | "
            f"{row['test_accuracy']*100:.2f}% | {row['test_f1']*100:.4f} | "
            f"{row['test_roc_auc']:.4f} |"
        )
    lines.extend(
        [
            "",
            "## Notes",
            "",
            "- Stratified 80/20 hold-out test set; CV is StratifiedKFold k=5 on training split only.",
            "- Full-feature track excludes post-fetch page/HTML signals to limit label leakage.",
            "- URL-only track uses features computed solely from the URL string (production/demo path).",
            "- Target: strong, realistic generalization — test accuracy intentionally not tuned toward 100%.",
            "",
            "## Responsible ML & limitations",
            "",
            "- **Temporal drift**: URLs and phishing tactics change; retrain on fresh data periodically.",
            "- **Lookalikes & novel brands**: Short URLs and new domains may evade lexical patterns.",
            "- **False positives**: Blocking legitimate sites harms users; use scores as advisory, not sole enforcement.",
            "- **Dataset bias**: PhiUSIIL mixes lexical and historical crawl features; URL-only metrics are more deployable.",
            "- **Explainability**: SHAP/permutation scores are local/global approximations; not causal proof of malice.",
            "- **Unsupervised section**: Cluster structure ≠ ground-truth labels without supervision.",
            "",
        ]
    )
    EXPERIMENTS.write_text("\n".join(lines))


def stratified_sample(df: pd.DataFrame, max_rows: int) -> pd.DataFrame:
    if len(df) <= max_rows:
        return df
    _, sample = train_test_split(
        df,
        train_size=max_rows,
        stratify=df["label"],
        random_state=RANDOM_STATE,
    )
    return sample.reset_index(drop=True)


def train_track(track: str, df: pd.DataFrame, cv) -> tuple[list[dict], dict | None]:
    results: list[dict] = []
    best_row = None
    best_pipe = None
    best_score = -1.0

    if track == "full":
        X, y = prepare_full_features(df)
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=TEST_SIZE, stratify=y, random_state=RANDOM_STATE
        )
        preprocess = build_full_pipeline(X_train)
        unsupervised_matrix = None
    else:
        urls, y = prepare_url_only(df)
        u_train, u_test, y_train, y_test = train_test_split(
            urls, y, test_size=TEST_SIZE, stratify=y, random_state=RANDOM_STATE
        )
        X_train, X_test = u_train, u_test
        preprocess = URLFeatureExtractor()
        unsupervised_matrix = preprocess.fit_transform(u_train)

    models = get_supervised_models(track)

    for name, est in models.items():
        append_build_log(f"Training `{name}` on {track} track…")
        pipe = make_pipeline(clone(preprocess), clone(est))
        try:
            metrics = evaluate_model(pipe, X_train, y_train, X_test, y_test, cv)
        except Exception as exc:
            append_build_log(f"Model {name} failed on {track}: {exc}")
            continue

        row = {
            "track": track,
            "model": name,
            **{k: v for k, v in metrics.items() if k not in ("fitted_pipeline", "y_pred", "y_score")},
        }
        results.append(row)
        append_build_log(
            f"{track}/{name}: test acc={row['test_accuracy']*100:.2f}%, "
            f"CV acc={row['cv_accuracy_mean']*100:.2f}%±{row['cv_accuracy_std']*100:.2f}%"
        )

        if row["test_f1"] > best_score:
            best_score = row["test_f1"]
            best_row = row
            best_pipe = metrics["fitted_pipeline"]

        if track == "url_only" and name in {"RandomForest (OOB)", "GradientBoosting", "LogisticRegression (baseline)"}:
            save_explainability(name, metrics["fitted_pipeline"], X_test, y_test, track, REPORTS_DIR)

    unsup = None
    if unsupervised_matrix is not None:
        unsup = run_unsupervised(unsupervised_matrix, y_train.values)
        (REPORTS_DIR / "unsupervised_url_only.json").write_text(json.dumps(unsup, indent=2))

    return results, {"best_row": best_row, "best_pipe": best_pipe, "unsup": unsup}


def main() -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    append_build_log("Starting training run.")

    df = load_dataset()
    append_build_log(f"Loaded {len(df)} rows from PhiUSIIL dataset.")
    df = stratified_sample(df, MAX_ROWS)
    append_build_log(f"Using stratified sample of {len(df)} rows (PHISHGUARD_MAX_ROWS={MAX_ROWS}).")

    cv = StratifiedKFold(n_splits=N_SPLITS, shuffle=True, random_state=RANDOM_STATE)
    all_results: list[dict] = []

    for track in ("url_only", "full"):
        append_build_log(f"=== Track: {track} ===")
        rows, meta = train_track(track, df, cv)
        all_results.extend(rows)

        if track == "url_only" and meta and meta["best_pipe"] is not None:
            artifact = {
                "pipeline": meta["best_pipe"],
                "model_name": meta["best_row"]["model"],
                "metrics": {k: meta["best_row"][k] for k in meta["best_row"] if k not in ("track", "model")},
                "trained_at": _utc_now(),
                "max_rows": MAX_ROWS,
            }
            path = MODELS_DIR / "url_only_best.joblib"
            joblib.dump(artifact, path)
            append_build_log(
                f"Saved URL-only best model ({meta['best_row']['model']}) to {path}"
            )

            summary = {
                "best_model": meta["best_row"]["model"],
                "test_metrics": artifact["metrics"],
                "unsupervised": meta.get("unsup"),
            }
            (MODELS_DIR / "training_summary.json").write_text(json.dumps(summary, indent=2, default=str))

    write_experiments_table(all_results)
    append_build_log("Wrote EXPERIMENTS.md and completed training.")


if __name__ == "__main__":
    main()
