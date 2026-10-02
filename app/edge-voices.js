// edge-voices.js — Microsoft Edge neural voices for the Studio, served through
// Derek's website API (https://urantiabooknetwork.com/api/tts): the same voice
// list and default his website offers (see ubn-site src/components/ReadAloud.tsx).
// The Studio is a static page and cannot synthesize these itself; the website's
// serverless endpoint does the synthesis (msedge-tts, no API key) and returns MP3.
//
// CORS: the website's /api/tts must allow the Studio's origin. Until that ships,
// edgeAvailable() fails and the voice picker quietly shows only the device's own
// voices — nothing breaks, the Edge options simply don't appear.

export const EDGE_API = 'https://urantiabooknetwork.com/api/tts'

// Same list as the website. Several Edge voices return HTTP 200 with 0 bytes and
// are never listed there; keep this list in sync with ReadAloud.tsx.
export const EDGE_VOICES = [
  { id: 'en-US-AndrewMultilingualNeural', label: 'Andrew' },
  { id: 'en-US-AvaMultilingualNeural', label: 'Ava' },
  { id: 'en-US-EmmaMultilingualNeural', label: 'Emma' },
  { id: 'en-US-ChristopherNeural', label: 'Christopher' },
  { id: 'en-US-EricNeural', label: 'Eric' },
  { id: 'en-US-JennyNeural', label: 'Jenny' },
  { id: 'en-GB-SoniaNeural', label: 'Sonia' },
  { id: 'en-GB-RyanNeural', label: 'Ryan' },
  { id: 'en-AU-NatashaNeural', label: 'Natasha' },
  { id: 'en-AU-WilliamNeural', label: 'William' },
  { id: 'en-IE-ConnorNeural', label: 'Connor' },
  { id: 'en-CA-ClaraNeural', label: 'Clara' },
]
export const EDGE_DEFAULT = 'en-US-AndrewMultilingualNeural'

// Voice-picker option values for Edge voices; the device's own speechSynthesis
// voices keep their plain names, so the two never collide.
export const edgeOptionValue = (id) => `edge:${id}`
export const edgeVoiceId = (value) =>
  typeof value === 'string' && value.startsWith('edge:') ? value.slice(5) : null

let probeCache = null
/** True when the website's TTS endpoint answers (CORS included). Never throws. */
export async function edgeAvailable() {
  if (probeCache !== null) return probeCache
  try {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), 8000)
    const res = await fetch(EDGE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ probe: true }),
      signal: ctl.signal,
    })
    clearTimeout(t)
    probeCache = res.ok
  } catch {
    probeCache = false
  }
  return probeCache
}

/**
 * Synthesize text with an Edge voice. Resolves to an HTMLAudioElement with a
 * blob URL, ready to play. Throws on rate-limit (429), CORS failure, network
 * error, or empty audio — the caller falls back to the device voice.
 */
export async function edgeAudio(text, voiceId) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 30000)
  let res
  try {
    res = await fetch(EDGE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.slice(0, 5000), voice: voiceId }),
      signal: ctl.signal,
    })
  } catch (e) {
    clearTimeout(t)
    throw new Error('edge-tts unreachable')
  }
  clearTimeout(t)
  if (!res.ok) throw new Error(`edge-tts HTTP ${res.status}`)
  const blob = await res.blob()
  if (!blob.size) throw new Error('edge-tts returned no audio')
  return new Audio(URL.createObjectURL(blob))
}
