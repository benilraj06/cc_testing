PK.register({
  id: 'timestamp',
  title: 'Timestamp Converter',
  desc: 'Convert between Unix timestamps and readable dates.',
  icon: 'i-clock',
  category: 'Convert & Format',
  keywords: 'unix epoch time date utc iso',
  html: `
    <div class="card">
      <h2 class="card-title">Now</h2>
      <div class="out-list">
        <div class="out-row"><span class="out-name">Unix seconds</span><span class="out-val" id="tsNowS"></span>${PK.copyButton()}</div>
        <div class="out-row"><span class="out-name">Unix milliseconds</span><span class="out-val" id="tsNowMs"></span>${PK.copyButton()}</div>
      </div>
    </div>
    <div class="card">
      <h2 class="card-title">Timestamp → date</h2>
      <label class="field-label" for="tsInput">Unix timestamp (seconds or milliseconds)</label>
      <input class="input mono-in" id="tsInput" inputmode="numeric" placeholder="1700000000" autocomplete="off">
      <p class="status" id="tsStatus"></p>
      <div class="out-list" id="tsOut">
        <div class="out-row"><span class="out-name">Local time</span><span class="out-val" id="tsLocal"></span>${PK.copyButton()}</div>
        <div class="out-row"><span class="out-name">UTC (ISO 8601)</span><span class="out-val" id="tsIso"></span>${PK.copyButton()}</div>
        <div class="out-row"><span class="out-name">Relative</span><span class="out-val" id="tsRel"></span>${PK.copyButton()}</div>
      </div>
    </div>
    <div class="card">
      <h2 class="card-title">Date → timestamp</h2>
      <label class="field-label" for="tsDate">Local date and time</label>
      <input class="input" type="datetime-local" id="tsDate" step="1">
      <div class="out-list" style="margin-top:12px">
        <div class="out-row"><span class="out-name">Unix seconds</span><span class="out-val" id="tsToS"></span>${PK.copyButton()}</div>
        <div class="out-row"><span class="out-name">Unix milliseconds</span><span class="out-val" id="tsToMs"></span>${PK.copyButton()}</div>
      </div>
    </div>`,

  init(root, $) {
    const input = $('#tsInput');
    const status = $('#tsStatus');
    const dateIn = $('#tsDate');
    const ids = ['tsNowS', 'tsNowMs', 'tsLocal', 'tsIso', 'tsRel', 'tsToS', 'tsToMs'];
    root.querySelectorAll('[data-copy]').forEach((btn, i) => PK.setupCopy(btn, () => $('#' + ids[i]).textContent));

    const fmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'long' });

    function tick() {
      const now = Date.now();
      $('#tsNowS').textContent = Math.floor(now / 1000);
      $('#tsNowMs').textContent = now;
    }

    function fromTimestamp() {
      const raw = input.value.trim();
      input.classList.remove('invalid');
      ['tsLocal', 'tsIso', 'tsRel'].forEach((id) => { $('#' + id).textContent = ''; });
      if (!raw) { PK.setStatus(status, ''); return; }
      if (!/^-?\d+(\.\d+)?$/.test(raw)) {
        input.classList.add('invalid');
        PK.setStatus(status, 'Enter digits only, like 1700000000.', true);
        return;
      }
      const n = Number(raw);
      // Above ~year 5138 in seconds is more likely milliseconds.
      const isMs = Math.abs(n) >= 1e11;
      const d = new Date(isMs ? n : n * 1000);
      if (isNaN(d)) { input.classList.add('invalid'); PK.setStatus(status, 'That timestamp is out of range.', true); return; }
      $('#tsLocal').textContent = fmt.format(d);
      $('#tsIso').textContent = d.toISOString();
      $('#tsRel').textContent = PK.relativeTime(d);
      PK.setStatus(status, `Read as ${isMs ? 'milliseconds' : 'seconds'}`);
    }

    function fromDate() {
      const d = new Date(dateIn.value);
      $('#tsToS').textContent = isNaN(d) ? '' : Math.floor(d.getTime() / 1000);
      $('#tsToMs').textContent = isNaN(d) ? '' : d.getTime();
    }

    // Prefill the date picker with the current local time.
    const now = new Date();
    now.setMilliseconds(0);
    dateIn.value = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
    input.value = Math.floor(now.getTime() / 1000);

    input.addEventListener('input', fromTimestamp);
    dateIn.addEventListener('input', fromDate);
    tick();
    fromTimestamp();
    fromDate();
    // Only tick while this tool is visible.
    setInterval(() => { if (!root.hidden) { tick(); if ($('#tsRel').textContent) fromTimestamp(); } }, 1000);
  },
});
