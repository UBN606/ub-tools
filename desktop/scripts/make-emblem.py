#!/usr/bin/env python3
"""desktop/scripts/make-emblem.py: the UBN emblem, touched up and enlarged.

The emblem in the website's public/images/ubn-logo-mark.png is 360 px, and its
gold ring runs past the bottom of the image, so the bottom of the circle is cut
flat. This rebuilds it at 4x (1440 px):
  - the gold ring is redrawn as a perfect circle with the same proportions
    (outer radius 179.5, inner 157.5 at the original scale) and the same
    brushed-gold look, measured from the brand kit's profile-square.png: a
    six-lobed sheen between #BC8C28 and #F2DD8C, flat across the band with a
    thin bright rim on each edge, and fine horizontal brushing;
  - everything inside the ring (the blue disc, the circuit triangle, the gold
    side bars) is the original artwork enlarged 4x by Real-ESRGAN
    (RealESRGAN_x4plus, weights sha256 4fa0d389...682f1), saved as
    build/src/ubn-emblem-esrgan4x.png and blended into the new ring along its
    inner edge. Shrunk back to 360 px it matches the original at 26.8 dB PSNR,
    and 99% of the pixels it changed sit on edges the original already has:
    it sharpened the artwork, it did not invent any. Without that file this
    falls back to Lanczos.
Output: build/src/ubn-emblem-1440.png (transparent).

    python3 desktop/scripts/make-emblem.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

SRC = Path(__file__).resolve().parents[1] / 'build' / 'src' / 'ubn-emblem.png'
OUT = SRC.with_name('ubn-emblem-1440.png')

S = 1440                     # output size
C = S / 2                    # output centre
R_OUT, R_IN = 179.5, 157.5   # ring radii measured on the 360 px original
O_CX, O_CY = 180.0, 181.4    # ring centre on the original
K = (S / 2 - 2) / R_OUT      # scale: the ring fills the canvas with a 2 px margin

DARK = np.array([188, 140, 40.])
BRIGHT = np.array([242, 221, 140.])


def ring(seed=606):
    y, x = np.mgrid[0:S, 0:S].astype(float) + 0.5
    dx, dy = x - C, y - C
    r = np.hypot(dx, dy)
    th = np.arctan2(dy, dx)
    ro, ri = R_OUT * K, R_IN * K
    # analytic anti-aliased coverage of the band
    cov = np.clip(ro - r + 0.5, 0, 1) * np.clip(r - ri + 0.5, 0, 1)
    # six soft highlights, brightest straight up (as in the original)
    f = 0.5 + 0.5 * np.cos(6 * (th + np.pi / 2))
    col = DARK + (BRIGHT - DARK) * f[..., None]
    # flat across the band, with a thin bright rim on each edge (as measured)
    rim = np.exp(-((r - ri) / (0.9 * K)) ** 2) + np.exp(-((ro - r) / (0.9 * K)) ** 2)
    col = col + (255 - col) * (0.35 * rim)[..., None]
    # brushed metal: fine horizontal streaks
    rng = np.random.default_rng(seed)
    streak = rng.normal(0, 1, (S, S))
    streak = np.array(Image.fromarray(((streak * 18) + 128).clip(0, 255).astype('uint8')).filter(ImageFilter.BoxBlur(0)).resize((S // 24, S), Image.BILINEAR).resize((S, S), Image.BICUBIC)).astype(float)
    col *= (1 + (streak - 128) / 128 * 0.07)[..., None]
    rgba = np.dstack([col.clip(0, 255), cov * 255]).astype('uint8')
    return Image.fromarray(rgba, 'RGBA')


SR = SRC.with_name('ubn-emblem-esrgan4x.png')


def interior():
    src = Image.open(SRC).convert('RGBA')
    size = (round(src.width * K), round(src.height * K))
    if SR.exists():
        big = Image.open(SR).convert('RGBA').resize(size, Image.LANCZOS)
    else:
        big = src.resize(size, Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=2, percent=35, threshold=3))
    canvas = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    canvas.alpha_composite(big, (round(C - O_CX * K), round(C - O_CY * K)))
    # keep only what sits inside the ring, feathered into the ring's inner edge
    y, x = np.mgrid[0:S, 0:S].astype(float) + 0.5
    r = np.hypot(x - C, y - C)
    edge = (R_IN + 1.0) * K
    keep = np.clip((edge - r) / 3.0, 0, 1)
    a = np.array(canvas).astype(float)
    a[..., 3] *= keep
    return Image.fromarray(a.astype('uint8'), 'RGBA')


def main():
    out = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    out.alpha_composite(interior())
    out.alpha_composite(ring())
    out.save(OUT, optimize=True)
    print(f'make-emblem: {OUT.name} ({S}x{S})')


if __name__ == '__main__':
    main()
