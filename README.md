# Pocketknife

**Small tools. Sharp results.** Pocketknife is a set of 25 handy developer, text and device tools that run entirely in your browser. Nothing you type or upload ever leaves your device, and once installed it works offline.

**Live:** https://benilraj06.github.io/cc_testing/

## Tools

| Group | Tools |
|---|---|
| **Hash & Encode** | MD5 Hasher · SHA Hasher (SHA-1/256/384/512) · Base64 Encoder · URL Encoder · JWT Decoder · Hex Viewer |
| **Generate** | Password Generator · UUID Generator (v4 / v7) · QR Code Maker · Lorem Ipsum |
| **Convert & Format** | JSON Formatter · Timestamp Converter · Number Base Converter · Color Converter · Case Converter |
| **Text** | Text Diff · Word Counter · Regex Tester |
| **Device** | GPS Location (live coordinates, accuracy, altitude, speed, heading) · Compass · Screen Flashlight (steady, SOS, strobe) · Bubble Level · Sound Meter · QR Scanner (camera or image) · NFC Reader (Chrome on Android) |

## Features

- **Private:** everything runs locally in the browser. There's no server and no tracking. Device tools (GPS, Compass, Bubble Level, Sound Meter, QR Scanner, NFC Reader) only ask for sensor, microphone or camera access when you tap Start, and nothing is recorded or leaves your device.
- **Works offline:** a service worker saves the app after your first visit.
- **Installable:** add it to your home screen or desktop as an app. Phones get an install prompt.
- **Share:** every tool has a Share button that opens your phone's share sheet with a direct link to that tool, or copies the link on desktop.
- **Starred and recent tools:** star tools to pin them to the top of the sidebar and home page. The home page also lists the tools you used most recently.
- **Search and collapsible groups:** find a tool quickly or fold away the groups you don't use.
- **Light, dark or system theme:** switch at the bottom of the sidebar.
- **Responsive:** works from small phones up to wide screens.

Stars, recent tools, collapsed groups and the theme are saved in your browser on each device. They don't sync between devices.

## Run it locally

It's plain HTML, CSS and JavaScript: no build step and no dependencies. Serve the folder with any static web server:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. Opening `index.html` straight from disk mostly works, but the service worker and SHA hashing need `http://localhost` or HTTPS.

## Test

```bash
node tests/smoke.js
```

You need Node 18+ and [Playwright](https://playwright.dev) with Chromium. The test starts its own local server and checks that:

- every tool starts and opens from the sidebar, with no errors
- nothing overflows the screen on phone widths
- dark mode works
- the offline cache installs
- `index.html` and `sw.js` agree on the list of tools and the version number

Add `--shots` to save screenshots of every tool to `tests/output/`.

## Project layout

```
index.html          Page shell: icons, sidebar, home page, install popup, script list
css/style.css       All styles (light and dark themes, components, per-tool styles)
js/core.js          PK: the tool registry and shared helpers
js/apps/*.js        One file per tool
js/main.js          Builds the sidebar, home page and tool pages; navigation, search,
                    stars, recent tools, collapsing, theme, offline support, install popup
js/md5.js           MD5 implementation (browsers have no built-in MD5)
js/vendor/qrcode.js QR code generator by Kazuhiko Arase (MIT), bundled for offline use
sw.js               Service worker (offline cache)
manifest.json       Web app manifest (name, icons, colours)
icons/              App icons
tests/smoke.js      Automated browser test
CLAUDE.md           Detailed notes for AI assistants working on this repo
```

## Adding a tool

1. Create `js/apps/<id>.js` that calls `PK.register({...})`. Copy a similar tool as a starting point; `js/apps/md5.js` is the simplest.
2. Add `<script src="js/apps/<id>.js?v=N"></script>` to `index.html`, before `js/main.js`.
3. Add `'<id>'` to `APP_FILES` in `sw.js`.
4. Bump the version (see below) and run `node tests/smoke.js`.

The sidebar link, home tile, search entry and star button are created automatically. See [CLAUDE.md](CLAUDE.md) for the full app API and conventions.

## Releasing

GitHub Pages serves the `main` branch, so pushing to `main` deploys. On every release, bump the version so browsers and installed apps fetch the new files:

- `VERSION` in `sw.js`
- every `?v=` in `index.html` (they must all match `VERSION`; the test checks this)

```bash
sed -i 's/?v=16/?v=17/g' index.html && sed -i 's/const VERSION = 16;/const VERSION = 17;/' sw.js
```

## Credits

- QR codes: [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) by Kazuhiko Arase, MIT licence. "QR Code" is a registered trademark of DENSO WAVE INCORPORATED.
