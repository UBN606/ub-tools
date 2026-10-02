# ub-tools/audio — word-level audio alignment for The Urantia Book

Open timestamp datasets that sync the book's exact text to audiobook
narrations — word by word. **Timestamps only, never audio**: you supply the
recording (see [SOURCES.md](SOURCES.md)); this repo never hosts or
redistributes audio, just as it never redistributes the book text.

## Primary use case: read-along

This data exists so a listener can **follow the text word-by-word,
highlighted in sync with the narration** — karaoke-style read-along
(the Studio app will consume it later). Everything about the design serves
that bar: **the highlighting must feel locked to the voice.**

Consequences of that bar:

- **Every book word gets a timestamp** — no gaps. Words the transcription
  missed are interpolated between neighbors and flagged (`x: false`), so the
  highlighter never stalls.
- **Millisecond precision** (3 decimals). Human perception of "locked" needs
  roughly ±100 ms; the pipeline targets far better on exactly-matched words.
- **The `x` flag is the contract**: `x: true` = timestamp measured from the
  transcription (trust it); `x: false` = estimate (a read-along UI may render
  it more softly, but it still lands within the word's neighborhood).
- **QC is judged by feel, not just stats**: beyond automated checks,
  `qc_clips.py` cuts random clips for a human to verify by ear that the
  highlight would land on the spoken word.

## What's here

| File | Purpose |
|---|---|
| `align.py` | The pipeline: audio + book text → word timestamps (`--paper N --audio file --out aligned/DocNNN.json`) |
| `qc.py` | Automated QC report for an aligned paper (schema, monotonicity, word-count vs book, speaking-rate sanity, confidence) |
| `qc_clips.py` | Cuts random clips for human listening spot-checks (needs ffmpeg) |
| `aligned/Doc001.json` | v1 sample: all of Paper 1, fully QC'd (see below) |
| `tests/test_align.py` | Aligner unit tests (`pytest`) |
| `tests/test_schema.mjs` | Dataset integrity tests (`node --test`) — incl. "no audio files shipped" |
| `SOURCES.md` | Audio sources surveyed, the voice-quality selection criterion, rights notes |

## Data format

Per-paper files, e.g. `aligned/Doc001.json`:

```json
{
  "paper": 1,
  "paper_title": "The Universal Father",
  "source": { "name": "Urantia Foundation unabridged reading (see SOURCES.md)",
              "audio_file": "U1.mp3" },
  "aligner": { "model": "faster-whisper small+base paragraph fusion (see README)",
               "language": "en" },
  "stats": { "paragraphs": 70, "book_words": 6155, "transcript_words": 6250,
             "exact_match_rate": 0.992 },
  "paragraphs": [
    { "ref": "1:0.1", "confidence": 0.983,
      "words": [
        { "w": "THE", "start": 6.200, "end": 6.280, "x": true },
        ...
      ] }
  ]
}
```

- `ref` — the book's paragraph reference (`Paper:Section.Paragraph`).
- `w` — the book's word, markup stripped, punctuation kept (timing is per
  spoken word; normalize before comparing, as `ub-verify.js` does).
- `start`/`end` — seconds, 3 decimals, strictly monotonic and non-overlapping
  within a paragraph, and paragraphs never overlap each other.
- `x` — `true` if the timestamp came from an exact transcription match
  (locked to the voice), `false` if interpolated (estimate).
- `confidence` — fraction of the paragraph's words with `x: true`.
- Alignments are valid **only** for the recording named in `source`. A
  different reading needs its own alignment run.

## Pipeline usage

Prereqs: the repo's book text (`node fetch-data.js` from the repo root),
Python 3.10+, and faster-whisper:

```
python3 -m venv ~/workspace/venvs/ub-audio
~/workspace/venvs/ub-audio/bin/pip install faster-whisper pytest
```

Align one paper (Paper 1 → `Doc001.json`; Paper 0 is the Foreword):

```
~/workspace/venvs/ub-audio/bin/python audio/align.py \
    --paper 1 --audio /path/to/U1.mp3 --out audio/aligned/Doc001.json
# --model tiny|base|small|medium  (default small; larger = slower, tighter)
```

Then QC it:

```
~/workspace/venvs/ub-audio/bin/python audio/qc.py audio/aligned/Doc001.json
node --test audio/tests/test_schema.mjs
~/workspace/venvs/ub-audio/bin/python -m pytest audio/tests/test_align.py
```

Human spot-check (the "locked to the voice" test):

```
python3 audio/qc_clips.py audio/aligned/Doc001.json /path/to/U1.mp3 \
    --out /tmp/ub-qc --n 10
# listen to the 10 clips; each word should land on its timestamp
```

How it works: faster-whisper transcribes with word timestamps; both streams
are normalized the way `ub-verify.js` `words()` does (lowercase, quote
folding, punctuation-insensitive) and aligned globally with a diff.
Alignment runs at **token level** so em-dash compounds ("God—God-seeking.")
map correctly however the transcription splits them; timings are then
aggregated back to the book's surface words. Exact matches take the measured
timestamps, the rest are interpolated proportionally and flagged. Spoken-but-
unwritten words (e.g. section titles the narrator reads aloud) are absorbed
as insertions and don't shift timings.

## v1 scope (honest)

- The **full pipeline** (align → QC → clips), **tested**.
- **One fully QC'd paper**: Paper 1 (70 paragraphs, 6,155 words, 45:04 of
  audio) — automated QC passes clean (99.2% of words exactly matched to
  measured transcription timestamps, minimum paragraph confidence 0.962);
  dual-model spot-check agrees; listening clips ready for a human pass.
- **Not** all 197 papers — see scaling below.

### QC worked example: the flags catch real problems

In the first Paper 1 pass, paragraph **1:3.5** came back at confidence 0.827
with nine consecutive words interpolated at a single timestamp. Investigating
with a second model (`base`) on the same audio showed the words *were*
spoken — the `small` model had silently dropped them. The flag pointed at a
real transcription defect, not a narration error.

A second find: em-dash compounds ("God—God-seeking.") misaligned whenever the
transcription split them differently than the book's surface words. The
aligner now works at **token level** (compounds expand to their normalized
tokens; timings aggregate back to surface words), which fixed the whole
1:2.x numbered-list section.

The v1 sample was finished with **paragraph-level model fusion**: Paper 1
was aligned with both `small` and `base`, and each paragraph kept the
higher-confidence version (62 small, 8 base), followed by a global
monotonicity pass. Result: exact match rate 98.9% → **99.2%**, minimum
paragraph confidence 0.827 → **0.962**. The single-model pipeline in
`align.py` is unchanged and reproducible; fusion is the documented QC repair
step for weak paragraphs.

**Timestamp precision** (the read-along bar): on 5,465 words where both
models independently produced exact matches, the median disagreement in word
*start* times is **10 ms** (p90: 70 ms) — comfortably inside the ±100 ms
window where highlighting feels locked to the voice.

Lesson for the full run: **low-confidence paragraphs are guilty until proven
innocent** — each one gets a second-model check before it ships.

## Full-book alignment run (October 2026)

All **197 papers** were aligned on the ASUS laptop (faster-whisper
`small`+`base` paragraph fusion, same pipeline as the v1 sample) against the
Urantia Foundation unabridged reading, and harvested into `aligned/`:

- **1,085,092 book words** with timestamps; **96.7%** carry measured
  transcription timestamps (`x: true`), the rest are interpolated estimates
  (`x: false`).
- Mean paper exact-match rate **96.9%**. Automated QC passed 189 papers.
- The 5 QC "FAIL"s (papers 31, 56, 120, 134, 144) are false alarms: each is
  only missing a decorative `* * *` separator paragraph
  (e.g. `31:10.21b`) that the narrator doesn't read — no spoken words are
  unaccounted for. The lowest-confidence paragraph in the set is `0:12.10`,
  the single word "*Acknowledgment*" (a heading absorbed into surrounding
  narration, flagged `x: false`).
- 1,358 QC warnings (speaking-rate / confidence flags) were logged during
  the run; the flagged paragraphs are kept with their `x` flags intact —
  low-confidence paragraphs remain guilty until proven innocent
  (`qc_clips.py` for the human listening pass).

## Scaling to all 197 papers

Measured on this VM (2 CPUs, faster-whisper `small`): Paper 1 (45.1 min
audio, 6,155 words) took **16.0 min** end to end — **2.8× realtime**.
The full book is 1,085,330 words / 14,596 paragraphs; at Paper 1's measured
136 wpm that's roughly **130 hours of audio**. Extrapolated:

- **This VM (CPU): ~47 hours wall clock** for all 197 papers with `small`.
- **Derek's HQ (GPU)**: faster-whisper runs ~10–20× realtime on CUDA →
  the whole book in roughly **one working day**, unattended.
- **Bigger model for the master pass**: `medium` tightens word boundaries
  (better read-along lock); the `x` flags already record per-word trust, so
  a re-run with a bigger model is a drop-in upgrade.
- The pipeline is per-paper and resumable: loop `--paper 0..196`, each
  writes its own `aligned/DocNNN.json`; `qc.py` gates each one before it
  ships.

## Voice quality is a selection criterion

Per Derek: read-along only works with a **good, non-robotic human voice**.
[SOURCES.md](SOURCES.md) prefers human-narrated sources and explicitly
deprioritizes synthetic TTS readings. The primary source is the Urantia
Foundation's professional unabridged reading.
