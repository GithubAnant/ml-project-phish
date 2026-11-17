"""FastAPI backend serving the URL-only URLSentinel model."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from api.chat_routes import router as chat_router
from api.scoring import MODEL_PATH, load_artifact, model_info_payload, predict_url

app = FastAPI(title="URLSentinel API", version="1.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(chat_router)


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
        return model_info_payload()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc