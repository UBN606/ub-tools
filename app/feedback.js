// Missed-question feedback for UB Tools Studio.
//
// When the book can't answer a question, the Studio POSTs the question to
// Derek's logger endpoint (a tiny Google Apps Script web app — see
// server/feedback-logger/). The user is told their question was saved; the
// email button stays for anyone who wants to add detail.
//
// Pure functions are unit-tested in test/feedback.test.mjs. The fetch is
// injectable so tests never touch the network.

// Which answers are worth an email. The logger sends one email per question (and Gmail
// caps a free account at about 100 a day), so only real gaps are sent: no passage found,
// or a word of the question the book never uses ("narcissism"), where the passages shown
// are only the closest the book comes. Answered questions are not sent.
export function shouldLogMiss(r) {
  if (!r || !(r.refs || []).length) return true
  return (r.quiet || []).some((x) => x.total === 0)
}

export function missedPayload(q) {
  return {
    question: String(q).slice(0, 500),
    page: typeof location !== 'undefined' ? location.href : '',
    at: new Date().toISOString(),
  }
}

// Fire-and-forget: resolves true when the POST was attempted, false when
// there is no endpoint or the network failed. Never throws.
export function sendMissed(endpoint, q, fetchFn) {
  if (!endpoint) return Promise.resolve(false)
  const run = fetchFn || (typeof fetch !== 'undefined' ? fetch : null)
  if (!run) return Promise.resolve(false)
  try {
    return run(endpoint, {
      method: 'POST',
      mode: 'no-cors', // Apps Script web apps don't do CORS preflights
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(missedPayload(q)),
    }).then(() => true, () => false)
  } catch {
    return Promise.resolve(false)
  }
}
