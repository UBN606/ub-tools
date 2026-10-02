// read-lang.js — pure helpers for the Read tab's English/Español toggle.
//
// Spanish answers already ship via loadTranslation('es') (see ask-i18n.js);
// the Read tablet reuses the same runtime-loaded translation. The browser
// downloads the official text from urantia.org at first use and caches the
// parsed paragraphs in IndexedDB — nothing translated ever lives in the repo.
//
// Refs are identical across languages (verified by parse-i18n.js), so the
// tablet's prev/next navigation and deep links keep working in either language.
// Page numbers are NOT shown in Spanish: they belong to a different edition.
export const READ_LANG_KEY = 'read-lang'

export function normalizeReadLang(v) {
  return v === 'es' ? 'es' : 'en'
}

// Pick the paragraph record to render in the tablet.
// enPar: the English record from E.search.getParagraphs (or {ref, error}).
// esByRef: Map from buildByRef(spanishPapers), or null when not loaded yet.
export function resolveReadParagraph(ref, readLang, enPar, esByRef) {
  // A failed English lookup means the ref itself is bad — surface the error
  // in either language rather than masking it with a translated hit.
  if (enPar && enPar.error) return { lang: normalizeReadLang(readLang), par: enPar }
  if (normalizeReadLang(readLang) !== 'es') return { lang: 'en', par: enPar }
  const esp = esByRef ? esByRef.get(ref) : undefined
  if (!esp) return { lang: 'en', par: enPar, fallback: true }
  return {
    lang: 'es',
    par: {
      ref: esp.ref,
      paper: esp.paper,
      paperTitle: esp.paperTitle,
      sectionTitle: esp.sectionTitle || '',
      text: esp.text,
    },
  }
}

// The small line under the ref: English keeps the existing format verbatim;
// Spanish shows the translation's own paper/section titles, no page number.
export function whereLine(resolved) {
  const { lang, par } = resolved
  if (!par || par.error) return ''
  if (lang === 'es') return [par.paperTitle, par.sectionTitle].filter(Boolean).join('. ')
  return `Paper ${par.paper}, ${par.paperTitle}. ${par.section}. Page ${par.page}.`
}
