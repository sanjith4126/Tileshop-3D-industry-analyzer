"""Window features: rolling mean, standard deviation and linear slope of each sensor."""

import numpy as np

STATS = ("mean", "std", "slope")


def feature_names(sensors: list[str]) -> list[str]:
    return [f"{s}_{stat}" for s in sensors for stat in STATS]


def window_features(window: dict[str, np.ndarray], sensors: list[str]) -> np.ndarray:
    """Feature vector in a fixed sensor order. Slope is per minute (least-squares fit)."""
    out = []
    for s in sensors:
        v = np.asarray(window[s], dtype=float)
        x = np.arange(len(v), dtype=float)
        slope = float(np.polyfit(x, v, 1)[0]) if len(v) > 1 else 0.0
        out.extend([float(v.mean()), float(v.std(ddof=0)), slope])
    return np.array(out)
