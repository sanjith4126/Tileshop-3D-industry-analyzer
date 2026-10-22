from datetime import datetime, timezone

from fastapi import FastAPI

app = FastAPI(title="TileTwin ML Service")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "tiletwin-ml", "timestampUtc": datetime.now(timezone.utc).isoformat()}
