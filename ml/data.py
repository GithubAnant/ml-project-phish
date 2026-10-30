"""Load PhiUSIIL dataset and build feature matrices."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CSV = ROOT / "data" / "PhiUSIIL_Phishing_URL_Dataset.csv"

# Columns derived from crawling page content — excluded from "full" track to reduce leakage
LEAKAGE_COLS = {
    "LineOfCode",
    "LargestLineLength",
    "HasTitle",
    "Title",
    "DomainTitleMatchScore",
    "URLTitleMatchScore",
    "HasFavicon",
    "Robots",
    "IsResponsive",
    "NoOfURLRedirect",
    "NoOfSelfRedirect",
    "HasDescription",
    "NoOfPopup",
    "NoOfiFrame",
    "HasExternalFormSubmit",
    "HasSocialNet",
    "HasSubmitButton",
    "HasHiddenFields",
    "HasPasswordField",
    "Bank",
    "Pay",
    "Crypto",
    "HasCopyrightInfo",
    "NoOfImage",
    "NoOfCSS",
    "NoOfJS",
    "NoOfSelfRef",
    "NoOfEmptyRef",
    "NoOfExternalRef",
}

DROP_ALWAYS = {"FILENAME", "URL", "Title", "label"}


def load_dataset(csv_path: Path | str | None = None) -> pd.DataFrame:
    path = Path(csv_path) if csv_path else DEFAULT_CSV
    if not path.exists():
        raise FileNotFoundError(
            f"Dataset not found at {path}. Run scripts/download_data.sh first."
        )
    return pd.read_csv(path)


def prepare_full_features(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    """URL-derived + lexical features from CSV (excludes post-fetch page signals)."""
    y = df["label"].astype(int)
    cols = [
        c
        for c in df.columns
        if c not in DROP_ALWAYS and c not in LEAKAGE_COLS
    ]
    X = df[cols].copy()
    for col in X.columns:
        if X[col].dtype in ("object", "string", str):
            X[col] = X[col].astype(str)
        else:
            X[col] = pd.to_numeric(X[col], errors="coerce")
    return X, y


def prepare_url_only(df: pd.DataFrame) -> tuple[pd.Series, pd.Series]:
    """Raw URL strings and labels only."""
    return df["URL"].astype(str), df["label"].astype(int)
