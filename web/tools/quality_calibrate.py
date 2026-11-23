#!/usr/bin/env python3
"""Calibration data for the photo quality check (web/js/quality.js).

Samples plate photos from the Motilidad dataset (good photos: none should be flagged), writes synthetically
degraded copies of some of them (each should raise its own warning), and serves them together with web/ so
that tools/quality-calibrate.html can run the real quality.js on all of them in a browser:

    python3 web/tools/quality_calibrate.py --data /path/to/Motilidad
    # then open http://localhost:8765/tools/quality-calibrate.html

The images are written to a temporary folder (or --out), never into the repository.
Needs numpy and Pillow.
"""
from __future__ import annotations

import argparse
import functools
import http.server
import json
import random
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

WEB = Path(__file__).resolve().parent.parent
ROOT = WEB.parent
DEFAULT_DATA = ROOT / "Motilidad"

# kind -> warning codes expected (any of them); "" = the photo is good and must not be flagged; "?" = not scored.
KINDS = {
    "orig": "",
    "noise": "",  # sensor noise sigma 8: must not be taken for sharpness, nor for blur
    "jpeg": "",   # strong JPEG compression (quality 35)
    "blur3": "?",  # mild (σ 3 px at 1000 px, under 1 px at the analysis' 256 px): may or may not be flagged
    "blur6": "blur",
    "dark": "dark",
    "bright": "overexposed",
    "lowcontrast": "low_contrast",
    "glare": "glare",
    "cut": "plate_cut",
    "small": "plate_small",
    "offcentre": "off_centre plate_frame plate_small",
    "lowres": "low_resolution",
    "tilt": "tilt",
    "blank": "plate_not_found",
}


def sample(data: Path, n: int, seed: int) -> list[Path]:
    files = sorted(p for p in data.rglob("*") if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".tif", ".tiff"}
                   and "Labels" not in p.parts)
    random.Random(seed).shuffle(files)
    return files[:n]


def degrade(img: Image.Image, kind: str, rng: random.Random) -> Image.Image:
    a = np.asarray(img).astype(np.float32)
    h, w = a.shape[:2]
    s = min(w, h)
    if kind == "noise":
        return Image.fromarray(np.clip(a + np.random.default_rng(rng.randrange(1 << 30)).normal(0, 8, a.shape), 0, 255).astype(np.uint8))
    if kind == "blur3":
        return img.filter(ImageFilter.GaussianBlur(3 * s / 1000))
    if kind == "blur6":
        return img.filter(ImageFilter.GaussianBlur(6 * s / 1000))
    if kind == "dark":
        return Image.fromarray(np.clip(a * 0.2, 0, 255).astype(np.uint8))
    if kind == "bright":
        return Image.fromarray(np.clip(a * 2.5 + 20, 0, 255).astype(np.uint8))
    if kind == "lowcontrast":
        m = a.mean()
        return Image.fromarray(np.clip(m + (a - m) * 0.2, 0, 255).astype(np.uint8))
    if kind == "glare":
        # One or two lamp reflections: saturated core with a soft halo, inside the dish.
        yy, xx = np.mgrid[:h, :w]
        out = a.copy()
        for _ in range(rng.choice([1, 2])):
            ang, rad = rng.uniform(0, 6.28), rng.uniform(0.1, 0.6) * s / 2
            cx, cy = w / 2 + rad * np.cos(ang), h / 2 + rad * np.sin(ang)
            rx, ry = rng.uniform(0.07, 0.13) * s, rng.uniform(0.03, 0.06) * s
            d = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
            alpha = np.clip(1.6 - d, 0, 1)[..., None]
            out = out * (1 - alpha) + 255 * alpha
        return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
    if kind == "cut":
        k = rng.uniform(0.2, 0.35)  # fraction of the image width cut off one side
        side = rng.choice(["l", "r", "t", "b"])
        box = {"l": (int(k * w), 0, w, h), "r": (0, 0, int((1 - k) * w), h),
               "t": (0, int(k * h), w, h), "b": (0, 0, w, int((1 - k) * h))}[side]
        return img.crop(box)
    if kind in ("small", "offcentre"):
        f = 2.3 if kind == "small" else 1.35
        W, H = int(w * f), int(h * f)
        bg = np.random.default_rng(rng.randrange(1 << 30)).normal(30, 4, (H, W, 3))
        canvas = Image.fromarray(np.clip(bg, 0, 255).astype(np.uint8))
        x = (W - w) // 2 if kind == "small" else rng.choice([0, W - w])
        y = (H - h) // 2 if kind == "small" else rng.choice([0, H - h])
        canvas.paste(img, (x, y))
        return canvas
    if kind == "lowres":
        return img.resize((max(1, w * 250 // max(w, h)), max(1, h * 250 // max(w, h))), Image.LANCZOS)
    if kind == "tilt":
        return img.resize((int(w * 0.8), h), Image.LANCZOS)
    if kind == "jpeg":
        return img  # compressed when saved
    if kind == "blank":
        g = np.random.default_rng(rng.randrange(1 << 30)).normal(rng.uniform(40, 200), 6, (h, w, 1)).repeat(3, 2)
        return Image.fromarray(np.clip(g, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2))
    raise ValueError(kind)


def build(data: Path, out: Path, n: int, every: int, seed: int) -> None:
    out.mkdir(parents=True, exist_ok=True)
    rng = random.Random(seed)
    manifest = []
    for i, src in enumerate(sample(data, n, seed)):
        img = Image.open(src).convert("RGB")
        img.thumbnail((1024, 1024))
        kinds = ["orig"] + ([k for k in KINDS if k != "orig"] if i % every == 0 else [])
        for kind in kinds:
            name = f"{i:04d}-{kind}.jpg"
            im = img if kind == "orig" else degrade(img, kind, rng)
            im.save(out / name, quality=35 if kind == "jpeg" else 92)
            manifest.append({"file": name, "kind": kind, "source": src.name, "expect": KINDS[kind].split()})
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1))
    print(f"{len(manifest)} images in {out}")


class Handler(http.server.SimpleHTTPRequestHandler):
    calib: Path = Path(".")

    def translate_path(self, path):
        clean = path.split("?", 1)[0].split("#", 1)[0]
        if clean.startswith("/calib/"):
            return str(self.calib / clean[len("/calib/"):])
        return super().translate_path(path)

    def log_message(self, *args):
        pass


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", type=Path, default=DEFAULT_DATA, help="folder with the dataset photos (searched recursively)")
    ap.add_argument("--out", type=Path, default=None, help="folder for the calibration images (default: a temporary folder)")
    ap.add_argument("--n", type=int, default=240, help="number of dataset photos")
    ap.add_argument("--every", type=int, default=4, help="degraded copies of every N-th photo")
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--no-serve", action="store_true")
    args = ap.parse_args()
    out = args.out or Path(tempfile.mkdtemp(prefix="motilityj-quality-"))
    build(args.data, out, args.n, args.every, args.seed)
    if args.no_serve:
        return
    Handler.calib = out
    server = http.server.ThreadingHTTPServer(("127.0.0.1", args.port), functools.partial(Handler, directory=str(WEB)))
    print(f"Open http://localhost:{args.port}/tools/quality-calibrate.html  (Ctrl+C to stop)")
    server.serve_forever()


if __name__ == "__main__":
    main()
