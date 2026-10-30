"""FastAPI backend serving the URL-only PhishGuard model."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from ml.url_features import FEATURE_NAMES, extract_url_features

ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = ROOT / "models" / "url_only_best.joblib"
SUMMARY_PATH = ROOT / "models" / "training_summary.json"

# PhiUSIIL label polarity: 0 = phishing, 1 = legitimate/benign.
# sklearn predict_proba columns follow classes_ = [0, 1].
PHISHING_CLASS = 0
BENIGN_CLASS = 1

app = FastAPI(title="PhishGuard API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_artifact: dict[str, Any] | None = None


class PredictRequest(BaseModel):
    url: str = Field(..., min_length=3, max_length=2048)


class PredictResponse(BaseModel):
    url: str
    verdict: str
    is_phishing: bool
    confidence: float
    model_name: str
    reasons: list[str]
    features: dict[str, float]


def load_artifact() -> dict[str, Any]:
    global _artifact
    if _artifact is not None:
        return _artifact
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model not found at {MODEL_PATH}. Run `python -m ml.train` first."
        )
    _artifact = joblib.load(MODEL_PATH)
    return _artifact


def _phishing_probability(pipe, url: str) -> float:
    """Return P(phishing). PhiUSIIL class 0 = phishing, class 1 = benign."""
    if hasattr(pipe, "predict_proba"):
        proba = pipe.predict_proba([url])[0]
        model = pipe.named_steps["model"] if hasattr(pipe, "named_steps") else pipe
        classes = list(getattr(model, "classes_", [0, 1]))
        if PHISHING_CLASS in classes:
            return float(proba[classes.index(PHISHING_CLASS)])
        return float(proba[0])
    pred = int(pipe.predict([url])[0])
    return 1.0 if pred == PHISHING_CLASS else 0.0


def _reasons_from_features(feats: dict[str, float], phishing_proba: float) -> list[str]:
    reasons: list[str] = []
    if feats.get("is_ip_host"):
        reasons.append("Host looks like a raw IP address instead of a domain name.")
    if feats.get("has_at_symbol"):
        reasons.append("URL contains '@', which can hide the real destination.")
    if feats.get("num_subdomains", 0) >= 3:
        reasons.append("Unusually many subdomains (common in credential phishing).")
    if feats.get("suspicious_tld"):
        reasons.append("Top-level domain is often abused in phishing campaigns.")
    if feats.get("keyword_login") or feats.get("keyword_verify") or feats.get("keyword_account"):
        reasons.append("Path or host contains sensitive-action keywords (login/verify/account).")
    if feats.get("keyword_secure"):
        reasons.append("Uses 'secure' branding language often mimicked by phishing pages.")
    if feats.get("digit_ratio", 0) > 0.25:
        reasons.append("High digit ratio — can indicate obfuscated or generated URLs.")
    if not feats.get("is_https"):
        reasons.append("Not using HTTPS (legitimate banks usually enforce TLS).")
    if phishing_proba >= 0.5 and not reasons:
        reasons.append("Model score exceeds phishing threshold based on URL structure.")
    if phishing_proba < 0.5 and not reasons:
        reasons.append("URL structure resembles benign patterns in training data.")
    return reasons[:6]


def predict_url(url: str) -> PredictResponse:
    artifact = load_artifact()
    pipe = artifact["pipeline"]
    model_name = artifact.get("model_name", "unknown")

    feats = extract_url_features(url)
    phishing_proba = _phishing_probability(pipe, url)

    is_phishing = phishing_proba >= 0.5
    verdict = "phishing" if is_phishing else "benign"
    confidence = phishing_proba if is_phishing else 1.0 - phishing_proba
    reasons = _reasons_from_features(feats, phishing_proba)

    return PredictResponse(
        url=url,
        verdict=verdict,
        is_phishing=is_phishing,
        confidence=round(confidence, 4),
        model_name=model_name,
        reasons=reasons,
        features={k: round(feats[k], 4) for k in FEATURE_NAMES if k in feats},
    )


@app.on_event("startup")
def startup() -> None:
    try:
        load_artifact()
    except FileNotFoundError:
        pass


@app.get("/health")
def health():
    ready = MODEL_PATH.exists()
    return {"status": "ok" if ready else "no_model", "model_path": str(MODEL_PATH)}


@app.post("/predict", response_model=PredictResponse)
def predict(body: PredictRequest):
    try:
        return predict_url(body.url)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/model/info")
def model_info():
    try:
        artifact = load_artifact()
        metrics = artifact.get("metrics", {})
        return {
            "model_name": artifact.get("model_name"),
            "trained_at": artifact.get("trained_at"),
            "metrics": metrics,
            "label_polarity": {
                "0": "phishing",
                "1": "benign",
                "note": "PhiUSIIL uses 1=legitimate, 0=phishing",
            },
        }
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/model/stats")
def model_stats():
    """Training summary for the dashboard (accuracy, confusion matrix, etc.)."""
    if SUMMARY_PATH.exists():
        return json.loads(SUMMARY_PATH.read_text())
    try:
        artifact = load_artifact()
        return {
            "best_model": artifact.get("model_name"),
            "test_metrics": artifact.get("metrics", {}),
            "unsupervised": None,
        }
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
