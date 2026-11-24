PK.register({
  id: 'gps',
  title: 'GPS Location',
  desc: 'Live latitude, longitude, accuracy, altitude, speed and heading.',
  icon: 'i-pin',
  category: 'Device',
  keywords: 'gps location coordinates latitude longitude altitude speed heading compass geolocation',
  html: `
    <div class="card gps-control">
      <div class="gps-state">
        <span class="gps-dot" id="gpsDot"></span>
        <div>
          <div class="gps-state-title" id="gpsStateTitle">Not tracking</div>
          <div class="status" id="gpsStatus" style="margin:0">Your location stays on this device. Tap Start to allow access.</div>
        </div>
      </div>
      <button class="btn btn-primary btn-sm" id="gpsToggle" type="button">${PK.icon('i-pin')}<span>Start</span></button>
    </div>

    <div class="card">
      <div class="result-head">
        <span class="field-label">Coordinates</span>
        <div class="btn-row" style="margin:0">
          <a class="btn btn-ghost btn-sm" id="gpsMap" target="_blank" rel="noopener" hidden>${PK.icon('i-arrow')}Open map</a>
          ${PK.copyButton()}
        </div>
      </div>
      <output id="gpsCoords" class="mono big-out"></output>
      <div class="out-list" style="margin-top:12px">
        <div class="out-row"><span class="out-name">Degrees, minutes, seconds</span><span class="out-val" id="gpsDms"></span>${PK.copyButton()}</div>
        <div class="out-row"><span class="out-name">geo: link</span><span class="out-val" id="gpsGeo"></span>${PK.copyButton()}</div>
      </div>
    </div>

    <div class="card">
      <div class="stats gps-stats">
        <div class="stat"><div class="stat-v" id="gpsAcc">—</div><div class="stat-l">Accuracy</div></div>
        <div class="stat"><div class="stat-v" id="gpsAlt">—</div><div class="stat-l">Altitude</div></div>
        <div class="stat"><div class="stat-v" id="gpsSpeed">—</div><div class="stat-l">Speed</div></div>
        <div class="stat gps-heading-stat">
          <svg class="gps-compass" viewBox="0 0 48 48" aria-hidden="true">
            <circle cx="24" cy="24" r="21"/>
            <text x="24" y="10">N</text>
            <path id="gpsNeedle" d="M24 9 29 27 24 24 19 27Z"/>
          </svg>
          <div><div class="stat-v" id="gpsHeading">—</div><div class="stat-l">Heading</div></div>
        </div>
      </div>
      <p class="status" id="gpsMoveNote">Speed and heading appear while you’re moving and the device has a real GPS fix.</p>
    </div>

    <div class="card">
      <h2 class="card-title">Details</h2>
      <table class="kv">
        <tr><th>Latitude</th><td id="gpsLat">—</td></tr>
        <tr><th>Longitude</th><td id="gpsLon">—</td></tr>
        <tr><th>Altitude accuracy</th><td id="gpsAltAcc">—</td></tr>
        <tr><th>Last update</th><td id="gpsTime">—</td></tr>
        <tr><th>Updates received</th><td id="gpsCount">0</td></tr>
      </table>
    </div>`,

  init(root, $) {
    const toggle = $('#gpsToggle');
    const label = toggle.querySelector('span');
    const status = $('#gpsStatus');
    const stateTitle = $('#gpsStateTitle');
    const dot = $('#gpsDot');
    const mapLink = $('#gpsMap');
    const [coordCopy, dmsCopy, geoCopy] = root.querySelectorAll('[data-copy]');
    const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    let watchId = null;
    let count = 0;
    let last = null;

    PK.setupCopy(coordCopy, () => $('#gpsCoords').textContent);
    PK.setupCopy(dmsCopy, () => $('#gpsDms').textContent);
    PK.setupCopy(geoCopy, () => $('#gpsGeo').textContent);
    [coordCopy, dmsCopy, geoCopy].forEach((b) => { b.disabled = true; });

    const fmt = (n, d) => n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d });
    const metres = (m) => m >= 1000 ? `${fmt(m / 1000, 2)} km` : `${fmt(m, m < 10 ? 1 : 0)} m`;

    function dms(deg, pos, neg) {
      const a = Math.abs(deg);
      const d = Math.floor(a);
      const mFloat = (a - d) * 60;
      const m = Math.floor(mFloat);
      const s = (mFloat - m) * 60;
      return `${d}°${String(m).padStart(2, '0')}′${s.toFixed(1).padStart(4, '0')}″${deg >= 0 ? pos : neg}`;
    }

    function setState(kind, title, msg, isError = false) {
      dot.className = 'gps-dot ' + kind; // idle | searching | live | error
      stateTitle.textContent = title;
      PK.setStatus(status, msg, isError);
    }

    function show(pos) {
      const c = pos.coords;
      count++;
      last = pos;
      const lat = c.latitude.toFixed(6);
      const lon = c.longitude.toFixed(6);
      $('#gpsCoords').textContent = `${lat}, ${lon}`;
      $('#gpsDms').textContent = `${dms(c.latitude, 'N', 'S')} ${dms(c.longitude, 'E', 'W')}`;
      $('#gpsGeo').textContent = `geo:${lat},${lon}`;
      $('#gpsLat').textContent = `${lat}°`;
      $('#gpsLon').textContent = `${lon}°`;
      $('#gpsAcc').textContent = `±${metres(c.accuracy)}`;
      $('#gpsAlt').textContent = c.altitude == null ? '—' : metres(c.altitude);
      $('#gpsAltAcc').textContent = c.altitudeAccuracy == null ? 'Not reported' : `±${metres(c.altitudeAccuracy)}`;

      const moving = c.speed != null && !isNaN(c.speed);
      $('#gpsSpeed').textContent = moving ? `${fmt(c.speed * 3.6, 1)} km/h` : '—';
      $('#gpsSpeed').title = moving ? `${fmt(c.speed, 1)} m/s · ${fmt(c.speed * 2.23694, 1)} mph` : '';
      const hasHeading = c.heading != null && !isNaN(c.heading);
      $('#gpsHeading').textContent = hasHeading ? `${Math.round(c.heading)}° ${COMPASS[Math.round(c.heading / 22.5) % 16]}` : '—';
      $('#gpsNeedle').style.transform = hasHeading ? `rotate(${c.heading}deg)` : '';
      root.querySelector('.gps-compass').classList.toggle('on', hasHeading);
      $('#gpsMoveNote').hidden = moving || hasHeading;

      $('#gpsTime').textContent = new Date(pos.timestamp).toLocaleTimeString();
      $('#gpsCount').textContent = count;
      mapLink.href = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`;
      mapLink.hidden = false;
      [coordCopy, dmsCopy, geoCopy].forEach((b) => { b.disabled = false; });

      const quality = c.accuracy <= 20 ? 'Good GPS fix' : c.accuracy <= 100 ? 'Fair fix' : 'Rough position (Wi-Fi or cell based)';
      setState('live', 'Tracking', `${quality} · accuracy ±${metres(c.accuracy)}`);
    }

    function fail(err) {
      const messages = {
        1: 'Location permission was denied. Allow location for this site in your browser settings, then tap Start again.',
        2: 'Your position is unavailable. Check that location services are turned on for your device and browser.',
        3: 'Timed out waiting for a position. Move somewhere with a clearer view of the sky and try again.',
      };
      if (err.code === 1 || !last) stop();
      setState('error', err.code === 1 ? 'Permission denied' : 'No position', messages[err.code] || err.message, true);
    }

    function start() {
      if (!('geolocation' in navigator)) {
        setState('error', 'Not supported', 'This browser has no location support.', true);
        return;
      }
      if (!window.isSecureContext) {
        setState('error', 'Needs HTTPS', 'Location only works on a secure (https) connection.', true);
        return;
      }
      setState('searching', 'Finding you…', 'Waiting for a position. The first fix can take a few seconds outdoors.');
      watchId = navigator.geolocation.watchPosition(show, fail, { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
      label.textContent = 'Stop';
      toggle.classList.replace('btn-primary', 'btn-ghost');
    }

    function stop() {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      watchId = null;
      label.textContent = last ? 'Resume' : 'Start';
      toggle.classList.replace('btn-ghost', 'btn-primary');
      if (last) setState('idle', 'Paused', 'Showing the last position. Tap Resume for live updates.');
      else setState('idle', 'Not tracking', 'Your location stays on this device. Tap Start to allow access.');
    }

    toggle.addEventListener('click', () => (watchId === null ? start() : stop()));

    // Save battery: stop tracking when leaving this tool.
    window.addEventListener('hashchange', () => setTimeout(() => {
      if (root.hidden && watchId !== null) stop();
    }));
  },
});
