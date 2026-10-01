# Audio sources for ub-tools/audio

**Dataset principle:** this directory stores TIMESTAMPS ONLY — never audio
files. Timestamps (word → seconds) are factual data, not copyrightable
expression, so the alignment dataset can be shared openly. You download the
audio yourself, under the source's own terms, then run `align.py` against it.

## Source selection criteria (Derek's call)

1. **Voice quality first.** The alignment data exists for read-along
   highlighting synced to the narration. A natural human voice is required;
   robotic or synthetic TTS readings are explicitly deprioritized — nobody
   wants to read along to a robot.
2. **Complete and unabridged**, one consistent voice across all 197 papers.
3. **Freely downloadable** as files (not stream-only), ideally one file per
   paper, so alignment is reproducible.

## Survey (October 2026)

| Source | Voice | Access | Verdict |
|---|---|---|---|
| **Urantia Foundation unabridged reading** — https://www.urantia.org/audio and https://www.urantia.org/urantia-book/listen-urantia-book | Human narrator, professional studio recording | Free download (10 zip files, ~1.2 GB total); also on Spotify | **PRIMARY SOURCE.** The standard complete reading. Per-paper MP3s mirrored at https://truthbook.com/wp-content/uploads/AudioFiles/UF24K/ as `U0.mp3` (Foreword) … `U196.mp3` (Paper 196) — verified live Oct 2026 |
| `urantiapapers` YouTube channel (youtube.com/@urantiapapers) | Human | Stream-only, per-paper videos | Fallback. "Earliest recording of every paper"; not cleanly downloadable per-paper |
| Urantia Book Fellowship members site (members.urantiabook.org/Urantia-Book-Audio) | Human | Paragraph-level embedded clips ("you can also share them") | Interesting for read-along, but embedded players, not bulk files |
| Merritt Horn reading (Fellowship store) | Human | Comes with book purchase only | Not freely downloadable — excluded |
| UBook4U (ubook4u.com) | Google TTS, two AI voices | Web player | **Deprioritized: synthetic voices** — fails the voice-quality criterion |
| Uversa Press audio DVD | Human | Commercial product | Not freely downloadable — excluded |

## Rights notes

- **The English text** is public domain in the US (2001 *Maaherra* decision;
  international copyright expired 2006). The Urantiapedia edition this repo
  downloads carries CC BY-SA 4.0 on its markup — either way, we never
  redistribute text here.
- **The recordings** are a separate work: the performance copyright belongs
  to whoever produced them (the Foundation, for the primary source). "Free
  download" is not an open license. Download the audio yourself under the
  Foundation's terms; this repo never hosts or links direct hotlinks as a
  redistribution mechanism — only documents where to get them.
- **The timestamps** in `aligned/*.json` are our own computed data. They are
  valid ONLY for the recording they were aligned against (see the `source`
  field in each file); a different reading needs its own alignment run.

## Reproducing the sample

Paper 1 (`audio/aligned/Doc001.json`) was aligned against the Foundation
recording's Paper 1 file (`U1.mp3`, 45:04, downloaded Oct 2026 from the
TruthBook mirror of the Foundation files). To reproduce:

```
# 1. Get the audio yourself from https://www.urantia.org/audio
#    (or the TruthBook mirror page above) — e.g. U1.mp3 for Paper 1.
# 2. Make sure the book text is present:
node fetch-data.js
# 3. Align (needs the venv + faster-whisper, see README.md):
~/workspace/venvs/ub-audio/bin/python audio/align.py \
    --paper 1 --audio /path/to/U1.mp3 --out audio/aligned/Doc001.json
```
