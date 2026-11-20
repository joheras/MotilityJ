#!/usr/bin/env python3
"""Draws the MotilityJ app icons (a Petri dish with a motility growth halo) into web/icons/. Needs Pillow."""
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parent.parent / "icons"
ACCENT = (15, 118, 110)


def draw(size, maskable=False, rounded=True):
    s = 4 * size  # supersample
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if maskable or not rounded:
        d.rectangle([0, 0, s, s], fill=ACCENT + (255,))
    else:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=ACCENT + (255,))
    c = s / 2
    R = s * (0.30 if maskable else 0.38)  # maskable: keep inside the 80% safe zone
    # dish: rim and agar
    d.ellipse([c - R, c - R, c + R, c + R], fill=(236, 246, 244, 255))
    r2 = R * 0.9
    d.ellipse([c - r2, c - r2, c + r2, c + r2], fill=(214, 233, 228, 255))
    # irregular growth halo spreading from the inoculation point
    halo = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    pts = []
    for i in range(72):
        a = 2 * math.pi * i / 72
        rr = R * (0.52 + 0.08 * math.sin(3 * a + 0.6) + 0.05 * math.sin(7 * a))
        pts.append((c + rr * math.cos(a), c + rr * math.sin(a)))
    hd.polygon(pts, fill=(205, 133, 63, 230))
    halo = halo.filter(ImageFilter.GaussianBlur(s * 0.003))
    img.alpha_composite(halo)
    d = ImageDraw.Draw(img)
    rc = R * 0.12
    d.ellipse([c - rc, c - rc, c + rc, c + rc], fill=(120, 63, 20, 255))
    d.ellipse([c - R, c - R, c + R, c + R], outline=(255, 255, 255, 255), width=max(1, int(s * 0.018)))
    return img.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    draw(192).save(OUT / "icon-192.png")
    draw(512).save(OUT / "icon-512.png")
    draw(512, maskable=True).save(OUT / "maskable-512.png")
    draw(180, rounded=False).convert("RGB").save(OUT / "apple-touch-icon.png")
    draw(48).save(OUT / "favicon-48.png")
    print("icons written to", OUT)
