/**
 * UB Quote Verifier — popup logic.
 * Fills the form from the context-menu selection (or the live page selection),
 * downloads the book text once on first run, and renders the verdict.
 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const provider = UBTextSource.makeProvider();
  let checking = false;

  function fillFromSelection(text) {
    if (!text || !text.trim()) return false;
    const { citation, quote } = UBVerify.extractCitation(text);
    $('quote').value = quote;
    if (citation) $('citation').value = citation;
    return true;
  }

  async function init() {
    // 1. pending selection from the context menu, if any
    try {
      const stored = await UBExt.storageGet('ubqPendingSelection');
      if (stored && stored.ubqPendingSelection) {
        fillFromSelection(stored.ubqPendingSelection);
        await UBExt.storageSet({ ubqPendingSelection: '' });
      }
    } catch (e) { /* storage unavailable; form still works */ }

    // 2. first-run text download (cached in IndexedDB afterwards)
    let ready = false;
    try { ready = await UBTextSource.isDownloaded(); } catch (e) { ready = false; }
    if (!ready) {
      $('setup').hidden = false;
      $('form').hidden = true;
      try {
        await UBTextSource.ensureLoaded((done, total) => {
          $('bar').style.width = Math.round((done / total) * 100) + '%';
          $('progtext').textContent = `paper ${done} of ${total}…`;
        });
        $('setup').hidden = true;
        $('form').hidden = false;
      } catch (e) {
        $('progtext').textContent = 'Download failed: ' + e.message + ' — check the connection and reopen the popup.';
        return;
      }
    }
  }

  function badgeClass(status) { return status.replace(' ', ''); }

  function renderResult(res) {
    const r = $('result');
    r.hidden = false;
    const badge = $('badge');
    badge.textContent = res.status;
    badge.className = badgeClass(res.status);
    $('detail').textContent = res.detail || (res.status === 'PASS' ? 'Exact match — the quotation is word-perfect.' : '');

    const ch = $('changes');
    ch.innerHTML = '';
    if (res.changes && res.changes.length) {
      const t = document.createElement('table');
      t.innerHTML = '<tr><th>the quote says</th><th>the book says</th></tr>';
      for (const c of res.changes.slice(0, 6)) {
        const tr = document.createElement('tr');
        const a = document.createElement('td'); a.textContent = c.quoteSays;
        const b = document.createElement('td'); b.textContent = c.bookSays;
        tr.append(a, b); t.append(tr);
      }
      ch.append(t);
    }

    const ctx = $('context');
    ctx.innerHTML = '';
    const showRefs = res.status === 'PASS' || res.status === 'PUNCTUATION' ? res.refs : (res.foundAt || []);
    if (showRefs && showRefs.length) {
      provider.context(showRefs[0]).then((paras) => {
        if (!paras.length) return;
        const label = document.createElement('p');
        label.className = 'muted';
        label.textContent = res.status === 'PASS' || res.status === 'PUNCTUATION'
          ? 'The cited paragraph, in context:'
          : 'Where the quoted words really are:';
        ctx.append(label);
        for (const p of paras) {
          const d = document.createElement('div');
          d.className = 'para' + (p.current ? ' current' : '');
          // Render as plain text: the book's markup (<sup>, <em>) is stripped
          // rather than injected as HTML, so a hostile source can never run code here.
          const ref = document.createElement('span');
          ref.className = 'ref'; ref.textContent = p.ref;
          const body = document.createElement('span');
          body.textContent = UBVerify.stripMarkup(p.text).replace(/\*/g, '');
          d.append(ref, body);
          ctx.append(d);
        }
      }).catch(() => { /* context is a nicety; the verdict stands without it */ });
    }
    if (res.status === 'MISMATCH' && res.foundAt && res.foundAt.length) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = 'True location: ' + res.foundAt.join(', ');
      ctx.append(p);
    }
  }

  async function onCheck() {
    if (checking) return;
    const body = $('quote').value.trim();
    const citation = $('citation').value.trim();
    if (!body) { $('quote').focus(); return; }
    checking = true;
    $('check').disabled = true;
    $('check').textContent = 'Checking…';
    try {
      const res = await UBVerify.checkQuote(body, citation, provider);
      renderResult(res);
    } catch (e) {
      $('result').hidden = false;
      $('badge').textContent = 'ERROR';
      $('badge').className = 'NOTFOUND';
      $('detail').textContent = 'Something went wrong: ' + e.message;
      $('changes').innerHTML = ''; $('context').innerHTML = '';
    } finally {
      checking = false;
      $('check').disabled = false;
      $('check').textContent = 'Check quote';
    }
  }

  $('check').addEventListener('click', onCheck);
  $('useSelection').addEventListener('click', async () => {
    try {
      const sel = await UBExt.activeTabSelection();
      if (!fillFromSelection(sel)) $('hint').textContent = 'No text selected on the current page.';
    } catch (e) {
      $('hint').textContent = 'Could not read the page selection here (this page may block it). Paste the quote instead.';
    }
  });

  document.addEventListener('DOMContentLoaded', init);
})();
