PK.register({
  id: 'flashlight',
  title: 'Screen Flashlight',
  desc: 'Turn your whole screen into a light, with steady, SOS and strobe modes.',
  icon: 'i-flashlight',
  category: 'Device',
  keywords: 'flashlight torch light lamp sos morse emergency strobe signal screen',
  html: `
    <div class="card fl-card">
      <button class="fl-power" id="flPower" type="button" aria-label="Turn the light on">
        <span class="fl-glow" id="flGlow"></span>
        ${PK.icon('i-flashlight')}
      </button>
      <div class="fl-power-label">Tap to turn on</div>
      <p class="status" id="flStatus">Fills the screen with light. Tap anywhere on the light, or press Esc, to turn it off.</p>
    </div>

    <div class="card">
      <div class="field">
        <span class="field-label">Mode</span>
        <div class="segmented" role="radiogroup" aria-label="Mode">
          <label><input type="radio" name="flMode" value="steady" checked><span>Steady</span></label>
          <label><input type="radio" name="flMode" value="sos"><span>SOS</span></label>
          <label><input type="radio" name="flMode" value="strobe"><span>Strobe</span></label>
        </div>
      </div>
      <p class="muted fl-help" id="flHelp"></p>

      <div class="field" id="flSpeedField" hidden>
        <label class="field-label" for="flSpeed">Strobe speed <span class="val" id="flSpeedVal"></span></label>
        <input type="range" id="flSpeed" min="1" max="8" step="1" value="3">
      </div>

      <div class="field" id="flUnitField" hidden>
        <label class="field-label" for="flUnit">SOS speed <span class="val" id="flUnitVal"></span></label>
        <input type="range" id="flUnit" min="150" max="500" step="50" value="250">
      </div>

      <div class="field">
        <span class="field-label">Colour</span>
        <div class="fl-colors" id="flColors" role="radiogroup" aria-label="Colour"></div>
      </div>

      <div class="field">
        <label class="field-label" for="flLevel">Brightness <span class="val" id="flLevelVal"></span></label>
        <input type="range" id="flLevel" min="10" max="100" step="5" value="100">
      </div>

      <p class="status fl-warn" id="flWarn" hidden>Flashing light can trigger seizures in people with photosensitive epilepsy.</p>
    </div>

    <div class="card">
      <div class="card-title">Tips</div>
      <ul class="fl-tips muted">
        <li>Turn your phone’s screen brightness all the way up. Web pages can’t change it for you.</li>
        <li>Red light keeps your night vision. Warm light is easier on the eyes for reading.</li>
        <li>SOS repeats three short, three long, three short flashes (··· — — — ···), the international distress signal.</li>
        <li>The screen stays awake while the light is on, where your browser allows it.</li>
      </ul>
    </div>`,

  init(root, $) {
    const COLORS = [
      { id: 'white', name: 'White', value: '#ffffff' },
      { id: 'warm', name: 'Warm', value: '#ffd9a0' },
      { id: 'red', name: 'Red', value: '#ff1a1a' },
      { id: 'amber', name: 'Amber', value: '#ffb000' },
      { id: 'green', name: 'Green', value: '#22e05a' },
      { id: 'blue', name: 'Blue', value: '#3b82ff' },
    ];
    const HELP = {
      steady: 'A constant light.',
      sos: 'Flashes the SOS distress signal in Morse code, over and over.',
      strobe: 'Flashes on and off quickly, to get attention.',
    };
    // Morse timing in "units": dot 1, dash 3, gap inside a letter 1,
    // gap between letters 3, gap between words 7.
    const SOS = [
      // letter, flashes as [on units]
      ['S', [1, 1, 1]], ['O', [3, 3, 3]], ['S', [1, 1, 1]],
    ];

    let color = COLORS[0];
    let mode = 'steady';
    let on = false;
    let timer = null;
    let wakeLock = null;
    let overlay = null;
    let light = null;
    let caption = null;

    // ---------- Settings UI ----------
    $('#flColors').innerHTML = COLORS.map((c, i) =>
      `<label class="fl-color" title="${c.name}"><input type="radio" name="flColor" value="${c.id}"${i ? '' : ' checked'}>` +
      `<span style="--c:${c.value}"></span><em>${c.name}</em></label>`).join('');

    function refreshUI() {
      mode = root.querySelector('input[name="flMode"]:checked').value;
      color = COLORS.find((c) => c.id === root.querySelector('input[name="flColor"]:checked').value);
      $('#flHelp').textContent = HELP[mode];
      $('#flSpeedField').hidden = mode !== 'strobe';
      $('#flUnitField').hidden = mode !== 'sos';
      $('#flWarn').hidden = mode === 'steady';
      $('#flSpeedVal').textContent = `${$('#flSpeed').value} flashes/s`;
      const unit = Number($('#flUnit').value);
      $('#flUnitVal').textContent = unit <= 200 ? 'Fast' : unit >= 400 ? 'Slow' : 'Normal';
      $('#flLevelVal').textContent = `${$('#flLevel').value}%`;
      $('#flGlow').style.background = color.value;
      if (on) restart();
    }
    root.addEventListener('input', (e) => { if (e.target.matches('input')) refreshUI(); });
    refreshUI();

    // ---------- The light ----------
    function buildOverlay() {
      overlay = document.createElement('div');
      overlay.className = 'fl-overlay';
      overlay.tabIndex = -1;
      overlay.setAttribute('role', 'button');
      overlay.setAttribute('aria-label', 'Turn the light off');
      overlay.innerHTML = '<div class="fl-light"></div><div class="fl-caption"></div><div class="fl-hint">Tap to turn off</div>';
      light = overlay.querySelector('.fl-light');
      caption = overlay.querySelector('.fl-caption');
      overlay.addEventListener('click', turnOff);
      overlay.addEventListener('keydown', (e) => {
        if (['Escape', 'Enter', ' '].includes(e.key)) { e.preventDefault(); turnOff(); }
      });
      document.body.appendChild(overlay);
    }

    const setLit = (lit) => { light.style.opacity = lit ? Number($('#flLevel').value) / 100 : 0; };

    function runSteady() {
      caption.textContent = '';
      setLit(true);
    }

    function runStrobe() {
      caption.textContent = '';
      const half = 500 / Number($('#flSpeed').value);
      let lit = true;
      const step = () => { setLit(lit); lit = !lit; timer = setTimeout(step, half); };
      step();
    }

    function runSOS() {
      const unit = Number($('#flUnit').value);
      // Flatten into [lit, units, label] steps.
      const steps = [];
      SOS.forEach(([, flashes], li) => {
        flashes.forEach((len, fi) => {
          steps.push([true, len, li]);
          steps.push([false, fi < flashes.length - 1 ? 1 : (li < SOS.length - 1 ? 3 : 7), li]);
        });
      });
      let i = 0;
      const step = () => {
        const [lit, units, li] = steps[i];
        setLit(lit);
        // Show which letter is being sent: S O S, current one highlighted.
        caption.innerHTML = SOS.map(([l], k) => `<span${k === li ? ' class="on"' : ''}>${l}</span>`).join('');
        i = (i + 1) % steps.length;
        timer = setTimeout(step, units * unit);
      };
      step();
    }

    function restart() {
      clearTimeout(timer);
      light.style.background = color.value;
      overlay.classList.toggle('flashing', mode !== 'steady');
      ({ steady: runSteady, strobe: runStrobe, sos: runSOS })[mode]();
    }

    async function keepAwake() {
      if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
      try {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      } catch { /* not allowed (battery saver, iframe…): the light still works */ }
    }

    async function turnOn() {
      if (on) return;
      on = true;
      if (!overlay) buildOverlay();
      overlay.hidden = false;
      document.documentElement.classList.add('fl-active');
      restart();
      overlay.focus({ preventScroll: true });
      // Fullscreen hides the browser bars, so more of the screen lights up.
      // iPhone Safari has no element fullscreen; the overlay alone covers the page.
      const fs = overlay.requestFullscreen || overlay.webkitRequestFullscreen;
      if (fs) { try { await fs.call(overlay); } catch { /* fine without */ } }
      keepAwake();
      PK.setStatus($('#flStatus'), 'Light is on.');
    }

    function turnOff() {
      if (!on) return;
      on = false;
      clearTimeout(timer);
      overlay.hidden = true;
      document.documentElement.classList.remove('fl-active');
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      if (fsEl) {
        try { Promise.resolve((document.exitFullscreen || document.webkitExitFullscreen).call(document)).catch(() => {}); } catch { /* ignore */ }
      }
      if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
      PK.setStatus($('#flStatus'), 'Fills the screen with light. Tap anywhere on the light, or press Esc, to turn it off.');
      if (!root.hidden) $('#flPower').focus({ preventScroll: true });
    }

    $('#flPower').addEventListener('click', turnOn);

    // Leaving fullscreen (Esc, back gesture) turns the light off too.
    const onFsChange = () => { if (on && !(document.fullscreenElement || document.webkitFullscreenElement)) turnOff(); };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    // The wake lock is dropped when the tab is hidden; take it again on return.
    document.addEventListener('visibilitychange', () => { if (on && !wakeLock) keepAwake(); });
    // Turn off when leaving this tool.
    window.addEventListener('hashchange', () => setTimeout(() => { if (root.hidden && on) turnOff(); }));
  },
});
