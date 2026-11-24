// --- Home tiles: one per app link in the sidebar ---
const tiles = document.getElementById('tiles');
document.querySelectorAll('#appLinks a[data-app]').forEach((link) => {
  const tile = document.createElement('a');
  tile.className = 'tile';
  tile.href = link.getAttribute('href');
  tile.innerHTML =
    '<span class="tile-icon"></span><span class="tile-title"></span><span class="tile-desc"></span>' +
    '<svg class="ico tile-arrow"><use href="#i-arrow"/></svg>';
  const icon = link.querySelector('.nav-icon svg');
  if (icon) tile.querySelector('.tile-icon').appendChild(icon.cloneNode(true));
  tile.querySelector('.tile-title').textContent = link.querySelector('.nav-label').textContent;
  tile.querySelector('.tile-desc').textContent = link.dataset.desc || '';
  tiles.appendChild(tile);
});

// --- Sidebar navigation (hash-based: #home, #md5, ...) ---
const apps = document.querySelectorAll('section[data-app]');
const links = document.querySelectorAll('.nav-list a[data-app]');
const topbarTitle = document.getElementById('topbarTitle');

function showApp() {
  const id = location.hash.slice(1);
  const target = document.querySelector(`section[data-app="${CSS.escape(id)}"]`) || apps[0];
  apps.forEach((s) => { s.hidden = s !== target; });
  links.forEach((a) => a.classList.toggle('active', a.dataset.app === target.dataset.app));
  topbarTitle.textContent = target.dataset.title;
  document.title = target.dataset.app === 'home' ? 'Toolbox' : `${target.dataset.title} · Toolbox`;
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

// --- Shared helpers ---
function setupCopy(btn, getText) {
  const label = btn.querySelector('span');
  const use = btn.querySelector('use');
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(getText());
      label.textContent = 'Copied';
      use.setAttribute('href', '#i-check');
      btn.classList.add('copied');
    } catch {
      label.textContent = 'Failed';
    }
    setTimeout(() => {
      label.textContent = 'Copy';
      use.setAttribute('href', '#i-copy');
      btn.classList.remove('copied');
    }, 1400);
  });
}

// Shows the chosen file name in the drop zone and highlights it while dragging.
function setupDropzone(fileInput) {
  const zone = fileInput.closest('.dropzone');
  const text = zone.querySelector('.dz-text');
  const defaultHTML = text.innerHTML;
  ['dragenter', 'dragover'].forEach((t) => zone.addEventListener(t, () => zone.classList.add('dragover')));
  ['dragleave', 'drop'].forEach((t) => zone.addEventListener(t, () => zone.classList.remove('dragover')));
  const refresh = () => {
    const file = fileInput.files[0];
    zone.classList.toggle('has-file', !!file);
    if (file) {
      text.textContent = file.name;
    } else {
      text.innerHTML = defaultHTML;
    }
  };
  fileInput.addEventListener('change', refresh);
  return { clear() { fileInput.value = ''; refresh(); } };
}

const formatBytes = (n) => n.toLocaleString() + (n === 1 ? ' byte' : ' bytes');

// --- MD5 Hasher ---
(function () {
  const input = document.getElementById('md5Input');
  const fileInput = document.getElementById('md5File');
  const output = document.getElementById('md5Output');
  const source = document.getElementById('md5Source');
  const encoder = new TextEncoder();
  const zone = setupDropzone(fileInput);

  input.addEventListener('input', () => {
    zone.clear();
    output.textContent = md5(encoder.encode(input.value));
    source.textContent = input.value ? `Hash of: text (${input.value.length} characters)` : 'Hash of: empty text';
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    input.value = '';
    output.textContent = 'Hashing…';
    const bytes = new Uint8Array(await file.arrayBuffer());
    output.textContent = md5(bytes);
    source.textContent = `Hash of: file "${file.name}" (${formatBytes(file.size)})`;
  });

  setupCopy(document.getElementById('md5Copy'), () => output.textContent);
})();

// --- Base64 Encoder ---
(function () {
  const input = document.getElementById('b64Input');
  const fileInput = document.getElementById('b64File');
  const fileGroup = document.getElementById('b64FileGroup');
  const output = document.getElementById('b64Output');
  const status = document.getElementById('b64Status');
  const inputLabel = document.getElementById('b64InputLabel');
  const outputLabel = document.getElementById('b64OutputLabel');
  const modes = document.querySelectorAll('input[name="b64Mode"]');
  const zone = setupDropzone(fileInput);

  const mode = () => document.querySelector('input[name="b64Mode"]:checked').value;

  function bytesToBase64(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }

  function base64ToText(b64) {
    // Accept URL-safe Base64 and missing padding too.
    let clean = b64.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
    while (clean.length % 4) clean += '=';
    const bin = atob(clean);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }

  function setStatus(text, isError) {
    status.textContent = text;
    status.classList.toggle('error', !!isError);
  }

  function run() {
    const text = input.value;
    if (mode() === 'encode') {
      output.textContent = bytesToBase64(new TextEncoder().encode(text));
      setStatus(text ? `Encoded text (${text.length} characters)` : '');
      return;
    }
    if (!text.trim()) { output.textContent = ''; setStatus(''); return; }
    try {
      output.textContent = base64ToText(text);
      setStatus('Decoded Base64');
    } catch (e) {
      output.textContent = '';
      setStatus(e instanceof TypeError
        ? 'Decoded data is not valid UTF-8 text.'
        : 'Not valid Base64.', true);
    }
  }

  function updateMode() {
    const enc = mode() === 'encode';
    inputLabel.textContent = enc ? 'Text' : 'Base64';
    outputLabel.textContent = enc ? 'Base64' : 'Text';
    input.placeholder = enc ? 'Type or paste text…' : 'Paste Base64…';
    fileGroup.hidden = !enc;
    zone.clear();
    run();
  }

  input.addEventListener('input', () => { zone.clear(); run(); });
  modes.forEach((m) => m.addEventListener('change', updateMode));

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    input.value = '';
    output.textContent = 'Encoding…';
    output.textContent = bytesToBase64(new Uint8Array(await file.arrayBuffer()));
    setStatus(`Encoded file "${file.name}" (${formatBytes(file.size)})`);
  });

  setupCopy(document.getElementById('b64Copy'), () => output.textContent);

  updateMode();
})();
