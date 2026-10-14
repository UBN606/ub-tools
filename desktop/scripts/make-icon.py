#!/usr/bin/env python3
"""desktop/scripts/make-icon.py: build the Mac app icon from the Studio's mark.

The Studio's icon (app/icons/icon-1024.png) is a full-bleed square with white
corners, which looks wrong in the Dock. This keeps the gold mark exactly and
re-frames it on Apple's icon grid: a 824 px rounded-square body inside a
transparent 1024 px canvas, a navy gradient, a soft drop shadow and a gentle
gold sheen. Output: desktop/build/icon-mac.png (electron-builder makes the .icns).

    python3 desktop/scripts/make-icon.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'app' / 'icons' / 'icon-1024.png'
OUT = Path(__file__).resolve().parents[1] / 'build' / 'icon-mac.png'

N = 1024
BODY = 824            # Apple's macOS icon grid: 824 px body, 100 px margin
OFF = (N - BODY) // 2
SS = 4                # supersampling for smooth edges

NAVY = np.array([24, 31, 45.])
GOLD = np.array([197, 159, 74.])


def mark_alpha():
    """The gold mark as an alpha mask, anti-aliasing kept, cropped to its bounds."""
    im = np.array(Image.open(SRC).convert('RGB')).astype(float)
    d = GOLD - NAVY
    t = np.clip(((im - NAVY) @ d) / (d @ d), 0, 1)
    off_line = np.linalg.norm(im - (NAVY + t[..., None] * d), axis=2) > 18
    t[off_line] = 0  # the white corners and their edge pixels are not the mark
    a = Image.fromarray((t * 255).astype('uint8'), 'L')
    # Bounds from clearly-gold pixels only; a few faint strays would off-centre it.
    return a.crop(a.point(lambda v: 255 if v > 96 else 0).getbbox())


def squircle(size):
    """Superellipse (n=5) mask, close to Apple's continuous-corner shape."""
    s = size * SS
    y, x = np.mgrid[0:s, 0:s]
    u = np.abs((x + 0.5) / s * 2 - 1)
    v = np.abs((y + 0.5) / s * 2 - 1)
    inside = (u ** 5 + v ** 5) <= 1
    m = Image.fromarray((inside * 255).astype('uint8'), 'L')
    return m.resize((size, size), Image.LANCZOS)


def vertical_gradient(w, h, top, bottom):
    t = np.linspace(0, 1, h)[:, None, None]
    g = np.array(top, float) * (1 - t) + np.array(bottom, float) * t
    return Image.fromarray(np.repeat(g, w, axis=1).astype('uint8'), 'RGB')


def main():
    canvas = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    body_mask = squircle(BODY)

    # Soft shadow under the body, as macOS draws for app icons.
    shadow = Image.new('L', (N, N), 0)
    shadow.paste(body_mask, (OFF, OFF + 12))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18)).point(lambda v: int(v * 0.42))
    canvas.paste(Image.new('RGBA', (N, N), (0, 0, 0, 255)), (0, 0), shadow)

    # Body: navy, a touch lighter at the top, with a soft light from above.
    body = vertical_gradient(BODY, BODY, (36, 46, 68), (15, 20, 31)).convert('RGBA')
    hl = Image.new('L', (BODY, BODY), 0)
    ImageDraw.Draw(hl).ellipse((-BODY * 0.1, -BODY * 0.75, BODY * 1.1, BODY * 0.35), fill=22)
    hl = ImageChops.multiply(hl.filter(ImageFilter.GaussianBlur(120)), body_mask)
    body = Image.composite(Image.new('RGBA', (BODY, BODY), (255, 255, 255, 255)), body, hl)

    # The mark, 70% of the body wide, with a gold sheen from light to deep.
    mark = mark_alpha()
    w = int(BODY * 0.70)
    h = round(mark.height * w / mark.width)
    mark = mark.resize((w, h), Image.LANCZOS)
    gold = vertical_gradient(w, h, (240, 206, 112), (190, 146, 56)).convert('RGBA')
    glow = Image.new('L', (BODY, BODY), 0)
    # Optical centre: a downward chevron reads high, so sit it a little low.
    mx, my = (BODY - w) // 2, (BODY - h) // 2 + 14
    glow.paste(mark, (mx, my))
    glow = glow.filter(ImageFilter.GaussianBlur(22)).point(lambda v: int(v * 0.28))
    body = Image.composite(Image.new('RGBA', (BODY, BODY), (232, 197, 71, 255)), body, glow)
    body.paste(gold, (mx, my), mark)

    body.putalpha(body_mask)
    canvas.alpha_composite(body, (OFF, OFF))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUT)
    print(f'make-icon: {OUT.relative_to(ROOT)} ({N}x{N}, mark {w}x{h})')


if __name__ == '__main__':
    main()
