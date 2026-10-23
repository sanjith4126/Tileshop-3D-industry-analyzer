"""CLI: python -m app.train  — trains one Isolation Forest per machine type on synthetic normal windows."""

from .model import MODELS_DIR, train_all

if __name__ == "__main__":
    for t, m in train_all().items():
        print(f"{t:<26} {m.version} threshold={m.threshold:.4f} windows={m.train_windows}")
    print(f"saved to {MODELS_DIR}")
