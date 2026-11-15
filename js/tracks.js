// Cursor Racing — themes (look, lighting, props) and track layouts. Tune tracks here.
// Track points are a closed loop in world units on a table W x H. t values are 0..1 along the lap.
(function (CR) {
  'use strict';

  // ---------- lighting presets ----------
  const LIGHT = {
    morning: { sun: [-0.45, 0.82, -0.36], sunCol: [1.12, 1.02, 0.88], sky: [0.5, 0.56, 0.68], gnd: [0.32, 0.27, 0.22], fog: [0.62, 0.7, 0.8], fogDen: 0.00055, clear: [0.6, 0.68, 0.79], exposure: 1.0, bloom: 0.55, grade: [1.03, 1.0, 0.96] },
    desk: { sun: [0.5, 0.78, -0.38], sunCol: [1.15, 1.0, 0.82], sky: [0.45, 0.48, 0.58], gnd: [0.3, 0.24, 0.2], fog: [0.36, 0.33, 0.38], fogDen: 0.0007, clear: [0.34, 0.31, 0.36], exposure: 1.02, bloom: 0.6, grade: [1.05, 1.0, 0.94] },
    sunset: { sun: [-0.7, 0.5, -0.4], sunCol: [1.35, 0.9, 0.62], sky: [0.5, 0.42, 0.6], gnd: [0.36, 0.25, 0.2], fog: [0.85, 0.6, 0.55], fogDen: 0.0006, clear: [0.86, 0.6, 0.55], exposure: 1.0, bloom: 0.8, grade: [1.08, 0.98, 0.92] },
    lamp: { sun: [0.15, 0.95, -0.2], sunCol: [1.2, 1.0, 0.75], sky: [0.25, 0.22, 0.22], gnd: [0.18, 0.12, 0.1], fog: [0.1, 0.08, 0.08], fogDen: 0.0012, clear: [0.08, 0.06, 0.06], exposure: 1.05, bloom: 0.8, grade: [1.06, 0.98, 0.9], vignette: 1.4 },
    bath: { sun: [0.35, 0.86, -0.3], sunCol: [0.9, 0.92, 0.98], sky: [0.42, 0.5, 0.6], gnd: [0.26, 0.3, 0.36], fog: [0.6, 0.7, 0.78], fogDen: 0.0005, clear: [0.6, 0.7, 0.78], exposure: 0.85, bloom: 0.45, grade: [0.97, 1.0, 1.04] },
    night: { sun: [-0.3, 0.85, -0.45], sunCol: [0.38, 0.45, 0.8], sky: [0.16, 0.16, 0.3], gnd: [0.1, 0.08, 0.14], fog: [0.05, 0.05, 0.12], fogDen: 0.001, clear: [0.04, 0.04, 0.1], exposure: 1.1, bloom: 1.2, grade: [0.98, 0.98, 1.08], vignette: 1.3 },
    shop: { sun: [0.25, 0.9, -0.3], sunCol: [0.95, 1.0, 1.05], sky: [0.4, 0.44, 0.5], gnd: [0.24, 0.22, 0.2], fog: [0.22, 0.24, 0.27], fogDen: 0.0008, clear: [0.2, 0.22, 0.25], exposure: 1.0, bloom: 0.7, grade: [1.0, 1.0, 1.02], vignette: 1.2 },
    monitor: { sun: [0.0, 0.7, -0.7], sunCol: [0.45, 0.6, 1.0], sky: [0.2, 0.2, 0.32], gnd: [0.1, 0.08, 0.12], fog: [0.04, 0.05, 0.1], fogDen: 0.001, clear: [0.04, 0.05, 0.1], exposure: 1.1, bloom: 1.1, grade: [0.98, 1.0, 1.08], vignette: 1.3 },
    bakery: { sun: [-0.5, 0.78, -0.38], sunCol: [1.15, 1.0, 0.85], sky: [0.5, 0.5, 0.56], gnd: [0.34, 0.3, 0.26], fog: [0.75, 0.68, 0.62], fogDen: 0.0005, clear: [0.75, 0.68, 0.62], exposure: 0.82, bloom: 0.45, grade: [1.04, 1.0, 0.96] },
    winter: { sun: [0.45, 0.6, -0.55], sunCol: [0.95, 0.98, 1.1], sky: [0.42, 0.5, 0.66], gnd: [0.3, 0.33, 0.4], fog: [0.62, 0.7, 0.84], fogDen: 0.0006, clear: [0.62, 0.7, 0.84], exposure: 0.78, bloom: 0.55, grade: [0.96, 1.0, 1.07] },
    noon: { sun: [-0.3, 0.92, -0.2], sunCol: [1.12, 1.08, 0.95], sky: [0.48, 0.58, 0.7], gnd: [0.28, 0.32, 0.2], fog: [0.6, 0.75, 0.88], fogDen: 0.0005, clear: [0.6, 0.75, 0.88], exposure: 0.95, bloom: 0.5, grade: [1.02, 1.02, 0.97] },
    dusk: { sun: [0.75, 0.42, -0.35], sunCol: [1.3, 0.8, 0.55], sky: [0.4, 0.38, 0.6], gnd: [0.24, 0.2, 0.22], fog: [0.5, 0.42, 0.55], fogDen: 0.0007, clear: [0.5, 0.42, 0.55], exposure: 1.0, bloom: 0.9, grade: [1.06, 0.98, 0.95], vignette: 1.2 },
  };

  // ---------- themes ----------
  // ground(ctx, w, h, rnd) paints the table in texels (1 texel = TEX world units).
  const THEMES = {
    breakfast: {
      name: 'Kitchen Table', light: 'morning', edge: 'void', tableSide: '#8a5a34', floor: '#5b4636',
      ground(x, w, h, r) {
        const s = 40; // gingham tablecloth
        x.fillStyle = '#f3ece0'; x.fillRect(0, 0, w, h);
        for (let i = 0; i < w; i += s) { if ((i / s) % 2 === 0) { x.fillStyle = 'rgba(214,64,64,0.42)'; x.fillRect(i, 0, s, h); } }
        for (let j = 0; j < h; j += s) { if ((j / s) % 2 === 0) { x.fillStyle = 'rgba(214,64,64,0.42)'; x.fillRect(0, j, w, s); } }
        x.fillStyle = 'rgba(255,255,255,0.08)'; for (let i = 0; i < w; i += 4) x.fillRect(i, 0, 1, h);
      },
      track: { fill: '#d9cbb0', edgeA: '#ffffff', edgeB: '#d64545', line: 'rgba(120,90,60,0.25)' },
      rough: { grip: 0.85, top: 0.72 },
      border: [{ name: 'loop', spacing: 17, offset: 10, rows: 1 }],
      scatter: [{ name: 'loop', count: 60 }, { name: 'toast', count: 2 }, { name: 'spoon', count: 3 }],
      sprites: [{ name: 'sparkle', count: 10, size: 1.2 }],
      decals: 'crumbs',
    },
    desk: {
      name: 'Study Desk', light: 'desk', edge: 'void', tableSide: '#6d4321', floor: '#2f2a33',
      ground(x, w, h, r) {
        x.fillStyle = '#a8703f'; x.fillRect(0, 0, w, h);
        for (let j = 0; j < h; j += 2) { const k = Math.sin(j * 0.045) * 10 + Math.sin(j * 0.31) * 4; x.fillStyle = `rgba(${k > 4 ? '70,40,15' : '255,220,170'},${0.05 + Math.abs(k) * 0.006})`; x.fillRect(0, j, w, 2); }
        for (let j = 0; j < h; j += 90) { x.fillStyle = 'rgba(60,30,10,0.35)'; x.fillRect(0, j, w, 1); }
        for (let i = 0; i < 30; i++) { x.fillStyle = 'rgba(60,30,10,0.2)'; x.beginPath(); x.ellipse(r() * w, r() * h, 6 + r() * 10, 2 + r() * 3, 0, 0, 6.28); x.fill(); }
      },
      track: { fill: '#eef0f5', edgeA: '#4dabf7', edgeB: '#eef0f5', line: 'rgba(77,171,247,0.35)', ruled: true },
      rough: { grip: 0.9, top: 0.75 },
      border: [{ name: 'pencil', spacing: 72, offset: 8, along: true, wall: true }],
      scatter: [{ name: 'eraser', count: 8 }, { name: 'clip', count: 14 }, { name: 'book', count: 5, opt: { w: 30, d: 22, h: 4 } }],
      sprites: [],
      decals: 'notes',
    },
    sandbox: {
      name: 'Backyard Sandbox', light: 'sunset', edge: 'wall', wallCol: '#9c6b3e', tableSide: '#7a5230', floor: '#3f7a35',
      ground(x, w, h, r) {
        x.fillStyle = '#e3c58b'; x.fillRect(0, 0, w, h);
        for (let i = 0; i < w * h / 30; i++) { x.fillStyle = r() < 0.5 ? 'rgba(160,120,60,0.25)' : 'rgba(255,240,200,0.3)'; x.fillRect(r() * w, r() * h, 1, 1); }
        for (let i = 0; i < 40; i++) { x.strokeStyle = 'rgba(150,110,60,0.18)'; x.lineWidth = 2; x.beginPath(); const cx = r() * w, cy = r() * h; x.arc(cx, cy, 10 + r() * 40, 0, 3 + r() * 3); x.stroke(); }
      },
      track: { fill: '#b98c55', edgeA: '#8a6436', edgeB: '#b98c55', line: 'rgba(90,60,30,0.3)', ruts: true },
      rough: { grip: 0.75, top: 0.55 },
      border: [{ name: 'pebble', spacing: 26, offset: 12, chance: 0.75 }],
      scatter: [{ name: 'pebble', count: 40, opt: { s: 4 } }, { name: 'shovel', count: 2 }],
      sprites: [{ name: 'tuft', count: 40, size: 1.5 }, { name: 'flowerR', count: 10, size: 1.4 }, { name: 'flowerB', count: 8, size: 1.4 }, { name: 'soldier', count: 14, size: 1.2, near: true }],
      decals: 'footprints',
    },
    pool: {
      name: 'Pool Table', light: 'lamp', edge: 'wall', wallCol: '#1f6f43', tableSide: '#4a2511', floor: '#1d1414',
      ground(x, w, h, r) {
        x.fillStyle = '#1f8a4c'; x.fillRect(0, 0, w, h);
        for (let i = 0; i < w * h / 12; i++) { x.fillStyle = r() < 0.5 ? 'rgba(0,40,10,0.18)' : 'rgba(120,255,160,0.06)'; x.fillRect(r() * w, r() * h, 1, 1); }
        x.fillStyle = 'rgba(255,255,255,0.5)'; x.fillRect(w * 0.25, 0, 1, h);
        const g = x.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.6); g.addColorStop(0, 'rgba(255,240,180,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0.25)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      },
      track: { fill: '#26a35c', edgeA: '#f8f9fa', edgeB: '#26a35c', line: 'rgba(255,255,255,0.15)' },
      rough: { grip: 0.95, top: 0.8 },
      border: [{ name: 'chalk', spacing: 160, offset: 14, chance: 0.5 }],
      scatter: [{ name: 'chalk', count: 4 }],
      sprites: [],
      decals: 'chalk',
      pockets: true,
    },
    bath: {
      name: 'Bathroom Counter', light: 'bath', edge: 'void', tableSide: '#c9d6df', floor: '#6d8aa0',
      ground(x, w, h, r) {
        const s = 48; x.fillStyle = '#e9f1f5'; x.fillRect(0, 0, w, h);
        for (let i = 0; i < w; i += s) for (let j = 0; j < h; j += s) { const k = r() * 0.06; x.fillStyle = `rgba(120,160,190,${0.08 + k})`; x.fillRect(i + 1, j + 1, s - 2, s - 2); }
        x.fillStyle = '#b7c8d3'; for (let i = 0; i < w; i += s) x.fillRect(i, 0, 1, h); for (let j = 0; j < h; j += s) x.fillRect(0, j, w, 1);
      },
      track: { fill: '#9fd8f0', edgeA: '#ffffff', edgeB: '#4dabf7', line: 'rgba(255,255,255,0.4)' },
      rough: { grip: 0.7, top: 0.78 },
      border: [{ name: 'soap', spacing: 120, offset: 16, chance: 0.4 }, { name: 'bubbleS', sprite: 'bubble', spacing: 30, offset: 14, size: 1.3, chance: 0.6 }],
      scatter: [{ name: 'duck', count: 6 }, { name: 'sponge', count: 3 }, { name: 'bottle', count: 4 }, { name: 'toothbrush', count: 3 }],
      sprites: [{ name: 'bubble', count: 30, size: 1.6 }],
      decals: 'drops',
      drain: true,
    },
    toybox: {
      name: 'Bedroom at Night', light: 'night', edge: 'void', tableSide: '#3a2f5c', floor: '#120f22',
      ground(x, w, h, r) {
        x.fillStyle = '#3d3a7a'; x.fillRect(0, 0, w, h);
        for (let j = 0; j < h; j += 6) { x.fillStyle = (j / 6) % 2 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)'; x.fillRect(0, j, w, 3); }
        const cols = ['rgba(255,100,200,0.22)', 'rgba(80,220,255,0.2)', 'rgba(255,220,80,0.18)'];
        for (let i = 0; i < 18; i++) { x.fillStyle = cols[i % 3]; x.beginPath(); x.arc(r() * w, r() * h, 20 + r() * 60, 0, 6.28); x.fill(); }
        for (let i = 0; i < 400; i++) { x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(r() * w, r() * h, 1, 1); }
      },
      track: { fill: '#2b2852', edgeA: '#ff4dd8', edgeB: '#3ff0ff', line: 'rgba(63,240,255,0.25)', glow: true },
      rough: { grip: 0.88, top: 0.74 },
      border: [{ name: 'glow', spacing: 90, offset: 10, along: true, wall: true, chance: 0.85 }],
      scatter: [{ name: 'block', count: 22 }, { name: 'marble', count: 16 }, { name: 'robot', count: 3 }],
      sprites: [{ name: 'dino', count: 6, size: 1.6, near: true }, { name: 'sparkle', count: 24, size: 1.3 }],
      decals: 'stars',
    },
    garage: {
      name: 'Garage Workbench', light: 'shop', edge: 'void', tableSide: '#7c5a3a', floor: '#3a3a3e',
      ground(x, w, h, r) {
        x.fillStyle = '#b08a5a'; x.fillRect(0, 0, w, h);
        for (let j = 0; j < h; j += 3) { x.fillStyle = `rgba(${r() < 0.5 ? '90,60,30' : '255,230,190'},${0.04 + r() * 0.05})`; x.fillRect(0, j, w, 3); }
        for (let i = 0; i < w; i += 160) { x.fillStyle = 'rgba(60,40,20,0.35)'; x.fillRect(i, 0, 1, h); }
        for (let i = 0; i < 14; i++) { x.fillStyle = 'rgba(30,25,20,0.25)'; x.beginPath(); x.ellipse(r() * w, r() * h, 10 + r() * 30, 6 + r() * 18, r() * 3, 0, 6.28); x.fill(); }
        for (let i = 0; i < 300; i++) { x.fillStyle = 'rgba(240,210,150,0.5)'; x.fillRect(r() * w, r() * h, 1, 1); }
      },
      track: { fill: '#8b8f96', edgeA: '#ffd43b', edgeB: '#222222', line: 'rgba(255,255,255,0.3)' },
      rough: { grip: 0.85, top: 0.72 },
      border: [{ name: 'nut', spacing: 34, offset: 10, chance: 0.8 }],
      scatter: [{ name: 'bolt', count: 8 }, { name: 'wrench', count: 4 }, { name: 'screwdriver', count: 3 }, { name: 'nut', count: 20 }, { name: 'battery', count: 4 }],
      sprites: [],
      decals: 'grease',
    },
    computer: {
      name: 'Gaming Desk', light: 'monitor', edge: 'void', tableSide: '#1f1f28', floor: '#0c0c12',
      ground(x, w, h, r) {
        x.fillStyle = '#1b1c22'; x.fillRect(0, 0, w, h);
        // big mousepad with an RGB rim
        x.fillStyle = '#15161d'; x.fillRect(40, 40, w - 80, h - 80);
        for (let i = 0; i < w * h / 20; i++) { x.fillStyle = 'rgba(255,255,255,0.03)'; x.fillRect(r() * w, r() * h, 1, 1); }
        const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#ff4dd8'); g.addColorStop(0.5, '#3ff0ff'); g.addColorStop(1, '#7cff4d');
        x.strokeStyle = g; x.lineWidth = 4; x.strokeRect(42, 42, w - 84, h - 84);
        // a giant cursor printed on the pad
        x.save(); x.translate(w * 0.5, h * 0.42); x.scale(7, 7); x.fillStyle = 'rgba(63,240,255,0.13)';
        x.beginPath(); x.moveTo(0, 0); x.lineTo(0, 17); x.lineTo(4, 13); x.lineTo(7, 19); x.lineTo(9, 18); x.lineTo(6, 12); x.lineTo(11, 12); x.closePath(); x.fill(); x.restore();
      },
      track: { fill: '#24252f', edgeA: '#3ff0ff', edgeB: '#ff4dd8', line: 'rgba(63,240,255,0.3)', glow: true },
      rough: { grip: 0.9, top: 0.75 },
      border: [{ name: 'keycap', spacing: 60, offset: 14, chance: 0.6 }],
      scatter: [{ name: 'keycap', count: 26 }, { name: 'usb', count: 6 }],
      sprites: [],
      decals: 'pixels',
    },
    bakery: {
      name: 'Baking Counter', light: 'bakery', edge: 'void', tableSide: '#c9c2b8', floor: '#6b5847',
      ground(x, w, h, r) {
        x.fillStyle = '#ece6dc'; x.fillRect(0, 0, w, h);
        for (let i = 0; i < 70; i++) { x.strokeStyle = `rgba(120,110,105,${0.08 + r() * 0.12})`; x.lineWidth = 1 + r() * 2; x.beginPath(); let px = r() * w, py = r() * h; x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (r() - 0.4) * 80; py += (r() - 0.5) * 40; x.lineTo(px, py); } x.stroke(); }
        for (let i = 0; i < 600; i++) { x.fillStyle = 'rgba(255,255,255,0.55)'; x.fillRect(r() * w, r() * h, 1 + r() * 2, 1); }
      },
      track: { fill: '#d6b58a', edgeA: '#8a5a2b', edgeB: '#f3d9b1', line: 'rgba(120,70,30,0.25)' },
      rough: { grip: 0.85, top: 0.72 },
      border: [{ name: 'chip', spacing: 22, offset: 9, chance: 0.85 }],
      scatter: [{ name: 'chip', count: 40 }, { name: 'egg', count: 5 }, { name: 'cookie', count: 4 }],
      sprites: [],
      decals: 'flour',
    },
    frost: {
      name: 'Frosty Windowsill', light: 'winter', edge: 'void', tableSide: '#e9ecef', floor: '#4b5a6e',
      ground(x, w, h, r) {
        x.fillStyle = '#f1f3f5'; x.fillRect(0, 0, w, h);
        for (let j = 0; j < h; j += 40) { x.fillStyle = 'rgba(160,170,190,0.25)'; x.fillRect(0, j, w, 1); }
        for (let i = 0; i < 90; i++) { x.fillStyle = 'rgba(255,255,255,0.9)'; x.beginPath(); x.ellipse(r() * w, r() * h, 6 + r() * 30, 4 + r() * 12, 0, 0, 6.28); x.fill(); }
        for (let i = 0; i < 500; i++) { x.fillStyle = 'rgba(190,215,255,0.6)'; x.fillRect(r() * w, r() * h, 1, 1); }
      },
      track: { fill: '#cfe3f5', edgeA: '#e03131', edgeB: '#ffffff', line: 'rgba(80,120,170,0.25)' },
      rough: { grip: 0.6, top: 0.7 },
      border: [{ name: 'snowpile', spacing: 30, offset: 10, chance: 0.8 }],
      scatter: [{ name: 'pinecone', count: 10 }, { name: 'snowpile', count: 20, opt: { s: 5 } }],
      sprites: [{ name: 'flake', count: 40, size: 1.4 }],
      decals: 'frost',
    },
    picnic: {
      name: 'Picnic Blanket', light: 'noon', edge: 'wall', wallCol: '#4c8a2e', tableSide: '#3d6b24', floor: '#3f7a35',
      ground(x, w, h, r) {
        const s = 60; x.fillStyle = '#f4f0e6'; x.fillRect(0, 0, w, h);
        for (let i = 0; i < w; i += s) if ((i / s) % 2 === 0) { x.fillStyle = 'rgba(28,126,214,0.45)'; x.fillRect(i, 0, s, h); }
        for (let j = 0; j < h; j += s) if ((j / s) % 2 === 0) { x.fillStyle = 'rgba(28,126,214,0.45)'; x.fillRect(0, j, w, s); }
        x.fillStyle = 'rgba(0,0,0,0.05)'; for (let j = 0; j < h; j += 3) x.fillRect(0, j, w, 1);
      },
      track: { fill: '#e8dcc0', edgeA: '#e03131', edgeB: '#ffffff', line: 'rgba(120,90,60,0.25)' },
      rough: { grip: 0.88, top: 0.75 },
      border: [{ name: 'grape', spacing: 24, offset: 9, chance: 0.7 }],
      scatter: [{ name: 'apple', count: 6 }, { name: 'grape', count: 30 }, { name: 'juicebox', count: 3 }],
      sprites: [{ name: 'ant', count: 30, size: 1.1, near: true }, { name: 'mushroom', count: 4, size: 1.4 }],
      decals: 'crumbs',
    },
    town: {
      name: 'Model Railway', light: 'dusk', edge: 'void', tableSide: '#5c3d2e', floor: '#2b2230',
      ground(x, w, h, r) {
        x.fillStyle = '#6aa84f'; x.fillRect(0, 0, w, h);
        for (let i = 0; i < w * h / 25; i++) { x.fillStyle = r() < 0.5 ? 'rgba(30,80,20,0.3)' : 'rgba(180,230,120,0.25)'; x.fillRect(r() * w, r() * h, 1, 1); }
        for (let i = 0; i < 12; i++) { x.fillStyle = 'rgba(70,120,50,0.5)'; x.beginPath(); x.ellipse(r() * w, r() * h, 30 + r() * 60, 20 + r() * 40, r() * 3, 0, 6.28); x.fill(); }
        x.fillStyle = 'rgba(100,170,230,0.85)'; x.beginPath(); x.ellipse(w * 0.15, h * 0.85, 60, 35, 0.3, 0, 6.28); x.fill();
      },
      track: { fill: '#55585e', edgeA: '#f1f3f5', edgeB: '#55585e', line: 'rgba(255,212,59,0.7)' },
      rough: { grip: 0.85, top: 0.7 },
      border: [{ name: 'tree', spacing: 70, offset: 22, chance: 0.5 }],
      scatter: [{ name: 'house', count: 14 }, { name: 'tree', count: 30 }, { name: 'rails', count: 5 }],
      sprites: [{ name: 'person', count: 22, size: 1.1, near: true }, { name: 'flowerR', count: 12, size: 1.1 }],
      decals: 'paths',
    },
  };

  // ---------- tracks ----------
  const TRACKS = [
    {
      id: 'cereal', name: 'Cereal Circuit', theme: 'breakfast', W: 2400, H: 1700, width: 130, seed: 11, start: [760, 285],
      pts: [[320, 360], [900, 270], [1500, 330], [2050, 300], [2150, 650], [1900, 900], [1450, 820], [1150, 1000], [1350, 1270], [1900, 1250], [2080, 1420], [1700, 1560], [900, 1540], [400, 1400], [260, 850]],
      zones: [{ t: 0.79, off: 0, rx: 85, ry: 60, type: 'slick', look: 'milk' }, { t: 0.43, off: 20, rx: 50, ry: 36, type: 'sticky', look: 'jam' }, { t: 0.95, off: -30, rx: 40, ry: 30, type: 'slick', look: 'milk' }],
      ramps: [{ t: 0.735, len: 26, look: 'book' }],
      boosts: [{ t: 0.17, off: 0 }, { t: 0.6, off: 25 }],
      pieces: [['bowl', 700, 820], ['glass', 1700, 560], ['glass', 1640, 1080], ['bowl', 1200, 560], ['mugpens', 2280, 1100]],
    },
    {
      id: 'desk', name: 'Desk Dash', theme: 'desk', W: 2400, H: 1600, width: 125, seed: 23, start: [700, 335],
      pts: [[420, 400], [900, 300], [1200, 800], [1500, 1300], [2000, 1250], [2120, 800], [2000, 360], [1500, 300], [1200, 800], [900, 1300], [400, 1220], [300, 800]],
      zones: [{ t: 0.3, off: 0, rx: 60, ry: 45, type: 'sticky', look: 'ink' }],
      ramps: [{ t: 0.56, len: 30, look: 'ruler' }, { t: 0.05, len: 26, look: 'book' }],
      boosts: [{ t: 0.4, off: 0 }, { t: 0.86, off: 0 }],
      pieces: [['mugpens', 1200, 160], ['book', 1220, 1460, 0.2, { w: 40, d: 26, h: 8 }], ['book', 640, 790, 1.4, { w: 36, d: 24, h: 10 }], ['book', 1760, 800, -0.3, { w: 38, d: 26, h: 9 }], ['eraser', 1200, 600]],
    },
    {
      id: 'sandbox', name: 'Sandbox Rally', theme: 'sandbox', W: 2250, H: 1650, width: 135, seed: 37, start: [700, 270],
      pts: [[350, 300], [900, 260], [1200, 520], [1000, 820], [1250, 1080], [1650, 950], [1750, 560], [1950, 380], [2020, 900], [1850, 1360], [1100, 1430], [450, 1350], [280, 850]],
      zones: [{ t: 0.33, off: 0, rx: 90, ry: 60, type: 'slick', look: 'water' }, { t: 0.82, off: -20, rx: 70, ry: 50, type: 'slick', look: 'water' }],
      ramps: [{ t: 0.7, len: 30, look: 'plank' }, { t: 0.18, len: 26, look: 'plank' }],
      boosts: [{ t: 0.1, off: 0 }, { t: 0.55, off: 0 }],
      pieces: [['bucket', 620, 800], ['castle', 1500, 640], ['castle', 680, 560], ['bucket', 1450, 1250]],
    },
    {
      id: 'pool', name: 'Pool Shark', theme: 'pool', W: 2400, H: 1300, width: 125, seed: 41,
      pts: [[350, 300], [1200, 230], [2050, 300], [2140, 680], [2000, 1030], [1450, 1060], [1200, 780], [950, 1060], [400, 1030], [270, 680]],
      zones: [],
      ramps: [{ t: 0.2, len: 28, look: 'rack' }],
      boosts: [{ t: 0.42, off: 0 }, { t: 0.9, off: 0 }],
      balls: [[0.08, -30], [0.27, 20], [0.33, -25], [0.52, 0], [0.62, 30], [0.75, -20], [0.85, 15], [0.66, -35]],
      pieces: [['cue', 1200, 520, 0.08], ['chalk', 700, 650], ['chalk', 1650, 640]],
    },
    {
      id: 'bath', name: 'Bath Time', theme: 'bath', W: 2400, H: 1700, width: 125, seed: 53,
      pts: [[350, 300], [1100, 280], [1500, 500], [2050, 330], [2150, 800], [1700, 950], [2000, 1300], [1300, 1400], [1100, 1000], [700, 1300], [280, 1150], [450, 750]],
      zones: [{ t: 0.24, off: 0, rx: 90, ry: 55, type: 'slick', look: 'water' }, { t: 0.62, off: 15, rx: 80, ry: 50, type: 'slick', look: 'water' }, { t: 0.9, off: 0, rx: 60, ry: 45, type: 'slick', look: 'water' }],
      ramps: [{ t: 0.47, len: 28, look: 'sponge' }],
      boosts: [{ t: 0.13, off: 0 }, { t: 0.72, off: 0 }],
      pieces: [['duck', 1350, 1150], ['bottle', 800, 600], ['bottle', 1800, 600], ['duck', 600, 1000], ['sponge', 1500, 820]],
      drain: [1300, 760, 80],
    },
    {
      id: 'toybox', name: 'Toybox Night', theme: 'toybox', W: 2600, H: 1800, width: 130, seed: 67,
      pts: [[300, 300], [900, 250], [1300, 450], [1700, 250], [2300, 350], [2350, 800], [1900, 900], [2300, 1300], [1800, 1550], [1300, 1300], [800, 1550], [300, 1400], [550, 950], [250, 650]],
      zones: [{ t: 0.66, off: 0, rx: 60, ry: 40, type: 'sticky', look: 'slime' }],
      ramps: [{ t: 0.3, len: 30, look: 'block' }, { t: 0.83, len: 28, look: 'block' }],
      boosts: [{ t: 0.12, off: 0 }, { t: 0.5, off: -20 }, { t: 0.95, off: 0 }],
      pieces: [['lamp', 1300, 820], ['lamp', 1300, 120], ['robot', 900, 1050], ['robot', 1850, 1200], ['lamp', 2500, 1050], ['block', 700, 700], ['block', 1650, 700]],
    },
    {
      id: 'garage', name: 'Spanner Speedway', theme: 'garage', W: 2500, H: 1700, width: 125, seed: 71, start: [650, 270],
      pts: [[300, 300], [1000, 240], [1400, 500], [1800, 250], [2250, 380], [2200, 900], [1700, 1000], [1500, 1400], [900, 1450], [700, 1050], [350, 1300], [250, 800]],
      zones: [{ t: 0.47, off: 0, rx: 90, ry: 55, type: 'slick', look: 'oil' }, { t: 0.8, off: 20, rx: 60, ry: 40, type: 'sticky', look: 'sawdust' }],
      ramps: [{ t: 0.25, len: 28, look: 'tape' }, { t: 0.66, len: 26, look: 'board' }],
      boosts: [{ t: 0.12, off: 0 }, { t: 0.56, off: 0 }],
      pieces: [['oilcan', 1350, 1050], ['tape', 1600, 600], ['oilcan', 1150, 780], ['battery', 2350, 1300], ['tape', 520, 640]],
    },
    {
      id: 'mousepad', name: 'Mousepad 500', theme: 'computer', W: 2400, H: 1600, width: 125, seed: 83, start: [1350, 262],
      pts: [[350, 300], [1200, 260], [2050, 300], [2150, 700], [1800, 820], [2100, 1150], [1900, 1350], [1200, 1300], [900, 1000], [600, 1350], [280, 1100], [300, 650]],
      zones: [{ t: 0.62, off: 0, rx: 70, ry: 50, type: 'sticky', look: 'coffee' }],
      ramps: [{ t: 0.08, len: 28, look: 'key' }, { t: 0.45, len: 28, look: 'key' }],
      boosts: [{ t: 0.2, off: 0 }, { t: 0.33, off: 0 }, { t: 0.88, off: 0 }],
      pieces: [['mouse', 1450, 800], ['coffee', 600, 700], ['coffee', 1500, 520], ['mouse', 2280, 1500]],
    },
    {
      id: 'bakery', name: 'Cookie Crumble', theme: 'bakery', W: 2400, H: 1700, width: 128, seed: 97, start: [650, 285],
      pts: [[400, 320], [900, 250], [1300, 400], [1150, 750], [1500, 950], [1950, 700], [2150, 1100], [1900, 1450], [1200, 1400], [700, 1500], [300, 1200], [450, 800]],
      zones: [{ t: 0.3, off: 0, rx: 80, ry: 55, type: 'slick', look: 'flour' }, { t: 0.7, off: -15, rx: 70, ry: 50, type: 'sticky', look: 'batter' }, { t: 0.9, off: 20, rx: 60, ry: 40, type: 'slick', look: 'flour' }],
      ramps: [{ t: 0.55, len: 30, look: 'cookie' }],
      boosts: [{ t: 0.15, off: 0 }, { t: 0.74, off: 0 }],
      pieces: [['rollingpin', 1750, 1150, 0.4], ['flour', 800, 900], ['measure', 1600, 450], ['cookie', 1000, 1150], ['egg', 1950, 1000]],
    },
    {
      id: 'frost', name: 'Frosty Sill', theme: 'frost', W: 3000, H: 1000, width: 118, seed: 109, start: [650, 220],
      pts: [[300, 250], [1100, 200], [1500, 450], [1900, 200], [2700, 250], [2800, 600], [2300, 800], [1800, 650], [1300, 800], [700, 780], [250, 650]],
      zones: [{ t: 0.22, off: 0, rx: 110, ry: 50, type: 'slick', look: 'ice' }, { t: 0.55, off: 0, rx: 100, ry: 50, type: 'slick', look: 'ice' }, { t: 0.83, off: 0, rx: 80, ry: 45, type: 'slick', look: 'ice' }],
      ramps: [{ t: 0.4, len: 30, look: 'snow' }],
      boosts: [{ t: 0.08, off: 0 }, { t: 0.68, off: 0 }],
      pieces: [['snowman', 1000, 480], ['candle', 2400, 520], ['candle', 900, 450], ['candycane', 2050, 470, 0.1], ['snowman', 400, 450]],
    },
    {
      id: 'picnic', name: 'Picnic Panic', theme: 'picnic', W: 2400, H: 1800, width: 130, seed: 113, start: [1500, 300],
      pts: [[350, 350], [800, 250], [1300, 350], [1700, 250], [2100, 450], [2000, 850], [1600, 950], [1900, 1350], [1400, 1550], [900, 1300], [500, 1550], [250, 1100], [600, 800]],
      zones: [{ t: 0.4, off: 0, rx: 70, ry: 50, type: 'sticky', look: 'ketchup' }, { t: 0.72, off: 10, rx: 80, ry: 55, type: 'slick', look: 'lemonade' }],
      ramps: [{ t: 0.07, len: 28, look: 'bread' }, { t: 0.85, len: 26, look: 'bread' }],
      boosts: [{ t: 0.3, off: 0 }, { t: 0.58, off: 0 }],
      pieces: [['sandwich', 1150, 800], ['melon', 1300, 1150, 0.3], ['apple', 1750, 650], ['juicebox', 950, 550], ['sandwich', 2150, 1550]],
    },
    {
      id: 'town', name: 'Tiny Town', theme: 'town', W: 2600, H: 1800, width: 120, seed: 127,
      pts: [[350, 400], [900, 250], [1500, 350], [2000, 250], [2350, 600], [2100, 1000], [2300, 1450], [1700, 1550], [1300, 1150], [900, 1500], [400, 1450], [300, 900]],
      zones: [{ t: 0.58, off: 0, rx: 70, ry: 45, type: 'sticky', look: 'mud' }],
      ramps: [{ t: 0.33, len: 30, look: 'bridge' }, { t: 0.75, len: 28, look: 'bridge' }],
      boosts: [{ t: 0.15, off: 0 }, { t: 0.46, off: 0 }, { t: 0.9, off: 0 }],
      pieces: [['house', 1300, 750], ['house', 1150, 600, 0.6], ['house', 1700, 900], ['tree', 1450, 950], ['house', 700, 900], ['tree', 900, 750], ['house', 2000, 1250, 1.2]],
    },
  ];

  // Cups: each race is [trackIndex, reversed]
  const CUPS = [
    { id: 'rookie', name: 'Rookie Cup', races: [[0, false], [1, false], [2, false]], ai: 0.9, reward: 300, unlock: 'buggy' },
    { id: 'pro', name: 'Pro Cup', races: [[3, false], [4, false], [5, false]], ai: 0.95, reward: 500, unlock: 'gt' },
    { id: 'workshop', name: 'Workshop Cup', races: [[6, false], [7, false], [8, false]], ai: 0.98, reward: 650, unlock: 'hover' },
    { id: 'mirror', name: 'Mirror Cup', races: [[0, true], [1, true], [2, true]], ai: 1.0, reward: 800, unlock: 'truck' },
    { id: 'tour', name: 'Grand Tour Cup', races: [[9, false], [10, false], [11, false]], ai: 1.02, reward: 1000, unlock: null },
    { id: 'champ', name: 'Champion Cup', races: [[3, true], [4, true], [5, true]], ai: 1.04, reward: 1200, unlock: 'formula' },
    { id: 'legend', name: 'Legend Cup', races: [[7, true], [9, true], [11, true]], ai: 1.07, reward: 1600, unlock: null },
  ];

  // Cars. Stats 0..1-ish; physics turns them into numbers.
  const CARS = [
    { id: 'zip', name: 'Zip', desc: 'Nimble hatchback. Easy to drive.', top: 0.6, accel: 0.65, grip: 0.65, mass: 0.5, price: 0, paints: ['#ff4d5e', '#ffd43b'] },
    { id: 'buggy', name: 'Dune Buggy', desc: 'Big tyres. Loses little speed off the track.', top: 0.55, accel: 0.75, grip: 0.6, mass: 0.45, offroad: 0.9, price: 900, paints: ['#ff922b', '#1c1c1c'] },
    { id: 'gt', name: 'Bolt GT', desc: 'Very fast, slides a lot. Drift it to fill boost.', top: 0.85, accel: 0.6, grip: 0.45, mass: 0.55, price: 1600, paints: ['#4dabf7', '#ffffff'] },
    { id: 'truck', name: 'Brick', desc: 'Heavy 4x4. Shoves other cars aside.', top: 0.55, accel: 0.5, grip: 0.7, mass: 1.0, offroad: 0.8, price: 2200, paints: ['#40c057', '#ffd43b'] },
    { id: 'formula', name: 'Formula', desc: 'Top speed and grip. Light, so it gets pushed around.', top: 0.92, accel: 0.8, grip: 0.85, mass: 0.3, price: 3200, paints: ['#e64980', '#f8f9fa'] },
    { id: 'hover', name: 'Hover', desc: 'Floats over puddles and goo. Drifty.', top: 0.78, accel: 0.7, grip: 0.35, mass: 0.4, hover: true, price: 4000, paints: ['#9775fa', '#3ff0ff'] },
  ];
  const PAINTS = ['#ff4d5e', '#ff922b', '#ffd43b', '#40c057', '#4dabf7', '#9775fa', '#e64980', '#f8f9fa', '#343a40', '#3ff0ff'];
  const RIVALS = [
    { name: 'Rusty', car: 'truck', paint: '#c2410c', acc: '#fde68a' },
    { name: 'Pip', car: 'zip', paint: '#22b8cf', acc: '#ffffff' },
    { name: 'Vex', car: 'gt', paint: '#7048e8', acc: '#ffd43b' },
    { name: 'Moxie', car: 'buggy', paint: '#f59f00', acc: '#212529' },
    { name: 'Nova', car: 'formula', paint: '#f8f9fa', acc: '#e03131' },
    { name: 'Glitch', car: 'hover', paint: '#20c997', acc: '#ff4dd8' },
  ];

  CR.LIGHT = LIGHT; CR.THEMES = THEMES; CR.TRACKS = TRACKS; CR.CUPS = CUPS; CR.CARS = CARS; CR.PAINTS = PAINTS; CR.RIVALS = RIVALS;
})(window.CR);
