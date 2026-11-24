PK.register({
  id: 'level',
  title: 'Bubble Level',
  desc: 'A spirit level for surfaces and edges, using your phone’s tilt sensor.',
  icon: 'i-level',
  category: 'Device',
  keywords: 'bubble level spirit level inclinometer tilt angle slope plumb flat surface shelf picture',
  html: `
    <div class="card gps-control">
      <div class="gps-state">
        <span class="gps-dot" id="lvDot"></span>
        <div>
          <div class="gps-state-title" id="lvStateTitle">Not running</div>
          <div class="status" id="lvStatus" style="margin:0">Tap Start, then lay your phone flat or stand it on an edge.</div>
        </div>
      </div>
      <button class="btn btn-primary btn-sm" id="lvToggle" type="button">${PK.icon('i-level')}<span>Start</span></button>
    </div>

    <div class="card lv-card" id="lvCard">
      <div class="lv-mode" id="lvMode">Lay flat</div>
      <svg class="lv-dial" id="lvDial" viewBox="0 0 200 200" aria-hidden="true">
        <circle cx="100" cy="100" r="94" class="lv-ring"/>
        <circle cx="100" cy="100" r="62" class="lv-guide"/>
        <circle cx="100" cy="100" r="31" class="lv-guide"/>
        <path d="M100 6v188M6 100h188" class="lv-cross"/>
        <circle cx="100" cy="100" r="15" class="lv-target"/>
        <circle cx="100" cy="100" r="13" class="lv-bubble" id="lvBubble"/>
      </svg>
      <svg class="lv-tube" id="lvTube" viewBox="0 0 300 64" aria-hidden="true" hidden>
        <rect x="4" y="12" width="292" height="40" rx="20" class="lv-ring"/>
        <path d="M128 12v40M172 12v40" class="lv-cross"/>
        <ellipse cx="150" cy="32" rx="20" ry="14" class="lv-bubble" id="lvTubeBubble"/>
      </svg>
      <div class="lv-readout">
        <div class="lv-deg" id="lvDeg">—</div>
        <div class="lv-sub" id="lvSub">Waiting for the sensor</div>
      </div>
      <div class="btn-row lv-actions">
        <button class="btn btn-ghost btn-sm" id="lvZero" type="button" disabled>Calibrate</button>
        <button class="btn btn-ghost btn-sm" id="lvReset" type="button" hidden>Reset calibration</button>
      </div>
      <p class="status" id="lvNote">To calibrate, put the phone on a surface you know is level and tap Calibrate.</p>
    </div>

    <div class="card">
      <div class="out-list">
        <div class="out-row"><span class="out-name">Left / right</span><span class="out-val" id="lvX"></span><span></span></div>
        <div class="out-row"><span class="out-name">Front / back</span><span class="out-val" id="lvY"></span><span></span></div>
        <div class="out-row"><span class="out-name">Slope</span><span class="out-val" id="lvSlope"></span>${PK.copyButton()}</div>
      </div>
    </div>`,

  init(root, $) {
    const toggle = $('#lvToggle');
    const label = toggle.querySelector('span');
    const status = $('#lvStatus');
    const copyBtn = root.querySelector('[data-copy]');
    PK.setupCopy(copyBtn, () => $('#lvSlope').textContent);
    copyBtn.disabled = true;

    const LEVEL = 0.5;      // degrees counted as level
    const RANGE = 10;       // degrees that move the bubble to the edge
    const deg = (r) => r * 180 / Math.PI;
    const rad = (d) => d * Math.PI / 180;
    const fmt = (d) => `${d.toFixed(1)}°`;

    let running = false;
    let readings = 0;
    let noDataTimer = null;
    let frame = null;
    let up = null;          // smoothed "up" vector in screen coordinates
    let wasLevel = false;
    let last = null;        // latest computed angles, for calibration
    const zero = { x: 0, y: 0, edge: 0 };

    function setState(kind, title, msg, isError = false) {
      $('#lvDot').className = 'gps-dot ' + kind;
      $('#lvStateTitle').textContent = title;
      PK.setStatus(status, msg, isError);
    }

    const screenAngle = () => (screen.orientation && typeof screen.orientation.angle === 'number')
      ? screen.orientation.angle : (typeof window.orientation === 'number' ? window.orientation : 0);

    // The "up" direction in device coordinates (x right, y towards the top of
    // the screen, z out of the screen), from the Euler angles. This stays
    // stable even when the phone stands upright, where gamma alone jumps.
    function onOrientation(e) {
      if (typeof e.beta !== 'number' || typeof e.gamma !== 'number') return;
      const b = rad(e.beta), g = rad(e.gamma);
      let x = -Math.sin(g) * Math.cos(b);
      let y = Math.sin(b);
      const z = Math.cos(g) * Math.cos(b);
      // Turn into screen coordinates when the page is rotated to landscape.
      const t = rad(screenAngle());
      [x, y] = [x * Math.cos(t) - y * Math.sin(t), x * Math.sin(t) + y * Math.cos(t)];
      clearTimeout(noDataTimer);
      readings++;
      if (!up) up = { x, y, z };
      else { up.x += (x - up.x) * 0.25; up.y += (y - up.y) * 0.25; up.z += (z - up.z) * 0.25; }
      if (readings === 1) setState('live', 'Running', 'Lay the phone flat for a surface, or stand it on an edge.');
      if (!frame) frame = requestAnimationFrame(draw);
    }

    function draw() {
      frame = null;
      if (!up || root.hidden) return;
      const flat = Math.abs(up.z) > 0.8; // within about 37° of lying flat
      $('#lvDial').toggleAttribute('hidden', !flat);
      $('#lvTube').toggleAttribute('hidden', flat);
      let isLevel;
      if (flat) {
        const sz = Math.abs(up.z);
        const x = deg(Math.atan2(up.x, sz)) - zero.x;   // + means right side is higher
        const y = deg(Math.atan2(up.y, sz)) - zero.y;   // + means top is higher
        const tilt = Math.hypot(x, y);
        last = { flat, x, y };
        isLevel = tilt < LEVEL;
        // The bubble floats to the higher side.
        let dx = x / RANGE, dy = -y / RANGE;
        const len = Math.hypot(dx, dy);
        if (len > 1) { dx /= len; dy /= len; }
        $('#lvBubble').setAttribute('cx', (100 + dx * 79).toFixed(1));
        $('#lvBubble').setAttribute('cy', (100 + dy * 79).toFixed(1));
        $('#lvMode').textContent = 'Surface';
        $('#lvDeg').textContent = fmt(tilt);
        $('#lvSub').textContent = isLevel ? 'Level' : `Raise the ${x < 0 ? 'right' : 'left'} side ${fmt(Math.abs(x))}, the ${y < 0 ? 'top' : 'bottom'} ${fmt(Math.abs(y))}`;
        $('#lvX').textContent = `${fmt(Math.abs(x))} ${Math.abs(x) < 0.05 ? '' : x > 0 ? 'right side high' : 'left side high'}`.trim();
        $('#lvY').textContent = `${fmt(Math.abs(y))} ${Math.abs(y) < 0.05 ? '' : y > 0 ? 'top high' : 'bottom high'}`.trim();
        $('#lvSlope').textContent = `${fmt(tilt)} (${(Math.tan(rad(tilt)) * 100).toFixed(1)}%)`;
      } else {
        // Standing on an edge: how far "up" leans from the nearest screen edge.
        const a = deg(Math.atan2(up.x, up.y));
        const e = ((a - Math.round(a / 90) * 90) - zero.edge + 540) % 360 - 180;
        last = { flat, edge: e + zero.edge };
        isLevel = Math.abs(e) < LEVEL;
        const dx = Math.max(-1, Math.min(1, e / RANGE));
        $('#lvTubeBubble').setAttribute('cx', (150 + dx * 124).toFixed(1));
        $('#lvMode').textContent = 'Edge';
        $('#lvDeg').textContent = fmt(Math.abs(e));
        $('#lvSub').textContent = isLevel ? 'Level' : `Lower the ${e > 0 ? 'right' : 'left'} end`;
        $('#lvX').textContent = fmt(Math.abs(e));
        $('#lvY').textContent = '';
        $('#lvSlope').textContent = `${fmt(Math.abs(e))} (${(Math.tan(rad(Math.abs(e))) * 100).toFixed(1)}%)`;
      }
      $('#lvCard').classList.toggle('is-level', isLevel);
      if (isLevel && !wasLevel && navigator.vibrate) { try { navigator.vibrate(25); } catch { /* ignore */ } }
      wasLevel = isLevel;
      copyBtn.disabled = false;
      $('#lvZero').disabled = false;
    }

    $('#lvZero').addEventListener('click', () => {
      if (!last) return;
      if (last.flat) { zero.x += last.x; zero.y += last.y; } else zero.edge = last.edge;
      $('#lvReset').hidden = false;
      PK.setStatus($('#lvNote'), `Calibrated the ${last.flat ? 'surface' : 'edge'} level. It lasts until you reload the page.`);
      draw();
    });
    $('#lvReset').addEventListener('click', () => {
      zero.x = zero.y = zero.edge = 0;
      $('#lvReset').hidden = true;
      PK.setStatus($('#lvNote'), 'To calibrate, put the phone on a surface you know is level and tap Calibrate.');
      draw();
    });

    async function start() {
      if (!('DeviceOrientationEvent' in window)) {
        setState('error', 'Not supported', 'This browser can’t read tilt sensors.', true);
        return;
      }
      if (!window.isSecureContext) {
        setState('error', 'Needs HTTPS', 'The level only works on a secure (https) connection.', true);
        return;
      }
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
          const result = await DeviceOrientationEvent.requestPermission();
          if (result !== 'granted') {
            setState('error', 'Permission denied', 'Motion & orientation access was denied. Allow it for this site in your browser settings (on iPhone, reload the page to be asked again), then tap Start.', true);
            return;
          }
        } catch {
          setState('error', 'Permission needed', 'Couldn’t ask for motion & orientation access. Tap Start again.', true);
          return;
        }
      }
      window.addEventListener('deviceorientation', onOrientation);
      running = true;
      readings = 0;
      up = null;
      label.textContent = 'Stop';
      toggle.classList.replace('btn-primary', 'btn-ghost');
      setState('searching', 'Starting…', 'Waiting for the tilt sensor.');
      noDataTimer = setTimeout(() => {
        if (!readings) {
          stop();
          setState('error', 'No tilt sensor found', 'No tilt readings arrived. Most laptops and desktops have no tilt sensor. Try on a phone.', true);
        }
      }, 3000);
    }

    function stop() {
      window.removeEventListener('deviceorientation', onOrientation);
      running = false;
      clearTimeout(noDataTimer);
      label.textContent = 'Start';
      toggle.classList.replace('btn-ghost', 'btn-primary');
      if (readings) setState('idle', 'Paused', 'Showing the last reading. Tap Start for live updates.');
    }

    toggle.addEventListener('click', () => (running ? stop() : start()));
    window.addEventListener('hashchange', () => setTimeout(() => { if (root.hidden && running) stop(); }));
  },
});
