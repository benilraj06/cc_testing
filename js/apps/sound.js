PK.register({
  id: 'sound',
  title: 'Sound Meter',
  desc: 'Measure how loud it is around you, in approximate decibels.',
  icon: 'i-sound',
  category: 'Device',
  keywords: 'sound meter decibel db noise level loudness microphone mic volume spl',
  html: `
    <div class="card gps-control">
      <div class="gps-state">
        <span class="gps-dot" id="sndDot"></span>
        <div>
          <div class="gps-state-title" id="sndStateTitle">Not listening</div>
          <div class="status" id="sndStatus" style="margin:0">Sound is measured on this device and never recorded or sent. Tap Start to allow the microphone.</div>
        </div>
      </div>
      <button class="btn btn-primary btn-sm" id="sndToggle" type="button">${PK.icon('i-sound')}<span>Start</span></button>
    </div>

    <div class="card snd-card">
      <div class="snd-now"><span id="sndNow">—</span><small>dB</small></div>
      <div class="snd-level" id="sndLevel">Waiting for the microphone</div>
      <div class="snd-bar" aria-hidden="true"><span id="sndBar"></span><i id="sndPeak"></i></div>
      <div class="snd-scale" aria-hidden="true"><span>20</span><span>40</span><span>60</span><span>80</span><span>100</span><span>120</span></div>
      <canvas class="snd-graph" id="sndGraph" width="600" height="140" aria-label="Loudness over the last minute" role="img"></canvas>
    </div>

    <div class="card">
      <div class="stats">
        <div class="stat"><div class="stat-v" id="sndMin">—</div><div class="stat-l">Minimum</div></div>
        <div class="stat"><div class="stat-v" id="sndAvg">—</div><div class="stat-l">Average</div></div>
        <div class="stat"><div class="stat-v" id="sndMax">—</div><div class="stat-l">Maximum</div></div>
        <div class="stat"><div class="stat-v" id="sndTime">0:00</div><div class="stat-l">Duration</div></div>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" id="sndReset" type="button">Reset</button>
      </div>
    </div>

    <div class="card">
      <div class="field">
        <label class="field-label" for="sndCal">Calibration <span class="val" id="sndCalVal"></span></label>
        <input type="range" id="sndCal" min="-20" max="20" step="1" value="0">
      </div>
      <p class="status">Phone microphones vary, so readings are estimates, often within 5–10 dB. If you have a real sound meter, adjust this until both agree.</p>
      <table class="kv snd-ref">
        <tr><th>30 dB</th><td>Whisper, quiet bedroom</td></tr>
        <tr><th>60 dB</th><td>Normal conversation</td></tr>
        <tr><th>80 dB</th><td>Busy traffic: long exposure can damage hearing</td></tr>
        <tr><th>100 dB</th><td>Motorbike, concert: harmful within minutes</td></tr>
        <tr><th>120 dB</th><td>Siren up close: pain threshold</td></tr>
      </table>
    </div>`,

  init(root, $) {
    const toggle = $('#sndToggle');
    const label = toggle.querySelector('span');
    const status = $('#sndStatus');
    const canvas = $('#sndGraph');
    const ctx2d = canvas.getContext('2d');

    // A full-scale digital signal on a typical phone mic is roughly 100 dB SPL.
    const BASE = 100;
    const HISTORY = 600;   // samples kept for the graph (60 s at 10 per second)

    let stream = null;
    let audio = null;
    let analyser = null;
    let buf = null;
    let frame = null;
    let running = false;
    let smooth = null;     // dB, "fast" time weighting (125 ms)
    let lastT = 0;
    let lastSample = 0;
    let history = [];
    let stats;
    let peak = 0;
    let peakAt = 0;

    function resetStats() {
      stats = { min: Infinity, max: -Infinity, energy: 0, n: 0, start: running ? performance.now() : 0, elapsed: 0 };
      history = [];
      ['sndMin', 'sndAvg', 'sndMax'].forEach((id) => { $('#' + id).textContent = '—'; });
      $('#sndTime').textContent = '0:00';
      drawGraph();
    }

    function setState(kind, title, msg, isError = false) {
      $('#sndDot').className = 'gps-dot ' + kind;
      $('#sndStateTitle').textContent = title;
      PK.setStatus(status, msg, isError);
    }

    const cal = () => Number($('#sndCal').value);
    const showCal = () => { $('#sndCalVal').textContent = `${cal() > 0 ? '+' : ''}${cal()} dB`; };
    $('#sndCal').addEventListener('input', showCal);
    showCal();

    function describe(db) {
      if (db < 40) return ['Quiet', 'ok'];
      if (db < 60) return ['Moderate', 'ok'];
      if (db < 80) return ['Loud', 'warn'];
      if (db < 100) return ['Very loud', 'bad'];
      return ['Dangerous', 'bad'];
    }
    const pct = (db) => Math.max(0, Math.min(100, (db - 20) / 100 * 100));

    function tick(t) {
      frame = requestAnimationFrame(tick);
      if (root.hidden) return;
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      const db = Math.max(0, 20 * Math.log10(Math.max(rms, 1e-7)) + BASE + cal());
      const dt = lastT ? Math.min(t - lastT, 250) : 16;
      lastT = t;
      smooth = smooth === null ? db : smooth + (db - smooth) * (1 - Math.exp(-dt / 125));

      if (smooth > peak || t - peakAt > 1500) { peak = smooth; peakAt = t; }
      $('#sndBar').style.width = pct(smooth) + '%';
      $('#sndBar').dataset.level = describe(smooth)[1];
      $('#sndPeak').style.left = pct(peak) + '%';

      // Text, stats and graph at 10 updates per second.
      if (t - lastSample < 100) return;
      lastSample = t;
      const [name, kind] = describe(smooth);
      $('#sndNow').textContent = Math.round(smooth);
      $('#sndLevel').textContent = name;
      $('#sndLevel').className = 'snd-level ' + kind;
      stats.min = Math.min(stats.min, smooth);
      stats.max = Math.max(stats.max, smooth);
      stats.energy += Math.pow(10, smooth / 10);
      stats.n++;
      $('#sndMin').textContent = Math.round(stats.min);
      $('#sndMax').textContent = Math.round(stats.max);
      $('#sndAvg').textContent = Math.round(10 * Math.log10(stats.energy / stats.n)); // energy average (Leq)
      const secs = Math.floor((stats.elapsed + t - stats.start) / 1000);
      $('#sndTime').textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
      history.push(smooth);
      if (history.length > HISTORY) history.shift();
      drawGraph();
    }

    function drawGraph() {
      const w = canvas.clientWidth || 600, h = canvas.clientHeight || 140;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      const css = getComputedStyle(root);
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx2d.clearRect(0, 0, w, h);
      const y = (db) => h - (Math.max(20, Math.min(120, db)) - 20) / 100 * h;
      ctx2d.strokeStyle = css.getPropertyValue('--border');
      ctx2d.lineWidth = 1;
      ctx2d.font = `10px ${css.getPropertyValue('--font')}`;
      ctx2d.fillStyle = css.getPropertyValue('--muted');
      for (const g of [40, 60, 80, 100]) {
        ctx2d.beginPath(); ctx2d.moveTo(0, y(g) + 0.5); ctx2d.lineTo(w, y(g) + 0.5); ctx2d.stroke();
        ctx2d.fillText(String(g), 4, y(g) - 3);
      }
      if (history.length < 2) return;
      const step = w / (HISTORY - 1);
      const x0 = w - (history.length - 1) * step;
      const accent = css.getPropertyValue('--accent');
      ctx2d.beginPath();
      history.forEach((v, i) => (i ? ctx2d.lineTo(x0 + i * step, y(v)) : ctx2d.moveTo(x0, y(v))));
      ctx2d.strokeStyle = accent;
      ctx2d.lineWidth = 2;
      ctx2d.lineJoin = 'round';
      ctx2d.stroke();
      ctx2d.lineTo(w, h); ctx2d.lineTo(x0, h); ctx2d.closePath();
      ctx2d.globalAlpha = 0.12; ctx2d.fillStyle = accent; ctx2d.fill(); ctx2d.globalAlpha = 1;
    }

    async function start() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setState('error', window.isSecureContext ? 'Not supported' : 'Needs HTTPS',
          window.isSecureContext ? 'This browser can’t use the microphone.' : 'The microphone only works on a secure (https) connection.', true);
        return;
      }
      setState('searching', 'Starting…', 'Waiting for microphone access.');
      try {
        // Turn off the processing meant for calls, which would distort the level.
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        });
      } catch (err) {
        const msg = {
          NotAllowedError: 'Microphone access was denied. Allow it for this site in your browser settings, then tap Start.',
          NotFoundError: 'No microphone was found on this device.',
          NotReadableError: 'The microphone is busy in another app. Close it and tap Start again.',
        }[err.name] || `Couldn’t start the microphone (${err.name || err.message}).`;
        setState('error', err.name === 'NotAllowedError' ? 'Permission denied' : 'No microphone', msg, true);
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      audio = new AC();
      if (audio.state === 'suspended') await audio.resume().catch(() => {});
      analyser = audio.createAnalyser();
      analyser.fftSize = 2048;
      buf = new Float32Array(analyser.fftSize);
      audio.createMediaStreamSource(stream).connect(analyser);
      running = true;
      smooth = null; lastT = 0; lastSample = 0; peak = 0;
      stats.start = performance.now();
      label.textContent = 'Stop';
      toggle.classList.replace('btn-primary', 'btn-ghost');
      setState('live', 'Listening', 'Measuring. Nothing is recorded.');
      // If the stream ends (mic unplugged, permission revoked), stop cleanly.
      stream.getAudioTracks()[0].addEventListener('ended', () => stop());
      frame = requestAnimationFrame(tick);
    }

    function stop() {
      if (!running) return;
      running = false;
      cancelAnimationFrame(frame);
      stats.elapsed += performance.now() - stats.start;
      if (stream) stream.getTracks().forEach((tr) => tr.stop());
      if (audio) audio.close().catch(() => {});
      stream = audio = analyser = null;
      label.textContent = 'Start';
      toggle.classList.replace('btn-ghost', 'btn-primary');
      setState('idle', 'Paused', 'The microphone is off. Tap Start to measure again.');
    }

    $('#sndReset').addEventListener('click', resetStats);
    toggle.addEventListener('click', () => (running ? stop() : start()));
    window.addEventListener('hashchange', () => setTimeout(() => { if (root.hidden && running) stop(); }));
    resetStats();
    this.redraw = drawGraph;
  },

  onShow() { if (this.redraw) requestAnimationFrame(this.redraw); },
});
