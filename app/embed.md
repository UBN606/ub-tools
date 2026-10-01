# UB Tools — Daily Quote Widget (`embed-quote.js`)

A zero-dependency, embeddable **quote-of-the-day** widget for any website
(e.g. urantiabooknetwork.com). One script tag, no build step, no network
calls beyond the script tag itself.

## Copy-paste snippet

```html
<div data-ub-quote></div>
<script src="https://ubn606.github.io/ub-tools/app/embed-quote.js"></script>
```

That is the whole integration. On `DOMContentLoaded` the script mounts a
styled quote card into every `[data-ub-quote]` element on the page.

## Options

Per-element theme via the `data-theme` attribute:

```html
<div data-ub-quote data-theme="dark"></div>   <!-- force dark -->
<div data-ub-quote data-theme="light"></div>  <!-- force light -->
<div data-ub-quote></div>                     <!-- auto: follows prefers-color-scheme -->
```

Or mount manually from your own script:

```js
// el: any container element
UBQuoteWidget.mount(el, {
  theme: 'auto',        // 'light' | 'dark' | 'auto'  (default 'auto')
  showCitation: true,   // show "(The Urantia Book, 146:2.12)" + verified link (default true)
  date: '2026-10-01',   // quote for a specific date (default: today)
});

// Deterministic quote for a date — same date -> same quote, everywhere.
var q = UBQuoteWidget.pick('2026-10-01'); // { q, c, t }  (quote, citation, topic)
```

## Theming

All widget CSS is injected by the script in one `<style id="ubq-widget-styles">`
tag; every class is namespaced `.ubq-*`, so nothing leaks into (or inherits
unexpectedly from) the host page. The default look is a serif blockquote with
a gold left rule; `dark` is a warm charcoal card; `auto` follows the visitor's
`prefers-color-scheme`.

## The quote bank

- 60 quotes, 60–160 characters each, sliced **verbatim from the book text**
  across 42 papers and 10 topics (prayer, faith, love, service, courage,
  worship, forgiveness, wisdom, peace, joy — 6 per topic).
- **Every quote is PASS-verified** word-for-word with `ub-verify.js` against
  its own citation before it ships. The card shows the citation
  `(The Urantia Book, 146:2.12)` plus a small "Verified with UB Tools" link.
- Quote of the day is deterministic: `index = days-since-epoch % 60`
  (UTC-based, so every visitor worldwide sees the same quote on a given date).

## Rebuilding the bank

The bank inside `embed-quote.js` is machine-generated — never hand-edit it.
To regenerate (e.g. after the book text updates):

```bash
node app/build-embed-bank.mjs            # target 60 quotes (default)
node app/build-embed-bank.mjs --target=90
node --test app/test/embed.test.mjs      # verify the rebuilt widget
```

The build script slices sentences from `source-texts/papers/`, filters for
short self-contained uplifting sentences, verifies each with the real
`ub-verify.js` CLI (verdict must be PASS), and rewrites only the
`__BANK__` marker region of `embed-quote.js`. The widget code itself is
hand-written and untouched by the build.
