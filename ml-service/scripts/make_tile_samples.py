"""Draws three synthetic tile images for the frontend 'Sample demo mode'. Deterministic (fixed seed)."""
import json
import random
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[2] / "frontend" / "public" / "tile-samples"
OUT.mkdir(parents=True, exist_ok=True)
rng = random.Random(7)


def base() -> Image.Image:
    img = Image.new("RGB", (480, 480), (214, 208, 196))
    d = ImageDraw.Draw(img)
    for _ in range(2500):  # speckled glaze texture
        x, y = rng.randrange(480), rng.randrange(480)
        c = rng.randint(185, 230)
        d.point((x, y), (c, c - 4, c - 12))
    d.rectangle([0, 0, 479, 479], outline=(150, 145, 135), width=6)
    return img


def label(img: Image.Image, text: str) -> Image.Image:
    d = ImageDraw.Draw(img)
    d.rectangle([0, 440, 479, 479], fill=(245, 158, 11))
    d.text((12, 452), f"SYNTHETIC SAMPLE IMAGE - {text}", fill=(15, 23, 42))
    return img


clean = label(base(), "no visible defect")
clean.save(OUT / "sample-clean.png")

crack = base()
d = ImageDraw.Draw(crack)
x, y = 90, 60
pts = [(x, y)]
for _ in range(14):
    x += rng.randint(8, 22)
    y += rng.randint(14, 26)
    pts.append((x, y))
d.line(pts, fill=(70, 62, 55), width=3)
label(crack, "hairline crack").save(OUT / "sample-crack.png")

glaze = base()
d = ImageDraw.Draw(glaze)
for _ in range(40):
    cx, cy, r = rng.randint(150, 330), rng.randint(140, 320), rng.randint(2, 5)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(120, 110, 98))
d.ellipse([300, 90, 380, 150], fill=(232, 226, 214))
label(glaze, "glaze pinholes / crawl").save(OUT / "sample-glaze.png")

samples = [
    {"id": "clean", "image": "/tile-samples/sample-clean.png", "title": "Clean tile",
     "documentedResult": {"label": "ok", "note": "No crack or glaze defect is drawn in this synthetic image."}},
    {"id": "crack", "image": "/tile-samples/sample-crack.png", "title": "Hairline crack",
     "documentedResult": {"label": "crack", "note": "A diagonal hairline crack was drawn deliberately."}},
    {"id": "glaze", "image": "/tile-samples/sample-glaze.png", "title": "Glaze pinholes",
     "documentedResult": {"label": "glaze_defect", "note": "Clusters of pinholes and a crawled patch were drawn deliberately."}},
]
(OUT / "samples.json").write_text(json.dumps(samples, indent=2), encoding="utf-8")
print("wrote", [p.name for p in OUT.iterdir()])
