PK.register({
  id: 'compass',
  title: 'Compass',
  desc: 'A live compass using your phone’s direction sensor.',
  icon: 'i-compass',
  category: 'Device',
  keywords: 'compass heading direction north bearing magnetometer orientation',
  html: `
    <div class="card gps-control">
      <div class="gps-state">
        <span class="gps-dot" id="cmpDot"></span>
        <div>
          <div class="gps-state-title" id="cmpStateTitle">Not running</div>
          <div class="status" id="cmpStatus" style="margin:0">Tap Start, then hold your phone flat with the top pointing ahead.</div>
        </div>
      </div>
      <button class="btn btn-primary btn-sm" id="cmpToggle" type="button">${PK.icon('i-compass')}<span>Start</span></button>
    </div>

    <div class="card cmp-card">
      <div class="cmp-wrap">
        <svg class="cmp-dial" viewBox="0 0 200 200" aria-hidden="true">
          <g id="cmpRose" class="cmp-rose">
            <circle cx="100" cy="100" r="92" class="cmp-ring"/>
            <g id="cmpTicks"></g>
            <text x="100" y="34" class="cmp-n">N</text>
            <text x="168" y="101" class="cmp-c">E</text>
            <text x="100" y="168" class="cmp-c">S</text>
            <text x="32" y="101" class="cmp-c">W</text>
            <path d="M100 48 108 100 100 94 92 100Z" class="cmp-north"/>
            <path d="M100 152 108 100 100 106 92 100Z" class="cmp-south"/>
            <circle cx="100" cy="100" r="5" class="cmp-hub"/>
          </g>
          <path d="M100 2 107 15 93 15Z" class="cmp-lubber"/>
        </svg>
      </div>
      <div class="cmp-readout">
        <div class="cmp-deg" id="cmpDeg">—</div>
        <div class="cmp-dir" id="cmpDir">Waiting for the sensor</div>
      </div>
      <p class="status" id="cmpNote">Shows magnetic north. Keep away from magnets, laptops and metal for the best reading.</p>
    </div>

    <div class="card">
      <div class="out-list">
        <div class="out-row"><span class="out-name">Bearing</span><span class="out-val" id="cmpBearing"></span>${PK.copyButton()}</div>
        <div class="out-row"><span class="out-name">Sensor accuracy</span><span class="out-val" id="cmpAcc"></span><span></span></div>
        <div class="out-row"><span class="out-name">Source</span><span class="out-val" id="cmpSource"></span><span></span></div>
      </div>
    </div>`,

  init(root, $) {
    const toggle = $('#cmpToggle');
    const label = toggle.querySelector('span');
    const status = $('#cmpStatus');
    const rose = $('#cmpRose');
    const NAMES = ['North', 'North-northeast', 'Northeast', 'East-northeast', 'East', 'East-southeast', 'Southeast', 'South-southeast',
      'South', 'South-southwest', 'Southwest', 'West-southwest', 'West', 'West-northwest', 'Northwest', 'North-northwest'];
    const SHORT = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const copyBtn = root.querySelector('[data-copy]');
    PK.setupCopy(copyBtn, () => $('#cmpBearing').textContent);
    copyBtn.disabled = true;

    // Tick marks every 10°, longer every 30°.
    $('#cmpTicks').innerHTML = Array.from({ length: 36 }, (_, i) => {
      const long = i % 3 === 0;
      return `<line x1="100" y1="${long ? 12 : 14}" x2="100" y2="${long ? 24 : 20}" class="${long ? 'cmp-tick-l' : 'cmp-tick'}" transform="rotate(${i * 10} 100 100)"/>`;
    }).join('');

    let running = false;
    let eventName = null;
    let target = null;     // latest heading from the sensor, 0–359
    let shown = 0;         // smoothed, unwrapped angle used for drawing
    let frame = null;
    let noDataTimer = null;
    let readings = 0;

    function setState(kind, title, msg, isError = false) {
      $('#cmpDot').className = 'gps-dot ' + kind;
      $('#cmpStateTitle').textContent = title;
      PK.setStatus(status, msg, isError);
    }

    const screenAngle = () => (screen.orientation && typeof screen.orientation.angle === 'number')
      ? screen.orientation.angle : (typeof window.orientation === 'number' ? window.orientation : 0);

    function onOrientation(e) {
      let heading = null;
      let source = '';
      if (typeof e.webkitCompassHeading === 'number' && !isNaN(e.webkitCompassHeading)) {
        heading = e.webkitCompassHeading;          // iOS: degrees from magnetic north
        source = 'iOS compass';
        const acc = e.webkitCompassAccuracy;
        $('#cmpAcc').textContent = typeof acc === 'number' && acc >= 0 ? `±${Math.round(acc)}°` : 'Not reported';
        $('#cmpNote').textContent = acc > 25
          ? 'Low accuracy: move your phone in a figure-of-eight to calibrate.'
          : 'Shows magnetic north. Keep away from magnets, laptops and metal for the best reading.';
      } else if (e.absolute && typeof e.alpha === 'number') {
        heading = 360 - e.alpha;                   // Android: alpha counts anticlockwise
        source = 'Absolute device orientation';
        $('#cmpAcc').textContent = 'Not reported';
      } else if (typeof e.alpha === 'number') {
        // Only relative orientation is available: not a real compass.
        stop();
        setState('error', 'No compass', 'This device only reports relative rotation, not direction. It has no usable compass sensor.', true);
        return;
      }
      if (heading === null) return;
      heading = ((heading + screenAngle()) % 360 + 360) % 360;
      clearTimeout(noDataTimer);
      readings++;
      if (target === null) shown = heading; // first reading: jump straight there
      target = heading;
      $('#cmpSource').textContent = source;
      if (readings === 1) setState('live', 'Running', 'Hold your phone flat. The red needle points to magnetic north.');
      if (!frame) frame = requestAnimationFrame(draw);
    }

    // Smoothly turn toward the target, always the short way round.
    function draw() {
      frame = null;
      if (target === null) return;
      const diff = ((target - shown + 540) % 360) - 180;
      shown += Math.abs(diff) < 0.2 ? diff : diff * 0.2;
      rose.style.transform = `rotate(${-shown}deg)`;
      const deg = Math.round(((shown % 360) + 360) % 360) % 360;
      const i = Math.round(deg / 22.5) % 16;
      $('#cmpDeg').textContent = `${deg}°`;
      $('#cmpDir').textContent = NAMES[i];
      $('#cmpBearing').textContent = `${deg}° ${SHORT[i]}`;
      copyBtn.disabled = false;
      if (running && Math.abs(diff) >= 0.2) frame = requestAnimationFrame(draw);
    }

    async function start() {
      if (!('DeviceOrientationEvent' in window)) {
        setState('error', 'Not supported', 'This browser can’t read direction sensors.', true);
        return;
      }
      if (!window.isSecureContext) {
        setState('error', 'Needs HTTPS', 'The compass only works on a secure (https) connection.', true);
        return;
      }
      // iOS Safari (and newer Chrome) ask for permission, and only from a tap.
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
      eventName = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
      window.addEventListener(eventName, onOrientation);
      running = true;
      readings = 0;
      label.textContent = 'Stop';
      toggle.classList.replace('btn-primary', 'btn-ghost');
      setState('searching', 'Starting…', 'Waiting for the direction sensor.');
      noDataTimer = setTimeout(() => {
        if (!readings) {
          stop();
          setState('error', 'No compass found', 'No direction readings arrived. Most laptops and desktops have no compass. Try on a phone.', true);
        }
      }, 3000);
    }

    function stop() {
      if (eventName) window.removeEventListener(eventName, onOrientation);
      eventName = null;
      running = false;
      clearTimeout(noDataTimer);
      label.textContent = 'Start';
      toggle.classList.replace('btn-ghost', 'btn-primary');
      if (readings) setState('idle', 'Paused', 'Showing the last direction. Tap Start for live updates.');
    }

    toggle.addEventListener('click', () => (running ? stop() : start()));
    // Save battery: stop the sensor when leaving this tool.
    window.addEventListener('hashchange', () => setTimeout(() => { if (root.hidden && running) stop(); }));
  },
});
