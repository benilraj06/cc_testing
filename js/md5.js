// MD5 over a Uint8Array, returning a lowercase hex string.
// Web Crypto has no MD5, so this is a small self-contained implementation.
(function (global) {
  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
  ];
  const K = new Uint32Array(64);
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32);

  function md5(bytes) {
    const len = bytes.length;
    const nWords = (((len + 8) >>> 6) + 1) * 16;
    const M = new Uint32Array(nWords);
    for (let i = 0; i < len; i++) M[i >>> 2] |= bytes[i] << ((i % 4) * 8);
    M[len >>> 2] |= 0x80 << ((len % 4) * 8);
    M[nWords - 2] = (len * 8) >>> 0;
    M[nWords - 1] = Math.floor(len / 0x20000000);

    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;

    for (let off = 0; off < nWords; off += 16) {
      let A = a0, B = b0, C = c0, D = d0;
      for (let i = 0; i < 64; i++) {
        let F, g;
        if (i < 16) { F = (B & C) | (~B & D); g = i; }
        else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
        else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
        else { F = C ^ (B | ~D); g = (7 * i) % 16; }
        F = (F + A + K[i] + M[off + g]) >>> 0;
        A = D; D = C; C = B;
        B = (B + ((F << S[i]) | (F >>> (32 - S[i])))) >>> 0;
      }
      a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0;
      c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
    }

    let hex = '';
    for (const w of [a0, b0, c0, d0]) {
      for (let j = 0; j < 4; j++) hex += ((w >>> (j * 8)) & 0xff).toString(16).padStart(2, '0');
    }
    return hex;
  }

  global.md5 = md5;
})(typeof self !== 'undefined' ? self : globalThis);
