#!/usr/bin/env node
// Pocketknife smoke test.
//
//   node tests/smoke.js            # run all checks
//   node tests/smoke.js --shots    # also save screenshots to tests/output/
//
// Needs Node 18+ and Playwright (with Chromium). It serves the repo itself on a
// random local port, so no other server is needed. Checks are generic: tools
// added later are picked up automatically from PK.apps.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const SHOTS = process.argv.includes('--shots');
const OUT = path.join(__dirname, 'output');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? `\n      → ${detail}` : ''}`);
};

// ---------- Static checks (no browser) ----------
function staticChecks() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

  const version = Number((/const VERSION = (\d+);/.exec(sw) || [])[1]);
  const tags = [...html.matchAll(/\?v=(\d+)/g)].map((m) => Number(m[1]));
  check(`every ?v= in index.html matches sw.js VERSION (${version})`, tags.length > 0 && tags.every((v) => v === version),
    `found ${[...new Set(tags)].join(', ')}`);

  const htmlApps = [...html.matchAll(/js\/apps\/([\w-]+)\.js/g)].map((m) => m[1]);
  const swApps = [...(/const APP_FILES = \[([\s\S]*?)\]/.exec(sw) || ['', ''])[1].matchAll(/'([\w-]+)'/g)].map((m) => m[1]);
  const diskApps = fs.readdirSync(path.join(ROOT, 'js/apps')).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3));
  const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
  check('js/apps/*.js, index.html <script> tags and sw.js APP_FILES list the same tools',
    same(htmlApps, diskApps) && same(swApps, diskApps),
    `disk: ${diskApps.join(' ')}\n        index.html: ${htmlApps.join(' ')}\n        sw.js: ${swApps.join(' ')}`);

  const mainLast = html.lastIndexOf('js/main.js') > html.lastIndexOf('js/apps/');
  check('js/main.js is loaded after every app script', mainLast);
}

// ---------- Tiny static server ----------
function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      let file = path.join(ROOT, url === '/' ? 'index.html' : url);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// ---------- Browser checks ----------
async function browserChecks(base) {
  const browser = await chromium.launch();
  const problems = [];
  const watch = (page, label) => {
    page.on('pageerror', (e) => problems.push(`${label}: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') problems.push(`${label} console: ${m.text()}`); });
    page.on('response', (r) => { if (r.status() >= 400) problems.push(`${label}: HTTP ${r.status()} ${r.url()}`); });
  };
  if (SHOTS) fs.mkdirSync(OUT, { recursive: true });

  // Desktop
  const desk = await (await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 })).newPage();
  watch(desk, 'desktop');
  await desk.goto(base);
  await desk.waitForTimeout(500);

  const info = await desk.evaluate(() => ({
    apps: PK.apps.map((a) => ({ id: a.id, title: a.title })),
    tiles: document.querySelectorAll('#homeGroups .tile').length,
    links: document.querySelectorAll('#navGroups a[data-app]').length,
    failed: [...document.querySelectorAll('section.app')].filter((s) => s.textContent.includes('failed to start')).map((s) => s.dataset.app),
  }));
  const ids = info.apps.map((a) => a.id);
  check(`${ids.length} tools registered, each with a sidebar link and a home tile`,
    ids.length > 0 && info.tiles === ids.length && info.links === ids.length, JSON.stringify(info));
  check('no tool failed to start', info.failed.length === 0, info.failed.join(', '));
  check('tool ids are unique', new Set(ids).size === ids.length);

  const navFails = [];
  for (const id of ids) {
    await desk.click(`#navGroups a[data-app="${id}"]`);
    await desk.waitForTimeout(60);
    const ok = await desk.evaluate((x) => !document.querySelector(`section[data-app="${x}"]`).hidden, id);
    if (!ok) navFails.push(id);
    if (SHOTS) await desk.screenshot({ path: path.join(OUT, `desktop-${id}.png`), fullPage: true });
  }
  check('every sidebar link opens its tool', navFails.length === 0, navFails.join(', '));

  // Offline cache holds every asset listed in sw.js
  await desk.goto(base);
  await desk.waitForTimeout(1200);
  const cache = await desk.evaluate(async () => {
    const keys = await caches.keys();
    if (!keys.length) return { name: null, count: 0 };
    return { name: keys[0], count: (await (await caches.open(keys[0])).keys()).length };
  });
  check(`service worker installed its offline cache (${cache.name}, ${cache.count} files)`, cache.count >= ids.length + 5);

  // Phone widths: nothing may stick out sideways
  const overflow = [];
  for (const width of [280, 320, 390]) {
    const page = await (await browser.newContext({ viewport: { width, height: 760 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true })).newPage();
    watch(page, `${width}px`);
    for (const id of ['home', ...ids]) {
      await page.goto(`${base}#${id}`);
      await page.waitForTimeout(120);
      const bad = await page.evaluate(() => {
        const W = document.documentElement.clientWidth;
        if (document.documentElement.scrollWidth > W) return `page is ${document.documentElement.scrollWidth}px wide`;
        for (const el of document.querySelectorAll('section.app:not([hidden]) *')) {
          const r = el.getBoundingClientRect();
          let p = el.parentElement, scrolls = false;
          while (p) { if (/(auto|scroll)/.test(getComputedStyle(p).overflowX)) { scrolls = true; break; } p = p.parentElement; }
          if (!scrolls && r.width && r.right > W + 1) return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''} sticks out`;
        }
        return null;
      });
      if (bad) overflow.push(`${width}px #${id}: ${bad}`);
      if (SHOTS && width === 390) await page.screenshot({ path: path.join(OUT, `phone-${id}.png`), fullPage: true });
    }
  }
  check('no horizontal overflow at 280 / 320 / 390px', overflow.length === 0, overflow.join('\n        '));

  // Dark theme renders and every tool still starts
  const dark = await (await browser.newContext({ viewport: { width: 1280, height: 860 }, colorScheme: 'dark', deviceScaleFactor: 1 })).newPage();
  watch(dark, 'dark');
  await dark.goto(base);
  await dark.waitForTimeout(300);
  const bg = await dark.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check('dark theme applies when the system is dark', bg === 'rgb(11, 12, 18)', bg);
  if (SHOTS) for (const id of ids) {
    await dark.goto(`${base}#${id}`);
    await dark.waitForTimeout(100);
    await dark.screenshot({ path: path.join(OUT, `dark-${id}.png`), fullPage: true });
  }

  check('no page errors, console errors or failed requests', problems.length === 0, [...new Set(problems)].slice(0, 10).join('\n        '));
  await browser.close();
}

(async () => {
  staticChecks();
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  try {
    await browserChecks(base);
  } finally {
    server.close();
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed${SHOTS ? ` · screenshots in ${path.relative(process.cwd(), OUT)}/` : ''}`);
  process.exit(failed ? 1 : 0);
})();
