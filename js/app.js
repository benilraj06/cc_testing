// --- Home tiles: one per sidebar app (except Home) ---
const tiles = document.getElementById('tiles');
document.querySelectorAll('.nav-list a[data-app]').forEach((link) => {
  if (link.dataset.app === 'home') return;
  const tile = document.createElement('a');
  tile.className = 'tile';
  tile.href = link.getAttribute('href');
  const icon = link.querySelector('.nav-icon');
  tile.innerHTML = '<span class="tile-icon"></span><span class="tile-title"></span><span class="tile-desc"></span>';
  tile.querySelector('.tile-icon').textContent = icon ? icon.textContent : '';
  tile.querySelector('.tile-title').textContent = link.textContent.replace(icon ? icon.textContent : '', '').trim();
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
  document.title = target.dataset.title;
  setNavOpen(false);
}

function setNavOpen(open) {
  document.body.classList.toggle('nav-open', open);
  document.getElementById('menuBtn').setAttribute('aria-expanded', String(open));
}

document.getElementById('menuBtn').addEventListener('click', () =>
  setNavOpen(!document.body.classList.contains('nav-open')));
document.getElementById('backdrop').addEventListener('click', () => setNavOpen(false));
window.addEventListener('hashchange', showApp);
showApp();

// --- MD5 Hasher ---
(function () {
  const input = document.getElementById('md5Input');
  const fileInput = document.getElementById('md5File');
  const output = document.getElementById('md5Output');
  const source = document.getElementById('md5Source');
  const copyBtn = document.getElementById('md5Copy');
  const encoder = new TextEncoder();

  input.addEventListener('input', () => {
    fileInput.value = '';
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
    source.textContent = `Hash of: file "${file.name}" (${file.size.toLocaleString()} bytes)`;
  });

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(output.textContent);
      copyBtn.textContent = 'Copied!';
    } catch {
      copyBtn.textContent = 'Failed';
    }
    setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1200);
  });
})();
