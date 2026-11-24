PK.register({
  id: 'sha',
  title: 'SHA Hasher',
  desc: 'SHA-1, SHA-256, SHA-384 and SHA-512 for text or files.',
  icon: 'i-shield',
  category: 'Hash & Encode',
  keywords: 'sha1 sha256 sha512 checksum digest',
  html: `
    <div class="card">
      <label class="field-label" for="shaInput">Text</label>
      <textarea id="shaInput" rows="5" placeholder="Type or paste text…"></textarea>
      <div class="divider"><span>or</span></div>
      ${PK.dropzone('shaFile')}
    </div>
    <div class="card">
      <div class="out-list" id="shaList"></div>
      <p class="status" id="shaStatus"></p>
    </div>`,

  init(root, $) {
    const ALGOS = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];
    const input = $('#shaInput');
    const fileInput = $('#shaFile');
    const list = $('#shaList');
    const status = $('#shaStatus');
    const zone = PK.setupDropzone(fileInput);
    const encoder = new TextEncoder();

    list.innerHTML = ALGOS.map((a) => `
      <div class="out-row">
        <span class="out-name">${a}</span>
        <span class="out-val" data-algo="${a}"></span>
        ${PK.copyButton()}
      </div>`).join('');
    const vals = [...list.querySelectorAll('[data-algo]')];
    list.querySelectorAll('[data-copy]').forEach((btn, i) => PK.setupCopy(btn, () => vals[i].textContent));

    if (!(window.crypto && crypto.subtle)) {
      PK.setStatus(status, 'SHA hashing needs a secure (https) connection in this browser.', true);
      return;
    }

    const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    let run = 0; // ignore results from older, slower runs

    async function hash(bytes, label) {
      const id = ++run;
      const results = await Promise.all(ALGOS.map((a) => crypto.subtle.digest(a, bytes)));
      if (id !== run) return;
      results.forEach((r, i) => { vals[i].textContent = toHex(r); });
      PK.setStatus(status, label);
    }

    const hashText = () => hash(encoder.encode(input.value),
      input.value ? `Hash of: text (${input.value.length} characters)` : 'Hash of: empty text');

    input.addEventListener('input', () => { zone.clear(); hashText(); });
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;
      input.value = '';
      PK.setStatus(status, 'Hashing…');
      hash(await file.arrayBuffer(), `Hash of: file "${file.name}" (${PK.formatBytes(file.size)})`);
    });
    hashText();
  },
});
