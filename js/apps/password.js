PK.register({
  id: 'password',
  title: 'Password Generator',
  desc: 'Strong random passwords and memorable passphrases.',
  icon: 'i-lock',
  category: 'Generate',
  keywords: 'passphrase random secure secret',
  html: `
    <div class="segmented" role="radiogroup" aria-label="Type">
      <label><input type="radio" name="pwMode" value="password" checked><span>Password</span></label>
      <label><input type="radio" name="pwMode" value="phrase"><span>Passphrase</span></label>
    </div>
    <div class="card result">
      <output id="pwOutput" class="mono big-out"></output>
      <div class="meter"><span id="pwMeter"></span></div>
      <p class="status" id="pwStrength"></p>
      <div class="btn-row">
        <button class="btn btn-primary btn-sm" id="pwRegen" type="button">${PK.icon('i-refresh')}Generate</button>
        ${PK.copyButton()}
      </div>
    </div>
    <div class="card" id="pwOptions">
      <label class="field-label" for="pwLength">Length <span class="val" id="pwLengthVal"></span></label>
      <input type="range" id="pwLength" min="6" max="64" value="20">
      <div class="checks" style="margin-top:14px">
        <label class="check"><input type="checkbox" id="pwUpper" checked> A–Z</label>
        <label class="check"><input type="checkbox" id="pwLower" checked> a–z</label>
        <label class="check"><input type="checkbox" id="pwDigits" checked> 0–9</label>
        <label class="check"><input type="checkbox" id="pwSymbols" checked> !@#$</label>
        <label class="check"><input type="checkbox" id="pwAmbig"> Avoid look-alikes (Il1O0)</label>
      </div>
    </div>
    <div class="card" id="phOptions" hidden>
      <label class="field-label" for="phWords">Words <span class="val" id="phWordsVal"></span></label>
      <input type="range" id="phWords" min="3" max="10" value="5">
      <div class="row">
        <div class="field">
          <label class="field-label" for="phSep">Separator</label>
          <select class="input" id="phSep">
            <option value="-">Hyphen ( - )</option>
            <option value=" ">Space</option>
            <option value=".">Dot ( . )</option>
            <option value="_">Underscore ( _ )</option>
            <option value="">None</option>
          </select>
        </div>
      </div>
      <div class="checks" style="margin-top:14px">
        <label class="check"><input type="checkbox" id="phCap" checked> Capitalize</label>
        <label class="check"><input type="checkbox" id="phNum"> Add a number</label>
      </div>
    </div>`,

  init(root, $) {
    const SETS = {
      upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      lower: 'abcdefghijklmnopqrstuvwxyz',
      digits: '0123456789',
      symbols: '!@#$%^&*()-_=+[]{};:,.?/~',
    };
    const AMBIGUOUS = /[Il1O0o|]/g;
    const WORDS = ('able acid aged also area army away baby back ball band bank base bath bear beat bell belt best bike bird blue boat body bone book boot born boss bowl bread brick bring brush cake call calm camp card care cart case cash cave chair chalk cheek chess chief chin city clay clock cloud coal coast coat code coin cold cook cool copy cord corn crab crew crop crow cube cup curl dark dawn deal deer desk dial dice dish dock door dove draw dream dress drum duck dune dust eagle earth east echo edge eggs elbow elm ember fact fair farm fast fern field film fire fish five flag flame flat flute foam fog folk food foot fork fort fox frog fruit fuel game gate gear gift glad glass glow goat gold golf good grape grass green grid gulf hair hall hand harp hawk heat herb hill hint hive honey hood hook horn horse host hour house ice idea inch iron island ivy jade jam jazz jeep jelly jewel job joke juice jump jungle kale keen kettle key kick king kite knee knife knot lake lamp land lane leaf lemon lens light lily lime lion list lock loft log loop lunar maple map march mask meal melon metal mile milk mint mist moon moss moth mouse mud nail name navy neck nest net night noble north note nut oak oasis ocean olive onion opal orbit otter oven owl pace page paint palm panda paper park path peach pearl pen pepper piano pier pine pink pipe plum poem pond pony pool port pot quail queen quest quiet quilt rabbit radio rain ramp raven reef rice ridge ring river road robin rock roof room rope rose ruby sail salt sand scarf sea seal seed shell ship shoe silk silver sky sled snow soap sock sofa solar song soup spark spoon star steam stone storm sugar sun swan table tail tea tent tide tiger toast tool tower town toy train tree tulip tuna valley van vase velvet violet wagon wall wave wheat whale wind wing winter wolf wood wool yard yarn yoga zebra zero zinc').split(' ');

    const output = $('#pwOutput');
    const meter = $('#pwMeter');
    const strength = $('#pwStrength');
    const len = $('#pwLength');
    const words = $('#phWords');
    const mode = () => root.querySelector('input[name="pwMode"]:checked').value;
    const pick = (str) => str[PK.randomInt(str.length)];

    function password() {
      let sets = ['upper', 'lower', 'digits', 'symbols'].filter((k) => $('#pw' + k[0].toUpperCase() + k.slice(1)).checked).map((k) => SETS[k]);
      if ($('#pwAmbig').checked) sets = sets.map((s) => s.replace(AMBIGUOUS, ''));
      if (!sets.length) return { text: '', bits: 0, error: 'Pick at least one character type.' };
      const pool = sets.join('');
      const n = Number(len.value);
      // One character from each chosen set, the rest from the whole pool, then shuffle.
      const chars = sets.map(pick);
      while (chars.length < n) chars.push(pick(pool));
      for (let i = chars.length - 1; i > 0; i--) {
        const j = PK.randomInt(i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
      }
      return { text: chars.slice(0, n).join(''), bits: n * Math.log2(pool.length) };
    }

    function passphrase() {
      const n = Number(words.value);
      const cap = $('#phCap').checked;
      const list = Array.from({ length: n }, () => {
        const w = WORDS[PK.randomInt(WORDS.length)];
        return cap ? w[0].toUpperCase() + w.slice(1) : w;
      });
      let bits = n * Math.log2(WORDS.length);
      if ($('#phNum').checked) {
        const i = PK.randomInt(list.length);
        list[i] += PK.randomInt(100);
        bits += Math.log2(100) + Math.log2(n);
      }
      return { text: list.join($('#phSep').value), bits };
    }

    function rate(bits) {
      if (bits < 40) return ['Weak', 'var(--danger)', 25];
      if (bits < 60) return ['Fair', '#f59e0b', 50];
      if (bits < 80) return ['Strong', 'var(--success)', 75];
      return ['Very strong', 'var(--success)', 100];
    }

    function generate() {
      const isPw = mode() === 'password';
      $('#pwOptions').hidden = !isPw;
      $('#phOptions').hidden = isPw;
      $('#pwLengthVal').textContent = len.value;
      $('#phWordsVal').textContent = words.value;
      const r = isPw ? password() : passphrase();
      output.textContent = r.text;
      if (r.error) {
        PK.setStatus(strength, r.error, true);
        meter.style.width = '0';
        return;
      }
      const [label, color, pct] = rate(r.bits);
      meter.style.width = pct + '%';
      meter.style.background = color;
      PK.setStatus(strength, `${label} · about ${Math.round(r.bits)} bits of randomness`);
    }

    root.querySelectorAll('input, select').forEach((el) => el.addEventListener('input', generate));
    $('#pwRegen').addEventListener('click', generate);
    PK.setupCopy($('[data-copy]'), () => output.textContent);
    generate();
  },
});
