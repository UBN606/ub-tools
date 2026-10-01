// UB Tools Studio: the interface. The engine (engine.js) runs the repository's own tools.
import { loadEngine } from './engine.js'
import { citeLine, copyText, shareQuote, quotePicture, shareRowHTML, shareTo } from './share.js'
import { parseRefParam, expandRange, isValidRef, refLink } from './deep-link.js'
import { renderReadAlong } from './readalong.js'
import { loadTopics, findTopics } from './topics.js'
import { THEME_KEY, SIZE_KEY, SIZE_DEFAULT, resolveTheme, oppositeTheme, parseStoredTheme, parseStoredSize, stepSize, applyTheme, applySize, migrateLegacyBig, themeToggleState } from './a11y.js'
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

// Where "Didn't find it?" sends the question. Derek sets this address.
const FEEDBACK_EMAIL = 'discosteed8@gmail.com'
// "Go deeper" links to Urantia Book Network articles: at most one quiet line, only when an article
// cites a paragraph of the answer. OFF until the corrected site is deployed (Derek, 2026-09-28):
// the live site still carries errors fixed on the w1-receipts branch.
const UBN_LINKS_LIVE = false
let UBN = null
fetch(new URL('./ubn-articles.json', import.meta.url)).then((r) => r.json()).then((j) => { UBN = j }).catch(() => {})
function goDeeper(refs) {
  if (!UBN_LINKS_LIVE || !UBN) return ''
  let best = null, n = 0
  for (const a of UBN.articles) {
    const hit = refs.filter((r) => a.refs.includes(r)).length
    if (hit > n) { best = a; n = hit }
  }
  if (!best) return ''
  const cited = refs.filter((r) => best.refs.includes(r))
  return `<p class="deeper">Go deeper: the Urantia Book Network article <a href="${UBN.site}${encodeURIComponent(best.slug)}" target="_blank" rel="noopener">${esc(best.title)}</a> discusses ${cited.slice(0, 3).map(esc).join(', ')}.</p>`
}
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
  loadTopics().catch(() => {})
  renderReadAlong($('listen-slab'), E, { esc, store, startReading, setView })
  $('groove').classList.add('done')
  for (const el of [$('q'), $('draft'), $('go')]) el.disabled = false
  $('q').focus()
  const u = new URL(location.href)
  if (u.searchParams.get('q')) { $('q').value = u.searchParams.get('q'); setMode(u.searchParams.get('mode') || 'ask'); submit() }
  else handleRefLink()
}).catch((err) => {
  status.textContent = 'The book could not be loaded'
  $('hint').innerHTML = `The book text did not load (${esc(err.message)}). Check your connection and reload. If you run the tools from a copy of the repository, run <code>node fetch-data.js</code> there first.`
})

// ---------- shareable citation links (?ref=) ----------
function handleRefLink() {
  const box = $('results')
  const fail = (msg) => {
    box.innerHTML = `<div class="summary"><h2>Shared passage</h2><p>${esc(msg)}</p></div><p class="empty">The link you opened names a paragraph the Studio cannot show. Check the link, or look the passage up by its number, like 180:2.1.</p>`
  }
  const { refs, ranges, error } = parseRefParam(location.search)
  if (error) { fail(error); return }
  if (!refs.length && !ranges.length) return // no ?ref=: nothing to do
  const bad = [], ok = []
  for (const r of refs) (isValidRef(r, E.byRef) ? ok : bad).push(r)
  const grown = []
  for (const { start, end } of ranges) {
    const ex = isValidRef(start, E.byRef) && isValidRef(end, E.byRef) ? expandRange(start, end, E.order) : []
    if (ex.length) grown.push(...ex)
    else bad.push(`${start}-${end}`)
  }
  if (bad.length) { fail(`"${esc(bad[0])}" is not in this edition of the book.`); return }
  const all = [...new Set([...ok, ...grown])]
  if (!all.length) { fail('This link names no paragraph.'); return }
  renderList(all.map((ref) => ({ ref })), {
    title: all.length === 1 ? `Paragraph ${all[0]}` : `${all.length} paragraphs`,
    sub: 'Opened from a shared link.',
  })
  openRef(all[0])
}

// ---------- top-level views: Read, Listen, Plans, Quiz, Explore, Tools ----------
import { renderExploreView } from './explore.js'
import { renderPlansView } from './plans.js'
import { renderQuizView } from './quiz.js'
import { renderToolsView } from './tools.js'
const VIEWS = ['read', 'listen', 'plans', 'quiz', 'explore', 'tools']
const viewInited = {}
function placeTopThumb() {
  const on = document.querySelector('.topnav [aria-current="true"]')
  const thumb = document.querySelector('.topnav-thumb')
  if (!on || !thumb) return
  thumb.style.width = `${on.offsetWidth}px`
  thumb.style.transform = `translateX(${on.offsetLeft - 5}px)`
}
function initView(v) {
  if (v === 'explore') renderExploreView($('explore-slab'), { esc, openRef, copyText, setView })
  if (v === 'tools') renderToolsView($('tools-slab'), { esc, setView, openRef })
  if (v === 'plans') renderPlansView($('plans-slab'), E, { esc, store, openRef: (ref) => { setView('read'); openRef(ref) } })
  if (v === 'quiz') {
    renderQuizView($('quiz-slab'), E, { esc, store })
    // Reveal links use the ?ref= format: open them in the Read view without losing quiz state.
    $('quiz-slab').addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="?ref="]')
      if (!a) return
      e.preventDefault()
      const ref = decodeURIComponent(a.getAttribute('href').slice(5))
      setView('read'); openRef(ref)
    })
  }
}
function setView(v) {
  if (!VIEWS.includes(v)) v = 'read'
  stopReading()
  for (const x of VIEWS) {
    $(`view-${x}`).hidden = x !== v
    const b = document.querySelector(`.topnav [data-view="${x}"]`)
    if (b) b.setAttribute('aria-current', String(x === v))
  }
  placeTopThumb()
  if (v === 'read') { placeThumb(); closeTablet() }
  if (E && !viewInited[v]) { viewInited[v] = true; initView(v) }
}
document.querySelectorAll('.topnav [data-view]').forEach((b) =>
  b.addEventListener('click', () => setView(b.dataset.view)))
addEventListener('resize', placeTopThumb)
document.fonts?.ready.then(placeTopThumb)

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
// --- display accessibility: theme + text size (see a11y.js) ---
const mqDark = matchMedia('(prefers-color-scheme: dark)')
let theme = resolveTheme(store.get(THEME_KEY, null), mqDark.matches)
let size = parseStoredSize(store.get(SIZE_KEY, null))
if (size == null) size = migrateLegacyBig(store.get('big', true)) // old single toggle
const themeBtn = $('theme-toggle')
const sizeDec = $('size-dec'), sizeReset = $('size-reset'), sizeInc = $('size-inc')
const applyDisplay = () => {
  applyTheme(document, theme); applySize(document, size)
  const st = themeToggleState(theme)
  themeBtn.setAttribute('aria-pressed', String(st.pressed))
  themeBtn.setAttribute('aria-label', st.label)
  themeBtn.textContent = st.shortLabel
  sizeDec.disabled = size <= 0
  sizeInc.disabled = size >= 3
  sizeReset.setAttribute('aria-pressed', String(size === SIZE_DEFAULT))
  placeThumb()
}
themeBtn.addEventListener('click', () => { theme = oppositeTheme(theme); store.set(THEME_KEY, theme); applyDisplay() })
sizeDec.addEventListener('click', () => { size = stepSize(size, -1); store.set(SIZE_KEY, size); applyDisplay() })
sizeInc.addEventListener('click', () => { size = stepSize(size, 1); store.set(SIZE_KEY, size); applyDisplay() })
sizeReset.addEventListener('click', () => { size = SIZE_DEFAULT; store.set(SIZE_KEY, size); applyDisplay() })
// follow the device until the user picks a theme explicitly
mqDark.addEventListener?.('change', (e) => {
  if (parseStoredTheme(store.get(THEME_KEY, null)) == null) { theme = e.matches ? 'dark' : 'light'; applyDisplay() }
})
applyDisplay()
setMode('ask')
tabs.forEach((t) => { t.tabIndex = t.getAttribute('aria-selected') === 'true' ? 0 : -1 })
addEventListener('resize', placeThumb)
document.fonts?.ready.then(placeThumb)
placeThumb()
placeTopThumb()

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
function runAsk(q, max = 5) {
  stopReading()
  const r = answer(E, q, { max })
  const box = $('results')
  const plain = (t) => t.replace(/<[^>]+>/g, '')
  const missed = `<div class="missed"><p>Didn't find what you were looking for?</p><button type="button" class="soft" id="missed">${FEEDBACK_EMAIL ? 'Tell us your question' : 'Copy your question to send us'}</button></div>`
  if (!r.refs.length) { box.innerHTML = `<p class="empty">The book does not speak to that in these words. Try asking with other words.</p>${missed}`; wireMissed(q); return }
  const pars = E.search.getParagraphs(r.refs).filter((p) => !p.error)
  const silence = r.quiet.length ? `<div class="silence"><strong>The book says little about this directly.</strong> ${r.quiet.map((x) => x.total === 0 ? `It never uses the word "${esc(x.word)}".` : `It uses the word "${esc(x.word)}" only ${x.total === 1 ? 'once' : `${x.total} times`}: ${x.refs.map((ref) => `<button type="button" class="linkish" data-open="${esc(ref)}">${esc(ref)}</button>`).join(', ')}.`).join(' ')} Below are the passages closest to your question. They may not answer it.</div>` : ''
  const topicsFound = findTopics(r.words, r.mapped)
  const index = topicsFound.length ? `<div class="index-hint">${topicsFound.map((t, k) => `<button type="button" class="soft" data-topic="${k}">The book's index: ${esc(t.label)} (${t.refs.length} passages)</button>`).join('')}</div>` : ''
  box.innerHTML = `<div class="answer-head"><h2>What the book says</h2><div class="head-actions">${speech.ok ? '<button type="button" class="soft strong" id="read-all">Listen to the answer</button>' : ''}<button type="button" class="soft" id="print">Print the answer</button><button type="button" class="soft" id="copy-all">Copy the answer</button></div></div>
<p class="print-question">Question: ${esc(q)}</p>${silence}${index}
<ol class="answer">${pars.map((p, i) => `<li><p class="a-ref">${esc(p.ref)}</p><p class="a-where">${esc(p.paperTitle)}. ${esc(p.section)}.</p><p class="a-text">${esc(plain(p.text))}</p><p class="a-why">Found because it speaks of: ${[...(r.why.get(p.ref) || [])].map(esc).join(', ')}</p><div class="a-actions">${speech.ok ? `<button type="button" class="soft" data-say="${i}">Listen</button>` : ''}<button type="button" class="soft" data-open="${esc(p.ref)}">See it in the book</button><button type="button" class="soft" data-study="${i}">Add to study list</button><button type="button" class="soft" data-link="${esc(refLink(p.ref))}">Copy link</button></div>${shareRowHTML()}<p class="a-note" aria-live="polite"></p></li>`).join('')}</ol>
${r.more.length ? `<button type="button" class="soft more" id="more">Show more passages</button>` : ''}
${goDeeper(pars.map((p) => p.ref))}
${missed}
<p class="print-foot">From The Urantia Book, as found by UB Tools Studio: https://ubn606.github.io/ub-tools/app/ . URANTIA BOOK NETWORK, urantiabooknetwork.com</p>`
  $('more')?.addEventListener('click', () => { runAsk(q, max + 10); $('results').querySelectorAll('.answer li')[max]?.scrollIntoView({ block: 'start' }) })
  box.querySelectorAll('[data-topic]').forEach((b) => b.addEventListener('click', () => { const t = topicsFound[Number(b.dataset.topic)]; renderList(t.refs.map((ref) => ({ ref })), { title: `The book's index: ${esc(t.label)}`, sub: `${t.refs.length} passages the index lists. Tap one to read it.` }) }))
  wireMissed(q)
  const cards = [...box.querySelectorAll('.answer li')]
  const items = pars.map((p, i) => ({ ref: p.ref, el: cards[i], text: `${plain(p.text)} Paper ${p.ref.replace(':', ', section ').replace('.', ', paragraph ')}.` }))
  box.querySelectorAll('[data-say]').forEach((b) => b.addEventListener('click', () => { const i = Number(b.dataset.say); startReading([items[i]]) }))
  box.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => openRef(b.dataset.open)))
  $('read-all')?.addEventListener('click', () => startReading(items))
  const quotes = pars.map((p) => ({ ref: p.ref, text: plain(p.text) }))
  const note = (i, msg) => { const n = cards[i].querySelector('.a-note'); n.textContent = msg; setTimeout(() => { if (n.textContent === msg) n.textContent = '' }, 4000) }
  cards.forEach((card, i) => card.querySelectorAll('.share-btn').forEach((btn) => btn.addEventListener('click', () =>
    shareTo(btn.dataset.to, quotes[i], q, (msg) => note(i, msg), () => printOnly(card)))))
  box.querySelectorAll('[data-study]').forEach((b) => b.addEventListener('click', () => { const i = Number(b.dataset.study); study.add(quotes[i]); note(i, 'Added to your study list.') }))
  box.querySelectorAll('[data-link]').forEach((b) => b.addEventListener('click', async (e) => {
    const btn = e.currentTarget
    btn.textContent = (await copyText(btn.dataset.link)) ? 'Link copied' : 'Copy blocked'
    setTimeout(() => { btn.textContent = 'Copy link' }, 2500)
  }))
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

function printOnly(el) {
  stopReading()
  el.classList.add('print-this'); document.body.classList.add('print-this-only')
  print()
  el.classList.remove('print-this'); document.body.classList.remove('print-this-only')
}

// ---------- highlight to share: select words in the book and a bar pops up ----------
const selBar = document.createElement('div')
selBar.className = 'sel-bar'; selBar.hidden = true
selBar.innerHTML = `<button type="button" data-to="copy">Copy</button><button type="button" data-to="facebook">Facebook</button><button type="button" data-to="email">Email</button>${matchMedia('(pointer: coarse)').matches ? '<button type="button" data-to="text">Text</button>' : ''}<span class="sel-note" aria-live="polite"></span>`
document.body.appendChild(selBar)
let selQuote = null
function checkSelection() {
  const sel = getSelection()
  const text = sel && !sel.isCollapsed ? sel.toString().replace(/\s+/g, ' ').trim() : ''
  const node = sel?.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement)
  const holder = node?.closest?.('.a-text, #t-text, .row .txt')
  if (!text || text.split(' ').length < 3 || !holder) { selBar.hidden = true; selQuote = null; return }
  const ref = holder.id === 't-text' ? $('t-ref').textContent.trim() : holder.closest('li')?.querySelector('.a-ref, .ref')?.textContent?.trim()
  if (!ref) { selBar.hidden = true; return }
  selQuote = { ref, text }
  const r = sel.getRangeAt(0).getBoundingClientRect()
  selBar.hidden = false; selBar.querySelector('.sel-note').textContent = ''
  const top = r.top + scrollY - selBar.offsetHeight - 12
  selBar.style.top = `${top < scrollY + 8 ? r.bottom + scrollY + 12 : top}px`
  selBar.style.left = `${Math.max(8, Math.min(innerWidth - selBar.offsetWidth - 8, r.left + r.width / 2 - selBar.offsetWidth / 2))}px`
}
let selTimer = null
document.addEventListener('selectionchange', () => { clearTimeout(selTimer); selTimer = setTimeout(checkSelection, 250) })
selBar.addEventListener('mousedown', (e) => e.preventDefault())
selBar.querySelectorAll('[data-to]').forEach((b) => b.addEventListener('click', () => {
  if (selQuote) shareTo(b.dataset.to, selQuote, $('q').value.trim() || selQuote.ref, (msg) => { selBar.querySelector('.sel-note').textContent = msg })
}))

// ---------- How to use ----------
function openHelp() { const d = $('help'); d.showModal(); d.scrollTop = 0; $('help-title').focus() }
$('help-open').addEventListener('click', () => { stopReading(); openHelp() })
$('help-close').addEventListener('click', () => { speech.stop(); $('help').close() })
$('help').addEventListener('close', () => speech.stop())
$('help-listen').addEventListener('click', () => speech.say([...document.querySelectorAll('.help-steps li')].map((li) => li.textContent).join(' ')))
try { if (!localStorage.getItem('seen-help')) { localStorage.setItem('seen-help', '1'); addEventListener('load', () => openHelp()) } } catch {}

// ---------- didn't find it ----------
function wireMissed(q) {
  $('missed')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget
    const body = `My question: ${q}\n\nWhat I hoped to find:\n`
    if (FEEDBACK_EMAIL) { location.href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('UB Tools Studio: a question it did not answer')}&body=${encodeURIComponent(body)}`; return }
    btn.textContent = (await copyText(`UB Tools Studio did not find: ${q}`)) ? 'Copied. Paste it in an email to the Urantia Book Network.' : 'Copy was blocked.'
  })
}

// ---------- study list: collect passages, print or share them together ----------
const study = {
  items: (() => { try { return JSON.parse(localStorage.getItem('study') || '[]') } catch { return [] } })(),
  save() { try { localStorage.setItem('study', JSON.stringify(this.items)) } catch {} ; $('study-count').textContent = this.items.length },
  add(p) { if (!this.items.some((x) => x.ref === p.ref)) this.items.push({ ref: p.ref, text: p.text }); this.save() },
  remove(ref) { this.items = this.items.filter((x) => x.ref !== ref); this.save(); renderStudy() },
}
study.save()
function renderStudy() {
  $('study-empty').hidden = study.items.length > 0
  $('study-items').innerHTML = study.items.map((x) => `<li><p class="a-ref">${esc(x.ref)}</p><p class="a-text">${esc(x.text)}</p><button type="button" class="soft" data-remove="${esc(x.ref)}">Remove</button></li>`).join('')
  $('study-items').querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => study.remove(b.dataset.remove)))
}
const studyText = () => study.items.map(citeLine).join('\n\n')
$('study-open').addEventListener('click', () => { stopReading(); renderStudy(); const d = $('study'); d.showModal(); d.scrollTop = 0; $('study-title').focus() })
$('study-close').addEventListener('click', () => $('study').close())
$('study-copy').addEventListener('click', async () => { $('study-note').textContent = (await copyText(studyText())) ? 'Copied, with every citation.' : 'Copy was blocked.' })
$('study-email').addEventListener('click', () => { location.href = `mailto:?subject=${encodeURIComponent('Passages from The Urantia Book')}&body=${encodeURIComponent(studyText())}` })
$('study-clear').addEventListener('click', () => { if (confirm('Remove every passage from your study list?')) { study.items = []; study.save(); renderStudy() } })
$('study-print').addEventListener('click', () => { document.body.classList.add('print-study'); print(); document.body.classList.remove('print-study') })

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
    return `<li class="row"><button type="button" data-open="${esc(i.ref)}"><span class="ref">${esc(i.ref)}</span><span><span class="where">${where}</span><span class="txt">${highlight(text, i.res)}</span></span></button><button type="button" class="soft copy-link" data-link="${esc(refLink(i.ref))}" aria-label="Copy link to ${esc(i.ref)}">Copy link</button>${tick}</li>`
  }).join('')}</ul>`
  box.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => openRef(b.dataset.open)))
  box.querySelectorAll('.copy-link').forEach((b) => b.addEventListener('click', async (e) => {
    const btn = e.currentTarget
    btn.textContent = (await copyText(btn.dataset.link)) ? 'Link copied' : 'Copy blocked'
    setTimeout(() => { btn.textContent = 'Copy link' }, 2500)
  }))
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
  store.set('last-read-ref', ref)
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
const currentQuote = () => { const x = E.search.getParagraphs([current])[0]; return x.error ? null : { ref: x.ref, text: x.text.replace(/<[^>]+>/g, '') } }
const tNote = (msg) => { $('t-note').textContent = msg }
$('t-share').innerHTML = shareRowHTML() + '<button type="button" class="soft study-add" id="t-copylink">Copy link to this paragraph</button><button type="button" class="soft study-add" id="t-study">Add to study list</button><button type="button" class="soft study-add" id="t-parallel">Compare with the Bible</button>'
$('t-parallel').addEventListener('click', () => {
  if (!current) return
  window.open(`../parallel/app/index.html?ref=${encodeURIComponent(current)}`, '_blank', 'noopener')
})
$('t-copylink').addEventListener('click', async () => {
  tNote(current && (await copyText(refLink(current))) ? 'Link copied. Paste it anywhere to share this paragraph.' : 'Copy was blocked.')
})
$('t-study').addEventListener('click', () => { const p = currentQuote(); if (p) { study.add(p); tNote('Added to your study list.') } })
$('t-share').querySelectorAll('.share-btn').forEach((btn) => btn.addEventListener('click', () => {
  const p = currentQuote(); if (!p) return
  shareTo(btn.dataset.to, p, $('q').value.trim() || p.ref, tNote, () => { stopReading(); document.body.classList.add('print-one'); print(); document.body.classList.remove('print-one') })
}))
addEventListener('afterprint', () => document.body.classList.remove('print-one'))

// PWA: installable + offline shell. Only on http(s); file:// has no SW.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}
