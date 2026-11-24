PK.register({
  id: 'case',
  title: 'Case Converter',
  desc: 'camelCase, snake_case, Title Case and more, all at once.',
  icon: 'i-case',
  category: 'Convert & Format',
  keywords: 'camel snake kebab pascal title upper lower constant',
  html: `
    <div class="card">
      <label class="field-label" for="caseInput">Text</label>
      <textarea id="caseInput" rows="3" placeholder="Type or paste text…">Hello world from Pocketknife</textarea>
    </div>
    <div class="card"><div class="out-list" id="caseList"></div></div>`,

  init(root, $) {
    const input = $('#caseInput');
    // Split on spaces/punctuation and on camelCase / acronym boundaries.
    const words = (s) => s
      .replace(/([a-z\d])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean);
    const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

    const CASES = [
      ['camelCase', (w) => w.map((x, i) => i ? cap(x) : x.toLowerCase()).join('')],
      ['PascalCase', (w) => w.map(cap).join('')],
      ['snake_case', (w) => w.map((x) => x.toLowerCase()).join('_')],
      ['kebab-case', (w) => w.map((x) => x.toLowerCase()).join('-')],
      ['CONSTANT_CASE', (w) => w.map((x) => x.toUpperCase()).join('_')],
      ['dot.case', (w) => w.map((x) => x.toLowerCase()).join('.')],
      ['Title Case', null, (s) => s.toLowerCase().replace(/(^|[\s\-(“"'])(\p{L})/gu, (m, p, c) => p + c.toUpperCase())],
      ['Sentence case', null, (s) => s.toLowerCase().replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (m, p, c) => p + c.toUpperCase())],
      ['lowercase', null, (s) => s.toLowerCase()],
      ['UPPERCASE', null, (s) => s.toUpperCase()],
    ];

    $('#caseList').innerHTML = CASES.map(([name]) => `
      <div class="out-row"><span class="out-name">${name}</span><span class="out-val" data-case></span>${PK.copyButton()}</div>`).join('');
    const vals = [...root.querySelectorAll('[data-case]')];
    root.querySelectorAll('[data-copy]').forEach((btn, i) => PK.setupCopy(btn, () => vals[i].textContent));

    function run() {
      const s = input.value;
      const w = words(s);
      CASES.forEach(([, fromWords, fromText], i) => {
        vals[i].textContent = fromWords ? fromWords(w) : fromText(s);
      });
    }

    input.addEventListener('input', run);
    run();
  },
});
