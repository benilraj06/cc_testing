PK.register({
  id: 'regex',
  title: 'Regex Tester',
  desc: 'Test regular expressions with live highlighting and capture groups.',
  icon: 'i-regex',
  category: 'Text',
  keywords: 'regular expression pattern match replace',
  wide: true,
  html: `
    <div class="card">
      <label class="field-label" for="reInput">Pattern</label>
      <div class="re-pattern">
        <span>/</span>
        <input class="input mono-in" id="reInput" value="(\\w+)@(\\w+)\\.com" autocomplete="off" spellcheck="false" aria-label="Regular expression">
        <span>/</span>
      </div>
      <div class="checks" style="margin-top:12px" id="reFlags">
        <label class="check" title="Find all matches"><input type="checkbox" value="g" checked> g · global</label>
        <label class="check" title="Ignore case"><input type="checkbox" value="i"> i · ignore case</label>
        <label class="check" title="^ and $ match at line breaks"><input type="checkbox" value="m"> m · multiline</label>
        <label class="check" title=". matches newlines"><input type="checkbox" value="s"> s · dot-all</label>
        <label class="check" title="Unicode mode"><input type="checkbox" value="u"> u · unicode</label>
      </div>
      <p class="status" id="reStatus"></p>
    </div>
    <div class="two-col">
      <div class="card">
        <label class="field-label" for="reText">Test text</label>
        <textarea id="reText" rows="7" class="mono-in" spellcheck="false">Contact ada@example.com or grace@navy.com.
Not an email: hello@world</textarea>
      </div>
      <div class="card result">
        <div class="result-head"><span class="field-label">Matches</span></div>
        <div id="reHighlight" class="mono re-out"></div>
      </div>
    </div>
    <div class="card" id="reListCard" hidden>
      <h2 class="card-title">Match details</h2>
      <div id="reList" class="re-list"></div>
    </div>
    <div class="card">
      <label class="field-label" for="reReplace">Replace with <span class="muted">(optional · use $1, $2 or $&lt;name&gt;)</span></label>
      <input class="input mono-in" id="reReplace" placeholder="$2: $1" autocomplete="off" spellcheck="false">
      <div id="reReplaceOut" hidden>
        <div class="result-head" style="margin-top:14px"><span class="field-label">Result</span>${PK.copyButton()}</div>
        <output id="reReplaced" class="mono"></output>
      </div>
    </div>`,

  init(root, $) {
    const MAX_MATCHES = 1000;
    const pattern = $('#reInput');
    const text = $('#reText');
    const replace = $('#reReplace');
    const status = $('#reStatus');
    const highlight = $('#reHighlight');
    const list = $('#reList');
    const esc = PK.escapeHTML;
    const flags = () => [...root.querySelectorAll('#reFlags input:checked')].map((c) => c.value).join('');

    function run() {
      const src = text.value;
      pattern.classList.remove('invalid');
      $('#reReplaceOut').hidden = true;
      let re;
      try {
        re = new RegExp(pattern.value, flags());
      } catch (err) {
        pattern.classList.add('invalid');
        PK.setStatus(status, err.message.replace(/^Invalid regular expression: /, ''), true);
        highlight.textContent = src;
        $('#reListCard').hidden = true;
        return;
      }

      // Collect matches; with the g flag find all, otherwise just the first.
      const matches = [];
      if (pattern.value) {
        const global = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
        for (const m of src.matchAll(global)) {
          matches.push(m);
          if (!re.flags.includes('g') || matches.length >= MAX_MATCHES) break;
        }
      }

      let html = '';
      let pos = 0;
      matches.forEach((m, i) => {
        html += esc(src.slice(pos, m.index));
        html += `<mark class="m${i % 2}">${esc(m[0]) || '<span class="re-empty"></span>'}</mark>`;
        pos = m.index + m[0].length;
      });
      highlight.innerHTML = html + esc(src.slice(pos));

      const capped = matches.length >= MAX_MATCHES ? ` (showing the first ${MAX_MATCHES})` : '';
      PK.setStatus(status, pattern.value ? `${matches.length} match${matches.length === 1 ? '' : 'es'}${capped}` : 'Type a pattern.');

      $('#reListCard').hidden = !matches.length;
      list.innerHTML = matches.slice(0, 100).map((m, i) => {
        const groups = m.slice(1).map((g, j) => `<tr><th>Group ${j + 1}</th><td>${g === undefined ? '<span class="muted">(no match)</span>' : esc(g)}</td></tr>`).join('');
        const named = m.groups ? Object.entries(m.groups).map(([k, g]) => `<tr><th>${esc(k)}</th><td>${g === undefined ? '<span class="muted">(no match)</span>' : esc(g)}</td></tr>`).join('') : '';
        return `<div class="re-item"><div class="re-item-head"><span class="badge ok">#${i + 1}</span> <code>${esc(m[0]) || '(empty)'}</code> <span class="muted">at index ${m.index}</span></div>${groups || named ? `<table class="kv">${groups}${named}</table>` : ''}</div>`;
      }).join('');

      if (replace.value) {
        $('#reReplaced').textContent = src.replace(re, replace.value);
        $('#reReplaceOut').hidden = false;
      }
    }

    const later = PK.debounce(run, 120);
    [pattern, text, replace].forEach((el) => el.addEventListener('input', later));
    root.querySelectorAll('#reFlags input').forEach((c) => c.addEventListener('change', run));
    PK.setupCopy($('[data-copy]'), () => $('#reReplaced').textContent);
    run();
  },
});
