"""Isolation Forest per machine type: training, persistence, scoring.

Score convention: anomaly_score = -IsolationForest.score_samples (higher = more unusual).
Threshold = 99.5th percentile of scores on the synthetic normal training windows.

Isolation Forest alone scores values *beyond* the training range no higher than the most extreme
normal point (its splits are drawn inside the training range), so it misses sustained level shifts
(measured recall ~5 %, see docs/ML-EVALUATION.md). A window is therefore also flagged when any feature
is further from the training mean than the 99.5th percentile of the max |z| seen on normal windows.
Both checks are statistical; neither is a fault diagnosis.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest

from .features import feature_names, window_features
from .synthetic import SPECS, normal_window

MODEL_VERSION = "iforest-1.1"
TRAIN_WINDOWS = 2000
THRESHOLD_PERCENTILE = 99.5
MODELS_DIR = Path(__file__).resolve().parent.parent / "models"


@dataclass
class TrainedModel:
    machine_type: str
    version: str
    sensors: list[str]
    features: list[str]
    forest: IsolationForest
    threshold: float
    z_threshold: float
    feature_mean: np.ndarray
    feature_std: np.ndarray
    trained_utc: str
    train_windows: int

    def z(self, X: np.ndarray) -> np.ndarray:
        return (X - self.feature_mean) / np.where(self.feature_std > 0, self.feature_std, 1)

    def score_matrix(self, X: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        """(isolation-forest scores, max |z| per row, is_anomaly) for a feature matrix."""
        scores = -self.forest.score_samples(X)
        zmax = np.abs(self.z(X)).max(axis=1)
        return scores, zmax, (scores > self.threshold) | (zmax > self.z_threshold)

    def features_of(self, window: dict[str, np.ndarray]) -> np.ndarray:
        return window_features(window, self.sensors)

    def top_deviations(self, x: np.ndarray, n: int = 3) -> list[dict]:
        """Features furthest from the training distribution (z-score). Descriptive, not causal."""
        z = self.z(x)
        order = np.argsort(-np.abs(z))[:n]
        return [{"feature": self.features[i], "value": round(float(x[i]), 4), "zScore": round(float(z[i]), 1)} for i in order]


def train(machine_type: str, seed: int = 42, windows: int = TRAIN_WINDOWS) -> TrainedModel:
    rng = np.random.default_rng(seed)
    sensors = list(SPECS[machine_type])
    X = np.array([window_features(normal_window(machine_type, rng), sensors) for _ in range(windows)])
    forest = IsolationForest(n_estimators=200, random_state=seed).fit(X)
    scores = -forest.score_samples(X)
    mean, std = X.mean(axis=0), X.std(axis=0)
    zmax = np.abs((X - mean) / np.where(std > 0, std, 1)).max(axis=1)
    return TrainedModel(
        machine_type=machine_type, version=MODEL_VERSION, sensors=sensors, features=feature_names(sensors),
        forest=forest, threshold=float(np.percentile(scores, THRESHOLD_PERCENTILE)),
        z_threshold=float(np.percentile(zmax, THRESHOLD_PERCENTILE)),
        feature_mean=mean, feature_std=std,
        trained_utc=datetime.now(timezone.utc).isoformat(), train_windows=windows,
    )


def save(model: TrainedModel, directory: Path = MODELS_DIR) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f"{model.machine_type}.joblib"
    joblib.dump(model, path)
    return path


def load_all(directory: Path = MODELS_DIR) -> dict[str, TrainedModel]:
    return {p.stem: joblib.load(p) for p in sorted(directory.glob("TYPE-*.joblib"))}


def train_all(directory: Path = MODELS_DIR, seed: int = 42) -> dict[str, TrainedModel]:
    models = {t: train(t, seed) for t in SPECS}
    for m in models.values():
        save(m, directory)
    return models


def load_evaluation(directory: Path = MODELS_DIR) -> dict:
    path = directory / "evaluation.json"
    return json.loads(path.read_text()) if path.exists() else {}
