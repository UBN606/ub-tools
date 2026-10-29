#!/usr/bin/env python3
"""
make_episode.py — turn one Urantia Book Network article into a YouTube episode.

Two steps, so a person reviews the words before anything is spoken:

  1. prepare   fetch the article and write episodes/work/<slug>/script.md
               (the narration) and visuals.json (one video prompt per chapter)
  2. build     check every quote with ub-verify.js, speak the script with a
               local TTS voice (Kokoro, Apache-2.0), time captions with
               audio/align.py, render quote cards with quote-cards/render.py,
               get background clips from ComfyUI's API, add the closing still
               and music, and write the video, captions and description

Usage:
  python episodes/make_episode.py list [words]
  python episodes/make_episode.py prepare <slug or title words> [--article-file FILE]
  python episodes/make_episode.py build <slug> [--music FILE --music-credit TEXT]
        [--end-still FILE] [--voice af_heart] [--speed 1.0] [--no-comfy]
        [--comfy http://127.0.0.1:8188] [--workflow episodes/ltx_workflow_api.json]

Everything is cached under episodes/work/<slug>/: rerunning build only redoes
what changed (an edited paragraph is re-spoken; a deleted clip is regenerated).
The build stops, and makes no video, if any quote fails the check.
"""
import argparse
import copy
import hashlib
import importlib.util
import json
import math
import random
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import wave
from html.parser import HTMLParser
from pathlib import Path

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(errors="replace")  # a Windows console can't print every curly quote
    except Exception:
        pass

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
WORK = HERE / "work"
ARTICLES = REPO / "app" / "ubn-articles.json"
PRONOUNCE = REPO / "app" / "pronounce.json"
PAPERS = REPO / "source-texts" / "papers"
DEFAULT_WORKFLOW = HERE / "ltx_workflow_api.json"

W, H, FPS = 1920, 1080, 30
SR = 24000                      # Kokoro's sample rate
GAP_PARA, GAP_CHAPTER, LEAD, TAIL = 0.45, 1.0, 0.5, 1.0
BG_HEX = "0x0e131b"             # quote-cards/render.py's deep ink

# same citation pattern as ub-verify.js
CITE_RE = re.compile(r"\s*\(([^()]*?\d+:\d+\.\d+[^()]*?)\)")
REF_RE = re.compile(r"\d+:\d+\.\d+")

DEFAULT_STYLE = ("slow cinematic camera drift, vast luminous space, soft volumetric light, "
                 "gentle nebula clouds and distant stars, calm and reverent mood, photorealistic, "
                 "high detail, no text")
DEFAULT_NEGATIVE = ("text, letters, words, watermark, logo, faces, people, crowds, wings, halos, "
                    "angels, church, cross, religious iconography, fire, demons, blurry, distorted, "
                    "low quality, flicker")


def say(msg=""):
    print(msg, flush=True)


def stop(msg):
    sys.stderr.write("\nSTOPPED: " + msg.strip() + "\n")
    sys.exit(1)


# ---------------------------------------------------------------- articles

def load_articles():
    d = json.loads(ARTICLES.read_text(encoding="utf-8"))
    return d["site"], d["articles"]


def find_article(query):
    site, arts = load_articles()
    q = query.strip().lower()
    for a in arts:
        if a["slug"] == q:
            return site, a
    words = q.split()
    hits = [a for a in arts if all(w in (a["slug"] + " " + a["title"]).lower() for w in words)]
    if len(hits) == 1:
        return site, hits[0]
    if not hits:
        stop(f'no article matches "{query}". Try: python episodes/make_episode.py list <word>')
    say(f'"{query}" matches {len(hits)} articles; use the exact slug (first column):')
    for a in hits[:30]:
        say(f"  {a['slug']:<55} {a['title']}")
    sys.exit(1)


def cmd_list(args):
    _, arts = load_articles()
    words = [w.lower() for w in args.words]
    for a in arts:
        if all(w in (a["slug"] + " " + a["title"]).lower() for w in words):
            say(f"  {a['slug']:<55} {a['title']}")


# ---------------------------------------------------------------- prepare

class ArticleHTML(HTMLParser):
    """Collects headings, paragraphs, quotes and list items, grouped by the
    <article>/<main> they sit in, skipping menus, footers and scripts."""
    SKIP = {"script", "style", "nav", "header", "footer", "aside", "form", "noscript", "svg",
            "figure", "button", "iframe", "select"}
    BLOCK = {"h1", "h2", "h3", "h4", "p", "li"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack, self.skip, self.quote = [], 0, 0
        self.container, self.next_container = -1, 0
        self.cur, self.blocks = None, []

    def handle_starttag(self, tag, attrs):
        if tag in ("br",):
            if self.cur is not None:
                self.cur[2].append(" ")
            return
        if tag in ("img", "hr", "meta", "link", "input", "source"):
            return
        self.stack.append(tag)
        if tag in self.SKIP:
            self.skip += 1
        elif tag in ("article", "main") and self.container < 0:
            self.container = self.next_container
            self.next_container += 1
            self.stack[-1] = tag + "*"
        elif tag == "blockquote":
            self.quote += 1
        elif tag in self.BLOCK and not self.skip:
            if self.cur is not None and self.cur[0] == "p":
                self.finish()          # <p> left unclosed before the next block
            if self.cur is None:
                self.cur = [tag, self.quote > 0, []]

    def finish(self):
        text = re.sub(r"\s+", " ", "".join(self.cur[2])).strip()
        if text:
            self.blocks.append((self.container, self.cur[0], self.cur[1], text))
        self.cur = None

    def handle_endtag(self, tag):
        if tag not in [t.rstrip("*") for t in self.stack]:
            return
        while self.stack:
            t = self.stack.pop()
            name = t.rstrip("*")
            if name in self.SKIP:
                self.skip -= 1
            elif t.endswith("*"):
                self.container = -1
            elif name == "blockquote":
                self.quote -= 1
            if self.cur is not None and name == self.cur[0]:
                self.finish()
            if name == tag:
                break

    def handle_data(self, data):
        if self.cur is not None and not self.skip:
            self.cur[2].append(data)


STOP_HEADINGS = re.compile(r"^(related|share|comments?|leave a (reply|comment)|about the author|"
                           r"subscribe|you may also like|more articles|recent posts|tags?)\b", re.I)


def article_to_script(page, title):
    p = ArticleHTML()
    p.feed(page)
    blocks = p.blocks
    if not blocks:
        return None
    sizes = {}
    for c, tag, _, text in blocks:
        if tag in ("p", "li"):
            sizes[c] = sizes.get(c, 0) + len(text)
    best = max(sizes, key=sizes.get) if sizes else -1
    out = [f"# {title}", ""]
    for c, tag, inquote, text in blocks:
        if c != best:
            continue
        if tag == "h1":
            continue
        if tag in ("h2", "h3", "h4"):
            if STOP_HEADINGS.match(text):
                break
            out += [f"## {text}", ""]
            continue
        if len(text.split()) < 4 and not REF_RE.search(text):
            continue                       # bylines, dates, "Read more"
        if inquote:
            m = CITE_RE.search(text)
            if m and not re.search(r"[“\"]", text[:m.start()]):
                text = f"“{text[:m.start()].strip()}” ({m.group(1)})" + text[m.end():]
            text = "> " + text
        elif tag == "li":
            text = "- " + text
        out += [text, ""]
    body = [l for l in out[2:] if l.strip()]
    if len(body) < 3:
        return None
    return "\n".join(out).rstrip() + "\n"


def cmd_prepare(args):
    site, art = find_article(" ".join(args.article))
    wd = WORK / art["slug"]
    wd.mkdir(parents=True, exist_ok=True)
    script = wd / "script.md"
    if script.exists() and not args.force:
        stop(f"{script} already exists (you may have edited it). Add --force to replace it.")
    url = site + urllib.parse.quote(art["slug"])
    header = ("<!-- Review this narration before building. Lines starting with '## ' are chapters.\n"
              "     Quotes: the book's exact words inside quotation marks, then the reference, e.g. (53:9.3).\n"
              "     References are shown on screen but not read aloud.\n"
              "     Delete anything that should not be spoken (captions, menus, links). -->\n\n")
    if args.article_file:
        text = Path(args.article_file).read_text(encoding="utf-8")
        if not text.lstrip().startswith("# "):
            text = f"# {art['title']}\n\n" + text
        say(f"Using your file {args.article_file}")
    else:
        say(f"Fetching {url}")
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "ub-tools-episode"})
            page = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
        except Exception as e:
            stop(f"could not download the article ({e}).\nOpen {url} in your browser, copy the "
                 "article text into a .txt file (blank line between paragraphs, '## ' before each "
                 "heading), and run prepare again with --article-file <that file>.")
        text = article_to_script(page, art["title"])
        if not text:
            stop(f"could not find the article text on {url}. Copy it into a .txt file and use "
                 "--article-file <that file>.")
    script.write_text(header + text, encoding="utf-8")
    ep = parse_script(script)
    write_visuals(wd, ep, keep=False)
    meta = {"slug": art["slug"], "title": art["title"], "url": url, "refs": art["refs"]}
    (wd / "article.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    say(f"\nWrote {script}\n      {wd / 'visuals.json'}")
    say(f"{len(ep['chapters'])} chapters, {sum(len(c['paras']) for c in ep['chapters'])} paragraphs.")
    say("Next: read script.md (and edit the prompts in visuals.json), then run build.")


def write_visuals(wd, ep, keep=True):
    path = wd / "visuals.json"
    old = json.loads(path.read_text(encoding="utf-8")) if keep and path.exists() else {}
    old_ch = {c.get("title"): c.get("prompt") for c in old.get("chapters", [])}
    data = {
        "_help": "One prompt per chapter for the background clips. 'style' is added to every prompt. "
                 "Edit freely; a changed prompt makes new clips on the next build.",
        "style": old.get("style", DEFAULT_STYLE),
        "negative": old.get("negative", DEFAULT_NEGATIVE),
        "chapters": [{"title": c["title"],
                      "prompt": old_ch.get(c["title"]) or
                      f"Abstract, contemplative imagery suggesting: {c['title']}"}
                     for c in ep["chapters"]],
    }
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    return data


# ---------------------------------------------------------------- script

def clean_text(raw):
    """What the viewer reads in captions: markdown and citations removed."""
    t = re.sub(r"^\s*>\s?", "", raw, flags=re.M)
    t = re.sub(r"^\s*[-*]\s+", "", t, flags=re.M)
    t = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", t)
    t = t.replace("*", "")
    t = re.sub(r"(?<!\w)_(\S[^_]*?)_(?!\w)", r"\1", t)
    t = CITE_RE.sub("", t)
    t = re.sub(r"\s+([,.;:!?])", r"\1", t)
    return re.sub(r"\s+", " ", t).strip()


def parse_script(path):
    lines = path.read_text(encoding="utf-8").splitlines()
    ep = {"title": None, "chapters": []}
    buf, start = [], None
    in_comment = False

    def chapter(title):
        ep["chapters"].append({"title": title, "paras": []})

    def flush(end):
        nonlocal buf, start
        if buf:
            raw = "\n".join(buf)
            text = clean_text(raw)
            if text:
                if not ep["chapters"]:
                    chapter("Introduction")
                ep["chapters"][-1]["paras"].append({"raw": raw, "text": text,
                                                    "lines": (start, end)})
        buf, start = [], None

    for i, line in enumerate(lines, 1):
        s = line.strip()
        if in_comment or s.startswith("<!--"):
            in_comment = "-->" not in s
            flush(i - 1)
            continue
        if s.startswith("# ") and ep["title"] is None and not ep["chapters"]:
            flush(i - 1)
            ep["title"] = s[2:].strip()
        elif s.startswith("## "):
            flush(i - 1)
            chapter(s[3:].strip())
        elif not s:
            flush(i - 1)
        else:
            if start is None:
                start = i
            buf.append(line)
    flush(len(lines))
    ep["chapters"] = [c for c in ep["chapters"] if c["paras"]]
    if not ep["chapters"]:
        stop(f"{path} has no paragraphs to narrate.")
    return ep


def load_pronounce():
    say_map = json.loads(PRONOUNCE.read_text(encoding="utf-8"))["say"]
    terms = sorted(say_map, key=len, reverse=True)
    rx = re.compile(r"\b(" + "|".join(re.escape(t) for t in terms) + r")\b")
    # same rule as the Studio's Read aloud (app/ask.js spoken())
    return lambda text: rx.sub(lambda m: say_map.get(m.group(0), m.group(0)), text)


# ---------------------------------------------------------------- quotes

def verify_quotes(script):
    if not PAPERS.exists():
        stop("the book text is missing. Run once from the ub-tools folder:  node fetch-data.js")
    try:
        r = subprocess.run(["node", str(REPO / "ub-verify.js"), str(script), "--json", "--quotes-only"],
                           capture_output=True, text=True, encoding="utf-8", cwd=REPO)
    except FileNotFoundError:
        stop("Node.js is not installed (needed for ub-verify.js). See episodes/README.md.")
    if r.returncode == 2 or not r.stdout.strip():
        stop("ub-verify.js could not run:\n" + r.stderr)
    quotes = json.loads(r.stdout)[0]["quotes"]
    bad = [q for q in quotes if q["status"] != "PASS"]
    say(f"  {len(quotes)} quotes checked against the book, {len(quotes) - len(bad)} exact.")
    if bad:
        for q in bad:
            say(f"  line {q['line']}  {q['status']}  ({q['citation']})  \"{q['quote'][:70]}...\"")
            say(f"      {q['detail']}")
            for c in q.get("changes") or []:
                say(f"      script says: {c['quoteSays']}   book says: {c['bookSays']}")
        stop("fix these quotes in script.md (copy the book's exact words), then build again.\n"
             "For the full report run:  node ub-verify.js " + str(script) + " --quotes-only")
    return quotes


def paper_title(ref):
    n = int(ref.split(":")[0])
    f = PAPERS / f"Doc{n:03d}.json"
    try:
        return n, json.loads(f.read_text(encoding="utf-8")).get("paper_title", "")
    except Exception:
        return n, ""


# ---------------------------------------------------------------- voice

def read_wav(path):
    import numpy as np
    with wave.open(str(path), "rb") as w:
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype("float32") / 32768


def write_wav(path, audio, sr=SR):
    import numpy as np
    pcm = (np.clip(audio, -1, 1) * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())


def speak(ep, wd, voice, speed):
    """Speak every paragraph (cached per paragraph), join them with pauses, and
    record exactly where each paragraph and chapter starts."""
    import numpy as np
    spoken = load_pronounce()
    cache = wd / "tts"
    cache.mkdir(exist_ok=True)
    pipeline = None
    pieces, t = [np.zeros(int(LEAD * SR), "float32")], LEAD
    todo = sum(len(c["paras"]) for c in ep["chapters"])
    done = 0
    for ci, ch in enumerate(ep["chapters"]):
        if ci:
            pieces.append(np.zeros(int((GAP_CHAPTER - GAP_PARA) * SR), "float32"))
            t += GAP_CHAPTER - GAP_PARA
        ch["t0"] = t
        for p in ch["paras"]:
            p["spoken"] = spoken(p["text"])
            key = hashlib.sha1(f"{voice}|{speed}|{p['spoken']}".encode()).hexdigest()[:16]
            f = cache / f"{key}.wav"
            if not f.exists():
                if pipeline is None:
                    say(f"  loading the Kokoro voice {voice} (first run downloads about 350 MB)...")
                    try:
                        from kokoro import KPipeline
                    except ImportError:
                        stop("Kokoro is not installed. Run episodes\\setup.bat (see episodes/README.md).")
                    pipeline = KPipeline(lang_code=voice[0], repo_id="hexgrad/Kokoro-82M")
                chunks = []
                for _gs, _ps, audio in pipeline(p["spoken"], voice=voice, speed=speed, split_pattern=None):
                    if audio is not None:
                        a = audio.detach().cpu().numpy() if hasattr(audio, "detach") else np.asarray(audio)
                        chunks.append(a.astype("float32"))
                if not chunks:
                    stop(f"the voice produced no audio for: {p['text'][:80]}")
                write_wav(f, np.concatenate(chunks))
            a = read_wav(f)
            p["t0"], p["t1"] = t, t + len(a) / SR
            pieces += [a, np.zeros(int(GAP_PARA * SR), "float32")]
            t = p["t1"] + GAP_PARA
            done += 1
            if done % 10 == 0 or done == todo:
                say(f"  spoken {done}/{todo} paragraphs")
    pieces.append(np.zeros(int((TAIL - GAP_PARA) * SR), "float32"))
    audio = np.concatenate(pieces)
    out = wd / "narration.wav"
    write_wav(out, audio)
    return out, len(audio) / SR


# ---------------------------------------------------------------- captions

def load_align():
    spec = importlib.util.spec_from_file_location("ub_align", REPO / "audio" / "align.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def time_words(ep, wav, model, use_whisper):
    """Word timings for every paragraph: faster-whisper listens to the narration
    and audio/align.py matches what it heard to the script's words. Each
    paragraph is aligned only inside its own known time span, so one bad match
    can never drift the captions."""
    al = load_align()
    heard = []
    if use_whisper:
        try:
            import faster_whisper  # noqa: F401
        except ImportError:
            stop("faster-whisper is not installed. Run episodes\\setup.bat, or add --no-align.")
        say(f"  listening to the narration with faster-whisper ({model})...")
        heard = al.transcribe(str(wav), model, "en")
    exact = total = 0
    for ch in ep["chapters"]:
        for p in ch["paras"]:
            words = []
            for w in p["text"].split():
                toks = al.tokenize_surface(w)
                if toks:
                    words.append([w, toks])
                elif words:
                    words[-1][0] += " " + w      # a lone dash or symbol rides with its neighbor
            flat = [t for _, toks in words for t in toks]
            win = [h for h in heard if p["t0"] - 0.3 <= h[1] <= p["t1"] + 0.3]
            timed = al.align_tokens(flat, win) if win else None
            hits = sum(1 for x in timed if x[2]) if timed else 0
            if not timed or hits < 0.3 * len(flat):
                timed = spread(flat, p["t0"], p["t1"])
                hits = 0
            timed = [(min(max(s, p["t0"]), p["t1"]), min(max(e, p["t0"]), p["t1"]), x) for s, e, x in timed]
            timed = al.enforce_monotonic(timed)
            exact += hits
            total += len(flat)
            out, k = [], 0
            for w, toks in words:
                seg = timed[k:k + len(toks)]
                out.append((w, seg[0][0], seg[-1][1]))
                k += len(toks)
            p["words"], p["flat"] = out, flat
            p["tok_word"] = [i for i, (_, toks) in enumerate(words) for _ in toks]
    if use_whisper:
        say(f"  {exact}/{total} words locked to the voice; the rest are placed between them.")


def spread(toks, t0, t1):
    weights = [max(len(t), 1) + 1 for t in toks]
    tot, cur, out = sum(weights), t0, []
    for wgt in weights:
        d = (t1 - t0) * wgt / tot
        out.append((round(cur, 3), round(cur + d, 3), False))
        cur += d
    return out


def srt_time(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def write_srt(ep, path, max_chars=42):
    cues = []
    for ch in ep["chapters"]:
        for p in ch["paras"]:
            cur = []
            for w in p["words"]:
                if cur and len(" ".join(x[0] for x in cur + [w])) > max_chars:
                    cues.append(cur)
                    cur = []
                cur.append(w)
                text = " ".join(x[0] for x in cur)
                if (re.search(r"[.!?][\"”’)]*$", w[0]) and len(cur) > 1) or \
                        (re.search(r"[,;:][\"”’)]*$", w[0]) and len(text) >= 26):
                    cues.append(cur)
                    cur = []
            if cur:
                if cues and len(cur) <= 2 and len(" ".join(x[0] for x in cues[-1] + cur)) <= max_chars + 8 \
                        and cues[-1][-1][2] >= p["t0"]:
                    cues[-1] += cur
                else:
                    cues.append(cur)
    lines = []
    for i, c in enumerate(cues):
        s, e = c[0][1], c[-1][2]
        nxt = cues[i + 1][0][1] if i + 1 < len(cues) else e + 2
        e = min(max(e + 0.25, s + 1.0), nxt - 0.04) if nxt > s + 0.1 else e
        lines += [str(i + 1), f"{srt_time(s)} --> {srt_time(e)}", " ".join(x[0] for x in c), ""]
    path.write_text("\n".join(lines), encoding="utf-8")
    return len(cues)


# ---------------------------------------------------------------- quote cards

def load_render():
    spec = importlib.util.spec_from_file_location("qc_render", REPO / "quote-cards" / "render.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    if not (Path(mod.FONT_DIR) / "DejaVuSerif.ttf").exists():
        try:  # Windows has no DejaVu; matplotlib ships the same fonts
            import matplotlib
            mod.FONT_DIR = str(Path(matplotlib.__file__).parent / "mpl-data" / "fonts" / "ttf")
        except ImportError:
            stop("the DejaVu fonts for quote cards are missing. Run episodes\\setup.bat.")
    return mod


def plan_cards(ep, quotes, wd, narr_dur, min_words=6):
    """One full-screen card per verified quote of 6+ words, shown while the
    narrator reads it. Cards use the quote-cards/ design at 1920x1080."""
    rd = load_render()
    al = load_align()
    paras = [p for ch in ep["chapters"] for p in ch["paras"]]
    cards_dir = wd / "cards"
    cards_dir.mkdir(exist_ok=True)
    cards, prev_end = [], 0.0
    for q in quotes:
        body = re.sub(r"[*_]", "", q["quote"]).strip()
        qtoks = [t for w in re.sub(r"\[[^\]]*\]", " ", body).split() for t in al.tokenize_surface(w)]
        if len(qtoks) < min_words:
            continue
        p = next((p for p in paras if p["lines"][0] <= q["line"] <= p["lines"][1]), None)
        if p is None:
            continue
        pieces = [x for x in re.split(r"\.\.\.|…", re.sub(r"\[[^\]]*\]", " ", body)) if x.strip()]
        head = [t for w in pieces[0].split() for t in al.tokenize_surface(w)][:4]
        tail = [t for w in pieces[-1].split() for t in al.tokenize_surface(w)][-4:]
        i0 = find_seq(p["flat"], head, 0)
        i1 = find_seq(p["flat"], tail, max(i0, 0))
        if i0 < 0 or i1 < 0:
            ws, we = p["t0"], p["t1"]
        else:
            ws = p["words"][p["tok_word"][i0]][1]
            we = p["words"][p["tok_word"][i1 + len(tail) - 1]][2]
        t0 = max(ws - 0.3, prev_end, 0)
        t1 = min(max(we + 1.2, t0 + 4.0), narr_dur)
        if t1 - t0 < 2.0:
            continue
        n, ptitle = paper_title(q["refs"][0]) if q["refs"] else (0, "")
        topic = f"Paper {n}: {ptitle}" if ptitle and len(ptitle) <= 42 else f"Paper {n}"
        img = rd.render_card({"topic": topic, "quote": body, "citation": q["citation"]}, (W, H))
        if img is None:
            say(f"  ({q['citation']}) is too long for one card; it plays over the background instead.")
            continue
        f = cards_dir / f"card{len(cards):02d}.png"
        img.save(f)
        cards.append({"file": f, "t0": round(t0, 3), "t1": round(t1, 3), "citation": q["citation"]})
        prev_end = t1
    return cards


def find_seq(hay, needle, start):
    if not needle:
        return -1
    for i in range(max(start, 0), len(hay) - len(needle) + 1):
        if hay[i:i + len(needle)] == needle:
            return i
    return -1


def end_still(title, url, path):
    rd = load_render()
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (W, H), rd.BG)
    d = ImageDraw.Draw(img)
    rd.draw_tracked(d, (W / 2, 150), "URANTIA BOOK NETWORK", rd.load_font("DejaVuSans-Bold.ttf", 30), rd.GOLD)
    d.line([(W / 2 - 40, 205), (W / 2 + 40, 205)], fill=rd.GOLD, width=2)
    size = 72
    while size > 40:
        font = rd.load_font("DejaVuSerif.ttf", size)
        lines = rd.wrap(title, font, W - 360)
        if len(lines) <= 3:
            break
        size -= 4
    lh = int(size * 1.35)
    y = (H - (len(lines) * lh + 190)) / 2 + 20     # center title + link block
    for line in lines:
        d.text(((W - font.getlength(line)) / 2, y), line, font=font, fill=rd.INK)
        y += lh
    small = rd.load_font("DejaVuSans.ttf", 36)
    for text, color, dy in (("Read the full article", rd.DIM, 90), (url, rd.GOLD, 60)):
        y += dy
        d.text(((W - small.getlength(text)) / 2, y), text, font=small, fill=color)
    img.save(path)


# ---------------------------------------------------------------- ComfyUI

def comfy_call(host, path, data=None, timeout=60):
    req = urllib.request.Request(host.rstrip("/") + path,
                                 data=json.dumps(data).encode() if data is not None else None,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def fill_workflow(wf, prompt, negative):
    wf, found = copy.deepcopy(wf), False
    for node in wf.values():
        for k, v in (node.get("inputs") or {}).items():
            if isinstance(v, str) and "{{PROMPT}}" in v:
                node["inputs"][k] = v.replace("{{PROMPT}}", prompt)
                found = True
            elif isinstance(v, str) and "{{NEGATIVE}}" in v:
                node["inputs"][k] = v.replace("{{NEGATIVE}}", negative)
            elif k in ("seed", "noise_seed") and isinstance(v, int):
                node["inputs"][k] = random.randint(1, 2**31 - 1)
    if not found:
        stop("your workflow file has no {{PROMPT}} in it. In ComfyUI, type {{PROMPT}} into the "
             "positive prompt box, then save it again with Export (API). See episodes/README.md.")
    return wf


def comfy_clip(host, wf, prompt, negative, dest):
    body = {"prompt": fill_workflow(wf, prompt, negative), "client_id": str(uuid.uuid4())}
    try:
        pid = json.loads(comfy_call(host, "/prompt", body))["prompt_id"]
    except urllib.error.HTTPError as e:
        stop("ComfyUI refused the workflow:\n" + e.read().decode("utf-8", "replace")[:1500])
    started = time.time()
    while True:
        time.sleep(3)
        hist = json.loads(comfy_call(host, f"/history/{pid}")).get(pid)
        if hist:
            break
        if time.time() - started > 1800:
            stop("ComfyUI took more than 30 minutes for one clip. Check the ComfyUI window.")
    status = hist.get("status", {})
    if status.get("status_str") == "error":
        msgs = [m for m in status.get("messages", []) if m[0] == "execution_error"]
        stop("ComfyUI failed on this clip:\n" + json.dumps(msgs, indent=1)[:1500])
    for out in hist.get("outputs", {}).values():
        for key in ("videos", "gifs", "images", "animated"):
            for f in out.get(key, []) if isinstance(out.get(key), list) else []:
                name = f.get("filename", "") if isinstance(f, dict) else ""
                if name.lower().endswith((".mp4", ".webm", ".mov", ".mkv", ".gif")):
                    q = urllib.parse.urlencode({"filename": name, "subfolder": f.get("subfolder", ""),
                                                "type": f.get("type", "output")})
                    dest.write_bytes(comfy_call(host, f"/view?{q}", timeout=300))
                    return
    stop("the workflow finished but saved no video file (.mp4 or .webm). End your workflow with a "
         "'Save Video' or 'Video Combine' node (animated WebP can't be read by ffmpeg).")


def make_backgrounds(ep, wd, args, vis):
    """Per chapter: generate (or reuse) a few clips, then loop them to the
    chapter's exact length. Returns the full background video."""
    clips_dir = wd / "clips"
    clips_dir.mkdir(exist_ok=True)
    wf = None
    if not args.no_comfy:
        wf_path = Path(args.workflow)
        if not wf_path.exists():
            stop(f"no ComfyUI workflow at {wf_path}. Export your LTX workflow as described in "
                 "episodes/README.md, or add --no-comfy for a plain dark background.")
        wf = json.loads(wf_path.read_text(encoding="utf-8"))
        if "nodes" in wf:
            stop(f"{wf_path} is a normal workflow save. Use ComfyUI's Export (API) instead.")
        try:
            comfy_call(args.comfy, "/system_stats", timeout=10)
        except Exception:
            stop(f"ComfyUI is not answering at {args.comfy}. Start ComfyUI first.")
    parts, frame_at = [], 0
    bounds = [ch["t0"] for ch in ep["chapters"]][1:] + [ep["narr_dur"]]
    for ci, ch in enumerate(ep["chapters"]):
        end_frame = round(bounds[ci] * FPS)
        frames = end_frame - frame_at
        frame_at = end_frame
        out = clips_dir / f"chapter{ci:02d}.mp4"
        if args.no_comfy:
            ff(["-f", "lavfi", "-i", f"color=c={BG_HEX}:s={W}x{H}:r={FPS}", "-frames:v", str(frames),
                *VENC, str(out)])
            parts.append(out)
            continue
        vc = vis["chapters"][ci] if ci < len(vis["chapters"]) else {"prompt": ch["title"]}
        prompt = f"{vc['prompt']}. {vis['style']}"
        tag = hashlib.sha1(prompt.encode()).hexdigest()[:8]
        need = max(1, min(args.clips_per_chapter, math.ceil(frames / FPS / args.clip_seconds)))
        clips = []
        for j in range(need):
            norm = clips_dir / f"ch{ci:02d}_{tag}_{j}.mp4"
            if not norm.exists():
                say(f"  ComfyUI: chapter {ci + 1}/{len(ep['chapters'])}, clip {j + 1}/{need}...")
                raw = clips_dir / f"raw_ch{ci:02d}_{tag}_{j}.video"
                comfy_clip(args.comfy, wf, prompt, vis["negative"], raw)
                ff(["-i", str(raw), "-an", "-vf",
                    f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS},"
                    "format=yuv420p,setsar=1", *VENC, str(norm)])
            clips.append(norm)
        lengths = [probe_dur(c) for c in clips]
        reps = math.ceil(frames / FPS / max(sum(lengths), 0.5)) + 1
        lst = clips_dir / f"chapter{ci:02d}.txt"
        lst.write_text("".join(f"file '{c.as_posix()}'\n" for _ in range(reps) for c in clips), encoding="utf-8")
        ff(["-f", "concat", "-safe", "0", "-i", str(lst), "-frames:v", str(frames), "-an",
            "-vf", f"fps={FPS},format=yuv420p,setsar=1", *VENC, str(out)])
        parts.append(out)
    lst = wd / "background.txt"
    lst.write_text("".join(f"file '{p.as_posix()}'\n" for p in parts), encoding="utf-8")
    bg = wd / "background.mp4"
    ff(["-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(bg)])
    return bg


# ---------------------------------------------------------------- ffmpeg

VENC = ["-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p", "-r", str(FPS)]


def ff(args_):
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *args_]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    except FileNotFoundError:
        stop("ffmpeg is not installed or not on PATH. See episodes/README.md.")
    if r.returncode:
        stop("ffmpeg failed:\n" + r.stderr[-2000:])


def probe_dur(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of",
                        "default=nw=1:nk=1", str(path)], capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except ValueError:
        stop(f"could not read the length of {path}")


def assemble(ep, wd, bg, cards, narration, still, args, out):
    narr_frames = round(ep["narr_dur"] * FPS)
    end_s = args.end_seconds
    inputs = ["-i", str(bg)]
    fc = ["[0:v]setpts=PTS-STARTPTS[b0]"]
    for i, c in enumerate(cards, 1):
        d = c["t1"] - c["t0"]
        inputs += ["-loop", "1", "-framerate", str(FPS), "-t", f"{d:.3f}", "-i", str(c["file"])]
        fc.append(f"[{i}:v]format=rgba,fade=t=in:st=0:d=0.35:alpha=1,"
                  f"fade=t=out:st={max(d - 0.35, 0):.3f}:d=0.35:alpha=1,"
                  f"setpts=PTS-STARTPTS+{c['t0']:.3f}/TB[c{i}]")
        fc.append(f"[b{i - 1}][c{i}]overlay=eof_action=pass:enable='between(t,{c['t0']:.3f},{c['t1']:.3f})'[b{i}]")
    k = len(cards) + 1
    inputs += ["-loop", "1", "-framerate", str(FPS), "-t", f"{end_s:.3f}", "-i", str(still)]
    fc.append(f"[b{k - 1}]trim=end_frame={narr_frames},format=yuv420p,setsar=1[vm]")
    fc.append(f"[{k}:v]scale={W}:{H}:force_original_aspect_ratio=decrease,"
              f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color={BG_HEX},fps={FPS},format=yuv420p,setsar=1,"
              f"fade=t=in:st=0:d=1[ve]")
    fc.append("[vm][ve]concat=n=2:v=1:a=0[v]")
    inputs += ["-i", str(narration)]
    fc.append(f"[{k + 1}:a]aformat=channel_layouts=stereo,loudnorm=I=-16:TP=-1.5:LRA=11,"
              f"aresample=48000[n]")
    narr_s = narr_frames / FPS
    total = narr_s + end_s
    if args.music:
        inputs += ["-stream_loop", "-1", "-i", str(args.music)]
        ms = int(narr_s * 1000)
        fc.append(f"[{k + 2}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:{end_s:.3f},"
                  f"asetpts=PTS-STARTPTS,loudnorm=I=-18:TP=-2,aresample=48000,afade=t=in:st=0:d=1.5,afade=t=out:st={max(end_s - 3, 0):.3f}:d=3,"
                  f"volume={args.music_volume},adelay={ms}|{ms}[m]")
        fc.append("[n][m]amix=inputs=2:normalize=0:duration=longest[a]")
    else:
        fc.append(f"[n]apad=whole_dur={total:.3f}[a]")
    ff([*inputs, "-filter_complex", ";".join(fc), "-map", "[v]", "-map", "[a]", "-t", f"{total:.3f}",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", str(FPS),
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(out)])
    return total


# ---------------------------------------------------------------- description

def stamp(t):
    t = int(t)
    return f"{t // 3600}:{t // 60 % 60:02d}:{t % 60:02d}" if t >= 3600 else f"{t // 60}:{t % 60:02d}"


def write_description(ep, meta, quotes, args, path):
    lines = [ep["title"] or meta["title"], ""]
    intro = ep["chapters"][0]["paras"][0]["text"]
    if len(intro) > 300:
        cut = max(intro.rfind(". ", 0, 300), intro.rfind("? ", 0, 300))
        intro = intro[:cut + 1] if cut > 80 else intro[:297] + "..."
    lines += [intro, "", f"Read the full article: {meta['url']}", ""]
    chs = [(0.0, ep["chapters"][0]["title"])]
    for ch in ep["chapters"][1:]:
        if ch["t0"] - chs[-1][0] >= 10:
            chs.append((ch["t0"], ch["title"]))
    if len(chs) >= 3:
        lines += ["Chapters"] + [f"{stamp(t)} {title}" for t, title in chs] + [""]
    else:
        say("  (fewer than 3 chapters of 10+ seconds, so the description has no chapter list;"
            " YouTube needs at least 3)")
    quoted = []
    for q in quotes:
        for r in q["refs"]:
            if r not in quoted:
                quoted.append(r)
    if quoted:
        lines.append("Urantia Book passages quoted (Paper:Section.Paragraph)")
        for r in quoted:
            _, t = paper_title(r)
            lines.append(f"{r}  {t}".rstrip())
        lines.append("")
    more = [r for r in meta.get("refs", []) if r not in quoted]
    if more:
        lines += ["Also cited in the article: " + ", ".join(more), ""]
    lines.append("Every quotation was checked word for word against The Urantia Book (UBN Tools, ub-verify).")
    lines.append("Narration: synthetic voice (Kokoro text-to-speech).")
    if args.music_credit:
        lines.append(f"Music: {args.music_credit}")
    text = "\n".join(lines).rstrip() + "\n"
    if len(text) > 5000:
        say("  WARNING: the description is over YouTube's 5000-character limit; shorten it before pasting.")
    path.write_text(text, encoding="utf-8")


# ---------------------------------------------------------------- build

def cmd_build(args):
    _, art = find_article(args.slug)
    wd = WORK / art["slug"]
    script = wd / "script.md"
    if not script.exists():
        stop(f"no script yet. Run first:  python episodes/make_episode.py prepare {art['slug']}")
    meta = json.loads((wd / "article.json").read_text(encoding="utf-8"))
    if args.music and not Path(args.music).exists():
        stop(f"music file not found: {args.music}")
    if args.end_still and not Path(args.end_still).exists():
        stop(f"end still not found: {args.end_still}")
    ep = parse_script(script)
    vis = write_visuals(wd, ep, keep=True)

    say("1/6  Checking quotes with ub-verify.js")
    quotes = verify_quotes(script)

    say("2/6  Speaking the script (Kokoro)")
    narration, ep["narr_dur"] = speak(ep, wd, args.voice, args.speed)
    say(f"  narration is {stamp(ep['narr_dur'])} long")

    say("3/6  Timing captions (audio/align.py)")
    time_words(ep, narration, args.whisper_model, not args.no_align)
    srt = wd / f"{art['slug']}.en.srt"
    n = write_srt(ep, srt)
    say(f"  {n} captions")

    say("4/6  Quote cards (quote-cards/render.py)")
    cards = plan_cards(ep, quotes, wd, ep["narr_dur"])
    say(f"  {len(cards)} cards")

    say("5/6  Background clips" + (" (plain background, --no-comfy)" if args.no_comfy else " (ComfyUI)"))
    bg = make_backgrounds(ep, wd, args, vis)

    say("6/6  Putting the episode together (ffmpeg)")
    still = Path(args.end_still) if args.end_still else wd / "end-still.png"
    if not args.end_still:
        end_still(meta["title"], meta["url"], still)
    if not args.music:
        say("  no --music given: the closing still will be silent")
    video = wd / f"{art['slug']}.mp4"
    total = assemble(ep, wd, bg, cards, narration, still, args, video)
    desc = wd / "description.txt"
    write_description(ep, meta, quotes, args, desc)
    (wd / "episode.json").write_text(json.dumps({
        "narration_seconds": round(ep["narr_dur"], 3), "total_seconds": round(total, 3),
        "chapters": [{"title": c["title"], "start": round(c["t0"], 3)} for c in ep["chapters"]],
        "cards": [{"citation": c["citation"], "start": c["t0"], "end": c["t1"]} for c in cards],
    }, indent=2), encoding="utf-8")
    say(f"\nDone ({stamp(total)}). In {wd}:")
    say(f"  {video.name}    the video")
    say(f"  {srt.name}    captions: upload in YouTube Studio > Subtitles")
    say("  description.txt    paste into the YouTube description")
    say("Watch the whole video before uploading: the voice, captions and every clip.")


def main():
    ap = argparse.ArgumentParser(description="Turn one UBN article into a YouTube episode.")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("list", help="find an article's slug")
    p.add_argument("words", nargs="*")
    p = sub.add_parser("prepare", help="fetch the article and write script.md")
    p.add_argument("article", nargs="+", help="slug, or words from the title")
    p.add_argument("--article-file", help="use this text file instead of downloading the article")
    p.add_argument("--force", action="store_true", help="replace an existing script.md")
    p = sub.add_parser("build", help="make the video from script.md")
    p.add_argument("slug")
    p.add_argument("--voice", default="af_heart",
                   help="Kokoro voice: af_heart, af_bella, am_michael, bf_emma, bm_george, ...")
    p.add_argument("--speed", type=float, default=1.0)
    p.add_argument("--music", help="music for the closing still (a track you have the rights to)")
    p.add_argument("--music-credit", help="credit line for the description")
    p.add_argument("--music-volume", type=float, default=0.6)
    p.add_argument("--end-still", help="your own closing image (default: one is drawn for you)")
    p.add_argument("--end-seconds", type=float, default=20.0)
    p.add_argument("--comfy", default="http://127.0.0.1:8188", help="ComfyUI address")
    p.add_argument("--workflow", default=str(DEFAULT_WORKFLOW), help="ComfyUI workflow, Export (API) format")
    p.add_argument("--clips-per-chapter", type=int, default=3)
    p.add_argument("--clip-seconds", type=float, default=5.0, help="about how long one clip from your workflow is")
    p.add_argument("--no-comfy", action="store_true", help="plain dark background instead of ComfyUI clips")
    p.add_argument("--no-align", action="store_true", help="skip faster-whisper; spread caption timing evenly")
    p.add_argument("--whisper-model", default="small")
    args = ap.parse_args()
    {"list": cmd_list, "prepare": cmd_prepare, "build": cmd_build}[args.cmd](args)


if __name__ == "__main__":
    main()
