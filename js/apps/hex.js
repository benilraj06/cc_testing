PK.register({
  id: 'hex',
  title: 'Hex Viewer',
  desc: 'See the raw bytes of a file or text as hex and ASCII.',
  icon: 'i-chip',
  category: 'Hash & Encode',
  keywords: 'hexdump bytes binary inspect',
  wide: true,
  html: `
    <div class="card">
      ${PK.dropzone('hexFile')}
      <div class="divider"><span>or</span></div>
      <label class="field-label" for="hexInput">Text (UTF-8)</label>
      <textarea id="hexInput" rows="3" placeholder="Type or paste text…"></textarea>
    </div>
    ${PK.resultCard('hexOutput', 'Hex dump')}`,

  init(root, $) {
    const LIMIT = 64 * 1024; // bytes shown; larger files are truncated for speed
    const input = $('#hexInput');
    const fileInput = $('#hexFile');
    const output = $('#hexOutput');
    const status = $('#hexOutputStatus');
    const zone = PK.setupDropzone(fileInput);
    output.classList.add('pre', 'tall');

    const hex2 = (n) => n.toString(16).padStart(2, '0');

    function dump(bytes, label, total = bytes.length) {
      const n = Math.min(bytes.length, LIMIT);
      const lines = [];
      for (let off = 0; off < n; off += 16) {
        const row = bytes.subarray(off, Math.min(off + 16, n));
        let hex = '';
        let ascii = '';
        for (let i = 0; i < 16; i++) {
          if (i === 8) hex += ' ';
          if (i < row.length) {
            hex += hex2(row[i]) + ' ';
            ascii += row[i] >= 0x20 && row[i] < 0x7f ? String.fromCharCode(row[i]) : '.';
          } else {
            hex += '   ';
          }
        }
        lines.push(off.toString(16).padStart(8, '0') + '  ' + hex + ' |' + ascii + '|');
      }
      output.textContent = lines.join('\n');
      const more = total > LIMIT ? ` · showing the first ${PK.formatBytes(LIMIT)}` : '';
      PK.setStatus(status, total ? `${label} · ${PK.formatBytes(total)}${more}` : '');
    }

    input.addEventListener('input', () => { zone.clear(); dump(new TextEncoder().encode(input.value), 'Text'); });
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;
      input.value = '';
      output.textContent = 'Reading…';
      // Only read the part we display, so huge files stay fast.
      const bytes = new Uint8Array(await file.slice(0, LIMIT).arrayBuffer());
      dump(bytes, `File "${file.name}"`, file.size);
    });

    PK.setupCopy($('[data-copy]'), () => output.textContent);
  },
});
