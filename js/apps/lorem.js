PK.register({
  id: 'lorem',
  title: 'Lorem Ipsum',
  desc: 'Placeholder paragraphs, sentences or words for mock-ups.',
  icon: 'i-text',
  category: 'Generate',
  keywords: 'placeholder dummy filler text',
  html: `
    <div class="card">
      <div class="row">
        <div class="field" style="flex:0 1 120px">
          <label class="field-label" for="loremCount">Amount</label>
          <input class="input" type="number" id="loremCount" min="1" max="100" value="3">
        </div>
        <div class="field">
          <label class="field-label" for="loremUnit">Of</label>
          <select class="input" id="loremUnit">
            <option value="p" selected>Paragraphs</option>
            <option value="s">Sentences</option>
            <option value="w">Words</option>
          </select>
        </div>
      </div>
      <div class="checks" style="margin-top:14px">
        <label class="check"><input type="checkbox" id="loremStart" checked> Start with “Lorem ipsum dolor sit amet”</label>
        <label class="check"><input type="checkbox" id="loremHtml"> Wrap paragraphs in &lt;p&gt;</label>
      </div>
    </div>
    <div class="card result">
      <div class="result-head">
        <span class="field-label">Text</span>
        <div class="btn-row" style="margin:0">
          <button class="btn btn-ghost btn-sm" id="loremRegen" type="button">${PK.icon('i-refresh')}Generate</button>
          ${PK.copyButton()}
        </div>
      </div>
      <output id="loremOutput" class="mono tall lorem-out"></output>
      <p class="status" id="loremStatus"></p>
    </div>`,

  init(root, $) {
    const WORDS = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum curabitur pretium tincidunt lacus nunc mauris porta vitae ornare augue integer feugiat scelerisque varius morbi tristique senectus netus malesuada fames turpis egestas pellentesque habitant'.split(' ');
    const OPENING = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit';
    const output = $('#loremOutput');
    const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    const word = () => WORDS[Math.floor(Math.random() * WORDS.length)];
    const cap = (s) => s[0].toUpperCase() + s.slice(1);

    function sentence() {
      const n = rand(6, 14);
      const w = Array.from({ length: n }, word);
      if (n > 8 && Math.random() < 0.5) w[rand(3, n - 4)] += ',';
      return cap(w.join(' ')) + '.';
    }
    const paragraph = () => Array.from({ length: rand(4, 7) }, sentence).join(' ');

    function generate() {
      const n = Math.min(100, Math.max(1, Math.floor(Number($('#loremCount').value)) || 1));
      const unit = $('#loremUnit').value;
      const start = $('#loremStart').checked;
      let text;
      if (unit === 'w') {
        const w = Array.from({ length: n }, word);
        if (start) OPENING.toLowerCase().replace(/,/g, '').split(' ').slice(0, n).forEach((x, i) => { w[i] = x; });
        text = cap(w.join(' ')) + '.';
      } else if (unit === 's') {
        const s = Array.from({ length: n }, sentence);
        if (start) s[0] = OPENING + '.';
        text = s.join(' ');
      } else {
        const p = Array.from({ length: n }, paragraph);
        if (start) p[0] = OPENING + '. ' + p[0];
        text = $('#loremHtml').checked ? p.map((x) => `<p>${x}</p>`).join('\n\n') : p.join('\n\n');
      }
      output.textContent = text;
      const words = text.replace(/<\/?p>/g, '').split(/\s+/).filter(Boolean).length;
      PK.setStatus($('#loremStatus'), `${words.toLocaleString()} words · ${text.length.toLocaleString()} characters`);
      $('#loremHtml').closest('.check').hidden = unit !== 'p';
    }

    root.querySelectorAll('input, select').forEach((el) => el.addEventListener('input', generate));
    $('#loremRegen').addEventListener('click', generate);
    PK.setupCopy($('[data-copy]'), () => output.textContent);
    generate();
  },
});
