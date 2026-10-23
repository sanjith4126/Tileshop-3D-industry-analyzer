import io
import json

import numpy as np
import onnx
from fastapi.testclient import TestClient
from onnx import TensorProto, helper
from PIL import Image

from app import main, tile


def png_bytes(color=(200, 200, 200)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (64, 64), color).save(buf, "PNG")
    return buf.getvalue()


def make_model(tmp_path) -> str:
    """Tiny ONNX graph: global average pool over the image, then a fixed 3->2 linear layer.
    Bright images score 'ok', dark images 'defect'. Only for exercising the pipeline."""
    x = helper.make_tensor_value_info("image", TensorProto.FLOAT, [1, 3, 32, 32])
    y = helper.make_tensor_value_info("logits", TensorProto.FLOAT, [1, 2])
    w = helper.make_tensor("W", TensorProto.FLOAT, [3, 2], [4, -4, 4, -4, 4, -4])
    b = helper.make_tensor("B", TensorProto.FLOAT, [2], [-6, 6])
    shape = helper.make_tensor("S", TensorProto.INT64, [2], [1, 3])
    graph = helper.make_graph([
        helper.make_node("GlobalAveragePool", ["image"], ["pooled"]),
        helper.make_node("Reshape", ["pooled", "S"], ["flat"]),
        helper.make_node("Gemm", ["flat", "W", "B"], ["logits"]),
    ], "tiny", [x], [y], [w, b, shape])
    model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 13)])
    model.ir_version = 8
    path = tmp_path / "tile.onnx"
    onnx.save(model, path)
    (tmp_path / "labels.json").write_text(json.dumps(["ok", "defect"]))
    (tmp_path / "model-card.json").write_text(json.dumps({"name": "test-tiny", "version": "0.0.1", "inputSize": [32, 32]}))
    return str(path)


def test_not_configured_without_path_or_files(tmp_path):
    assert tile.load(None) == (None, "MODEL NOT CONFIGURED: TILE_MODEL_PATH is not set")
    model, status = tile.load(str(tmp_path / "missing.onnx"))
    assert model is None and "missing.onnx" in status and status.startswith("MODEL NOT CONFIGURED")


def test_corrupt_model_is_not_configured(tmp_path):
    (tmp_path / "bad.onnx").write_bytes(b"not a model")
    (tmp_path / "labels.json").write_text("[]")
    (tmp_path / "model-card.json").write_text("{}")
    model, status = tile.load(str(tmp_path / "bad.onnx"))
    assert model is None and "could not load model" in status


def test_classify_with_configured_model(tmp_path):
    model, status = tile.load(make_model(tmp_path))
    assert status == "ready"
    bright = model.classify(png_bytes((250, 250, 250)))
    dark = model.classify(png_bytes((10, 10, 10)))
    assert bright["label"] == "ok" and dark["label"] == "defect"
    assert abs(sum(bright["probabilities"].values()) - 1) < 1e-3
    assert bright["modelName"] == "test-tiny"


def test_endpoint_returns_503_model_not_configured(monkeypatch):
    monkeypatch.delenv("TILE_MODEL_PATH", raising=False)
    with TestClient(main.app) as c:
        assert c.get("/tile/status").json()["configured"] is False
        r = c.post("/tile/classify", files={"file": ("t.png", png_bytes(), "image/png")})
        assert r.status_code == 503
        assert "MODEL NOT CONFIGURED" in r.text


def test_endpoint_classifies_when_configured(monkeypatch, tmp_path):
    monkeypatch.setenv("TILE_MODEL_PATH", make_model(tmp_path))
    with TestClient(main.app) as c:
        r = c.post("/tile/classify", files={"file": ("t.png", png_bytes((250, 250, 250)), "image/png")})
        assert r.status_code == 200
        assert r.json()["label"] == "ok" and r.json()["configured"] is True
