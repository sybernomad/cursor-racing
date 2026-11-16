// Cursor Racing — builds a playable world from a track definition: centreline, surfaces,
// colliders, the painted table texture and the static voxel/sprite geometry.
(function (CR) {
  'use strict';
  const { U, G } = CR;
  const TEX = 2;          // world units per ground texel
  const STEP = 8;         // centreline sample spacing
  const CHUNK = 700;      // static geometry chunk size (for culling)

  function catmull(pts, sub = 40) {
    const out = [], n = pts.length;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      for (let k = 0; k < sub; k++) {
        const t = k / sub, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    return out;
  }

  class World {
    // opts.clean: no obstacles (moving hazards, bumpers, springs, jump gaps, spills, loose balls). Ramps and boost pads stay.
    constructor(def, reversed = false, opts = {}) {
      this.def = def; this.reversed = reversed; this.clean = !!opts.clean;
      this.theme = CR.THEMES[def.theme];
      this.light = CR.LIGHT[this.theme.light];
      this.W = def.W; this.H = def.H; this.width = def.width; this.hw = def.width / 2;
      this.rnd = U.rng(def.seed + (reversed ? 999 : 0));
      const tf = (t) => (reversed ? (1 - t + 1) % 1 : t);
      this.tf = tf;
      this.buildLine(reversed ? def.pts.slice().reverse() : def.pts);
      this.colliders = []; this.cgrid = new Map();
      this.holes = [];
      this.zones = (this.clean ? [] : def.zones || []).map((z) => this.place(tf(z.t), z.off * (reversed ? -1 : 1), z));
      this.boosts = (def.boosts || []).map((b) => this.place(tf(b.t), b.off * (reversed ? -1 : 1), { rx: 34, ry: 26, ...b }));
      this.ramps = (def.ramps || []).map((r) => {
        const len = r.len * 3, t = reversed ? (1 - r.t - len / this.L + 1) % 1 : r.t;
        const p = this.place(t, 0, r); p.len = len; p.hgt = 16; p.s0 = p.s; p.gapLen = this.clean ? 0 : r.gap || 0; return p;
      });
      const sg = reversed ? -1 : 1;
      this.hazards = (this.clean ? [] : def.hazards || []).map((h) => {
        const o = this.place(tf(h.t), (h.off || 0) * sg, h);
        o.side = (h.side || 1) * sg; return o;
      });
      // keep the starting grid clear: anything placed on it moves up the road
      const clearGrid = (o, len = 0) => {
        let d = o.s; if (d > this.L / 2) d -= this.L;
        if (d + len > -GRID_LEN && d < 20) { const p = this.place(0, 0, {}); const ns = 40 + Math.max(0, len - 0) + 180; const q = this.at(ns), off = (o.x - this.at(o.s).x) * -this.at(o.s).ty + (o.y - this.at(o.s).y) * this.at(o.s).tx;
          o.s = ns; o.x = q.x - q.ty * off; o.y = q.y + q.tx * off; o.ang = Math.atan2(q.ty, q.tx); if (o.s0 != null) o.s0 = ns; }
      };
      this.zones.forEach((z) => clearGrid(z, z.rx)); this.boosts.forEach((b) => clearGrid(b, b.rx));
      this.ramps.forEach((r) => clearGrid(r, r.len + r.gapLen + 20)); this.hazards.forEach((h) => clearGrid(h, 40));
      // jump gaps: a drop across the road just past a ramp
      this.gaps = this.ramps.filter((r) => r.gapLen).map((r) => {
        const s0 = r.s + r.len + 10, p = this.at(s0);
        return { s: s0, x: p.x, y: p.y, ang: Math.atan2(p.ty, p.tx), len: r.gapLen, half: this.hw + 40 };
      });
      this.springs = this.hazards.filter((h) => h.type === 'spring');
      // item box rows, on clear road
      this.itemRows = [];
      for (const f of [0.22, 0.5, 0.78]) {
        let s0 = f * this.L;
        for (let k = 0; k < 40 && !this.clearAt(s0, 90); k++) s0 += 25;
        const p = this.at(s0);
        this.itemRows.push([-0.55, 0, 0.55].map((o) => ({ x: p.x - p.ty * o * this.hw, y: p.y + p.tx * o * this.hw, s: s0, on: true, t: 0 })));
      }
      if (def.drain) this.holes.push({ x: def.drain[0], y: def.drain[1], r: def.drain[2], look: 'drain' });
      if (this.theme.pockets) {
        const m = 70, r = 58;
        for (const [x, y] of [[m, m], [this.W / 2, m - 18], [this.W - m, m], [m, this.H - m], [this.W / 2, this.H - m + 18], [this.W - m, this.H - m]]) this.holes.push({ x, y, r, look: 'pocket' });
      }
      this.lights = [];
      this.balls = [];
    }

    // ---------- centreline ----------
    buildLine(pts) {
      const raw = catmull(pts);
      const len = [0];
      for (let i = 1; i <= raw.length; i++) { const a = raw[i - 1], b = raw[i % raw.length]; len.push(len[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
      const L = len[raw.length], n = Math.floor(L / STEP);
      this.L = n * STEP; this.N = n;
      this.px = new Float32Array(n); this.py = new Float32Array(n); this.tx = new Float32Array(n); this.ty = new Float32Array(n);
      let j = 0;
      for (let i = 0; i < n; i++) {
        const s = i * (L / n);
        while (len[j + 1] < s) j++;
        const a = raw[j], b = raw[(j + 1) % raw.length], f = (s - len[j]) / (len[j + 1] - len[j] || 1);
        this.px[i] = a[0] + (b[0] - a[0]) * f; this.py[i] = a[1] + (b[1] - a[1]) * f;
      }
      for (let i = 0; i < n; i++) {
        const a = (i - 1 + n) % n, b = (i + 1) % n;
        let dx = this.px[b] - this.px[a], dy = this.py[b] - this.py[a]; const l = Math.hypot(dx, dy) || 1;
        this.tx[i] = dx / l; this.ty[i] = dy / l;
      }
      // curvature-based "corner speed" per sample (used by the AI)
      this.curv = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const k = 6, a = (i - k + n) % n, b = (i + k) % n;
        const h0 = Math.atan2(this.ty[a], this.tx[a]), h1 = Math.atan2(this.ty[b], this.tx[b]);
        this.curv[i] = Math.abs(U.angDiff(h0, h1)) / (2 * k * STEP);
      }
      // start/finish goes on the straightest stretch (lowest curvature before and after it)
      let bestI = 0, bestV = Infinity;
      if (this.def.start) { // a track can name its start point
        let bd = Infinity; for (let i = 0; i < n; i++) { const d = (this.px[i] - this.def.start[0]) ** 2 + (this.py[i] - this.def.start[1]) ** 2; if (d < bd) { bd = d; bestI = i; } }
        bestV = -1;
      }
      for (let i = 0; i < n && bestV >= 0; i++) {
        let v = 0; for (let k = -40; k <= 20; k++) v += this.curv[(i + k + n) % n];
        if (v < bestV) { bestV = v; bestI = i; }
      }
      this.startOff = bestI;
      const rot = (a) => { const b = new Float32Array(n); for (let i = 0; i < n; i++) b[i] = a[(i + bestI) % n]; return b; };
      this.px = rot(this.px); this.py = rot(this.py); this.tx = rot(this.tx); this.ty = rot(this.ty); this.curv = rot(this.curv);
      this.grid = new Map();
      for (let i = 0; i < n; i++) { const k = this.gk(this.px[i], this.py[i]); if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(i); }
    }
    gk(x, y) { return (Math.floor(x / 80) + 1000) * 4096 + Math.floor(y / 80) + 1000; }
    // nearest centreline sample anywhere (radius-limited)
    nearestGlobal(x, y, maxR = 480) {
      let best = -1, bd = Infinity;
      const cx = Math.floor(x / 80), cy = Math.floor(y / 80), rr = Math.ceil(maxR / 80);
      for (let r = 0; r <= rr; r++) {
        for (let i = cx - r; i <= cx + r; i++) for (let j = cy - r; j <= cy + r; j++) {
          if (Math.max(Math.abs(i - cx), Math.abs(j - cy)) !== r) continue;
          const arr = this.grid.get((i + 1000) * 4096 + j + 1000); if (!arr) continue;
          for (const k of arr) { const d = (this.px[k] - x) ** 2 + (this.py[k] - y) ** 2; if (d < bd) { bd = d; best = k; } }
        }
        if (best >= 0 && Math.sqrt(bd) < (r - 0.5) * 80) break;
      }
      return { i: best, d: Math.sqrt(bd) };
    }
    // nearest sample near a hint index (cars track their own index)
    nearestLocal(x, y, hint, K = 28) {
      const n = this.N; let best = hint, bd = Infinity;
      for (let o = -K; o <= K; o++) { const k = (hint + o + n) % n; const d = (this.px[k] - x) ** 2 + (this.py[k] - y) ** 2; if (d < bd) { bd = d; best = k; } }
      return best;
    }
    // projection of a point onto the line at sample i
    project(x, y, i) {
      const dx = x - this.px[i], dy = y - this.py[i];
      const along = dx * this.tx[i] + dy * this.ty[i], lat = -dx * this.ty[i] + dy * this.tx[i];
      return { s: (i * STEP + along + this.L) % this.L, lat };
    }
    at(s) { // point + tangent at distance s
      s = ((s % this.L) + this.L) % this.L;
      const f = s / STEP, i = Math.floor(f) % this.N, j = (i + 1) % this.N, t = f - Math.floor(f);
      const x = this.px[i] + (this.px[j] - this.px[i]) * t, y = this.py[i] + (this.py[j] - this.py[i]) * t;
      let tx = this.tx[i] + (this.tx[j] - this.tx[i]) * t, ty = this.ty[i] + (this.ty[j] - this.ty[i]) * t; const l = Math.hypot(tx, ty) || 1;
      return { x, y, tx: tx / l, ty: ty / l, i };
    }
    place(t, off, extra) {
      const s = ((t * this.L - this.startOff * STEP) % this.L + this.L) % this.L, p = this.at(s);
      return { ...extra, s, x: p.x - p.ty * off, y: p.y + p.tx * off, ang: Math.atan2(p.ty, p.tx) };
    }
    onTrackish(x, y, pad) { const n = this.nearestGlobal(x, y, this.hw + pad + 80); return n.i >= 0 && n.d < this.hw + pad; }
    inTable(x, y, m) { return x > m && y > m && x < this.W - m && y < this.H - m; }

    clearAt(s0, pad) { // nothing placed within pad of distance s0 along the lap
      const near = (s) => { let d = Math.abs(s - s0) % this.L; d = Math.min(d, this.L - d); return d < pad; };
      if (near(0) || (s0 > this.L - GRID_LEN)) return false;
      for (const r of this.ramps) if (near(r.s) || near(r.s + r.len + r.gapLen)) return false;
      for (const z of this.zones.concat(this.boosts, this.hazards)) if (near(z.s)) return false;
      return true;
    }
    inGap(x, y) {
      for (const g of this.gaps) {
        const dx = x - g.x, dy = y - g.y, c = Math.cos(g.ang), sn = Math.sin(g.ang);
        const u = dx * c + dy * sn, v = -dx * sn + dy * c;
        if (u >= 0 && u <= g.len && Math.abs(v) <= g.half) return g;
      }
      return null;
    }
    // ---------- surfaces ----------
    // returns {type, grip, top} for a ground point
    surface(x, y, lat) {
      const edgeM = this.theme.edge === 'void' ? 0 : -9999;
      if (x < edgeM || y < edgeM || x > this.W - edgeM || y > this.H - edgeM) return S.void;
      for (const h of this.holes) if ((x - h.x) ** 2 + (y - h.y) ** 2 < h.r * h.r) return S.void;
      if (this.gaps.length && this.inGap(x, y)) return S.void;
      for (const z of (this.oil || EMPTY)) if ((x - z.x) ** 2 + (y - z.y) ** 2 < z.r * z.r) return S.slick;
      for (const z of this.zones) if (inEll(z, x, y)) return z.type === 'slick' ? S.slick : S.sticky;
      for (const b of this.boosts) if (inEll(b, x, y)) return S.boost;
      if (Math.abs(lat) <= this.hw) return S.track;
      return this.roughS || (this.roughS = { type: 'rough', grip: this.theme.rough.grip, top: this.theme.rough.top });
    }
    rampHeight(x, y) { // height of a ramp under a point, 0 if none. Also returns slope end flag
      for (const r of this.ramps) {
        const dx = x - r.x, dy = y - r.y, c = Math.cos(r.ang), s = Math.sin(r.ang);
        const u = dx * c + dy * s, v = -dx * s + dy * c;
        if (u >= 0 && u <= r.len && Math.abs(v) <= this.hw) return { h: (u / r.len) * r.hgt, end: u > r.len - 12, slope: r.hgt / r.len };
      }
      return null;
    }

    // ---------- colliders ----------
    addCol(c) {
      this.colliders.push(c);
      const rad = c.r || Math.hypot(c.hw, c.hd);
      for (let i = Math.floor((c.x - rad) / 120); i <= Math.floor((c.x + rad) / 120); i++) for (let j = Math.floor((c.y - rad) / 120); j <= Math.floor((c.y + rad) / 120); j++) {
        const k = i * 4096 + j; if (!this.cgrid.has(k)) this.cgrid.set(k, []); this.cgrid.get(k).push(c);
      }
    }
    collidersNear(x, y) { return this.cgrid.get(Math.floor(x / 120) * 4096 + Math.floor(y / 120)) || EMPTY; }

    // ---------- build everything that's drawn ----------
    build(gl) {
      const T = this.theme, rnd = this.rnd;
      this.chunks = new Map();
      this.sprites = CR.atlas.uv;
      this.paintGround();
      // table sides + floor
      this.buildTable();
      // walls for framed themes
      if (T.edge === 'wall') this.buildWalls();
      // start gantry
      this.buildStart();
      // ramps
      const RLOOK = { book: ['#c0392b', '#f2ead8'], ruler: ['#ffd43b', '#343a40'], plank: ['#a0703f', '#ffd43b'], rack: ['#5c2e0e', '#ffd43b'], sponge: ['#ffe066', '#40c057'], block: ['#da77f2', '#ffd43b'], tape: ['#868e96', '#ffd43b'], board: ['#c9a46b', '#222222'], key: ['#343a40', '#3ff0ff'], cookie: ['#d4a056', '#4a2511'], snow: ['#e7f5ff', '#e03131'], bread: ['#e9b872', '#a8632a'], bridge: ['#8d6e53', '#f1f3f5'] };
      for (const r of this.ramps) {
        const [c, s] = RLOOK[r.look] || RLOOK.book;
        const pr = CR.prop('ramp', { len: Math.round(r.len / 3), wid: Math.round(this.width / 3) + 2, hgt: Math.round(r.hgt / 3), color: c, stripe: s });
        const m = this.at(r.s + r.len / 2);
        this.addProp(pr, m.x, m.y, r.ang, 0, false);
      }
      // fixed hazards: bumpers and spring pads; moving ones get their own meshes
      this.movers = [];
      for (const h of this.hazards) {
        if (h.type === 'bumper') this.addProp(CR.prop('bumper', { color: ['#ff4dd8', '#3ff0ff', '#ffd43b'][Math.floor(h.s) % 3] }, 1), h.x, h.y, 0, 0, true);
        else if (h.type === 'spring') this.addProp(CR.prop('spring', {}, 1), h.x, h.y, h.ang, 0, false);
        else if (h.type === 'sweeper') {
          const p = this.at(h.s), side = h.side, px = p.x - p.ty * (this.hw + 16) * side, py = p.y + p.tx * (this.hw + 16) * side;
          const len = this.width * 0.92, base = Math.atan2(-p.tx * side, p.ty * side); // pointing across the road
          this.movers.push({ type: 'sweeper', x: px, y: py, base, len, amp: 1.05, speed: h.speed || 1.2, ph: h.s * 0.01, ang: base, mesh: G.upload(gl, CR.armMesh(h.look, len)), m: new Float32Array(16) });
        } else if (h.type === 'shuttle') {
          const raw = h.look === 'train' ? 'train' : h.look === 'vacuum' ? 'vacuum' : h.look === 'beetle' ? 'ladybug' : h.look === 'pin' ? 'rollingpin' : h.look;
          const pr = CR.prop(raw, {}, 3);
          const col = pr.col || { c: 16 };
          const r = col.c || Math.max(col.w, col.d) / 2;
          // long things are boxes: the train runs across the road, the rolling pin lies along it and rolls across
          const box = !!col.w && col.w > col.d * 2, train = h.look === 'train';
          const reach = this.hw + (train ? 170 : 28);
          this.movers.push({ type: 'shuttle', cx: h.x, cy: h.y, nx: -Math.sin(h.ang), ny: Math.cos(h.ang), ang: h.ang, box, train,
            oang: train ? h.ang + Math.PI / 2 : h.ang, hw: box ? col.w / 2 : 0, hd: box ? col.d / 2 : 0, r: box ? 0 : (col.c || 16),
            reach, x: h.x, y: h.y, vx: 0, vy: 0, speed: h.speed || 0.7, ph: h.s * 0.013, h: pr.h, mesh: G.upload(gl, pr.bld), m: new Float32Array(16) });
        }
      }
      this.itemMesh = G.upload(gl, CR.prop('itembox', {}, 1).bld);
      // border dressing
      for (const b of T.border) this.dressBorder(b);
      // set pieces
      for (const p of (this.def.pieces || [])) {
        const pr = CR.prop(p[0], p[4] || {}, Math.floor(p[1] + p[2]));
        const rad = pr.col ? (pr.col.c || Math.max(pr.col.w, pr.col.d)) : 20;
        if (this.onTrackish(p[1], p[2], rad + 6)) { console.warn('piece on track', this.def.id, p); continue; }
        this.addProp(pr, p[1], p[2], p[3] || rnd() * 6.28, 0, true);
      }
      // scatter
      for (const sc of T.scatter) {
        for (let i = 0, tries = 0; i < sc.count && tries < sc.count * 30; tries++) {
          const x = 60 + rnd() * (this.W - 120), y = 60 + rnd() * (this.H - 120);
          const pr = CR.prop(sc.name, sc.opt || {}, i % 5 + 1);
          const rad = pr.col ? (pr.col.c || Math.max(pr.col.w, pr.col.d)) : Math.max(pr.size[0], pr.size[2]) / 2;
          if (this.onTrackish(x, y, rad + 14) || this.holeNear(x, y, rad + 20)) continue;
          this.addProp(pr, x, y, rnd() * 6.28, 0, true); i++;
        }
      }
      for (const sp of T.sprites) {
        for (let i = 0, tries = 0; i < sp.count && tries < sp.count * 30; tries++) {
          let x, y;
          if (sp.near) { const p = this.at(rnd() * this.L), side = rnd() < 0.5 ? -1 : 1, off = this.hw + 30 + rnd() * 50; x = p.x - p.ty * off * side; y = p.y + p.tx * off * side; }
          else { x = 40 + rnd() * (this.W - 80); y = 40 + rnd() * (this.H - 80); }
          if (!this.inTable(x, y, 30) || this.onTrackish(x, y, 22) || this.holeNear(x, y, 30)) continue;
          this.addSprite(sp.name, x, y, sp.size * (0.85 + rnd() * 0.3)); i++;
        }
      }
      // pool balls (dynamic)
      if (this.def.balls && !this.clean) {
        const cols = ['#ffd43b', '#1c7ed6', '#e03131', '#7048e8', '#f76707', '#2b8a3e', '#862e9c', '#111111'];
        this.def.balls.forEach((b, i) => {
          const p = this.place(this.tf(b[0]), b[1] * (this.reversed ? -1 : 1), {});
          const raw = CR.propRaw('ball', { color: cols[i % cols.length], stripe: i > 3 }, i + 1);
          const bld = G.mesh(raw.vox, raw.vs, raw.vox.sx / 2, raw.vox.sy / 2, raw.vox.sz / 2);
          this.balls.push({ x: p.x, y: p.y, hx: p.x, hy: p.y, vx: 0, vy: 0, r: 10.8, mass: 0.7, rot: 0, dir: 0, mesh: G.upload(gl, bld), z: 0, out: 0 });
        });
      }
      // lights for night/lamp themes
      if (T.light === 'monitor') { this.lights.push({ x: this.W * 0.3, y: 260, z: -120, col: [0.35, 0.55, 1.3], rad: 1500 }, { x: this.W * 0.75, y: 260, z: -120, col: [0.9, 0.35, 1.1], rad: 1300 }); }
      if (T.light === 'lamp' || this.light === CR.LIGHT.lamp) {
        for (const x of [this.W * 0.22, this.W * 0.5, this.W * 0.78]) this.lights.push({ x, y: 380, z: this.H / 2, col: [1.2, 0.95, 0.6], rad: 900 });
      }
      // upload chunks
      this.meshes = [];
      for (const [k, b] of this.chunks) {
        if (!b.bld.n) continue;
        this.meshes.push({ mesh: G.upload(gl, b.bld), cx: b.cx, cy: b.cy });
      }
      this.chunks = null;
    }
    holeNear(x, y, pad) { for (const h of this.holes) if (Math.hypot(x - h.x, y - h.y) < h.r + pad) return true; return false; }
    chunk(x, y) {
      const i = Math.floor(x / CHUNK), j = Math.floor(y / CHUNK), k = i * 1000 + j;
      let c = this.chunks.get(k);
      if (!c) { c = { bld: new G.Builder(8192), cx: (i + 0.5) * CHUNK, cy: (j + 0.5) * CHUNK }; this.chunks.set(k, c); }
      return c.bld;
    }
    addProp(pr, x, y, ang, z = 0, collide = true) {
      this.chunk(x, y).append(pr.bld, x, z, y, -ang, 1);
      if (collide && pr.col) {
        if (pr.col.c) this.addCol({ x, y, r: pr.col.c, h: pr.h + z, bumper: !!pr.col.bumper });
        else this.addCol({ x, y, hw: pr.col.w / 2, hd: pr.col.d / 2, ang, h: pr.h + z, c: Math.cos(ang), s: Math.sin(ang) });
      }
      if (pr.light) this.lights.push({ x, y: (pr.lightY || 12) + z, z: y, col: pr.light.map((v) => v * 1.4), rad: pr.lightY ? 420 : 150 });
    }
    addSprite(name, x, y, size = 1, bld = null) {
      const s = this.sprites[name]; if (!s) return;
      const px = TEX * size, w = s.w * px, h = s.h * px, lean = 0.45;
      const b = bld || this.chunk(x, y);
      const hy = h * Math.cos(lean), hz = h * Math.sin(lean);
      const nx = 0, ny = 0.55, nz = 0.83;
      const a = b.v(x - w / 2, 0, y, nx, ny, nz, 1, 1, 1, 0, s.u0, s.v1), c = b.v(x + w / 2, 0, y, nx, ny, nz, 1, 1, 1, 0, s.u1, s.v1);
      const d = b.v(x + w / 2, hy, y - hz, nx, ny, nz, 1, 1, 1, 0, s.u1, s.v0), e = b.v(x - w / 2, hy, y - hz, nx, ny, nz, 1, 1, 1, 0, s.u0, s.v0);
      b.quad(a, c, d, e);
    }
    dressBorder(b) {
      const rnd = this.rnd;
      for (let s = 0; s < this.L; s += b.spacing) {
        for (const side of [-1, 1]) {
          if (b.chance && rnd() > b.chance) continue;
          const p = this.at(s), off = (this.hw + b.offset) * side;
          const x = p.x - p.ty * off, y = p.y + p.tx * off;
          if (!this.inTable(x, y, 24) || this.holeNear(x, y, 24)) continue;
          if (b.sprite) { if (!this.onTrackish(x, y, 6)) this.addSprite(b.sprite, x, y, b.size || 1); continue; }
          const pr = CR.prop(b.name, b.opt || {}, Math.floor(s / b.spacing) % 7 + 1 + (side > 0 ? 7 : 0));
          if (b.along) {
            // long props lie along the track; reject if any part would sit on another stretch of track
            const L = pr.size[0], ang = Math.atan2(p.ty, p.tx);
            let ok = true;
            for (let k = -0.5; k <= 0.5; k += 0.25) { const qx = x + Math.cos(ang) * L * k, qy = y + Math.sin(ang) * L * k; if (this.onTrackish(qx, qy, 5) || !this.inTable(qx, qy, 10)) { ok = false; break; } }
            if (ok) this.addProp(pr, x, y, ang, 0, true);
          } else {
            const rad = pr.col ? pr.col.c || 6 : 6;
            if (this.onTrackish(x, y, rad - 1)) continue;
            this.addProp(pr, x, y, rnd() * 6.28, 0, true);
          }
        }
      }
    }
    buildTable() {
      const T = this.theme, b = new G.Builder(64), W = this.W, H = this.H;
      const side = U.hex(T.tableSide), dep = T.edge === 'wall' ? 30 : 46;
      const box = (x0, y0, z0, x1, y1, z1, c) => {
        const f = [[[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]],
          [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]], [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]]];
        for (const q of f) { const n = q[4], k = n[1] ? 1 : 0.85; const id = q.slice(0, 4).map((p, i) => b.v(p[0], p[1], p[2], n[0], n[1], n[2], c[0] * k * (i < 2 ? 1 : 0.8), c[1] * k * (i < 2 ? 1 : 0.8), c[2] * k * (i < 2 ? 1 : 0.8), 0)); b.quad(id[0], id[1], id[2], id[3]); }
      };
      // apron (sides) just under the top
      box(-6, -dep, -6, W + 6, -0.5, H + 6, side);
      // legs
      if (T.edge === 'void') for (const [x, z] of [[60, 60], [W - 100, 60], [60, H - 100], [W - 100, H - 100]]) box(x, -420, z, x + 40, -dep, z + 40, U.shade(side, 0.8));
      this.tableMesh = b;
      // floor
      const fb = new G.Builder(8), fc = U.hex(T.floor), FY = -420, M = 3000;
      const q = [[-M, FY, -M], [W + M, FY, -M], [W + M, FY, H + M], [-M, FY, H + M]].map((p) => fb.v(p[0], p[1], p[2], 0, 1, 0, fc[0], fc[1], fc[2], 0, (p[0]) / 300, (p[2]) / 300));
      fb.quad(q[0], q[1], q[2], q[3]);
      this.floorMesh = fb; this.floorY = FY;
    }
    buildWalls() {
      const W = this.W, H = this.H, t = 26, h = 26, c = U.hex(this.theme.wallCol), wood = U.hex(this.theme.tableSide);
      const v = (len, along) => {
        const n = Math.ceil(len / 6), vx = new G.Vox(n, Math.ceil(h / 6), Math.ceil(t / 6)), r = U.rng(len);
        vx.box(0, 0, 0, n - 1, vx.sy - 1, vx.sz - 1, c, 0, 0.08, r);
        for (let x = 0; x < n; x++) vx.set(x, vx.sy - 1, 0, wood); for (let x = 0; x < n; x++) vx.set(x, vx.sy - 1, vx.sz - 1, wood);
        return G.mesh(vx, 6, n / 2, 0, vx.sz / 2);
      };
      const top = v(W + t * 2, true), sideM = v(H, true);
      const put = (m, x, y, ang, hw, hd) => { this.chunk(x, y).append(m, x, 0, y, -ang, 1); this.addCol({ x, y, hw, hd, ang, h: 99, c: Math.cos(ang), s: Math.sin(ang) }); };
      put(top, W / 2, -t / 2, 0, W / 2 + t, t / 2); put(top, W / 2, H + t / 2, 0, W / 2 + t, t / 2);
      put(sideM, -t / 2, H / 2, Math.PI / 2, H / 2, t / 2); put(sideM, W + t / 2, H / 2, Math.PI / 2, H / 2, t / 2);
    }
    buildStart() {
      const p = this.at(0), ang = Math.atan2(p.ty, p.tx), nx = -p.ty, ny = p.tx, off = this.hw + 14;
      const post = CR.prop('post', {}, 1);
      for (const sd of [-1, 1]) { const x = p.x + nx * off * sd, y = p.y + ny * off * sd; if (!this.onTrackish(x, y, 2)) this.addProp(post, x, y, 0, 0, true); }
      const ban = CR.prop('banner', { n: Math.ceil((this.width + 28) / 2.4) }, 1);
      this.addProp(ban, p.x, p.y, ang, 48, false);
    }

    // ---------- ground texture ----------
    paintGround() {
      const T = this.theme, w = Math.ceil(this.W / TEX), h = Math.ceil(this.H / TEX), rnd = U.rng(this.def.seed * 3);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const x = cv.getContext('2d');
      const em = document.createElement('canvas'); em.width = w; em.height = h; const ex = em.getContext('2d');
      ex.fillStyle = '#000'; ex.fillRect(0, 0, w, h);
      T.ground(x, w, h, rnd);
      this.paintDecals(x, w, h, rnd);
      const path = (ctx) => { ctx.beginPath(); for (let i = 0; i <= this.N; i++) { const k = i % this.N; const px = this.px[k] / TEX, py = this.py[k] / TEX; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); };
      const tw = this.width / TEX, tr = T.track;
      x.lineJoin = 'round'; x.lineCap = 'round';
      // soft contact shadow under the track edge
      x.strokeStyle = 'rgba(0,0,0,0.16)'; x.lineWidth = tw + 14; path(x); x.stroke();
      // curbs
      x.strokeStyle = tr.edgeA; x.lineWidth = tw + 9; path(x); x.stroke();
      x.setLineDash([8, 8]); x.strokeStyle = tr.edgeB; path(x); x.stroke(); x.setLineDash([]);
      if (tr.glow) { ex.lineJoin = 'round'; ex.strokeStyle = '#fff'; ex.lineWidth = tw + 9; path(ex); ex.stroke(); ex.strokeStyle = '#000'; ex.lineWidth = tw + 3; path(ex); ex.stroke(); }
      x.strokeStyle = tr.fill; x.lineWidth = tw; path(x); x.stroke();
      // track texture: speckle + ruled lines / ruts / centre dashes
      x.save(); x.lineWidth = tw; x.strokeStyle = '#000'; path(x);
      if (tr.ruled) {
        // notebook paper: blue rules across the ribbon, done by clipping to a stroked outline
        const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h; const tx = tmp.getContext('2d');
        tx.lineJoin = 'round'; tx.lineWidth = tw; tx.strokeStyle = '#fff'; path(tx); tx.stroke();
        tx.globalCompositeOperation = 'source-in'; tx.fillStyle = 'rgba(77,171,247,0.45)';
        for (let j = 0; j < h; j += 12) tx.fillRect(0, j, w, 1);
        tx.fillStyle = 'rgba(255,107,107,0.4)'; for (let i = 40; i < w; i += 300) tx.fillRect(i, 0, 1, h);
        x.drawImage(tmp, 0, 0);
      }
      x.restore();
      if (tr.ruts) for (const o of [-0.24, 0.24]) {
        x.strokeStyle = 'rgba(90,60,30,0.28)'; x.lineWidth = 6; x.beginPath();
        for (let i = 0; i <= this.N; i++) { const k = i % this.N, ox = -this.ty[k] * o * this.width, oy = this.tx[k] * o * this.width; const px = (this.px[k] + ox) / TEX, py = (this.py[k] + oy) / TEX; i ? x.lineTo(px, py) : x.moveTo(px, py); }
        x.stroke();
      }
      x.setLineDash([10, 14]); x.strokeStyle = tr.line; x.lineWidth = 2; path(x); x.stroke(); x.setLineDash([]);
      // zones
      const LOOK = { milk: ['#fbfbf6', '#ffffff'], jam: ['#8f1d2c', '#c2253a'], water: ['rgba(120,190,255,0.55)', 'rgba(220,245,255,0.6)'], ink: ['#1b2a6b', '#2d3f99'], slime: ['#5ce65c', '#a6ff7a'], oil: ['#1a1a1f', '#3a3a48'], sawdust: ['#d9b77e', '#f0d39b'], coffee: ['#4a2c16', '#6b4226'], flour: ['#fbfaf7', '#ffffff'], batter: ['#e8c37a', '#f5d998'], ice: ['rgba(200,235,255,0.85)', 'rgba(255,255,255,0.9)'], ketchup: ['#c92a2a', '#e03131'], lemonade: ['rgba(255,236,120,0.8)', 'rgba(255,250,200,0.85)'], mud: ['#5c3d2e', '#7a5640'] };
      for (const z of this.zones) {
        const [a, b] = LOOK[z.look] || LOOK.water;
        x.save(); x.translate(z.x / TEX, z.y / TEX); x.rotate(z.ang);
        for (let i = 0; i < 7; i++) { x.fillStyle = i < 5 ? a : b; x.beginPath(); const ox = (rnd() - 0.5) * z.rx * 0.8 / TEX, oy = (rnd() - 0.5) * z.ry * 0.8 / TEX; x.ellipse(ox * (i < 5 ? 1 : 0.4), oy * (i < 5 ? 1 : 0.4), z.rx / TEX * (i < 5 ? 0.7 : 0.3), z.ry / TEX * (i < 5 ? 0.7 : 0.25), rnd(), 0, 6.28); x.fill(); }
        x.restore();
        if (z.look === 'slime') { ex.save(); ex.translate(z.x / TEX, z.y / TEX); ex.rotate(z.ang); ex.fillStyle = '#888'; ex.beginPath(); ex.ellipse(0, 0, z.rx / TEX * 0.8, z.ry / TEX * 0.8, 0, 0, 6.28); ex.fill(); ex.restore(); }
      }
      // boost pads
      for (const b of this.boosts) {
        for (const ctx of [x, ex]) {
          ctx.save(); ctx.translate(b.x / TEX, b.y / TEX); ctx.rotate(b.ang);
          ctx.fillStyle = ctx === x ? '#2b2b2b' : '#000'; ctx.fillRect(-b.rx / TEX, -b.ry / TEX, b.rx * 2 / TEX, b.ry * 2 / TEX);
          for (let i = 0; i < 3; i++) {
            ctx.fillStyle = ctx === x ? (i === 1 ? '#ffd43b' : '#ff922b') : '#fff';
            ctx.beginPath(); const ox = (-b.rx + 12 + i * 20) / TEX; ctx.moveTo(ox, -8); ctx.lineTo(ox + 7, 0); ctx.lineTo(ox, 8); ctx.lineTo(ox - 3, 8); ctx.lineTo(ox + 4, 0); ctx.lineTo(ox - 3, -8); ctx.fill();
          }
          ctx.restore();
        }
      }
      // jump gaps: a dark drop with warning stripes on each lip
      for (const g of this.gaps) {
        x.save(); x.translate(g.x / TEX, g.y / TEX); x.rotate(g.ang);
        const L = g.len / TEX, Hh = g.half / TEX;
        const gr = x.createLinearGradient(0, 0, L, 0); gr.addColorStop(0, '#000'); gr.addColorStop(0.5, '#0b0b10'); gr.addColorStop(1, '#000');
        x.fillStyle = gr; x.fillRect(0, -Hh, L, Hh * 2);
        for (let j = -Hh; j < Hh; j += 6) { x.fillStyle = (Math.floor(j / 6) % 2) ? '#ffd43b' : '#111'; x.fillRect(-3, j, 3, 6); x.fillRect(L, j, 3, 6); }
        x.restore();
      }
      // level crossings for the toy train
      for (const h of this.hazards) if (h.type === 'shuttle' && h.look === 'train') {
        x.save(); x.translate(h.x / TEX, h.y / TEX); x.rotate(h.ang + Math.PI / 2);
        const span = (this.hw + 200) / TEX;
        for (let k = -span; k < span; k += 5) { x.fillStyle = '#6b4a2e'; x.fillRect(k, -12, 2, 24); }
        x.fillStyle = '#adb5bd'; x.fillRect(-span, -8, span * 2, 2); x.fillRect(-span, 6, span * 2, 2);
        x.restore();
      }
      // holes
      for (const hh of this.holes) {
        const g = x.createRadialGradient(hh.x / TEX, hh.y / TEX, 1, hh.x / TEX, hh.y / TEX, hh.r / TEX);
        g.addColorStop(0, '#000'); g.addColorStop(0.8, '#060606'); g.addColorStop(1, hh.look === 'drain' ? '#9aa7b0' : '#3b2412');
        x.fillStyle = g; x.beginPath(); x.arc(hh.x / TEX, hh.y / TEX, hh.r / TEX, 0, 6.28); x.fill();
        if (hh.look === 'drain') { x.strokeStyle = '#c9d1d6'; x.lineWidth = 2; for (let k = -2; k <= 2; k++) { x.beginPath(); x.moveTo(hh.x / TEX + k * 6, hh.y / TEX - 22); x.lineTo(hh.x / TEX + k * 6, hh.y / TEX + 22); x.stroke(); } }
      }
      // start line checker + grid slots
      const p = this.at(0), ang = Math.atan2(p.ty, p.tx);
      x.save(); x.translate(p.x / TEX, p.y / TEX); x.rotate(ang);
      const cs = 5, rows = 2, cols = Math.ceil(tw / cs);
      for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#f8f9fa'; x.fillRect(i * cs - cs, -tw / 2 + j * cs, cs, cs); }
      x.strokeStyle = 'rgba(255,255,255,0.7)'; x.lineWidth = 1;
      for (const g of this.gridSlots()) { x.strokeRect((g[0]) / TEX - 6, g[1] / TEX - 7, 14, 14); }
      x.restore();
      // pixel noise + emissive mask into alpha
      const id = x.getImageData(0, 0, w, h), d = id.data, ed = ex.getImageData(0, 0, w, h).data;
      for (let i = 0; i < d.length; i += 4) {
        const k = (rnd() - 0.5) * 14;
        d[i] = U.clamp(d[i] + k, 0, 255); d[i + 1] = U.clamp(d[i + 1] + k, 0, 255); d[i + 2] = U.clamp(d[i + 2] + k, 0, 255);
        d[i + 3] = 255 - (ed[i] >> 1);
      }
      x.putImageData(id, 0, 0);
      this.groundCanvas = cv; this.texW = w; this.texH = h;
      // minimap image
      const mm = document.createElement('canvas'), ms = 160 / Math.max(this.W, this.H); mm.width = Math.ceil(this.W * ms); mm.height = Math.ceil(this.H * ms);
      const mx = mm.getContext('2d'); mx.lineJoin = 'round';
      mx.beginPath(); for (let i = 0; i <= this.N; i++) { const k = i % this.N; i ? mx.lineTo(this.px[k] * ms, this.py[k] * ms) : mx.moveTo(this.px[k] * ms, this.py[k] * ms); }
      mx.closePath(); mx.strokeStyle = 'rgba(0,0,0,0.5)'; mx.lineWidth = 9; mx.stroke(); mx.strokeStyle = 'rgba(255,255,255,0.85)'; mx.lineWidth = 5; mx.stroke();
      this.minimap = { canvas: mm, scale: ms };
    }
    paintDecals(x, w, h, r) {
      const k = this.theme.decals;
      if (k === 'crumbs') for (let i = 0; i < 260; i++) { x.fillStyle = ['#d9a25b', '#b87333', '#f1d39b'][i % 3]; x.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
      if (k === 'notes') for (let i = 0; i < 7; i++) { x.save(); x.translate(r() * w, r() * h); x.rotate((r() - 0.5) * 0.5); x.fillStyle = ['#ffe066', '#ffa8a8', '#b2f2bb', '#a5d8ff'][i % 4]; x.fillRect(-28, -28, 56, 56); x.fillStyle = 'rgba(0,0,0,0.15)'; for (let j = 0; j < 4; j++) x.fillRect(-20, -14 + j * 9, 30 + r() * 10, 2); x.restore(); }
      if (k === 'footprints') for (let i = 0; i < 30; i++) { x.fillStyle = 'rgba(150,110,60,0.22)'; x.beginPath(); x.ellipse(r() * w, r() * h, 8, 14, r() * 6, 0, 6.28); x.fill(); }
      if (k === 'chalk') for (let i = 0; i < 25; i++) { x.fillStyle = 'rgba(77,171,247,0.25)'; x.fillRect(r() * w, r() * h, 3, 3); }
      if (k === 'drops') for (let i = 0; i < 80; i++) { x.fillStyle = 'rgba(180,220,255,0.5)'; x.beginPath(); x.arc(r() * w, r() * h, 1 + r() * 3, 0, 6.28); x.fill(); }
      if (k === 'grease') for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(20,20,25,0.3)'; x.beginPath(); x.arc(r() * w, r() * h, 2 + r() * 8, 0, 6.28); x.fill(); }
      if (k === 'pixels') for (let i = 0; i < 120; i++) { x.fillStyle = ['rgba(255,77,216,0.35)', 'rgba(63,240,255,0.35)', 'rgba(124,255,77,0.3)'][i % 3]; x.fillRect(r() * w, r() * h, 3, 3); }
      if (k === 'flour') for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(255,255,255,0.7)'; x.beginPath(); x.ellipse(r() * w, r() * h, 8 + r() * 26, 5 + r() * 14, r() * 3, 0, 6.28); x.fill(); }
      if (k === 'frost') for (let i = 0; i < 30; i++) { x.strokeStyle = 'rgba(160,200,240,0.4)'; x.lineWidth = 1; const cx = r() * w, cy = r() * h; for (let a = 0; a < 6; a++) { x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9); x.stroke(); } }
      if (k === 'paths') for (let i = 0; i < 8; i++) { x.strokeStyle = 'rgba(214,190,150,0.8)'; x.lineWidth = 6; x.beginPath(); x.moveTo(r() * w, r() * h); x.quadraticCurveTo(r() * w, r() * h, r() * w, r() * h); x.stroke(); }
      if (k === 'stars') for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(255,230,120,0.5)'; const sx = r() * w, sy = r() * h; x.fillRect(sx - 3, sy, 7, 1); x.fillRect(sx, sy - 3, 1, 7); }
    }
    // starting grid: [along, across] offsets relative to the start line, in world units
    // up to 20 cars, two abreast and staggered like a real grid
    gridSlots() { const a = this.width * 0.22, out = []; for (let i = 0; i < 20; i++) out.push([-34 - Math.floor(i / 2) * 44 - (i % 2) * 18, i % 2 ? a : -a]); return out; }
  }
  const S = {
    void: { type: 'void', grip: 0, top: 0 },
    track: { type: 'track', grip: 1, top: 1 },
    slick: { type: 'slick', grip: 0.22, top: 0.95 },
    sticky: { type: 'sticky', grip: 1, top: 0.45 },
    boost: { type: 'boost', grip: 1, top: 1 },
  };
  const EMPTY = [];
  const GRID_LEN = 480; // room behind the start line for 20 cars
  function inEll(z, x, y) {
    const dx = x - z.x, dy = y - z.y, c = Math.cos(z.ang), s = Math.sin(z.ang);
    const u = (dx * c + dy * s) / z.rx, v = (-dx * s + dy * c) / z.ry;
    return u * u + v * v <= 1;
  }
  CR.World = World; CR.TEX = TEX;
})(window.CR);
