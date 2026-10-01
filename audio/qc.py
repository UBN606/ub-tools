#!/usr/bin/env python3
"""
qc.py — QC report for an aligned paper JSON.

Checks:
  * schema shape (paper, paragraphs[].ref/words[]/confidence, w/start/end)
  * timestamps strictly monotonic and non-overlapping within each paragraph
  * aligned word count == book word count per paragraph (normalized)
  * speaking-rate sanity per paragraph (flags gross slips)
  * confidence distribution + low-confidence paragraph list

Usage:
  python3 audio/qc.py audio/aligned/Doc001.json [--min-confidence 0.85]
Prints a report; exit 1 if any hard failure.
"""

import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
PAPERS_DIR = REPO / "source-texts" / "papers"

QUOTES = '“”„‟"‘’‚‛\'`´'


def normalize_word(w: str) -> str:
    w = w.translate(str.maketrans("", "", QUOTES))
    w = unicodedata.normalize("NFKC", w).lower()
    w = w.replace("—", " ").replace("–", " ").replace("-", " ")
    return re.sub(r"[^\w\s]", "", w, flags=re.UNICODE).strip()


def book_paras(paper_num: int):
    doc = json.loads((PAPERS_DIR / f"Doc{paper_num:03d}.json").read_text(encoding="utf-8"))
    out = {}
    for sec in doc["sections"]:
        for p in sec["pars"]:
            t = re.sub(r"<[^>]+>", " ", p["par_content"]).replace("*", "")
            t = re.sub(r"\s+", " ", t).strip()
            words = [w for w in (normalize_word(x) for x in t.split()) if w]
            out[p["par_ref"]] = words
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("aligned", help="Aligned paper JSON")
    ap.add_argument("--min-confidence", type=float, default=0.85)
    args = ap.parse_args()

    data = json.loads(Path(args.aligned).read_text(encoding="utf-8"))
    book = book_paras(data["paper"])
    fails, warns = [], []

    paras = data.get("paragraphs", [])
    if [p["ref"] for p in paras] != list(book.keys()):
        fails.append("paragraph ref sequence does not match the book text")

    confs = []
    for p in paras:
        ref, ws, conf = p["ref"], p["words"], p["confidence"]
        confs.append(conf)
        bw = book.get(ref, [])
        aw = [w for w in (normalize_word(x["w"]) for x in ws) if w]
        if len(aw) != len(bw):
            fails.append(f"{ref}: aligned words {len(aw)} != book words {len(bw)}")
        if [normalize_word(x["w"]) for x in ws if normalize_word(x["w"])] != bw:
            # compare normalized sequences, ignoring empties dropped on both sides
            fails.append(f"{ref}: aligned word sequence differs from book text")
        prev_end = -1.0
        for x in ws:
            if not (isinstance(x["start"], (int, float)) and isinstance(x["end"], (int, float))):
                fails.append(f"{ref}: non-numeric timestamp"); break
            if x["start"] < 0 or x["end"] < x["start"]:
                fails.append(f"{ref}: bad interval {x['start']}-{x['end']}"); break
            if x["start"] < prev_end - 1e-9:
                fails.append(f"{ref}: timestamps not monotonic at '{x['w']}'"); break
            prev_end = x["end"]
        # speaking-rate sanity: 1.2 - 4.5 words/sec is the plausible band
        if ws:
            span = ws[-1]["end"] - ws[0]["start"]
            wps = len(ws) / span if span > 0 else 0
            if not (1.2 <= wps <= 4.5):
                warns.append(f"{ref}: odd speaking rate {wps:.2f} w/s over {span:.1f}s")
        if conf < args.min_confidence:
            warns.append(f"{ref}: confidence {conf} below {args.min_confidence}")

    # cross-paragraph: no overlaps
    prev_end, prev_ref = -1.0, None
    for p in paras:
        if p["words"]:
            s = p["words"][0]["start"]
            if s < prev_end - 1e-9:
                fails.append(f"{p['ref']}: starts ({s}) before {prev_ref} ends ({prev_end})")
            prev_end = p["words"][-1]["end"]
            prev_ref = p["ref"]

    import statistics
    print(f"paper {data['paper']} '{data.get('paper_title')}' — {len(paras)} paragraphs")
    print(f"source: {data.get('source', {}).get('name')} / {data.get('source', {}).get('audio_file')}")
    print(f"aligner: {data.get('aligner', {}).get('model')}")
    if "stats" in data:
        s = data["stats"]
        print(f"book words: {s['book_words']}, transcript words: {s['transcript_words']}, "
              f"exact match rate: {s['exact_match_rate']:.1%}")
    if confs:
        print(f"confidence: min {min(confs):.3f}  median {statistics.median(confs):.3f}  "
              f"mean {statistics.fmean(confs):.3f}")
    lo = [p["ref"] for p in paras if p["confidence"] < args.min_confidence]
    print(f"paragraphs below {args.min_confidence}: {len(lo)}" + (f" ({', '.join(lo[:12])}{'...' if len(lo) > 12 else ''})" if lo else ""))
    for w in warns:
        print("WARN:", w)
    for f in fails:
        print("FAIL:", f)
    print("RESULT:", "FAIL" if fails else "PASS")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
