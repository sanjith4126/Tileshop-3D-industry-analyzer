# TileTwin AI — Demo Script

All data is synthetic (fictional TileTwin Demonstration Facility). Start Postgres, the API, the ML
service and the frontend as in the README, then open http://localhost:5180.

## Scripted data patterns (deterministic seed `demo-v1`, fixed random seed 20261022)

| Machine | Pattern | Expected status |
|---|---|---|
| MACHINE-HP-002 | Vibration rises 2 → ~8 mm/s and oil temperature 45 → ~63 °C over the 24 h before seeding; the live simulator continues the drift (capped) | **Critical** (vibration > 7.1), oil temp Warning; alerts: vibration Warning (~−10.5 h), oil temp Warning (~−4 h), vibration Critical (~−2.5 h) |
| MACHINE-PUMP-002 | Flow sensor stops reporting 45 min before seeding and stays silent | **Unknown** (missing data is never Normal) |
| MACHINE-CONV-003 | Flagged offline (gearbox overhaul), no readings for 3 h before seeding | **Offline** |
| All others | Nominal values with noise | Normal |

Glazing & Inspection zone has open Critical/High observations with corrective-action history.

## Scenario A — Remote inspection

1. Open **Remote Site Inspection**.
2. Select **Glazing & Inspection** in the zone list (shows open and high/critical counts). Click **3D**
   next to the zone to see it highlighted in the 3D twin, then go back.
3. Filter **Priority = Critical** or **High**, **Status = Open**. Open the critical interlock-bypass item.
4. Review corrective actions (one done, one in progress), the history timeline and the attachment
   (a clearly labelled **SYNTHETIC PLACEHOLDER IMAGE**).
5. Optional: sign in as `dev.inspector@tiletwin.local` and change status/assignment; the change
   appears in the history.
6. Back on the zone, click **Generate inspection summary**: a deterministic summary citing record
   codes (e.g. `OBS-xxxxxx`), with **Show … in 3D** buttons.

## Scenario B — Machine anomaly

1. **Overview** shows MACHINE-HP-002 as Critical under "Machines needing attention" (reasons:
   vibration beyond critical, oil temperature beyond warning, open ML anomaly).
2. Click **Show in 3D** → the camera flies to HP-002; the side panel shows readings, open alerts and maintenance.
3. Click **Open machine details** → vibration and oil-temperature charts with warning/critical limit
   lines (switch 1 h / 24 h / 7 d); threshold alerts listed (sign in to acknowledge).
4. Click **Predictive maintenance →** → pattern observed (rising vibration and temperature), the ML
   anomaly score with plain-English explanation (largest deviation `VIB_mean`), suggested inspection
   actions with rule IDs, data-quality warnings and the label
   "Suggestion — requires review by a qualified engineer."
   - ML scores refresh every 5 minutes; signed-in users can press **Score now**.
   - Stop the ML service to show the honest "ML service unavailable — no anomaly score" state.
5. Click **Anomaly report (PDF) →**, sign in (any dev user), **Generate report**, then **Download PDF**.
6. Maintenance-prioritisation workflow: Milestone 8.

## Scenario C — Tile quality (Milestone 9)

## Scenario D — AI assistant (Milestone 8)
