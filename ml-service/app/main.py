"""TileTwin ML service: anomaly detection (Isolation Forest) on SYNTHETIC data.

Endpoints: GET /health, GET /models, POST /train, POST /predict.
Never returns a made-up score: insufficient data -> 422 with the reason.
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from . import model as m
from . import tile
from .synthetic import SPECS, WINDOW_MINUTES

MIN_POINTS = 45  # of 60 one-minute samples; fewer = data-quality problem, no score

MODELS: dict[str, m.TrainedModel] = {}
TILE: dict = {"model": None, "status": tile.NOT_CONFIGURED}
MAX_IMAGE_BYTES = 10 * 1024 * 1024


def load_env_file(path: Path = Path(__file__).resolve().parents[2] / ".env") -> None:
    """Reads the repo-root .env (e.g. TILE_MODEL_PATH) without overriding real environment variables."""
    if os.environ.get("TILETWIN_SKIP_DOTENV") or not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        if "=" not in line or line.lstrip().startswith("#"):
            continue
        key, value = line.split("=", 1)
        value = "" if value.strip().startswith("#") else value.split(" #")[0].strip().strip('"')
        os.environ.setdefault(key.strip(), value)


@asynccontextmanager
async def lifespan(_: FastAPI):
    load_env_file()
    # Models train on synthetic data in seconds, so the demo works out of the box without a train step.
    MODELS.update(m.load_all() or m.train_all())
    TILE["model"], TILE["status"] = tile.load_from_env()
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
        "tileModel": {"configured": TILE["model"] is not None, "status": TILE["status"]},
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


@app.get("/tile/status")
def tile_status() -> dict:
    model = TILE["model"]
    return {"configured": model is not None, "status": TILE["status"],
            "labels": model.labels if model else None, "modelCard": model.card if model else None}


@app.post("/tile/classify")
async def tile_classify(file: UploadFile = File(...)) -> dict:
    model = TILE["model"]
    if model is None:
        raise HTTPException(503, {"configured": False, "error": TILE["status"]})
    data = await file.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Image larger than 10 MB")
    try:
        result = model.classify(data)
    except Exception as e:
        raise HTTPException(422, f"Could not classify image: {type(e).__name__}") from e
    return {"configured": True, **result, "timestampUtc": datetime.now(timezone.utc).isoformat()}
