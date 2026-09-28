// Copy, share, print and quote pictures for answers. Everything happens on the reader's own
// device: no server, no account, no cost. The book's words are always carried with their citation.

export const citeLine = (p) => `"${p.text}" (The Urantia Book, ${p.ref})`
export const answerLink = (question) => `${location.origin}${location.pathname}?q=${encodeURIComponent(question)}`

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true } catch {
    const t = document.createElement('textarea')
    t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0'
    document.body.appendChild(t); t.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch {}
    t.remove(); return ok
  }
}

// Phones: the phone's own share sheet (Facebook, Messages, email, WhatsApp...). Computers: a menu.
export async function shareQuote(p, question, showMenu) {
  const text = `${citeLine(p)}\n\nAsk the book yourself: ${answerLink(question)}`
  if (navigator.share) {
    try { await navigator.share({ title: `The Urantia Book, ${p.ref}`, text }); return 'shared' } catch (e) { if (e?.name === 'AbortError') return 'cancelled' }
  }
  showMenu({
    copy: () => copyText(text),
    email: `mailto:?subject=${encodeURIComponent(`The Urantia Book, ${p.ref}`)}&body=${encodeURIComponent(text)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(answerLink(question))}`,
    text,
  })
  return 'menu'
}

// ---------- quote picture (1080 x 1080, for Instagram and anywhere pictures go) ----------
function wrap(ctx, text, width) {
  const words = text.split(/\s+/), lines = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > width && line) { lines.push(line); line = w } else line = test
  }
  if (line) lines.push(line)
  return lines
}
export async function quotePicture(p) {
  try { await Promise.all([document.fonts.load('400 40px Newsreader'), document.fonts.load('600 24px "Hanken Grotesk"')]) } catch {}
  const S = 1080, c = document.createElement('canvas'); c.width = c.height = S
  const g = c.getContext('2d')
  // limestone ground and a raised chalk slab, as in the app
  const bg = g.createLinearGradient(0, 0, S, S); bg.addColorStop(0, '#EEECE8'); bg.addColorStop(1, '#DCD8D2')
  g.fillStyle = bg; g.fillRect(0, 0, S, S)
  const pad = 70, r = 56
  g.save(); g.shadowColor = 'rgba(140,130,118,.45)'; g.shadowBlur = 60; g.shadowOffsetX = 18; g.shadowOffsetY = 22
  g.beginPath(); g.roundRect(pad, pad, S - 2 * pad, S - 2 * pad, r); g.fillStyle = '#F4F3F0'; g.fill(); g.restore()
  // the quote, as large as fits
  const inner = S - 2 * pad - 120, top = pad + 110, bottomRoom = 230
  let size = 58, lines
  for (; size >= 22; size -= 2) {
    g.font = `400 ${size}px Newsreader, Georgia, serif`
    lines = wrap(g, `“${p.text}”`, inner)
    if (lines.length * size * 1.42 <= S - top - bottomRoom) break
  }
  g.fillStyle = '#2B2E33'; g.textBaseline = 'top'
  lines.forEach((l, i) => g.fillText(l, pad + 60, top + i * size * 1.42))
  // citation and brand
  g.fillStyle = '#46618A'; g.font = '500 44px Newsreader, Georgia, serif'
  g.fillText(`The Urantia Book, ${p.ref}`, pad + 60, S - pad - 170)
  g.fillStyle = '#6A6D72'; g.font = '600 24px "Hanken Grotesk", Arial, sans-serif'
  g.fillText('URANTIA BOOK NETWORK', pad + 60, S - pad - 100)
  g.font = '400 24px "Hanken Grotesk", Arial, sans-serif'
  g.fillText('urantiabooknetwork.com', pad + 60, S - pad - 68)
  const blob = await new Promise((res) => c.toBlob(res, 'image/png'))
  const name = `urantia-book-${p.ref.replace(/[:.]/g, '-')}.png`
  const file = new File([blob], name, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: `The Urantia Book, ${p.ref}` }); return 'shared' } catch (e) { if (e?.name === 'AbortError') return 'cancelled' }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  return 'saved'
}
