// UB Tools Studio: the interface. The engine (engine.js) runs the repository's own tools.
import { loadEngine } from './engine.js'
import { citeLine, copyText, shareQuote, quotePicture } from './share.js'
import { answer, speech, listener, englishVoices, whenVoices, chooseVoice } from './ask.js'

const $ = (id) => document.getElementById(id)
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v) } catch { return d } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* private window */ } },
}
const REF_ONLY = /^\s*(\d{1,3}:\d{1,2}\.\d{1,3})(\s*[,;\s]\s*\d{1,3}:\d{1,2}\.\d{1,3})*\s*$/
const LABELS = {
  'mexico-central-america': 'Mexico and Central America', 'south-america': 'South America and Peru',
  'north-america-red-race': 'North America and the red race', pacific: 'The Pacific and Polynesia', japan: 'Japan',
  china: 'China', tibet: 'Tibet', india: 'India', egypt: 'Egypt', africa: 'Africa', mesopotamia: 'Mesopotamia',
  europe: 'Europe', 'orange-race': 'The orange race', 'blue-race': 'The blue race',
}
const label = (id) => LABELS[id] || id.replace(/^name:/, '').replace(/^"(.+)".*$/, '$1')

let E = null
let mode = 'ask'
let current = null // ref shown in the tablet
let lastList = []  // refs in the result list, for highlighting the open one
const player = { items: [], i: 0, gen: 0, paused: false } // the reading-aloud queue

// ---------- boot ----------
const status = $('status')
const fill = $('groove-fill')
loadEngine((done, total, source) => {
  fill.style.width = `${(done / total) * 100}%`
  status.textContent = `Reading the book from ${source}: ${done} of ${total} documents`
}).then((engine) => {
  E = engine
  status.textContent = `${E.paragraphs.toLocaleString()} paragraphs ready`
  status.classList.add('ready')
  $('groove').classList.add('done')
  for (const el of [$('q'), $('draft'), $('go')]) el.disabled = false
  $('q').focus()
  const u = new URL(location.href)
  if (u.searchParams.get('q')) { $('q').value = u.searchParams.get('q'); setMode(u.searchParams.get('mode') || 'ask'); submit() }
}).catch((err) => {
  status.textContent = 'The book could not be loaded'
  $('hint').innerHTML = `The book text did not load (${esc(err.message)}). Check your connection and reload. If you run the tools from a copy of the repository, run <code>node fetch-data.js</code> there first.`
})

// ---------- modes ----------
const tabs = [...document.querySelectorAll('.modes button')]
function placeThumb() {
  const on = tabs.find((t) => t.dataset.mode === mode)
  const thumb = document.querySelector('.modes-thumb')
  thumb.style.width = `${on.offsetWidth}px`
  thumb.style.transform = `translateX(${on.offsetLeft - 5}px)`
}
function setMode(m) {
  stopReading()
  mode = m
  for (const t of tabs) { const on = t.dataset.mode === m; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1 }
  $('panel').setAttribute('aria-labelledby', `tab-${m}`)
  const check = m === 'check'
  $('q').hidden = check
  $('draft').hidden = !check
  const ask = m === 'ask'
  $('mic').hidden = !ask || !mic
  $('q-label').textContent = check ? 'Paste a draft' : ask ? 'Ask a question' : m === 'places' ? 'A place or people' : 'Search the book'
  $('q').placeholder = ask ? 'Ask a question, like: What happens after we die?' : m === 'places' ? 'A place or people, like Maya, Peru or Easter Island' : 'Words, a phrase, or a reference like 180:2.1'
  $('go').textContent = check ? 'Check draft' : ask ? 'Ask the book' : m === 'places' ? 'Show every paragraph' : 'Search'
  $('hint').textContent = ask
    ? 'The book answers in its own words, with where to find them. Tap the microphone to speak your question. Press Listen to hear the answer.'
    : check
    ? 'Checks each quote against its citation, every claim credited to the book, and whether the draft left paragraphs on its subject unread.'
    : m === 'places'
      ? 'Modern names find the book\'s own: Maya finds Mexico and Central America. Read every paragraph before saying what the book says.'
      : 'Whole words: "vine" finds vine and vines, never "divine". Quote only the full text shown on the right.'
  renderChips()
  placeThumb()
  $('results').innerHTML = ''
  closeTablet()
  ;(check ? $('draft') : $('q')).focus()
}
tabs.forEach((t) => {
  t.addEventListener('click', () => setMode(t.dataset.mode))
  t.addEventListener('keydown', (e) => {
    const i = tabs.indexOf(t)
    const j = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i + tabs.length - 1) % tabs.length : -1
    if (j >= 0) { e.preventDefault(); tabs[j].focus(); setMode(tabs[j].dataset.mode) }
  })
})
const mic = listener((text) => { $('q').value = text; submit() }, (on) => $('mic').classList.toggle('listening', on))
$('mic').addEventListener('click', () => { try { mic.start() } catch { mic.stop() } })
whenVoices(() => {
  const list = englishVoices()
  if (!list.length) return
  let saved = null
  try { saved = localStorage.getItem('voice') } catch {}
  const sel = $('voice')
  sel.innerHTML = list.map((v) => `<option value="${esc(v.name)}">${esc(v.name.replace(/^Microsoft /, '').replace(/ Online \(Natural\).*$/, ' (natural)').replace(/ - English.*$/, ''))}</option>`).join('')
  sel.value = list.some((v) => v.name === saved) ? saved : list[0].name
  $('voice-wrap').hidden = false
})
$('voice').addEventListener('change', (e) => { chooseVoice(e.target.value); speech.say('This is how I will read to you.') })
const bigger = $('bigger')
const setBig = (on) => { document.documentElement.classList.toggle('big', on); bigger.setAttribute('aria-pressed', String(on)); store.set('big', on); placeThumb() }
bigger.addEventListener('click', () => setBig(!document.documentElement.classList.contains('big')))
setBig(store.get('big', true))
setMode('ask')
tabs.forEach((t) => { t.tabIndex = t.getAttribute('aria-selected') === 'true' ? 0 : -1 })
addEventListener('resize', placeThumb)
document.fonts?.ready.then(placeThumb)
placeThumb()

function renderChips() {
  const box = $('chips')
  if (mode !== 'places') { box.hidden = true; box.innerHTML = ''; return }
  const ids = ['mexico-central-america', 'south-america', 'pacific', 'japan', 'india', 'egypt', 'europe', 'orange-race', 'blue-race']
  box.innerHTML = ids.map((id) => `<button type="button" class="chip" data-id="${id}">${esc(LABELS[id])}</button>`).join('')
  box.hidden = false
  box.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => { $('q').value = c.textContent; runPlaces(c.dataset.id, c.textContent) }))
}

// ---------- submit ----------
$('ask').addEventListener('submit', (e) => { e.preventDefault(); submit() })
$('draft').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit() } })
function submit() {
  if (!E) return
  if (mode === 'check') return runCheck($('draft').value)
  const q = $('q').value.trim()
  if (!q) return
  if (mode === 'places') return runPlaces(q)
  if (mode === 'ask' && !REF_ONLY.test(q)) return runAsk(q)
  if (REF_ONLY.test(q)) {
    const refs = q.match(/\d{1,3}:\d{1,2}\.\d{1,3}/g)
    renderList(refs.map((r) => ({ ref: r })), { title: refs.length === 1 ? 'Reference' : `${refs.length} references`, sub: '' })
    return openRef(refs[0])
  }
  runSearch(q)
}

// ---------- reading aloud: one player, always visible while reading ----------
// A queue of paragraphs, read one at a time. The player at the bottom shows which one is being
// read ("Reading 2 of 5"), with Previous, Pause, Stop and Next; the paragraph itself is lit up.
function lightUp() {
  document.querySelectorAll('.now-reading').forEach((el) => el.classList.remove('now-reading'))
  const it = player.items[player.i]
  if (!it) return
  it.el?.classList.add('now-reading')
  it.el?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
  $('p-label').textContent = player.items.length > 1 ? `Reading ${player.i + 1} of ${player.items.length}` : 'Reading'
  $('p-ref').textContent = it.ref
  $('p-prev').disabled = player.i === 0
  $('p-next').disabled = player.i >= player.items.length - 1
  $('p-pause').textContent = 'Pause'
  player.paused = false
}
function playAt(i) {
  const gen = ++player.gen
  player.i = i
  lightUp()
  $('player').hidden = false
  const it = player.items[i]
  speech.say(it.text, () => {
    if (gen !== player.gen) return // stopped or skipped: this reading is over
    if (player.i < player.items.length - 1) playAt(player.i + 1)
    else stopReading()
  })
}
function startReading(items, i = 0) { speech.stop(); player.items = items; playAt(i) }
function stopReading() {
  player.gen++
  speech.stop()
  player.items = []
  $('player').hidden = true
  document.querySelectorAll('.now-reading').forEach((el) => el.classList.remove('now-reading'))
}
$('p-stop').addEventListener('click', stopReading)
$('p-prev').addEventListener('click', () => { if (player.i > 0) { player.gen++; speech.stop(); playAt(player.i - 1) } })
$('p-next').addEventListener('click', () => { if (player.i < player.items.length - 1) { player.gen++; speech.stop(); playAt(player.i + 1) } })
$('p-pause').addEventListener('click', () => {
  if (player.paused) { speechSynthesis.resume(); player.paused = false; $('p-pause').textContent = 'Pause' }
  else { speechSynthesis.pause(); player.paused = true; $('p-pause').textContent = 'Resume' }
})
addEventListener('keydown', (e) => { if (e.key === 'Escape' && player.items.length) stopReading() })
addEventListener('pagehide', stopReading)
document.addEventListener('visibilitychange', () => { if (document.hidden) stopReading() })

// ---------- ask ----------
function runAsk(q) {
  stopReading()
  const r = answer(E, q)
  const box = $('results')
  if (!r.refs.length) { box.innerHTML = `<p class="empty">The book does not speak to that in these words. Try asking with other words.</p>`; return }
  const pars = E.search.getParagraphs(r.refs).filter((p) => !p.error)
  const plain = (t) => t.replace(/<[^>]+>/g, '')
  box.innerHTML = `<div class="answer-head"><h2>What the book says</h2><div class="head-actions">${speech.ok ? '<button type="button" class="soft strong" id="read-all">Listen to the answer</button>' : ''}<button type="button" class="soft" id="print">Print the answer</button><button type="button" class="soft" id="copy-all">Copy the answer</button></div></div>
<p class="print-question">Question: ${esc(q)}</p>
<ol class="answer">${pars.map((p, i) => `<li><p class="a-ref">${esc(p.ref)}</p><p class="a-where">${esc(p.paperTitle)}. ${esc(p.section)}.</p><p class="a-text">${esc(plain(p.text))}</p><div class="a-actions">${speech.ok ? `<button type="button" class="soft" data-say="${i}">Listen</button>` : ''}<button type="button" class="soft" data-open="${esc(p.ref)}">See it in the book</button><button type="button" class="soft" data-copy="${i}">Copy</button><button type="button" class="soft" data-share="${i}">Share</button><button type="button" class="soft" data-pic="${i}">Quote picture</button></div><p class="a-note" aria-live="polite"></p></li>`).join('')}</ol>
<p class="print-foot">From The Urantia Book, as found by UB Tools Studio: https://ubn606.github.io/ub-tools/app/ . URANTIA BOOK NETWORK, urantiabooknetwork.com</p>`
  const cards = [...box.querySelectorAll('.answer li')]
  const items = pars.map((p, i) => ({ ref: p.ref, el: cards[i], text: `${plain(p.text)} Paper ${p.ref.replace(':', ', section ').replace('.', ', paragraph ')}.` }))
  box.querySelectorAll('[data-say]').forEach((b) => b.addEventListener('click', () => { const i = Number(b.dataset.say); startReading([items[i]]) }))
  box.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => openRef(b.dataset.open)))
  $('read-all')?.addEventListener('click', () => startReading(items))
  const quotes = pars.map((p) => ({ ref: p.ref, text: plain(p.text) }))
  const note = (i, msg) => { const n = cards[i].querySelector('.a-note'); n.textContent = msg; setTimeout(() => { if (n.textContent === msg) n.textContent = '' }, 4000) }
  box.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => { const i = Number(b.dataset.copy); note(i, (await copyText(citeLine(quotes[i]))) ? 'Copied, with its citation. Paste it anywhere.' : 'Copy was blocked. Select the words and copy them.') }))
  box.querySelectorAll('[data-share]').forEach((b) => b.addEventListener('click', () => { const i = Number(b.dataset.share); shareQuote(quotes[i], q, (m) => showShareMenu(cards[i], m)) }))
  box.querySelectorAll('[data-pic]').forEach((b) => b.addEventListener('click', async () => { const i = Number(b.dataset.pic); note(i, 'Making the picture...'); const r = await quotePicture(quotes[i]); note(i, r === 'saved' ? 'Picture saved to your downloads. Post it on Instagram or anywhere.' : r === 'shared' ? 'Shared.' : '') }))
  $('print').addEventListener('click', () => { stopReading(); print() })
  $('copy-all').addEventListener('click', async (e) => { const btn = e.currentTarget; const ok = await copyText([q, ...quotes.map(citeLine)].join('\n\n')); btn.textContent = ok ? 'Copied' : 'Copy blocked'; setTimeout(() => { $('copy-all') && ($('copy-all').textContent = 'Copy the answer') }, 2500) })
}

function showShareMenu(card, m) {
  card.querySelector('.share-menu')?.remove()
  const d = document.createElement('div')
  d.className = 'share-menu'
  d.innerHTML = `<button type="button" class="soft" data-m="copy">Copy text</button><a class="soft" href="${esc(m.email)}">Email</a><a class="soft" href="${esc(m.facebook)}" target="_blank" rel="noopener">Facebook</a><button type="button" class="soft" data-m="close">Close</button><p class="a-note">For Facebook, copy the text first, then paste it into your post.</p>`
  card.appendChild(d)
  d.querySelector('[data-m="copy"]').addEventListener('click', async (e) => { const btn = e.currentTarget; btn.textContent = (await m.copy()) ? 'Copied' : 'Copy blocked' })
  d.querySelector('[data-m="close"]').addEventListener('click', () => d.remove())
}

// ---------- search ----------
function highlight(text, res) {
  let out = esc(text)
  for (const re of res || []) {
    const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
    out = out.replace(r, (m) => `<mark>${m}</mark>`)
  }
  return out
}
function runSearch(q) {
  const r = E.search.searchUB({ query: q, limit: 60 })
  const items = r.results.map((x) => ({ ref: x.ref, text: x.text, res: [r.phraseRe, ...r.termRes] }))
  renderList(items, {
    title: r.total ? `${r.total.toLocaleString()} paragraph${r.total === 1 ? '' : 's'}` : 'Nothing found',
    sub: r.total > items.length ? `Showing the first ${items.length}, exact phrase first` : r.total ? 'Exact phrase first' : '',
    empty: `No paragraph uses <strong>${esc(q)}</strong> as a whole word. Try the book's own term, or a shorter phrase.`,
  })
}

// ---------- places ----------
function runPlaces(q, shown = q) {
  const groups = E.recall.resolve(q)
  const pars = E.recall.paragraphsFor(groups)
  const key = `read:${groups.map((g) => g.id).join('+')}`
  const read = new Set(store.get(key, []))
  const items = pars.map((p) => ({ ref: p.ref, text: E.recall.excerpt(p.text, groups), read }))
  const known = !groups[0].id.startsWith('"')
  renderList(items, {
    title: `${pars.length} paragraph${pars.length === 1 ? '' : 's'} on ${esc(known ? groups.map((g) => label(g.id)).join(' and ') : shown)}`,
    sub: `${known ? 'The book\'s own names searched' : 'Not in the places list; searched as a whole word'}. Papers 57 to 61 (geology) skipped.`,
    progressKey: key, read,
    empty: `The book has no paragraph on <strong>${esc(shown)}</strong> under that name. Try the name the book uses.`,
  })
}

// ---------- check a draft ----------
function runCheck(text) {
  if (!text.trim()) { $('results').innerHTML = '<p class="empty">Paste a draft first. Quotes need a citation after them, like "..." (180:2.1).</p>'; return }
  const v = E.verify.verifyText(text)
  const quoteProblems = v.results.filter((r) => r.status !== 'PASS')
  const claims = E.claims.checkDraft(text)
  const rec = E.recall.checkText(text)
  const total = quoteProblems.length + v.dashes.length + claims.length + rec.unread.length
  const box = $('results')
  let html = `<div class="verdict"><div class="seal ${total ? 'fix' : 'ok'}" aria-hidden="true">${total ? total : 'OK'}</div><div><h2>${total ? `${total} thing${total === 1 ? '' : 's'} to fix` : 'Ready to publish'}</h2><p>${v.results.length} quote${v.results.length === 1 ? '' : 's'} checked, ${claims.length} claim finding${claims.length === 1 ? '' : 's'}, ${rec.required} paragraph${rec.required === 1 ? '' : 's'} on the draft's subject.</p></div></div>`

  html += '<h3 class="section-title">Quotes</h3>'
  if (!v.results.length) html += '<p class="why">No quotation followed by a (Paper:Section.Paragraph) citation was found.</p>'
  else if (!quoteProblems.length) html += `<p class="why">All ${v.results.length} quotes match the book word for word.</p>`
  else html += `<ul class="list">${quoteProblems.map((r) => `<li class="row finding"><span class="kind">${esc(r.status)}</span><p class="said">"${esc(r.body.slice(0, 220))}${r.body.length > 220 ? '...' : ''}" (${esc(r.citation)})</p><p class="detail">${esc(r.detail || '')}${r.changes?.length ? ` Changes: ${r.changes.slice(0, 4).map((c) => `you wrote "${esc(c.quoteSays)}", the book says "${esc(c.bookSays)}"`).join('; ')}.` : ''} ${r.refs?.length ? `<button type="button" class="linkish" data-ref="${esc(r.refs[0])}">Open ${esc(r.refs[0])}</button>` : ''}</p></li>`).join('')}</ul>`

  html += '<h3 class="section-title">Claims about the book</h3>'
  html += claims.length
    ? `<ul class="list">${claims.map((f) => `<li class="row finding"><span class="kind">${esc(f.kind.replace(/^C\d /, '').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()))}, line ${f.line}</span><p class="said">${esc(f.text.slice(0, 260))}${f.text.length > 260 ? '...' : ''}</p><p class="detail">${esc(f.detail)}</p></li>`).join('')}</ul>`
    : '<p class="why">Every sentence that credits the book is cited, and its figures are in the cited paragraphs.</p>'

  if (v.dashes.length) html += `<h3 class="section-title">Dashes in your own words</h3><ul class="list">${v.dashes.map((d) => `<li class="row finding"><span class="kind">Line ${d.line}</span><p class="detail">${esc(d.text.slice(0, 200))}</p></li>`).join('')}</ul>`

  html += '<h3 class="section-title">Unread on this subject</h3>'
  if (!rec.why.size) html += '<p class="why">No listed place is the subject of this draft or under a limiting claim.</p>'
  else {
    html += `<p class="why">${[...rec.why].map(([id, w]) => `${esc(label(id))}: ${esc(w)}`).join('<br>')}</p>`
    html += rec.unread.length
      ? `<ul class="list">${rec.unread.map((p) => `<li class="row"><button type="button" data-ref="${esc(p.ref)}"><span class="ref">${esc(p.ref)}</span><span><span class="txt">${esc(E.recall.excerpt(p.text, p.groups.flatMap((id) => E.recall.resolve(id.startsWith('name:') ? id.slice(5) : id))))}</span></span></button></li>`).join('')}</ul>`
      : `<p class="why">All ${rec.required} paragraphs are cited in the draft.</p>`
  }
  box.innerHTML = html
  box.querySelectorAll('[data-ref]').forEach((b) => b.addEventListener('click', () => openRef(b.dataset.ref)))
  lastList = rec.unread.map((p) => p.ref)
}

// ---------- list ----------
function renderList(items, { title, sub, empty, progressKey, read }) {
  lastList = items.map((i) => i.ref)
  const box = $('results')
  if (!items.length) { box.innerHTML = `<div class="summary"><h2>${title}</h2></div><p class="empty">${empty}</p>`; return }
  const progress = progressKey ? `<span class="progress" id="progress"></span>` : ''
  box.innerHTML = `<div class="summary"><h2>${title}</h2><p>${esc(sub || '')}</p>${progress}</div><ul class="list">${items.map((i) => {
    const p = E.byRef.get(i.ref)
    const text = i.text ?? p?.text ?? ''
    const where = p ? `${esc(p.paperTitle)}${p.sectionTitle ? `, ${esc(p.sectionTitle)}` : ''}` : ''
    const tick = read ? `<input type="checkbox" class="read-toggle tick" data-ref="${esc(i.ref)}" aria-label="Mark ${esc(i.ref)} as read" ${read.has(i.ref) ? 'checked' : ''}>` : ''
    return `<li class="row"><button type="button" data-open="${esc(i.ref)}"><span class="ref">${esc(i.ref)}</span><span><span class="where">${where}</span><span class="txt">${highlight(text, i.res)}</span></span></button>${tick}</li>`
  }).join('')}</ul>`
  box.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => openRef(b.dataset.open)))
  if (read) {
    const update = () => {
      const n = items.filter((i) => read.has(i.ref)).length
      const frac = items.length ? n / items.length : 0
      const c = 2 * Math.PI * 11
      $('progress').innerHTML = `<svg class="ring" viewBox="0 0 30 30" aria-hidden="true"><circle cx="15" cy="15" r="11" fill="none" stroke="#DAD6D0" stroke-width="4"/><circle cx="15" cy="15" r="11" fill="none" stroke="#46618A" stroke-width="4" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - frac)}" transform="rotate(-90 15 15)"/></svg>${n} of ${items.length} read`
    }
    box.querySelectorAll('.read-toggle').forEach((t) => t.addEventListener('change', () => {
      t.checked ? read.add(t.dataset.ref) : read.delete(t.dataset.ref)
      store.set(progressKey, [...read]); update()
    }))
    update()
  }
}

// ---------- the tablet ----------
function openRef(ref) {
  const exact = E.search.getParagraphs([ref])[0]
  current = ref
  $('panel').classList.add('work', 'reading')
  $('tablet').hidden = false
  const inner = document.querySelector('.tablet-inner')
  inner.style.animation = 'none'; void inner.offsetWidth; inner.style.animation = ''
  $('t-note').textContent = ''
  if (exact.error) {
    $('t-ref').textContent = ref
    $('t-where').textContent = ''
    $('t-text').textContent = `${exact.error}. References look like Paper:Section.Paragraph, for example 180:2.1.`
  } else {
    $('t-ref').textContent = exact.ref
    $('t-where').textContent = `Paper ${exact.paper}, ${exact.paperTitle}. ${exact.section}. Page ${exact.page}.`
    $('t-text').innerHTML = esc(exact.text).replace(/&lt;(\/?)(em|i|b|strong)&gt;/g, '<$1$2>')
  }
  const i = E.order.indexOf(ref)
  $('t-prev').disabled = i <= 0
  $('t-next').disabled = i < 0 || i >= E.order.length - 1
  document.querySelectorAll('[data-open]').forEach((b) => b.setAttribute('aria-current', String(b.dataset.open === ref)))
  if (matchMedia('(max-width: 860px)').matches) $('tablet-close').focus()
}
function closeTablet() {
  current = null
  $('tablet').hidden = true
  $('panel').classList.remove('reading')
  document.querySelectorAll('[data-open]').forEach((b) => b.setAttribute('aria-current', 'false'))
}
$('tablet-close').addEventListener('click', closeTablet)
$('tablet').addEventListener('click', (e) => { if (e.target === $('tablet')) closeTablet() })
addEventListener('keydown', (e) => { if (e.key === 'Escape' && current) closeTablet() })
$('t-prev').addEventListener('click', () => { const i = E.order.indexOf(current); if (i > 0) openRef(E.order[i - 1]) })
$('t-next').addEventListener('click', () => { const i = E.order.indexOf(current); if (i >= 0 && i < E.order.length - 1) openRef(E.order[i + 1]) })
$('t-copy').addEventListener('click', async () => {
  const exact = E.search.getParagraphs([current])[0]
  if (exact.error) return
  const plain = exact.text.replace(/<[^>]+>/g, '')
  const line = `"${plain}" (${exact.ref})`
  try { await navigator.clipboard.writeText(line); $('t-note').textContent = `Copied with its citation, ${exact.ref}.` }
  catch { $('t-note').textContent = 'Copy was blocked by the browser. Select the text and copy it.' }
})
