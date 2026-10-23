# Maintenance suggestion rules

Source of truth: `backend/TileTwin.Domain/Maintenance/SuggestionRules.cs` (unit-tested in
`MaintenanceRulesTests`). The Predictive Maintenance page shows every triggered rule with its ID and
the evidence that triggered it.

**Every output is a suggestion that requires review by a qualified engineer. The system never
controls equipment.** These are generic, illustrative inspection prompts for a fictional plant — a
real deployment must replace them with the site's own maintenance procedures.

## Signals

| Signal | Raised when |
|---|---|
| High / Low | Latest reading is beyond its warning or critical limit (above max / below min) |
| Rising / Falling | Least-squares trend over the last 24 h changes the level by ≥ 10 % (`TrendAnalyzer`) |
| Missing | A required sensor has no reading in the last 5 minutes |
| MlAnomaly | The most recent ML score (≤ 15 min old) is a statistical anomaly; attached to the sensor of the largest deviating feature |

## Rule table

| Rule | Sensor | Signals | Suggested inspection action |
|---|---|---|---|
| R-VIB-01 | Vibration | High, Rising | Check mounting bolts, base frame and foundation for looseness |
| R-VIB-02 | Vibration | High, Rising | Inspect bearings: temperature, noise and lubrication condition |
| R-VIB-03 | Vibration | High, Rising | Check alignment and balance of rotating or reciprocating parts (guides, couplings) |
| R-TMP-01 | Temperature | High, Rising | Check lubricant / hydraulic oil level and condition |
| R-TMP-02 | Temperature | High, Rising | Check cooler, fan and filters for blockage; verify cooling flow |
| R-PRS-01 | Pressure | High, Low, Rising, Falling | Check relief and control valves and seals for leakage or sticking |
| R-PRS-02 | Pressure | High, Low, Rising, Falling | Verify pressure transmitter calibration against a reference gauge |
| R-FLW-01 | Flow | Low, Falling | Check suction strainer, impeller and for air ingress or cavitation |
| R-CUR-01 | Current | High, Rising | Check for mechanical overload or binding; check supply voltage balance |
| R-SPD-01 | Belt speed | High, Low, Rising, Falling | Check belt tension, drive and gearbox |
| R-CYC-01 | Cycle time | High, Rising | Check hydraulic response and valve timing; review recent recipe changes |
| R-RAT-01 | Inspection rate | Low, Falling | Check upstream feed and inspection camera / lighting condition |
| R-DAT-01 | any | Missing | Check sensor wiring, power and transmitter — missing data prevents assessment |
| R-ML-01 | any | MlAnomaly | Review recent operating changes and compare with similar machines (statistical anomaly, cause unknown) |

## Four different things (kept separate in UI and code)

1. **Threshold alert** — deterministic rule; a value crossed a limit (`AlertDetector`).
2. **Statistical anomaly** — ML score; recent data is unusual, not necessarily faulty.
3. **Confirmed mechanical fault** — only a human records this (maintenance records).
4. **Failure prediction** — **not implemented**; it needs labelled failure history from a real plant.
