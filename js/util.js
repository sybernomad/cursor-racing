// Cursor Racing — shared namespace and small math helpers. Classic script (no build step).
window.CR = window.CR || {};
(function (CR) {
  'use strict';
  const TAU = Math.PI * 2;
  const U = {
    TAU,
    clamp: (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v),
    lerp: (a, b, t) => a + (b - a) * t,
    smooth: (t) => t * t * (3 - 2 * t),
    angDiff: (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; },
    dist: (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay),
    // deterministic RNG (mulberry32) so tracks dress the same every time
    rng(seed) {
      let a = seed >>> 0;
      return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    hex(h) { // '#rrggbb' -> [r,g,b] 0..1
      const n = parseInt(h.slice(1), 16);
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    },
    mix3: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
    shade: (c, k) => [c[0] * k, c[1] * k, c[2] * k],
    fmtTime(t) {
      if (t == null || !isFinite(t)) return '--:--.--';
      // round to hundredths first, so 59.996 shows as 1:00.00 rather than 0:60.00
      const cs = Math.round(t * 100), m = Math.floor(cs / 6000), s = (cs - m * 6000) / 100;
      return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`;
    },
    ordinal(n) { return n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th'); },
  };

  // ---- 4x4 matrices (column-major, like WebGL expects) ----
  const M4 = {
    ident() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
    mul(a, b, o = new Float32Array(16)) {
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
        o[i * 4 + j] = s;
      }
      return o;
    },
    persp(fovy, aspect, near, far) {
      const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far), m = new Float32Array(16);
      m[0] = f / aspect; m[5] = f; m[10] = (far + near) * nf; m[11] = -1; m[14] = 2 * far * near * nf; return m;
    },
    ortho(l, r, b, t, n, f) {
      const m = new Float32Array(16);
      m[0] = 2 / (r - l); m[5] = 2 / (t - b); m[10] = -2 / (f - n);
      m[12] = -(r + l) / (r - l); m[13] = -(t + b) / (t - b); m[14] = -(f + n) / (f - n); m[15] = 1; return m;
    },
    lookAt(e, c, up) {
      let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2];
      let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
      let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
      l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
      const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
      const m = new Float32Array(16);
      m[0] = xx; m[1] = yx; m[2] = zx; m[4] = xy; m[5] = yy; m[6] = zy; m[8] = xz; m[9] = yz; m[10] = zz;
      m[12] = -(xx * e[0] + xy * e[1] + xz * e[2]);
      m[13] = -(yx * e[0] + yy * e[1] + yz * e[2]);
      m[14] = -(zx * e[0] + zy * e[1] + zz * e[2]); m[15] = 1;
      return m;
    },
    // model matrix: translate, yaw around Y, then pitch (around local Z = nose up) and roll (local X)
    model(x, y, z, yaw, pitch, roll, s = 1, o = new Float32Array(16)) {
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
      // R = Ry(yaw) * Rz(pitch) * Rx(roll)
      const a00 = cy * cp, a01 = -cy * sp * cr + sy * sr, a02 = cy * sp * sr + sy * cr;
      const a10 = sp, a11 = cp * cr, a12 = -cp * sr;
      const a20 = -sy * cp, a21 = sy * sp * cr + cy * sr, a22 = -sy * sp * sr + cy * cr;
      o[0] = a00 * s; o[1] = a10 * s; o[2] = a20 * s; o[3] = 0;
      o[4] = a01 * s; o[5] = a11 * s; o[6] = a21 * s; o[7] = 0;
      o[8] = a02 * s; o[9] = a12 * s; o[10] = a22 * s; o[11] = 0;
      o[12] = x; o[13] = y; o[14] = z; o[15] = 1;
      return o;
    },
    xform(m, x, y, z) { // returns clip coords
      return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13],
        m[2] * x + m[6] * y + m[10] * z + m[14], m[3] * x + m[7] * y + m[11] * z + m[15]];
    },
  };

  CR.U = U; CR.M4 = M4;
})(window.CR);
