"""Synthetic "normal" sensor windows (and labelled injected anomalies for evaluation).

Specs mirror the backend's fictional demo plant (TileTwin.Infrastructure/Seeding/DemoPlant.cs):
nominal value and noise sigma per sensor, per machine type. All data here is SYNTHETIC.
"""

import numpy as np

WINDOW_MINUTES = 60

# machine type -> sensor suffix -> (nominal, noise sigma)
SPECS: dict[str, dict[str, tuple[float, float]]] = {
    "TYPE-HYDRAULIC-PRESS": {"PRES": (180, 3), "TEMP": (45, 0.6), "VIB": (2.0, 0.15), "CYCLE": (12, 0.2)},
    "TYPE-PUMP": {"PRES": (6, 0.15), "FLOW": (40, 0.8), "VIB": (2.0, 0.15), "TEMP": (50, 0.6)},
    "TYPE-MOTOR": {"TEMP": (70, 0.8), "VIB": (1.8, 0.12), "CURR": (45, 0.7)},
    "TYPE-CONVEYOR": {"SPEED": (1.2, 0.02), "TEMP": (55, 0.6)},
    "TYPE-INSPECTION-STATION": {"CYCLE": (2.5, 0.05), "RATE": (24, 0.5)},
}

TEMPERATURE_SENSORS = {"TEMP"}  # carry a small daily cycle (2 % of nominal), like the backend simulator

ANOMALY_KINDS = ("level_shift", "drift", "spike", "stuck", "noise_burst", "small_shift")


def normal_window(machine_type: str, rng: np.random.Generator) -> dict[str, np.ndarray]:
    """One 60-minute window at 1-minute resolution with noise and a random-phase daily cycle."""
    t_hours = rng.uniform(0, 24) + np.arange(WINDOW_MINUTES) / 60.0
    window = {}
    for sensor, (nominal, sigma) in SPECS[machine_type].items():
        values = nominal + rng.normal(0, sigma, WINDOW_MINUTES)
        if sensor in TEMPERATURE_SENSORS:
            values += nominal * 0.02 * np.sin(2 * np.pi * t_hours / 24)
        window[sensor] = values
    return window


def anomalous_window(machine_type: str, kind: str, rng: np.random.Generator) -> dict[str, np.ndarray]:
    """A normal window with one injected anomaly on one random sensor (labelled ground truth)."""
    window = normal_window(machine_type, rng)
    sensor = rng.choice(list(SPECS[machine_type]))
    nominal, sigma = SPECS[machine_type][sensor]
    v = window[sensor]
    sign = rng.choice([-1.0, 1.0])
    if kind == "level_shift":      # sustained offset of 6–12 sigma
        v += sign * rng.uniform(6, 12) * sigma
    elif kind == "small_shift":    # subtle offset of 0.3–0.8 sigma (shows the detection limit)
        v += sign * rng.uniform(0.3, 0.8) * sigma
    elif kind == "drift":          # ramp reaching 8–15 sigma by the end of the window
        v += sign * np.linspace(0, rng.uniform(8, 15) * sigma, WINDOW_MINUTES)
    elif kind == "spike":          # 3 isolated spikes of 10 sigma
        idx = rng.choice(WINDOW_MINUTES, 3, replace=False)
        v[idx] += sign * 10 * sigma
    elif kind == "stuck":          # sensor frozen at one value
        v[:] = v[0]
    elif kind == "noise_burst":    # noise 4x normal
        v += rng.normal(0, 4 * sigma, WINDOW_MINUTES)
    else:
        raise ValueError(kind)
    window[sensor] = v
    return window
