PK.register({
  id: 'numbase',
  title: 'Number Base Converter',
  desc: 'Convert between binary, octal, decimal and hexadecimal.',
  icon: 'i-calc',
  category: 'Convert & Format',
  keywords: 'binary hex hexadecimal octal decimal radix',
  html: `
    <div class="card">
      <p class="status" style="margin:0 0 12px">Type in any box — the others update. Works with very large numbers.</p>
      <div class="nb-grid" id="nbGrid"></div>
      <p class="status" id="nbStatus"></p>
    </div>`,

  init(root, $) {
    const BASES = [
      { id: 'dec', name: 'Decimal', radix: 10, re: /^[0-9]+$/, prefix: '' },
      { id: 'hex', name: 'Hexadecimal', radix: 16, re: /^[0-9a-f]+$/i, prefix: '0x' },
      { id: 'bin', name: 'Binary', radix: 2, re: /^[01]+$/, prefix: '0b' },
      { id: 'oct', name: 'Octal', radix: 8, re: /^[0-7]+$/, prefix: '0o' },
    ];
    const status = $('#nbStatus');
    $('#nbGrid').innerHTML = BASES.map((b) => `
      <div class="field">
        <label class="field-label" for="nb-${b.id}">${b.name} <span class="val">base ${b.radix}</span></label>
        <div class="input-copy">
          <input class="input mono-in" id="nb-${b.id}" autocomplete="off" spellcheck="false" inputmode="${b.radix === 10 ? 'numeric' : 'text'}">
          ${PK.copyButton()}
        </div>
      </div>`).join('');
    const inputs = BASES.map((b) => $('#nb-' + b.id));
    root.querySelectorAll('[data-copy]').forEach((btn, i) => PK.setupCopy(btn, () => inputs[i].value));

    function parse(str, base) {
      let s = str.trim().replace(/[\s_]/g, '');
      const neg = s.startsWith('-');
      if (neg) s = s.slice(1);
      if (base.prefix && s.toLowerCase().startsWith(base.prefix)) s = s.slice(2);
      if (!s || !base.re.test(s)) return null;
      let v = 0n;
      const R = BigInt(base.radix);
      for (const ch of s.toLowerCase()) v = v * R + BigInt(parseInt(ch, base.radix));
      return neg ? -v : v;
    }

    function update(from) {
      const i = inputs.indexOf(from);
      const raw = from.value;
      inputs.forEach((el) => el.classList.remove('invalid'));
      if (!raw.trim()) {
        inputs.forEach((el) => { if (el !== from) el.value = ''; });
        PK.setStatus(status, '');
        return;
      }
      const v = parse(raw, BASES[i]);
      if (v === null) {
        from.classList.add('invalid');
        PK.setStatus(status, `Not a valid ${BASES[i].name.toLowerCase()} number.`, true);
        return;
      }
      const abs = v < 0n ? -v : v;
      BASES.forEach((b, j) => {
        if (j !== i) inputs[j].value = (v < 0n ? '-' : '') + abs.toString(b.radix).toUpperCase();
      });
      const bits = abs.toString(2).length;
      PK.setStatus(status, `${bits} bit${bits === 1 ? '' : 's'}${v > BigInt(Number.MAX_SAFE_INTEGER) ? ' · larger than JavaScript’s safe integer range' : ''}`);
    }

    inputs.forEach((el) => el.addEventListener('input', () => update(el)));
    inputs[0].value = '255';
    update(inputs[0]);
  },
});
