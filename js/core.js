// Pocketknife core: the app registry plus helpers shared by every app.
//
// Each app lives in js/apps/<name>.js and calls:
//   PK.register({
//     id: 'md5',                    // used in the URL (#md5) and for element ids
//     title: 'MD5 Hasher',
//     desc: 'Hash text or files with MD5.',
//     icon: 'i-hash',               // an <symbol> id from index.html
//     category: 'Hash & Encode',    // one of PK.CATEGORIES
//     html: `...`,                  // page content below the title
//     init(root, $) { ... },        // root = the app's <section>; $ = root.querySelector
//   });
// js/main.js then builds the sidebar, home tiles and pages from the registry.

window.PK = (function () {
  const apps = [];
  const CATEGORIES = ['Hash & Encode', 'Generate', 'Convert & Format', 'Text'];

  function register(app) {
    if (!CATEGORIES.includes(app.category)) throw new Error(`Unknown category for ${app.id}`);
    apps.push(app);
  }

  // ---------- HTML snippets ----------
  const icon = (id, cls = '') => `<svg class="ico ${cls}"><use href="#${id}"/></svg>`;

  const copyButton = (label = 'Copy') =>
    `<button class="copy-btn" type="button" data-copy>${icon('i-copy')}<span>${label}</span></button>`;

  const dropzone = (id) => `
    <label class="dropzone">
      <input type="file" id="${id}">
      ${icon('i-upload', 'dz-icon')}
      <span class="dz-text"><strong>Choose a file</strong> or drag it here</span>
    </label>`;

  // A card with a label, a copy button and a monospace output box.
  const resultCard = (id, label, extra = '') => `
    <div class="card result">
      <div class="result-head">
        <span class="field-label" id="${id}Label">${label}</span>
        ${copyButton()}
      </div>
      <output id="${id}" class="mono"></output>
      <p class="status" id="${id}Status">${extra}</p>
    </div>`;

  // ---------- Behaviour helpers ----------
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback for browsers without the async clipboard API.
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch {}
      ta.remove();
      return ok;
    }
  }

  // Wires a copy button (from copyButton()) to copy whatever getText() returns.
  function setupCopy(btn, getText) {
    const label = btn.querySelector('span');
    const use = btn.querySelector('use');
    const original = label.textContent;
    btn.addEventListener('click', async () => {
      const ok = await copyText(getText());
      label.textContent = ok ? 'Copied' : 'Failed';
      if (ok) { use.setAttribute('href', '#i-check'); btn.classList.add('copied'); }
      setTimeout(() => {
        label.textContent = original;
        use.setAttribute('href', '#i-copy');
        btn.classList.remove('copied');
      }, 1400);
    });
  }

  // Shows the chosen file name in a drop zone and highlights it while dragging.
  function setupDropzone(fileInput) {
    const zone = fileInput.closest('.dropzone');
    const text = zone.querySelector('.dz-text');
    const defaultHTML = text.innerHTML;
    ['dragenter', 'dragover'].forEach((t) => zone.addEventListener(t, () => zone.classList.add('dragover')));
    ['dragleave', 'drop'].forEach((t) => zone.addEventListener(t, () => zone.classList.remove('dragover')));
    const refresh = () => {
      const file = fileInput.files[0];
      zone.classList.toggle('has-file', !!file);
      if (file) text.textContent = file.name;
      else text.innerHTML = defaultHTML;
    };
    fileInput.addEventListener('change', refresh);
    return { clear() { fileInput.value = ''; refresh(); } };
  }

  // Sets a status line's text, styled as an error when isError is true.
  function setStatus(el, text, isError = false) {
    el.textContent = text;
    el.classList.toggle('error', !!isError);
  }

  const escapeHTML = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const formatBytes = (n) => n.toLocaleString() + (n === 1 ? ' byte' : ' bytes');

  // Cryptographically secure random integer in [0, max).
  function randomInt(max) {
    const limit = Math.floor(0x100000000 / max) * max;
    const buf = new Uint32Array(1);
    let x;
    do { crypto.getRandomValues(buf); x = buf[0]; } while (x >= limit);
    return x % max;
  }

  function debounce(fn, ms = 150) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  function download(filename, href) {
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // Relative time like "in 3 hours" / "5 minutes ago".
  function relativeTime(date) {
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
    const sec = Math.round((date.getTime() - Date.now()) / 1000);
    const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]];
    for (const [unit, s] of units) {
      if (Math.abs(sec) >= s || unit === 'second') return rtf.format(Math.round(sec / s), unit);
    }
  }

  return {
    apps, CATEGORIES, register,
    icon, copyButton, dropzone, resultCard,
    copyText, setupCopy, setupDropzone, setStatus,
    escapeHTML, formatBytes, randomInt, debounce, download, relativeTime,
  };
})();
