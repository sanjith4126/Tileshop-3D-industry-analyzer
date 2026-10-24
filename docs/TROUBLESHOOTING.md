# Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `docker: command not found` in an old terminal | Docker Desktop was installed after the terminal opened | Open a new terminal, or call `"C:\Program Files\Docker\Docker\resources\bin\docker.exe"` |
| `docker compose up` fails: port 5434 in use | Another service uses the port | Set `POSTGRES_HOST_PORT` in `.env` and the same port in `POSTGRES_CONNECTION` |
| API exits at start: "Invalid configuration" | `POSTGRES_CONNECTION` or `JWT__SigningKey` missing / placeholder | Copy `.env.example` to `.env` and fill both (signing key ≥ 32 random characters) |
| API: "password authentication failed" | `POSTGRES_PASSWORD` and the password inside `POSTGRES_CONNECTION` differ, or the volume was created with another password | Make them equal. To start over: `docker compose -f database/docker-compose.yml --env-file .env down -v` (deletes the database) |
| First API start takes ~20 s | Migrations + seeding ~494k readings | Normal; watch for "Demo data seeded" in the log |
| `dotnet build` fails: file locked by `TileTwin.Api` | The API is still running from the same output folder | Stop the running API first |
| Frontend: "Port 5180 is already in use" | Another Vite app | Stop it, or change `server.port` in `frontend/vite.config.ts` |
| Every machine shows **Offline** | The API (simulator) is not running, or the simulator is paused | Start the API; Administration → Resume simulator |
| "ML service unavailable" | ML service not running or wrong `ML_SERVICE_URL` | `cd ml-service; .venv\Scripts\python -m uvicorn app.main:app --port 8001` |
| No ML score / "insufficient data" | Fewer than 45 of the last 60 minutes have readings | Wait a few minutes; restarting the API fills missing minutes |
| Tile upload: **MODEL NOT CONFIGURED** | No ONNX model configured (expected in the demo) | See `docs/TILE-MODEL.md`; set `TILE_MODEL_PATH` and restart the ML service |
| Assistant: **AI NOT CONFIGURED** | No AI key set | Set `GROQ_API_KEY` + `LLM__Provider=groq`, or `ANTHROPIC_API_KEY` + `LLM__Model`, in `.env`; restart the API |
| Assistant returns 502 | Invalid key, unknown model ID, provider rate limit or network problem | Check the API log ("LLM call failed"); verify the key and `LLM__Model` (Groq models: `GET https://api.groq.com/openai/v1/models`) |
| HTTP 429 | Rate limit reached | Wait a minute |
| Cannot sign in as dev users | Not Development, or `DEV_SEED_USER_PASSWORD` empty | Set it in `.env` and restart the API (dev users are re-synced to that password at start) |
| Backend tests fail to connect | The compose Postgres is not running | Start it; tests create and use `tiletwin_test` |
| Want a clean demo state | — | Administration → **Reset demo data** (Admin). User-created rows are kept |
