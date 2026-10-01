#!/bin/sh
# Full quote-cards test suite. Exits non-zero on any problem.
set -e
cd "$(dirname "$0")"

echo "== verification (word-for-word against the book text) =="
node verify-cards.mjs > /tmp/qc-verify.log 2>&1
tail -1 /tmp/qc-verify.log

echo "== schema tests =="
node --test test/cards.test.mjs

echo "== render smoke test =="
rm -rf /tmp/qc-smoke
python3 render.py --smoke
python3 - <<'EOF'
from PIL import Image
import glob
files = sorted(glob.glob('/tmp/qc-smoke/*/*.png'))
assert len(files) == 4, f"expected 4 PNGs (2 cards x 2 sizes), got {len(files)}"
for f in files:
    w, h = Image.open(f).size
    assert (w, h) in ((1080, 1080), (1080, 1920)), (f, (w, h))
    print("ok", f, f"{w}x{h}")
print("render smoke passed: 4 PNGs, exact dimensions, no overflow flag")
EOF

echo "ALL QUOTE-CARD TESTS PASSED"
