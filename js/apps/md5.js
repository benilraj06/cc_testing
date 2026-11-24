PK.register({
  id: 'md5',
  title: 'MD5 Hasher',
  desc: 'Hash text or files with MD5.',
  icon: 'i-hash',
  category: 'Hash & Encode',
  keywords: 'checksum digest',
  html: `
    <div class="card">
      <label class="field-label" for="md5Input">Text</label>
      <textarea id="md5Input" rows="5" placeholder="Type or paste text…"></textarea>
      <div class="divider"><span>or</span></div>
      ${PK.dropzone('md5File')}
    </div>
    ${PK.resultCard('md5Output', 'MD5 hash')}`,

  init(root, $) {
    const input = $('#md5Input');
    const fileInput = $('#md5File');
    const output = $('#md5Output');
    const status = $('#md5OutputStatus');
    const zone = PK.setupDropzone(fileInput);
    const encoder = new TextEncoder();

    function hashText() {
      output.textContent = md5(encoder.encode(input.value));
      status.textContent = input.value ? `Hash of: text (${input.value.length} characters)` : 'Hash of: empty text';
    }

    input.addEventListener('input', () => { zone.clear(); hashText(); });

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;
      input.value = '';
      output.textContent = 'Hashing…';
      output.textContent = md5(new Uint8Array(await file.arrayBuffer()));
      status.textContent = `Hash of: file "${file.name}" (${PK.formatBytes(file.size)})`;
    });

    PK.setupCopy($('[data-copy]'), () => output.textContent);
    hashText();
  },
});
