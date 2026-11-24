// Version tag of this script (e.g. "?v=18"), reused to lazy-load the decoder.
const QRSCAN_V = ((document.currentScript && document.currentScript.src.match(/\?v=\d+/)) || [''])[0];

PK.register({
  id: 'qrscan',
  title: 'QR Scanner',
  desc: 'Scan QR codes with your camera or from an image.',
  icon: 'i-scan',
  category: 'Device',
  keywords: 'qr scanner reader scan barcode camera decode code wifi link',
  html: `
    <div class="card gps-control">
      <div class="gps-state">
        <span class="gps-dot" id="qsDot"></span>
        <div>
          <div class="gps-state-title" id="qsStateTitle">Camera off</div>
          <div class="status" id="qsStatus" style="margin:0">Codes are decoded on this device. Tap Start to allow the camera.</div>
        </div>
      </div>
      <button class="btn btn-primary btn-sm" id="qsToggle" type="button">${PK.icon('i-scan')}<span>Start</span></button>
    </div>

    <div class="card qs-cam" id="qsCam" hidden>
      <div class="qs-view">
        <video id="qsVideo" playsinline muted></video>
        <div class="qs-frame" aria-hidden="true"></div>
      </div>
      <div class="btn-row qs-cam-actions">
        <button class="btn btn-ghost btn-sm" id="qsSwitch" type="button" hidden>Switch camera</button>
        <button class="btn btn-ghost btn-sm" id="qsTorch" type="button" hidden aria-pressed="false">Torch</button>
      </div>
    </div>

    <div class="card result" id="qsResultCard" hidden>
      <div class="result-head">
        <span class="field-label" id="qsKind">Text</span>
        <div class="btn-row" style="margin:0">
          <a class="btn btn-ghost btn-sm" id="qsOpen" target="_blank" rel="noopener noreferrer" hidden>${PK.icon('i-arrow')}Open link</a>
          ${PK.copyButton()}
        </div>
      </div>
      <output id="qsResult" class="mono qs-result"></output>
      <div class="out-list qs-wifi" id="qsWifi" hidden></div>
      <p class="status" id="qsResultNote"></p>
      <div class="btn-row"><button class="btn btn-primary btn-sm" id="qsAgain" type="button" hidden>${PK.icon('i-scan')}Scan another</button></div>
    </div>

    <div class="card">
      <span class="field-label">Scan an image</span>
      ${PK.dropzone('qsFile')}
      <p class="status" id="qsFileStatus">A screenshot or photo of a QR code.</p>
    </div>

    <div class="card" id="qsHistoryCard" hidden>
      <div class="result-head">
        <span class="field-label">Recent scans</span>
        <button class="btn btn-ghost btn-sm" id="qsClear" type="button">Clear</button>
      </div>
      <div class="out-list" id="qsHistory"></div>
      <p class="status">Kept only until you close the page.</p>
    </div>`,

  init(root, $) {
    const toggle = $('#qsToggle');
    const label = toggle.querySelector('span');
    const status = $('#qsStatus');
    const video = $('#qsVideo');
    const work = document.createElement('canvas');
    const wctx = work.getContext('2d', { willReadFrequently: true });
    const resultCopy = $('#qsResultCard [data-copy]');
    PK.setupCopy(resultCopy, () => $('#qsResult').textContent);
    const zone = PK.setupDropzone($('#qsFile'));

    let stream = null;
    let running = false;
    let timer = null;
    let detector;          // BarcodeDetector, null if unavailable, undefined until checked
    let jsqrLoad = null;
    let facing = 'environment';
    let torchOn = false;
    const history = [];

    function setState(kind, title, msg, isError = false) {
      $('#qsDot').className = 'gps-dot ' + kind;
      $('#qsStateTitle').textContent = title;
      PK.setStatus(status, msg, isError);
    }

    // ---------- Decoding ----------
    // Android Chrome (and macOS Chrome) have a fast built-in QR detector.
    // Elsewhere, load the bundled jsQR decoder the first time it's needed.
    async function getDetector() {
      if (detector !== undefined) return detector;
      detector = null;
      if ('BarcodeDetector' in window) {
        try {
          const formats = await window.BarcodeDetector.getSupportedFormats();
          if (formats.includes('qr_code')) detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        } catch { /* fall back to jsQR */ }
      }
      return detector;
    }

    function loadJsQR() {
      if (window.jsQR) return Promise.resolve(window.jsQR);
      if (!jsqrLoad) {
        jsqrLoad = new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = `js/vendor/jsqr.js${QRSCAN_V}`;
          s.onload = () => (window.jsQR ? resolve(window.jsQR) : reject(new Error('decoder missing')));
          s.onerror = () => { jsqrLoad = null; reject(new Error('Couldn’t load the QR decoder.')); };
          document.head.appendChild(s);
        });
      }
      return jsqrLoad;
    }

    // Decodes a video, image or bitmap. Returns the text, or null.
    async function decode(source, width, height, thorough) {
      const det = await getDetector();
      if (det) {
        const codes = await det.detect(source);
        return codes.length ? codes[0].rawValue : null;
      }
      const jsQR = await loadJsQR();
      const scale = Math.min(1, (thorough ? 1200 : 720) / Math.max(width, height));
      work.width = Math.max(1, Math.round(width * scale));
      work.height = Math.max(1, Math.round(height * scale));
      wctx.drawImage(source, 0, 0, work.width, work.height);
      const img = wctx.getImageData(0, 0, work.width, work.height);
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: thorough ? 'attemptBoth' : 'dontInvert' });
      return code ? code.data : null;
    }

    // ---------- Showing a result ----------
    function parseWifi(text) {
      if (!/^WIFI:/i.test(text)) return null;
      const out = {};
      // Fields are K:value; with \ escaping ; , : and \.
      const re = /([A-Z]+):((?:\\.|[^;\\])*);/gi;
      let m;
      while ((m = re.exec(text.slice(5)))) out[m[1].toUpperCase()] = m[2].replace(/\\(.)/g, '$1');
      return out.S !== undefined ? out : null;
    }

    function show(text, source) {
      $('#qsResultCard').hidden = false;
      $('#qsResult').textContent = text;
      const open = $('#qsOpen');
      const wifiBox = $('#qsWifi');
      open.hidden = true;
      wifiBox.hidden = true;
      let kind = 'Text';
      let note = '';
      let url = null;
      try { url = new URL(text.trim()); } catch { /* not a URL */ }
      const wifi = parseWifi(text);
      if (url && /^https?:$/.test(url.protocol)) {
        kind = 'Link';
        open.href = url.href;
        open.hidden = false;
        note = `Goes to ${url.hostname}. Check it’s a site you expect before opening.`;
      } else if (url && /^(mailto|tel|sms|geo):$/.test(url.protocol)) {
        kind = { 'mailto:': 'Email', 'tel:': 'Phone number', 'sms:': 'Text message', 'geo:': 'Location' }[url.protocol];
      } else if (wifi) {
        kind = 'Wi-Fi network';
        const rows = [['Network', wifi.S], ['Password', wifi.P || ''], ['Security', wifi.T || 'None']];
        wifiBox.innerHTML = rows.map(([k, v], i) =>
          `<div class="out-row"><span class="out-name">${k}</span><span class="out-val">${PK.escapeHTML(v)}</span>${i < 2 ? PK.copyButton() : '<span></span>'}</div>`).join('');
        wifiBox.querySelectorAll('[data-copy]').forEach((b, i) => PK.setupCopy(b, () => rows[i][1]));
        wifiBox.hidden = false;
        note = 'Copy the password, then join the network in your Wi-Fi settings.';
      }
      $('#qsKind').textContent = kind;
      $('#qsResultNote').textContent = note || `${text.length} characters.`;
      $('#qsAgain').hidden = source !== 'camera';
      addHistory(text, kind);
    }

    function addHistory(text, kind) {
      const i = history.findIndex((h) => h.text === text);
      if (i >= 0) history.splice(i, 1);
      history.unshift({ text, kind, at: new Date() });
      history.length = Math.min(history.length, 10);
      $('#qsHistoryCard').hidden = false;
      $('#qsHistory').innerHTML = history.map((h) =>
        `<div class="out-row"><span class="out-name">${h.kind} · ${h.at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>` +
        `<span class="out-val">${PK.escapeHTML(h.text)}</span>${PK.copyButton()}</div>`).join('');
      $('#qsHistory').querySelectorAll('[data-copy]').forEach((b, k) => PK.setupCopy(b, () => history[k].text));
    }
    $('#qsClear').addEventListener('click', () => { history.length = 0; $('#qsHistoryCard').hidden = true; });

    // ---------- Camera ----------
    async function scanLoop() {
      if (!running) return;
      if (!root.hidden && video.readyState >= 2 && video.videoWidth) {
        try {
          const text = await decode(video, video.videoWidth, video.videoHeight, false);
          if (text && running) {
            if (navigator.vibrate) { try { navigator.vibrate(40); } catch { /* ignore */ } }
            stop('Found a code. Tap Scan another to keep going.');
            show(text, 'camera');
            $('#qsResultCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            return;
          }
        } catch (err) {
          stop();
          setState('error', 'Decoder failed', err.message || 'Couldn’t decode the camera picture.', true);
          return;
        }
      }
      timer = setTimeout(scanLoop, 120);
    }

    async function start() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setState('error', window.isSecureContext ? 'Not supported' : 'Needs HTTPS',
          window.isSecureContext ? 'This browser can’t use the camera. You can still scan an image below.' : 'The camera only works on a secure (https) connection.', true);
        return;
      }
      setState('searching', 'Starting…', 'Waiting for camera access.');
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } catch (err) {
        const msg = {
          NotAllowedError: 'Camera access was denied. Allow it for this site in your browser settings, then tap Start.',
          NotFoundError: 'No camera was found. You can still scan an image below.',
          NotReadableError: 'The camera is busy in another app. Close it and tap Start again.',
          OverconstrainedError: 'This camera isn’t available. Tap Start to try again.',
        }[err.name] || `Couldn’t start the camera (${err.name || err.message}).`;
        setState('error', err.name === 'NotAllowedError' ? 'Permission denied' : 'No camera', msg, true);
        return;
      }
      video.srcObject = stream;
      try { await video.play(); } catch { /* autoplay of muted video normally works */ }
      running = true;
      $('#qsCam').hidden = false;
      label.textContent = 'Stop';
      toggle.classList.replace('btn-primary', 'btn-ghost');
      setState('live', 'Scanning', 'Point the camera at a QR code.');
      $('#qsAgain').hidden = true;
      // Offer a camera switch when there's more than one.
      try {
        const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
        $('#qsSwitch').hidden = cams.length < 2;
      } catch { $('#qsSwitch').hidden = true; }
      const track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities ? track.getCapabilities() : {};
      torchOn = false;
      $('#qsTorch').hidden = !caps.torch;
      $('#qsTorch').setAttribute('aria-pressed', 'false');
      track.addEventListener('ended', () => stop());
      scanLoop();
    }

    function stop(msg) {
      clearTimeout(timer);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      stream = null;
      video.srcObject = null;
      const wasRunning = running;
      running = false;
      $('#qsCam').hidden = true;
      label.textContent = 'Start';
      toggle.classList.replace('btn-ghost', 'btn-primary');
      if (wasRunning) setState('idle', 'Camera off', msg || 'Tap Start to scan again.');
    }

    $('#qsSwitch').addEventListener('click', () => {
      facing = facing === 'environment' ? 'user' : 'environment';
      stop();
      start();
    });
    $('#qsTorch').addEventListener('click', async () => {
      const track = stream && stream.getVideoTracks()[0];
      if (!track) return;
      try {
        await track.applyConstraints({ advanced: [{ torch: !torchOn }] });
        torchOn = !torchOn;
        $('#qsTorch').setAttribute('aria-pressed', String(torchOn));
        $('#qsTorch').classList.toggle('btn-primary', torchOn);
        $('#qsTorch').classList.toggle('btn-ghost', !torchOn);
      } catch { $('#qsTorch').hidden = true; }
    });
    toggle.addEventListener('click', () => (running ? stop() : start()));
    $('#qsAgain').addEventListener('click', start);
    window.addEventListener('hashchange', () => setTimeout(() => { if (root.hidden && running) stop(); }));

    // ---------- Image file ----------
    $('#qsFile').addEventListener('change', async () => {
      const file = $('#qsFile').files[0];
      const fileStatus = $('#qsFileStatus');
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        PK.setStatus(fileStatus, 'That isn’t an image. Choose a PNG, JPEG or similar.', true);
        return;
      }
      PK.setStatus(fileStatus, 'Reading…');
      let img;
      try {
        img = await createImageBitmap(file);
      } catch {
        // Older Safari: decode through an <img>.
        img = await new Promise((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = reject;
          el.src = URL.createObjectURL(file);
        }).catch(() => null);
      }
      if (!img) { PK.setStatus(fileStatus, 'Couldn’t open this image.', true); return; }
      try {
        const text = await decode(img, img.width, img.height, true);
        if (text) {
          PK.setStatus(fileStatus, `Found a code in ${file.name}.`);
          show(text, 'file');
        } else {
          PK.setStatus(fileStatus, 'No QR code found. Try a sharper or closer picture.', true);
        }
      } catch (err) {
        PK.setStatus(fileStatus, err.message || 'Couldn’t decode this image.', true);
      }
      if (img.src && img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
      zone.clear();
    });
  },
});
