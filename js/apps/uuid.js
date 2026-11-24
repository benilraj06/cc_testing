PK.register({
  id: 'uuid',
  title: 'UUID Generator',
  desc: 'Random (v4) or time-ordered (v7) unique IDs, one or many at a time.',
  icon: 'i-dice',
  category: 'Generate',
  keywords: 'guid unique id identifier random',
  html: `
    <div class="segmented" role="radiogroup" aria-label="Version">
      <label><input type="radio" name="uuidVer" value="4" checked><span>v4 · random</span></label>
      <label><input type="radio" name="uuidVer" value="7"><span>v7 · time-ordered</span></label>
    </div>
    <div class="card">
      <div class="row">
        <div class="field" style="flex:0 1 140px">
          <label class="field-label" for="uuidCount">How many</label>
          <input class="input" type="number" id="uuidCount" min="1" max="500" value="5">
        </div>
        <div class="checks">
          <label class="check"><input type="checkbox" id="uuidUpper"> Uppercase</label>
          <label class="check"><input type="checkbox" id="uuidNoDash"> No hyphens</label>
          <label class="check"><input type="checkbox" id="uuidBraces"> {Braces}</label>
        </div>
      </div>
    </div>
    <div class="card result">
      <div class="result-head">
        <span class="field-label" id="uuidLabel">UUIDs</span>
        <div class="btn-row" style="margin:0">
          <button class="btn btn-ghost btn-sm" id="uuidRegen" type="button">${PK.icon('i-refresh')}Generate</button>
          ${PK.copyButton('Copy all')}
        </div>
      </div>
      <output id="uuidOutput" class="mono tall"></output>
    </div>`,

  init(root, $) {
    const output = $('#uuidOutput');
    const count = $('#uuidCount');
    const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

    function v4() {
      if (crypto.randomUUID) return crypto.randomUUID();
      const b = crypto.getRandomValues(new Uint8Array(16));
      b[6] = (b[6] & 0x0f) | 0x40;
      b[8] = (b[8] & 0x3f) | 0x80;
      return format(b);
    }

    // RFC 9562 UUIDv7: 48-bit Unix ms timestamp, then random bits.
    let lastMs = 0;
    let seq = 0;
    function v7() {
      const b = crypto.getRandomValues(new Uint8Array(16));
      let ms = Date.now();
      // Keep IDs generated in the same millisecond in order.
      if (ms <= lastMs) { ms = lastMs; seq++; } else { seq = 0; }
      lastMs = ms;
      for (let i = 5; i >= 0; i--) { b[i] = ms % 256; ms = Math.floor(ms / 256); }
      b[6] = 0x70 | ((seq >> 8) & 0x0f);
      b[7] = seq & 0xff;
      b[8] = (b[8] & 0x3f) | 0x80;
      return format(b);
    }

    function format(b) {
      const h = hex(b);
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    }

    function generate() {
      const n = Math.min(500, Math.max(1, Math.floor(Number(count.value)) || 1));
      const ver = root.querySelector('input[name="uuidVer"]:checked').value;
      const ids = Array.from({ length: n }, () => {
        let id = ver === '7' ? v7() : v4();
        if ($('#uuidNoDash').checked) id = id.replace(/-/g, '');
        if ($('#uuidUpper').checked) id = id.toUpperCase();
        if ($('#uuidBraces').checked) id = `{${id}}`;
        return id;
      });
      output.textContent = ids.join('\n');
      $('#uuidLabel').textContent = n === 1 ? 'UUID' : `${n} UUIDs`;
    }

    root.querySelectorAll('input').forEach((el) => el.addEventListener('input', generate));
    $('#uuidRegen').addEventListener('click', generate);
    PK.setupCopy($('[data-copy]'), () => output.textContent);
    generate();
  },
});
