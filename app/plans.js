// Reading plans view for UB Tools Studio.
//
// ES module. Renders plan cards (title, blurb, progress), an expandable day
// list with check-off boxes, per-plan Resume (first unchecked day) and a
// "Continue where you left off" banner fed by the coordinator's last-read-ref.
// Everything is stored in localStorage; nothing leaves this device.
//
// The coordinator wires it like:
//   import { renderPlansView } from './plans.js'
//   renderPlansView(container, E, { esc, store, openRef })
'use strict';

const DATA_URL = new URL('./plans-data.json', import.meta.url);
const PROGRESS_KEY = 'plans-progress'; // { [planId]: { done: [dayNumbers], started: 'YYYY-MM-DD' } }
const LAST_REF_KEY = 'last-read-ref';  // saved by the coordinator inside openRef()

export function renderPlansView(container, E, deps) {
  const { esc, store, openRef } = deps;
  container.innerHTML = `<div class="summary"><h2>Reading plans</h2><p>Read the book on a schedule. Your checkmarks stay in this browser.</p></div>
<div id="plans-resume"></div>
<div class="plans-list" id="plans-list"><p class="empty">Loading the plans.</p></div>`;

  const last = store.get(LAST_REF_KEY, null);
  if (last) {
    const resume = container.querySelector('#plans-resume');
    resume.innerHTML = `<p class="deeper">Continue where you left off: <button type="button" class="linkish" id="plans-continue">${esc(last)}</button></p>`;
    resume.querySelector('#plans-continue').addEventListener('click', () => openRef(last));
  }

  fetch(DATA_URL).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json();
  }).then((data) => renderPlans(container.querySelector('#plans-list'), data, esc, store, openRef))
    .catch((err) => {
      container.querySelector('#plans-list').innerHTML =
        `<p class="empty">The reading plans could not be loaded (${esc(err.message)}).</p>`;
    });
}

function renderPlans(box, data, esc, store, openRef) {
  box.innerHTML = '';
  for (const plan of data.plans || []) {
    box.appendChild(planCard(plan, esc, store, openRef));
  }
  if (!box.children.length) box.innerHTML = '<p class="empty">No plans in this file.</p>';
}

function progressOf(store, planId) {
  const all = store.get(PROGRESS_KEY, {});
  const p = all[planId];
  return {
    done: new Set(Array.isArray(p?.done) ? p.done : []),
    started: typeof p?.started === 'string' ? p.started : null,
  };
}
function saveProgress(store, planId, done, started) {
  const all = store.get(PROGRESS_KEY, {});
  all[planId] = { done: [...done].sort((a, b) => a - b), started };
  store.set(PROGRESS_KEY, all);
}

function planCard(plan, esc, store, openRef) {
  const card = document.createElement('article');
  card.className = 'plan';
  card.innerHTML = `<h3>${esc(plan.title)}</h3>
<p class="plan-blurb">${esc(plan.blurb)}</p>
<div class="plan-meta"><span class="plan-count"></span><span class="plan-started"></span></div>
<div class="plan-bar" role="progressbar" aria-label="${esc(plan.title)} progress"><span class="plan-fill"></span></div>
<div class="plan-actions"><button type="button" class="soft" data-toggle>Show days</button><button type="button" class="soft strong" data-resume>Start</button></div>
<ol class="plan-days list" hidden></ol>`;

  const list = card.querySelector('.plan-days');
  const { done, started } = progressOf(store, plan.id);

  for (const day of plan.days) {
    const li = document.createElement('li');
    li.className = 'row';
    li.innerHTML = `<button type="button" data-open="${esc(day.startRef)}"><span class="ref">${esc(day.startRef)}&ndash;${esc(day.endRef)}</span><span><span class="where">Day ${day.n}: ${esc(day.title)}</span><span class="txt">${day.paragraphs} paragraph${day.paragraphs === 1 ? '' : 's'}</span></span></button>
<input type="checkbox" class="read-toggle tick" data-day="${day.n}" aria-label="Mark day ${day.n} done"${done.has(day.n) ? ' checked' : ''}>`;
    li.querySelector('[data-open]').addEventListener('click', () => openRef(day.startRef));
    li.querySelector('.read-toggle').addEventListener('change', (e) => {
      toggleDay(plan, day.n, e.target.checked, card, store);
    });
    list.appendChild(li);
  }

  const toggleBtn = card.querySelector('[data-toggle]');
  toggleBtn.addEventListener('click', () => {
    const open = list.hidden;
    list.hidden = !open;
    toggleBtn.textContent = open ? 'Hide days' : 'Show days';
  });
  card.querySelector('[data-resume]').addEventListener('click', () => {
    const { done: d2 } = progressOf(store, plan.id);
    const next = plan.days.find((d) => !d2.has(d.n)) || plan.days[plan.days.length - 1];
    openRef(next.startRef);
  });

  paintProgress(card, plan, progressOf(store, plan.id));
  return card;
}

function paintProgress(card, plan, prog) {
  const n = prog.done.size;
  const total = plan.days.length;
  const pct = total ? Math.round((n / total) * 100) : 0;
  card.querySelector('.plan-fill').style.width = `${pct}%`;
  card.querySelector('.plan-count').textContent = `${n} of ${total} days (${pct}%)`;
  card.querySelector('.plan-started').textContent = prog.started ? ` Started ${prog.started}` : '';
  const resume = card.querySelector('[data-resume]');
  if (n === 0) resume.textContent = 'Start';
  else if (n >= total) resume.textContent = 'Read again';
  else resume.textContent = `Resume: day ${plan.days.find((d) => !prog.done.has(d.n)).n}`;
}

function toggleDay(plan, dayN, checked, card, store) {
  const { done, started } = progressOf(store, plan.id);
  if (checked) { done.add(dayN); } else { done.delete(dayN); }
  const s = started || (checked ? new Date().toISOString().slice(0, 10) : null);
  saveProgress(store, plan.id, done, s);
  paintProgress(card, plan, { done, started: s });
}
