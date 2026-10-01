#!/usr/bin/env python3
"""
align.py — word-level forced alignment of a Urantia Book audiobook paper
against the book's exact paragraph text.

The dataset stores TIMESTAMPS ONLY, never audio. You supply the audio file
(see SOURCES.md); the book text comes from the repo's source-texts/
(downloaded once via ../fetch-data.js, never redistributed).

Pipeline:
  1. Load the paper's paragraphs from source-texts/papers/DocNNN.json.
  2. Transcribe the audio with faster-whisper (word_timestamps=True).
  3. Tokenize both streams the way ub-verify.js words() does (lowercase,
     quote folding, punctuation-insensitive). Alignment runs at TOKEN level
     so em-dash compounds ("God—God-seeking.") map correctly however the
     transcription splits them; timings are then aggregated back to the
     book's surface words.
  4. Every book word gets (start, end): exact token matches take the
     measured whisper timestamps; the rest are interpolated proportionally
     and flagged x=false.
  5. Write audio/aligned/DocNNN.json (see README.md "Data format").

Usage:
  ~/workspace/venvs/ub-audio/bin/python audio/align.py \
      --paper 1 --audio /path/to/U1.mp3 --out audio/aligned/Doc001.json
  Options: --model small (tiny|base|small|medium|large-v3), --language en

Paper numbering: Doc000 = Foreword (audio U0.mp3), Doc001 = Paper 1 (U1.mp3), ...
"""

import argparse
import difflib
import json
import re
import sys
import unicodedata
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
PAPERS_DIR = REPO / "source-texts" / "papers"

QUOTES = '“”„‟"‘’‚‛\'`´'


def strip_markup(t: str) -> str:
    t = re.sub(r"<[^>]+>", " ", t)
    t = t.replace("*", "")          # footnote markers, as ub-verify.js does
    return re.sub(r"\s+", " ", t).strip()


def tokenize_surface(s: str):
    """Normalized tokens for one surface word, mirroring ub-verify.js words()
    (lowercase, quote folding, dashes to spaces, punctuation dropped).
    Compounds like 'God—God-seeking.' expand to ['god', 'god', 'seeking']."""
    t = s.translate(str.maketrans("", "", QUOTES))
    t = unicodedata.normalize("NFKC", t).lower()
    t = t.replace("—", " ").replace("–", " ").replace("-", " ")
    t = re.sub(r"[^\w\s]", "", t, flags=re.UNICODE)
    return [p for p in t.split() if p]


def normalize_word(w: str) -> str:
    return " ".join(tokenize_surface(w))


def load_paper(paper_num: int, papers_dir=None):
    """Returns (title, paras) where each para is
    (ref, surface_words, token_list) with token_list[i] = tokens of word i."""
    papers_dir = Path(papers_dir) if papers_dir else PAPERS_DIR
    doc = json.loads((papers_dir / f"Doc{paper_num:03d}.json").read_text(encoding="utf-8"))
    paras = []
    for sec in doc["sections"]:
        for p in sec["pars"]:
            text = strip_markup(p["par_content"])
            surf, toks = [], []
            for s in text.split():
                ts = tokenize_surface(s)
                if ts:
                    surf.append(s)
                    toks.append(ts)
            if surf:
                paras.append((p["par_ref"], surf, toks))
    return doc.get("paper_title", ""), paras


def transcribe(audio_path: str, model_name: str, language: str,
                device: str = "cpu", compute_type: str = "int8"):
    from faster_whisper import WhisperModel
    model = WhisperModel(model_name, device=device, compute_type=compute_type)
    segments, _info = model.transcribe(
        audio_path, language=language, word_timestamps=True, vad_filter=False
    )
    words = []  # (norm, start, end)
    for seg in segments:
        for w in (seg.words or []):
            for tok in tokenize_surface(w.word):
                words.append((tok, round(w.start, 3), round(w.end, 3)))
    # whisper gives one timestamp per surface word; tokens from one whisper
    # word share its span (refined by proportional mapping below)
    return words


def align_tokens(book_toks, whisper):
    """Align normalized token streams; return per-book-token (start, end, exact)."""
    w_norms = [n for n, _, _ in whisper]
    sm = difflib.SequenceMatcher(None, book_toks, w_norms, autojunk=False)
    timed = [None] * len(book_toks)

    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            for bi, wi in zip(range(i1, i2), range(j1, j2)):
                _, s, e = whisper[wi]
                timed[bi] = (s, e, True)
        elif tag == "replace":
            t0 = whisper[j1][1] if j1 < j2 else None
            t1 = whisper[j2 - 1][2] if j1 < j2 else None
            blen = i2 - i1
            weights = [max(len(book_toks[b]), 1) for b in range(i1, i2)]
            tot = sum(weights)
            if t0 is not None and blen:
                cur = t0
                for k, b in enumerate(range(i1, i2)):
                    span = (t1 - t0) * weights[k] / tot
                    timed[b] = (round(cur, 3), round(cur + span, 3), False)
                    cur += span
            else:
                for b in range(i1, i2):
                    timed[b] = (None, None, False)
        elif tag == "delete":
            for b in range(i1, i2):
                timed[b] = (None, None, False)
        # 'insert' (whisper-only words, e.g. spoken section titles): ignored

    # interpolate None gaps between anchored neighbors
    n = len(timed)
    i = 0
    while i < n:
        if timed[i][0] is not None:
            i += 1
            continue
        j = i
        while j < n and timed[j][0] is None:
            j += 1
        left = timed[i - 1] if i > 0 else None
        right = timed[j] if j < n else None
        gap = j - i
        if left and right and left[0] is not None and right[0] is not None:
            t0, t1 = left[1], right[0]
            if t1 < t0:
                t1 = t0
            for k in range(gap):
                s = t0 + (t1 - t0) * k / gap
                e = t0 + (t1 - t0) * (k + 1) / gap
                timed[i + k] = (round(s, 3), round(e, 3), False)
        elif left and left[0] is not None:
            for k in range(gap):
                timed[i + k] = (left[1], left[1], False)
        elif right and right[0] is not None:
            for k in range(gap):
                timed[i + k] = (right[0], right[0], False)
        else:
            for k in range(gap):
                timed[i + k] = (0.0, 0.0, False)
        i = j
    return timed


def enforce_monotonic(timed):
    out = []
    prev_end = 0.0
    for s, e, exact in timed:
        s = max(s, prev_end)
        e = max(e, s)
        out.append((round(s, 3), round(e, 3), exact))
        prev_end = e
    return out


def main():
    ap = argparse.ArgumentParser(description="Align one UB audiobook paper to the book text.")
    ap.add_argument("--paper", type=int, required=True, help="Paper number (0=Foreword)")
    ap.add_argument("--audio", required=True, help="Audio file for the paper (you supply it)")
    ap.add_argument("--out", required=True, help="Output JSON path")
    ap.add_argument("--model", default="small", help="faster-whisper model (default: small)")
    ap.add_argument("--language", default="en")
    ap.add_argument("--device", default="cpu", help="faster-whisper device: cpu or cuda")
    ap.add_argument("--compute-type", default="int8", dest="compute_type",
                    help="faster-whisper compute type (default: int8)")
    ap.add_argument("--papers-dir", default=None, dest="papers_dir",
                    help="directory of DocNNN.json paper files (default: <repo>/source-texts/papers)")
    args = ap.parse_args()

    title, paras = load_paper(args.paper, papers_dir=args.papers_dir)
    # flatten to tokens, remembering each token's surface word
    book_toks, bounds, refs, surfaces = [], [], [], []
    for ref, surf, toks in paras:
        bounds.append((len(book_toks), None))
        refs.append(ref)
        surfaces.append(surf)
        for ts in toks:
            book_toks.extend(ts)
        bounds[-1] = (bounds[-1][0], len(book_toks))
    n_surf_total = sum(len(s) for s in surfaces)
    print(f"paper {args.paper} '{title}': {len(paras)} paragraphs, "
          f"{n_surf_total} words ({len(book_toks)} tokens)", flush=True)

    print("transcribing...", flush=True)
    whisper = transcribe(args.audio, args.model, args.language,
                         device=args.device, compute_type=args.compute_type)
    print(f"transcript: {len(whisper)} tokens", flush=True)

    tok_timed = enforce_monotonic(align_tokens(book_toks, whisper))

    # aggregate token timings back to surface words
    paragraphs = []
    total_exact = 0
    for pi, (ref, surf, toks) in enumerate(paras):
        a, b = bounds[pi]
        words = []
        pos = a
        exact_words = 0
        for si, ts in enumerate(toks):
            span = tok_timed[pos:pos + len(ts)]
            s = span[0][0]
            e = span[-1][1]
            is_exact = all(x[2] for x in span)
            # "x": true = timestamp measured from the transcription (locked to
            # the voice); false = interpolated estimate.
            words.append({"w": surf[si], "start": s, "end": e, "x": is_exact})
            exact_words += is_exact
            pos += len(ts)
        conf = round(exact_words / max(len(surf), 1), 3)
        total_exact += exact_words
        paragraphs.append({"ref": ref, "confidence": conf, "words": words})

    result = {
        "paper": args.paper,
        "paper_title": title,
        "source": {
            "name": "Urantia Foundation unabridged reading (see SOURCES.md)",
            "audio_file": Path(args.audio).name,
        },
        "aligner": {"model": f"faster-whisper {args.model}", "language": args.language},
        "stats": {
            "paragraphs": len(paragraphs),
            "book_words": n_surf_total,
            "transcript_words": len(whisper),
            "exact_match_rate": round(total_exact / max(n_surf_total, 1), 4),
        },
        "paragraphs": paragraphs,
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote {out} — exact match rate {result['stats']['exact_match_rate']:.1%}")


if __name__ == "__main__":
    sys.exit(main())
