PK.register({
  id: 'url',
  title: 'URL Encoder',
  desc: 'Percent-encode or decode text, and break a URL into its parts.',
  icon: 'i-link',
  category: 'Hash & Encode',
  keywords: 'percent encode decode query string uri',
  html: `
    <div class="segmented" role="radiogroup" aria-label="Mode">
      <label><input type="radio" name="urlMode" value="encode" checked><span>Encode</span></label>
      <label><input type="radio" name="urlMode" value="decode"><span>Decode</span></label>
    </div>
    <div class="card">
      <label class="field-label" for="urlInput" id="urlInputLabel">Text</label>
      <textarea id="urlInput" rows="4" class="mono-in" placeholder="Type or paste text…"></textarea>
      <div class="checks" style="margin-top:12px">
        <label class="check" id="urlWholeWrap"><input type="checkbox" id="urlWhole"> Keep URL characters (: / ? &amp; =)</label>
        <label class="check" id="urlPlusWrap" hidden><input type="checkbox" id="urlPlus" checked> Treat + as space</label>
      </div>
    </div>
    ${PK.resultCard('urlOutput', 'Encoded')}
    <div class="card" id="urlPartsCard" hidden>
      <h2 class="card-title">URL parts</h2>
      <table class="kv" id="urlParts"></table>
    </div>`,

  init(root, $) {
    const input = $('#urlInput');
    const output = $('#urlOutput');
    const status = $('#urlOutputStatus');
    const whole = $('#urlWhole');
    const plus = $('#urlPlus');
    const partsCard = $('#urlPartsCard');
    const parts = $('#urlParts');
    const mode = () => root.querySelector('input[name="urlMode"]:checked').value;
    const esc = PK.escapeHTML;

    function showParts(text) {
      let u;
      try { u = new URL(text.trim()); } catch { partsCard.hidden = true; return; }
      if (!/^https?:|^ftp:|^wss?:/.test(u.protocol)) { partsCard.hidden = true; return; }
      const rows = [
        ['Protocol', u.protocol.replace(':', '')],
        ['Host', u.hostname],
        ['Port', u.port || '(default)'],
        ['Path', decodeSafe(u.pathname)],
      ];
      for (const [k, v] of u.searchParams) rows.push([`Query: ${k}`, v]);
      if (u.hash) rows.push(['Fragment', decodeSafe(u.hash.slice(1))]);
      parts.innerHTML = rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v) || '<span class="muted">(empty)</span>'}</td></tr>`).join('');
      partsCard.hidden = false;
    }

    function decodeSafe(s) { try { return decodeURIComponent(s); } catch { return s; } }

    function run() {
      const text = input.value;
      const enc = mode() === 'encode';
      if (enc) {
        output.textContent = whole.checked ? encodeURI(text) : encodeURIComponent(text);
        PK.setStatus(status, '');
        showParts(text);
        return;
      }
      try {
        output.textContent = decodeURIComponent(plus.checked ? text.replace(/\+/g, ' ') : text);
        PK.setStatus(status, '');
        showParts(output.textContent);
      } catch {
        output.textContent = '';
        PK.setStatus(status, 'Malformed percent-encoding (a % must be followed by two hex digits).', true);
        partsCard.hidden = true;
      }
    }

    function updateMode() {
      const enc = mode() === 'encode';
      $('#urlInputLabel').textContent = enc ? 'Text' : 'Encoded text';
      $('#urlOutputLabel').textContent = enc ? 'Encoded' : 'Decoded';
      input.placeholder = enc ? 'Type or paste text…' : 'Paste percent-encoded text…';
      $('#urlWholeWrap').hidden = !enc;
      $('#urlPlusWrap').hidden = enc;
      run();
    }

    input.addEventListener('input', run);
    whole.addEventListener('change', run);
    plus.addEventListener('change', run);
    root.querySelectorAll('input[name="urlMode"]').forEach((r) => r.addEventListener('change', updateMode));
    PK.setupCopy($('[data-copy]'), () => output.textContent);
    updateMode();
  },
});
