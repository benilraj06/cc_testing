PK.register({
  id: 'qr',
  title: 'QR Code Maker',
  desc: 'Turn text or a link into a QR code you can download.',
  icon: 'i-qr',
  category: 'Generate',
  keywords: 'qrcode barcode scan link',
  html: `
    <div class="card">
      <label class="field-label" for="qrInput">Text or link</label>
      <textarea id="qrInput" rows="3" placeholder="https://example.com">https://benilraj06.github.io/cc_testing/</textarea>
      <div class="row" style="margin-top:14px">
        <div class="field">
          <label class="field-label" for="qrEcc">Error correction</label>
          <select class="input" id="qrEcc">
            <option value="L">Low (7%)</option>
            <option value="M" selected>Medium (15%)</option>
            <option value="Q">Quartile (25%)</option>
            <option value="H">High (30%)</option>
          </select>
        </div>
        <div class="field">
          <label class="field-label" for="qrSize">Download size</label>
          <select class="input" id="qrSize">
            <option value="256">256 px</option>
            <option value="512" selected>512 px</option>
            <option value="1024">1024 px</option>
          </select>
        </div>
      </div>
    </div>
    <div class="card qr-card">
      <div class="qr-box"><canvas id="qrCanvas" aria-label="QR code"></canvas></div>
      <p class="status" id="qrStatus"></p>
      <div class="btn-row qr-actions">
        <button class="btn btn-primary btn-sm" id="qrPng" type="button">${PK.icon('i-download')}PNG</button>
        <button class="btn btn-ghost btn-sm" id="qrSvg" type="button">${PK.icon('i-download')}SVG</button>
      </div>
    </div>`,

  init(root, $) {
    // Encode text as UTF-8 so non-ASCII characters scan correctly.
    qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
    const input = $('#qrInput');
    const canvas = $('#qrCanvas');
    const status = $('#qrStatus');
    const buttons = [$('#qrPng'), $('#qrSvg')];
    const MARGIN = 4; // quiet zone, in modules
    let qr = null;

    function make() {
      const text = input.value;
      qr = null;
      if (!text) {
        canvas.hidden = true;
        buttons.forEach((b) => { b.disabled = true; });
        PK.setStatus(status, 'Type something to make a QR code.');
        return;
      }
      try {
        const q = qrcode(0, $('#qrEcc').value);
        q.addData(text);
        q.make();
        qr = q;
      } catch {
        canvas.hidden = true;
        buttons.forEach((b) => { b.disabled = true; });
        PK.setStatus(status, 'Too much text for a QR code. Shorten it or lower the error correction.', true);
        return;
      }
      draw(canvas, 8);
      canvas.hidden = false;
      buttons.forEach((b) => { b.disabled = false; });
      const n = qr.getModuleCount();
      PK.setStatus(status, `${n}×${n} modules · ${new TextEncoder().encode(text).length} bytes`);
    }

    // Draws black modules on white (always light, so phones can scan it in dark mode).
    function draw(cv, scale) {
      const n = qr.getModuleCount();
      const size = (n + MARGIN * 2) * scale;
      cv.width = cv.height = size;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#000';
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (qr.isDark(r, c)) ctx.fillRect((c + MARGIN) * scale, (r + MARGIN) * scale, scale, scale);
        }
      }
    }

    $('#qrPng').addEventListener('click', () => {
      if (!qr) return;
      const target = Number($('#qrSize').value);
      const scale = Math.max(1, Math.round(target / (qr.getModuleCount() + MARGIN * 2)));
      const cv = document.createElement('canvas');
      draw(cv, scale);
      PK.download('qrcode.png', cv.toDataURL('image/png'));
    });

    $('#qrSvg').addEventListener('click', () => {
      if (!qr) return;
      const svg = qr.createSvgTag({ cellSize: 8, margin: MARGIN * 8, scalable: true });
      PK.download('qrcode.svg', 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
    });

    input.addEventListener('input', PK.debounce(make, 120));
    $('#qrEcc').addEventListener('change', make);
    make();
  },
});
