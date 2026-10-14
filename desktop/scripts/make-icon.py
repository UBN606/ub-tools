#!/usr/bin/env python3
"""desktop/scripts/make-icon.py: build the Mac app icon from the UBN emblem.

The emblem (gold ring, blue circuit triangle) is the brand's own mark: the
website's favicon and every profile picture use it (ub-iq growth/brand-kit/
DESIGN.md, section 4). build/src/ubn-emblem.png is that emblem, cut from the
website's public/images/ubn-logo-mark.png without the wordmark. This places it
on Apple's icon grid: a 824 px rounded-square body in the brand navy inside a
transparent 1024 px canvas, a soft shadow, and a faint blue glow behind the
emblem. Output: desktop/build/icon-mac.png (electron-builder makes the .icns).

The emblem source is 360 px, so it is enlarged about 2x for the 1024 px master;
it stays sharp at Dock and Finder sizes. Do not AI-upscale it (the brand kit
records an AI upscaler corrupting UBN artwork); swap in a larger original if one
turns up.

    python3 desktop/scripts/make-icon.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
EMBLEM = Path(__file__).resolve().parents[1] / 'build' / 'src' / 'ubn-emblem.png'
OUT = Path(__file__).resolve().parents[1] / 'build' / 'icon-mac.png'

N = 1024
BODY = 824            # Apple's macOS icon grid: 824 px body, 100 px margin
OFF = (N - BODY) // 2
SS = 4                # supersampling for smooth edges

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

    # Body: the brand navy (navy-light #141b2d down to navy #0a0e1a), lit softly from above.
    body = vertical_gradient(BODY, BODY, (26, 35, 58), (10, 14, 26)).convert('RGBA')
    hl = Image.new('L', (BODY, BODY), 0)
    ImageDraw.Draw(hl).ellipse((-BODY * 0.1, -BODY * 0.75, BODY * 1.1, BODY * 0.35), fill=18)
    hl = ImageChops.multiply(hl.filter(ImageFilter.GaussianBlur(120)), body_mask)
    body = Image.composite(Image.new('RGBA', (BODY, BODY), (255, 255, 255, 255)), body, hl)

    # The UBN emblem, 86% of the body, with a faint blue glow from its circuit triangle.
    emblem = Image.open(EMBLEM).convert('RGBA')
    w = int(BODY * 0.86)
    h = round(emblem.height * w / emblem.width)
    emblem = emblem.resize((w, h), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
    ex, ey = (BODY - w) // 2, (BODY - h) // 2
    glow = Image.new('L', (BODY, BODY), 0)
    glow.paste(emblem.getchannel('A'), (ex, ey))
    glow = glow.filter(ImageFilter.GaussianBlur(28)).point(lambda v: int(v * 0.35))
    body = Image.composite(Image.new('RGBA', (BODY, BODY), (33, 150, 243, 255)), body, glow)
    body.alpha_composite(emblem, (ex, ey))

    body.putalpha(ImageChops.multiply(body.getchannel('A'), body_mask))
    canvas.alpha_composite(body, (OFF, OFF))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUT)
    print(f'make-icon: {OUT.relative_to(ROOT)} ({N}x{N}, emblem {w}x{h})')


if __name__ == '__main__':
    main()
