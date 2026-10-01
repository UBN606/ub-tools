// ask-format.js — how an Ask answer is presented, in all four Ask languages.
import { LANGS } from './ask-i18n.js'
//
// Ask never generates text, so a forward-ready answer is achieved through
// presentation alone: the single clearest passage is shown prominently as the
// answer, the rest as supporting quotes, and every quote carries its exact
// paragraph citation. Nothing here writes about the book — it only frames the
// book's own words.

export const ASK_LABELS = {
  en: {
    head: 'What the book says',
    theAnswer: "The book's answer",
    more: 'More of what the book says',
    book: 'The Urantia Book',
    copyAnswer: 'Copy the answer',
    copied: 'Copied',
    empty: 'The book does not speak to that in these words. Try asking with other words.',
    foundWhy: 'Found because it speaks of:',
    via: 'via UB Tools Studio',
    alsoIn: 'Also in:',
  },
  es: {
    head: 'Lo que dice el libro',
    theAnswer: 'La respuesta del libro',
    more: 'Más de lo que dice el libro',
    book: 'El libro de Urantia',
    copyAnswer: 'Copiar la respuesta',
    copied: 'Copiado',
    empty: 'El libro no habla de eso con estas palabras. Prueba con otras palabras.',
    foundWhy: 'Encontrado porque habla de:',
    via: 'vía UB Tools Studio',
    alsoIn: 'También en:',
  },
  fr: {
    head: 'Ce que dit le livre',
    theAnswer: 'La réponse du livre',
    more: 'Ce que le livre dit aussi',
    book: "Le Livre d'Urantia",
    copyAnswer: 'Copier la réponse',
    copied: 'Copié',
    empty: "Le livre n'en parle pas en ces termes. Essayez avec d'autres mots.",
    foundWhy: 'Trouvé parce qu’il parle de :',
    via: 'via UB Tools Studio',
    alsoIn: 'Aussi en :',
  },
  ko: {
    head: '책이 말하는 것',
    theAnswer: '책의 답변',
    more: '책의 다른 말씀',
    book: '유란시아서',
    copyAnswer: '답변 복사',
    copied: '복사됨',
    empty: '책은 그에 대해 이렇게 말하지 않습니다. 다른 말로 질문해 보세요.',
    foundWhy: '관련 주제로 찾음:',
    via: 'UB Tools Studio 제공',
    alsoIn: '다른 언어로 보기:',
  },
}

export const askLabels = (lang) => ASK_LABELS[lang] || ASK_LABELS.en

// The language toggle row under an answer: every Ask language but the current
// one, in plain words, no flags. [{ code, label }]
export function toggleLangs(current) {
  const order = ['en', 'es', 'fr', 'ko']
  return order.filter((l) => l !== current).map((code) => ({
    code,
    label: code === 'en' ? 'English' : LANGS[code].label,
  }))
}

// Forward-ready plain text: the question, the answer passage with its citation,
// then the supporting quotes each with theirs — ready to paste to a friend as-is.
// quotes: [{ ref, text }] in display order, the first being the answer.
export function forwardText(lang, q, quotes) {
  const L = askLabels(lang)
  const lines = [q, '', `${L.theAnswer} (${L.book} ${quotes[0].ref}):`, `"${quotes[0].text}"`]
  if (quotes.length > 1) {
    lines.push('', `${L.more}:`)
    for (const p of quotes.slice(1)) lines.push('', `"${p.text}" (${L.book} ${p.ref})`)
  }
  lines.push('', `— ${L.via}`)
  return lines.join('\n')
}
