PK.register({
  id: 'json',
  title: 'JSON Formatter',
  desc: 'Pretty-print, minify and validate JSON, with clear error locations.',
  icon: 'i-braces',
  category: 'Convert & Format',
  keywords: 'beautify minify validate lint pretty print',
  wide: true,
  html: `
    <div class="card">
      <label class="field-label" for="jsonInput">JSON</label>
      <textarea id="jsonInput" rows="8" class="mono-in" placeholder='{"name": "Pocketknife", "tools": 18}' spellcheck="false"></textarea>
      <div class="row" style="margin-top:14px">
        <div class="field" style="flex:0 1 180px">
          <label class="field-label" for="jsonIndent">Output</label>
          <select class="input" id="jsonIndent">
            <option value="2" selected>Pretty · 2 spaces</option>
            <option value="4">Pretty · 4 spaces</option>
            <option value="tab">Pretty · tabs</option>
            <option value="min">Minified</option>
          </select>
        </div>
        <div class="checks">
          <label class="check"><input type="checkbox" id="jsonSort"> Sort keys</label>
        </div>
      </div>
    </div>
    ${PK.resultCard('jsonOutput', 'Formatted')}`,

  init(root, $) {
    const input = $('#jsonInput');
    const output = $('#jsonOutput');
    const status = $('#jsonOutputStatus');
    output.classList.add('pre', 'tall');

    const sortKeys = (v) => Array.isArray(v) ? v.map(sortKeys)
      : v && typeof v === 'object'
        ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]))
        : v;

    // Browsers word JSON errors differently (and some omit the position), so
    // find the first bad character with a small scanner of our own.
    function findError(s) {
      let i = 0;
      const fail = (msg) => { throw { pos: i, msg: i >= s.length ? 'Unexpected end of input' : msg }; };
      const ws = () => { while (i < s.length && ' \t\n\r'.includes(s[i])) i++; };
      const lit = (word) => { if (s.startsWith(word, i)) i += word.length; else fail('Unexpected character'); };
      function str() {
        i++; // opening quote
        while (i < s.length && s[i] !== '"') {
          if (s[i] === '\\') {
            i++;
            if (s[i] === 'u') { if (!/^[0-9a-fA-F]{4}$/.test(s.substr(i + 1, 4))) fail('Bad \\u escape'); i += 5; continue; }
            if (!'"\\/bfnrt'.includes(s[i])) fail('Bad escape');
          } else if (s.charCodeAt(i) < 0x20) fail('Unescaped control character in string');
          i++;
        }
        if (i >= s.length) fail('Unterminated string');
        i++;
      }
      function value() {
        ws();
        const c = s[i];
        if (c === '{') {
          i++; ws();
          if (s[i] === '}') { i++; return; }
          for (;;) {
            ws();
            if (s[i] !== '"') fail('Expected a "quoted" key');
            str(); ws();
            if (s[i] !== ':') fail('Expected ":"');
            i++; value(); ws();
            if (s[i] === ',') { i++; ws(); if (s[i] === '}') fail('Trailing comma'); continue; }
            if (s[i] === '}') { i++; return; }
            fail('Expected "," or "}"');
          }
        }
        if (c === '[') {
          i++; ws();
          if (s[i] === ']') { i++; return; }
          for (;;) {
            value(); ws();
            if (s[i] === ',') { i++; ws(); if (s[i] === ']') fail('Trailing comma'); continue; }
            if (s[i] === ']') { i++; return; }
            fail('Expected "," or "]"');
          }
        }
        if (c === '"') return str();
        if (c === 't') return lit('true');
        if (c === 'f') return lit('false');
        if (c === 'n') return lit('null');
        const m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(s.slice(i));
        if (m && m[0]) { i += m[0].length; return; }
        fail(i >= s.length ? 'Unexpected end of input' : 'Unexpected character');
      }
      try {
        value(); ws();
        if (i < s.length) fail('Unexpected text after the JSON value');
      } catch (e) {
        if (e.pos === undefined) throw e;
        const before = s.slice(0, e.pos).split('\n');
        const ch = s[e.pos];
        return `${e.msg}${ch ? ` "${ch}"` : ''} at line ${before.length}, column ${before[before.length - 1].length + 1}`;
      }
      return null;
    }

    function count(v) {
      let n = 0;
      (function walk(x) { if (x && typeof x === 'object') { for (const k in x) { n++; walk(x[k]); } } })(v);
      return n;
    }

    function run() {
      const text = input.value;
      input.classList.remove('invalid');
      if (!text.trim()) { output.textContent = ''; PK.setStatus(status, ''); return; }
      let value;
      try {
        value = JSON.parse(text);
      } catch (err) {
        input.classList.add('invalid');
        output.textContent = '';
        const where = findError(text);
        PK.setStatus(status, `Invalid JSON: ${where || err.message.replace(/^JSON\.parse: /, '')}`, true);
        return;
      }
      if ($('#jsonSort').checked) value = sortKeys(value);
      const ind = $('#jsonIndent').value;
      output.textContent = JSON.stringify(value, null, ind === 'min' ? 0 : ind === 'tab' ? '\t' : Number(ind));
      $('#jsonOutputLabel').textContent = ind === 'min' ? 'Minified' : 'Formatted';
      PK.setStatus(status, `Valid JSON · ${count(value).toLocaleString()} values · ${output.textContent.length.toLocaleString()} characters`);
    }

    input.addEventListener('input', PK.debounce(run, 120));
    $('#jsonIndent').addEventListener('change', run);
    $('#jsonSort').addEventListener('change', run);
    PK.setupCopy($('[data-copy]'), () => output.textContent);
  },
});
