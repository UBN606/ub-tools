#!/usr/bin/env python3
"""desktop/scripts/make-dmg-background.py: the install window shown when the .dmg opens.

A light background (Finder draws the icon labels in dark text), the instruction
in words, a gold arrow from the app to Applications, and the one-time
"Open Anyway" hint for unsigned builds. Writes build/dmg-background.png (660x400)
and build/dmg-background@2x.png (1320x800); on a Mac, scripts/stage.mjs joins them
into build/background.tiff so the window is sharp on Retina screens.
Icon positions must match "dmg.contents" in package.json: app at (180, 200),
Applications at (480, 200), 128 px icons.

    python3 desktop/scripts/make-dmg-background.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

BUILD = Path(__file__).resolve().parents[1] / 'build'
W, H = 660, 400
APP_X, APPS_X, ICON_Y = 180, 480, 200

PAPER_TOP, PAPER_BOTTOM = (252, 249, 241), (243, 237, 223)   # the Studio's parchment
INK, MUTED, GOLD = (29, 26, 19), (110, 100, 82), (196, 152, 58)

FONT_DIR = Path('/usr/share/fonts/opentype/inter')


def font(name, size):
    return ImageFont.truetype(str(FONT_DIR / name), size)


def draw(scale):
    w, h = W * scale, H * scale
    im = Image.new('RGB', (w, h))
    px = im.load()
    for y in range(h):
        t = y / (h - 1)
        c = tuple(round(a * (1 - t) + b * t) for a, b in zip(PAPER_TOP, PAPER_BOTTOM))
        for x in range(w):
            px[x, y] = c
    d = ImageDraw.Draw(im)
    s = lambda v: round(v * scale)

    title = 'Drag UBN Tools into Applications'
    f = font('Inter-SemiBold.otf', s(22))
    d.text((w / 2, s(58)), title, font=f, fill=INK, anchor='mm')

    # Arrow between the two icons (icons are 128 px, centred at ICON_Y).
    x0, x1, y = s(APP_X + 84), s(APPS_X - 84), s(ICON_Y)
    d.line((x0, y, x1 - s(14), y), fill=GOLD, width=s(5))
    d.polygon([(x1, y), (x1 - s(20), y - s(13)), (x1 - s(20), y + s(13))], fill=GOLD)

    hint = 'First time you open it: System Settings  ›  Privacy & Security  ›  Open Anyway'
    f2 = font('Inter-Regular.otf', s(12.5))
    d.text((w / 2, s(H - 46)), hint, font=f2, fill=MUTED, anchor='mm')
    return im


def main():
    BUILD.mkdir(parents=True, exist_ok=True)
    draw(1).save(BUILD / 'dmg-background.png', dpi=(72, 72))
    draw(2).save(BUILD / 'dmg-background@2x.png', dpi=(144, 144))
    print('make-dmg-background: build/dmg-background.png and @2x')


if __name__ == '__main__':
    main()
