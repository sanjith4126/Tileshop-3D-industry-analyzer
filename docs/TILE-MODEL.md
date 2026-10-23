# Tile defect model — how to add one

The tile inspection pipeline is **model-agnostic** (ONNX Runtime). No model ships with this demo, so
uploads show **MODEL NOT CONFIGURED** and are stored without a result. Nothing is ever faked.

## Files expected

Set `TILE_MODEL_PATH` (in `.env`, read by the ML service) to the `.onnx` file. In the same folder:

| File | Content |
|---|---|
| `model.onnx` | Image classifier. Input: one float32 tensor `[1, 3, H, W]` (NCHW, RGB). Output: logits `[1, N]`. |
| `labels.json` | JSON array of the N class names in output order, e.g. `["ok", "crack", "glaze_defect", "chip"]` |
| `model-card.json` | `{"name", "version", "inputSize": [H, W], "mean": [r,g,b], "std": [r,g,b], "trainingData", "metrics", "intendedUse", "limitations"}` |

Preprocessing applied by the service: RGB, resize to `inputSize`, scale to 0–1, subtract `mean`,
divide by `std`, softmax over the outputs. Restart the ML service after changing the model.

## Training one later (outline)

1. Collect labelled images from the real line (same camera, lighting and tile types as production);
   include plenty of "ok" tiles and every defect class you care about. Keep a held-out test set from
   different days/batches.
2. Fine-tune a small pretrained CNN (e.g. MobileNetV3 or ResNet-18 in PyTorch/torchvision) with
   augmentation (flips, small rotations, brightness).
3. Evaluate per class (precision/recall, confusion matrix) on the held-out set; record it in the model card.
4. Export: `torch.onnx.export(model, torch.randn(1, 3, H, W), "model.onnx", input_names=["image"], output_names=["logits"])`.
5. Write `labels.json` and `model-card.json`, set `TILE_MODEL_PATH`, restart the ML service.

## Public datasets — check the licence

The **MVTec AD** dataset has a "tile" category, but it is licensed **CC BY-NC-SA 4.0 (non-commercial)**:
fine for learning, not for a commercial deployment. Any dataset must be checked for licence terms and
for how well it matches the real production line before use.

## Sample demo mode

`frontend/public/tile-samples/` holds three synthetic images drawn by
`ml-service/scripts/make_tile_samples.py` with documented labels. The UI shows them as
**SAMPLE RESULT — not a model prediction**.
