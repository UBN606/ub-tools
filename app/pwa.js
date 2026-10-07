// app/pwa.js — PWA behavior for UB Tools Studio.
//
// Three jobs, all gentle (our readers are older; nothing nags):
//   1. Update banner — when a new service worker takes control, show ONE
//      calm banner: "A new version is ready." [Reload] [Later].
//      "Later" means "I'll pick it up next launch" — the new worker is
//      already active, so the next open loads fresh code automatically.
//   2. Install nudge — after a few visits, offer "Add to Home Screen".
//      Dismissed = not asked again for 30 days. iOS gets Share-menu
//      instructions (Safari never fires beforeinstallprompt).
//   3. Offline badge — a small pill while offline: "You're offline. Your
//      saved content still works."
//
// Pure logic is exported for tests (node --test app/test/pwa.test.mjs).
// DOM builders take `doc` so tests can pass a fake document, same pattern
// as a11y.js.

export const UPDATE_SNOOZE_KEY = 'ub-tools-update-snooze'
export const INSTALL_DISMISS_KEY = 'ub-tools-install-dismissed'
export const VISIT_COUNT_KEY = 'ub-tools-visits'

export const UPDATE_CHECK_MINUTES = 30
export const UPDATE_SNOOZE_HOURS = 24
export const INSTALL_MIN_VISITS = 3
export const INSTALL_SNOOZE_DAYS = 30

// ---------- pure logic ----------

// snoozedUntilRaw: raw localStorage value (ms epoch) or null.
export function isSnoozed(snoozedUntilRaw, nowMs) {
  const t = Number(snoozedUntilRaw)
  return Number.isFinite(t) && t > nowMs
}

export function updateSnoozeUntil(nowMs) {
  return nowMs + UPDATE_SNOOZE_HOURS * 60 * 60 * 1000
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

export function isIOS(userAgent) {
  const ua = String(userAgent || '')
  return /iPad|iPhone|iPod/.test(ua) && !/MSStream/.test(ua)
}

// Gate for the install nudge. hasPrompt is whether we hold a
// beforeinstallprompt event (Android/Chrome); iOS never has one and gets
// manual instructions instead, so it doesn't need it.
export function shouldShowInstallPrompt({ visits, dismissedUntilRaw, nowMs, standalone, hasPrompt, ios }) {
  if (standalone) return false
  if (isSnoozed(dismissedUntilRaw, nowMs)) return false
  if (visits < INSTALL_MIN_VISITS) return false
  if (!ios && !hasPrompt) return false
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

// Returns the banner element. Caller appends it and wires onUpdate/onLater.
export function buildUpdateBanner(doc, { onUpdate, onLater }) {
  const bar = makeEl(doc, 'div', 'pwa-banner')
  bar.setAttribute('role', 'status')
  bar.appendChild(makeEl(doc, 'p', 'pwa-banner-text', 'A new version of UB Tools is ready.'))
  const actions = makeEl(doc, 'div', 'pwa-banner-actions')
  const update = makeEl(doc, 'button', 'pwa-btn pwa-btn-primary', 'Reload')
  update.type = 'button'
  update.addEventListener('click', onUpdate)
  const later = makeEl(doc, 'button', 'pwa-btn', 'Later')
  later.type = 'button'
  later.addEventListener('click', onLater)
  actions.appendChild(update)
  actions.appendChild(later)
  bar.appendChild(actions)
  return bar
}

// ios=true -> Share-menu instructions instead of the native prompt button.
export function buildInstallBanner(doc, { ios, onInstall, onDismiss }) {
  const bar = makeEl(doc, 'div', 'pwa-banner')
  bar.setAttribute('role', 'status')
  const text = ios
    ? 'Add UB Tools to your Home Screen for quick access: tap Share, then “Add to Home Screen.”'
    : 'Add UB Tools to your Home Screen for quick access.'
  bar.appendChild(makeEl(doc, 'p', 'pwa-banner-text', text))
  const actions = makeEl(doc, 'div', 'pwa-banner-actions')
  const go = makeEl(doc, 'button', 'pwa-btn pwa-btn-primary', ios ? 'Got it' : 'Add to Home Screen')
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

  const nowMs = () => Date.now()
  const hadController = Boolean(nav.serviceWorker.controller)

  // ---- visits (for the install nudge) ----
  const visits = nextVisitCount(safeGet(store, VISIT_COUNT_KEY))
  safeSet(store, VISIT_COUNT_KEY, String(visits))

  const standalone = isStandaloneDisplay({
    matchMediaStandalone: Boolean(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches),
    navigatorStandalone: nav.standalone === true,
  })
  const ios = isIOS(nav.userAgent || '')

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

  // ---- update banner ----
  let bannerShown = false
  let firstInstall = !hadController
  nav.serviceWorker.addEventListener('controllerchange', () => {
    if (firstInstall) { firstInstall = false; return } // nothing to update from
    if (bannerShown) return
    if (isSnoozed(safeGet(store, UPDATE_SNOOZE_KEY), nowMs())) return
    bannerShown = true
    const bar = buildUpdateBanner(document, {
      onUpdate: () => { window.location.reload() },
      // "Later" = pick it up next launch. The new worker is already active,
      // so the next open loads fresh code with no further prompting.
      onLater: () => {
        safeSet(store, UPDATE_SNOOZE_KEY, String(updateSnoozeUntil(nowMs())))
        bar.remove()
      },
    })
    document.body.appendChild(bar)
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
    })
    if (!ok) return
    installShown = true
    const bar = buildInstallBanner(document, {
      ios,
      onInstall: () => {
        // Native prompt where we have one; iOS "Got it" just acknowledges.
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
  // iOS never fires beforeinstallprompt; check on load instead.
  maybeShowInstall()

  // ---- offline badge ----
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
