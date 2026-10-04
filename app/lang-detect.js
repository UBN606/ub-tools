// lang-detect.js — which language is this question in?
// Spanish, French, Korean, or English. Korean is found by its alphabet; Spanish and
// French are told apart by their little glue words (para/pour, este/cette, son/sont).
// When nothing points elsewhere, the question is English. Used by Ask so a question
// asked in Spanish gets an answer in Spanish, with a toggle to switch.

const fold = (s) => s.toLowerCase()

// Glue words that belong to only one of the two (whole-word matched). Shared words
// like de, la, que, en are left out on purpose.
const ES = ('está están para este esta estos estas eso son hay muy pero porque dónde cuándo '
  + 'cuál cuáles quién quiénes también entre los las del con por sus desde hasta todo todos '
  + 'contra otros ante ellos esto fue eran sido tienen tiene tenía según favor gracias usted '
  + 'es eres somos').split(' ')
const FR = ('est sont était étaient fut furent sera seront des pour avec sur dans mais où quand '
  + 'pourquoi comment quel quelle quels quelles lequel laquelle lesquels lesquelles très aussi '
  + 'tout tous toute toutes dont aux leur leurs ne plus chez sans sous pendant chaque '
  + 'merci votre notre qui').split(' ')
const ES_SET = new Set(ES)
const FR_SET = new Set(FR)

// Content words the Ask answerer knows in each language (folded the way Ask folds them).
// A one-word question like "filosofia" carries no glue words, but it is still Spanish.
const ES_WORDS = new Set(('morir muerte muerto muere mueren morimos murio murieron angel angeles cielo '
  + 'infierno dios padre creador alma espiritu conciencia orar oracion rezar rezo '
  + 'adoracion fe creer pecado mal diablo satanas perdon perdonar sufrimiento dolor amor '
  + 'matrimonio proposito felicidad miedo curacion milagro tierra filosofia universo vida '
  + 'nacimiento').split(' '))
const FR_WORDS = new Set(('mourir mort meurt decede ange anges ciel enfer dieu pere createur ame esprit '
  + 'conscience prier priere culte adoration foi croire peche mal diable satan pardon '
  + 'pardonner souffrance douleur amour mariage famille univers bonheur peur guerison miracle '
  + 'terre philosophie vie universel naissance').split(' '))
// Korean: strip the little endings particles leave on words (하나님은 -> 하나님).
const KO_PARTICLES = /^(은|는|이|가|을|를|의|에|에서|에게|한테|도|만|부터|까지|와|과|로|으로|아|야|고)$/
const KO_WORDS = new Set(('죽 사망 천사 하늘 지옥 하나님 아버지 창조자 혼 성령 양심 예수 그리스도 기도 '
  + '예배 믿음 죄 악 악마 사탄 용서 고통 슬픔 사랑 결혼 가정 우주 행복 두려움 치유 기적 유란시아 '
  + '철학 생명 아담 이브 구원 부활 출생').split(' '))
// Polish: distinctive glue words (whole-word matched).
const PL = ('się jest są był była było będą mieć ma mają nie co jak gdzie kiedy dlaczego czy to ten ta te '
  + 'który która które jestem jesteś jesteśmy jesteście bardzo też również ale oraz lub albo ponieważ '
  + 'dlatego więc już jeszcze tylko także może musi można proszę dziękuję pana pani').split(' ')
const PL_SET = new Set(PL)
// Polish content words the Ask answerer knows (folded the way Ask folds them).
const PL_WORDS = new Set(('bog boga bogiem ojciec ojca stworca dusza duch sumienie aniol aniolowie niebo '
  + 'pieklo piekle milosc kochac modlitwa modlic wiara wierzyc grzech zlo diabel szatan '
  + 'przebaczenie przebaczyc cierpienie bol smierc umrzec umiera zycie narodziny wszechswiat '
  + 'urantia ksiega osobowosc syn jezus chrystus prawda dobro piekno').split(' '))
const stripKo = (w) => {
  let prev = ''
  while (w.length > 2 && w !== prev) {
    prev = w
    for (const p of ['에서는', '에게는', '에서', '에게', '한테', '부터', '까지', '으로', '로', '와', '과', '은', '는', '이', '가', '을', '를', '의', '에', '도', '만', '아', '야', '고']) {
      if (w.endsWith(p) && w.length - p.length >= 2) { w = w.slice(0, -p.length); break }
    }
  }
  return w
}
const wordSet = (text) => new Set(text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean))

export function detectLang(question) {
  const q = String(question || '')
  // Spanish ships; Polish is detected for a graceful fallback message.
  // French/Korean map to English until those translations ship (after ranking review).
  const full = detectLangFull(q)
  return full === 'es' ? 'es' : full === 'pl' ? 'pl' : 'en'
}

function detectLangFull(question) {
  const q = String(question || '')
  if (/[\uAC00-\uD7AF]/.test(q)) return 'ko'
  const words = wordSet(q)
  let es = 0, fr = 0, pl = 0
  for (const w of words) {
    if (ES_SET.has(w)) es++
    if (FR_SET.has(w)) fr++
    if (PL_SET.has(w)) pl++
  }
  if (/[¿¡]/.test(q)) es += 2
  if (/\w*ñ\w*/.test(q.toLowerCase())) es += 2
  if (/[çœ]/.test(q.toLowerCase())) fr += 2
  // Polish diacritics are a strong signal (ą ć ę ł ń ś ź ż).
  if (/[ąćęłńśźż]/.test(q.toLowerCase())) pl += 3
  // Clear winner by glue words takes it.
  const top = Math.max(es, fr, pl)
  if (top > 0) {
    const winners = [es === top && 'es', fr === top && 'fr', pl === top && 'pl'].filter(Boolean)
    if (winners.length === 1) return winners[0]
  }
  // Tie: if it reads like an English question, it is one ('jesus' alone is not
  // enough to call it Spanish — the folded content check below would say so).
  const EN = new Set(('what who whom whose when where why how which is are was were be been '
    + 'do does did the and or of to in on it its this that these those tell about').split(' '))
  for (const w of words) if (EN.has(w)) return 'en'
  // No glue words told them apart: ask the content words (folded like Ask folds them).
  const folded = q.toLowerCase()
    .replace(/[áàäâ]/g, 'a').replace(/[éèëê]/g, 'e').replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o').replace(/[úùüû]/g, 'u').replace(/ñ/g, 'n').replace(/ç/g, 'c')
    .replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e').replace(/ł/g, 'l')
    .replace(/ń/g, 'n').replace(/ś/g, 's').replace(/ź/g, 'z').replace(/ż/g, 'z')
  const fw = new Set(folded.split(/[^a-z]+/).filter((w) => w.length > 3))
  for (const w of fw) if (ES_WORDS.has(w)) return 'es'
  for (const w of fw) if (FR_WORDS.has(w)) return 'fr'
  for (const w of fw) if (PL_WORDS.has(w)) return 'pl'
  for (const w of words) {
    const s = stripKo(w)
    if (s.length >= 2 && KO_WORDS.has(s)) return 'ko'
  }
  return 'en'
}

// Test list (kept with the module so the intent stays readable):
// '¿Qué es la filosofía según el libro de Urantia?' -> es
// 'que es la filosofia para el libro de urantia' (no accents) -> es
// 'filosofia' -> es
// '¿Qué pasa cuando morimos?' -> es
// 'Qu\u2019est-ce que la philosophie ?' -> fr
// 'philosophie' -> fr
// 'Que dit le livre sur les anges ?' -> fr
// '예수님은 누구인가요?' -> ko
// '죽으면 어떻게 되나요?' -> ko
// 'What happens when we die?' -> en
// 'philosophy' -> en (English word, no markers)
// 'What is 하나님?' (mixed) -> ko
