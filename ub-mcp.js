#!/usr/bin/env node
// UB Tools -- a local Model Context Protocol server for The Urantia Book (stdio)
// ============================================================================
// Gives any MCP-capable assistant (Claude Code, Claude Desktop, Codex, others) the exact
// text of The Urantia Book, so it can quote and cite from the source instead of from memory.
// Built by the Urantia Book Network (urantiabooknetwork.com) after a check of our own articles found
// misquotes written with care: dropped words, Bible wording in place of the UB's, wrong paragraph numbers.
//
// Tools (all read-only; this server never writes a file and never calls the network):
//   ub_search          full-text search, whole-word, with UB citations
//   ub_get_paragraphs  exact, untruncated text of one or more Paper:Section.Paragraph refs
//   ub_get_section     every paragraph of one section, in order
//   ub_topic_lookup    Urantiapedia topic index entry (people, places, orders, concepts)
//   ub_verify_text     check a draft: every quote vs its citation, plus dashes in our own words
//   ub_recall          every paragraph on a place (modern names resolved), or what a draft left unread
//   ub_check_claims    claims credited to the book: cited? figures in the cited paragraph? book words cited?
//
// It reuses ub-search.js and ub-verify.js from this folder, so the server, the CLIs and the
// skills can never disagree. Dependency-free JSON-RPC 2.0 over newline-delimited stdio.
//
// Add it:
//   Claude Code:  claude mcp add --scope user ub-tools -- node /path/to/ub-tools/ub-mcp.js
//   Codex:        [mcp_servers.ub-tools] command = "node", args = ["/path/to/ub-tools/ub-mcp.js"]
//   Others:       any MCP client that launches a stdio server: node /path/to/ub-tools/ub-mcp.js
// First run:      node fetch-data.js   (downloads the text; see README)
// Self-test:      node ub-mcp.js --self-test
//
// IMPORTANT: stdout carries ONLY JSON-RPC messages. All logging goes to stderr.

const fs = require('fs');
const path = require('path');
const { searchUB, getParagraphs } = require('./ub-search.js');
const V = require('./ub-verify.js');
const R = require('./ub-recall.js');
const C = require('./ub-claims.js');

const SERVER_INFO = { name: 'ub-tools', version: '1.2.0' };
const DEFAULT_PROTOCOL = '2024-11-05';
const PAPERS_DIR = path.join(__dirname, 'source-texts', 'papers');
const TOPIC_DIR = path.join(__dirname, 'source-texts', 'topic-index');

const QUOTE_RULE = 'Quote only text returned by ub_get_paragraphs or ub_get_section, copied character for character (keep the book\'s curly quotes and em dashes), and cite it as (Paper:Section.Paragraph). Search results are excerpts; never quote from them.';

const TOOLS = [
  {
    name: 'ub_search',
    description: 'Search the full text of The Urantia Book (all 197 documents, 14,596 paragraphs). Whole-word matching: "vine" finds vine/vines, not "divine". An exact phrase ranks first even as a passing mention, so also search key words. Results are EXCERPTS for finding passages; get exact text with ub_get_paragraphs before quoting. Use the book\'s own terms (Thought Adjuster, not "inner voice"; Paradise or mansion worlds, not "heaven").',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Words or phrase to find, e.g. "vine branches" or "Amadon".' },
        paper: { type: 'integer', description: 'Optional: limit to one paper (0 = Foreword, 1-196).' },
        limit: { type: 'integer', description: 'Max results (default 10, max 50).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'ub_get_paragraphs',
    description: 'Exact, untruncated text of Urantia Book paragraphs by reference, with page, paper, section and author. This is the text to quote. ' + QUOTE_RULE,
    inputSchema: {
      type: 'object',
      properties: { refs: { type: 'array', items: { type: 'string' }, description: 'References like ["180:2.1", "180:2.2"]. Max 40.' } },
      required: ['refs'],
    },
  },
  {
    name: 'ub_get_section',
    description: 'Every paragraph of one Urantia Book section, exact text, in order. Use to read a passage in context before choosing what to cite.',
    inputSchema: {
      type: 'object',
      properties: {
        paper: { type: 'integer', description: 'Paper number (0 = Foreword, 1-196).' },
        section: { type: 'integer', description: 'Section number (0 = the paper\'s introduction).' },
      },
      required: ['paper', 'section'],
    },
  },
  {
    name: 'ub_topic_lookup',
    description: 'Look up a person, place, order of beings, race or concept in the Urantiapedia topic index for The Urantia Book. Returns the entry with its paper references and see-also links.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'e.g. "Amadon", "Dalamatia", "Thought Adjusters".' } },
      required: ['name'],
    },
  },
  {
    name: 'ub_verify_text',
    description: 'Check a draft before it is published or spoken. Compares every quotation followed by a UB citation, "..." (180:2.1) or (UB 180:2.1), word for word against the cited paragraph. Statuses: PASS; PUNCTUATION (same words, a mark changed, e.g. the book\'s em dash turned into a comma; restore it); MISMATCH (words differ; reports where the words really are if the citation is wrong); NOT FOUND (no such paragraph). Also flags em and en dashes in the author\'s own words (outside quotation marks). Run this on anything that quotes the UB, then fix every finding.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The draft text (markdown, mdx, plain text or a script).' },
        check_dashes: { type: 'boolean', description: 'Also flag dashes in the author\'s own words (default true).' },
      },
      required: ['text'],
    },
  },
  {
    name: 'ub_recall',
    description: 'Before saying what the Urantia Book says, or does not say, about a place or people, list EVERY paragraph on it. ub_verify_text proves quotes are exact; this proves nothing was left out. Modern names resolve to the book\'s (Maya -> Mexico, Central America; Rapa Nui -> Easter Island). Give `places` to list paragraphs, or `text` (a draft) to get the paragraphs on its subject that it neither cites nor records as read (`read`: {"64:6.5": "why it does not change the claim"}). Read each listed paragraph in full with ub_get_paragraphs. Papers 57-61 (geology) are skipped unless all_papers is true.',
    inputSchema: {
      type: 'object',
      properties: {
        places: { type: 'array', items: { type: 'string' }, description: 'Places or peoples, e.g. ["Maya", "Peru"].' },
        text: { type: 'string', description: 'A draft to check for unread paragraphs on its subject.' },
        read: { type: 'object', description: 'Paragraphs (or whole papers, "94") already read, each with a reason of 20+ characters.' },
        all_papers: { type: 'boolean', description: 'Include Papers 57-61 (geology). Default false.' },
      },
    },
  },
  {
    name: 'ub_check_claims',
    description: 'Check what a draft says the Urantia Book says, beyond exact quotes. C1 UNCITED: a sentence credits the book (says, dates, places, describes, according to the UB) with no Paper:Section.Paragraph citation in it, its paragraph or the next. C2 NUMBER: a date or quantity credited to the book that the cited paragraphs do not contain (the book writes many figures in words; "eighty-five thousand" = 85000); figures marked as ours are exempt. C3 BOOK WORDS: six or more words of the book in quotation marks with no citation. Run with ub_verify_text and ub_recall before publishing.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The draft text.' },
        allow: { type: 'object', description: 'Findings that are right as written: {"<first 60 characters of the sentence>": "why (20+ characters)"}.' },
      },
      required: ['text'],
    },
  },
];

// ---------- tool implementations ----------
function textResult(obj) { return { content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2) }] }; }
function errorResult(msg) { return { content: [{ type: 'text', text: msg }], isError: true }; }

function toolSearch({ query, paper, limit }) {
  if (!query || !String(query).trim()) return errorResult('query is required');
  const lim = Math.min(Math.max(parseInt(limit || 10, 10), 1), 50);
  const { total, results } = searchUB({ query: String(query), paper: Number.isInteger(paper) ? paper : null, limit: lim });
  return textResult({
    query, total, showing: results.length,
    note: 'Excerpts for locating passages. Before quoting, fetch exact text with ub_get_paragraphs.',
    results: results.map(r => ({
      ref: r.ref, paper: r.paper, paperTitle: r.paperTitle, section: r.sectionTitle, author: r.author,
      excerpt: r.text.length > 400 ? r.text.slice(0, 400) + '...' : r.text,
    })),
  });
}

function toolGetParagraphs({ refs }) {
  if (!Array.isArray(refs) || !refs.length) return errorResult('refs must be a non-empty array like ["180:2.1"]');
  if (refs.length > 40) return errorResult('At most 40 refs per call.');
  const out = getParagraphs(refs);
  return textResult({ rule: QUOTE_RULE, paragraphs: out });
}

function toolGetSection({ paper, section }) {
  if (!Number.isInteger(paper) || !Number.isInteger(section)) return errorResult('paper and section must be integers');
  const file = path.join(PAPERS_DIR, `Doc${String(paper).padStart(3, '0')}.json`);
  if (!fs.existsSync(file)) return errorResult(`No such paper: ${paper}`);
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  const sec = doc.sections.find(s => s.pars.length && s.pars[0].par_ref.startsWith(`${paper}:${section}.`));
  if (!sec) return errorResult(`Paper ${paper} has no section ${section}.`);
  return textResult({ rule: QUOTE_RULE, paper: doc.paper_index, paperTitle: doc.paper_title, author: doc.author,
    section: sec.section_title || 'Introduction',
    paragraphs: sec.pars.map(p => ({ ref: p.par_ref, page: p.par_pageref, text: p.par_content })) });
}

let topicCache = null;
function loadTopics() {
  if (topicCache) return topicCache;
  topicCache = [];
  const HEADER = /^([^|\t][^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([A-Z]*)\s*\|\s*\w*\s*$/;
  for (const f of fs.readdirSync(TOPIC_DIR).filter(n => /^[a-z]\.txt$/.test(n))) {
    let cur = null;
    for (const line of fs.readFileSync(path.join(TOPIC_DIR, f), 'utf8').split(/\r?\n/)) {
      const m = line.match(HEADER);
      if (m) { cur = { name: m[1].trim(), refs: m[2], seeAlso: m[3], category: m[4], lines: [] }; topicCache.push(cur); }
      else if (cur && line.trim()) cur.lines.push(line.trim());
      else if (!line.trim()) cur = null;
    }
  }
  return topicCache;
}

function toolTopicLookup({ name }) {
  if (!name || !String(name).trim()) return errorResult('name is required');
  const q = String(name).trim().toLowerCase();
  const topics = loadTopics();
  const main = t => t.name.toLowerCase().split(';')[0].trim();
  let hits = topics.filter(t => main(t) === q);
  if (!hits.length) hits = topics.filter(t => t.name.toLowerCase().split(';').some(n => n.trim() === q));
  if (!hits.length) hits = topics.filter(t => main(t).startsWith(q));
  if (!hits.length) hits = topics.filter(t => t.name.toLowerCase().includes(q));
  if (!hits.length) return textResult({ name, found: false, note: 'No topic entry. Try ub_search with the name or a UB synonym.' });
  return textResult({ name, found: true, entries: hits.slice(0, 5).map(t => ({
    topic: t.name, category: t.category || undefined, seeAlso: t.seeAlso || undefined, refs: t.refs || undefined,
    details: t.lines.slice(0, 60) })),
    more: hits.length > 5 ? `${hits.length - 5} more partial matches; use a more exact name.` : undefined });
}

function toolVerifyText({ text, check_dashes }) {
  if (typeof text !== 'string' || !text.trim()) return errorResult('text is required');
  if (text.length > 400000) return errorResult('Text too long (max 400,000 characters); check one article at a time.');
  const rep = V.verifyText(text, { quotesOnly: check_dashes === false });
  const count = s => rep.results.filter(r => r.status === s).length;
  const problems = rep.results.filter(r => r.status !== 'PASS').map(r => ({
    status: r.status, line: r.line, citation: r.citation, quote: r.body.length > 240 ? r.body.slice(0, 240) + '...' : r.body,
    detail: r.detail, changes: r.changes && r.changes.length ? r.changes : undefined,
    exactText: r.status !== 'NOT FOUND' ? `ub_get_paragraphs ${JSON.stringify(r.refs)}` : undefined,
  }));
  const clean = !problems.length && !rep.dashes.length;
  return textResult({
    result: clean ? 'CLEAN' : 'FIX NEEDED',
    quotesChecked: rep.results.length,
    counts: { PASS: count('PASS'), PUNCTUATION: count('PUNCTUATION'), MISMATCH: count('MISMATCH'), 'NOT FOUND': count('NOT FOUND') },
    problems,
    dashesInOwnWords: rep.dashes,
    note: rep.results.length ? undefined : 'No quotation followed by a (Paper:Section.Paragraph) citation was found, so no quote was checked.',
  });
}

function toolRecall({ places, text, read, all_papers }) {
  const allPapers = all_papers === true;
  if (typeof text === 'string' && text.trim()) {
    const r = R.checkText(text, { read: { reviewed: read || {} }, terms: Array.isArray(places) && places.length ? places : null, allPapers });
    return textResult({
      result: !r.why.size ? 'NO SUBJECT' : r.unread.length ? 'READ MORE' : 'RECALL PASS',
      triggeredBy: Object.fromEntries(r.why),
      required: r.required,
      unread: r.unread.map(p => ({ ref: p.ref, excerpt: R.excerpt(p.text, R.resolve(p.groups[0])) })),
      weakReasons: r.weak.length ? r.weak : undefined,
      note: 'Read each unread paragraph in full (ub_get_paragraphs), then cite it or record why it does not change the claim.' + (allPapers ? '' : ' Papers 57-61 skipped.'),
    });
  }
  if (!Array.isArray(places) || !places.length) return errorResult('give places (a list) or text (a draft)');
  const groups = places.flatMap(t => R.resolve(String(t)));
  const pars = R.paragraphsFor(groups, { allPapers });
  return textResult({
    searched: groups.map(g => `${g.id} ${g.book}`),
    count: pars.length,
    paragraphs: pars.map(p => ({ ref: p.ref, excerpt: R.excerpt(p.text, groups) })),
    note: 'Excerpts are for finding. Read every paragraph in full with ub_get_paragraphs before saying what the book says or does not say.' + (allPapers ? '' : ' Papers 57-61 (geology) skipped.'),
  });
}

function toolCheckClaims({ text, allow }) {
  if (typeof text !== 'string' || !text.trim()) return errorResult('text is required');
  if (text.length > 400000) return errorResult('Text too long (max 400,000 characters); check one article at a time.');
  const found = C.checkDraft(text, { allow: allow || {} });
  return textResult({
    result: found.length ? 'FIX NEEDED' : 'CLAIMS PASS',
    findings: found.map(f => ({ kind: f.kind, line: f.line, detail: f.detail, sentence: f.text.length > 240 ? f.text.slice(0, 240) + '...' : f.text })),
    note: found.length ? 'Cite the paragraph, quote the book\'s own figure, mark a figure as ours, or pass an allow entry with the reason.' : undefined,
  });
}

async function runTool(name, args = {}) {
  try {
    switch (name) {
      case 'ub_search': return toolSearch(args);
      case 'ub_get_paragraphs': return toolGetParagraphs(args);
      case 'ub_get_section': return toolGetSection(args);
      case 'ub_topic_lookup': return toolTopicLookup(args);
      case 'ub_verify_text': return toolVerifyText(args);
      case 'ub_recall': return toolRecall(args);
      case 'ub_check_claims': return toolCheckClaims(args);
      default: return errorResult(`Unknown tool: ${name}`);
    }
  } catch (e) {
    process.stderr.write(`[ub-tools] ${name} failed: ${e.stack || e.message}\n`);
    return errorResult(`${name} failed: ${e.message}`);
  }
}

// ---------- JSON-RPC 2.0 over newline-delimited stdio ----------
function send(msg) { process.stdout.write(JSON.stringify(msg) + '\n'); }
function reply(id, result) { send({ jsonrpc: '2.0', id, result }); }
function replyError(id, code, message) { send({ jsonrpc: '2.0', id, error: { code, message } }); }

async function handle(msg) {
  const { id, method, params } = msg;
  const isRequest = id !== undefined && id !== null;
  switch (method) {
    case 'initialize': {
      const requested = params && params.protocolVersion;
      reply(id, {
        protocolVersion: typeof requested === 'string' ? requested : DEFAULT_PROTOCOL,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
        instructions: 'Urantia Book source text. Never quote the UB from memory: find passages with ub_search, fetch exact wording with ub_get_paragraphs, and run ub_verify_text on any draft that quotes the book before it is published or spoken.',
      });
      return;
    }
    case 'notifications/initialized':
    case 'initialized':
      return;
    case 'ping':
      if (isRequest) reply(id, {});
      return;
    case 'tools/list':
      reply(id, { tools: TOOLS });
      return;
    case 'tools/call':
      reply(id, await runTool(params && params.name, (params && params.arguments) || {}));
      return;
    default:
      if (isRequest) replyError(id, -32601, `Method not found: ${method}`);
  }
}

// ---------- self-test: drives the real handlers, no stdio ----------
async function selfTest() {
  const parse = r => JSON.parse(r.content[0].text);
  const cases = [
    ['search finds the vine discourse first', async () => parse(await runTool('ub_search', { query: 'vine branches', limit: 3 })).results[0].ref === '180:2.1'],
    ['search does not match "divine" for "vine"', async () => { const refs = parse(await runTool('ub_search', { query: 'vine', limit: 50 })).results.map(r => r.ref); return refs.length > 0 && getParagraphs(refs).every(p => /\bvine/i.test(p.text)); }],
    ['exact paragraph keeps curly quotes', async () => parse(await runTool('ub_get_paragraphs', { refs: ['180:2.2'] })).paragraphs[0].text.startsWith('“As the Father')],
    ['bad ref reported, not invented', async () => !!parse(await runTool('ub_get_paragraphs', { refs: ['180:2.99'] })).paragraphs[0].error],
    ['section returns all paragraphs in order', async () => { const s = parse(await runTool('ub_get_section', { paper: 180, section: 2 })); return s.paragraphs.length === 7 && s.paragraphs[0].ref === '180:2.1'; }],
    ['topic lookup finds Amadon', async () => parse(await runTool('ub_topic_lookup', { name: 'Amadon' })).entries[0].topic.startsWith('Amadon')],
    ['verify catches a dropped word', async () => parse(await runTool('ub_verify_text', { text: 'He warns against "stereotyped systems of religious beliefs" here (120:3.7).' })).counts.MISMATCH === 1],
    ['verify passes an exact quote', async () => parse(await runTool('ub_verify_text', { text: '"As the Father has loved me, so have I loved you." (180:2.2)' })).result === 'CLEAN'],
    ['verify flags a dash in our words only', async () => parse(await runTool('ub_verify_text', { text: 'Our line — here. "fruit-bearing branches—my friends who love one another" (180:2.1)' })).dashesInOwnWords.length === 1],
    ['recall resolves Maya and returns 64:7.5', async () => parse(await runTool('ub_recall', { places: ['Maya'] })).paragraphs.some(p => p.ref === '64:7.5')],
    ['recall tells a Maya draft citing only 79:5.9 to read 64:7.5', async () => parse(await runTool('ub_recall', { text: '# The Maya world tree\n\nThe book places the only Andite trace in Peru (79:5.9), not among the Maya.' })).unread.some(p => p.ref === '64:7.5')],
    ['claims catches a date the cited paragraph does not give', async () => parse(await runTool('ub_check_claims', { text: "The UB's dating (late Andite migrations, c. 6000-2000 BCE) comes from 78:5.7." })).findings.some(f => f.kind === 'C2 NUMBER')],
    ['claims passes a figure the book gives in words', async () => parse(await runTool('ub_check_claims', { text: 'The book says the red race crossed about 85,000 years ago (64:6.5).' })).result === 'CLAIMS PASS'],
    ['unknown tool is an error, not a crash', async () => (await runTool('nope', {})).isError === true],
  ];
  let bad = 0;
  for (const [name, fn] of cases) {
    let ok = false;
    try { ok = await fn(); } catch (e) { ok = false; }
    if (!ok) bad++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
  }
  console.log(bad ? `\n${bad} case(s) FAILED` : '\nAll ub-tools self-test cases passed');
  return bad ? 1 : 0;
}

function main() {
  if (process.argv.includes('--self-test')) { selfTest().then(c => process.exit(c)); return; }
  let buffer = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    buffer += chunk;
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { process.stderr.write(`[ub-tools] could not parse line: ${line.slice(0, 200)}\n`); continue; }
      handle(msg).catch(err => process.stderr.write(`[ub-tools] handler error: ${err.stack || err.message}\n`));
    }
  });
  process.stdin.on('end', () => process.exit(0));
  process.stderr.write('[ub-tools] MCP server ready on stdio\n');
}

main();
