PK.register({
  id: 'diff',
  title: 'Text Diff',
  desc: 'Compare two texts and highlight what changed.',
  icon: 'i-diff',
  category: 'Text',
  keywords: 'compare difference changes merge',
  wide: true,
  html: `
    <div class="segmented" role="radiogroup" aria-label="Compare by">
      <label><input type="radio" name="diffMode" value="line" checked><span>Lines</span></label>
      <label><input type="radio" name="diffMode" value="word"><span>Words</span></label>
    </div>
    <div class="two-col">
      <div class="card">
        <label class="field-label" for="diffA">Original</label>
        <textarea id="diffA" rows="8" class="mono-in" spellcheck="false">The quick brown fox
jumps over the lazy dog.
Pack my box with five dozen liquor jugs.</textarea>
      </div>
      <div class="card">
        <label class="field-label" for="diffB">Changed</label>
        <textarea id="diffB" rows="8" class="mono-in" spellcheck="false">The quick brown fox
leaps over the lazy cat.
Pack my box with five dozen liquor jugs.
How vexingly quick daft zebras jump!</textarea>
      </div>
    </div>
    <div class="card result">
      <div class="result-head">
        <span class="field-label">Differences <span id="diffSummary"></span></span>
      </div>
      <div id="diffOutput" class="mono diff-out tall"></div>
      <p class="status" id="diffStatus"></p>
    </div>`,

  init(root, $) {
    const a = $('#diffA');
    const b = $('#diffB');
    const out = $('#diffOutput');
    const status = $('#diffStatus');
    const summary = $('#diffSummary');
    const MAX_CELLS = 4e6; // LCS table limit to keep the page responsive
    const esc = PK.escapeHTML;

    // Longest-common-subsequence diff. Returns [{type: '=', '-', '+', value}].
    function diff(x, y) {
      // Trim the common start and end first; it makes typical edits cheap.
      let start = 0;
      while (start < x.length && start < y.length && x[start] === y[start]) start++;
      let endX = x.length, endY = y.length;
      while (endX > start && endY > start && x[endX - 1] === y[endY - 1]) { endX--; endY--; }
      const xs = x.slice(start, endX), ys = y.slice(start, endY);
      const n = xs.length, m = ys.length;
      if ((n + 1) * (m + 1) > MAX_CELLS) return null;

      const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
      for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
          dp[i][j] = xs[i] === ys[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
      const ops = x.slice(0, start).map((v) => ({ type: '=', value: v }));
      let i = 0, j = 0;
      while (i < n && j < m) {
        if (xs[i] === ys[j]) { ops.push({ type: '=', value: xs[i] }); i++; j++; }
        else if (dp[i + 1][j] >= dp[i][j + 1]) ops.push({ type: '-', value: xs[i++] });
        else ops.push({ type: '+', value: ys[j++] });
      }
      while (i < n) ops.push({ type: '-', value: xs[i++] });
      while (j < m) ops.push({ type: '+', value: ys[j++] });
      x.slice(endX).forEach((v) => ops.push({ type: '=', value: v }));
      return ops;
    }

    function run() {
      const byLine = root.querySelector('input[name="diffMode"]:checked').value === 'line';
      const split = (s) => byLine ? s.split('\n') : s.split(/(\s+)/).filter((t) => t !== '');
      const ops = diff(split(a.value), split(b.value));
      if (!ops) {
        out.innerHTML = '';
        summary.textContent = '';
        PK.setStatus(status, 'These texts are too large to compare here. Try comparing by lines, or smaller pieces.', true);
        return;
      }
      const added = ops.filter((o) => o.type === '+' && o.value.trim()).length;
      const removed = ops.filter((o) => o.type === '-' && o.value.trim()).length;
      const unit = byLine ? 'line' : 'word';
      summary.innerHTML = `<span class="badge ok">+${added}</span> <span class="badge bad">−${removed}</span>`;

      if (byLine) {
        out.innerHTML = ops.map((o) => {
          const cls = o.type === '+' ? 'ins' : o.type === '-' ? 'del' : '';
          const sign = o.type === '=' ? ' ' : o.type === '+' ? '+' : '−';
          return `<div class="diff-line ${cls}"><span class="diff-sign">${sign}</span>${esc(o.value) || ' '}</div>`;
        }).join('');
      } else {
        out.innerHTML = ops.map((o) => o.type === '=' ? esc(o.value)
          : `<${o.type === '+' ? 'ins' : 'del'}>${esc(o.value)}</${o.type === '+' ? 'ins' : 'del'}>`).join('');
      }
      PK.setStatus(status, added || removed
        ? `${added} ${unit}${added === 1 ? '' : 's'} added, ${removed} removed`
        : 'The texts are identical.');
    }

    const later = PK.debounce(run, 200);
    a.addEventListener('input', later);
    b.addEventListener('input', later);
    root.querySelectorAll('input[name="diffMode"]').forEach((r) => r.addEventListener('change', run));
    run();
  },
});
