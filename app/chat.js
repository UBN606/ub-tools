// chat.js: readers often talk to Ask like a person: "Hello", "Thank you so much",
// "Tell me more", or a long, kind message with the real question inside it. Ask is a
// search of the book, not a chatbot, so each extra word pulls in the wrong passages
// ("husband" finds "husbandman" in 180:2.1). This module recognizes the messages that
// aren't questions, and trims the chat around the ones that are, so the search sees
// only the question. Pure logic, so it can be tested. English only: other languages
// go straight to Ask as before.

const norm = (s) => String(s || '').toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z0-9':\s-]/g, ' ').replace(/\s+/g, ' ').trim()

const GREETING = /^(hi|hello|hey|hiya|howdy|greetings|good (morning|afternoon|evening|day)|are you there|is anyone there|anybody there|test|testing)( there| friend| ub| claude| tools?| studio| everyone)?( (hi|hello|are you there|how are you))?$/
const THANKS = /^((oh )?(thank you|thanks|thank u|ty|many thanks)( (so|very) much)?( for (that|this|your help|the help|everything))?|god bless( you)?|bless you|amen|ok(ay)?|great|wonderful|perfect|beautiful|lovely|got it|that helps|that was (helpful|great|beautiful))( (so|very) much)?( (thank you|thanks|god bless( you)?))?$/
const FOLLOWUP = /^((can you |could you |please )?(tell me more|say more|more please|more|go on|keep going|continue|elaborate|explain( that| this| it)?( more| again| better)?( in (simpler|plain|easier) (words|terms|english))?|what (do|did) you mean|what does (that|this|it) mean|i don't understand|i do not understand|in (simpler|plain|easier) (words|terms|english)|simpler( please)?|what about (that|this|it|him|her|them)|and then( what)?|why( is that)?|how so|really))$/
const AUTHOR = /\b(who (wrote|authored|is the author of|are the authors of|gave us|created|made)( the)?( urantia)? (book|papers)|who are the authors|where did (the|this)( urantia)? book come from|how was (the|this)( urantia)? book (written|made|received))\b/
const TRUE = /^(is|was) (the urantia book|this book|the book|it|this|the ub) (true|real|accurate|correct|legit|from god|inspired)\b|\b(can i|should i|do you) (trust|believe) (the urantia book|this book|the book|it)\b/
const PAPER = /^(please )?(can you |could you )?(summarize|summarise|summary of|sum up|read|open|show( me)?|go to|take me to|start)?( me)?( to)?( the)? ?paper (?<n>\d{1,3})\b/

// What kind of message is this? null means: a question for Ask.
export function chatIntent(text) {
  const q = norm(text)
  if (!q) return null
  if (GREETING.test(q)) return { kind: 'greeting' }
  if (THANKS.test(q)) return { kind: 'thanks' }
  if (FOLLOWUP.test(q)) return { kind: 'followup' }
  const p = q.match(PAPER)
  if (p) {
    const n = Number(p.groups.n)
    if (n >= 0 && n <= 196) return { kind: 'paper', paper: n }
  }
  if (AUTHOR.test(q)) return { kind: 'author' }
  if (TRUE.test(q)) return { kind: 'true' }
  return null
}

const QSTART = /^(what|who|whom|whose|when|where|why|how|which|is|are|was|were|do|does|did|will|would|can|could|should|shall|may|might)\b/i

// The parts of a message that are chat, not question. Applied in order, case-insensitive.
const CHAT = [
  /^(hi|hello|hey|dear (friends?|sir|madam|ub|tools?|studio)|good (morning|afternoon|evening|day))\b[\s,!.-]*/i,
  /^(i('ve| have) been|i('m| am)|i was) (reading|studying|a reader|a student)\b[^,.;?]*?(,|\band\b)\s*/i,
  /\b(can|could|would|will) you (please )?(help me )?(understand|tell me|explain( to me)?|show me|find|look up|share)( about)?\b\s*/gi,
  /\b(please )?help me (understand|find|learn)( about)?\b\s*/gi,
  /\bi('d| would) (like|love) to (know|understand|learn)( more)?( about)?\b\s*/gi,
  /\bi (want|wanted|need) to (know|understand|learn)( more)?( about)?\b\s*/gi,
  /\bi('ve| have)? ?(always |often )?(wondered|been wondering|was wondering)( about| if| whether)?\b\s*/gi,
  /\bdo you (know|think)( if| whether| that)?\b\s*/gi,
  /\bplease\b\s*/gi,
  /[\s,.;!-]*\b(thank you|thanks)( (so|very) much)?( in advance)?[\s,.!]*$/i,
  /[\s,.;!-]*\b(god bless( you)?|blessings)[\s,.!]*$/i,
]

// Sentences, keeping their end marks.
const sentences = (s) => String(s).split(/(?<=[.?!])\s+/).map((x) => x.trim()).filter(Boolean)
const words = (s) => norm(s).split(' ').filter((w) => w.length > 2)

function strip(s) {
  let out = s
  for (const re of CHAT) out = out.replace(re, ' ')
  return out.replace(/\s+([,.?!])/g, '$1').replace(/^[\s,.;!-]+/, '').replace(/\s+/g, ' ').trim()
}

// The question inside a chatty message: { question, trimmed }. trimmed is true when the
// search should run on `question` instead of what the reader typed. A long message is
// searched by its first question; the reader sees what was searched and can switch back.
export function trimChat(text) {
  const raw = String(text || '').trim()
  const parts = sentences(raw)
  // Prefer sentences that ask something: a question mark, or a question word up front
  // once the chat is stripped ("Can you tell me what..." -> "what...").
  const asks = parts.filter((p) => /\?\s*$/.test(p) || QSTART.test(strip(p)))
  const chosen = asks.length ? asks : [raw]
  const cleaned = chosen.map(strip).filter((p) => words(p).length >= 1)
  if (!cleaned.length) return { question: raw, trimmed: false }
  const question = cleaned[0]
  return { question, trimmed: norm(question) !== norm(raw) }
}

// Tested questions for the starter buttons under the box: each one, asked as written,
// leads with passages on its subject (see app/test/chat.test.mjs).
export const STARTERS = [
  'What happens after we die?',
  'What is the Thought Adjuster?',
  'Does God love me?',
  'How should I pray?',
  'What is the soul?',
  'What is faith?',
]
