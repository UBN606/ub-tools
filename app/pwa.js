// app/pwa.js — PWA behavior for UB Tools Studio.
//
// Three jobs, all gentle (our readers are older; nothing nags):
//   1. Updates apply themselves. A new service worker takes control in the
//      background; the page then reloads onto the new version at a moment
//      the reader won't notice: right away if they just opened it and have
//      not touched anything yet, otherwise the next time they switch away.
//      No banner, no button: a reader never has to do anything to update.
//   2. Install nudge — after a few visits, offer "Add to Home Screen".
//      Dismissed = not asked again for 30 days. iOS gets Share-menu
//      instructions (Safari never fires beforeinstallprompt).
//   3. Offline badge — a small pill while offline: "You're offline. Your
//      saved content still works."
//
// Pure logic is exported for tests (node --test app/test/pwa.test.mjs).
// DOM builders take `doc` so tests can pass a fake document, same pattern
// as a11y.js.

export const INSTALL_DISMISS_KEY = 'ub-tools-install-dismissed'
export const VISIT_COUNT_KEY = 'ub-tools-visits'

export const UPDATE_CHECK_MINUTES = 30
// A new version that arrives this soon after opening, before the reader has
// touched anything, reloads at once (the page has barely been seen).
export const UPDATE_RELOAD_WINDOW_SECONDS = 30
export const INSTALL_MIN_VISITS = 3
export const INSTALL_SNOOZE_DAYS = 30

// ---------- pure logic ----------

// snoozedUntilRaw: raw localStorage value (ms epoch) or null.
export function isSnoozed(snoozedUntilRaw, nowMs) {
  const t = Number(snoozedUntilRaw)
  return Number.isFinite(t) && t > nowMs
}

// What to do once a new version has taken control of the page:
//   'reload'      — now: nobody is looking, or the reader just opened it and
//                   has not started reading, tapping or typing yet
//   'when-hidden' — wait, and reload the next time the page is hidden
//                   (another app or tab, the screen locked), so nothing
//                   changes under the reader's eyes or loses what they typed
export function updateAction({ hidden, interacted, secondsSinceOpen }) {
  if (hidden) return 'reload'
  if (!interacted && secondsSinceOpen <= UPDATE_RELOAD_WINDOW_SECONDS) return 'reload'
  return 'when-hidden'
}

export function installDismissUntil(nowMs) {
  return nowMs + INSTALL_SNOOZE_DAYS * 24 * 60 * 60 * 1000
}

// Raw visit count -> next count. Never NaN, never negative.
export function nextVisitCount(raw) {
  const n = Number(raw)
  return (Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0) + 1
}

export function isStandaloneDisplay({ matchMediaStandalone = false, navigatorStandalone = false } = {}) {
  return Boolean(matchMediaStandalone || navigatorStandalone)
}

// The Mac app (desktop/) sets window.ubDesktop. It ships the Studio's files
// itself and has its own update notice, so the service worker and the
// "Add to Home Screen" nudge are skipped there; the offline badge stays.
export function isDesktopApp(win) {
  return Boolean(win && win.ubDesktop)
}

// maxTouchPoints: since iPadOS 13, Safari on an iPad reports a Mac user agent;
// a touch screen is how to tell it apart (no Mac has one).
export function isIOS(userAgent, maxTouchPoints = 0) {
  const ua = String(userAgent || '')
  if (/iPad|iPhone|iPod/.test(ua) && !/MSStream/.test(ua)) return true
  return /Macintosh/.test(ua) && maxTouchPoints > 1
}

// Safari on a Mac. From macOS 14 Sonoma it can keep a site in the Dock as its own
// app (File > Add to Dock), but it never offers that itself (no beforeinstallprompt),
// so the nudge shows the menu steps. Other Mac browsers say so in their user agent.
// True when the page's query string asks for the install steps: ?dock or ?dock=1.
export function installRequested(search) {
  try { return new URLSearchParams(String(search || '')).has('dock') } catch { return false }
}

export function isMacSafari(userAgent, maxTouchPoints = 0) {
  const ua = String(userAgent || '')
  if (!/Macintosh/.test(ua) || maxTouchPoints > 1) return false
  return /Version\/[\d.]+.*Safari\//.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/.test(ua)
}

// Gate for the install nudge. hasPrompt is whether we hold a
// beforeinstallprompt event (Android/Chrome); iOS and Mac Safari never have
// one and get manual instructions instead, so they don't need it.
// requested: the reader followed a link that asks for the install steps (?dock),
// e.g. "open UBN Tools in Safari" on the apps page, so show them on the first visit.
export function shouldShowInstallPrompt({ visits, dismissedUntilRaw, nowMs, standalone, hasPrompt, ios, macSafari = false, requested = false }) {
  if (standalone) return false
  if (!requested && isSnoozed(dismissedUntilRaw, nowMs)) return false
  if (!requested && visits < INSTALL_MIN_VISITS) return false
  if (!ios && !macSafari && !hasPrompt) return false
  return true
}

// ---------- tiny storage helpers (private-mode safe) ----------

function safeGet(store, key) {
  try { return store.getItem(key) } catch { return null }
}

function safeSet(store, key, value) {
  try { store.setItem(key, value) } catch { /* private mode: skip */ }
}

// ---------- DOM builders ----------

function makeEl(doc, tag, cls, text) {
  const e = doc.createElement(tag)
  if (cls) e.className = cls
  if (text != null) e.textContent = text
  return e
}

// ios=true -> Share-menu instructions; macSafari=true -> File-menu (Add to Dock)
// instructions; otherwise the native prompt button.
export function buildInstallBanner(doc, { ios, macSafari = false, onInstall, onDismiss }) {
  const bar = makeEl(doc, 'div', 'pwa-banner')
  bar.setAttribute('role', 'status')
  const text = ios
    ? 'Add UBN Tools to your Home Screen for quick access: tap Share, then “Add to Home Screen.”'
    : macSafari
      ? 'Keep UBN Tools in your Dock as its own app: in Safari, choose File, then “Add to Dock” (macOS 14 or newer).'
      : 'Add UBN Tools to your Home Screen for quick access.'
  bar.appendChild(makeEl(doc, 'p', 'pwa-banner-text', text))
  const actions = makeEl(doc, 'div', 'pwa-banner-actions')
  const go = makeEl(doc, 'button', 'pwa-btn pwa-btn-primary', ios || macSafari ? 'Got it' : 'Add to Home Screen')
  go.type = 'button'
  go.addEventListener('click', onInstall)
  const no = makeEl(doc, 'button', 'pwa-btn', 'Not now')
  no.type = 'button'
  no.addEventListener('click', onDismiss)
  actions.appendChild(go)
  actions.appendChild(no)
  bar.appendChild(actions)
  return bar
}

// Online pill. Pass online=false to show the offline state, true for the
// brief "Back online" confirmation. Caller removes the element when done.
export function buildOnlineBadge(doc, online) {
  const badge = makeEl(doc, 'div', 'pwa-online-badge')
  badge.setAttribute('role', 'status')
  badge.textContent = online ? 'Back online.' : 'You’re offline. Your saved content still works.'
  if (online) badge.classList.add('is-back')
  return badge
}

// ---------- orchestration ----------

export function initPWA() {
  // Production entry point; uses globals like the rest of app.js.
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const nav = window.navigator
  const store = window.localStorage
  if (!('serviceWorker' in nav)) return
  if (!window.location.protocol.startsWith('http')) return // no SW on file://
  if (!isDesktopApp(window)) initWebOnly(window, document, nav, store)
  initOfflineBadge(window, document, nav)
}

// Service worker, self-applying updates and install nudge: the website only.
function initWebOnly(window, document, nav, store) {
  const nowMs = () => Date.now()
  const openedAt = nowMs()
  const hadController = Boolean(nav.serviceWorker.controller)
  // Any tap, click or key press means the reader has started; an update then waits.
  let interacted = false
  for (const type of ['pointerdown', 'keydown', 'touchstart']) {
    window.addEventListener(type, () => { interacted = true }, { capture: true, passive: true, once: true })
  }

  // ---- visits (for the install nudge) ----
  const visits = nextVisitCount(safeGet(store, VISIT_COUNT_KEY))
  safeSet(store, VISIT_COUNT_KEY, String(visits))

  const standalone = isStandaloneDisplay({
    matchMediaStandalone: Boolean(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches),
    navigatorStandalone: nav.standalone === true,
  })
  const ios = isIOS(nav.userAgent || '', nav.maxTouchPoints || 0)
  const macSafari = isMacSafari(nav.userAgent || '', nav.maxTouchPoints || 0)

  // ---- service worker registration + update checks ----
  // updateViaCache: 'none' is the important bit: without it the browser may
  // serve sw.js from HTTP cache for up to 24h and never notice a new version.
  nav.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then((reg) => {
    const check = () => { try { reg.update() } catch { /* ignore */ } }
    check() // whenever the app opens
    window.setInterval(check, UPDATE_CHECK_MINUTES * 60 * 1000)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check()
    })
  }).catch(() => { /* offline first run: fine, page still works */ })

  // ---- updates apply themselves ----
  let firstInstall = !hadController
  let reloading = false
  const reload = () => { if (!reloading) { reloading = true; window.location.reload() } }
  nav.serviceWorker.addEventListener('controllerchange', () => {
    if (firstInstall) { firstInstall = false; return } // nothing to update from
    const action = updateAction({
      hidden: document.visibilityState === 'hidden',
      interacted,
      secondsSinceOpen: (nowMs() - openedAt) / 1000,
    })
    if (action === 'reload') return reload()
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') reload()
    })
  })

  // ---- install nudge ----
  let deferredPrompt = null
  let installShown = false
  const dismissInstall = (bar) => {
    safeSet(store, INSTALL_DISMISS_KEY, String(installDismissUntil(nowMs())))
    if (bar) bar.remove()
  }
  const maybeShowInstall = () => {
    if (installShown) return
    const ok = shouldShowInstallPrompt({
      visits,
      dismissedUntilRaw: safeGet(store, INSTALL_DISMISS_KEY),
      nowMs: nowMs(),
      standalone,
      hasPrompt: Boolean(deferredPrompt),
      ios,
      macSafari,
      requested: installRequested(window.location.search),
    })
    if (!ok) return
    installShown = true
    const bar = buildInstallBanner(document, {
      ios,
      macSafari,
      onInstall: () => {
        // Native prompt where we have one; "Got it" (iOS, Mac Safari) just acknowledges.
        if (deferredPrompt) {
          try { deferredPrompt.prompt() } catch { /* ignore */ }
          deferredPrompt = null
        }
        dismissInstall(bar)
      },
      onDismiss: () => dismissInstall(bar),
    })
    document.body.appendChild(bar)
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e
    maybeShowInstall()
  })
  // iOS and Mac Safari never fire beforeinstallprompt; check on load instead.
  maybeShowInstall()
}

function initOfflineBadge(window, document, nav) {
  let badge = null
  let badgeTimer = 0
  const clearBadge = () => {
    if (badge) { badge.remove(); badge = null }
    if (badgeTimer) { window.clearTimeout(badgeTimer); badgeTimer = 0 }
  }
  const showOffline = () => {
    clearBadge()
    badge = buildOnlineBadge(document, false)
    document.body.appendChild(badge)
  }
  const showBackOnline = () => {
    clearBadge()
    badge = buildOnlineBadge(document, true)
    document.body.appendChild(badge)
    badgeTimer = window.setTimeout(clearBadge, 2500)
  }
  let wasOffline = nav.onLine === false
  window.addEventListener('offline', () => { wasOffline = true; showOffline() })
  window.addEventListener('online', () => {
    if (wasOffline) { wasOffline = false; showBackOnline() }
    else clearBadge()
  })
  if (wasOffline) showOffline()
}
