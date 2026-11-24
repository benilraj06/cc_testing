PK.register({
  id: 'jwt',
  title: 'JWT Decoder',
  desc: 'Read the header, payload and expiry of a JSON Web Token.',
  icon: 'i-key',
  category: 'Hash & Encode',
  keywords: 'json web token bearer auth claims',
  html: `
    <div class="card">
      <label class="field-label" for="jwtInput">Token</label>
      <textarea id="jwtInput" rows="4" class="mono-in" placeholder="eyJhbGciOi…"></textarea>
      <p class="status" id="jwtStatus">The signature is not verified — this only reads the token.</p>
    </div>
    <div class="card" id="jwtClaimsCard" hidden>
      <h2 class="card-title">Summary</h2>
      <table class="kv" id="jwtClaims"></table>
    </div>
    <div class="two-col">
      <div class="card result">
        <div class="result-head"><span class="field-label">Header</span>${PK.copyButton()}</div>
        <output id="jwtHeader" class="mono pre"></output>
      </div>
      <div class="card result">
        <div class="result-head"><span class="field-label">Payload</span>${PK.copyButton()}</div>
        <output id="jwtPayload" class="mono pre tall"></output>
      </div>
    </div>`,

  init(root, $) {
    const input = $('#jwtInput');
    const status = $('#jwtStatus');
    const headerOut = $('#jwtHeader');
    const payloadOut = $('#jwtPayload');
    const claimsCard = $('#jwtClaimsCard');
    const claims = $('#jwtClaims');
    const esc = PK.escapeHTML;
    const NOTE = 'The signature is not verified — this only reads the token.';

    function decodePart(part) {
      let b64 = part.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    }

    function timeRow(label, secs) {
      if (typeof secs !== 'number') return '';
      const d = new Date(secs * 1000);
      return `<tr><th>${label}</th><td>${esc(d.toLocaleString())} <span class="muted">(${esc(PK.relativeTime(d))})</span></td></tr>`;
    }

    function run() {
      const token = input.value.trim().replace(/^Bearer\s+/i, '');
      headerOut.textContent = payloadOut.textContent = '';
      claimsCard.hidden = true;
      input.classList.remove('invalid');
      if (!token) { PK.setStatus(status, NOTE); return; }

      const segs = token.split('.');
      if (segs.length < 2) { input.classList.add('invalid'); PK.setStatus(status, 'A JWT has parts separated by dots (header.payload.signature).', true); return; }
      let header, payload;
      try { header = decodePart(segs[0]); } catch { input.classList.add('invalid'); PK.setStatus(status, 'The header is not valid Base64url-encoded JSON.', true); return; }
      try { payload = decodePart(segs[1]); } catch { input.classList.add('invalid'); PK.setStatus(status, 'The payload is not valid Base64url-encoded JSON.', true); return; }

      headerOut.textContent = JSON.stringify(header, null, 2);
      payloadOut.textContent = JSON.stringify(payload, null, 2);

      const now = Date.now() / 1000;
      let state = '<span class="badge ok">No expiry</span>';
      if (typeof payload.exp === 'number') {
        state = payload.exp < now ? '<span class="badge bad">Expired</span>' : '<span class="badge ok">Not expired</span>';
      }
      if (typeof payload.nbf === 'number' && payload.nbf > now) state = '<span class="badge warn">Not valid yet</span>';

      claims.innerHTML =
        `<tr><th>Status</th><td>${state}</td></tr>` +
        `<tr><th>Algorithm</th><td>${esc(header.alg || '—')}${header.alg === 'none' ? ' <span class="badge bad">Unsigned</span>' : ''}</td></tr>` +
        (payload.sub !== undefined ? `<tr><th>Subject</th><td>${esc(payload.sub)}</td></tr>` : '') +
        (payload.iss !== undefined ? `<tr><th>Issuer</th><td>${esc(payload.iss)}</td></tr>` : '') +
        (payload.aud !== undefined ? `<tr><th>Audience</th><td>${esc([].concat(payload.aud).join(', '))}</td></tr>` : '') +
        timeRow('Issued', payload.iat) + timeRow('Not before', payload.nbf) + timeRow('Expires', payload.exp);
      claimsCard.hidden = false;
      PK.setStatus(status, NOTE);
    }

    input.addEventListener('input', run);
    const [hBtn, pBtn] = root.querySelectorAll('[data-copy]');
    PK.setupCopy(hBtn, () => headerOut.textContent);
    PK.setupCopy(pBtn, () => payloadOut.textContent);
  },
});
