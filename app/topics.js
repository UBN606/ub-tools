// The book's topical index (Urantiapedia's conversion of the Uversa Press index, CC BY-SA 4.0),
// loaded quietly after the book. Only the entry names and their paragraph references are used,
// so what readers see is still the book's own words: the index points, the book speaks.
const LOCAL = '../source-texts/topic-index/'
const REMOTE = 'https://raw.githubusercontent.com/JanHerca/urantiapedia/master/input/txt/topic-index-en/'
const HEADER = /^([^|\t<][^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([A-Z]*)\s*\|\s*\w*\s*$/
let topics = null
let loading = null

async function text(url) {
  let cache = null
  try { cache = await caches.open('ub-tools-index-v1') } catch {}
  if (cache) { const hit = await cache.match(url); if (hit) return hit.text() }
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status}`)
  const t = await r.clone().text()
  if (cache) { try { await cache.put(url, r) } catch {} }
  return t
}

function refsOf(s) {
  const out = []
  for (const m of s.matchAll(/\((\d{1,3}):(\d{1,2})\.(\d{1,3})(?:-(\d{1,3}))?\)/g)) {
    const lo = Number(m[3]), hi = m[4] ? Math.min(Number(m[4]), lo + 20) : lo
    for (let i = lo; i <= hi; i++) out.push(`${m[1]}:${m[2]}.${i}`)
  }
  return out
}

export function loadTopics() {
  if (loading) return loading
  loading = (async () => {
    let base = LOCAL
    try { const t = await fetch(LOCAL + 'a.txt', { method: 'HEAD' }); if (!t.ok) throw 0 } catch { base = REMOTE }
    const list = []
    await Promise.all('abcdefghijklmnopqrstuvwxyz'.split('').map(async (c) => {
      let body = ''
      try { body = await text(base + c + '.txt') } catch { return }
      let cur = null
      for (const line of body.split(/\r?\n/)) {
        const m = line.match(HEADER)
        if (m) { cur = { name: m[1].trim(), label: m[1].split(';')[0].trim(), category: m[4], refs: [] }; list.push(cur); continue }
        if (!line.trim()) { cur = null; continue }
        if (cur) cur.refs.push(...refsOf(line))
      }
    }))
    for (const t of list) t.refs = [...new Set(t.refs)]
    topics = list.filter((t) => t.refs.length)
    return topics
  })()
  return loading
}

// Index entries whose name matches the question's words or the book terms they map to.
export function findTopics(words, mapped, max = 2) {
  if (!topics) return []
  const wanted = [...mapped, ...words].map((w) => w.toLowerCase())
  // An entry lists its names together: "Thought Adjusters; Adjuster; Adjusters".
  const names = (n) => n.split(';').map((x) => x.trim().toLowerCase().replace(/,.*$/, '').replace(/s$/, ''))
  const hits = []
  for (const w of wanted) {
    const ws = w.replace(/s$/, '')
    const t = topics.find((x) => names(x.name).includes(ws))
    if (t && !hits.includes(t)) hits.push(t)
    if (hits.length >= max) break
  }
  return hits
}
