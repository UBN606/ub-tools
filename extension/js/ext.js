/**
 * UBExt — tiny cross-browser shim (Chrome / Edge / Firefox, Manifest V3).
 * Exposes promise-based helpers over whichever extension namespace exists.
 * Loaded by background.js and popup.js (plain <script>, no modules — MV3
 * service workers support importScripts, popups support classic scripts).
 */
(function (root) {
  'use strict';
  const ns = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

  // Wrap a callback-style or promise-style extension API call in a promise.
  function call(fn, ...args) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const done = (v) => { if (!settled) { settled = true; resolve(v); } };
      const fail = (e) => { if (!settled) { settled = true; reject(e instanceof Error ? e : new Error(String(e))); } };
      try {
        const r = fn(...args, (res) => {
          const err = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) || null;
          if (err) fail(new Error(err.message));
          else done(res);
        });
        if (r && typeof r.then === 'function') r.then(done, fail);
      } catch (e) { fail(e); }
    });
  }

  async function storageGet(keys) {
    const area = ns.storage && ns.storage.session ? ns.storage.session : ns.storage.local;
    return call(area.get.bind(area), keys);
  }
  async function storageSet(obj) {
    const area = ns.storage && ns.storage.session ? ns.storage.session : ns.storage.local;
    return call(area.set.bind(area), obj);
  }
  async function openPopup() {
    const action = ns.action || ns.browserAction;
    if (!action || !action.openPopup) throw new Error('openPopup not available');
    return call(action.openPopup.bind(action));
  }
  async function createContextMenu(props) {
    return call(ns.contextMenus.create.bind(ns.contextMenus), props);
  }
  function onInstalled(fn) { ns.runtime.onInstalled.addListener(fn); }
  function onMenuClicked(fn) { ns.contextMenus.onClicked.addListener(fn); }

  async function activeTabSelection() {
    const tabs = await call(ns.tabs.query.bind(ns.tabs), { active: true, currentWindow: true });
    const tab = tabs && tabs[0];
    if (!tab || tab.id == null) return '';
    const res = await call(ns.scripting.executeScript.bind(ns.scripting), {
      target: { tabId: tab.id },
      func: () => (window.getSelection ? window.getSelection().toString() : ''),
    });
    return (res && res[0] && res[0].result) || '';
  }

  root.UBExt = { call, storageGet, storageSet, openPopup, createContextMenu, onInstalled, onMenuClicked, activeTabSelection };
})(typeof globalThis !== 'undefined' ? globalThis : this);
