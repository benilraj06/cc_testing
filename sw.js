// Network-first: always try the latest files (revalidated with the server, so
// the browser's HTTP cache can't serve a stale mix of old and new files), and
// fall back to the saved copy when offline.
// On each release, bump VERSION here and the matching ?v= in index.html, so
// browsers never pair a new page with old cached CSS or JS.
const VERSION = 7;
const CACHE = 'toolbox-v' + VERSION;
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css?v=' + VERSION,
  './js/app.js?v=' + VERSION,
  './js/md5.js?v=' + VERSION,
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' }))))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const old = (await caches.keys()).filter((k) => k !== CACHE);
    await Promise.all(old.map((k) => caches.delete(k)));
    await self.clients.claim();
    // Replacing an older version: reload open pages so they don't keep
    // showing files from the old cache.
    if (old.length) {
      const windows = await self.clients.matchAll({ type: 'window' });
      windows.forEach((w) => w.navigate(w.url).catch(() => {}));
    }
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  event.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })
        .then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});
