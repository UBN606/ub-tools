// tools.js — the Studio's front door to everything new in the kit.
// Lists every tool (extension, Parallel, entities, quote cards, API, visuals,
// read-along audio) with what it does and how to open it. Local copies are
// preferred when this Studio is served from the repo; otherwise we link GitHub.
// The TOOLS table is pure data so it can be unit-tested; rendering needs a DOM.
'use strict'

const GH = 'https://github.com/UBN606/ub-tools/tree/main'

export const TOOLS = [
  {
    id: 'extension',
    title: 'Quote-verifier extension',
    blurb: 'Checks the quotes on any web page against the book’s exact text and flags wrong or misattributed ones — right in the browser.',
    use: 'Load unpacked: chrome://extensions → Developer mode → Load unpacked → the extension/ folder.',
    local: null,
    github: `${GH}/extension`,
  },
  {
    id: 'parallel',
    title: 'UB Parallel',
    blurb: 'Bible ↔ UB explorer. Every link is typed (quotes, restates, fulfills…) and cited on both sides; differences are shown neutrally, with exact texts.',
    use: 'Type “John 15:5” or “180:2.1”. 78 curated links; the review queue is human-only, never auto-merged.',
    local: '../parallel/app/index.html',
    github: `${GH}/parallel`,
  },
  {
    id: 'entities',
    title: 'Entity index',
    blurb: 'Open data on the people, places, and groups of the book — 156 entries, 455 citations, every ref machine-verified against the text.',
    use: 'people.json, places.json, groups.json — built for study apps, games, and timelines.',
    local: null,
    github: `${GH}/entities`,
  },
  {
    id: 'quote-cards',
    title: 'Quote cards',
    blurb: '34 verified quote cards, each with its exact citation — as JSON data plus ready-to-share square and story PNGs.',
    use: 'Also browsable in this Studio under Explore. PNGs live in quote-cards/png/.',
    local: null,
    github: `${GH}/quote-cards`,
  },
  {
    id: 'api',
    title: 'UB API',
    blurb: 'A zero-server client for the book’s exact text. Look up any paragraph or verify a quote from any page or script.',
    use: 'UBApi.getParagraph("180:2.1"). Papers download on demand and cache in the browser.',
    local: '../api/demo.html',
    github: `${GH}/api`,
  },
  {
    id: 'visuals',
    title: 'Visuals',
    blurb: 'The cosmos map, Jesus’ timeline, the Palestine map, and the genealogy trees — every region and event cites its paragraph.',
    use: 'Built as portable single files; they live here and on the website.',
    view: 'explore',
    local: null,
    github: `${GH}/visuals`,
  },
  {
    id: 'audio',
    title: 'Read-along audio',
    blurb: 'Word-level timestamps syncing the text to human narration, for karaoke-style read-along highlighting. Timestamps only — never audio files.',
    use: 'Paper 1 is aligned; the rest follow. Bring your own MP3 in the Listen view.',
    view: 'listen',
    local: null,
    github: `${GH}/audio`,
  },
]

async function resolveURL(t) {
  // Prefer the local copy when this Studio is served from the repo.
  if (t.local) {
    try {
      const r = await fetch(t.local, { method: 'HEAD' })
      if (r.ok) return t.local
    } catch { /* fall through to GitHub */ }
  }
  return t.github
}

export async function renderToolsView(box, { esc, setView }) {
  box.innerHTML = `<div class="summary"><h2>Tools</h2>
    <p>Everything new in the kit — what each tool does and how to open it.</p></div>
    <div class="x-grid" id="tools-grid"><p class="why">Loading the tools…</p></div>`

  const grid = box.querySelector('#tools-grid')
  const urls = await Promise.all(TOOLS.map(resolveURL))
  grid.innerHTML = TOOLS.map((t, i) => {
    const url = urls[i]
    const openBtn = t.view
      ? `<button type="button" class="soft" data-view="${esc(t.view)}">Open in the Studio</button>`
      : ''
    return `<div class="x-card">
      <strong>${esc(t.title)}</strong>
      <span>${esc(t.blurb)}</span>
      <span class="why">${esc(t.use)}</span>
      <div class="x-actions">
        ${openBtn}
        <a class="soft" href="${esc(url)}" ${t.view ? '' : 'target="_blank" rel="noopener"'}>Open${t.local ? '' : ' on GitHub'} →</a>
      </div>
    </div>`
  }).join('')

  grid.querySelectorAll('[data-view]').forEach((b) =>
    b.addEventListener('click', () => setView(b.dataset.view)))
}
