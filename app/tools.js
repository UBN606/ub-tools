// tools.js — "More ways to study": every tool in plain language.
// Rule: nothing here points at a code-hosting site and no jargon a new
// reader wouldn't know. Every action is something a reader can actually do:
// open a page, open another view in this Studio, look someone up, or follow
// numbered install steps. The TOOLS table is pure data so it can be tested;
// rendering needs a DOM.
'use strict'

const PAGES = 'https://ubn606.github.io/ub-tools'

import { trackById } from './study-tracks.js'

export const TOOLS = [
  {
    id: 'newcomer-start',
    title: 'New here? Start here',
    blurb: 'First time with The Urantia Book? These are the questions everyone asks first — answered in plain language, with the exact paragraphs.',
    action: { kind: 'track', track: 'newcomer-start' },
  },
  {
    id: 'love-one-another',
    title: 'Love one another',
    blurb: 'What the book teaches about loving each other — and about learning from one another\u2019s religion.',
    action: { kind: 'track', track: 'love-one-another' },
  },
  {
    id: 'parallel',
    title: 'Bible comparisons',
    blurb: 'See what the Bible and The Urantia Book say side by side. Every link shows both texts and how they relate — where they agree and where they differ.',
    hint: 'Try "John 15:5" or "180:2.1".',
    action: { kind: 'page', local: '../parallel/app/index.html', remote: `${PAGES}/parallel/app/index.html`, label: 'Open' },
  },
  {
    id: 'entities',
    title: "Who's who",
    blurb: 'Look up any person, place, or group in the book — who they are, and the exact paragraphs that describe them.',
    action: { kind: 'entities' },
  },
  {
    id: 'extension',
    title: 'Quote checker',
    blurb: 'A helper for your Chrome or Edge browser. It checks the quotes you meet on the web against the book and warns you when one is wrong or misattributed.',
    action: { kind: 'extension' },
  },
  {
    id: 'quote-cards',
    title: 'Picture quotes',
    blurb: 'Short, verified quotes as pictures — ready to share with family and friends.',
    action: { kind: 'view', view: 'explore', label: 'Browse the quotes' },
  },
  {
    id: 'visuals',
    title: 'Maps and timelines',
    blurb: 'The cosmos, the life of Jesus on a timeline, Bible lands on a map, and family trees. Every picture names the paragraph it came from.',
    action: { kind: 'view', view: 'explore', label: 'Open the pictures' },
  },
  {
    id: 'audio',
    title: 'Listen along',
    blurb: 'Follow the words while a human voice reads them — each word lights up as it is spoken.',
    action: { kind: 'view', view: 'listen', label: 'Open listening' },
  },
  {
    id: 'api',
    title: 'For website builders',
    blurb: 'Putting the book on your own website? This free helper looks up any paragraph by its number. No account, nothing to install.',
    action: { kind: 'page', local: '../api/demo.html', remote: `${PAGES}/api/demo.html`, label: 'Try the demo' },
  },
]

const KIND_LABEL = { person: 'Person', place: 'Place', group: 'Group' }

async function resolvePage(action) {
  // Prefer the copy next to this Studio; fall back to the public website.
  try {
    const r = await fetch(action.local, { method: 'HEAD' })
    if (r.ok) return action.local
  } catch { /* fall through */ }
  return action.remote
}

let entityCache = null
async function loadEntities() {
  if (entityCache) return entityCache
  const out = []
  for (const file of ['people', 'places', 'groups']) {
    try {
      const r = await fetch(`../entities/${file}.json`)
      if (!r.ok) continue
      const arr = await r.json()
      for (const e of arr) {
        if (e && e.name) out.push({ name: e.name, kind: KIND_LABEL[e.kind] || 'Entry', note: e.note || '', aliases: e.aliases || [], refs: e.refs || [] })
      }
    } catch { /* a missing file just means fewer entries */ }
  }
  entityCache = out
  return out
}

function entityCard(t, esc) {
  return `<div class="x-card">
    <strong>${esc(t.title)}</strong>
    <span>${esc(t.blurb)}</span>
    <div class="e-search">
      <label class="sr" for="e-q">Look up a name</label>
      <input id="e-q" type="search" placeholder="Try Gabriel or Jerusalem" autocomplete="off">
      <div class="e-results" id="e-results" aria-live="polite"><p class="why">Type a name above.</p></div>
      <details class="e-browse">
        <summary class="soft">Browse everyone A–Z</summary>
        <div class="e-az" id="e-az"><p class="why">Loading…</p></div>
      </details>
    </div>
  </div>`
}

function trackCard(t, esc) {
  const track = trackById(t.action.track)
  if (!track || !track.questions.length) return ''
  return `<div class="x-card">
    <strong>${esc(t.title)}</strong>
    <span>${esc(t.blurb)}</span>
    <div class="track">
      ${track.questions.map((q, i) => `
      <details class="x-details"${i === 0 ? ' open' : ''}>
        <summary>${esc(q.q)}</summary>
        <p>${esc(q.answer)}</p>
        ${q.quotes.map((qt) => `
        <blockquote class="t-quote">${esc(qt.text)}
          <span class="t-ref"><button type="button" class="soft" data-ref="${esc(qt.ref)}">Read ${esc(qt.ref)}</button></span>
        </blockquote>`).join('')}
      </details>`).join('')}
    </div>
  </div>`
}

function extensionCard(t, esc) {
  return `<div class="x-card">
    <strong>${esc(t.title)}</strong>
    <span>${esc(t.blurb)}</span>
    <details class="x-details">
      <summary class="soft">How to install it (about a minute)</summary>
      <ol class="x-steps">
        <li><a href="../extension/ub-quote-verifier.zip" download>Download the checker</a> (a small file), then open the downloaded file to unzip it.</li>
        <li>In Chrome or Edge, type <code>chrome://extensions</code> in the address bar and press Enter.</li>
        <li>Switch on <strong>Developer mode</strong> (top-right corner).</li>
        <li>Click <strong>Load unpacked</strong> and choose the unzipped folder.</li>
        <li>Done. Visit any page with a quote and click the checker icon.</li>
      </ol>
    </details>
  </div>`
}

export async function renderToolsView(box, { esc, setView, openRef }) {
  box.innerHTML = `<div class="summary"><h2>More ways to study</h2>
    <p>Everything here is free. Pick one to begin.</p></div>
    <div class="x-grid" id="tools-grid"><p class="why">Loading…</p></div>`

  const grid = box.querySelector('#tools-grid')
  const urls = await Promise.all(TOOLS.map((t) => t.action.kind === 'page' ? resolvePage(t.action) : null))
  grid.innerHTML = TOOLS.map((t, i) => {
    const a = t.action
    if (a.kind === 'entities') return entityCard(t, esc)
    if (a.kind === 'extension') return extensionCard(t, esc)
    if (a.kind === 'track') return trackCard(t, esc)
    const btn = a.kind === 'view'
      ? `<button type="button" class="soft" data-view="${esc(a.view)}">${esc(a.label)}</button>`
      : `<a class="soft" href="${esc(urls[i])}" target="_blank" rel="noopener">${esc(a.label)} →</a>`
    return `<div class="x-card">
      <strong>${esc(t.title)}</strong>
      <span>${esc(t.blurb)}</span>
      ${t.hint ? `<span class="why">${esc(t.hint)}</span>` : ''}
      <div class="x-actions">${btn}</div>
    </div>`
  }).join('')

  grid.querySelectorAll('[data-view]').forEach((b) =>
    b.addEventListener('click', () => setView(b.dataset.view)))

  // --- study-track "Read <ref>" buttons: jump to the paragraph in the reader ---
  grid.querySelectorAll('.track [data-ref]').forEach((b) =>
    b.addEventListener('click', () => { setView('read'); openRef(b.dataset.ref) }))

  // --- who's-who search ---
  const input = grid.querySelector('#e-q')
  const results = grid.querySelector('#e-results')
  if (!input || !results) return
  const entries = await loadEntities()
  if (!entries.length) { results.innerHTML = '<p class="why">The lookup is not in this copy.</p>'; return }
  const draw = () => {
    const q = input.value.trim().toLowerCase()
    if (!q) { results.innerHTML = '<p class="why">Type a name above.</p>'; return }
    const hits = entries.filter((e) =>
      e.name.toLowerCase().includes(q) || e.aliases.some((al) => al.toLowerCase().includes(q))).slice(0, 8)
    if (!hits.length) { results.innerHTML = '<p class="why">No match. Try a shorter name.</p>'; return }
    results.innerHTML = hits.map((e) => `<div class="e-row">
      <p><strong>${esc(e.name)}</strong> <span class="e-kind">${esc(e.kind)}</span></p>
      ${e.note ? `<p class="why">${esc(e.note)}</p>` : ''}
      <div class="x-actions">${e.refs.map((r) => `<button type="button" class="soft" data-ref="${esc(r)}">Read ${esc(r)}</button>`).join('')}</div>
    </div>`).join('')
    results.querySelectorAll('[data-ref]').forEach((b) =>
      b.addEventListener('click', () => { setView('read'); openRef(b.dataset.ref) }))
  }
  input.addEventListener('input', draw)

  // --- who's-who A–Z browse ---
  const az = grid.querySelector('#e-az')
  if (az && entries.length) {
    const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name))
    const groups = new Map()
    for (const e of sorted) {
      const letter = (e.name[0] || '#').toUpperCase()
      if (!groups.has(letter)) groups.set(letter, [])
      groups.get(letter).push(e)
    }
    az.innerHTML = [...groups].map(([letter, list]) => `
      <div class="e-az-group">
        <h4>${esc(letter)}</h4>
        ${list.map((e, i) => `<button type="button" class="e-az-name" data-az="${esc(letter)}-${i}">${esc(e.name)}</button>`).join('')}
      </div>`).join('')
    const showEntry = (e) => {
      results.innerHTML = `<div class="e-row">
        <p><strong>${esc(e.name)}</strong> <span class="e-kind">${esc(e.kind)}</span></p>
        ${e.note ? `<p class="why">${esc(e.note)}</p>` : ''}
        <div class="x-actions">${e.refs.map((r) => `<button type="button" class="soft" data-ref="${esc(r)}">Read ${esc(r)}</button>`).join('')}</div>
      </div>`
      results.querySelectorAll('[data-ref]').forEach((b) =>
        b.addEventListener('click', () => { setView('read'); openRef(b.dataset.ref) }))
      results.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
    az.querySelectorAll('.e-az-name').forEach((b) => {
      const [letter, idx] = b.dataset.az.split('-')
      b.addEventListener('click', () => showEntry(groups.get(letter)[+idx]))
    })
  }
}
