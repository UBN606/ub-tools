# UBN Tools for Mac

UBN Tools is UB Tools Studio as a Mac app: Read, Listen, Plans, Quiz, Explore and Tools in their own window, with a Dock icon and the usual Mac menus. It works on Apple silicon and Intel Macs running macOS 13 Ventura or newer.

## For readers

**Easiest way, nothing to install:** open the Studio at <https://ubn606.github.io/ub-tools/app/> and keep it in your Dock. In **Safari** (macOS 14 or newer) choose **File → Add to Dock**; in **Chrome**, click the install icon at the right end of the address bar. It opens like any other app, shows no warning, and updates itself.

**Or download the Mac app:**

1. Download **UBN-Tools-mac.dmg** from the latest *UBN Tools for Mac* release (always at `https://github.com/UBN606/ub-tools/releases/latest/download/UBN-Tools-mac.dmg`) and open it.
2. Drag **UBN Tools** onto the **Applications** folder.
3. Open UBN Tools. The first launch downloads the book's text once from [Urantiapedia](https://urantiapedia.org) (CC BY-SA 4.0). After that, everything works offline.

Until the app is signed with an Apple Developer ID, the first time you open it your Mac says it can't check the app. This is normal: the app is safe, it just isn't registered with Apple yet. Click **Done**, then **Apple menu → System Settings → Privacy & Security**, scroll all the way down, click **Open Anyway** next to UBN Tools, type your Mac password and click **Open**. You only do this once.

When the Mac is online, the Studio inside the app comes straight from the website, so improvements to the Studio reach you the moment they are published, with nothing to download or install. Offline, the app uses the copy built into it. Only a change to the app itself (rare) needs a new download: the app then says so once and offers it. Your reading plans, study list and saved book text are kept when you replace the app.

## How it works

- `main.js` opens one window on the Studio's own web address, `https://ubn606.github.io/ub-tools/app/`. When the Mac is online, every page comes from the live website, so the app shows the newest Studio without a new release. Offline, or when the site does not answer within 5 seconds, every request under `/ub-tools/` is answered from the copy of the Studio bundled in the app (`Contents/Resources/site`). A page's files come from wherever the page came from, so one page is never two versions (`isPageRequest` and `sourceFor` in `lib/site.js`). The app therefore works offline from the first launch, and it keeps the website's origin: reading-plan progress, the cached book text, and the servers that allow the Studio (read-aloud voices, the missed-question logger) behave exactly as on the web.
- Files the app doesn't bundle are fetched from the live site: the 100 MB read-along timings (`audio/aligned/`) and the quote-card PNGs. The book's text is never bundled. As on the web, each reader's copy downloads it from Urantiapedia.
- `preload.js` sets `window.ubDesktop` and nothing else. `app/pwa.js` sees it and skips the service worker and the "Add to Home Screen" nudge. The page has no Node.js access (context isolation and sandbox are on).
- Studio pages open in the window. Web links and email open in the reader's own browser and mail app. Anything else is blocked. `lib/site.js` holds this logic as pure functions, tested in `test/site.test.mjs`.
- Mac details: an Edit menu, so Command-C and Command-V work; a right-click menu with Copy, Paste and Look Up; Back and Forward (Command-[ and Command-], or swipe); Studio Home (Command-Shift-H); zoom; and a remembered window size and position.

## Develop

Needs Node.js 18 or newer.

```bash
cd desktop
npm install
npm start          # runs the app on the repository's own files
npm test           # unit tests, no Electron needed
npm run dist:mac   # on a Mac: stage the files and build dist/UBN-Tools-mac.dmg
```

The artwork is generated, then committed: `python3 scripts/make-icon.py` places the UBN emblem (`build/src/ubn-emblem.png`, cut from the website's `public/images/ubn-logo-mark.png`) on Apple's icon grid as `build/icon-mac.png`, and `python3 scripts/make-dmg-background.py` draws the install window (`build/dmg-background.png` and `@2x`). Once the app is signed with a Developer ID, drop the "Open Anyway" hint line from that script and run it again.

`scripts/stage.mjs` copies the files git tracks (except development-only ones) into `desktop/site/`. `scripts/smoke.mjs <path to the app binary>` launches a built app and checks that the Studio opens from the bundle, that the page has no Node.js, that no service worker registers and that the book loads.

## Release

`.github/workflows/mac-app.yml` builds a universal `.dmg` on a GitHub Mac runner for every change to `desktop/` or the Studio, launches it with the smoke test, and keeps the `.dmg` as a build artifact. To publish a release:

1. Bump `version` in `desktop/package.json` and merge it to `main`.
2. On GitHub, open **Actions → Mac app → Run workflow**, keep the branch on `main`, tick **Publish this build as release…**, and click **Run workflow**. Or push a tag from your computer: `git tag desktop-v1.0.1 && git push origin desktop-v1.0.1`.

The workflow checks that the version hasn't been released already (and, for a pushed tag, that the tag matches the version), builds and smoke-tests the app, and creates the GitHub release with the `.dmg` and install instructions. Releases are tagged `desktop-v…`, so the app's update check ignores any other release in this repository.

**Signing (recommended).** Without Apple secrets, the app is ad-hoc signed and readers see the one-time warning above. To have it open with no warning, add a Developer ID Application certificate and notarization credentials as repository secrets: `MAC_CERT_P12_BASE64`, `MAC_CERT_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID`. They require an Apple Developer Program membership. The next tagged build is then signed, notarized and stapled automatically.
