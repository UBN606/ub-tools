/**
 * UB Quote Verifier — background service worker (Manifest V3).
 * Registers the "Verify UB quote" context-menu item and hands the selected
 * text to the popup.
 */
importScripts('js/ext.js');

UBExt.onInstalled(() => {
  UBExt.createContextMenu({
    id: 'verify-ub-quote',
    title: 'Verify UB quote',
    contexts: ['selection'],
  }).catch((e) => console.error('UB Quote Verifier: menu creation failed', e));
});

UBExt.onMenuClicked(async (info) => {
  if (info.menuItemId !== 'verify-ub-quote') return;
  try {
    await UBExt.storageSet({ ubqPendingSelection: info.selectionText || '' });
  } catch (e) { console.error('UB Quote Verifier: could not stash selection', e); }
  // Best effort: pop the checker open right away. Where the browser refuses
  // (some Firefox builds), the user opens it from the toolbar — the pending
  // selection is still waiting there.
  try { await UBExt.openPopup(); } catch (e) { /* toolbar fallback */ }
});
