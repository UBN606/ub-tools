#!/usr/bin/env python3
"""
qc_clips.py — extract short audio clips for human listening spot-checks.

Picks N random paragraphs from an aligned paper, cuts a clip spanning each
paragraph (padded), and prints the aligned words so a listener can verify
the timestamps by ear. This is the human half of QC; see README.md.

Usage:
  python3 audio/qc_clips.py audio/aligned/Doc001.json /path/to/U1.mp3 \
      --out /tmp/ub-qc --n 10 --pad 2
Requires ffmpeg on PATH.
"""

import argparse
import json
import random
import subprocess
from pathlib import Path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("aligned")
    ap.add_argument("audio")
    ap.add_argument("--out", required=True)
    ap.add_argument("--n", type=int, default=10)
    ap.add_argument("--pad", type=float, default=2.0, help="seconds of padding each side")
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()

    data = json.loads(Path(args.aligned).read_text(encoding="utf-8"))
    rng = random.Random(args.seed)
    paras = rng.sample(data["paragraphs"], min(args.n, len(data["paragraphs"])))
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    for p in paras:
        ws = p["words"]
        start = max(0.0, ws[0]["start"] - args.pad)
        end = ws[-1]["end"] + args.pad
        clip = out / f"{p['ref'].replace(':', '_').replace('.', '_')}.mp3"
        subprocess.run(
            ["ffmpeg", "-y", "-v", "error", "-ss", f"{start:.3f}", "-to", f"{end:.3f}",
             "-i", args.audio, "-c", "copy", str(clip)], check=True)
        print(f"--- {p['ref']}  [{ws[0]['start']:.1f}s - {ws[-1]['end']:.1f}s] -> {clip.name}")
        print("    " + " ".join(x["w"] for x in ws[:40]) + (" ..." if len(ws) > 40 else ""))
    print(f"\n{len(paras)} clips in {out} — listen and confirm each word lands on its timestamp.")


if __name__ == "__main__":
    main()
