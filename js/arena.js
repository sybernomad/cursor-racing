// Cursor Racing — Demolition Derby arenas. Builds a playable world from an arena definition: the painted table,
// the boundary (table edge you can fall off, solid walls, or a ring of tire stacks), pockets,
// oil slicks, solid set pieces and the static voxel geometry. Same interface the renderer expects
// from a racing world (meshes, lights, balls, tableMesh, floorMesh, groundCanvas ...).
(function (CR) {
  'use strict';
  const { U, G } = CR;
  const TEX = 2;          // world units per ground texel
  const CHUNK = 700;      // static geometry chunk size (for culling)
  const EMPTY = [];
  const S = {
    void: { type: 'void', grip: 0, top: 0 },
    floor: { type: 'floor', grip: 1, top: 1 },
    slick: { type: 'slick', grip: 0.22, top: 0.95 },
    ice: { type: 'ice', grip: 0.32, top: 1 },
  };

  // kind: 'table' = no walls, drive off the edge and you're out. 'walls' = a fenced box. 'ring' = a round
  // bowl of tire stacks (radius R). pieces: solid props [name, x, y, angle?]. oil: [x, y, r] slick patches.
  const ARENAS = [
    { id: 'kitchen', name: 'Kitchen Sumo', theme: 'breakfast', kind: 'table', W: 1500, H: 1050, seed: 5,
      desc: 'No walls at all. Shove them off the table, and stay away from the edge yourself.',
      pieces: [['bowl', 750, 525]] },
    { id: 'workbench', name: 'Workbench Pit', theme: 'garage', kind: 'walls', W: 1550, H: 1050, seed: 9, wallCol: '#5c5f66',
      desc: 'A walled pit with oil on the floor. Pin them against the boards.',
      oil: [[430, 320, 78], [1110, 740, 86], [1130, 290, 54], [420, 760, 50]],
      pieces: [['oilcan', 775, 300], ['battery', 775, 760], ['nut', 300, 525], ['nut', 1250, 525]] },
    { id: 'sandpit', name: 'Sandpit Bowl', theme: 'sandbox', kind: 'ring', W: 1500, H: 1500, R: 640, seed: 13, tire: '#2b2b2b',
      desc: 'A round bowl ringed with tire stacks, and a sandcastle in the middle to hide behind.',
      pieces: [['castle', 750, 750], ['bucket', 520, 560], ['bucket', 980, 940]] },
    { id: 'pool', name: 'Pocket Brawl', theme: 'pool', kind: 'walls', W: 1700, H: 950, seed: 17, pockets: true,
      desc: 'Six pockets. Knock a car into one and it is gone. The balls are fair game too.',
      balls: [[850, 475], [980, 400], [980, 550], [720, 400], [720, 550], [850, 330], [850, 620]] },
    { id: 'neon', name: 'Neon Desk', theme: 'computer', kind: 'table', W: 1500, H: 1000, seed: 21,
      desc: 'A gaming desk at night. No walls, and the keycaps get in the way.',
      pieces: [['keycap', 600, 420], ['keycap', 900, 420], ['keycap', 600, 580], ['keycap', 900, 580], ['mouse', 750, 500]] },
    { id: 'rink', name: 'Ice Rink', theme: 'frost', kind: 'ring', W: 1400, H: 1400, R: 600, seed: 25, ice: true, tire: '#3a4a5c',
      desc: 'Frozen solid. Nothing grips, everything slides, every hit sends cars spinning.',
      pieces: [['snowman', 700, 700]] },
    { id: 'nightlight', name: 'Night Light', theme: 'toybox', kind: 'walls', W: 1400, H: 1000, seed: 29, wallCol: '#5b4b8a',
      desc: 'A dim toybox bedroom. Toy blocks scattered about to ram cars into.',
      pieces: [['block', 450, 330], ['block', 950, 670], ['block', 980, 320], ['block', 420, 690], ['lamp', 700, 500]] },
    { id: 'picnic', name: 'Ant Hill', theme: 'picnic', kind: 'table', W: 1700, H: 1150, seed: 33,
      desc: 'The biggest table. Lots of room to build up speed, and long falls.',
      pieces: [['apple', 560, 420], ['apple', 1140, 730], ['juicebox', 1150, 400], ['sandwich', 560, 740]] },
  ];

  class Arena {
    constructor(def) {
      this.def = def;
      this.theme = CR.THEMES[def.theme];
      this.light = CR.LIGHT[this.theme.light];
      this.W = def.W; this.H = def.H; this.cx = def.W / 2; this.cy = def.H / 2;
      this.kind = def.kind; this.R = def.R || 0;
      this.rnd = U.rng(def.seed);
      this.colliders = []; this.cgrid = new Map();
      this.holes = [];
      this.oil = (def.oil || []).map(([x, y, r]) => ({ x, y, r }));
      this.dyn = []; // oil dropped during a derby (leaking wrecks)
      if (def.pockets) {
        const m = 62, r = 56;
        for (const [x, y] of [[m, m], [this.W / 2, m - 18], [this.W - m, m], [m, this.H - m], [this.W / 2, this.H - m + 18], [this.W - m, this.H - m]]) this.holes.push({ x, y, r });
      }
      this.lights = []; this.balls = [];
      // the renderer frees these on a world change; arenas don't have them
      this.movers = []; this.spinners = []; this.fans = []; this.seesaws = []; this.glue = [];
    }

    // ---------- shape ----------
    inside(x, y, pad = 0) { // the drivable area (pad > 0 = further in)
      if (this.kind === 'ring') return (x - this.cx) ** 2 + (y - this.cy) ** 2 < (this.R - 18 - pad) ** 2;
      const m = (this.kind === 'walls' ? 30 : 0) + pad;
      return x > m && y > m && x < this.W - m && y < this.H - m;
    }
    // distance to the edge you can fall off (Infinity for fenced arenas)
    edgeDist(x, y) {
      if (this.kind !== 'table') return Infinity;
      return Math.min(x, y, this.W - x, this.H - y);
    }
    holeAt(x, y, pad = 0) { for (const h of this.holes) if ((x - h.x) ** 2 + (y - h.y) ** 2 < (h.r + pad) ** 2) return h; return null; }
    surface(x, y) {
      if (this.kind === 'table' && (x < 0 || y < 0 || x > this.W || y > this.H)) return S.void;
      if (this.holes.length && this.holeAt(x, y)) return S.void;
      for (const z of this.oil) if ((x - z.x) ** 2 + (y - z.y) ** 2 < z.r * z.r) return S.slick;
      for (const z of this.dyn) if ((x - z.x) ** 2 + (y - z.y) ** 2 < z.r * z.r) return S.slick;
      return this.def.ice ? S.ice : S.floor;
    }
    // where cars line up: a circle round the middle, everyone facing in
    spawnSlots(n) {
      const out = [], rad = Math.min(this.W, this.H) * (this.kind === 'ring' ? 0.36 : 0.34);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.PI / 2;
        out.push({ x: this.cx + Math.cos(a) * rad * (this.W > this.H && this.kind !== 'ring' ? this.W / this.H * 0.9 : 1), y: this.cy + Math.sin(a) * rad, h: a + Math.PI });
      }
      return out;
    }
    // a random clear spot for a pickup
    randomSpot(pad = 60) {
      for (let k = 0; k < 60; k++) {
        const x = pad + this.rnd() * (this.W - pad * 2), y = pad + this.rnd() * (this.H - pad * 2);
        if (!this.inside(x, y, pad) || this.holeAt(x, y, 50)) continue;
        if (this.collidersNear(x, y).some((c) => !c.soft && Math.hypot(c.x - x, c.y - y) < (c.r || Math.max(c.hw, c.hd)) + 40)) continue;
        return { x, y };
      }
      return { x: this.cx, y: this.cy + 120 };
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
      const T = this.theme, def = this.def;
      this.chunks = new Map();
      this.sprites = CR.atlas.uv;
      this.paintGround();
      this.buildTable();
      if (this.kind === 'walls') this.buildWalls();
      if (this.kind === 'ring') this.buildRing();
      for (const p of def.pieces || []) {
        const pr = CR.prop(p[0], {}, Math.floor(p[1] + p[2]));
        this.addProp(pr, p[1], p[2], p[3] != null ? p[3] : this.rnd() * 6.28, 0, true);
      }
      // a little drive-over clutter for flavor, out of the way of the spawn ring
      for (const sc of T.scatter || []) {
        const n = Math.min(sc.count, 10);
        for (let i = 0, tries = 0; i < n && tries < n * 30; tries++) {
          const x = 60 + this.rnd() * (this.W - 120), y = 60 + this.rnd() * (this.H - 120);
          const pr = CR.prop(sc.name, sc.opt || {}, i % 5 + 1);
          const rad = pr.col ? (pr.col.c || Math.max(pr.col.w, pr.col.d)) : Math.max(pr.size[0], pr.size[2]) / 2;
          if (rad > 14 || !this.inside(x, y, 30) || this.holeAt(x, y, 30)) continue;
          this.addProp(pr, x, y, this.rnd() * 6.28, 0, true, true); i++;
        }
      }
      if (def.balls) {
        const cols = ['#ffd43b', '#1c7ed6', '#e03131', '#7048e8', '#f76707', '#2b8a3e', '#862e9c', '#111111'];
        def.balls.forEach((b, i) => {
          const raw = CR.propRaw('ball', { color: cols[i % cols.length], stripe: i > 3 }, i + 1);
          const bld = G.mesh(raw.vox, raw.vs, raw.vox.sx / 2, raw.vox.sy / 2, raw.vox.sz / 2);
          this.balls.push({ x: b[0], y: b[1], hx: b[0], hy: b[1], vx: 0, vy: 0, r: 10.8, mass: 0.7, rot: 0, dir: 0, mesh: G.upload(gl, bld), z: 0, out: 0 });
        });
      }
      if (T.light === 'monitor') this.lights.push({ x: this.W * 0.3, y: 260, z: -120, col: [0.35, 0.55, 1.3], rad: 1500 }, { x: this.W * 0.75, y: 260, z: -120, col: [0.9, 0.35, 1.1], rad: 1300 });
      if (T.light === 'lamp' || this.light === CR.LIGHT.lamp) for (const x of [this.W * 0.22, this.W * 0.5, this.W * 0.78]) this.lights.push({ x, y: 380, z: this.H / 2, col: [1.2, 0.95, 0.6], rad: 900 });
      if (this.light === CR.LIGHT.night) this.lights.push({ x: this.cx, y: 300, z: this.cy, col: [0.9, 0.8, 0.6], rad: 1100 });
      this.meshes = [];
      for (const [, b] of this.chunks) if (b.bld.n) this.meshes.push({ mesh: G.upload(gl, b.bld), cx: b.cx, cy: b.cy });
      this.chunks = null;
    }
    chunk(x, y) {
      const i = Math.floor(x / CHUNK), j = Math.floor(y / CHUNK), k = i * 1000 + j;
      let c = this.chunks.get(k);
      if (!c) { c = { bld: new G.Builder(8192), cx: (i + 0.5) * CHUNK, cy: (j + 0.5) * CHUNK }; this.chunks.set(k, c); }
      return c.bld;
    }
    addProp(pr, x, y, ang, z = 0, collide = true, soft = false) {
      this.chunk(x, y).append(pr.bld, x, z, y, -ang, 1);
      if (collide && pr.col) {
        if (pr.col.c) this.addCol({ x, y, r: pr.col.c, h: pr.h + z, bumper: !!pr.col.bumper, soft: soft && !pr.col.bumper });
        else this.addCol({ x, y, hw: pr.col.w / 2, hd: pr.col.d / 2, ang, h: pr.h + z, c: Math.cos(ang), s: Math.sin(ang), soft });
      }
      if (pr.light) this.lights.push({ x, y: (pr.lightY || 12) + z, z: y, col: pr.light.map((v) => v * 1.4), rad: pr.lightY ? 420 : 150 });
    }
    buildTable() {
      const T = this.theme, b = new G.Builder(64), W = this.W, H = this.H;
      const side = U.hex(T.tableSide), dep = this.kind === 'table' ? 46 : 30;
      const box = (x0, y0, z0, x1, y1, z1, c) => {
        const f = [[[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]],
          [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]], [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]]];
        for (const q of f) { const n = q[4], k = n[1] ? 1 : 0.85; const id = q.slice(0, 4).map((p, i) => b.v(p[0], p[1], p[2], n[0], n[1], n[2], c[0] * k * (i < 2 ? 1 : 0.8), c[1] * k * (i < 2 ? 1 : 0.8), c[2] * k * (i < 2 ? 1 : 0.8), 0)); b.quad(id[0], id[1], id[2], id[3]); }
      };
      box(-6, -dep, -6, W + 6, -0.5, H + 6, side);
      for (const [x, z] of [[60, 60], [W - 100, 60], [60, H - 100], [W - 100, H - 100]]) box(x, -420, z, x + 40, -dep, z + 40, U.shade(side, 0.8));
      this.tableMesh = b;
      const fb = new G.Builder(8), fc = U.hex(T.floor), FY = -420, M = 3000;
      const q = [[-M, FY, -M], [W + M, FY, -M], [W + M, FY, H + M], [-M, FY, H + M]].map((p) => fb.v(p[0], p[1], p[2], 0, 1, 0, fc[0], fc[1], fc[2], 0, p[0] / 300, p[2] / 300));
      fb.quad(q[0], q[1], q[2], q[3]);
      this.floorMesh = fb; this.floorY = FY;
    }
    // boards round the table: voxel planks with a stripe of hazard paint on top
    buildWalls() {
      const W = this.W, H = this.H, t = 24, h = 30, c = U.hex(this.def.wallCol || this.theme.wallCol || '#5c5f66');
      const v = (len) => {
        const n = Math.ceil(len / 6), vx = new G.Vox(n, Math.ceil(h / 6), Math.ceil(t / 6)), r = U.rng(len);
        vx.box(0, 0, 0, n - 1, vx.sy - 1, vx.sz - 1, c, 0, 0.1, r);
        for (let x = 0; x < n; x++) { const st = Math.floor(x / 2) % 2 ? [1, 0.83, 0.23] : [0.12, 0.12, 0.13]; vx.set(x, vx.sy - 1, 0, st); vx.set(x, vx.sy - 1, vx.sz - 1, st); }
        return G.mesh(vx, 6, n / 2, 0, vx.sz / 2);
      };
      const top = v(W + t * 2), sideM = v(H);
      const put = (m, x, y, ang, hw, hd) => { this.chunk(x, y).append(m, x, 0, y, -ang, 1); this.addCol({ x, y, hw, hd, ang, h: 99, c: Math.cos(ang), s: Math.sin(ang), wall: true }); };
      put(top, W / 2, t / 2, 0, W / 2 + t, t / 2); put(top, W / 2, H - t / 2, 0, W / 2 + t, t / 2);
      put(sideM, t / 2, H / 2, Math.PI / 2, H / 2, t / 2); put(sideM, W - t / 2, H / 2, Math.PI / 2, H / 2, t / 2);
    }
    // a ring of tire stacks, every few painted in bright colors
    buildRing() {
      const R = this.R, n = Math.ceil((Math.PI * 2 * R) / 25), tc = U.hex(this.def.tire || '#2b2b2b');
      const paints = [[0.95, 0.95, 0.95], [0.9, 0.2, 0.2], [1, 0.83, 0.23]];
      const stacks = [];
      for (let k = 0; k < 4; k++) stacks.push(tireStack(tc, paints[k % 3], k));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, x = this.cx + Math.cos(a) * (R + 4), y = this.cy + Math.sin(a) * (R + 4);
        this.chunk(x, y).append(stacks[i % 4], x, 0, y, -a, 1);
        this.addCol({ x, y, r: 14, h: 99, wall: true });
      }
    }

    // ---------- ground texture ----------
    paintGround() {
      const T = this.theme, w = Math.ceil(this.W / TEX), h = Math.ceil(this.H / TEX), rnd = U.rng(this.def.seed * 3);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const x = cv.getContext('2d');
      T.ground(x, w, h, rnd);
      const cx = this.cx / TEX, cy = this.cy / TEX;
      // arena markings: a big ring and a center spot
      x.lineWidth = 3; x.strokeStyle = 'rgba(255,255,255,0.28)';
      const rr = Math.min(w, h) * 0.34;
      x.beginPath(); x.arc(cx, cy, rr, 0, 6.28); x.stroke();
      x.setLineDash([6, 8]); x.beginPath(); x.arc(cx, cy, rr * 0.45, 0, 6.28); x.stroke(); x.setLineDash([]);
      // scuffs and tire marks from past derbies
      for (let i = 0; i < 26; i++) {
        x.strokeStyle = `rgba(20,16,14,${0.06 + rnd() * 0.08})`; x.lineWidth = 2 + rnd() * 3;
        x.beginPath(); const sx = rnd() * w, sy = rnd() * h; x.moveTo(sx, sy); x.quadraticCurveTo(sx + (rnd() - 0.5) * 120, sy + (rnd() - 0.5) * 120, sx + (rnd() - 0.5) * 160, sy + (rnd() - 0.5) * 160); x.stroke();
      }
      if (this.kind === 'ring') {
        // outside the bowl: darker, roped off
        x.save(); x.beginPath(); x.rect(0, 0, w, h); x.arc(cx, cy, this.R / TEX, 0, 6.28, true); x.fillStyle = 'rgba(0,0,0,0.35)'; x.fill('evenodd'); x.restore();
        x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, (this.R - 26) / TEX, 0, 6.28); x.stroke();
      }
      if (this.kind === 'table') {
        // hazard stripes round the edge: this is where you fall off
        const b = 7;
        for (let i = 0; i < w + h; i += 8) {
          x.fillStyle = (i / 8) % 2 ? 'rgba(255,212,59,0.85)' : 'rgba(20,20,20,0.85)';
          if (i < w) { x.fillRect(i, 0, 8, b); x.fillRect(i, h - b, 8, b); }
          if (i < h) { x.fillRect(0, i, b, 8); x.fillRect(w - b, i, b, 8); }
        }
      }
      // oil slicks
      for (const z of this.oil) {
        for (let i = 0; i < 6; i++) { x.fillStyle = i < 4 ? '#17171c' : '#3a3a48'; x.beginPath(); x.ellipse((z.x + (rnd() - 0.5) * z.r * 0.6) / TEX, (z.y + (rnd() - 0.5) * z.r * 0.6) / TEX, z.r / TEX * (i < 4 ? 0.7 : 0.3), z.r / TEX * (i < 4 ? 0.6 : 0.2), rnd() * 3, 0, 6.28); x.fill(); }
        x.strokeStyle = 'rgba(150,120,255,0.25)'; x.lineWidth = 1; x.beginPath(); x.arc(z.x / TEX, z.y / TEX, z.r / TEX * 0.45, 0, 6.28); x.stroke();
      }
      if (this.def.ice) { x.fillStyle = 'rgba(210,236,255,0.35)'; x.fillRect(0, 0, w, h); for (let i = 0; i < 60; i++) { x.strokeStyle = 'rgba(255,255,255,0.5)'; x.lineWidth = 1; x.beginPath(); const sx = rnd() * w, sy = rnd() * h; x.moveTo(sx, sy); x.lineTo(sx + (rnd() - 0.5) * 90, sy + (rnd() - 0.5) * 40); x.stroke(); } }
      for (const hh of this.holes) {
        const g = x.createRadialGradient(hh.x / TEX, hh.y / TEX, 1, hh.x / TEX, hh.y / TEX, hh.r / TEX);
        g.addColorStop(0, '#000'); g.addColorStop(0.8, '#060606'); g.addColorStop(1, '#3b2412');
        x.fillStyle = g; x.beginPath(); x.arc(hh.x / TEX, hh.y / TEX, hh.r / TEX, 0, 6.28); x.fill();
      }
      // pixel noise, alpha = no glow
      const id = x.getImageData(0, 0, w, h), d = id.data;
      for (let i = 0; i < d.length; i += 4) { const k = (rnd() - 0.5) * 14; d[i] = U.clamp(d[i] + k, 0, 255); d[i + 1] = U.clamp(d[i + 1] + k, 0, 255); d[i + 2] = U.clamp(d[i + 2] + k, 0, 255); d[i + 3] = 255; }
      x.putImageData(id, 0, 0);
      this.groundCanvas = cv;
      // minimap
      const mm = document.createElement('canvas'), ms = 140 / Math.max(this.W, this.H); mm.width = Math.ceil(this.W * ms); mm.height = Math.ceil(this.H * ms);
      const mx = mm.getContext('2d');
      mx.fillStyle = 'rgba(0,0,0,0.35)'; mx.strokeStyle = 'rgba(255,255,255,0.8)'; mx.lineWidth = 2;
      mx.beginPath();
      if (this.kind === 'ring') mx.arc(this.cx * ms, this.cy * ms, this.R * ms, 0, 6.28); else mx.rect(1, 1, mm.width - 2, mm.height - 2);
      mx.fill(); if (this.kind === 'table') mx.setLineDash([3, 3]); mx.stroke(); mx.setLineDash([]);
      mx.fillStyle = '#000'; for (const hh of this.holes) { mx.beginPath(); mx.arc(hh.x * ms, hh.y * ms, hh.r * ms, 0, 6.28); mx.fill(); }
      mx.fillStyle = 'rgba(255,255,255,0.35)'; for (const c of this.colliders) if (!c.wall && !c.soft) { mx.beginPath(); mx.arc(c.x * ms, c.y * ms, Math.max(2, (c.r || c.hw) * ms), 0, 6.28); mx.fill(); }
      this.minimap = { canvas: mm, scale: ms };
    }
  }

  // two tires on top of each other; the top one painted
  function tireStack(dark, paint, seed) {
    const r = U.rng(seed * 31 + 7), v = new G.Vox(13, 6, 13), c = 6;
    for (let x = 0; x < 13; x++) for (let z = 0; z < 13; z++) {
      const d = Math.hypot(x - c, z - c);
      if (d > 6.4 || d < 2.6) continue;
      for (let y = 0; y < 6; y++) {
        const top = y >= 3, rim = d < 3.6;
        const k = 1 + (r() - 0.5) * 0.12;
        let col = dark;
        if (top && y === 5 && !rim) col = paint;
        if (y === 2 || y === 5) col = y === 5 && !rim ? paint : U.shade(dark, 0.75);
        v.set(x, y, z, [col[0] * k, col[1] * k, col[2] * k]);
      }
    }
    return G.mesh(v, 2.3, 6.5, 0, 6.5);
  }

  CR.Arena = Arena; CR.ARENAS = ARENAS;
})(window.CR);
