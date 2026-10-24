import os

# Tests control TILE_MODEL_PATH themselves; never pick it up from the developer's .env.
os.environ["TILETWIN_SKIP_DOTENV"] = "1"
