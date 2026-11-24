PK.register({
  id: 'base64',
  title: 'Base64 Encoder',
  desc: 'Encode or decode text and files as Base64.',
  icon: 'i-code',
  category: 'Hash & Encode',
  keywords: 'decode atob btoa',
  html: `
    <div class="segmented" role="radiogroup" aria-label="Mode">
      <label><input type="radio" name="b64Mode" value="encode" checked><span>Encode</span></label>
      <label><input type="radio" name="b64Mode" value="decode"><span>Decode</span></label>
    </div>
    <div class="card">
      <label class="field-label" for="b64Input" id="b64InputLabel">Text</label>
      <textarea id="b64Input" rows="5" placeholder="Type or paste text…"></textarea>
      <div id="b64FileGroup">
        <div class="divider"><span>or</span></div>
        ${PK.dropzone('b64File')}
      </div>
    </div>
    ${PK.resultCard('b64Output', 'Base64')}`,

  init(root, $) {
    const input = $('#b64Input');
    const fileInput = $('#b64File');
    const fileGroup = $('#b64FileGroup');
    const output = $('#b64Output');
    const status = $('#b64OutputStatus');
    const inputLabel = $('#b64InputLabel');
    const outputLabel = $('#b64OutputLabel');
    const modes = root.querySelectorAll('input[name="b64Mode"]');
    const zone = PK.setupDropzone(fileInput);

    const mode = () => root.querySelector('input[name="b64Mode"]:checked').value;

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
      const bytes = Uint8Array.from(atob(clean), (c) => c.charCodeAt(0));
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    }

    function run() {
      const text = input.value;
      if (mode() === 'encode') {
        output.textContent = bytesToBase64(new TextEncoder().encode(text));
        PK.setStatus(status, text ? `Encoded text (${text.length} characters)` : '');
        return;
      }
      if (!text.trim()) { output.textContent = ''; PK.setStatus(status, ''); return; }
      try {
        output.textContent = base64ToText(text);
        PK.setStatus(status, 'Decoded Base64');
      } catch (e) {
        output.textContent = '';
        PK.setStatus(status, e instanceof TypeError ? 'Decoded data is not valid UTF-8 text.' : 'Not valid Base64.', true);
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
      PK.setStatus(status, `Encoded file "${file.name}" (${PK.formatBytes(file.size)})`);
    });

    PK.setupCopy($('[data-copy]'), () => output.textContent);
    updateMode();
  },
});
