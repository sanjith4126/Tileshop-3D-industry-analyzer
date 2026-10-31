"""End-to-end smoke test of the running demo (Scenarios A-D). Standard library only.

Usage (with Postgres, API, ML service and frontend running):
    python scripts/smoke.py
Signs in with the DEV ONLY users (password = DEV_SEED_USER_PASSWORD from .env). It creates a report,
a workflow execution and one tile-inspection upload (user-created rows, kept by "Reset demo data").
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API = "http://localhost:5080"
FRONTEND = "http://localhost:5180"
results: list[tuple[bool, str]] = []


def env(name: str) -> str:
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        if line.startswith(name + "="):
            return line.split("=", 1)[1].split(" #")[0].strip()
    return ""


def call(method: str, path: str, body=None, token: str | None = None, raw: bytes | None = None, ctype: str | None = None, base: str = API):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(base + path, data=data, method=method)
    if data is not None:
        req.add_header("Content-Type", ctype or "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            content = r.read()
            return r.status, content
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def j(method, path, body=None, token=None):
    status, content = call(method, path, body, token)
    try:
        return status, json.loads(content) if content else None
    except json.JSONDecodeError:
        return status, content


def check(ok: bool, label: str) -> None:
    results.append((bool(ok), label))
    print(("PASS " if ok else "FAIL ") + label)
    if not ok and os.environ.get("GITHUB_ACTIONS") == "true":
        print(f"::error title=API smoke::{label}")   # annotation, readable without access to the job log


def login(role: str) -> str | None:
    s, b = j("POST", "/api/auth/login", {"email": f"dev.{role.lower()}@tiletwin.local", "password": env("DEV_SEED_USER_PASSWORD")})
    return b.get("token") if s == 200 else None


def multipart(field: str, filename: str, content: bytes, ctype: str) -> tuple[bytes, str]:
    boundary = uuid.uuid4().hex
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"{field}\"; filename=\"{filename}\"\r\n"
            f"Content-Type: {ctype}\r\n\r\n").encode() + content + f"\r\n--{boundary}--\r\n".encode()
    return body, f"multipart/form-data; boundary={boundary}"


def main() -> int:
    s, h = j("GET", "/api/health")
    check(s == 200 and h["database"] == "ok", "API healthy and database connected")
    s, _ = call("GET", "/api/health", base=FRONTEND)
    check(s == 200, "Frontend serves and proxies /api")

    s, machines = j("GET", "/api/machines")
    by = {m["id"]: m for m in machines} if s == 200 else {}
    check(by.get("MACHINE-HP-002", {}).get("status") == "Critical", "HP-002 is Critical (scripted drift)")
    check(by.get("MACHINE-PUMP-002", {}).get("status") == "Unknown", "PUMP-002 is Unknown (missing data, never Normal)")
    check(by.get("MACHINE-CONV-003", {}).get("status") == "Offline", "CONV-003 is Offline")

    # Scenario A — remote inspection
    s, zones = j("GET", "/api/inspection/zones")
    glaze = next((z for z in zones or [] if z["id"] == "ZONE-GLAZE-A"), None)
    check(glaze is not None and glaze["openHighPriority"] >= 1, "A: Glazing zone has open high-priority observations")
    s, obs = j("GET", "/api/observations?zoneId=ZONE-GLAZE-A&priority=Critical")
    if obs:
        s, d = j("GET", f"/api/observations/{obs[0]['id']}")
        check(s == 200 and len(d["correctiveActions"]) >= 1 and len(d["history"]) >= 1, "A: observation detail has corrective actions and history")
    else:
        check(False, "A: a critical Glazing observation exists")
    s, summ = j("POST", "/api/inspection/summary", {"zoneId": "ZONE-GLAZE-A"})
    check(s == 200 and any("OBS-" in line for line in summ["lines"]), "A: inspection summary cites observation codes")

    # Scenario B — machine anomaly
    s, r = j("GET", "/api/machines/MACHINE-HP-002/readings?range=24h")
    vib = next((x for x in (r or {}).get("sensors", []) if x["sensorId"] == "SENSOR-HP-002-VIB"), None)
    check(vib is not None and vib["criticalMax"] == 7.1 and len(vib["points"]) > 200, "B: vibration chart data with limits")
    s, alerts = j("GET", "/api/alerts?machineId=MACHINE-HP-002")
    check(s == 200 and any(a["severity"] == "Critical" for a in alerts), "B: HP-002 has a critical threshold alert")
    s, p = j("GET", "/api/predictive/MACHINE-HP-002")
    check(s == 200 and p["reviewLabel"].startswith("Suggestion") and p["suggestedActions"], "B: predictive suggestions with review label")
    eng = login("MaintenanceEngineer")
    check(eng is not None, "Dev user sign-in works (DEV_SEED_USER_PASSWORD)")
    if p and p["latestScore"] is None:
        # Scheduled scoring runs every few minutes; right after start-up press "Score now" like a user would.
        j("POST", "/api/predictive/MACHINE-HP-002/score", None, eng)
        s, p = j("GET", "/api/predictive/MACHINE-HP-002")
    if p and p["ml"]["available"]:
        check(p["latestScore"] is not None, "B: ML anomaly score present (ML service reachable)")
    else:
        check(p is not None and p["latestScore"] is None, "B: ML unavailable is reported honestly (no score)")
    s, w = j("POST", "/api/workflows/maintenance-prioritisation", {"zoneId": None, "createReport": True, "aiWording": False}, eng)
    out = (w or {}).get("output") or {}
    check(s == 200 and out.get("ranking", [{}])[0].get("machineId") == "MACHINE-HP-002", "B: prioritisation workflow ranks HP-002 first")
    if out.get("reportId"):
        s, pdf = call("GET", f"/api/reports/{out['reportId']}/pdf")
        check(s == 200 and pdf[:4] == b"%PDF", "B: PDF report downloads")
    else:
        check(False, "B: workflow stored a report")

    # Scenario C — tile quality
    s, ts = j("GET", "/api/tile-inspections/status")
    check(s == 200, f"C: tile model status reported ({(ts or {}).get('status', '?')})")
    insp = login("Inspector")
    sample = (ROOT / "frontend/public/tile-samples/sample-crack.png").read_bytes()
    body, ctype = multipart("file", "sample-crack.png", sample, "image/png")
    s, up = call("POST", "/api/tile-inspections", token=insp, raw=body, ctype=ctype)
    t = json.loads(up) if s in (200, 201) else {}
    honest = t.get("outcome") == "Classified" and t.get("label") or t.get("outcome") in ("ModelNotConfigured", "MlUnavailable") and t.get("label") is None
    check(s == 201 and bool(honest), f"C: upload stored with an honest outcome ({t.get('outcome')})")

    # Scenario D — AI assistant
    s, st = j("GET", "/api/assistant/status")
    viewer = login("Viewer")
    if st and st["configured"]:
        s, a = j("POST", "/api/assistant/chat", {"messages": [{"role": "user", "text": "Which machines have active alerts?"}]}, viewer)
        check(s == 200 and "MACHINE-HP-002" in a.get("answer", ""), "D: assistant answers with record IDs")
    else:
        s, a = j("POST", "/api/assistant/chat", {"messages": [{"role": "user", "text": "Which machines have active alerts?"}]}, viewer)
        check(s == 503 and "AI NOT CONFIGURED" in json.dumps(a), "D: no key -> AI NOT CONFIGURED, no canned answer")

    s, k = j("GET", "/api/documents/search?q=interlock")
    check(s == 200 and k["hits"], f"Knowledge Centre search works ({(k or {}).get('mode')})")
    s, _ = j("POST", "/api/admin/reset-demo", None, viewer)
    check(s == 403, "Admin-only endpoint refuses a Viewer")

    failed = [label for ok, label in results if not ok]
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
