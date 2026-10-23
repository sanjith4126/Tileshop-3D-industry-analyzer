import numpy as np
import pytest
from fastapi.testclient import TestClient

from app import model as m
from app.features import window_features
from app.main import app
from app.synthetic import SPECS, anomalous_window, normal_window

PRESS = "TYPE-HYDRAULIC-PRESS"


@pytest.fixture(scope="module")
def press_model() -> m.TrainedModel:
    return m.train(PRESS, seed=1, windows=600)


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:   # runs lifespan: loads (or trains) models
        yield c


def test_features_mean_std_slope():
    window = {"A": np.arange(60, dtype=float) * 0.5 + 10}
    mean, std, slope = window_features(window, ["A"])
    assert mean == pytest.approx(10 + 0.5 * 29.5)
    assert std > 0
    assert slope == pytest.approx(0.5)


def test_normal_windows_mostly_not_flagged(press_model):
    rng = np.random.default_rng(99)
    X = np.array([press_model.features_of(normal_window(PRESS, rng)) for _ in range(300)])
    _, _, flagged = press_model.score_matrix(X)
    assert flagged.mean() < 0.05


@pytest.mark.parametrize("kind", ["level_shift", "drift", "stuck"])
def test_large_injected_anomalies_are_flagged(press_model, kind):
    rng = np.random.default_rng(7)
    X = np.array([press_model.features_of(anomalous_window(PRESS, kind, rng)) for _ in range(50)])
    _, _, flagged = press_model.score_matrix(X)
    assert flagged.mean() > 0.9


def test_hp002_style_vibration_drift_is_flagged_with_vib_as_top_deviation(press_model):
    rng = np.random.default_rng(3)
    window = normal_window(PRESS, rng)
    window["VIB"] = window["VIB"] + 3.0   # vibration ~5 mm/s vs nominal 2.0
    x = press_model.features_of(window)
    _, _, flagged = press_model.score_matrix(x.reshape(1, -1))
    assert flagged[0]
    assert press_model.top_deviations(x, 1)[0]["feature"] == "VIB_mean"


def test_health_and_models(client):
    assert client.get("/health").json()["status"] == "ok"
    models = client.get("/models").json()
    assert {mod["machineType"] for mod in models} == set(SPECS)
    assert all(mod["dataOrigin"] == "Synthetic" for mod in models)


def test_predict_returns_contract_fields(client):
    rng = np.random.default_rng(5)
    readings = {k: v.tolist() for k, v in normal_window(PRESS, rng).items()}
    res = client.post("/predict", json={"machineId": "MACHINE-HP-001", "machineType": PRESS, "readings": readings})
    assert res.status_code == 200
    body = res.json()
    for key in ("machineId", "modelVersion", "anomalyScore", "isAnomaly", "threshold", "featuresUsed", "timestampUtc"):
        assert key in body
    assert body["machineId"] == "MACHINE-HP-001"


def test_predict_refuses_to_score_missing_data(client):
    rng = np.random.default_rng(5)
    readings = {k: v.tolist() for k, v in normal_window(PRESS, rng).items()}
    readings["VIB"] = readings["VIB"][:10]
    res = client.post("/predict", json={"machineId": "X", "machineType": PRESS, "readings": readings})
    assert res.status_code == 422
    assert "VIB" in str(res.json())


def test_predict_unknown_type_is_404(client):
    assert client.post("/predict", json={"machineId": "X", "machineType": "TYPE-NOPE", "readings": {}}).status_code == 404
