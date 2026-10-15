// spell.js: "Did you mean...?" for Ask. Readers type fast, misspell the book's own
// terms, and dictate by voice: the missed-question log has "ascencion", "spirituel",
// "reincarnate", and "rancher" / "wrenches" for Urantia. When a word of the question
// never occurs in the book, this finds the book word it most likely means, so Ask can
// search for that and say so ("Showing results for ascension"). Only words the book
// itself uses are ever suggested. Pure logic, so it can be tested.

const WORD = /[a-z]+(?:'[a-z]+)*/g

// Mishearings no edit distance would catch, seen in the log. Voice typing turns
// "Urantia" into ordinary English words.
export const ALIASES = { rancher: 'urantia', wrenches: 'urantia', ranches: 'urantia' }

// Every word the book uses, with how often: Map(word -> count).
export function buildVocab(texts) {
  const vocab = new Map()
  for (const t of texts) {
    for (const w of String(t).toLowerCase().replace(/[’‘]/g, "'").match(WORD) || []) {
      const k = w.replace(/'s$/, '')
      vocab.set(k, (vocab.get(k) || 0) + 1)
    }
  }
  return vocab
}

// Optimal string alignment distance (Levenshtein plus adjacent swaps), stopping
// early once it can't come in under `max`.
export function editDistance(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev2 = null
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1)
      cur.push(v)
      if (v < rowMin) rowMin = v
    }
    if (rowMin > max) return max + 1
    prev2 = prev
    prev = cur
  }
  return prev[b.length]
}

// The book word a reader most likely meant, or null. Short words are left alone:
// under six letters almost anything is one typo away from the wrong word
// ("spoor" is not "poor").
export function suggest(word, vocab) {
  const w = String(word || '').toLowerCase()
  if (!w || vocab.has(w)) return null
  if (ALIASES[w]) return ALIASES[w]
  if (w.length < 6) return null
  const max = w.length >= 8 ? 2 : 1
  let best = null
  for (const [v, count] of vocab) {
    if (count < 2) continue
    // The same word in the form the book uses ("reincarnate" -> "reincarnation") beats
    // any spelling edit, which could land on a different word ("incarnate").
    let d = w.length >= 9 && v.length > w.length && v.startsWith(w.slice(0, -1)) ? 0 : editDistance(w, v, max)
    if (d > max) continue
    if (!best || d < best.d || (d === best.d && count > best.count)) best = { v, d, count }
  }
  return best ? best.v : null
}

// Replace each of `unknown` (words of the question the book never uses) with its
// suggestion, keeping the rest of the question as typed.
export function correctQuestion(question, unknown, vocab) {
  const fixes = []
  let out = String(question)
  for (const u of unknown) {
    const to = suggest(u, vocab)
    if (!to) continue
    const re = new RegExp(`\\b${u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
    if (!re.test(out)) continue
    out = out.replace(re, to)
    fixes.push({ from: u, to })
  }
  return { question: out, fixes }
}
