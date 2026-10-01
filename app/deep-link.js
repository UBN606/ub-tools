// Shareable citation links for UB Tools Studio (?ref=).
//
// Refs only: this module never carries book text, only paragraph references
// in the form Paper:Section.Paragraph (for example 180:2.1). It has no
// dependencies and touches no DOM; the app wires it up in app.js.
//
// Supported ?ref= forms:
//   180:2.1            a single paragraph
//   180:2.1-3          a same-section range, short form
//   180:2.1-180:2.3    a same-section range, full form
//   180:2.1,196:1.3    a comma (or semicolon) list, ranges allowed inside

const REF_SHAPE = /^\d{1,3}:\d{1,2}\.\d{1,3}$/
const SEG_SINGLE = /^\s*(\d{1,3}:\d{1,2}\.\d{1,3})\s*$/
const SEG_RANGE_FULL = /^\s*(\d{1,3}:\d{1,2}\.\d{1,3})\s*-\s*(\d{1,3}:\d{1,2}\.\d{1,3})\s*$/
const SEG_RANGE_SHORT = /^\s*(\d{1,3}):(\d{1,2})\.(\d{1,3})\s*-\s*(\d{1,3})\s*$/

const norm = (s) => (typeof s === 'string' ? s.trim() : '')

// Tolerate being handed a full URL, a bare query string, or location.search.
function queryString(search) {
  const s = norm(search)
  if (!s) return ''
  const noHash = s.split('#')[0]
  const q = noHash.indexOf('?')
  return q >= 0 ? noHash.slice(q + 1) : noHash
}

function parseSegment(seg) {
  let m = SEG_RANGE_FULL.exec(seg)
  if (m) return { kind: 'range', start: m[1], end: m[2] }
  m = SEG_RANGE_SHORT.exec(seg)
  if (m) return { kind: 'range', start: `${m[1]}:${m[2]}.${m[3]}`, end: `${m[1]}:${m[2]}.${m[4]}` }
  m = SEG_SINGLE.exec(seg)
  if (m) return { kind: 'ref', ref: m[1] }
  return null
}

function fail(error) { return { refs: [], ranges: [], error } }

// Parse ?ref= from a query string. Returns { refs, ranges, error }:
//   refs   single references, in link order, duplicates removed
//   ranges { start, end } pairs to expand with expandRange()
//   error  a plain-language message, or null when the value is usable
//          (including when there is no ?ref= at all: then refs and ranges
//          are empty and error is null).
// Malformed input yields an error, never a throw and never partial output.
export function parseRefParam(search) {
  try {
    const params = new URLSearchParams(queryString(search))
    const raw = params.get('ref')
    if (raw == null) return { refs: [], ranges: [], error: null }
    const value = norm(raw)
    if (!value) return fail('This link names no paragraph: the part after ?ref= is empty.')
    const refs = []
    const ranges = []
    for (const part of value.split(/[,;]/)) {
      const seg = norm(part)
      if (!seg) return fail('This link names no paragraph: there is an empty entry after ?ref=.')
      const parsed = parseSegment(seg)
      if (!parsed) return fail(`This link could not be read: "${seg}" is not a paragraph reference. References look like 180:2.1.`)
      if (parsed.kind === 'ref') { if (!refs.includes(parsed.ref)) refs.push(parsed.ref) }
      else ranges.push({ start: parsed.start, end: parsed.end })
    }
    return { refs, ranges, error: null }
  } catch {
    return fail('This link could not be read.')
  }
}

// Every ref between two endpoints, using the engine's book-order array (safer
// than assuming paragraph numbers are consecutive). [] when either endpoint
// is missing from order, when end comes before start, or on bad input.
export function expandRange(startRef, endRef, order) {
  try {
    const a = norm(startRef), b = norm(endRef)
    if (!REF_SHAPE.test(a) || !REF_SHAPE.test(b)) return []
    if (!Array.isArray(order) || !order.length) return []
    const i = order.indexOf(a), j = order.indexOf(b)
    if (i < 0 || j < 0 || j < i) return []
    return order.slice(i, j + 1)
  } catch { return [] }
}

// Is this ref in the loaded book? byRef is the engine's Map (a plain object
// or array of refs also works). Never throws.
export function isValidRef(ref, byRef) {
  try {
    const r = norm(ref)
    if (!REF_SHAPE.test(r) || byRef == null) return false
    if (typeof byRef.has === 'function') return !!byRef.has(r)
    if (Array.isArray(byRef)) return byRef.includes(r)
    if (typeof byRef === 'object') return Object.prototype.hasOwnProperty.call(byRef, r)
    return false
  } catch { return false }
}

// Absolute link to a paragraph (or range: pass the original param form,
// for example '180:2.1-180:2.3'). The optional second argument lets tests
// stub the base; in the app it comes from location. Never throws.
export function refLink(ref, origin) {
  const raw = norm(ref)
  let base = typeof origin === 'string' ? origin : ''
  if (!base && typeof location !== 'undefined' && location) {
    try { base = `${location.origin}${location.pathname}` } catch { base = '' }
  }
  return `${base}?ref=${raw}`
}
