"""Tile image classifier: model-agnostic ONNX Runtime wrapper.

TILE_MODEL_PATH points to an .onnx file. Next to it must be:
  labels.json      - list of class names in output order, e.g. ["ok", "crack", "glaze_defect"]
  model-card.json  - {"name", "version", "inputSize": [H, W], "mean": [r,g,b], "std": [r,g,b], ...}
If anything is missing, status is "MODEL NOT CONFIGURED" and no prediction is ever made up.
See docs/TILE-MODEL.md for how to train and export one.
"""

from __future__ import annotations

import io
import json
import os
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image

NOT_CONFIGURED = "MODEL NOT CONFIGURED"


@dataclass
class TileModel:
    session: object
    input_name: str
    labels: list[str]
    card: dict

    def classify(self, image_bytes: bytes) -> dict:
        h, w = self.card.get("inputSize", [224, 224])
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB").resize((w, h))
        x = np.asarray(img, dtype=np.float32) / 255.0
        x = (x - np.array(self.card.get("mean", [0.0, 0.0, 0.0]), dtype=np.float32)) / np.array(self.card.get("std", [1.0, 1.0, 1.0]), dtype=np.float32)
        x = x.transpose(2, 0, 1)[None, ...]  # NCHW
        logits = np.asarray(self.session.run(None, {self.input_name: x})[0], dtype=np.float64).reshape(-1)
        if logits.size != len(self.labels):
            raise ValueError(f"model returned {logits.size} outputs but labels.json has {len(self.labels)}")
        p = np.exp(logits - logits.max())
        p /= p.sum()
        best = int(p.argmax())
        return {
            "label": self.labels[best], "confidence": round(float(p[best]), 4),
            "probabilities": {lab: round(float(v), 4) for lab, v in zip(self.labels, p)},
            "modelName": self.card.get("name", "unknown"), "modelVersion": self.card.get("version", "unknown"),
        }


def load(model_path: str | None) -> tuple[TileModel | None, str]:
    """Returns (model, status message). Never raises for configuration problems."""
    if not model_path:
        return None, f"{NOT_CONFIGURED}: TILE_MODEL_PATH is not set"
    path = Path(model_path)
    labels_path, card_path = path.parent / "labels.json", path.parent / "model-card.json"
    missing = [p.name for p in (path, labels_path, card_path) if not p.exists()]
    if missing:
        return None, f"{NOT_CONFIGURED}: missing {', '.join(missing)}"
    try:
        import onnxruntime as ort

        session = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
        labels = json.loads(labels_path.read_text(encoding="utf-8"))
        card = json.loads(card_path.read_text(encoding="utf-8"))
        return TileModel(session, session.get_inputs()[0].name, labels, card), "ready"
    except Exception as e:  # corrupt model / bad JSON -> honest not-configured state
        return None, f"{NOT_CONFIGURED}: could not load model ({type(e).__name__}: {e})"


def load_from_env() -> tuple[TileModel | None, str]:
    return load(os.environ.get("TILE_MODEL_PATH", "").strip() or None)
