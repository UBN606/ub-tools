// read-lang.js — pure helpers for the Read tab's language toggle.
//
// Spanish and Polish answers ship via loadTranslation (see ask-i18n.js);
// the Read tablet reuses the same runtime-loaded translations. The browser
// downloads the official text from urantia.org at first use and caches the
// parsed paragraphs in IndexedDB — nothing translated ever lives in the repo.
//
// Refs are identical across languages (verified by parse-i18n.js), so the
// tablet's prev/next navigation and deep links keep working in any language.
// Page numbers are NOT shown in translations: they belong to different editions.
export const READ_LANG_KEY = 'read-lang'

export function normalizeReadLang(v) {
  return v === 'es' ? 'es' : v === 'pl' ? 'pl' : 'en'
}

// Pick the paragraph record to render in the tablet.
// enPar: the English record from E.search.getParagraphs (or {ref, error}).
// i18nByRef: Map from buildByRef(translatedPapers), or null when not loaded yet.
export function resolveReadParagraph(ref, readLang, enPar, i18nByRef) {
  // A failed English lookup means the ref itself is bad — surface the error
  // in either language rather than masking it with a translated hit.
  const lang = normalizeReadLang(readLang)
  if (enPar && enPar.error) return { lang, par: enPar }
  if (lang === 'en') return { lang: 'en', par: enPar }
  const tr = i18nByRef ? i18nByRef.get(ref) : undefined
  if (!tr) return { lang: 'en', par: enPar, fallback: true }
  return {
    lang,
    par: {
      ref: tr.ref,
      paper: tr.paper,
      paperTitle: tr.paperTitle,
      sectionTitle: tr.sectionTitle || '',
      text: tr.text,
    },
  }
}

// The small line under the ref: English keeps the existing format verbatim;
// translations show their own paper/section titles, no page number.
export function whereLine(resolved) {
  const { lang, par } = resolved
  if (!par || par.error) return ''
  if (lang === 'es' || lang === 'pl') return [par.paperTitle, par.sectionTitle].filter(Boolean).join('. ')
  return `Paper ${par.paper}, ${par.paperTitle}. ${par.section}. Page ${par.page}.`
}
