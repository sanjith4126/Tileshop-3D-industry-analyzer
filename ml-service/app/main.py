"""TileTwin ML service: anomaly detection (Isolation Forest) on SYNTHETIC data.

Endpoints: GET /health, GET /models, POST /train, POST /predict.
Never returns a made-up score: insufficient data -> 422 with the reason.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timezone

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from . import model as m
from .synthetic import SPECS, WINDOW_MINUTES

MIN_POINTS = 45  # of 60 one-minute samples; fewer = data-quality problem, no score

MODELS: dict[str, m.TrainedModel] = {}


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Models train on synthetic data in seconds, so the demo works out of the box without a train step.
    MODELS.update(m.load_all() or m.train_all())
    yield


app = FastAPI(title="TileTwin ML Service", lifespan=lifespan)


class PredictRequest(BaseModel):
    machineId: str = Field(max_length=64)
    machineType: str = Field(max_length=64)
    readings: dict[str, list[float]] = Field(description="sensor suffix -> last 60 one-minute values, oldest first")


class TrainRequest(BaseModel):
    seed: int = 42


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok", "service": "tiletwin-ml", "modelsLoaded": sorted(MODELS),
        "timestampUtc": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/models")
def models() -> list[dict]:
    evaluation = m.load_evaluation()
    return [{
        "name": f"anomaly-{t}", "machineType": t, "version": mod.version, "type": "IsolationForest",
        "status": "Active", "trainedUtc": mod.trained_utc, "trainWindows": mod.train_windows,
        "threshold": mod.threshold, "zThreshold": mod.z_threshold, "features": mod.features, "dataOrigin": "Synthetic",
        "evaluation": evaluation.get(t),
    } for t, mod in sorted(MODELS.items())]


@app.post("/train")
def train(req: TrainRequest) -> dict:
    MODELS.clear()
    MODELS.update(m.train_all(seed=req.seed))
    return {"trained": sorted(MODELS), "version": m.MODEL_VERSION, "dataOrigin": "Synthetic"}


@app.post("/predict")
def predict(req: PredictRequest) -> dict:
    model = MODELS.get(req.machineType)
    if model is None:
        raise HTTPException(404, f"No model for machine type {req.machineType}")

    problems = []
    for s in model.sensors:
        values = [v for v in req.readings.get(s, []) if v is not None and np.isfinite(v)]
        if len(values) < MIN_POINTS:
            problems.append(f"{s}: {len(values)} of {WINDOW_MINUTES} samples")
    if problems:
        raise HTTPException(422, {"error": "Insufficient data to score", "details": problems})

    window = {s: np.asarray(req.readings[s][-WINDOW_MINUTES:], dtype=float) for s in model.sensors}
    x = model.features_of(window)
    scores, zmax, flagged = model.score_matrix(x.reshape(1, -1))
    return {
        "machineId": req.machineId, "modelVersion": model.version, "anomalyScore": round(float(scores[0]), 4),
        "isAnomaly": bool(flagged[0]), "threshold": round(model.threshold, 4),
        "maxFeatureZ": round(float(zmax[0]), 1), "zThreshold": round(model.z_threshold, 1),
        "featuresUsed": model.features, "topDeviations": model.top_deviations(x),
        "timestampUtc": datetime.now(timezone.utc).isoformat(), "dataOrigin": "Synthetic",
    }
