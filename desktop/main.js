// UB Tools for Mac — the main process.
//
// One window showing UB Tools Studio. The Studio's files ship inside the app
// (Contents/Resources/site) and are served at the Studio's own web address, so
// the app works offline from the first launch and behaves exactly like the
// website. See lib/site.js for the why. Links that leave the Studio open in the
// reader's own browser or mail app; nothing else is sent anywhere.
'use strict'

const { app, BrowserWindow, Menu, clipboard, dialog, nativeTheme, net, protocol, screen, session, shell } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const { Readable } = require('node:stream')
const site = require('./lib/site')

// Packaged: the copy staged by scripts/stage.mjs. `npm start`: the repository itself.
const SITE_DIR = process.env.UB_SITE_DIR
  ? path.resolve(process.env.UB_SITE_DIR)
  : app.isPackaged ? path.join(process.resourcesPath, 'site') : path.resolve(__dirname, '..')
// Tests run with a throwaway profile so they never touch a reader's data.
if (process.env.UB_USER_DATA) app.setPath('userData', path.resolve(process.env.UB_USER_DATA))
const STATE_FILE = () => path.join(app.getPath('userData'), 'window-state.json')
const UPDATE_EVERY_MS = 24 * 60 * 60 * 1000

let win = null

// ---------- small saved state (window size, a skipped update) ----------

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE(), 'utf8')) || {} } catch { return {} }
}

function writeState(patch) {
  try {
    const next = { ...readState(), ...patch }
    fs.mkdirSync(path.dirname(STATE_FILE()), { recursive: true })
    fs.writeFileSync(STATE_FILE(), JSON.stringify(next, null, 2))
  } catch { /* a read-only disk never stops the app */ }
}

// ---------- the Studio's files, served at its web address ----------

async function serve(request) {
  if (request.method === 'GET' || request.method === 'HEAD') {
    const file = site.localPath(SITE_DIR, request.url)
    if (file) {
      const st = await fs.promises.stat(file).catch(() => null)
      if (st && st.isDirectory()) {
        // Same as the website: /ub-tools/app -> /ub-tools/app/
        const u = new URL(request.url)
        u.pathname += '/'
        return new Response(null, { status: 301, headers: { location: u.href } })
      }
      if (st && st.isFile()) {
        const headers = { 'content-type': site.contentType(file), 'content-length': String(st.size), 'cache-control': 'no-cache' }
        if (request.method === 'HEAD') return new Response(null, { status: 200, headers })
        return new Response(Readable.toWeb(fs.createReadStream(file)), { status: 200, headers })
      }
    }
  }
  // Not bundled (the book text, read-aloud voices, read-along timings...): the network, as on the web.
  return net.fetch(request, { bypassCustomProtocolHandlers: true })
}

// ---------- the window ----------

function openExternal(url) {
  if (site.linkAction(url) === 'external') shell.openExternal(url).catch(() => {})
}

function goHome() {
  if (win) win.loadURL(site.START_URL)
}

function createWindow() {
  const state = readState()
  const displays = screen.getAllDisplays().map((d) => d.workArea)
  win = new BrowserWindow({
    ...site.restoreBounds(state.bounds, displays),
    minWidth: 420,
    minHeight: 480,
    title: 'UB Tools',
    show: false,
    // The Studio's own page colors, so there is no white flash before it paints.
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1d1a13' : '#faf7ef',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      additionalArguments: [`--ub-desktop-version=${app.getVersion()}`],
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  })
  if (state.maximized) win.maximize()
  win.once('ready-to-show', () => win.show())

  const contents = win.webContents
  // Studio pages stay in the window; web links and email go to the reader's own apps.
  contents.setWindowOpenHandler(({ url }) => {
    const action = site.linkAction(url)
    if (action === 'internal') contents.loadURL(url)
    else if (action === 'external') openExternal(url)
    return { action: 'deny' }
  })
  contents.on('will-navigate', (event, url) => {
    if (site.linkAction(url) === 'internal') return
    event.preventDefault()
    openExternal(url)
  })
  contents.on('context-menu', (_e, params) => showContextMenu(contents, params))
  // Two-finger swipe (when "Swipe between pages" is on) goes back and forward like Safari.
  win.on('swipe', (_e, direction) => {
    const h = contents.navigationHistory
    if (direction === 'left' && h.canGoBack()) h.goBack()
    if (direction === 'right' && h.canGoForward()) h.goForward()
  })
  win.on('close', () => {
    writeState({ bounds: win.getNormalBounds(), maximized: win.isMaximized() })
  })
  win.on('closed', () => { win = null })

  win.loadURL(site.START_URL)
}

// Right-click: the copy/paste menu every Mac reader expects (Electron has none by default).
function showContextMenu(contents, params) {
  const items = []
  for (const word of params.dictionarySuggestions || []) {
    items.push({ label: word, click: () => contents.replaceMisspelling(word) })
  }
  if (params.misspelledWord) {
    if (!items.length) items.push({ label: 'No Guesses Found', enabled: false })
    items.push({ type: 'separator' })
  }
  if (params.selectionText && params.selectionText.trim()) {
    const term = params.selectionText.trim().slice(0, 60)
    items.push({ label: `Look Up “${term.length > 30 ? term.slice(0, 30) + '…' : term}”`, click: () => contents.showDefinitionForSelection() })
    items.push({ type: 'separator' })
  }
  if (params.linkURL && site.linkAction(params.linkURL) !== 'block') {
    items.push({ label: 'Open Link in Browser', click: () => shell.openExternal(params.linkURL).catch(() => {}) })
    items.push({ label: 'Copy Link', click: () => clipboard.writeText(params.linkURL) })
    items.push({ type: 'separator' })
  }
  const f = params.editFlags
  if (params.isEditable) items.push({ role: 'cut', enabled: f.canCut })
  items.push({ role: 'copy', enabled: f.canCopy })
  if (params.isEditable) items.push({ role: 'paste', enabled: f.canPaste })
  items.push({ role: 'selectAll' })
  Menu.buildFromTemplate(items).popup({ window: win })
}

// ---------- the menu bar ----------

function buildMenu() {
  const nav = (fn) => () => { if (win) fn(win.webContents.navigationHistory) }
  const template = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { label: 'Check for Updates…', click: () => checkForUpdates({ manual: true }) },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { label: 'Back', accelerator: 'Command+[', click: nav((h) => h.canGoBack() && h.goBack()) },
        { label: 'Forward', accelerator: 'Command+]', click: nav((h) => h.canGoForward() && h.goForward()) },
        { label: 'Studio Home', accelerator: 'Command+Shift+H', click: goHome },
        { type: 'separator' },
        { role: 'reload' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Actual Size' },
        { role: 'zoomIn', label: 'Zoom In' },
        { role: 'zoomOut', label: 'Zoom Out' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(app.isPackaged ? [] : [{ role: 'toggleDevTools' }]),
      ],
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        { label: 'Urantia Book Network', click: () => openExternal('https://urantiabooknetwork.com') },
        { label: 'Open UB Tools in Your Browser', click: () => openExternal(site.START_URL) },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ---------- updates: a polite notice, never a forced download ----------
// Without a paid Apple certificate the app cannot replace itself, so it only
// says when a newer version is published and offers the download.

async function checkForUpdates({ manual = false } = {}) {
  let latest = null
  try {
    const res = await net.fetch(site.RELEASES_API, { headers: { accept: 'application/vnd.github+json' } })
    if (res.ok) latest = site.latestDesktopRelease(await res.json())
  } catch { /* offline: try again tomorrow */ }

  const current = app.getVersion()
  const ask = (opts) => (win ? dialog.showMessageBox(win, opts) : dialog.showMessageBox(opts))
  if (!latest || !site.isNewer(latest.tag, current)) {
    if (manual) {
      await ask({
        type: 'info',
        message: latest ? 'UB Tools is up to date.' : 'Couldn’t check for updates.',
        detail: latest ? `You have version ${current}, the newest one.` : 'Check your internet connection and try again.',
        buttons: ['OK'],
      })
    }
    return
  }
  const newest = latest.version.join('.')
  if (!manual && readState().skipVersion === newest) return
  const { response } = await ask({
    type: 'info',
    message: `A new version of UB Tools is ready: ${newest}`,
    detail: `You have version ${current}. Download the new one, open it, and drag UB Tools into your Applications folder to replace this copy. Your reading plans and saved book text are kept.`,
    buttons: ['Download', 'Later', 'Skip This Version'],
    defaultId: 0,
    cancelId: 1,
  })
  if (response === 0) shell.openExternal(latest.dmg || latest.url).catch(() => {})
  if (response === 2) writeState({ skipVersion: newest })
}

// ---------- start ----------

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!win) return createWindow()
    if (win.isMinimized()) win.restore()
    win.focus()
  })

  app.setAboutPanelOptions({
    applicationName: 'UB Tools',
    applicationVersion: app.getVersion(),
    copyright: 'Made by the Urantia Book Network.',
    credits: 'Book text and topic index from Urantiapedia (urantiapedia.org), CC BY-SA 4.0, downloaded once and kept on this Mac.',
    website: 'https://urantiabooknetwork.com',
  })

  app.whenReady().then(() => {
    protocol.handle('https', serve)
    // Only what the Studio uses: copying text, and full screen.
    session.defaultSession.setPermissionRequestHandler((wc, permission, done) => {
      done(site.isSiteUrl(wc.getURL()) && ['clipboard-sanitized-write', 'fullscreen'].includes(permission))
    })
    buildMenu()
    createWindow()
    setTimeout(() => checkForUpdates(), 15 * 1000)
    setInterval(() => checkForUpdates(), UPDATE_EVERY_MS)
  })

  app.on('activate', () => { if (!win) createWindow() })
  // A Mac app stays running with no windows; anywhere else, closing the window quits.
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
}
