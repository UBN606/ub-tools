/**
 * Synthetic fixtures for ub-api tests. These texts are invented for testing
 * (foxes, gardens, lorem-style sentences) and are NOT Urantia Book text.
 * They use the same JSON shape as Urantiapedia's DocNNN.json files.
 */

export function makeDoc(paperIndex, paperTitle, sectionSpecs) {
  return {
    paper_index: paperIndex,
    paper_title: paperTitle,
    author: 'Fixture Author',
    footnotes: [],
    sections: sectionSpecs.map(([sectionIndex, sectionTitle, pars], si) => ({
      section_index: sectionIndex,
      section_ref: `${paperIndex}:${sectionIndex}`,
      section_title: sectionTitle,
      pars: pars.map(([parNum, text], pi) => ({
        par_ref: `${paperIndex}:${sectionIndex}.${parNum}`,
        par_pageref: `${paperIndex}.${si}.${pi}`,
        par_content: text,
      })),
    })),
  };
}

export const FIXTURE_DOCS = {
  0: makeDoc(0, 'Foreword', [
    [0, null, [
      [1, 'The quick brown fox jumps over the lazy dog near the river.'],
      [2, 'Pack my box with five dozen liquor jugs for the journey.'],
    ]],
  ]),
  1: makeDoc(1, 'The Test Paper', [
    [0, null, [
      [1, 'A short introduction about testing fixtures.'],
    ]],
    [1, '1. The Garden', [
      [1, 'I am the true vine of the garden, and the gardener tends it.'],
      [2, 'The vines grow tall in summer, heavy with fruit.'],
      [3, 'This is divine providence, beyond all gardens.'],
    ]],
  ]),
  2: makeDoc(2, 'Another Paper', [
    [3, '3. The Fence', [
      [1, 'The fox — swift and brown — jumps over fences.'],
      [2, 'Testing one two three, the fixture paper ends here.'],
    ]],
  ]),
};

/**
 * Mock fetch serving fixture docs. Options:
 *   docs: map of paperIndex -> doc (default FIXTURE_DOCS)
 *   failBases: URL prefixes that throw (simulates a dead mirror)
 *   failAll: every request throws
 *   generate: function(paperIndex) -> doc, used when docs has no entry
 * Returns { fetchImpl, calls } where calls is the ordered list of URLs requested.
 */
export function mockFetch({ docs = FIXTURE_DOCS, failBases = [], failAll = false, generate = null } = {}) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (failAll || failBases.some(b => url.startsWith(b))) throw new Error('mock network failure');
    const m = String(url).match(/Doc(\d{3})\.json$/);
    let doc = m ? docs[Number(m[1])] : null;
    if (!doc && m && generate) doc = generate(Number(m[1]));
    if (!doc) return { ok: false, status: 404, json: async () => null };
    return { ok: true, status: 200, json: async () => doc };
  };
  return { fetchImpl, calls };
}

/** Mock fetch that synthesizes a doc for every paper 0..196 (for prefetch/listPapers tests). */
export function mockFetchAllPapers() {
  return mockFetch({
    docs: {},
    generate: (i) => makeDoc(i, `Paper ${i}`, [
      [0, null, [[1, `Synthetic paragraph one of paper ${i}, for testing only.`]]],
    ]),
  });
}
