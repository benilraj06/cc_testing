PK.register({
  id: 'color',
  title: 'Color Converter',
  desc: 'Convert HEX, RGB and HSL, and check text contrast.',
  icon: 'i-palette',
  category: 'Convert & Format',
  keywords: 'colour hex rgb hsl contrast wcag picker',
  html: `
    <div class="card">
      <label class="field-label" for="colorInput">Any CSS color</label>
      <div class="row" style="flex-wrap:nowrap">
        <input type="color" id="colorPick" value="#5b5bf0" aria-label="Pick a color">
        <input class="input mono-in" id="colorInput" value="#5b5bf0" autocomplete="off" spellcheck="false" placeholder="#5b5bf0, rgb(91 91 240), hsl(240 83% 65%), teal…">
      </div>
      <p class="status" id="colorStatus"></p>
    </div>
    <div class="card">
      <div class="swatch" id="colorSwatch"><span>Aa</span><span>Aa</span></div>
      <div class="out-list" style="margin-top:16px">
        <div class="out-row"><span class="out-name">HEX</span><span class="out-val" id="cHex"></span>${PK.copyButton()}</div>
        <div class="out-row"><span class="out-name">RGB</span><span class="out-val" id="cRgb"></span>${PK.copyButton()}</div>
        <div class="out-row"><span class="out-name">HSL</span><span class="out-val" id="cHsl"></span>${PK.copyButton()}</div>
      </div>
    </div>
    <div class="card">
      <h2 class="card-title">Contrast</h2>
      <table class="kv" id="colorContrast"></table>
    </div>`,

  init(root, $) {
    const input = $('#colorInput');
    const pick = $('#colorPick');
    const status = $('#colorStatus');
    const swatch = $('#colorSwatch');
    const outs = ['cHex', 'cRgb', 'cHsl'].map((id) => $('#' + id));
    root.querySelectorAll('[data-copy]').forEach((btn, i) => PK.setupCopy(btn, () => outs[i].textContent));
    const ctx = document.createElement('canvas').getContext('2d');

    // Let the browser parse any CSS color, then read back the pixel.
    function parse(str) {
      const s = str.trim();
      if (!s || !CSS.supports('color', s)) return null;
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000';
      ctx.fillStyle = s;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      return { r, g, b, a: a / 255 };
    }

    function toHsl({ r, g, b }) {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const l = (max + min) / 2;
      let h = 0, s = 0;
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
        h *= 60;
      }
      return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
    }

    const lum = ({ r, g, b }) => {
      const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
    const grade = (r) => r >= 7 ? '<span class="badge ok">AAA</span>' : r >= 4.5 ? '<span class="badge ok">AA</span>' : r >= 3 ? '<span class="badge warn">AA large text only</span>' : '<span class="badge bad">Fails</span>';

    function update(fromPicker) {
      const c = parse(fromPicker ? pick.value : input.value);
      input.classList.toggle('invalid', !c);
      if (!c) { PK.setStatus(status, 'Not a color the browser recognises.', true); return; }
      PK.setStatus(status, c.a < 1 ? 'Transparency is ignored for conversion and contrast.' : '');
      const hex = '#' + [c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, '0')).join('');
      const hsl = toHsl(c);
      if (fromPicker) input.value = hex; else pick.value = hex;
      outs[0].textContent = hex;
      outs[1].textContent = `rgb(${c.r}, ${c.g}, ${c.b})`;
      outs[2].textContent = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
      swatch.style.background = hex;
      const white = { r: 255, g: 255, b: 255 }, black = { r: 0, g: 0, b: 0 };
      const rw = ratio(c, white), rb = ratio(c, black);
      $('#colorContrast').innerHTML =
        `<tr><th>White text</th><td>${rw.toFixed(2)} : 1 ${grade(rw)}</td></tr>` +
        `<tr><th>Black text</th><td>${rb.toFixed(2)} : 1 ${grade(rb)}</td></tr>`;
    }

    input.addEventListener('input', () => update(false));
    pick.addEventListener('input', () => update(true));
    update(false);
  },
});
