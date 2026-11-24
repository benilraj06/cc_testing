PK.register({
  id: 'wordcount',
  title: 'Word Counter',
  desc: 'Words, characters, sentences and reading time.',
  icon: 'i-doc',
  category: 'Text',
  keywords: 'count characters letters length reading time',
  html: `
    <div class="card">
      <label class="field-label" for="wcInput">Text</label>
      <textarea id="wcInput" rows="8" placeholder="Type or paste text…"></textarea>
    </div>
    <div class="card">
      <div class="stats" id="wcStats"></div>
    </div>
    <div class="card" id="wcTopCard" hidden>
      <h2 class="card-title">Most used words</h2>
      <table class="kv" id="wcTop"></table>
    </div>`,

  init(root, $) {
    const input = $('#wcInput');
    const STATS = [
      ['words', 'Words'], ['chars', 'Characters'], ['noSpace', 'Without spaces'],
      ['sentences', 'Sentences'], ['paragraphs', 'Paragraphs'], ['lines', 'Lines'],
      ['read', 'Reading time'], ['speak', 'Speaking time'],
    ];
    $('#wcStats').innerHTML = STATS.map(([k, label]) =>
      `<div class="stat"><div class="stat-v" data-stat="${k}">0</div><div class="stat-l">${label}</div></div>`).join('');
    const STOP = new Set('the a an and or but of to in on at for with is it this that be as are was by from'.split(' '));
    const segmenter = window.Intl && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'word' }) : null;
    const graphemes = window.Intl && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

    function wordList(s) {
      if (segmenter) return [...segmenter.segment(s)].filter((x) => x.isWordLike).map((x) => x.segment);
      return s.match(/[\p{L}\p{N}'’-]+/gu) || [];
    }

    function duration(words, wpm) {
      const sec = Math.round((words / wpm) * 60);
      if (!sec) return '0 s';
      return sec < 60 ? `${sec} s` : `${Math.floor(sec / 60)} min ${sec % 60 ? (sec % 60) + ' s' : ''}`.trim();
    }

    function run() {
      const s = input.value;
      const words = wordList(s);
      const chars = graphemes ? [...graphemes.segment(s)].length : [...s].length;
      const v = {
        words: words.length,
        chars,
        noSpace: chars - (s.match(/\s/g) || []).length,
        sentences: s.trim() ? (s.match(/[^.!?…]+[.!?…]+(\s|$)|[^.!?…]+$/g) || []).filter((x) => x.trim()).length : 0,
        paragraphs: s.split(/\n\s*\n/).filter((p) => p.trim()).length,
        lines: s ? s.split('\n').length : 0,
        read: duration(words.length, 238),
        speak: duration(words.length, 150),
      };
      for (const [k] of STATS) {
        root.querySelector(`[data-stat="${k}"]`).textContent = typeof v[k] === 'number' ? v[k].toLocaleString() : v[k];
      }

      const freq = new Map();
      words.forEach((w) => {
        const k = w.toLowerCase();
        if (k.length > 2 && !STOP.has(k)) freq.set(k, (freq.get(k) || 0) + 1);
      });
      const top = [...freq].sort((x, y) => y[1] - x[1]).slice(0, 5).filter(([, n]) => n > 1);
      $('#wcTopCard').hidden = !top.length;
      $('#wcTop').innerHTML = top.map(([w, n]) => `<tr><th>${PK.escapeHTML(w)}</th><td>${n}×</td></tr>`).join('');
    }

    input.addEventListener('input', run);
    run();
  },
});
