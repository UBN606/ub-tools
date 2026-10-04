// readalong.js — read-along player: word-by-word highlighting synced to
// HUMAN narration audio that plays right in the page. No downloads, no
// file-picking: press Play and the words light up.
//
// Rights model: this repo NEVER hosts audio. The player streams the
// narration from TruthBook's mirror of the Foundation's unabridged reading
// (https://truthbook.com/wp-content/uploads/AudioFiles/UF24K/U0.mp3 …
// U196.mp3 — the exact files the alignment run downloaded, so the timings
// match byte-for-byte) and fetches only ../audio/aligned/DocNNN.json (word
// timestamps, our own computed data). A "use your own audio file" fallback
// remains for anyone with a different copy of the paper's MP3; that file is
// played from a local object URL — nothing is uploaded anywhere.
//
// Data schema (audio/aligned/DocNNN.json, written by audio/align.py):
//   { "paper": 1, "paper_title": "...", "source": {...}, "stats": {...},
//     "paragraphs": [ { "ref": "1:0.1", "confidence": 0.98,
//       "words": [ {"w": "The", "start": 1.234, "end": 1.567, "x": true} ] } ] }
//   "x": true  = timestamp measured from the transcription (ground truth)
//   "x": false = interpolated estimate (timing is approximate)
//
// UB accuracy: word surface forms come from the alignment JSON (machine
// data), never hand-typed. Paragraph ordering/refs follow the JSON.

const ALIGNMENT_URL = (paperNum) =>
  new URL(`../audio/aligned/Doc${String(paperNum).padStart(3, '0')}.json`, import.meta.url)

const MAX_PAPER = 196 // 0 = Foreword, 1..196 = Papers 1..196

// The narration stream: the UF24K mirror files the alignment run downloaded
// (see audio/SOURCES.md). Timings are valid only for this recording.
// Pure function, tested in app/test/readalong.test.mjs.
const NARRATION_HOST = 'https://truthbook.com/wp-content/uploads/AudioFiles/UF24K'
export function audioUrlForPaper(paperNum) {
  if (!Number.isInteger(paperNum) || paperNum < 0 || paperNum > MAX_PAPER) return null
  return `${NARRATION_HOST}/U${paperNum}.mp3`
}

// ---------- loading ----------

/**
 * Fetch the word-timing data for a paper.
 * Never throws: returns null when the file is missing (404), the network
 * fails, or the JSON is malformed.
 * @returns {{ paragraphs: Map<string, Array<{w,start,end,x}>>, meta } | null}
 */
export async function loadAlignment(paperNum) {
  if (!Number.isInteger(paperNum) || paperNum < 0 || paperNum > MAX_PAPER) return null
  let res
  try {
    res = await fetch(ALIGNMENT_URL(paperNum))
  } catch {
    return null // offline / network error: never throws to the caller
  }
  if (!res || !res.ok) return null // 404 → timings not published yet
  let data
  try {
    data = await res.json()
  } catch {
    return null
  }
  if (!data || !Array.isArray(data.paragraphs) || !data.paragraphs.length) return null
  const paragraphs = new Map()
  for (const p of data.paragraphs) {
    if (!p || typeof p.ref !== 'string' || !Array.isArray(p.words) || !p.words.length) continue
    const words = p.words.filter(
      (w) => w && typeof w.w === 'string' && Number.isFinite(w.start) && Number.isFinite(w.end),
    )
    if (words.length) paragraphs.set(p.ref, words)
  }
  if (!paragraphs.size) return null
  const stats = data.stats && typeof data.stats === 'object' ? data.stats : null
  const rate =
    stats && Number.isFinite(stats.exact_match_rate)
      ? stats.exact_match_rate
      : Number.isFinite(data.exact_match_rate)
        ? data.exact_match_rate
        : null
  return {
    paragraphs,
    meta: {
      paper: typeof data.paper === 'number' ? data.paper : paperNum,
      title: typeof data.paper_title === 'string' ? data.paper_title : '',
      exactMatchRate: rate,
    },
  }
}

// ---------- binary search ----------

/**
 * Index of the word active at second t. Pure function.
 * - t before the first word's start → 0 (highlight starts with the paper)
 * - boundary t == word end == next word's start → the next word
 * - t past the last word's end → the last word
 * - empty array → -1
 */
export function wordAtTime(words, t) {
  if (!words || !words.length) return -1
  if (t < words[0].start) return 0
  let lo = 0
  let hi = words.length - 1
  let ans = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (words[mid].start <= t) {
      ans = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return ans
}

// ---------- UI ----------

/**
 * Render the read-along player into `container`.
 * @param {HTMLElement} container
 * @param {object} E the loaded engine (needs .byRef: Map ref → {paper, paperTitle, sectionTitle})
 * @param {object} deps { esc, store, startReading? }
 *   - esc: HTML escaper from app.js
 *   - store: { get(k,d), set(k,v) } localStorage wrapper
 *   - startReading: optional; the existing TTS player from app.js, used by the
 *     "no timings yet" fallback button. If absent, the button dispatches a
 *     'readalong:tts-request' CustomEvent with {paper} in detail instead.
 * @returns {() => void} destroy() — stops audio, revokes the object URL, removes listeners.
 */
export function renderReadAlong(container, E, deps = {}) {
  const esc = deps.esc || ((s) => String(s))
  const store = deps.store || { get: (k, d) => d, set: () => {} }
  const ac = new AbortController()
  const on = (el, ev, fn) => el.addEventListener(ev, fn, { signal: ac.signal })
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  let audioURL = null
  let audio = null
  let lastIdx = -1
  let lastWord = null
  let lastPara = null
  let lastScroll = 0

  // ---- paper picker: 197 papers, titles from the engine (never hand-typed) ----
  const papers = []
  const seen = new Set()
  for (const v of E.byRef.values()) {
    if (seen.has(v.paper)) continue
    seen.add(v.paper)
    papers.push({ n: v.paper, title: v.paperTitle || `Paper ${v.paper}` })
  }
  papers.sort((a, b) => a.n - b.n)
  const paperLabel = (p) =>
    p.n === 0 ? `Foreword — ${p.title}` : `Paper ${p.n} — ${p.title}`

  container.innerHTML = `
<div class="ra">
  <p class="ra-why">Follow the book's own words as the human narrator reads them — press Play and the words light up in sync.</p>
  <div class="ra-controls">
    <label class="ra-label">Paper
      <select id="ra-paper" class="ra-select">${papers
        .map((p) => `<option value="${p.n}">${esc(paperLabel(p))}</option>`)
        .join('')}</select>
    </label>
  </div>
  <p class="ra-status" id="ra-status" role="status" aria-live="polite"></p>
  <div class="ra-sync" id="ra-sync" hidden>
    <div class="ra-controls">
      <button type="button" class="soft strong" id="ra-play">▶ Play</button>
      <button type="button" class="soft" id="ra-stop">Stop</button>
      <label class="ra-label">Speed
        <select id="ra-rate" class="ra-select">
          <option value="0.75">0.75×</option>
          <option value="1" selected>1×</option>
          <option value="1.25">1.25×</option>
          <option value="1.5">1.5×</option>
          <option value="2">2×</option>
        </select>
      </label>
    </div>
    <audio id="ra-audio" class="ra-audio" controls preload="metadata"></audio>
    <div class="ra-text" id="ra-text"></div>
    <details class="ra-own">
      <summary>Use your own audio file instead</summary>
      <label class="ra-label">Choose an MP3 of this paper
        <input id="ra-file" type="file" accept="audio/*">
      </label>
      <button type="button" class="soft" id="ra-builtin">Back to the built-in narration</button>
    </details>
  </div>
  <div class="ra-fallback" id="ra-fallback" hidden>
    <p id="ra-fallback-msg"></p>
    <button type="button" class="soft strong" id="ra-tts">Listen to this paper with the built-in voice</button>
  </div>
</div>`

  const status = container.querySelector('#ra-status')
  const say = (msg) => { status.textContent = msg }
  const syncBox = container.querySelector('#ra-sync')
  const fallbackBox = container.querySelector('#ra-fallback')
  const paperSel = container.querySelector('#ra-paper')
  const textBox = container.querySelector('#ra-text')

  paperSel.value = String(store.get('readalong:paper', 1))
  if (paperSel.selectedIndex < 0) paperSel.value = '1'

  let flat = [] // {start, end, ref, paraEl, span}
  let playing = null // { paper, items } for TTS fallback jump

  function clearHighlight() {
    lastIdx = -1
    if (lastWord) lastWord.classList.remove('ra-now')
    if (lastPara) lastPara.classList.remove('ra-now-para')
    lastWord = null
    lastPara = null
  }

  function renderParagraphs(data, paperNum) {
    flat = []
    clearHighlight()
    const frag = document.createDocumentFragment()
    for (const [ref, p] of data.paragraphs) {
      const paraEl = document.createElement('div')
      paraEl.className = 'ra-para'
      const meta = E.byRef.get(ref)
      const where = meta ? ` · ${meta.sectionTitle || ''}` : ''
      paraEl.innerHTML = `<p class="ra-ref">${esc(ref)}${esc(where)}</p>`
      const textP = document.createElement('p')
      textP.className = 'ra-text-line'
      p.forEach((w, k) => {
        const span = document.createElement('span')
        span.className = 'ra-word'
        span.dataset.x = w.x ? '1' : '0'
        span.textContent = w.w
        textP.appendChild(span)
        if (k < p.length - 1) textP.appendChild(document.createTextNode(' '))
        flat.push({ start: w.start, end: w.end, ref, paraEl, span })
      })
      paraEl.appendChild(textP)
      frag.appendChild(paraEl)
    }
    textBox.replaceChildren(frag)
    const estimates = flat.length && flat.some((f) => f.span.dataset.x === '0')
    say(
      `Word timings loaded for ${paperLabel(papers.find((x) => x.n === paperNum) || { n: paperNum, title: '' })} — ${flat.length.toLocaleString()} words. Press Play.` +
        (estimates ? ' Fainter highlights are timing estimates, not measured from the voice.' : ''),
    )
  }

  function onTime() {
    if (!audio || !flat.length) return
    const i = wordAtTime(flat, audio.currentTime)
    if (i === lastIdx) return
    lastIdx = i
    if (lastWord) lastWord.classList.remove('ra-now')
    const item = flat[i]
    if (!item) return
    item.span.classList.add('ra-now')
    lastWord = item.span
    if (item.paraEl !== lastPara) {
      if (lastPara) lastPara.classList.remove('ra-now-para')
      lastPara = item.paraEl
      lastPara.classList.add('ra-now-para')
      // scroll only on paragraph change, and not more than twice a second
      const now = performance.now()
      if (now - lastScroll > 500) {
        lastScroll = now
        item.span.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' })
      }
    }
  }

  async function load(paperNum) {
    audio?.pause()
    clearHighlight()
    syncBox.hidden = true
    fallbackBox.hidden = true
    say('Loading word timings…')
    const data = await loadAlignment(paperNum)
    if (Number(paperSel.value) !== paperNum) return // user moved on
    if (!data) {
      fallbackBox.hidden = false
      container.querySelector('#ra-fallback-msg').textContent =
        "Word timings for this paper aren't published yet (they land in audio/aligned/). " +
        'Meanwhile, the Listen buttons read aloud with the built-in voice. ' +
        'Without timings we cannot sync the words — this is the honest limit, not a bug.'
      const plain = (t) => String(t).replace(/<[^>]+>/g, '')
      playing = {
        paper: paperNum,
        items: [...E.order]
          .filter((ref) => Number(ref.split(':')[0]) === paperNum)
          .map((ref) => ({ ref, text: plain(E.byRef.get(ref).text), el: null })),
      }
      say(`No word timings published for this paper yet.`)
      return
    }
    playing = null
    syncBox.hidden = false
    renderParagraphs(data, paperNum)
    useBuiltIn(paperNum)
  }

  on(paperSel, 'change', () => {
    store.set('readalong:paper', Number(paperSel.value))
    load(Number(paperSel.value))
  })

  on(container.querySelector('#ra-fallback #ra-tts'), 'click', () => {
    if (deps.startReading && playing?.items.length) {
      deps.startReading(playing.items)
      return
    }
    container.dispatchEvent(
      new CustomEvent('readalong:tts-request', { detail: { paper: Number(paperSel.value) }, bubbles: true }),
    )
  })

  // ---- audio: built-in narration stream, with "your own file" fallback ----
  audio = container.querySelector('#ra-audio')
  const fileInput = container.querySelector('#ra-file')
  const playBtn = container.querySelector('#ra-play')
  const stopBtn = container.querySelector('#ra-stop')
  const rateSel = container.querySelector('#ra-rate')
  const ownBox = container.querySelector('.ra-own')
  // One voice at a time: when the narration starts, tell the app to stop any
  // TTS voice. (The app answers with speech.stopTTS(); the event pattern
  // matches the existing 'readalong:tts-request' below.)
  on(audio, 'play', () => {
    container.dispatchEvent(new CustomEvent('readalong:playing', { bubbles: true }))
  })

  // Point the player at the built-in narration for this paper. A custom file
  // belongs to one paper, so changing papers always returns to the stream.
  function useBuiltIn(paperNum) {
    if (audioURL) {
      URL.revokeObjectURL(audioURL)
      audioURL = null
    }
    fileInput.value = ''
    audio.src = audioUrlForPaper(paperNum)
    audio.playbackRate = Number(rateSel.value)
  }

  on(fileInput, 'change', () => {
    const f = fileInput.files && fileInput.files[0]
    if (!f) return
    if (audioURL) URL.revokeObjectURL(audioURL)
    audioURL = URL.createObjectURL(f)
    audio.src = audioURL
    audio.playbackRate = Number(rateSel.value)
    say(`Loaded “${f.name}”. Press Play — the words will light up in sync.`)
  })
  on(container.querySelector('#ra-builtin'), 'click', () => {
    useBuiltIn(Number(paperSel.value))
    say('Back to the built-in narration. Press Play.')
  })
  on(playBtn, 'click', () => {
    if (!audio.getAttribute('src')) useBuiltIn(Number(paperSel.value))
    if (audio.paused) audio.play()
    else audio.pause()
  })
  on(stopBtn, 'click', () => {
    audio.pause()
    audio.currentTime = 0
    clearHighlight()
  })
  on(rateSel, 'change', () => {
    audio.playbackRate = Number(rateSel.value)
  })
  on(audio, 'timeupdate', onTime)
  on(audio, 'seeked', () => {
    lastIdx = -1
    if (lastWord) lastWord.classList.remove('ra-now')
    lastWord = null
    onTime()
  })
  on(audio, 'ended', clearHighlight)
  on(audio, 'play', () => { playBtn.textContent = 'Pause' })
  on(audio, 'pause', () => { playBtn.textContent = 'Play' })
  on(audio, 'error', () => {
    // The stream failed (offline, mirror hiccup). Offer the file fallback.
    say('The built-in narration would not load — check your connection, or use your own audio file below.')
    ownBox.open = true
  })

  load(Number(paperSel.value))

  // ---- teardown ----
  return () => {
    ac.abort()
    audio?.pause()
    if (audioURL) URL.revokeObjectURL(audioURL)
  }
}
