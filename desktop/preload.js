// Tells the Studio it is running inside the Mac app (window.ubDesktop), so it
// skips what only makes sense on the web: the service worker and the
// "Add to Home Screen" nudge. Nothing else is exposed to the page.
'use strict'
const { contextBridge } = require('electron')

const arg = process.argv.find((a) => a.startsWith('--ub-desktop-version='))
contextBridge.exposeInMainWorld('ubDesktop', Object.freeze({
  platform: process.platform,
  version: arg ? arg.slice('--ub-desktop-version='.length) : '',
}))
