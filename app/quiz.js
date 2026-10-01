// UB Tools Studio: quiz mode. Flashcards of machine-sliced book quotes —
// name the paper, section and paragraph each quote comes from.
// Import-safe: nothing here touches the DOM at module top level, so the
// pure helpers can be unit-tested under node. No imports: the reveal link
// uses the app's ?ref= deep-link format, which app.js already handles.
'use strict'

const paperOf = (ref) => String(ref).split(':')[0]
// Refs are digits, colons and dots only — safe in a query string unencoded.
const refDeepLink = (ref) => `?ref=${ref}`

export function shuffle(arr, rand = Math.random) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Three wrong citations from other papers, shuffled. The correct ref is
// never in the pool — it is filtered before shuffling, not after.
export function pickDistractors(correctRef, allRefs, rand = Math.random) {
  const pool = allRefs.filter(
    (r) => r !== correctRef && paperOf(r) !== paperOf(correctRef),
  )
  return shuffle(pool, rand).slice(0, 3)
}

// Type-in answers are `paper:section.paragraph`, forgiving about spaces.
export function normalizeAnswer(input) {
  return String(input).trim().replace(/\s+/g, '')
}

export function renderQuizView(container, E, deps) {
  const esc = deps.esc
  const state = {
    questions: [],
    order: [],
    i: 0,
    correct: 0,
    total: 0,
    streak: 0,
    mode: 'choice', // or 'type'
    answered: false,
  }

  const q = () => state.questions[state.order[state.i]]

  function header() {
    const on = (m) => (state.mode === m ? ' aria-pressed="true"' : ' aria-pressed="false"')
    return `<div class="summary"><h2>Quiz yourself</h2>
<p>Read the book's own words, then name where they come from. Score stays in this session only.</p>
<div class="quiz-bar">
<button type="button" class="soft"${on('choice')} data-qmode="choice">Multiple choice</button>
<button type="button" class="soft"${on('type')} data-qmode="type">Type the citation</button>
<button type="button" class="soft" data-q="new">New round</button>
</div>
<p class="why" id="quiz-score">Score ${state.correct} of ${state.total} · streak ${state.streak}</p>
</div><div class="quiz-body"></div>`
  }

  function card() {
    const item = q()
    if (!item) return '<p class="empty">The quiz bank is empty.</p>'
    const n = state.i + 1
    const total = state.order.length
    let input
    if (state.mode === 'choice') {
      const refs = shuffle([item.ref, ...pickDistractors(item.ref, state.questions.map((x) => x.ref))])
      input = `<div class="quiz-choices">${refs
        .map((r) => `<button type="button" class="soft" data-pick="${esc(r)}">${esc(r)}</button>`)
        .join('')}</div>`
    } else {
      input = `<div class="quiz-typein"><label class="sr" for="quiz-answer">Citation, like 180:2.1</label>
<input id="quiz-answer" type="text" inputmode="decimal" placeholder="paper:section.paragraph, like 180:2.1" autocomplete="off">
<button type="button" class="go" data-q="check">Check</button></div>`
    }
    return `<p class="why">Question ${n} of ${total}</p>
<blockquote class="t-text quiz-quote">&ldquo;${esc(item.quote)}&rdquo;</blockquote>
${input}
<div class="quiz-actions">
<button type="button" class="soft" data-q="reveal">Reveal</button>
<button type="button" class="soft" data-q="next" disabled>Next</button>
</div>
<p class="a-note" id="quiz-note" aria-live="polite"></p>`
  }

  function paint() {
    container.innerHTML = `<section class="results quiz" aria-label="Quiz">${header()}${card()}</section>`
    wire()
  }

  function score() {
    const el = container.querySelector('#quiz-score')
    if (el) el.textContent = `Score ${state.correct} of ${state.total} · streak ${state.streak}`
  }

  function note(html) {
    const el = container.querySelector('#quiz-note')
    if (el) el.innerHTML = html
  }

  function lockChoices() {
    state.answered = true
    container.querySelectorAll('[data-pick]').forEach((b) => { b.disabled = true })
    const next = container.querySelector('[data-q="next"]')
    if (next) next.disabled = false
  }

  function grade(gotIt) {
    state.total++
    if (gotIt) {
      state.correct++
      state.streak++
    } else {
      state.streak = 0
    }
    score()
  }

  function showAnswer(extra) {
    const item = q()
    note(
      `${extra ? `${extra} ` : ''}The book says this at <a class="soft" href="${esc(refDeepLink(item.ref))}">${esc(item.ref)}</a>.`,
    )
  }

  function newRound() {
    state.order = shuffle(state.questions.map((_, i) => i))
    state.i = 0
    state.correct = 0
    state.total = 0
    state.streak = 0
    state.answered = false
    paint()
  }

  function next() {
    state.i = (state.i + 1) % state.order.length
    state.answered = false
    paint()
  }

  function wire() {
    container.querySelectorAll('[data-qmode]').forEach((b) =>
      b.addEventListener('click', () => {
        state.mode = b.dataset.qmode
        state.answered = false
        paint()
      }),
    )
    container.querySelector('[data-q="new"]')?.addEventListener('click', newRound)
    container.querySelector('[data-q="next"]')?.addEventListener('click', next)
    container.querySelector('[data-q="reveal"]')?.addEventListener('click', () => {
      if (state.answered) return
      lockChoices()
      grade(false)
      showAnswer('Revealed.')
    })
    container.querySelectorAll('[data-pick]').forEach((b) =>
      b.addEventListener('click', () => {
        if (state.answered) return
        lockChoices()
        const item = q()
        const won = b.dataset.pick === item.ref
        b.classList.add(won ? 'quiz-right' : 'quiz-wrong')
        if (!won) container.querySelector(`[data-pick="${esc(item.ref)}"]`)?.classList.add('quiz-right')
        grade(won)
        showAnswer(won ? 'Right.' : 'Not quite.')
      }),
    )
    const answer = container.querySelector('#quiz-answer')
    const checkBtn = container.querySelector('[data-q="check"]')
    const check = () => {
      if (state.answered || !answer) return
      lockChoices()
      const won = normalizeAnswer(answer.value) === q().ref
      grade(won)
      showAnswer(won ? 'Right.' : `You typed ${esc(answer.value) || 'nothing'}.`)
    }
    checkBtn?.addEventListener('click', check)
    answer?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); check() }
    })
    answer?.focus()
  }

  container.innerHTML = '<section class="results quiz" aria-label="Quiz"><p class="empty">Opening the quiz…</p></section>'
  fetch(new URL('./quiz-bank.json', import.meta.url))
    .then((r) => {
      if (!r.ok) throw new Error(`quiz-bank.json: ${r.status}`)
      return r.json()
    })
    .then((bank) => {
      state.questions = Array.isArray(bank.questions) ? bank.questions : []
      if (!state.questions.length) {
        container.innerHTML = '<section class="results quiz" aria-label="Quiz"><p class="empty">The quiz bank is empty.</p></section>'
        return
      }
      newRound()
    })
    .catch((err) => {
      container.innerHTML = `<section class="results quiz" aria-label="Quiz"><p class="empty">The quiz questions did not load (${esc(err.message)}). If you run the tools from a copy of the repository, run <code>node app/build-quiz-bank.mjs</code> there first.</p></section>`
    })
}
