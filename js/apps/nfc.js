PK.register({
  id: 'nfc',
  title: 'NFC Reader',
  desc: 'Read NFC tags and stickers with your phone (Chrome on Android).',
  icon: 'i-nfc',
  category: 'Device',
  keywords: 'nfc ndef tag sticker reader rfid contactless serial uid scan',
  html: `
    <div class="card gps-control">
      <div class="gps-state">
        <span class="gps-dot" id="nfcDot"></span>
        <div>
          <div class="gps-state-title" id="nfcStateTitle">Not scanning</div>
          <div class="status" id="nfcStatus" style="margin:0">Tap Start, then hold a tag against the back of your phone.</div>
        </div>
      </div>
      <button class="btn btn-primary btn-sm" id="nfcToggle" type="button">${PK.icon('i-nfc')}<span>Start</span></button>
    </div>

    <div class="card nfc-unsupported" id="nfcUnsupported" hidden>
      <div class="card-title">NFC isn’t available in this browser</div>
      <p class="muted">Web pages can read NFC tags only in <strong>Chrome on Android</strong>, on a phone with NFC. iPhone and desktop browsers don’t let websites use NFC, so this tool can’t work there.</p>
    </div>

    <div class="card nfc-wait" id="nfcWait" hidden>
      <div class="nfc-pulse" aria-hidden="true">${PK.icon('i-nfc')}</div>
      <p class="muted">Hold a tag flat against the back of your phone, near the camera, for a second.</p>
    </div>

    <div class="card" id="nfcReadsCard" hidden>
      <div class="result-head">
        <span class="field-label">Tags read</span>
        <button class="btn btn-ghost btn-sm" id="nfcClear" type="button">Clear</button>
      </div>
      <div id="nfcReads" class="nfc-reads"></div>
    </div>

    <div class="card">
      <div class="card-title">Good to know</div>
      <ul class="tip-list muted">
        <li>Only tags with NDEF data (links, text, contact cards) show their contents. Bank cards, ID cards and most door or transit cards are locked and can’t be read by web pages.</li>
        <li>NFC must be turned on in your phone’s settings.</li>
        <li>Scanning stops when you leave this page or switch apps.</li>
      </ul>
    </div>`,

  init(root, $) {
    const toggle = $('#nfcToggle');
    const label = toggle.querySelector('span');
    const status = $('#nfcStatus');
    const supported = 'NDEFReader' in window;
    const reads = [];
    let ctrl = null;
    let reader = null;

    function setState(kind, title, msg, isError = false) {
      $('#nfcDot').className = 'gps-dot ' + kind;
      $('#nfcStateTitle').textContent = title;
      PK.setStatus(status, msg, isError);
    }

    if (!supported) {
      $('#nfcUnsupported').hidden = false;
      toggle.disabled = true;
      setState('error', 'Not supported', 'This browser has no Web NFC.');
    }

    const hex = (view, max = 256) => {
      const n = Math.min(view.byteLength, max);
      const parts = [];
      for (let i = 0; i < n; i++) parts.push(view.getUint8(i).toString(16).padStart(2, '0'));
      return parts.join(' ') + (view.byteLength > max ? ` … (${view.byteLength} bytes)` : '');
    };
    const text = (view, enc = 'utf-8') => {
      try { return new TextDecoder(enc).decode(view); } catch { return new TextDecoder().decode(view); }
    };

    // Turns one NDEF record into { type, value, extra } for display.
    function describe(rec, depth = 0) {
      const d = rec.data;
      let type = rec.recordType;
      let value = '';
      const extra = [];
      switch (rec.recordType) {
        case 'empty': value = '(empty)'; break;
        case 'text':
          type = 'Text';
          value = d ? text(d, rec.encoding || 'utf-8') : '';
          if (rec.lang) extra.push(`language ${rec.lang}`);
          break;
        case 'url': case 'absolute-url':
          type = 'Link';
          value = d ? text(d) : '';
          break;
        case 'mime':
          type = `File (${rec.mediaType})`;
          if (d && /^(text\/|application\/(json|xml)|text\/vcard)/i.test(rec.mediaType || '')) value = text(d);
          else if (d) value = hex(d);
          break;
        case 'smart-poster': {
          type = 'Smart poster';
          let inner = [];
          try { inner = rec.toRecords() || []; } catch { /* unreadable */ }
          value = inner.map((r) => { const x = describe(r, depth + 1); return `${x.type}: ${x.value}`; }).join('\n');
          break;
        }
        case 'unknown': type = 'Unknown'; value = d ? hex(d) : ''; break;
        default:
          // External ("example.com:type") and local records.
          type = `Custom (${rec.recordType})`;
          value = d ? hex(d) : '';
      }
      if (rec.id) extra.push(`id ${rec.id}`);
      return { type, value, extra: extra.join(' · ') };
    }

    function render() {
      $('#nfcReadsCard').hidden = reads.length === 0;
      const box = $('#nfcReads');
      box.innerHTML = reads.map((r, i) => `
        <div class="nfc-read">
          <div class="nfc-read-head">
            <strong>Tag ${reads.length - i}</strong>
            <span class="muted">${r.at.toLocaleTimeString()}</span>
          </div>
          <div class="out-list">
            <div class="out-row"><span class="out-name">Serial number</span><span class="out-val">${PK.escapeHTML(r.serial)}</span>${r.serial ? PK.copyButton() : '<span></span>'}</div>
            ${r.records.length ? r.records.map((x) => `
              <div class="out-row"><span class="out-name">${PK.escapeHTML(x.type)}${x.extra ? `<br><small>${PK.escapeHTML(x.extra)}</small>` : ''}</span>
              <span class="out-val nfc-val">${PK.escapeHTML(x.value)}</span>${x.value ? PK.copyButton() : '<span></span>'}</div>`).join('')
              : '<div class="out-row"><span class="out-name">Records</span><span class="out-val">No NDEF records (blank or unformatted tag)</span><span></span></div>'}
          </div>
        </div>`).join('');
      // Wire the copy buttons in the same order they were rendered.
      const values = reads.flatMap((r) => [...(r.serial ? [r.serial] : []), ...r.records.filter((x) => x.value).map((x) => x.value)]);
      box.querySelectorAll('[data-copy]').forEach((b, i) => PK.setupCopy(b, () => values[i]));
    }

    function onReading(e) {
      const records = [];
      try { for (const rec of e.message.records) records.push(describe(rec)); } catch { /* keep what we have */ }
      reads.unshift({ at: new Date(), serial: e.serialNumber || '', records });
      reads.length = Math.min(reads.length, 20);
      if (navigator.vibrate) { try { navigator.vibrate(40); } catch { /* ignore */ } }
      setState('live', 'Scanning', `Read a tag with ${records.length} record${records.length === 1 ? '' : 's'}. Hold another tag to read it.`);
      render();
    }

    async function start() {
      if (!supported) return;
      ctrl = new AbortController();
      reader = new window.NDEFReader();
      reader.onreading = onReading;
      reader.onreadingerror = () => setState('live', 'Scanning', 'Couldn’t read that tag. It may be locked, a type web pages can’t read, or moved away too quickly.', true);
      setState('searching', 'Starting…', 'Waiting for NFC permission.');
      try {
        await reader.scan({ signal: ctrl.signal });
      } catch (err) {
        ctrl = null;
        const msg = {
          NotAllowedError: 'NFC access was denied. Allow it for this site in Chrome’s site settings, then tap Start.',
          NotSupportedError: 'NFC is turned off or this phone has none. Turn on NFC in your phone’s settings, then tap Start.',
          NotReadableError: 'NFC is busy. Close other apps using it and tap Start again.',
        }[err.name] || `Couldn’t start NFC (${err.name || err.message}).`;
        setState('error', err.name === 'NotAllowedError' ? 'Permission denied' : 'NFC unavailable', msg, true);
        return;
      }
      label.textContent = 'Stop';
      toggle.classList.replace('btn-primary', 'btn-ghost');
      $('#nfcWait').hidden = false;
      setState('live', 'Scanning', 'Hold a tag against the back of your phone.');
    }

    function stop() {
      if (!ctrl) return;
      ctrl.abort();
      ctrl = null;
      if (reader) { reader.onreading = reader.onreadingerror = null; reader = null; }
      label.textContent = 'Start';
      toggle.classList.replace('btn-ghost', 'btn-primary');
      $('#nfcWait').hidden = true;
      setState('idle', 'Stopped', 'Tap Start to read more tags.');
    }

    $('#nfcClear').addEventListener('click', () => { reads.length = 0; render(); });
    toggle.addEventListener('click', () => (ctrl ? stop() : start()));
    window.addEventListener('hashchange', () => setTimeout(() => { if (root.hidden && ctrl) stop(); }));
  },
});
