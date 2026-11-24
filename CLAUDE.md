# CLAUDE.md: notes for working on Pocketknife

Pocketknife is an installable, offline-first PWA: 18 small browser tools (hashing, encoding, generators, converters, text utilities). Plain HTML/CSS/JS with **no build step, no framework and no npm dependencies at runtime**. It's hosted on GitHub Pages from `main`: https://benilraj06.github.io/cc_testing/

Read this before changing anything. The "Lessons learned" section records real bugs from this project's history.

## Golden rules

1. **Everything must work offline and locally.** No CDN scripts, web fonts, analytics or network APIs. If a tool needs a library, vendor it into `js/vendor/` (check the licence; keep its header) and add it to `sw.js`.
2. **Every release bumps the version** in two places that must match: `VERSION` in `sw.js` and every `?v=N` in `index.html`. Use the `sed` one-liner under Release process.
3. **A new tool touches exactly three places:** a new `js/apps/<id>.js`, a `<script>` tag in `index.html`, and `APP_FILES` in `sw.js`. The test fails if they disagree.
4. **Run `node tests/smoke.js` before every commit.** It must pass 100%.
5. **Look at screenshots** (`node tests/smoke.js --shots`, then read `tests/output/*.png`) for any visual change, on a phone width and in dark mode. Several bugs here were only visible in screenshots.
6. **Wrap `localStorage` in try/catch.** It can throw (private mode, blocked storage). The page must still work, with preferences lasting only for the session.
7. The user has asked for **direct pushes to `main`** (which deploys) as well as the dev branch named in the session's instructions. Commit messages end with the attribution lines the session specifies.

## Architecture

```
index.html   Shell only: SVG icon sprite (<symbol id="i-...">), top bar, sidebar
             containers, home page containers, install popup, <script> list.
             A tiny inline <head> script applies the saved theme before paint.
js/core.js   window.PK: the registry (PK.register, PK.apps, PK.CATEGORIES) and helpers.
js/apps/*.js One file per tool; each calls PK.register({...}) at load time.
js/main.js   MUST load last. Builds the sidebar, home tiles and tool <section>s from
             PK.apps, calls each tool's init(), then runs hash routing, search, stars,
             recent tools, collapsible groups, the theme switch, service worker
             registration and the install popup.
css/style.css  All styles. Design tokens in :root; dark tokens under
             [data-theme="dark"] plus a prefers-color-scheme fallback.
sw.js        Network-first service worker with an offline fallback.
tests/smoke.js Self-contained Playwright test (serves the repo itself).
```

Routing is hash-based: `#home`, `#md5`, `#qr`… Each tool is a `<section class="app" data-app="<id>">`, and only one is visible at a time.

## Adding a tool: checklist

1. **Pick an id**: short, lowercase, URL-safe (`base64`, `numbase`). It becomes `#id`, the file name and an element-id prefix.
2. **Create `js/apps/<id>.js`.** Start from the closest existing tool:
   - text in → one output: `md5.js`, `base64.js`
   - several outputs with copy buttons: `sha.js`, `case.js`, `timestamp.js`
   - options and a Generate button: `password.js`, `uuid.js`, `lorem.js`
   - two inputs side by side: `diff.js`, `regex.js` (use `wide: true`)
   - file input: `md5.js`, `hex.js`
3. **Register it**:
   ```js
   PK.register({
     id: 'mytool',
     title: 'My Tool',                    // sidebar, tile, page <h1>, tab title
     desc: 'One sentence, ends with a period.',  // tile + page subtitle
     icon: 'i-mytool',                    // <symbol> id in index.html
     category: 'Text',                    // one of PK.CATEGORIES (see below)
     keywords: 'extra search words',      // optional, for home search
     wide: false,                         // optional: wider page (1040px vs 760px)
     html: `...`,                         // page body (the title/desc header is added for you)
     init(root, $) { ... },               // root = this tool's <section>; $ = root.querySelector
     onShow() { ... },                    // optional: runs each time the tool is opened
   });
   ```
   `PK.CATEGORIES` = `'Hash & Encode'`, `'Generate'`, `'Convert & Format'`, `'Text'`. To add a category, edit the array in `js/core.js`. Order there sets sidebar and home order; within a category, tools appear in `<script>` order.
4. **Add an icon**: a `<symbol id="i-mytool" viewBox="0 0 24 24">` in the sprite in `index.html`. It's a stroke-only line icon on a 24×24 grid (CSS applies `stroke: currentColor; fill: none; stroke-width: 1.8`). Reuse an existing icon if it fits.
5. **Add `<script src="js/apps/mytool.js?v=N"></script>`** to `index.html` in its category block, before `js/main.js`.
6. **Add `'mytool'` to `APP_FILES`** in `sw.js`.
7. **Bump the version** (Release process below).
8. **Test**: `node tests/smoke.js`, then check its behaviour (compare outputs with a reference such as Node's `crypto`, `Buffer`, `URL`), then `--shots` and look at the phone (390px) and dark screenshots.
9. **Update `README.md`**: the tool table and the tool count ("18 tools") in its first line.

### Conventions inside a tool

- **Element ids are global**, so prefix them with the tool id (`md5Input`, `qrCanvas`). Query them with the scoped `$` from `init`, not `document`.
- **Live output**: update on `input` events. Use `PK.debounce(fn, 120)` for heavy work (JSON, diff, regex, QR).
- **Errors**: show them in a `.status` line with `PK.setStatus(el, msg, true)` and add class `invalid` to the bad input. Never use `alert()`.
- **Randomness for anything security-related**: `PK.randomInt(n)` (crypto, rejection-sampled). `Math.random` is only for cosmetic things like Lorem Ipsum.
- **Never inject user text as HTML.** Use `textContent`, or `PK.escapeHTML()` when building markup.
- **Large inputs**: cap work so the page stays responsive (see `MAX_CELLS` in `diff.js`, `LIMIT` in `hex.js`, `MAX_MATCHES` in `regex.js`).
- **Timers** (like `timestamp.js`'s clock) should skip work while `root.hidden` is true.

### Helpers in `PK` (js/core.js)

| Helper | Use |
|---|---|
| `PK.icon(id, cls?)` | `<svg>` markup for a sprite icon |
| `PK.copyButton(label?)` | Copy pill markup (`data-copy`); wire it with `setupCopy` |
| `PK.setupCopy(btn, getText)` | Copies `getText()`; shows "Copied ✓"; has a fallback for old browsers |
| `PK.dropzone(id)` | Drag-and-drop file zone markup with `<input type=file id=id>` |
| `PK.setupDropzone(input)` | Wires it up; returns `{ clear() }` |
| `PK.resultCard(id, label)` | Card with label, copy button, `<output id=id class=mono>` and `<p id="{id}Status">`; label element is `#{id}Label` |
| `PK.setStatus(el, text, isError?)` | Status line text; red when it's an error |
| `PK.escapeHTML(s)`, `PK.formatBytes(n)`, `PK.relativeTime(date)` | Formatting |
| `PK.randomInt(max)` | Secure random integer in [0, max) |
| `PK.debounce(fn, ms)`, `PK.download(filename, href)`, `PK.copyText(text)` | Utilities |

### CSS building blocks (css/style.css)

- Layout: `.card`, `.card-title`, `.two-col` (stacks on phones), `.row` + `.field` (label over control), `.btn-row`
- Controls: `textarea`, `.input` (text/number/select), `.mono-in` (monospace input), `.checks` + `.check` (pill checkboxes), `.segmented` (radio tabs; see `base64.js`), `input[type=range]`, `.btn .btn-primary|.btn-ghost .btn-sm`
- Labels and status: `.field-label` (+ `.val` for a right-aligned value), `.status` (`.error`), `.muted`, `.badge .ok|.bad|.warn`
- Output: `.mono` (+ `.pre` no-wrap with horizontal scroll, `.tall`), `.big-out`, `.out-list` + `.out-row` (name · value · copy rows), `.stats` + `.stat`, `.kv` table, `.meter`
- Colours: always use tokens (`var(--text)`, `--muted`, `--surface`, `--surface-2`, `--border`, `--accent`, `--accent-text`, `--success`, `--danger`, `--warn-text`, `--star`). Never hard-code colours that must change in dark mode. If a dark variant is needed, add a token to **both** dark blocks at the top of the file.
- Per-tool styles go in the "App-specific" section of `style.css`.

## Release process

1. Bump the version (replace 13/14 with the current/next numbers):
   ```bash
   sed -i 's/?v=13/?v=14/g' index.html && sed -i 's/const VERSION = 13;/const VERSION = 14;/' sw.js
   ```
2. `node tests/smoke.js`: all checks must pass.
3. Commit, then push to the dev branch and to `main` (`git push origin HEAD:main`). Pages deploys in a minute or two.

## State and storage (localStorage keys)

| Key | Value |
|---|---|
| `pk.starred` | array of tool ids, in starring order |
| `pk.recent` | array of up to 6 tool ids, most recent first |
| `pk.collapsed` | array of group keys like `"nav:Generate"`, `"home:Recent"` |
| `pk.theme` | `"light"` or `"dark"`; absent means follow the system |
| `installDismissedAt` | timestamp; install popup is snoozed for 14 days |

## Lessons learned (real bugs from this project's history)

- **`[hidden]` vs `display`:** a class with `display: flex` overrides the `hidden` attribute, so hidden sections stayed visible. The global rule `[hidden] { display: none !important; }` fixes it; keep it.
- **Lost service worker registration:** rewriting `index.html` once dropped the `serviceWorker.register` call, silently disabling offline support for several releases. Registration now lives in `js/main.js`. If you restructure the page, keep it.
- **Stale caches broke the phone UI:** the original cache-first service worker, plus GitHub Pages' 10-minute HTTP cache, gave installed phones new HTML with old CSS (unstyled popup, giant icons) until the next release. Fixes that must stay:
  - `sw.js` is network-first, fetches with `cache: 'no-cache'`, and precaches with `cache: 'reload'`
  - on upgrade it reloads open pages
  - every asset URL carries `?v=VERSION`
- **Button resets clobber styles:** `.group-toggle` resets `font`, `color` and `text-transform`, which wiped the sidebar heading style until it was restored explicitly. When one element gets two classes, check the result in a screenshot.
- **Inherited colour:** the regex pattern input inherited the muted colour of its `/ … /` wrapper. Inputs inside styled wrappers may need `color: var(--text)`.
- **Browser error messages differ:** Chrome's newer `JSON.parse` errors don't include a position, so `json.js` has its own small scanner to report line and column. Don't parse browser error strings.
- **Phone layouts:** result headers with a label plus buttons need `flex-wrap`. Starred and recent tiles use a compact two-column layout under 800px.
- **Test pitfalls:**
  - Playwright's `fill()` on `datetime-local` wants `YYYY-MM-DDTHH:mm`, without seconds.
  - `page.goto` reloads the page, so in-memory state is lost; click links to navigate within a session.
  - Screenshots taken mid-transition (0.15s) can show a stale toggle state; wait about 300ms.
  - Always pass an absolute output path to screenshot scripts. A missing env var once created an `undefined/` folder of screenshots that got committed. `tests/output/` is git-ignored.
- **Regex Tester limit:** catastrophic-backtracking patterns such as `(a+)+$` can freeze the tab. That's a limit of the JS regex engine, and it's accepted.

## History (most recent last)

1. Hello World page, then made it an installable PWA (manifest, service worker, icons).
2. Sidebar plus the first tool (MD5, with its own implementation because Web Crypto has no MD5), then home tiles and Base64.
3. Modern UI redesign (indigo/violet palette, line icons, cards, drop zones, segmented controls, dark mode).
4. Mobile install popup (Android `beforeinstallprompt`; iOS Share → Add to Home Screen steps).
5. Fixed the broken mobile UI caused by stale caches (see Lessons learned).
6. Renamed to **Pocketknife**; new tagline "Small tools. Sharp results."
7. Restructured to one file per tool (`PK.register`), then added 16 tools (18 total), home search and categories. Bundled `qrcode-generator` (MIT).
8. Folding-knife logo and icons; starred tools (sidebar plus home) and recent tools.
9. Collapsible group headings (sidebar and home), remembered per browser.
10. System / Light / Dark theme switch (default System, no flash on load).
11. Added README, this file and `tests/smoke.js`.

Current version: **13** (see `sw.js`).
