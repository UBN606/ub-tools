#!/usr/bin/env python3
"""
render.py — generate shareable quote-card PNGs from cards.json. Pillow only.

Design: dark ink background, warm off-white serif quote, muted gold accents.
Text only — no imagery, no wings/halos/church-art cliches. Fonts are system
DejaVu (bundled with most Linux distros); nothing is downloaded or embedded.

Text never overflows silently: the quote auto-fits from 72px down to 28px,
and if it still does not fit the script prints OVERFLOW and exits non-zero.

Usage:
  python3 render.py                          # render all cards, both sizes
  python3 render.py --cards 0,1,5           # render selected card indices
  python3 render.py --out ./out             # output directory
  python3 render.py --smoke                 # render cards 0-1 to /tmp/qc-smoke
"""
import argparse
import json
import os
import sys

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.stderr.write("Pillow is required: pip install pillow\n")
    sys.exit(2)

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = "/usr/share/fonts/truetype/dejavu"

BG = (14, 19, 27)        # deep ink
INK = (242, 239, 230)    # warm off-white
GOLD = (201, 162, 74)    # muted gold accent
DIM = (150, 155, 165)    # dim gray for attribution


def load_font(name, size):
    path = os.path.join(FONT_DIR, name)
    if not os.path.exists(path):
        # fall back to any DejaVu serif/sans found on the system
        for root, _, files in os.walk("/usr/share/fonts"):
            for f in files:
                if f.lower().startswith("dejavuserif") and f.lower().endswith(".ttf"):
                    path = os.path.join(root, f)
                    break
    return ImageFont.truetype(path, size)


def wrap(text, font, max_w):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if font.getlength(trial) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def draw_tracked(draw, xy, text, font, fill, tracking=0.22, anchor_center=True):
    """Draw letterspaced text (for small labels)."""
    x, y = xy
    widths = [font.getlength(ch) for ch in text]
    step = [w + font.size * tracking for w in widths]
    total = sum(step) - (font.size * tracking if step else 0)
    if anchor_center:
        x -= total / 2
    for ch, adv in zip(text, step):
        draw.text((x, y), ch, font=font, fill=fill)
        x += adv
    return total


def fit_quote(draw, quote, max_w, max_h):
    """Find the largest serif size (72..28) whose wrapped quote fits max_h."""
    for size in range(72, 27, -2):
        font = load_font("DejaVuSerif.ttf", size)
        lines = wrap(quote, font, max_w)
        lh = int(size * 1.45)
        if lh * len(lines) <= max_h:
            return font, lines, lh, size
    return None, None, None, None


def render_card(card, size):
    W, H = size
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    mx = 120
    max_w = W - 2 * mx

    # topic eyebrow
    small = load_font("DejaVuSans-Bold.ttf", 30)
    draw_tracked(d, (W / 2, 96), card["topic"].upper(), small, GOLD)

    # thin gold rule under eyebrow
    d.line([(W / 2 - 40, 150), (W / 2 + 40, 150)], fill=GOLD, width=2)

    # quote block: vertically centered in the remaining space
    top, bottom = (200, H - 260) if H > 1200 else (210, H - 250)
    font, lines, lh, used = fit_quote(d, card["quote"], max_w, bottom - top)
    if font is None:
        sys.stderr.write(f"OVERFLOW: card [{card['topic']}] ({card['citation']}) "
                         f"does not fit even at 28px\n")
        return None
    total_h = lh * len(lines)
    y = top + (bottom - top - total_h) / 2
    for line in lines:
        w = font.getlength(line)
        d.text(((W - w) / 2, y), line, font=font, fill=INK)
        y += lh

    # citation under the quote
    cite_font = load_font("DejaVuSans.ttf", 34)
    cite = card["citation"]
    cw = cite_font.getlength(cite)
    d.text(((W - cw) / 2, y + 34), cite, font=cite_font, fill=GOLD)

    # attribution footer
    attr = load_font("DejaVuSans.ttf", 26)
    draw_tracked(d, (W / 2, H - 110), "THE URANTIA BOOK", attr, DIM)

    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cards", default="all", help='"all" or comma-separated indices')
    ap.add_argument("--out", default=os.path.join(HERE, "out"))
    ap.add_argument("--smoke", action="store_true",
                    help="render cards 0 and 1 to /tmp/qc-smoke (both sizes)")
    args = ap.parse_args()

    cards = json.load(open(os.path.join(HERE, "cards.json")))
    if args.smoke:
        idx = [0, 1]
        out = "/tmp/qc-smoke"
    elif args.cards == "all":
        idx = list(range(len(cards)))
        out = args.out
    else:
        idx = [int(x) for x in args.cards.split(",")]
        out = args.out

    counters = {}
    made = []
    for i in idx:
        card = cards[i]
        n = counters.get(card["topic"], 0) + 1
        counters[card["topic"]] = n
        slug = f"{card['topic']}-{n:02d}"
        for label, wh in (("square", (1080, 1080)), ("story", (1080, 1920))):
            img = render_card(card, wh)
            if img is None:
                sys.exit(1)  # OVERFLOW already reported
            dest = os.path.join(out, label)
            os.makedirs(dest, exist_ok=True)
            path = os.path.join(dest, slug + ".png")
            img.save(path)
            made.append(path)
            print(f"wrote {path} {wh[0]}x{wh[1]}")
    print(f"{len(made)} PNGs rendered")


if __name__ == "__main__":
    main()
