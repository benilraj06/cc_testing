// Builds the sidebar, home tiles and app pages from PK.apps, then handles
// navigation, home search, offline support and the install popup.
(function () {
  const { apps, CATEGORIES, icon, escapeHTML } = PK;
  const navGroups = document.getElementById('navGroups');
  const homeGroups = document.getElementById('homeGroups');
  const content = document.getElementById('content');

  // ---------- Build navigation, tiles and pages ----------
  for (const cat of CATEGORIES) {
    const list = apps.filter((a) => a.category === cat);
    if (!list.length) continue;

    navGroups.insertAdjacentHTML('beforeend', `
      <div class="nav-section">${escapeHTML(cat)}</div>
      <ul class="nav-list">${list.map((a) => `
        <li><a href="#${a.id}" data-app="${a.id}">
          <span class="nav-icon">${icon(a.icon)}</span><span class="nav-label">${escapeHTML(a.title)}</span>
        </a></li>`).join('')}
      </ul>`);

    homeGroups.insertAdjacentHTML('beforeend', `
      <section class="tile-group" data-group>
        <h2 class="group-title">${escapeHTML(cat)}</h2>
        <div class="tiles">${list.map((a) => `
          <a class="tile" href="#${a.id}" data-search="${escapeHTML((a.title + ' ' + a.desc + ' ' + (a.keywords || '')).toLowerCase())}">
            <span class="tile-icon">${icon(a.icon)}</span>
            <span class="tile-title">${escapeHTML(a.title)}</span>
            <span class="tile-desc">${escapeHTML(a.desc)}</span>
            ${icon('i-arrow', 'tile-arrow')}
          </a>`).join('')}
        </div>
      </section>`);
  }

  for (const app of apps) {
    const section = document.createElement('section');
    section.className = 'app' + (app.wide ? ' app-wide' : '');
    section.dataset.app = app.id;
    section.dataset.title = app.title;
    section.hidden = true;
    section.innerHTML = `
      <header class="page-head">
        <h1>${escapeHTML(app.title)}</h1>
        <p>${escapeHTML(app.desc)}</p>
      </header>
      ${app.html}`;
    content.appendChild(section);
    try {
      app.init(section, (sel) => section.querySelector(sel));
    } catch (err) {
      console.error(`Failed to start ${app.id}:`, err);
      section.insertAdjacentHTML('beforeend', '<p class="status error">This tool failed to start in this browser.</p>');
    }
  }

  // ---------- Navigation (hash-based: #home, #md5, ...) ----------
  const sections = document.querySelectorAll('section[data-app]');
  const links = document.querySelectorAll('.nav-list a[data-app]');
  const topbarTitle = document.getElementById('topbarTitle');

  function showApp() {
    const id = location.hash.slice(1);
    const target = [...sections].find((s) => s.dataset.app === id) || sections[0];
    const changed = target.hidden;
    sections.forEach((s) => { s.hidden = s !== target; });
    links.forEach((a) => {
      const on = a.dataset.app === target.dataset.app;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    topbarTitle.textContent = target.dataset.title;
    document.title = target.dataset.app === 'home' ? 'Pocketknife' : `${target.dataset.title} · Pocketknife`;
    if (changed) window.scrollTo(0, 0);
    const app = apps.find((a) => a.id === target.dataset.app);
    if (app && app.onShow) app.onShow();
    setNavOpen(false);
  }

  function setNavOpen(open) {
    document.body.classList.toggle('nav-open', open);
    document.getElementById('menuBtn').setAttribute('aria-expanded', String(open));
  }

  document.getElementById('menuBtn').addEventListener('click', () =>
    setNavOpen(!document.body.classList.contains('nav-open')));
  document.getElementById('backdrop').addEventListener('click', () => setNavOpen(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setNavOpen(false); });
  window.addEventListener('hashchange', showApp);
  showApp();

  // ---------- Home search ----------
  const search = document.getElementById('homeSearch');
  const empty = document.getElementById('homeEmpty');
  search.addEventListener('input', () => {
    const terms = search.value.toLowerCase().split(/\s+/).filter(Boolean);
    let any = false;
    document.querySelectorAll('[data-group]').forEach((group) => {
      let groupHas = false;
      group.querySelectorAll('.tile').forEach((tile) => {
        const match = terms.every((t) => tile.dataset.search.includes(t));
        tile.hidden = !match;
        groupHas = groupHas || match;
      });
      group.hidden = !groupHas;
      any = any || groupHas;
    });
    empty.hidden = any;
  });
  search.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const first = document.querySelector('#homeGroups .tile:not([hidden])');
    if (first) location.hash = first.getAttribute('href');
  });

  // ---------- Offline support ----------
  if ('serviceWorker' in navigator) {
    // If an older service worker was in control, reload once when the new one
    // takes over so the page isn't left running a mix of old and new files.
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !reloaded) { reloaded = true; location.reload(); }
    });
    navigator.serviceWorker.register('sw.js');
  }

  // ---------- Install popup (mobile only) ----------
  const sheet = document.getElementById('installSheet');
  const actions = document.getElementById('installActions');
  const steps = document.getElementById('installSteps');
  const KEY = 'installDismissedAt';
  const SNOOZE_DAYS = 14;

  const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const isMobile = isIOS || /Android|Mobi/i.test(ua) || matchMedia('(pointer: coarse)').matches;
  // Only Safari can add to the home screen on iOS; other iOS browsers cannot always.
  const isIOSSafari = isIOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);

  function snoozed() {
    try {
      const t = Number(localStorage.getItem(KEY));
      return t && Date.now() - t < SNOOZE_DAYS * 864e5;
    } catch { return false; }
  }
  function dismiss() {
    try { localStorage.setItem(KEY, String(Date.now())); } catch {}
    hide();
  }
  function hide() {
    sheet.hidden = true;
    document.body.style.paddingBottom = '';
  }
  function show(mode) {
    actions.hidden = mode !== 'prompt';
    steps.hidden = mode !== 'ios';
    sheet.hidden = false;
    document.body.style.paddingBottom = sheet.offsetHeight + 24 + 'px';
  }

  if (isStandalone || !isMobile || snoozed()) return;

  let deferred = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    setTimeout(() => show('prompt'), 1500);
  });

  document.getElementById('installBtn').addEventListener('click', async () => {
    if (!deferred) return hide();
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    outcome === 'accepted' ? hide() : dismiss();
  });
  document.getElementById('installLater').addEventListener('click', dismiss);
  document.getElementById('installClose').addEventListener('click', dismiss);
  window.addEventListener('appinstalled', hide);

  if (isIOSSafari) setTimeout(() => show('ios'), 1500);
})();
