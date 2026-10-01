// Explore: the Studio's front door to the imagery — the visuals/ pages and the
// verified quote cards. Everything is linked or rendered in place; nothing heavy.
// Visual pages are checked at runtime so the view degrades cleanly if a page
// isn't published yet.
'use strict'

const VISUALS = [
  { id: 'cosmos', title: 'Map of the cosmos', blurb: 'Paradise, Havona and the seven superuniverses, drawn from Papers 11–15. Every region cites its paragraph.' },
  { id: 'timeline', title: "Jesus' timeline", blurb: 'All 36 years across Papers 120–196. Scrub the timeline; every event links its paragraph.' },
  { id: 'maps', title: 'Palestine map', blurb: 'The places of the book on an ancient Palestine map. Tap a place to read every paragraph about it.' },
  { id: 'genealogy', title: 'Genealogy trees', blurb: 'The lineages the book traces — Adam’s line, Jesus’ ancestry — as clickable family trees.' },
]

async function visualURL(id) {
  // The visuals are built as self-contained pages; accept either layout.
  for (const p of [`../visuals/${id}/index.html`, `../visuals/${id}.html`]) {
    try { const r = await fetch(p, { method: 'HEAD' }); if (r.ok) return p } catch { /* missing */ }
  }
  return null
}

export async function renderExploreView(box, { esc, openRef, copyText, setView }) {
  box.innerHTML = `<div class="summary"><h2>Explore</h2><p>Maps, timelines and pictures from the book — every one of them cited.</p></div>
  <h3 class="section-title">Maps &amp; timelines</h3><div class="x-grid" id="x-visuals"><p class="why">Looking for the visuals…</p></div>
  <h3 class="section-title">Quote cards</h3><div class="chips" id="x-topics"></div><div class="x-grid" id="x-cards"><p class="why">Loading the cards…</p></div>`

  // --- visuals ---
  const vbox = box.querySelector('#x-visuals')
  const cards = await Promise.all(VISUALS.map(async (v) => ({ ...v, url: await visualURL(v.id) })))
  vbox.innerHTML = cards.map((v) => v.url
    ? `<a class="x-card" href="${esc(v.url)}"><strong>${esc(v.title)}</strong><span>${esc(v.blurb)}</span><span class="x-open">Open →</span></a>`
    : `<div class="x-card x-soon" aria-disabled="true"><strong>${esc(v.title)}</strong><span>${esc(v.blurb)}</span><span class="x-open">Being built — check back soon</span></div>`
  ).join('')

  // --- quote cards, rendered from the verified cards.json ---
  const cbox = box.querySelector('#x-cards')
  let cardsData = []
  try {
    const r = await fetch('../quote-cards/cards.json')
    if (r.ok) cardsData = (await r.json()).filter((c) => c.verified)
  } catch { /* offline or missing */ }
  if (!cardsData.length) { cbox.innerHTML = '<p class="why">The cards are not published in this copy.</p>'; return }
  const topics = [...new Set(cardsData.map((c) => c.topic))]
  const tbox = box.querySelector('#x-topics')
  let active = 'all'
  const draw = () => {
    tbox.innerHTML = [`<button type="button" class="chip${active === 'all' ? ' on' : ''}" data-t="all">All (${cardsData.length})</button>`,
      ...topics.map((t) => `<button type="button" class="chip${active === t ? ' on' : ''}" data-t="${esc(t)}">${esc(t)} (${cardsData.filter((c) => c.topic === t).length})</button>`)].join('')
    tbox.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => { active = b.dataset.t; draw() }))
    const list = active === 'all' ? cardsData : cardsData.filter((c) => c.topic === active)
    cbox.innerHTML = list.map((c, i) => `<figure class="x-card x-quote">
      <blockquote>“${esc(c.quote)}”</blockquote>
      <figcaption>The Urantia Book, ${esc(c.citation)}</figcaption>
      <div class="x-actions">
        <button type="button" class="soft" data-open="${esc(c.citation)}">Open in the book</button>
        <button type="button" class="soft" data-copy="${esc(c.citation)}">Copy link</button>
      </div></figure>`).join('')
    cbox.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => { setView('read'); openRef(b.dataset.open) }))
    cbox.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async (e) => {
      const btn = e.currentTarget
      const ok = await copyText(`${location.origin}${location.pathname}?ref=${encodeURIComponent(b.dataset.copy)}`)
      btn.textContent = ok ? 'Copied' : 'Copy blocked'
      setTimeout(() => { btn.textContent = 'Copy link' }, 2000)
    }))
  }
  draw()
}
