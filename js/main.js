// Builds the sidebar, home tiles and app pages from PK.apps, then handles
// starred and recent tools, navigation, home search, offline support and
// the install popup.
(function () {
  const { apps, CATEGORIES, icon, escapeHTML } = PK;
  const byId = Object.fromEntries(apps.map((a) => [a.id, a]));
  const navStarred = document.getElementById('navStarred');
  const navGroups = document.getElementById('navGroups');
  const homeGroups = document.getElementById('homeGroups');
  const homeStarred = document.getElementById('homeStarred');
  const homeRecent = document.getElementById('homeRecent');
  const content = document.getElementById('content');

  // ---------- Saved preferences (this browser only) ----------
  const STAR_KEY = 'pk.starred';
  const RECENT_KEY = 'pk.recent';
  const RECENT_MAX = 6;
  function load(key) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return Array.isArray(v) ? v.filter((id) => byId[id]) : [];
    } catch { return []; }
  }
  function save(key, list) {
    try { localStorage.setItem(key, JSON.stringify(list)); } catch {}
  }
  let starred = load(STAR_KEY);
  let recent = load(RECENT_KEY);

  // ---------- Markup builders ----------
  const navLink = (a) => `
    <li><a href="#${a.id}" data-app="${a.id}">
      <span class="nav-icon">${icon(a.icon)}</span><span class="nav-label">${escapeHTML(a.title)}</span>
    </a></li>`;

  const starButton = (a, cls) =>
    `<button class="${cls}" type="button" data-star="${a.id}" aria-pressed="false" aria-label="Star ${escapeHTML(a.title)}" title="Star">${icon('i-star')}</button>`;

  const tile = (a) => `
    <div class="tile-wrap" data-search="${escapeHTML((a.title + ' ' + a.desc + ' ' + (a.keywords || '')).toLowerCase())}">
      <a class="tile" href="#${a.id}">
        <span class="tile-icon">${icon(a.icon)}</span>
        <span class="tile-title">${escapeHTML(a.title)}</span>
        <span class="tile-desc">${escapeHTML(a.desc)}</span>
        ${icon('i-arrow', 'tile-arrow')}
      </a>
      ${starButton(a, 'tile-star')}
    </div>`;

  // ---------- Build navigation, tiles and pages ----------
  for (const cat of CATEGORIES) {
    const list = apps.filter((a) => a.category === cat);
    if (!list.length) continue;
    navGroups.insertAdjacentHTML('beforeend', `
      <div class="nav-section">${escapeHTML(cat)}</div>
      <ul class="nav-list">${list.map(navLink).join('')}</ul>`);
    homeGroups.insertAdjacentHTML('beforeend', `
      <section class="tile-group" data-group>
        <h2 class="group-title">${escapeHTML(cat)}</h2>
        <div class="tiles">${list.map(tile).join('')}</div>
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
        <div class="page-title-row">
          <h1>${escapeHTML(app.title)}</h1>
          <button class="star-toggle" type="button" data-star="${app.id}" aria-pressed="false">${icon('i-star')}<span>Star</span></button>
        </div>
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

  // ---------- Starred and recent ----------
  function renderStarred() {
    const list = starred.map((id) => byId[id]);
    navStarred.hidden = !list.length;
    navStarred.innerHTML = list.length
      ? `<div class="nav-section">Starred</div><ul class="nav-list">${list.map(navLink).join('')}</ul>`
      : '';
    homeStarred.querySelector('.tiles').innerHTML = list.map(tile).join('');
    // Reflect the state on every star button (pages and tiles).
    document.querySelectorAll('[data-star]').forEach((btn) => {
      const on = starred.includes(btn.dataset.star);
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', String(on));
      const title = byId[btn.dataset.star].title;
      if (btn.classList.contains('tile-star')) {
        btn.setAttribute('aria-label', `${on ? 'Unstar' : 'Star'} ${title}`);
        btn.title = on ? 'Unstar' : 'Star';
      } else {
        btn.querySelector('span').textContent = on ? 'Starred' : 'Star';
      }
    });
    markActive();
    updateHomeSections();
  }

  function renderRecent() {
    homeRecent.querySelector('.tiles').innerHTML = recent.map((id) => tile(byId[id])).join('');
    renderStarred(); // new tiles need their star state
  }

  function toggleStar(id) {
    starred = starred.includes(id) ? starred.filter((x) => x !== id) : [...starred, id];
    save(STAR_KEY, starred);
    renderStarred();
  }

  function addRecent(id) {
    recent = [id, ...recent.filter((x) => x !== id)].slice(0, RECENT_MAX);
    save(RECENT_KEY, recent);
  }

  // One listener handles star buttons everywhere, including re-rendered tiles.
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-star]');
    if (!btn) return;
    e.preventDefault();
    toggleStar(btn.dataset.star);
  });

  document.getElementById('recentClear').addEventListener('click', () => {
    recent = [];
    save(RECENT_KEY, recent);
    renderRecent();
  });

  // ---------- Navigation (hash-based: #home, #md5, ...) ----------
  const sections = document.querySelectorAll('section[data-app]');
  const topbarTitle = document.getElementById('topbarTitle');
  let current = 'home';

  function markActive() {
    document.querySelectorAll('.nav-list a[data-app]').forEach((a) => {
      const on = a.dataset.app === current;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  function showApp() {
    const id = location.hash.slice(1);
    const target = [...sections].find((s) => s.dataset.app === id) || sections[0];
    const changed = target.hidden;
    current = target.dataset.app;
    sections.forEach((s) => { s.hidden = s !== target; });
    markActive();
    topbarTitle.textContent = target.dataset.title;
    document.title = current === 'home' ? 'Pocketknife' : `${target.dataset.title} · Pocketknife`;
    if (changed) window.scrollTo(0, 0);
    if (current === 'home') renderRecent();
    else addRecent(current);
    const app = byId[current];
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

  // ---------- Home search ----------
  const search = document.getElementById('homeSearch');
  const empty = document.getElementById('homeEmpty');
  const searching = () => search.value.trim() !== '';

  // Starred/Recent are shortcuts; hide them while searching to avoid duplicates.
  function updateHomeSections() {
    homeStarred.hidden = searching() || !starred.length;
    homeRecent.hidden = searching() || !recent.length;
  }

  search.addEventListener('input', () => {
    const terms = search.value.toLowerCase().split(/\s+/).filter(Boolean);
    let any = false;
    document.querySelectorAll('[data-group]').forEach((group) => {
      let groupHas = false;
      group.querySelectorAll('.tile-wrap').forEach((wrap) => {
        const match = terms.every((t) => wrap.dataset.search.includes(t));
        wrap.hidden = !match;
        groupHas = groupHas || match;
      });
      group.hidden = !groupHas;
      any = any || groupHas;
    });
    empty.hidden = any;
    updateHomeSections();
  });
  search.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const first = document.querySelector('#homeGroups .tile-wrap:not([hidden]) .tile');
    if (first) location.hash = first.getAttribute('href');
  });

  showApp();
  renderStarred();

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
