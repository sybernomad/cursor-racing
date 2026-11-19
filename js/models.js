// Cursor Racing — voxel cars, voxel props and the pixel-sprite atlas. Everything is generated in code.
(function (CR) {
  'use strict';
  const { U, G } = CR;
  const { Vox } = G;
  const hex = U.hex;

  // ---------------------------------------------------------------------------
  // Cars. Grid: x 0 (rear) .. 15 (front), y up 0..9, z 0..8 across. Voxel size CAR_VS.
  // ---------------------------------------------------------------------------
  const CAR_VS = 2.2;
  const TIRE = [0.07, 0.07, 0.09], HUB = [0.62, 0.64, 0.7], GLASS = [0.28, 0.45, 0.6], DARK = [0.13, 0.13, 0.16];
  const HEAD = [1, 0.95, 0.72], TAIL = [1, 0.12, 0.08], SKIN = [0.95, 0.75, 0.55];

  function wheels(v, xs, big = false, z0 = 0, z1 = 8) {
    const top = big ? 3 : 2;
    for (const xc of xs) for (const z of [z0, z1]) {
      for (let x = xc - 1; x <= xc + 1; x++) for (let y = 0; y <= top; y++) v.set(x, y, z, TIRE);
      if (big) { v.set(xc - 2, 1, z, TIRE); v.set(xc + 2, 1, z, TIRE); v.set(xc - 2, 2, z, TIRE); v.set(xc + 2, 2, z, TIRE); }
      v.set(xc, big ? 1 : 1, z, HUB); if (big) v.set(xc, 2, z, HUB);
    }
  }
  function helmet(v, x, y, z, c) { v.set(x, y, z, SKIN); v.set(x, y + 1, z, c); v.set(x + 1, y + 1, z, GLASS); }

  // fill a body from per-x half-width and height functions (z centred on 4)
  function hull(v, c, r, hw, top, y0 = 1) {
    for (let x = 0; x < 16; x++) { const w = hw(x), t = top(x); if (w < 0) continue; for (let y = y0; y <= t; y++) for (let z = Math.round(4 - w); z <= Math.round(4 + w); z++) { const k = 1 + (r() - 0.5) * 0.05; v.set(x, y, z, [c[0] * k, c[1] * k, c[2] * k]); } }
  }
  const CAR_BUILD = {
    zip(v, P, A, r) { // hatchback
      wheels(v, [3, 11]);
      v.box(1, 1, 1, 14, 3, 7, P, 0, 0.06, r);
      v.box(0, 1, 1, 0, 1, 7, DARK); v.box(15, 1, 1, 15, 1, 7, DARK);
      v.box(4, 4, 2, 10, 5, 6, GLASS); v.box(4, 6, 2, 10, 6, 6, P, 0, 0.05, r);
      v.box(5, 4, 3, 9, 5, 5, DARK); helmet(v, 7, 4, 4, A);
      for (let x = 1; x <= 14; x++) v.set(x, 3, 4, A);
      for (let x = 4; x <= 10; x++) v.set(x, 6, 4, A);
      v.set(14, 2, 1, HEAD, 1); v.set(14, 2, 7, HEAD, 1); v.set(1, 2, 1, TAIL, 1); v.set(1, 2, 7, TAIL, 1);
    },
    buggy(v, P, A, r) {
      wheels(v, [3, 12], true);
      v.box(2, 1, 2, 13, 2, 6, P, 0, 0.06, r);
      v.box(13, 1, 2, 14, 1, 6, DARK);
      v.box(5, 3, 3, 9, 3, 5, DARK); helmet(v, 7, 3, 4, A);
      for (const [x, z] of [[5, 2], [10, 2], [5, 6], [10, 6]]) for (let y = 3; y <= 5; y++) v.set(x, y, z, A);
      v.box(5, 6, 2, 10, 6, 6, A); v.box(6, 6, 3, 9, 6, 5, null || P);
      v.set(13, 2, 2, HEAD, 1); v.set(13, 2, 6, HEAD, 1);
      v.box(1, 2, 3, 2, 3, 5, HUB);
    },
    gt(v, P, A, r) { // low sports car
      wheels(v, [3, 12]);
      v.box(0, 1, 1, 15, 2, 7, P, 0, 0.05, r);
      v.box(5, 3, 2, 10, 3, 6, GLASS); v.box(6, 4, 2, 9, 4, 6, P);
      v.box(6, 3, 3, 9, 3, 5, DARK); helmet(v, 7, 3, 4, A);
      for (let x = 0; x <= 15; x++) { v.set(x, 2, 3, A); v.set(x, 2, 5, A); }
      v.box(0, 4, 1, 1, 4, 7, A); v.set(1, 3, 2, DARK); v.set(1, 3, 6, DARK);
      v.set(15, 2, 1, HEAD, 1); v.set(15, 2, 7, HEAD, 1); v.set(0, 2, 2, TAIL, 1); v.set(0, 2, 6, TAIL, 1);
    },
    truck(v, P, A, r) {
      wheels(v, [3, 12], true);
      v.box(1, 2, 1, 14, 4, 7, P, 0, 0.06, r);
      v.box(2, 4, 2, 6, 4, 6, DARK);
      v.box(7, 5, 1, 13, 7, 7, P, 0, 0.05, r); v.box(8, 5, 1, 13, 6, 7, GLASS); v.box(8, 7, 1, 13, 7, 7, P);
      v.box(9, 5, 2, 12, 6, 6, DARK); helmet(v, 10, 5, 4, A);
      v.box(15, 2, 2, 15, 3, 6, HUB);
      for (let z = 2; z <= 6; z += 2) v.set(11, 8, z, HEAD, 1);
      v.box(1, 5, 1, 6, 5, 1, A); v.box(1, 5, 7, 6, 5, 7, A); v.box(1, 5, 1, 1, 5, 7, A);
      v.set(14, 3, 1, HEAD, 1); v.set(14, 3, 7, HEAD, 1); v.set(1, 3, 1, TAIL, 1); v.set(1, 3, 7, TAIL, 1);
    },
    formula(v, P, A, r) {
      wheels(v, [2, 12]);
      v.box(0, 1, 3, 15, 2, 5, P, 0, 0.05, r);
      v.box(4, 1, 2, 9, 2, 6, P, 0, 0.05, r);
      v.box(14, 1, 0, 15, 1, 8, A); v.box(0, 4, 1, 1, 4, 7, A); v.box(0, 3, 4, 1, 3, 4, DARK);
      v.box(6, 3, 3, 8, 3, 5, DARK); helmet(v, 7, 3, 4, A);
      v.set(15, 2, 4, A);
    },
    kart(v, P, A, r) { // open go-kart: low tray, exposed wheels, driver sits up
      wheels(v, [2, 12]);
      v.box(1, 1, 2, 14, 1, 6, P, 0, 0.06, r);
      v.box(13, 1, 1, 15, 2, 7, A); v.box(0, 1, 1, 1, 2, 7, DARK);
      v.box(6, 2, 3, 9, 2, 5, DARK); v.box(5, 2, 3, 5, 4, 5, DARK);
      helmet(v, 7, 3, 4, A); v.set(7, 3, 3, P); v.set(7, 3, 5, P);
      v.box(10, 2, 4, 11, 3, 4, HUB); v.box(2, 2, 3, 3, 3, 5, HUB);
    },
    beetle(v, P, A, r) { // round classic bubble car
      wheels(v, [3, 12]);
      for (let x = 1; x <= 14; x++) for (let y = 1; y <= 6; y++) for (let z = 1; z <= 7; z++) {
        const dx = (x - 7.5) / 7, dy = (y - 1) / 5.5, dz = (z - 4) / 3.6;
        if (dx * dx + dy * dy + dz * dz * 0.6 <= 1) v.set(x, y, z, P);
      }
      v.box(6, 4, 2, 10, 5, 6, GLASS); v.box(7, 6, 3, 9, 6, 5, P); v.box(7, 4, 3, 9, 4, 5, DARK); helmet(v, 8, 4, 4, A);
      v.set(14, 2, 2, HEAD, 1); v.set(14, 2, 6, HEAD, 1); v.set(1, 2, 2, TAIL, 1); v.set(1, 2, 6, TAIL, 1);
      for (let z = 1; z <= 7; z++) { v.set(15, 1, z, HUB); v.set(0, 1, z, HUB); }
    },
    rally(v, P, A, r) { // hatch with roof scoop, mud flaps, number panel
      wheels(v, [3, 12]);
      v.box(1, 1, 1, 14, 3, 7, P, 0, 0.05, r);
      v.box(5, 4, 2, 11, 5, 6, GLASS); v.box(5, 6, 2, 11, 6, 6, P); v.box(6, 4, 3, 10, 5, 5, DARK); helmet(v, 8, 4, 4, A);
      for (let x = 1; x <= 14; x++) { v.set(x, 2, 1, A); v.set(x, 2, 7, A); }
      v.box(8, 7, 3, 9, 7, 5, A); v.box(0, 5, 1, 1, 5, 7, A);
      v.box(6, 3, 0, 9, 3, 0, [1, 1, 1]); v.box(6, 3, 8, 9, 3, 8, [1, 1, 1]);
      for (let z = 2; z <= 6; z += 2) v.set(15, 2, z, HEAD, 1); v.set(1, 2, 2, TAIL, 1); v.set(1, 2, 6, TAIL, 1);
    },
    police(v, P, A, r) { // cruiser with a light bar
      wheels(v, [3, 12]);
      v.box(0, 1, 1, 15, 3, 7, P, 0, 0.04, r);
      v.box(4, 1, 1, 11, 3, 1, [0.95, 0.95, 0.95]); v.box(4, 1, 7, 11, 3, 7, [0.95, 0.95, 0.95]);
      v.box(5, 4, 2, 11, 5, 6, GLASS); v.box(5, 6, 2, 11, 6, 6, [0.95, 0.95, 0.95]); v.box(6, 4, 3, 10, 5, 5, DARK); helmet(v, 8, 4, 4, A);
      v.box(8, 7, 2, 8, 7, 3, [1, 0.15, 0.15], 1); v.box(8, 7, 5, 8, 7, 6, [0.2, 0.45, 1], 1); v.set(8, 7, 4, HUB);
      v.box(15, 1, 2, 15, 1, 6, DARK); v.set(15, 2, 1, HEAD, 1); v.set(15, 2, 7, HEAD, 1); v.set(0, 2, 1, TAIL, 1); v.set(0, 2, 7, TAIL, 1);
    },
    van(v, P, A, r) { // camper van, tall box with two-tone paint
      wheels(v, [3, 12]);
      v.box(1, 1, 1, 15, 7, 7, P, 0, 0.04, r);
      v.box(1, 5, 1, 15, 7, 7, A, 0, 0.04, r);
      v.box(12, 5, 1, 15, 6, 7, GLASS); v.box(13, 5, 3, 14, 6, 5, DARK); helmet(v, 13, 5, 4, A);
      for (const x of [3, 6, 9]) { v.box(x, 5, 0, x + 1, 6, 0, GLASS); v.box(x, 5, 8, x + 1, 6, 8, GLASS); }
      v.box(1, 8, 2, 9, 8, 6, DARK); v.box(4, 9, 3, 6, 9, 5, HUB);
      v.set(15, 2, 1, HEAD, 1); v.set(15, 2, 7, HEAD, 1); v.set(1, 2, 1, TAIL, 1); v.set(1, 2, 7, TAIL, 1);
      for (let z = 2; z <= 6; z++) v.set(15, 3, z, HUB);
    },
    muscle(v, P, A, r) { // long hood, blower, twin stripes
      wheels(v, [3, 12], true);
      v.box(0, 2, 1, 15, 3, 7, P, 0, 0.04, r);
      v.box(3, 4, 2, 7, 5, 6, GLASS); v.box(3, 6, 2, 6, 6, 6, P); v.box(4, 4, 3, 6, 5, 5, DARK); helmet(v, 5, 4, 4, A);
      for (let x = 0; x <= 15; x++) { v.set(x, 3, 3, A); v.set(x, 3, 5, A); }
      v.box(10, 4, 3, 12, 5, 5, HUB); v.box(11, 6, 3, 11, 6, 5, DARK);
      v.box(0, 4, 1, 0, 4, 7, P); v.set(15, 3, 1, HEAD, 1); v.set(15, 3, 7, HEAD, 1); v.set(0, 3, 1, TAIL, 1); v.set(0, 3, 7, TAIL, 1);
      v.box(0, 1, 2, 0, 1, 3, HUB); v.box(0, 1, 5, 0, 1, 6, HUB);
    },
    monster(v, P, A, r) { // monster truck: huge wheels, body up high
      for (const xc of [3, 12]) for (const z of [0, 1, 7, 8]) { for (let x = xc - 2; x <= xc + 2; x++) for (let y = 0; y <= 4; y++) if (!((x === xc - 2 || x === xc + 2) && (y === 0 || y === 4))) v.set(x, y, z, TIRE); v.set(xc, 2, z, HUB); }
      v.box(4, 3, 3, 11, 3, 5, DARK);
      v.box(1, 5, 1, 14, 6, 7, P, 0, 0.05, r);
      v.box(5, 7, 2, 10, 8, 6, GLASS); v.box(5, 9, 2, 10, 9, 6, P); v.box(6, 7, 3, 9, 8, 5, DARK); helmet(v, 7, 7, 4, A);
      for (let x = 1; x <= 14; x++) v.set(x, 6, 4, A);
      v.set(14, 5, 1, HEAD, 1); v.set(14, 5, 7, HEAD, 1); v.set(1, 5, 1, TAIL, 1); v.set(1, 5, 7, TAIL, 1);
    },
    jet(v, P, A, r) { // rocket car: needle nose, tail fin, glowing nozzle
      wheels(v, [3, 12]);
      v.box(2, 1, 2, 15, 3, 6, P, 0, 0.04, r); v.box(13, 1, 3, 15, 2, 5, P);
      v.box(0, 1, 2, 2, 4, 6, HUB); v.box(0, 2, 3, 0, 3, 5, [1, 0.55, 0.15], 1);
      v.box(6, 4, 3, 10, 4, 5, GLASS); v.box(7, 4, 4, 9, 4, 4, DARK); helmet(v, 8, 4, 4, A);
      v.box(1, 5, 4, 4, 8, 4, A); v.box(2, 9, 4, 3, 9, 4, A);
      v.box(2, 1, 0, 6, 1, 1, A); v.box(2, 1, 7, 6, 1, 8, A);
      v.set(15, 2, 4, HEAD, 1);
    },
    // ---------- the second garage: 20 more ----------
    taxi(v, P, A, r) {
      wheels(v, [3, 12]);
      v.box(0, 1, 1, 15, 3, 7, P, 0, 0.04, r);
      for (let x = 1; x <= 14; x++) { const c = x % 2 ? DARK : [1, 1, 1]; v.set(x, 2, 1, c); v.set(x, 2, 7, c); }
      v.box(4, 4, 2, 11, 5, 6, GLASS); v.box(4, 6, 2, 11, 6, 6, P); v.box(5, 4, 3, 10, 5, 5, DARK); helmet(v, 8, 4, 4, A);
      v.box(7, 7, 3, 8, 7, 5, [1, 1, 0.8], 0.9);
      v.set(15, 2, 1, HEAD, 1); v.set(15, 2, 7, HEAD, 1); v.set(0, 2, 1, TAIL, 1); v.set(0, 2, 7, TAIL, 1);
    },
    icecream(v, P, A, r) {
      wheels(v, [3, 12]);
      v.box(1, 1, 1, 15, 6, 7, P, 0, 0.03, r);
      v.box(1, 3, 1, 15, 3, 1, A); v.box(1, 3, 7, 15, 3, 7, A); v.box(1, 6, 1, 15, 6, 7, A);
      v.box(13, 4, 1, 15, 5, 7, GLASS); v.box(5, 4, 0, 9, 5, 0, GLASS); v.box(4, 3, 0, 10, 3, 0, [1, 1, 1]);
      v.set(6, 7, 4, [0.85, 0.6, 0.3]); v.box(5, 8, 3, 7, 8, 5, [1, 0.6, 0.75]); v.set(6, 9, 4, [0.9, 0.1, 0.2]);
      v.set(15, 2, 1, HEAD, 1); v.set(15, 2, 7, HEAD, 1); v.set(1, 2, 1, TAIL, 1); v.set(1, 2, 7, TAIL, 1);
    },
    firetruck(v, P, A, r) {
      wheels(v, [3, 12], true);
      v.box(0, 2, 1, 15, 4, 7, P, 0, 0.04, r);
      v.box(11, 5, 1, 15, 6, 7, P); v.box(13, 5, 1, 15, 5, 7, GLASS);
      v.box(1, 5, 2, 10, 5, 6, HUB);
      for (let x = 0; x <= 11; x++) { v.set(x, 6, 3, A); v.set(x, 6, 5, A); if (x % 2 === 0) v.set(x, 6, 4, A); }
      v.set(13, 7, 3, [1, 0.15, 0.15], 1); v.set(13, 7, 5, [0.2, 0.45, 1], 1);
      v.box(0, 3, 1, 9, 3, 1, [1, 1, 1]); v.box(0, 3, 7, 9, 3, 7, [1, 1, 1]);
      v.set(15, 3, 1, HEAD, 1); v.set(15, 3, 7, HEAD, 1); v.set(0, 3, 2, TAIL, 1); v.set(0, 3, 6, TAIL, 1);
    },
    bus(v, P, A, r) {
      wheels(v, [3, 12]);
      v.box(0, 1, 1, 15, 6, 7, P, 0, 0.03, r);
      v.box(0, 2, 1, 15, 2, 1, DARK); v.box(0, 2, 7, 15, 2, 7, DARK);
      for (let x = 1; x <= 13; x += 2) for (const z of [1, 7]) { v.set(x, 4, z, GLASS); v.set(x, 5, z, GLASS); }
      v.box(15, 4, 2, 15, 5, 6, GLASS); v.box(1, 7, 2, 14, 7, 6, A);
      v.set(15, 2, 2, HEAD, 1); v.set(15, 2, 6, HEAD, 1); v.set(0, 2, 2, TAIL, 1); v.set(0, 2, 6, TAIL, 1); v.set(0, 6, 3, [1, 0.6, 0.1], 1); v.set(0, 6, 5, [1, 0.6, 0.1], 1);
    },
    tank(v, P, A, r) {
      for (const z of [0, 1, 7, 8]) { v.box(0, 0, z, 15, 2, z, TIRE); v.clear(0, 0, z); v.clear(15, 0, z); }
      for (let x = 2; x <= 13; x += 3) { v.set(x, 1, 0, HUB); v.set(x, 1, 8, HUB); }
      v.box(1, 1, 2, 14, 2, 6, DARK); v.box(1, 3, 1, 14, 4, 7, P, 0, 0.06, r);
      v.box(5, 5, 2, 10, 6, 6, P, 0, 0.06, r); v.box(11, 5, 4, 15, 5, 4, DARK); v.set(7, 7, 4, A); v.set(8, 7, 4, A);
      v.set(3, 4, 4, A); v.set(2, 4, 4, A); v.set(3, 4, 3, A); v.set(3, 4, 5, A);
    },
    tractor(v, P, A, r) {
      for (const z of [0, 1, 7, 8]) { for (let x = 1; x <= 7; x++) for (let y = 0; y <= 6; y++) if (Math.hypot(x - 4, y - 3) < 3.6) v.set(x, y, z, TIRE); v.set(4, 3, z, HUB); }
      wheels(v, [12], false, 1, 7);
      v.box(6, 2, 3, 14, 4, 5, P, 0, 0.05, r); v.box(3, 3, 2, 7, 3, 6, P);
      for (const [x, z] of [[2, 2], [7, 2], [2, 6], [7, 6]]) v.box(x, 4, z, x, 7, z, DARK);
      v.box(1, 8, 1, 8, 8, 7, A); helmet(v, 5, 4, 4, A);
      v.box(12, 5, 4, 12, 7, 4, DARK); v.set(14, 3, 3, HEAD, 1); v.set(14, 3, 5, HEAD, 1); v.box(14, 2, 3, 14, 2, 5, HUB);
    },
    limo(v, P, A, r) {
      wheels(v, [2, 13]);
      v.box(0, 1, 1, 15, 3, 7, P, 0, 0.03, r);
      v.box(3, 4, 2, 12, 4, 6, GLASS); v.box(3, 5, 2, 12, 5, 6, P);
      for (const x of [3, 6, 9, 12]) v.box(x, 4, 2, x, 4, 6, P);
      v.box(0, 1, 1, 15, 1, 1, A); v.box(0, 1, 7, 15, 1, 7, A); v.set(1, 4, 6, HUB); v.set(1, 5, 6, HUB);
      v.set(15, 2, 1, HEAD, 1); v.set(15, 2, 7, HEAD, 1); v.set(0, 2, 1, TAIL, 1); v.set(0, 2, 7, TAIL, 1); v.box(15, 2, 3, 15, 2, 5, HUB);
    },
    hotrod(v, P, A, r) {
      wheels(v, [3], true); wheels(v, [13]);
      v.box(1, 2, 2, 9, 3, 6, P, 0, 0.04, r);
      v.box(2, 4, 2, 6, 5, 6, P); v.box(6, 4, 3, 6, 4, 5, GLASS); v.box(3, 4, 2, 5, 4, 2, GLASS); v.box(3, 4, 6, 5, 4, 6, GLASS);
      v.box(10, 2, 3, 13, 3, 5, HUB); v.box(11, 4, 3, 12, 5, 5, DARK); v.set(11, 6, 4, A); v.set(12, 6, 4, A);
      v.box(8, 2, 1, 11, 2, 1, A); v.box(8, 2, 7, 11, 2, 7, A);
      for (const z of [2, 6]) { v.set(8, 3, z, A); v.set(9, 3, z, A); v.set(7, 3, z, [1, 0.85, 0.2]); }
      v.set(14, 3, 2, HEAD, 1); v.set(14, 3, 6, HEAD, 1); v.set(14, 2, 4, HUB); v.set(1, 3, 2, TAIL, 1); v.set(1, 3, 6, TAIL, 1);
    },
    dragster(v, P, A, r) {
      wheels(v, [2], true); wheels(v, [2], true, 1, 7);
      for (const z of [1, 7]) { v.set(14, 0, z, TIRE); v.set(14, 1, z, TIRE); v.set(13, 0, z, TIRE); v.set(15, 0, z, TIRE); }
      v.box(3, 1, 4, 15, 1, 4, P); v.box(3, 1, 3, 10, 2, 5, P, 0, 0.04, r); v.box(13, 1, 2, 13, 1, 6, DARK);
      v.box(4, 3, 3, 6, 3, 5, DARK); helmet(v, 5, 3, 4, A); v.box(1, 2, 3, 3, 4, 5, HUB); v.set(2, 5, 3, DARK); v.set(2, 5, 5, DARK);
      v.box(0, 4, 2, 0, 5, 2, DARK); v.box(0, 4, 6, 0, 5, 6, DARK); v.box(0, 6, 1, 1, 6, 7, A); v.box(14, 2, 3, 15, 2, 5, A);
      for (let x = 7; x <= 12; x++) v.set(x, 2, 4, A);
    },
    pickup(v, P, A, r) {
      wheels(v, [3, 12]);
      v.box(0, 1, 1, 15, 3, 7, P, 0, 0.04, r);
      v.box(1, 3, 2, 6, 3, 6, DARK); v.box(2, 3, 3, 4, 4, 5, [0.72, 0.52, 0.3]); v.set(5, 3, 4, [0.3, 0.6, 0.9]);
      v.box(8, 4, 1, 12, 5, 7, GLASS); v.box(8, 6, 1, 12, 6, 7, P); v.box(8, 4, 1, 8, 5, 7, P); v.box(8, 5, 3, 8, 5, 5, GLASS);
      for (const z of [1, 7]) { v.set(12, 4, z, P); v.set(12, 5, z, P); v.set(10, 4, z, P); v.set(10, 5, z, P); }
      v.box(15, 1, 1, 15, 1, 7, HUB); v.box(0, 1, 1, 0, 1, 7, HUB); for (let x = 1; x <= 14; x++) { v.set(x, 2, 1, A); v.set(x, 2, 7, A); }
      v.set(15, 2, 1, HEAD, 1); v.set(15, 2, 7, HEAD, 1); v.set(0, 2, 1, TAIL, 1); v.set(0, 2, 7, TAIL, 1);
    },
    ambulance(v, P, A, r) {
      wheels(v, [3, 12]);
      v.box(1, 1, 1, 15, 6, 7, P, 0, 0.02, r);
      v.box(1, 2, 1, 15, 2, 1, A); v.box(1, 2, 7, 15, 2, 7, A);
      for (const z of [1, 7]) for (const [x, y] of [[5, 4], [6, 4], [7, 4], [6, 3], [6, 5]]) v.set(x, y, z, A);
      v.box(13, 4, 1, 15, 5, 7, GLASS); v.box(12, 7, 2, 12, 7, 3, [1, 0.15, 0.15], 1); v.box(12, 7, 5, 12, 7, 6, [0.2, 0.45, 1], 1); v.set(12, 7, 4, HUB);
      v.set(15, 2, 1, HEAD, 1); v.set(15, 2, 7, HEAD, 1); v.set(1, 3, 1, TAIL, 1); v.set(1, 3, 7, TAIL, 1);
    },
    dumper(v, P, A, r) {
      wheels(v, [3, 12], true);
      v.box(0, 2, 2, 15, 2, 6, DARK);
      v.box(11, 3, 1, 15, 6, 7, P, 0, 0.04, r); v.box(13, 5, 1, 15, 5, 7, GLASS);
      v.box(0, 3, 1, 9, 6, 7, A, 0, 0.05, r);
      for (let x = 1; x <= 8; x++) for (let y = 4; y <= 6; y++) for (let z = 2; z <= 6; z++) v.clear(x, y, z);
      v.box(1, 4, 2, 8, 5, 6, [0.45, 0.32, 0.2], 0, 0.25, r); v.box(3, 6, 3, 6, 6, 5, [0.5, 0.36, 0.22], 0, 0.25, r);
      v.box(10, 6, 2, 10, 6, 6, A); v.set(13, 7, 4, [1, 0.6, 0.1], 1);
      v.set(15, 3, 1, HEAD, 1); v.set(15, 3, 7, HEAD, 1);
    },
    stock(v, P, A, r) {
      wheels(v, [3, 12]);
      v.box(0, 1, 1, 15, 3, 7, P, 0, 0.03, r);
      v.box(5, 4, 2, 10, 4, 6, GLASS); v.box(5, 5, 2, 10, 5, 6, P); v.box(7, 5, 3, 8, 5, 5, [1, 1, 1]);
      for (const z of [1, 7]) v.box(6, 2, z, 9, 3, z, [1, 1, 1]);
      for (let x = 0; x <= 15; x++) { v.set(x, 3, 2, A); v.set(x, 3, 6, A); }
      v.box(0, 4, 1, 0, 5, 7, A); v.box(15, 1, 2, 15, 1, 6, DARK);
      v.set(15, 2, 2, HEAD, 1); v.set(15, 2, 6, HEAD, 1); v.set(0, 2, 2, TAIL, 1); v.set(0, 2, 6, TAIL, 1);
    },
    mini(v, P, A, r) {
      wheels(v, [5, 11]);
      v.box(3, 1, 1, 13, 3, 7, P, 0, 0.04, r);
      v.box(4, 4, 2, 10, 5, 6, GLASS); v.box(4, 6, 2, 10, 6, 6, A); v.box(5, 4, 3, 9, 5, 5, DARK); helmet(v, 8, 4, 4, A);
      v.box(11, 3, 3, 13, 3, 3, A); v.box(11, 3, 5, 13, 3, 5, A);
      v.set(13, 2, 2, HEAD, 1); v.set(13, 2, 6, HEAD, 1); v.set(3, 2, 2, TAIL, 1); v.set(3, 2, 6, TAIL, 1); v.box(13, 1, 3, 13, 1, 5, HUB);
    },
    wedge(v, P, A, r) {
      wheels(v, [3, 12]);
      v.box(0, 1, 1, 15, 2, 7, P, 0, 0.02, r);
      for (let x = 1; x <= 14; x++) { const top = Math.round(2 + (x < 7 ? x * 0.5 : (15 - x) * 0.4)); for (let y = 3; y <= top; y++) v.box(x, y, 1, x, y, 7, (x >= 7 && x <= 11 && y === top) ? GLASS : P); }
      v.box(15, 2, 1, 15, 2, 7, [1, 1, 1], 1); v.box(0, 2, 1, 0, 2, 7, TAIL, 1);
      v.box(1, 3, 1, 1, 3, 7, A);
    },
    ufo(v, P, A, r) {
      for (let x = 0; x < 16; x++) for (let z = 0; z < 9; z++) {
        const d = Math.hypot((x - 7.5) / 8, (z - 4) / 4.6);
        if (d <= 1) v.set(x, 1, z, d > 0.82 ? ((x + z) % 2 ? A : P) : P, d > 0.82 && (x + z) % 2 ? 1 : 0);
        if (d <= 0.78) v.set(x, 2, z, P);
        if (d <= 0.48) v.set(x, 3, z, GLASS); if (d <= 0.3) v.set(x, 4, z, GLASS);
        if (d <= 0.5) v.set(x, 0, z, [0.3, 0.9, 1], 0.7);
      }
      v.set(7, 5, 4, HUB); v.set(7, 6, 4, [1, 0.3, 0.3], 1);
    },
    boat(v, P, A, r) {
      for (let x = 0; x < 16; x++) {
        const hw = x < 10 ? 3 : Math.max(0, 3 - (x - 10) * 0.6), z0 = Math.round(4 - hw), z1 = Math.round(4 + hw);
        for (let z = z0; z <= z1; z++) { v.set(x, 0, z, [0.92, 0.92, 0.95]); v.set(x, 1, z, P); if (z === z0 || z === z1 || x === 0 || x > 8) v.set(x, 2, z, x > 8 ? A : P); }
      }
      v.box(8, 3, 2, 8, 3, 6, GLASS); helmet(v, 5, 2, 4, A); v.box(3, 2, 3, 3, 2, 5, DARK);
      v.box(0, 2, 3, 1, 4, 5, DARK); v.set(0, 4, 4, A); for (let x = 1; x < 9; x++) { v.set(x, 1, 1, [1, 1, 1]); v.set(x, 1, 7, [1, 1, 1]); }
    },
    dozer(v, P, A, r) {
      for (const z of [0, 1, 7, 8]) { v.box(1, 0, z, 12, 2, z, TIRE); v.clear(1, 0, z); v.clear(12, 0, z); }
      for (let x = 3; x <= 11; x += 4) { v.set(x, 1, 0, HUB); v.set(x, 1, 8, HUB); }
      v.box(2, 1, 2, 11, 2, 6, DARK); v.box(2, 3, 2, 11, 4, 6, P, 0, 0.05, r);
      v.box(3, 5, 2, 7, 7, 6, GLASS); v.box(2, 8, 1, 8, 8, 7, P); for (const [x, z] of [[3, 2], [7, 2], [3, 6], [7, 6]]) v.box(x, 5, z, x, 7, z, P);
      v.box(10, 5, 4, 10, 7, 4, DARK);
      v.box(12, 2, 1, 13, 2, 1, DARK); v.box(12, 2, 7, 13, 2, 7, DARK);
      v.box(14, 0, 0, 14, 4, 8, HUB); v.box(15, 0, 0, 15, 1, 8, HUB); v.box(14, 4, 0, 14, 4, 8, A);
      for (let z = 0; z <= 8; z += 2) v.set(14, 3, z, [0.1, 0.1, 0.1]);
    },
    roadster(v, P, A, r) {
      wheels(v, [3, 12]);
      v.box(0, 1, 1, 15, 2, 7, P, 0, 0.03, r);
      v.box(9, 3, 2, 14, 3, 6, P); v.box(0, 3, 2, 3, 3, 6, P); v.box(4, 3, 2, 8, 3, 6, DARK);
      v.set(5, 3, 3, A); v.set(5, 3, 5, A); v.set(4, 4, 3, A); v.set(4, 4, 5, A);
      v.box(9, 4, 2, 9, 4, 6, GLASS); helmet(v, 6, 3, 4, A);
      for (const x of [0, 1, 2, 3, 10, 11, 12, 13, 14]) v.set(x, 3, 4, A);
      v.set(15, 2, 2, HEAD, 1); v.set(15, 2, 6, HEAD, 1); v.set(0, 2, 2, TAIL, 1); v.set(0, 2, 6, TAIL, 1); v.box(15, 1, 3, 15, 1, 5, HUB);
    },
    proto(v, P, A, r) {
      wheels(v, [3, 12]);
      v.box(0, 1, 1, 15, 2, 7, P, 0, 0.03, r);
      for (const z of [0, 1, 7, 8]) { v.box(1, 3, z, 5, 3, z, P); v.box(10, 3, z, 14, 3, z, P); }
      v.box(6, 3, 3, 10, 3, 5, GLASS); v.box(7, 4, 3, 9, 4, 5, GLASS);
      v.box(1, 3, 4, 5, 5, 4, A); v.box(0, 5, 1, 1, 5, 7, A); v.box(0, 3, 2, 0, 4, 2, DARK); v.box(0, 3, 6, 0, 4, 6, DARK);
      for (let x = 11; x <= 15; x++) v.set(x, 2, 4, A);
      v.set(15, 2, 1, HEAD, 1); v.set(15, 2, 7, HEAD, 1); v.set(14, 3, 1, HEAD, 1); v.set(14, 3, 7, HEAD, 1); v.box(0, 2, 2, 0, 2, 6, TAIL, 1);
    },
    // ---------- the toy box: 30 wild ones ----------
    fin(v, P, A, r) { // shark
      wheels(v, [3, 12]);
      hull(v, P, r, (x) => (x < 2 ? 1 : x < 12 ? 3 : 3 - (x - 11) * 0.6), (x) => (x < 3 ? 2 : x < 11 ? 4 : Math.round(4 - (x - 10) * 0.45)));
      for (let x = 2; x <= 13; x++) for (let z = 2; z <= 6; z++) if (v.has(x, 1, z)) v.set(x, 1, z, [0.95, 0.95, 0.95]);
      v.box(6, 5, 4, 8, 5, 4, P); v.box(6, 6, 4, 7, 6, 4, P); v.set(6, 7, 4, P);
      v.box(0, 3, 4, 0, 6, 4, P); v.set(1, 3, 4, P); v.set(1, 4, 4, P);
      for (const z of [1, 7]) { v.set(12, 3, z, [1, 1, 1]); v.set(10, 3, z, DARK); v.set(10, 2, z, DARK); }
      for (let z = 2; z <= 6; z++) v.set(14, 1, z, z % 2 ? [1, 1, 1] : A);
    },
    rex(v, P, A, r) { // dinosaur
      wheels(v, [3, 11]);
      hull(v, P, r, (x) => (x < 3 ? 1 + x * 0.6 : 3), (x) => (x < 4 ? 2 : 4));
      v.box(11, 3, 2, 15, 5, 6, P, 0, 0.06, r); v.box(13, 1, 2, 15, 2, 6, P);
      for (const z of [2, 6]) { v.set(13, 5, z, [1, 0.9, 0.2], 1); for (let x = 13; x <= 15; x++) v.set(x, 2, z, x % 2 ? [1, 1, 1] : P); }
      for (let x = 2; x <= 12; x += 2) v.set(x, v.has(x, 5, 4) ? 6 : 5, 4, A);
      v.set(15, 3, 3, DARK); v.set(15, 3, 5, DARK); v.box(6, 2, 1, 7, 2, 1, A); v.box(6, 2, 7, 7, 2, 7, A);
    },
    rattler(v, P, A, r) { // bone car
      wheels(v, [3], true); wheels(v, [12]);
      v.box(1, 2, 4, 14, 2, 4, P);
      for (let x = 3; x <= 10; x += 2) { v.box(x, 1, 2, x, 3, 2, P); v.box(x, 1, 6, x, 3, 6, P); v.box(x, 3, 2, x, 3, 6, P); }
      v.box(12, 2, 2, 15, 4, 6, P, 0, 0.04, r); v.set(15, 3, 3, DARK); v.set(15, 3, 5, DARK); v.set(15, 2, 4, DARK);
      for (let z = 2; z <= 6; z++) v.set(15, 1, z, z % 2 ? P : DARK);
      v.box(5, 2, 3, 7, 2, 5, DARK); helmet(v, 6, 3, 4, A); v.box(1, 3, 3, 1, 5, 3, A); v.box(1, 3, 5, 1, 5, 5, A);
    },
    twin(v, P, A, r) { // two engines
      wheels(v, [3], true); wheels(v, [12]);
      v.box(0, 1, 1, 15, 2, 7, P, 0, 0.04, r);
      for (const z0 of [1, 5]) { v.box(9, 3, z0, 13, 4, z0 + 2, HUB); v.box(10, 5, z0, 12, 5, z0 + 2, DARK); v.set(11, 6, z0 + 1, A); }
      v.box(3, 3, 2, 7, 4, 6, GLASS); v.box(3, 5, 2, 7, 5, 6, P); v.box(4, 3, 3, 6, 4, 5, DARK); helmet(v, 5, 3, 4, A);
      for (let x = 0; x <= 8; x++) v.set(x, 2, 4, A);
      v.set(15, 2, 1, HEAD, 1); v.set(15, 2, 7, HEAD, 1); v.set(0, 2, 1, TAIL, 1); v.set(0, 2, 7, TAIL, 1);
    },
    hexa(v, P, A, r) { // six-wheeler
      wheels(v, [2, 7, 13]);
      v.box(0, 1, 1, 15, 3, 7, P, 0, 0.04, r);
      v.box(9, 4, 2, 14, 5, 6, GLASS); v.box(9, 6, 2, 14, 6, 6, P); v.box(10, 4, 3, 13, 5, 5, DARK); helmet(v, 11, 4, 4, A);
      v.box(1, 3, 2, 7, 3, 6, DARK); for (const z of [1, 7]) { v.box(3, 4, z, 3, 6, z, A); v.box(6, 4, z, 6, 6, z, A); }
      v.box(3, 6, 1, 3, 6, 7, A); v.box(6, 6, 1, 6, 6, 7, A); v.box(15, 1, 1, 15, 2, 7, HUB);
      v.set(15, 3, 1, HEAD, 1); v.set(15, 3, 7, HEAD, 1); v.set(0, 2, 1, TAIL, 1); v.set(0, 2, 7, TAIL, 1);
    },
    dome(v, P, A, r) { // bubble-top
      wheels(v, [3, 12]);
      v.box(0, 1, 1, 15, 2, 7, P, 0, 0.03, r); for (const [x, z] of [[0, 1], [0, 7], [15, 1], [15, 7]]) { v.clear(x, 1, z); v.clear(x, 2, z); }
      for (let x = 4; x <= 11; x++) for (let y = 3; y <= 6; y++) for (let z = 1; z <= 7; z++) if (Math.hypot(x - 7.5, (y - 2.5) * 1.1, z - 4) <= 3.9) v.set(x, y, z, GLASS);
      v.box(0, 3, 1, 2, 4, 1, A); v.box(0, 3, 7, 2, 4, 7, A); v.set(0, 5, 1, A); v.set(0, 5, 7, A);
      v.box(13, 2, 2, 15, 2, 6, A); v.set(15, 1, 2, HEAD, 1); v.set(15, 1, 6, HEAD, 1); v.set(0, 2, 3, TAIL, 1); v.set(0, 2, 5, TAIL, 1);
    },
    lowrider(v, P, A, r) {
      wheels(v, [3, 12]); for (const x of [3, 12]) for (const z of [0, 8]) v.set(x, 1, z, [1, 1, 1]);
      v.box(0, 1, 1, 15, 2, 7, P, 0, 0.03, r);
      v.box(5, 3, 2, 10, 3, 6, GLASS); v.box(5, 4, 2, 10, 4, 6, P);
      for (let x = 1; x <= 14; x++) { v.set(x, 2, 1, A); v.set(x, 2, 7, A); } for (let x = 11; x <= 14; x++) v.set(x, 2, 4, A);
      v.box(15, 1, 1, 15, 1, 7, HUB); v.box(0, 1, 1, 0, 1, 7, HUB);
      v.set(15, 2, 1, HEAD, 1); v.set(15, 2, 7, HEAD, 1); v.set(0, 2, 1, TAIL, 1); v.set(0, 2, 7, TAIL, 1);
    },
    woody(v, P, A, r) { // surf wagon
      wheels(v, [3, 12]);
      v.box(0, 1, 1, 15, 3, 7, P, 0, 0.03, r);
      for (const z of [1, 7]) v.box(2, 2, z, 12, 3, z, [0.6, 0.4, 0.2], 0, 0.15, r);
      v.box(3, 4, 1, 12, 5, 7, GLASS); v.box(3, 6, 1, 12, 6, 7, P); for (const x of [3, 7, 12]) for (const z of [1, 7]) v.box(x, 4, z, x, 5, z, P);
      v.box(2, 7, 3, 13, 7, 5, A); v.box(2, 7, 4, 13, 7, 4, [1, 1, 1]); v.clear(2, 7, 3); v.clear(2, 7, 5); v.clear(13, 7, 3); v.clear(13, 7, 5);
      v.set(15, 2, 1, HEAD, 1); v.set(15, 2, 7, HEAD, 1); v.set(0, 2, 1, TAIL, 1); v.set(0, 2, 7, TAIL, 1);
    },
    burger(v, P, A, r) {
      wheels(v, [4, 11]);
      const disc = (y, rad, c, j = 0.08) => { for (let x = 0; x < 16; x++) for (let z = 0; z < 9; z++) if (Math.hypot((x - 7.5) / 1.75, z - 4) <= rad) { const k = 1 + (r() - 0.5) * j; v.set(x, y, z, [c[0] * k, c[1] * k, c[2] * k]); } };
      disc(1, 4, P); disc(2, 4.2, P); disc(3, 4.3, [0.36, 0.2, 0.1], 0.2);
      for (let x = 0; x < 16; x++) for (let z = 0; z < 9; z++) { const d = Math.hypot((x - 7.5) / 1.75, z - 4); if (d <= 4.6 && d > 3.4) v.set(x, 4, z, (x + z) % 3 ? [0.3, 0.75, 0.25] : A); else if (d <= 3.4) v.set(x, 4, z, [0.85, 0.2, 0.15]); }
      disc(5, 4.2, P); disc(6, 3.6, P); disc(7, 2.6, P);
      for (let i = 0; i < 9; i++) { const x = 3 + Math.floor(r() * 10), z = 2 + Math.floor(r() * 5); v.set(x, v.has(x, 7, z) ? 7 : 6, z, [1, 0.97, 0.85]); }
    },
    hotdog(v, P, A, r) {
      wheels(v, [3, 12]);
      v.box(0, 1, 1, 15, 3, 7, P, 0, 0.06, r); v.box(0, 3, 3, 15, 3, 5, DARK); for (const [x, z] of [[0, 1], [0, 7], [15, 1], [15, 7]]) for (let y = 1; y <= 3; y++) v.clear(x, y, z);
      const s = [0.75, 0.25, 0.15];
      for (let x = 0; x < 16; x++) for (let y = 3; y <= 5; y++) for (let z = 3; z <= 5; z++) { if ((x === 0 || x === 15) && (y !== 4 || z !== 4)) continue; if (y === 5 && z !== 4 && (x < 1 || x > 14)) continue; v.set(x, y, z, s); }
      for (let x = 1; x <= 14; x++) v.set(x, 6, 3 + [1, 2, 1, 0][x % 4], A);
    },
    peel(v, P, A, r) { // banana
      wheels(v, [4, 11]);
      for (let x = 0; x < 16; x++) { const b = 1 + Math.round(Math.pow((x - 7.5) / 7.5, 2) * 3.2), w = x < 2 || x > 13 ? 1 : 2; for (let y = b; y <= b + 2; y++) for (let z = 4 - w; z <= 4 + w; z++) if (!(y === b + 2 && Math.abs(z - 4) === w)) v.set(x, y, z, x === 0 || x === 15 ? [0.3, 0.2, 0.1] : P); }
      v.box(7, 3, 3, 8, 3, 5, DARK); helmet(v, 7, 3, 4, A); for (let x = 3; x <= 12; x += 3) v.set(x, v.has(x, 4, 4) ? 4 : 3, 2, [0.5, 0.35, 0.1]);
    },
    kicks(v, P, A, r) { // sneaker
      wheels(v, [3, 12]);
      v.box(0, 1, 1, 15, 1, 7, [0.96, 0.96, 0.96]);
      v.box(0, 2, 1, 5, 5, 7, P, 0, 0.04, r); v.box(6, 2, 1, 11, 4, 7, P, 0, 0.04, r); v.box(12, 2, 1, 14, 3, 7, P); v.box(13, 2, 1, 15, 2, 7, [0.96, 0.96, 0.96]); v.box(14, 3, 2, 14, 3, 6, [0.96, 0.96, 0.96]);
      v.box(1, 5, 2, 4, 5, 6, DARK); helmet(v, 3, 5, 4, A);
      for (let x = 6; x <= 11; x++) { v.set(x, 5, 3 + (x % 2) * 2, [1, 1, 1]); v.set(x, 5, 4, [1, 1, 1]); }
      for (const z of [1, 7]) for (const [x, y] of [[8, 3], [7, 3], [9, 3], [8, 4], [8, 2]]) v.set(x, y, z, A);
      v.box(0, 2, 3, 0, 5, 5, A);
    },
    toasty(v, P, A, r) { // toaster
      wheels(v, [4, 11]);
      v.box(2, 1, 1, 13, 6, 7, P, 0, 0.03, r);
      for (const z0 of [2, 5]) { v.box(4, 6, z0, 11, 6, z0 + 1, [1, 0.45, 0.1], 0.8); v.box(5, 7, z0, 10, 8, z0 + 1, [0.85, 0.62, 0.35], 0, 0.1, r); v.box(5, 9, z0, 10, 9, z0 + 1, [0.55, 0.33, 0.15]); }
      v.box(14, 3, 4, 14, 4, 4, A); v.set(14, 2, 6, A); v.box(2, 1, 1, 13, 1, 7, DARK);
      v.set(13, 3, 1, HEAD, 1); v.set(13, 3, 7, HEAD, 1);
    },
    quack(v, P, A, r) { // rubber duck
      wheels(v, [4, 10], false, 1, 7);
      for (let x = 0; x <= 12; x++) for (let y = 1; y <= 6; y++) for (let z = 0; z <= 8; z++) if (Math.hypot((x - 6) / 1.5, (y - 3.2) / 0.8, (z - 4) / 1.05) <= 4) v.set(x, y, z, P);
      for (let x = 9; x <= 14; x++) for (let y = 5; y <= 9; y++) for (let z = 2; z <= 6; z++) if (Math.hypot(x - 11.5, y - 7, z - 4) <= 2.6) v.set(x, y, z, P);
      v.box(14, 6, 3, 15, 6, 5, A); v.set(13, 8, 2, DARK); v.set(13, 8, 6, DARK); v.box(0, 5, 3, 0, 6, 5, P); v.box(5, 3, 0, 8, 4, 0, A); v.box(5, 3, 8, 8, 4, 8, A);
    },
    deck(v, P, A, r) { // motorised skateboard
      wheels(v, [3, 12], false, 1, 7);
      v.box(1, 2, 2, 14, 2, 6, P); v.box(1, 3, 2, 14, 3, 6, DARK); v.box(0, 3, 2, 0, 4, 6, P); v.box(15, 3, 2, 15, 4, 6, P);
      for (let x = 2; x <= 13; x++) v.set(x, 3, 4, A); v.box(2, 1, 3, 4, 1, 5, HUB); v.box(11, 1, 3, 13, 1, 5, HUB);
      v.box(1, 4, 3, 3, 5, 5, HUB); v.set(1, 6, 3, DARK); v.set(1, 6, 5, DARK); v.box(7, 4, 3, 9, 4, 5, DARK); helmet(v, 8, 5, 4, A);
    },
    cheddar(v, P, A, r) { // cheese wedge
      wheels(v, [3, 12]);
      for (let x = 0; x < 16; x++) { const top = Math.round(7 - x * 0.36); for (let y = 1; y <= top; y++) for (let z = 1; z <= 7; z++) v.set(x, y, z, P); }
      const hole = U.shade(P, 0.7);
      for (const [x, y, z] of [[2, 5, 1], [3, 5, 1], [2, 4, 1], [7, 3, 1], [11, 2, 1], [5, 2, 1], [3, 4, 7], [4, 4, 7], [9, 3, 7], [12, 2, 7], [6, 2, 7], [4, 6, 3], [8, 4, 5], [11, 3, 3], [1, 7, 5]]) if (v.has(x, y, z)) v.set(x, y, z, hole);
      v.box(5, 6, 3, 6, 6, 5, DARK); helmet(v, 6, 5, 4, A); v.set(15, 1, 2, HEAD, 1); v.set(15, 1, 6, HEAD, 1);
    },
    stealth(v, P, A, r) {
      wheels(v, [3, 12]);
      v.box(0, 1, 1, 15, 2, 7, P); v.box(0, 1, 1, 15, 1, 1, A, 0.9); v.box(0, 1, 7, 15, 1, 7, A, 0.9);
      for (let x = 2; x <= 13; x++) { const w = Math.round(3 - Math.abs(x - 7) * 0.3); v.box(x, 3, 4 - w, x, 3, 4 + w, P); }
      for (let x = 5; x <= 10; x++) { const w = x === 5 || x === 10 ? 1 : 2; v.box(x, 4, 4 - w, x, 4, 4 + w, [0.25, 0.12, 0.38]); }
      v.box(0, 3, 0, 2, 3, 1, P); v.box(0, 3, 7, 2, 3, 8, P); v.box(15, 2, 3, 15, 2, 5, A, 1); v.box(0, 2, 2, 0, 2, 6, TAIL, 1);
    },
    coffin(v, P, A, r) {
      wheels(v, [3], true); wheels(v, [12]);
      hull(v, P, r, (x) => (x < 4 ? 2 + x * 0.4 : Math.max(2, 3.6 - (x - 4) * 0.15)), () => 3, 2);
      for (let x = 2; x <= 11; x++) v.set(x, 4, 4, A); v.box(8, 4, 2, 8, 4, 6, A);
      v.box(12, 4, 3, 14, 5, 5, HUB); v.set(13, 6, 3, DARK); v.set(13, 6, 5, DARK);
      for (const z of [1, 7]) { v.box(0, 4, z, 0, 5, z, DARK); v.set(0, 6, z, [1, 0.7, 0.2], 1); v.box(9, 2, z, 12, 2, z, HUB); }
      v.set(15, 3, 2, HEAD, 1); v.set(15, 3, 6, HEAD, 1);
    },
    sketch(v, P, A, r) { // pencil
      wheels(v, [3, 10], false, 1, 7);
      const oct = (x, c) => { for (let y = 1; y <= 5; y++) for (let z = 2; z <= 6; z++) if (!((y === 1 || y === 5) && (z === 2 || z === 6))) v.set(x, y, z, c); };
      for (let x = 2; x <= 11; x++) oct(x, P); oct(1, HUB); oct(0, [1, 0.56, 0.67]);
      for (let x = 12; x <= 14; x++) { const k = x - 11; for (let y = 1 + Math.ceil(k / 2); y <= 5 - Math.ceil(k / 2); y++) for (let z = 2 + Math.ceil(k / 2); z <= 6 - Math.ceil(k / 2); z++) v.set(x, y, z, [0.9, 0.76, 0.6]); }
      v.set(14, 3, 4, [0.9, 0.76, 0.6]); v.set(15, 3, 4, DARK);
      v.box(6, 5, 3, 7, 5, 5, DARK); helmet(v, 6, 5, 4, A); for (let x = 2; x <= 11; x++) v.set(x, 3, 2, A);
    },
    lunar(v, P, A, r) { // moon rover
      wheels(v, [2, 7, 13]);
      v.box(1, 2, 2, 14, 2, 6, HUB); v.box(4, 3, 2, 10, 4, 6, P, 0, 0.12, r);
      v.box(11, 3, 1, 14, 3, 7, [0.1, 0.2, 0.6]); for (let z = 1; z <= 7; z += 2) v.set(12, 3, z, [0.3, 0.45, 0.9]);
      v.box(3, 3, 4, 3, 6, 4, HUB); for (let x = 1; x <= 5; x++) for (let z = 2; z <= 6; z++) if (Math.hypot(x - 3, z - 4) <= 2.3) v.set(x, 7, z, [0.95, 0.95, 0.95]); v.set(3, 8, 4, A);
      v.box(9, 5, 4, 9, 7, 4, HUB); v.set(10, 7, 4, HEAD, 1); helmet(v, 6, 5, 4, [1, 1, 1]); v.set(7, 6, 4, [0.9, 0.7, 0.2]);
    },
    sub(v, P, A, r) { // submarine
      v.box(2, 0, 2, 13, 0, 6, DARK);
      for (let x = 0; x < 16; x++) { const rad = x < 3 ? 1.2 + x * 0.6 : x > 12 ? 3 - (x - 12) * 0.7 : 3; for (let y = 1; y <= 6; y++) for (let z = 1; z <= 7; z++) if (Math.hypot(y - 3.5, z - 4) <= rad + 0.2) v.set(x, y, z, P); }
      v.box(6, 7, 3, 9, 8, 5, P); v.box(8, 9, 4, 8, 9, 4, HUB); v.set(9, 9, 4, HUB);
      for (let x = 4; x <= 12; x += 3) { v.set(x, 4, 1, [1, 0.95, 0.6], 0.9); v.set(x, 4, 7, [1, 0.95, 0.6], 0.9); }
      for (let x = 1; x <= 14; x++) { if (v.has(x, 2, 1)) v.set(x, 2, 1, A); if (v.has(x, 2, 7)) v.set(x, 2, 7, A); }
      v.box(0, 2, 4, 0, 5, 4, A); v.box(0, 3, 2, 0, 3, 6, A);
    },
    wyrm(v, P, A, r) { // dragon
      wheels(v, [4, 11]);
      hull(v, P, r, (x) => (x < 4 ? 0.6 + x * 0.6 : 2.6), (x) => (x < 3 ? 2 + (2 - x) : 3));
      v.box(12, 3, 2, 15, 5, 6, P, 0, 0.06, r); v.box(14, 2, 2, 15, 2, 6, P);
      for (const z of [2, 6]) { v.set(13, 6, z, A); v.set(12, 7, z, A); v.set(14, 5, z, [1, 0.9, 0.2], 1); }
      v.box(15, 3, 4, 15, 3, 4, [1, 0.5, 0.1], 1);
      for (let x = 1; x <= 11; x += 2) v.set(x, v.has(x, 4, 4) ? 5 : 4, 4, A);
      for (const z of [0, 8]) for (let x = 5; x <= 9; x++) v.box(x, 4, z, x, 4 + Math.max(0, 2 - Math.abs(x - 6)), z, A);
      for (const z of [1, 7]) v.box(5, 4, z, 8, 4, z, A);
    },
    stinger(v, P, A, r) { // scorpion
      wheels(v, [3, 11]);
      for (let x = 1; x <= 13; x++) v.box(x, 1, 2, x, x % 3 === 0 ? 2 : 3, 6, P, 0, 0.05, r);
      for (const z0 of [0, 7]) { v.box(13, 1, z0, 15, 2, z0 + 1, P); v.set(15, 2, z0 === 0 ? 1 : 7, A); }
      v.set(14, 3, 3, [1, 0.15, 0.1], 1); v.set(14, 3, 5, [1, 0.15, 0.1], 1); v.box(13, 2, 3, 14, 2, 5, P);
      v.box(0, 2, 4, 0, 7, 4, P); v.set(1, 8, 4, P); v.box(2, 9, 4, 4, 9, 4, P); v.set(5, 8, 4, P); v.set(6, 7, 4, A, 1); v.set(6, 6, 4, A, 1);
    },
    fanboat(v, P, A, r) {
      v.box(0, 0, 1, 13, 1, 7, P, 0, 0.05, r); v.box(14, 0, 2, 14, 1, 6, P); v.box(15, 1, 3, 15, 1, 5, P); v.box(0, 0, 1, 13, 0, 7, DARK); v.box(14, 0, 2, 14, 0, 6, DARK);
      v.box(6, 2, 3, 7, 4, 5, DARK); helmet(v, 7, 5, 4, A); v.box(3, 2, 3, 4, 3, 5, HUB);
      for (let y = 2; y <= 9; y++) for (let z = 0; z <= 8; z++) { const d = Math.hypot(y - 5.5, z - 4); if (Math.abs(d - 3.6) < 0.7) v.set(1, y, z, HUB); else if (d < 3 && (y === 5 || y === 6 || z === 4)) v.set(1, y, z, A); }
      v.box(0, 2, 4, 0, 8, 4, A); for (let x = 2; x <= 12; x++) v.set(x, 1, 4, A);
    },
    afterburner(v, P, A, r) { // jet fighter
      wheels(v, [4, 11], false, 2, 6);
      v.box(2, 1, 3, 13, 3, 5, P, 0, 0.03, r); v.box(14, 2, 4, 15, 2, 4, P); v.box(14, 1, 3, 14, 2, 5, P);
      for (let x = 2; x <= 9; x++) { const w = Math.min(4, Math.round((10 - x) * 0.7)); v.box(x, 2, 4 - w, x, 2, 4 + w, P); }
      for (const z of [2, 6]) { v.box(0, 4, z, 2, 5, z, A); v.box(0, 6, z, 1, 6, z, A); }
      v.box(9, 4, 4, 11, 4, 4, GLASS); v.set(10, 5, 4, GLASS); v.box(0, 2, 3, 1, 3, 5, [1, 0.5, 0.1], 1);
      for (let x = 3; x <= 7; x++) { v.set(x, 2, 0 + Math.max(0, x - 6), A); v.set(x, 2, 8 - Math.max(0, x - 6), A); }
    },
    tubby(v, P, A, r) { // bathtub
      wheels(v, [3, 12]); for (const x of [3, 12]) for (const z of [0, 8]) v.set(x, 1, z, [1, 0.8, 0.3]);
      v.box(1, 1, 1, 14, 4, 7, P, 0, 0.02, r); for (const [x, z] of [[1, 1], [1, 7], [14, 1], [14, 7]]) for (let y = 1; y <= 4; y++) v.clear(x, y, z);
      for (let x = 2; x <= 13; x++) for (let z = 2; z <= 6; z++) { v.set(x, 4, z, [0.45, 0.75, 1]); if (r() < 0.3) v.set(x, 5, z, [1, 1, 1]); }
      helmet(v, 6, 5, 4, A); v.set(10, 5, 3, [1, 0.85, 0.2]); v.set(11, 5, 3, [1, 0.5, 0.1]);
      v.box(14, 5, 4, 14, 6, 4, HUB); v.set(13, 6, 4, HUB); v.box(1, 4, 2, 1, 4, 6, A); v.box(14, 4, 2, 14, 4, 6, A);
    },
    cupcake(v, P, A, r) {
      wheels(v, [5, 10]);
      const ring = (y, rad, col) => { for (let x = 2; x <= 13; x++) for (let z = 0; z <= 8; z++) if (Math.hypot((x - 7.5) / 1.25, z - 4) <= rad) v.set(x, y, z, col(x, z)); };
      for (let y = 1; y <= 3; y++) ring(y, 3.6 + y * 0.25, (x) => (x % 2 ? A : [1, 1, 1]));
      const sp = [[1, 0.3, 0.4], [0.3, 0.7, 1], [1, 0.85, 0.2], [0.4, 0.9, 0.4]];
      [4.6, 4.2, 3.4, 2.4, 1.3].forEach((rad, i) => ring(4 + i, rad, () => (r() < 0.12 ? sp[Math.floor(r() * 4)] : P)));
      v.set(7, 9, 4, [0.9, 0.1, 0.2], 0.3); v.set(8, 9, 4, [0.9, 0.1, 0.2], 0.3);
    },
    bigrig(v, P, A, r) { // semi cab
      wheels(v, [2, 5, 12], true);
      v.box(0, 2, 2, 15, 2, 6, DARK); v.box(1, 3, 2, 5, 3, 6, HUB);
      v.box(8, 3, 1, 15, 7, 7, P, 0, 0.03, r); v.box(15, 5, 2, 15, 6, 6, GLASS); v.box(13, 5, 1, 14, 6, 1, GLASS); v.box(13, 5, 7, 14, 6, 7, GLASS);
      v.box(8, 8, 2, 12, 8, 6, A); for (const z of [1, 7]) { v.box(7, 3, z, 7, 9, z, HUB); v.box(8, 4, z, 12, 4, z, A); }
      v.box(15, 2, 1, 15, 3, 7, HUB); v.set(15, 4, 1, HEAD, 1); v.set(15, 4, 7, HEAD, 1); for (let z = 2; z <= 6; z += 2) v.set(14, 8, z, [1, 0.6, 0.1], 1);
    },
    tailfin(v, P, A, r) { // fifties cruiser
      wheels(v, [3, 12]); for (const x of [3, 12]) for (const z of [0, 8]) v.set(x, 1, z, [1, 1, 1]);
      v.box(0, 1, 1, 15, 3, 7, P, 0, 0.03, r);
      for (const z of [1, 7]) { v.box(0, 4, z, 3, 4, z, P); v.box(0, 5, z, 1, 5, z, P); v.set(0, 4, z, TAIL, 1); v.box(2, 2, z, 14, 2, z, HUB); }
      v.box(5, 4, 2, 10, 4, 6, GLASS); v.box(5, 5, 2, 10, 5, 6, A); v.box(6, 4, 3, 9, 4, 5, DARK); helmet(v, 8, 4, 4, A);
      v.box(15, 1, 1, 15, 2, 7, HUB); v.set(15, 3, 1, HEAD, 1); v.set(15, 3, 7, HEAD, 1); v.box(0, 1, 1, 0, 1, 7, HUB);
    },
    trike(v, P, A, r) { // chopper trike
      wheels(v, [3], true);
      for (let x = 13; x <= 15; x++) for (let y = 0; y <= 2; y++) if (!((x !== 14) && (y === 0 || y === 2) && false)) v.set(x, y, 4, TIRE); v.set(14, 1, 4, HUB);
      v.box(2, 2, 3, 10, 2, 5, P, 0, 0.04, r); v.box(6, 3, 3, 8, 4, 5, HUB); v.box(9, 3, 4, 10, 4, 4, P); v.box(3, 3, 3, 5, 3, 5, DARK);
      for (let i = 0; i < 4; i++) v.set(13 - i, 3 + i, 4, HUB); v.box(10, 7, 2, 10, 7, 6, A); v.set(14, 3, 4, HEAD, 1);
      helmet(v, 4, 4, 4, A); v.box(2, 3, 4, 2, 7, 4, HUB); v.box(1, 2, 2, 6, 2, 2, A); v.box(1, 2, 6, 6, 2, 6, A); v.box(9, 5, 4, 9, 5, 4, A);
    },
    cart(v, P, A, r) { // a shopping cart
      wheels(v, [2, 13], false, 1, 7);            // small wheels, tucked in
      v.box(1, 1, 2, 14, 1, 6, HUB);               // the chassis rails
      // the basket: open wire walls in the body colour
      for (let x = 2; x <= 14; x++) for (let y = 2; y <= 6; y++) {
        if ((x + y) % 2) continue;                 // every other block: a wire grid
        v.set(x, y, 1, P); v.set(x, y, 7, P);       // the two sides
      }
      for (let y = 2; y <= 6; y++) for (let z = 1; z <= 7; z++) if ((y + z) % 2 === 0) v.set(14, y, z, P);   // the front wall
      v.box(2, 2, 2, 13, 2, 6, P, 0, 0.05, r);     // the basket floor
      v.box(0, 6, 1, 1, 6, 7, A);                  // the handle, in the accent colour
      v.set(0, 5, 1, HUB); v.set(0, 5, 7, HUB);
      helmet(v, 7, 3, 4, A);                       // the driver, sitting in the basket
      v.set(14, 3, 2, HEAD, 1); v.set(14, 3, 6, HEAD, 1);   // headlights
    },
    hover(v, P, A, r) {
      v.box(1, 0, 0, 14, 0, 8, DARK); v.clear(1, 0, 0); v.clear(14, 0, 0); v.clear(1, 0, 8); v.clear(14, 0, 8);
      v.box(1, 1, 1, 14, 2, 7, P, 0, 0.06, r);
      v.box(5, 3, 2, 11, 4, 6, GLASS); v.box(6, 3, 3, 10, 3, 5, DARK); helmet(v, 8, 3, 4, A);
      v.box(0, 2, 2, 1, 4, 6, HUB); v.box(0, 3, 3, 0, 3, 5, [0.3, 0.95, 1], 1);
      v.box(2, 3, 1, 3, 5, 1, A); v.box(2, 3, 7, 3, 5, 7, A);
      v.set(14, 2, 2, HEAD, 1); v.set(14, 2, 6, HEAD, 1);
      for (let x = 2; x <= 13; x++) v.set(x, 0, 4, [0.3, 0.9, 1], 0.6);
    },
  };

  CR.carMesh = function (type, paint, accent) {
    const v = new Vox(16, 10, 9);
    const r = U.rng(type.length * 977 + 13);
    CAR_BUILD[type](v, hex(paint), hex(accent), r);
    return G.mesh(v, CAR_VS, 8, 0, 4.5);
  };
  CR.CAR_VS = CAR_VS;
  CR.carVox = function (type, paint, accent) { const v = new Vox(16, 10, 9); CAR_BUILD[type](v, hex(paint), hex(accent), U.rng(type.length * 977 + 13)); return v; };
  // Pixel-art isometric picture of a voxel model, for menus. s = pixels per voxel edge.
  CR.voxIcon = function (v, s = 4, canvas) {
    const c = canvas || document.createElement('canvas');
    const W = (v.sx + v.sz) * s + 4, H = ((v.sx + v.sz) * s) / 2 + v.sy * s + 6;
    c.width = W; c.height = H;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    const ox = v.sz * s + 2, oy = v.sy * s + 2;
    const col = (r, g, b, k) => `rgb(${Math.min(255, r * k * 255) | 0},${Math.min(255, g * k * 255) | 0},${Math.min(255, b * k * 255) | 0})`;
    // shadow
    x.fillStyle = 'rgba(0,0,0,0.28)';
    x.beginPath(); x.ellipse(ox + (v.sx - v.sz) * s / 2, oy + (v.sx + v.sz) * s / 4 + s, (v.sx + v.sz) * s / 2.1, (v.sx + v.sz) * s / 4.6, 0, 0, 6.28); x.fill();
    for (let key = 0; key < v.sx + v.sz + v.sy; key++) for (let y = 0; y < v.sy; y++) for (let X = 0; X < v.sx; X++) {
      const Z = v.sz - 1 - (key - y - X); // painter's order: far corner first
      if (Z < 0 || Z >= v.sz || !v.has(X, y, Z)) continue;
      const i = v.i(X, y, Z), r = v.d[i * 4], g = v.d[i * 4 + 1], b = v.d[i * 4 + 2], e = v.d[i * 4 + 3];
      const px = ox + (X - (v.sz - 1 - Z)) * s, py = oy + (X + (v.sz - 1 - Z)) * s / 2 - y * s;
      const lift = e > 0 ? 1.25 : 1;
      if (!v.has(X, y + 1, Z)) { x.fillStyle = col(r, g, b, 1.12 * lift); x.beginPath(); x.moveTo(px, py); x.lineTo(px + s, py - s / 2); x.lineTo(px + 2 * s, py); x.lineTo(px + s, py + s / 2); x.fill(); }
      if (!v.has(X, y, Z - 1)) { x.fillStyle = col(r, g, b, 0.78 * lift); x.beginPath(); x.moveTo(px, py); x.lineTo(px + s, py + s / 2); x.lineTo(px + s, py + s * 1.5); x.lineTo(px, py + s); x.fill(); }
      if (!v.has(X + 1, y, Z)) { x.fillStyle = col(r, g, b, 0.95 * lift); x.beginPath(); x.moveTo(px + s, py + s / 2); x.lineTo(px + 2 * s, py); x.lineTo(px + 2 * s, py + s); x.lineTo(px + s, py + s * 1.5); x.fill(); }
    }
    return c;
  };

  // The floating cursor that marks the player's car (a nod to Cursor Bots)
  CR.cursorMesh = function (accent) {
    const map = [
      'X.......',
      'XX......',
      'XWX.....',
      'XWWX....',
      'XWWWX...',
      'XWWWWX..',
      'XWWWWWX.',
      'XWWWWWWX',
      'XWWWXXXX',
      'XWXWX...',
      'XX.XWX..',
      'X...XX..',
    ];
    const v = new Vox(8, 12, 2), A = hex(accent);
    map.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const ch = row[i]; if (ch === '.') continue; for (let z = 0; z < 2; z++) v.set(i, 11 - j, z, ch === 'W' ? [1, 1, 1] : A, ch === 'W' ? 0.35 : 1); } });
    return G.mesh(v, 2.3, 4, 0, 1);
  };

  // ---------------------------------------------------------------------------
  // Voxel helpers for props
  // ---------------------------------------------------------------------------
  function cyl(v, cx, cz, r, y0, y1, colFn, r0 = -1) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++) {
      const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
      if (d > r || d < r0) continue;
      for (let y = y0; y <= y1; y++) { const c = colFn(x, y, z, d); if (c) v.set(x, y, z, c, c[3] || 0); }
    }
  }
  function sphere(v, cx, cy, cz, r, colFn) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, dz = z + 0.5 - cz;
      if (dx * dx + dy * dy + dz * dz > r * r) continue;
      const c = colFn(dx, dy, dz); if (c) v.set(x, y, z, c, c[3] || 0);
    }
  }
  const jit = (c, r, k = 0.08) => { const m = 1 + (r() - 0.5) * k; return [c[0] * m, c[1] * m, c[2] * m, c[3] || 0]; };

  // Each prop: build(rng, opt) -> { vox, vs, col }  col = collider {c: radius} or {w, d} (half sizes, world units), h = height
  const P = {};
  P.loop = (r, o) => { // cereal loop
    const cols = ['#ff9a3c', '#ffd23f', '#ff4d5e', '#b46bff', '#5fd35f', '#ff7ab8'];
    const c = hex(o.color || cols[Math.floor(r() * cols.length)]);
    const v = new Vox(7, 2, 7);
    cyl(v, 3.5, 3.5, 3.5, 0, 1, () => jit(c, r, 0.2), 1.6);
    return { vox: v, vs: 2.4, col: { c: 7.5 }, h: 5 };
  };
  P.bowl = (r) => {
    const v = new Vox(26, 9, 26), c = hex('#4a8fd9'), w = hex('#f4f1e8');
    cyl(v, 13, 13, 13, 0, 8, (x, y, z, d) => (d > 11.2 || y === 0 || (y < 2 && d < 8)) ? (y === 8 || d > 12.4 ? jit(c, r) : jit(c, r, 0.04).map((q, i) => i < 3 ? q * 0.85 : q)) : null);
    cyl(v, 13, 13, 11.3, 7, 7, () => jit(w, r, 0.03));
    const loops = ['#ff9a3c', '#ffd23f', '#ff4d5e', '#b46bff'];
    for (let i = 0; i < 16; i++) { const a = r() * 6.28, d = r() * 8.5; v.set(13 + Math.cos(a) * d, 8, 13 + Math.sin(a) * d, hex(loops[i % 4])); }
    for (let a = 0; a < 6.28; a += 0.3) v.set(13 + Math.cos(a) * 12.5, 4, 13 + Math.sin(a) * 12.5, [1, 1, 1]);
    return { vox: v, vs: 4, col: { c: 50 }, h: 36 };
  };
  P.glass = (r) => {
    const v = new Vox(12, 22, 12), g = [0.72, 0.88, 0.95], j = hex('#ffa62b');
    cyl(v, 6, 6, 6, 0, 21, (x, y, z, d) => d > 5 ? jit(g, r, 0.05) : (y < 15 ? jit(j, r, 0.06) : null));
    return { vox: v, vs: 3, col: { c: 18 }, h: 66 };
  };
  P.spoon = (r) => {
    const v = new Vox(40, 2, 10), s = [0.78, 0.8, 0.86];
    for (let x = 0; x < 28; x++) v.box(x, 0, 4, x, 0, 5, jit(s, r));
    for (let x = 27; x < 40; x++) for (let z = 0; z < 10; z++) { const dx = (x - 33.5) / 6.5, dz = (z - 4.5) / 5; if (dx * dx + dz * dz <= 1) v.set(x, dx * dx + dz * dz > 0.6 ? 1 : 0, z, jit(s, r, 0.15)); }
    return { vox: v, vs: 3, col: null, h: 4 };
  };
  P.toast = (r) => {
    const v = new Vox(16, 2, 16), cr = hex('#b06a2c'), in_ = hex('#e9b872');
    v.box(0, 0, 0, 15, 1, 15, cr, 0, 0.1, r); v.box(1, 1, 1, 14, 1, 14, in_, 0, 0.12, r);
    v.box(4, 2, 5, 9, 2, 9, hex('#ffe27a')); // butter (out of grid, clipped)
    return { vox: v, vs: 3.4, col: { w: 27, d: 27 }, h: 7 };
  };
  P.book = (r, o) => {
    const w = o.w || 34, d = o.d || 24, h = o.h || 6;
    const cols = ['#c0392b', '#2e6fbf', '#27ae60', '#8e44ad', '#d68910', '#16a085', '#34495e'];
    const c = hex(o.color || cols[Math.floor(r() * cols.length)]), pg = hex('#f2ead8');
    const v = new Vox(w, h, d);
    v.box(0, 0, 0, w - 1, h - 1, d - 1, pg, 0, 0.05, r);
    v.box(0, 0, 0, w - 1, 0, d - 1, c, 0, 0.06, r); v.box(0, h - 1, 0, w - 1, h - 1, d - 1, c, 0, 0.06, r);
    v.box(0, 0, 0, 0, h - 1, d - 1, c, 0, 0.06, r);
    for (let x = 3; x < w - 3; x += 7) v.box(x, h - 1, 2, x + 2, h - 1, d - 3, U.shade(c, 1.25));
    return { vox: v, vs: 3, col: { w: w * 1.5, d: d * 1.5 }, h: h * 3 };
  };
  P.pencil = (r, o) => {
    const L = o.len || 44, cols = ['#ffcc33', '#ff6b6b', '#4dabf7', '#69db7c'];
    const c = hex(o.color || cols[Math.floor(r() * cols.length)]);
    const v = new Vox(L, 3, 3);
    v.box(0, 0, 0, L - 6, 2, 2, c, 0, 0.08, r);
    v.box(0, 0, 0, 2, 2, 2, hex('#ff8fab')); v.box(3, 0, 0, 3, 2, 2, [0.75, 0.76, 0.8]);
    v.box(L - 5, 0, 0, L - 3, 2, 2, hex('#e8c39e')); v.box(L - 2, 1, 1, L - 1, 1, 1, [0.2, 0.2, 0.22]);
    v.clear(L - 3, 0, 0); v.clear(L - 3, 2, 2); v.clear(L - 3, 0, 2); v.clear(L - 3, 2, 0);
    return { vox: v, vs: 3, col: { w: L * 1.5, d: 4.5 }, h: 9 };
  };
  P.eraser = (r) => {
    const v = new Vox(10, 4, 6); v.box(0, 0, 0, 9, 3, 5, hex('#ff8fab'), 0, 0.06, r); v.box(0, 0, 0, 3, 3, 5, hex('#4dabf7'), 0, 0.06, r);
    return { vox: v, vs: 3, col: { w: 15, d: 9 }, h: 12 };
  };
  P.mugpens = (r) => {
    const v = new Vox(14, 30, 14), c = hex('#2b2d42');
    cyl(v, 7, 7, 7, 0, 17, (x, y, z, d) => d > 5.8 || y === 0 ? jit(c, r) : null);
    const pc = ['#ffcc33', '#ff6b6b', '#4dabf7', '#69db7c', '#e8590c'];
    for (let i = 0; i < 6; i++) { const a = i * 1.05, x = 7 + Math.cos(a) * 3, z = 7 + Math.sin(a) * 3; for (let y = 4; y < 22 + i * 1.3; y++) v.set(x, y, z, hex(pc[i % 5])); }
    return { vox: v, vs: 3, col: { c: 21 }, h: 60 };
  };
  P.clip = (r) => {
    const v = new Vox(14, 1, 6), s = [0.7, 0.72, 0.78];
    for (let x = 0; x < 14; x++) { v.set(x, 0, 0, s); v.set(x, 0, 5, s); }
    for (let z = 0; z < 6; z++) { v.set(0, 0, z, s); v.set(13, 0, z, s); }
    for (let x = 3; x < 13; x++) v.set(x, 0, 2, s);
    return { vox: v, vs: 1.6, col: null, h: 2 };
  };
  P.pebble = (r, o) => {
    const s = o.s || 3 + r() * 3, v = new Vox(Math.ceil(s * 2) + 2, Math.ceil(s * 1.4) + 1, Math.ceil(s * 2) + 2);
    const base = [[0.55, 0.53, 0.5], [0.45, 0.4, 0.36], [0.62, 0.6, 0.58], [0.4, 0.42, 0.45]][Math.floor(r() * 4)];
    sphere(v, v.sx / 2, 0, v.sz / 2, s, (dx, dy) => dy < -0.2 ? null : jit(base, r, 0.18));
    return { vox: v, vs: 2.6, col: { c: s * 2.4 }, h: s * 3 };
  };
  P.bucket = (r) => {
    const v = new Vox(16, 18, 16), c = hex('#e8590c');
    cyl(v, 8, 8, 8, 0, 15, (x, y, z, d) => d > 6.8 ? jit(c, r) : (y < 12 ? jit(hex('#e3c58b'), r, 0.15) : null));
    cyl(v, 8, 8, 8.5, 15, 16, () => jit(hex('#ffd43b'), r));
    return { vox: v, vs: 3, col: { c: 25 }, h: 50 };
  };
  P.shovel = (r) => {
    const v = new Vox(34, 2, 10), c = hex('#1c7ed6');
    for (let x = 0; x < 22; x++) v.box(x, 0, 4, x, 1, 5, c);
    v.box(22, 0, 0, 33, 0, 9, c, 0, 0.08, r); v.box(22, 1, 0, 33, 1, 0, c); v.box(22, 1, 9, 33, 1, 9, c);
    v.box(0, 0, 2, 2, 1, 7, c);
    return { vox: v, vs: 3, col: null, h: 5 };
  };
  P.castle = (r) => {
    const v = new Vox(20, 16, 20), s = hex('#e3c58b');
    v.box(2, 0, 2, 17, 6, 17, s, 0, 0.12, r);
    for (const [x, z] of [[2, 2], [14, 2], [2, 14], [14, 14]]) { v.box(x, 0, z, x + 3, 11, z + 3, s, 0, 0.12, r); for (let i = 0; i < 4; i += 2) { v.set(x + i, 12, z, s); v.set(x + i, 12, z + 3, s); } }
    v.box(7, 6, 7, 12, 13, 12, s, 0, 0.1, r); v.set(9, 14, 9, [0.5, 0.35, 0.2]); v.set(9, 15, 9, hex('#ff4d5e')); v.set(10, 15, 9, hex('#ff4d5e'));
    v.box(9, 0, 1, 10, 3, 1, [0.35, 0.25, 0.15]);
    return { vox: v, vs: 3.2, col: { c: 30 }, h: 50 };
  };
  P.ball = (r, o) => { // pool ball (dynamic)
    const c = hex(o.color || '#ffd43b'), wh = [0.95, 0.95, 0.92], stripe = !!o.stripe;
    const v = new Vox(9, 9, 9);
    sphere(v, 4.5, 4.5, 4.5, 4.5, (dx, dy, dz) => {
      if (Math.hypot(dx, dz - 3.8) < 1.6 && dy > -1 && dy < 2) return wh;
      if (stripe && Math.abs(dy) > 2) return wh;
      return c;
    });
    return { vox: v, vs: 2.4, col: { c: 10.8 }, h: 21 };
  };
  P.chalk = () => { const v = new Vox(4, 4, 4); v.box(0, 0, 0, 3, 3, 3, hex('#4dabf7')); v.box(1, 3, 1, 2, 3, 2, hex('#1864ab')); return { vox: v, vs: 3, col: { w: 6, d: 6 }, h: 12 }; };
  P.cue = (r) => {
    const v = new Vox(120, 2, 2);
    for (let x = 0; x < 120; x++) { const c = x < 40 ? hex('#5c2e0e') : x > 116 ? hex('#4dabf7') : x > 112 ? [0.95, 0.95, 0.9] : hex('#d9a066'); v.box(x, 0, 0, x, 1, 1, jit(c, r, 0.06)); }
    return { vox: v, vs: 2.6, col: { w: 156, d: 3 }, h: 6 };
  };
  P.duck = (r) => {
    const v = new Vox(16, 16, 12), y = hex('#ffd43b'), o = hex('#ff922b');
    sphere(v, 7, 4, 6, 6, (dx, dy) => dy < -3.5 ? null : jit(y, r, 0.05));
    sphere(v, 11, 10, 6, 3.6, () => jit(y, r, 0.05));
    v.box(14, 9, 5, 15, 10, 7, o); v.set(12, 11, 4, [0.05, 0.05, 0.05]); v.set(12, 11, 8, [0.05, 0.05, 0.05]);
    v.box(1, 6, 5, 2, 8, 7, y);
    return { vox: v, vs: 2.6, col: { c: 18 }, h: 36 };
  };
  P.soap = (r) => { const v = new Vox(12, 4, 8); v.box(0, 0, 0, 11, 3, 7, hex('#ffc9de'), 0, 0.04, r); v.box(2, 3, 2, 9, 3, 5, [1, 0.88, 0.94]); return { vox: v, vs: 3, col: { w: 18, d: 12 }, h: 12 }; };
  P.sponge = (r) => {
    const v = new Vox(14, 6, 9); v.box(0, 0, 0, 13, 4, 8, hex('#ffe066'), 0, 0.1, r); v.box(0, 5, 0, 13, 5, 8, hex('#40c057'), 0, 0.1, r);
    for (let i = 0; i < 10; i++) v.clear(1 + Math.floor(r() * 12), 1 + Math.floor(r() * 4), r() < 0.5 ? 0 : 8);
    return { vox: v, vs: 3, col: { w: 21, d: 13.5 }, h: 18 };
  };
  P.bottle = (r) => {
    const v = new Vox(10, 26, 10), c = hex(['#5c7cfa', '#e64980', '#20c997'][Math.floor(r() * 3)]);
    cyl(v, 5, 5, 5, 0, 18, () => jit(c, r, 0.05)); cyl(v, 5, 5, 2.2, 19, 23, () => [0.95, 0.95, 0.95]);
    v.box(3, 8, 0, 6, 13, 0, [1, 1, 1]);
    return { vox: v, vs: 3, col: { c: 15 }, h: 70 };
  };
  P.toothbrush = (r) => {
    const v = new Vox(40, 3, 3), c = hex('#4dabf7');
    v.box(0, 0, 0, 30, 1, 2, c); v.box(31, 0, 0, 39, 0, 2, c); v.box(31, 1, 0, 38, 2, 2, [0.95, 0.95, 1]); v.box(31, 1, 1, 38, 2, 1, hex('#74c0fc'));
    return { vox: v, vs: 2.6, col: null, h: 6 };
  };
  P.block = (r, o) => {
    const cols = ['#ff6b6b', '#4dabf7', '#ffd43b', '#69db7c', '#da77f2', '#ff922b'];
    const c = hex(o.color || cols[Math.floor(r() * cols.length)]), n = 8;
    const v = new Vox(n, n, n);
    v.box(0, 0, 0, n - 1, n - 1, n - 1, c, 0, 0.05, r);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i === 0 || j === 0 || i === n - 1 || j === n - 1) { v.set(i, n - 1, j, U.shade(c, 1.25)); }
    const L = [[2, 5], [3, 5], [4, 5], [2, 4], [4, 4], [2, 3], [3, 3], [4, 3], [2, 2], [4, 2]];
    for (const [a, b] of L) v.set(a + 0.5, n - 1, b, [1, 1, 1]);
    return { vox: v, vs: 3.5, col: { w: 14, d: 14 }, h: 28 };
  };
  P.marble = (r) => {
    const c = hex(['#74c0fc', '#ff8787', '#b2f2bb', '#ffe066'][Math.floor(r() * 4)]);
    const v = new Vox(6, 6, 6); sphere(v, 3, 3, 3, 3, (dx, dy) => [c[0], c[1], c[2], dy > 1 ? 0.6 : 0.25]);
    return { vox: v, vs: 2.4, col: { c: 7 }, h: 14 };
  };
  P.glow = (r, o) => {
    const c = hex(o.color || ['#ff4dd8', '#3ff0ff', '#7cff4d', '#ffe14d'][Math.floor(r() * 4)]);
    const v = new Vox(20, 2, 2); v.box(1, 0, 0, 18, 1, 1, c, 1); v.box(0, 0, 0, 0, 1, 1, [0.9, 0.9, 0.9]); v.box(19, 0, 0, 19, 1, 1, [0.9, 0.9, 0.9]);
    return { vox: v, vs: 2.4, col: { w: 24, d: 3 }, h: 5, light: c };
  };
  P.lamp = (r) => {
    const v = new Vox(12, 34, 12), b = hex('#3b3b58'), l = hex('#ff6bcb');
    cyl(v, 6, 6, 6, 0, 5, () => jit(b, r, 0.06)); cyl(v, 6, 6, 4.6, 6, 26, (x, y, z, d) => (y % 7 < 3 && d < 2.5) ? [1, 0.9, 0.3, 1] : [l[0], l[1], l[2], 0.85]);
    cyl(v, 6, 6, 3, 27, 30, () => jit(b, r, 0.06));
    return { vox: v, vs: 3, col: { c: 18 }, h: 90, light: l, lightY: 50 };
  };
  P.robot = (r) => { // a toy robot
    const v = new Vox(10, 16, 10), m = [0.6, 0.65, 0.72], a = hex('#3ff0ff');
    v.box(2, 0, 2, 3, 4, 3, m); v.box(6, 0, 2, 7, 4, 3, m); v.box(1, 5, 1, 8, 10, 8, m, 0, 0.06, r);
    v.box(2, 11, 2, 7, 14, 7, m); v.set(3, 13, 1.5, a, 1); v.set(6, 13, 1.5, a, 1); v.set(4, 15, 4, a, 1);
    v.box(0, 6, 4, 0, 10, 5, m); v.box(9, 6, 4, 9, 10, 5, m); v.box(3, 7, 0, 6, 8, 0, a, 0.8);
    return { vox: v, vs: 3, col: { c: 15 }, h: 48 };
  };
  P.cone = (r) => {
    const v = new Vox(7, 9, 7), o = hex('#ff6b1a');
    v.box(0, 0, 0, 6, 0, 6, o);
    for (let y = 1; y < 9; y++) cyl(v, 3.5, 3.5, 3.3 - y * 0.33, y, y, () => (y === 4 || y === 5) ? [1, 1, 1] : o);
    return { vox: v, vs: 2.4, col: { c: 7 }, h: 22 };
  };
  P.ramp = (r, o) => { // wedge, x = up-slope direction
    const L = o.len || 24, W = o.wid || 20, H = o.hgt || 5, c = hex(o.color || '#c0392b'), s = hex(o.stripe || '#ffd43b');
    const v = new Vox(L, H + 1, W);
    for (let x = 0; x < L; x++) { const top = Math.round((x + 1) / L * H); for (let y = 0; y <= top; y++) for (let z = 0; z < W; z++) v.set(x, y, z, (y === top && (Math.floor(z / 3) % 2 === 0) && x > L - 4) ? s : jit(c, r, 0.06)); }
    return { vox: v, vs: o.vs || 3, col: null, h: H * (o.vs || 3) };
  };
  P.post = (r, o) => { // start gantry post
    const v = new Vox(3, 26, 3); v.box(0, 0, 0, 2, 25, 2, hex(o.color || '#dee2e6'), 0, 0.05, r);
    return { vox: v, vs: 2.4, col: { c: 4 }, h: 62 };
  };
  P.banner = (r, o) => { // checkered banner, z across
    const n = o.n || 50, v = new Vox(2, 6, n);
    for (let z = 0; z < n; z++) for (let y = 0; y < 6; y++) v.set(0, y, z, ((Math.floor(z / 2) + Math.floor(y / 2)) % 2) ? [0.08, 0.08, 0.08] : [0.96, 0.96, 0.96]);
    for (let z = 0; z < n; z++) v.set(1, 2 + (z % 2), z, hex(o.color || '#ff4d5e'), 0.6);
    return { vox: v, vs: 2.4, col: null, h: 0 };
  };

  // ---------- garage workbench ----------
  const STEEL = [0.66, 0.68, 0.73];
  P.nut = (r) => { const v = new Vox(9, 3, 9); cyl(v, 4.5, 4.5, 4.6, 0, 2, (x, y, z, d) => jit(STEEL, r, 0.12), 2); return { vox: v, vs: 2.4, col: { c: 10 }, h: 7 }; };
  P.bolt = (r) => {
    const v = new Vox(22, 5, 5);
    v.box(0, 0, 0, 3, 4, 4, STEEL, 0, 0.1, r);
    for (let x = 4; x < 22; x++) { v.box(x, 1, 1, x, 3, 3, U.shade(STEEL, x % 2 ? 0.85 : 1)); }
    return { vox: v, vs: 2.4, col: { w: 52, d: 12 }, h: 12 };
  };
  P.wrench = (r) => {
    const v = new Vox(46, 2, 12), c = [0.72, 0.74, 0.8];
    for (let x = 6; x < 40; x++) v.box(x, 0, 4, x, 1, 7, jit(c, r, 0.06));
    cyl(v, 5, 6, 6, 0, 1, () => jit(c, r, 0.06)); v.box(0, 0, 4, 4, 1, 7, null || c); for (let x = 0; x < 4; x++) for (let z = 4; z < 8; z++) { v.clear(x, 0, z); v.clear(x, 1, z); }
    cyl(v, 41, 6, 5, 0, 1, (x, y, z, d) => d > 2.6 ? jit(c, r, 0.06) : null);
    return { vox: v, vs: 2.4, col: null, h: 5 };
  };
  P.oilcan = (r) => {
    const v = new Vox(14, 22, 14), c = hex('#d9381e');
    cyl(v, 7, 7, 6.5, 0, 14, (x, y) => (y === 7 || y === 8) ? hex('#ffd43b') : jit(c, r, 0.06));
    cyl(v, 7, 7, 3, 15, 16, () => STEEL); for (let i = 0; i < 6; i++) v.set(8 + i, 17 + Math.floor(i / 2), 7, STEEL);
    return { vox: v, vs: 3, col: { c: 20 }, h: 50 };
  };
  P.tape = (r) => { const v = new Vox(20, 6, 20); cyl(v, 10, 10, 10, 0, 5, (x, y, z, d) => d < 8 ? hex('#c9a46b') : jit([0.55, 0.57, 0.6], r, 0.08), 6); return { vox: v, vs: 3, col: { c: 30 }, h: 18 }; };
  P.battery = (r) => {
    const v = new Vox(8, 16, 8);
    cyl(v, 4, 4, 4, 0, 13, (x, y) => y > 9 ? hex('#e8a317') : [0.12, 0.12, 0.14]); cyl(v, 4, 4, 1.6, 14, 15, () => STEEL);
    return { vox: v, vs: 3, col: { c: 12 }, h: 48 };
  };
  P.screwdriver = (r) => {
    const v = new Vox(44, 4, 4), c = hex(['#e03131', '#f59f00', '#1c7ed6'][Math.floor(r() * 3)]);
    v.box(0, 0, 0, 15, 3, 3, c, 0, 0.1, r); for (let x = 0; x < 16; x += 3) v.box(x, 3, 1, x, 3, 2, U.shade(c, 0.7));
    v.box(16, 1, 1, 41, 2, 2, STEEL); v.box(42, 1, 1, 43, 1, 2, STEEL);
    return { vox: v, vs: 2.4, col: { w: 106, d: 9 }, h: 9 };
  };
  // ---------- computer desk ----------
  P.keycap = (r, o) => {
    const c = hex(o.color || ['#2b2d42', '#343a40', '#495057', '#ff4d6d', '#3ff0ff'][Math.floor(r() * 5)]);
    const v = new Vox(9, 6, 9);
    v.box(0, 0, 0, 8, 3, 8, U.shade(c, 0.8)); v.box(1, 4, 1, 7, 5, 7, c, 0, 0.05, r);
    const L = [[3, 6], [4, 6], [5, 6], [3, 5], [3, 4], [4, 4], [3, 3], [3, 2], [4, 2], [5, 2]];
    for (const [a, b] of (r() < 0.5 ? L : L.slice(0, 7))) v.set(a, 5, b, [0.9, 0.95, 1], 0.5);
    return { vox: v, vs: 3, col: { w: 27, d: 27 }, h: 18 };
  };
  P.mouse = (r) => {
    const v = new Vox(14, 8, 22), c = [0.85, 0.86, 0.9];
    for (let x = 0; x < 14; x++) for (let z = 0; z < 22; z++) { const dx = (x - 6.5) / 7, dz = (z - 11) / 11; const d = dx * dx + dz * dz; if (d > 1) continue; const h = Math.round((1 - d) * 7.5 * (z < 11 ? 1 : 0.85)); for (let y = 0; y <= h; y++) v.set(x, y, z, jit(c, r, 0.04)); }
    for (let z = 2; z < 9; z++) v.set(6.5, 7, z, [0.2, 0.2, 0.24]);
    v.box(6, 7, 4, 7, 7, 6, [0.25, 0.95, 1], 1);
    return { vox: v, vs: 3, col: { c: 28 }, h: 24 };
  };
  P.coffee = (r) => {
    const v = new Vox(14, 16, 18), c = hex('#f1f3f5');
    cyl(v, 7, 7, 7, 0, 15, (x, y, z, d) => d > 5.8 || y === 0 ? jit(c, r, 0.04) : (y < 13 ? hex('#4a2c16') : null));
    for (let y = 4; y < 12; y++) { v.set(7, y, 15, c); v.set(7, y, 16, c); } v.set(7, 4, 14, c); v.set(7, 11, 14, c);
    return { vox: v, vs: 3, col: { c: 21 }, h: 48 };
  };
  P.usb = (r) => { const v = new Vox(14, 3, 6); v.box(0, 0, 0, 9, 2, 5, hex(['#1c7ed6', '#e64980', '#20c997'][Math.floor(r() * 3)]), 0, 0.06, r); v.box(10, 0, 1, 13, 2, 4, STEEL); v.set(3, 3, 2, [0.3, 1, 0.5], 1); return { vox: v, vs: 2.4, col: { w: 34, d: 14 }, h: 8 }; };
  // ---------- bakery ----------
  P.chip = (r) => { const v = new Vox(5, 4, 5), c = hex('#4a2511'); for (let y = 0; y < 4; y++) cyl(v, 2.5, 2.5, 2.6 - y * 0.6, y, y, () => jit(c, r, 0.15)); return { vox: v, vs: 2.6, col: { c: 6 }, h: 10 }; };
  P.cookie = (r) => {
    const v = new Vox(16, 3, 16), c = hex('#d4a056');
    cyl(v, 8, 8, 8, 0, 2, (x, y, z, d) => y === 2 && d > 7 ? null : jit(c, r, 0.14));
    for (let i = 0; i < 9; i++) { const a = r() * 6.28, d = r() * 6; v.set(8 + Math.cos(a) * d, 3, 8 + Math.sin(a) * d, hex('#4a2511')); }
    return { vox: v, vs: 3, col: { c: 24 }, h: 9 };
  };
  P.rollingpin = (r) => {
    const v = new Vox(60, 7, 7), w = hex('#e0b57a');
    for (let x = 0; x < 60; x++) { const rr = x < 9 || x > 50 ? 1.8 : 3.5; const c = x < 9 || x > 50 ? hex('#b5793a') : w; cyl(v, 3.5, 3.5, rr, 0, 0, () => null); for (let y = 0; y < 7; y++) for (let z = 0; z < 7; z++) if (Math.hypot(y + 0.5 - 3.5, z + 0.5 - 3.5) <= rr) v.set(x, y, z, jit(c, r, 0.06)); }
    return { vox: v, vs: 2.6, col: { w: 156, d: 18 }, h: 18 };
  };
  P.egg = (r) => { const v = new Vox(8, 11, 8), c = hex(r() < 0.5 ? '#f8f1e4' : '#e8c9a0'); sphere(v, 4, 4.5, 4, 4, () => jit(c, r, 0.04)); sphere(v, 4, 7, 4, 3, () => jit(c, r, 0.04)); return { vox: v, vs: 2.6, col: { c: 10 }, h: 28 }; };
  P.measure = (r) => {
    const v = new Vox(14, 12, 16), c = hex('#ff8787');
    cyl(v, 7, 7, 7, 0, 11, (x, y, z, d) => d > 5.6 || y === 0 ? jit(c, r, 0.05) : (y < 6 ? [0.97, 0.97, 0.95] : null));
    v.box(6, 9, 14, 8, 10, 15, c);
    return { vox: v, vs: 3, col: { c: 21 }, h: 36 };
  };
  P.flour = (r) => {
    const v = new Vox(14, 20, 10), c = [0.95, 0.93, 0.86];
    v.box(0, 0, 0, 13, 17, 9, c, 0, 0.05, r); v.box(1, 18, 1, 12, 19, 8, U.shade(c, 0.9), 0, 0.1, r);
    v.box(2, 6, 0, 11, 11, 0, hex('#1c7ed6')); v.box(4, 8, 0, 9, 9, 0, [1, 1, 1]);
    return { vox: v, vs: 3, col: { w: 42, d: 30 }, h: 60 };
  };
  // ---------- frosty windowsill ----------
  const SNOW = [0.93, 0.96, 1];
  P.snowpile = (r, o) => { const s = o.s || 3 + r() * 2.5, v = new Vox(Math.ceil(s * 2) + 2, Math.ceil(s) + 2, Math.ceil(s * 2) + 2); sphere(v, v.sx / 2, 0, v.sz / 2, s, (dx, dy) => dy < -0.3 ? null : jit(SNOW, r, 0.05)); return { vox: v, vs: 2.8, col: { c: s * 2.6 }, h: s * 2.8 }; };
  P.pinecone = (r) => { const v = new Vox(9, 13, 9), c = hex('#7a4a22'); for (let y = 0; y < 12; y++) cyl(v, 4.5, 4.5, (y < 6 ? 2 + y * 0.45 : 4.7 - (y - 6) * 0.6), y, y, () => jit(y % 2 ? c : U.shade(c, 0.75), r, 0.1)); return { vox: v, vs: 2.6, col: { c: 11 }, h: 32 }; };
  P.snowman = (r) => {
    const v = new Vox(16, 30, 16);
    sphere(v, 8, 6, 8, 7, () => jit(SNOW, r, 0.04)); sphere(v, 8, 15, 8, 5, () => jit(SNOW, r, 0.04)); sphere(v, 8, 22, 8, 3.8, () => jit(SNOW, r, 0.04));
    v.box(5, 25, 5, 10, 25, 10, [0.1, 0.1, 0.12]); v.box(6, 26, 6, 9, 29, 9, [0.1, 0.1, 0.12]); v.box(6, 26, 6, 9, 26, 9, hex('#e03131'));
    for (let x = 11; x < 15; x++) v.set(x, 22, 8, hex('#ff922b')); v.set(11, 23, 6, [0.05, 0.05, 0.05]); v.set(11, 23, 10, [0.05, 0.05, 0.05]);
    v.box(4, 18, 4, 12, 18, 12, hex('#e03131')); v.set(10, 15, 8, [0.1, 0.1, 0.1]); v.set(10, 12, 8, [0.1, 0.1, 0.1]);
    return { vox: v, vs: 2.8, col: { c: 20 }, h: 84 };
  };
  P.candle = (r) => {
    const v = new Vox(10, 22, 10), c = hex('#c92a2a');
    cyl(v, 5, 5, 5, 0, 15, () => jit(c, r, 0.05)); v.set(5, 16, 5, [0.1, 0.1, 0.1]); v.set(5, 17, 5, [1, 0.85, 0.35], 1); v.set(5, 18, 5, [1, 0.95, 0.6], 1); v.set(5, 19, 5, [1, 1, 0.8], 1);
    return { vox: v, vs: 3, col: { c: 15 }, h: 50, light: [1.2, 0.75, 0.35], lightY: 58 };
  };
  P.candycane = (r) => {
    const v = new Vox(40, 3, 12);
    const put = (x, z) => { const c = Math.floor((x + z) / 3) % 2 ? [1, 1, 1] : hex('#e03131'); v.box(x, 0, z, x, 2, z + 2, c); };
    for (let x = 0; x < 32; x++) put(x, 0);
    for (let a = 0; a <= Math.PI; a += 0.12) put(Math.round(32 + Math.sin(a) * 4.5), Math.round(4.5 - Math.cos(a) * 4.5));
    return { vox: v, vs: 2.6, col: { w: 96, d: 8 }, h: 8 };
  };
  // ---------- picnic ----------
  P.sandwich = (r) => {
    const v = new Vox(16, 9, 16), b = hex('#e9b872'), cr = hex('#a8632a');
    v.box(0, 0, 0, 15, 2, 15, b, 0, 0.08, r); v.box(0, 3, 0, 15, 3, 15, hex('#69db7c')); v.box(1, 4, 1, 14, 4, 14, hex('#ff6b6b')); v.box(0, 5, 0, 15, 5, 15, hex('#ffd43b'));
    v.box(0, 6, 0, 15, 8, 15, b, 0, 0.08, r);
    for (let i = 0; i < 16; i++) { v.set(i, 8, 0, cr); v.set(i, 8, 15, cr); v.set(0, 8, i, cr); v.set(15, 8, i, cr); }
    return { vox: v, vs: 3.4, col: { w: 54, d: 54 }, h: 30 };
  };
  P.apple = (r) => { const v = new Vox(12, 14, 12), c = hex(r() < 0.6 ? '#e03131' : '#74b816'); sphere(v, 6, 5.5, 6, 5.6, () => jit(c, r, 0.08)); v.set(6, 11, 6, [0.4, 0.25, 0.1]); v.set(6, 12, 6, [0.4, 0.25, 0.1]); v.set(7, 12, 6, hex('#40c057')); v.set(8, 12, 6, hex('#40c057')); return { vox: v, vs: 3, col: { c: 17 }, h: 36 }; };
  P.melon = (r) => {
    const v = new Vox(24, 12, 6);
    for (let x = 0; x < 24; x++) for (let y = 0; y < 12; y++) { const d = Math.hypot(x + 0.5 - 12, y + 0.5); if (d > 12) continue; const c = d > 10.8 ? hex('#2b8a3e') : d > 9.8 ? [0.9, 0.95, 0.75] : hex('#ff4d5e'); for (let z = 0; z < 6; z++) v.set(x, y, z, jit(c, r, 0.05)); }
    for (let i = 0; i < 10; i++) v.set(4 + r() * 16, 2 + r() * 6, 0, [0.1, 0.08, 0.06]);
    return { vox: v, vs: 3, col: { w: 70, d: 18 }, h: 36 };
  };
  P.grape = (r) => { const v = new Vox(5, 5, 5); sphere(v, 2.5, 2.5, 2.5, 2.5, () => jit(hex('#862e9c'), r, 0.15)); return { vox: v, vs: 2.6, col: { c: 6 }, h: 13 }; };
  P.juicebox = (r) => {
    const v = new Vox(10, 18, 7), c = hex(['#ff922b', '#be4bdb', '#fab005'][Math.floor(r() * 3)]);
    v.box(0, 0, 0, 9, 15, 6, c, 0, 0.05, r); v.box(2, 5, 0, 7, 10, 0, [1, 1, 1]); v.box(3, 6, 0, 6, 9, 0, hex('#40c057'));
    for (let y = 16; y < 18; y++) v.set(7, y, 3, [1, 1, 1]);
    return { vox: v, vs: 3, col: { w: 30, d: 21 }, h: 54 };
  };
  // ---------- model railway town ----------
  P.house = (r) => {
    const v = new Vox(14, 16, 12), wall = hex(['#f8f0e3', '#ffd8a8', '#d0ebff', '#e9fac8'][Math.floor(r() * 4)]), roof = hex(['#c92a2a', '#5c3d2e', '#364fc7'][Math.floor(r() * 3)]);
    v.box(0, 0, 0, 13, 7, 11, wall, 0, 0.04, r);
    for (let y = 8; y < 15; y++) { const k = y - 8; v.box(0, y, k, 13, y, 11 - k, roof, 0, 0.06, r); }
    for (const x of [2, 6, 10]) { v.set(x, 4, 0, [1, 0.85, 0.45], 1); v.set(x + 1, 4, 0, [1, 0.85, 0.45], 1); v.set(x, 4, 11, [1, 0.85, 0.45], 1); }
    v.box(6, 0, 0, 7, 2, 0, hex('#5c3d2e')); v.box(10, 12, 7, 11, 15, 8, [0.6, 0.6, 0.6]);
    return { vox: v, vs: 3, col: { w: 42, d: 36 }, h: 48 };
  };
  P.tree = (r) => {
    const v = new Vox(14, 22, 14), g = hex(['#2b8a3e', '#37b24d', '#5c940d'][Math.floor(r() * 3)]);
    v.box(6, 0, 6, 7, 7, 7, hex('#7a4a22'));
    for (let y = 6; y < 21; y++) cyl(v, 7, 7, Math.max(1, 6.5 - (y - 6) * 0.42), y, y, () => jit(g, r, 0.18));
    return { vox: v, vs: 3, col: { c: 8 }, h: 64 };
  };
  P.rails = (r) => {
    const v = new Vox(60, 2, 10);
    for (let x = 1; x < 60; x += 4) v.box(x, 0, 0, x + 1, 0, 9, hex('#6b4a2e'));
    v.box(0, 1, 2, 59, 1, 2, STEEL); v.box(0, 1, 7, 59, 1, 7, STEEL);
    return { vox: v, vs: 2.4, col: null, h: 2, top: true };
  };

  // ---------- moving hazards, pads, pickups ----------
  P.bumper = (r, o) => {
    const v = new Vox(11, 6, 11), c = hex(o.color || '#ff4dd8');
    cyl(v, 5.5, 5.5, 5.5, 0, 1, () => [0.15, 0.15, 0.2]);
    cyl(v, 5.5, 5.5, 5, 2, 3, () => [c[0], c[1], c[2], 0.9]);
    cyl(v, 5.5, 5.5, 3.6, 4, 5, (x, y) => (y === 5 ? [1, 1, 1, 0.8] : [0.92, 0.92, 0.95]));
    return { vox: v, vs: 3, col: { c: 16, bumper: true }, h: 18 };
  };
  P.spring = (r) => {
    const v = new Vox(12, 2, 12);
    v.box(0, 0, 0, 11, 0, 11, [0.25, 0.25, 0.3]);
    for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) if (Math.abs(Math.hypot(i - 5.5, j - 5.5) - 3.5) < 0.8 || Math.abs(Math.hypot(i - 5.5, j - 5.5) - 5.3) < 0.6) v.set(i, 1, j, [0.85, 0.87, 0.9]);
    for (const [i, j] of [[5, 4], [6, 4], [4, 5], [7, 5], [5, 6], [6, 6], [5, 7], [6, 7]]) v.set(j, 1, i, [1, 0.85, 0.2], 1);
    return { vox: v, vs: 2.6, col: null, h: 5 };
  };
  P.itembox = (r) => { // a glowing rainbow cube with a "?" on every side
    const n = 8, v = new Vox(n, n, n), cols = ['#ff4d6d', '#ffd43b', '#40c057', '#4dabf7', '#cc5de8', '#ff922b'].map(hex);
    for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) for (let z = 0; z < n; z++) {
      const c = cols[(Math.floor((x + y + z) / 2)) % 6];
      v.set(x, y, z, c, 0.55);
    }
    const q = [[3, 6], [4, 6], [5, 5], [4, 4], [3, 3], [3, 1]];
    for (const [a, b] of q) { v.set(a, b, 0, [1, 1, 1], 1); v.set(a, b, n - 1, [1, 1, 1], 1); v.set(0, b, a, [1, 1, 1], 1); v.set(n - 1, b, a, [1, 1, 1], 1); v.set(a, n - 1, 7 - b, [1, 1, 1], 1); }
    return { vox: v, vs: 2.6, col: null, h: 21 };
  };
  P.vacuum = (r) => {
    const v = new Vox(14, 4, 14);
    cyl(v, 7, 7, 7, 0, 2, (x, y, z, d) => d > 6 ? [0.15, 0.15, 0.18] : [0.32, 0.33, 0.38]);
    cyl(v, 7, 7, 2, 3, 3, () => [0.3, 0.9, 1, 1]); v.set(12, 2, 7, [1, 0.3, 0.3], 1);
    return { vox: v, vs: 3, col: { c: 21 }, h: 12 };
  };
  P.ladybug = (r) => {
    const v = new Vox(16, 9, 12), red = hex('#e03131');
    sphere(v, 7, 0, 6, 6.5, (dx, dy, dz) => dy < 0 ? null : ((Math.abs(dz) < 0.6) || ((Math.floor(dx * 0.5 + 9) + Math.floor(dz * 0.5 + 9)) % 3 === 0 && dy > 2) ? [0.08, 0.08, 0.08] : red));
    sphere(v, 13, 2, 6, 3, (dx, dy) => dy < -1 ? null : [0.08, 0.08, 0.08]); v.set(15, 4, 5, [1, 1, 1]); v.set(15, 4, 7, [1, 1, 1]);
    return { vox: v, vs: 2.8, col: { c: 20 }, h: 25 };
  };
  P.train = (r) => {
    const v = new Vox(30, 12, 9), body = hex('#c92a2a'), blk = [0.12, 0.12, 0.14];
    v.box(0, 0, 1, 29, 1, 7, blk);
    for (const x of [3, 9, 20, 26]) { v.box(x - 1, 0, 0, x + 1, 2, 0, blk); v.box(x - 1, 0, 8, x + 1, 2, 8, blk); }
    v.box(14, 2, 1, 29, 6, 7, blk, 0, 0.05, r); cyl(v, 22, 4, 3.4, 7, 7, () => blk); v.box(24, 7, 3, 25, 10, 5, blk); v.set(29, 4, 4, [1, 0.95, 0.6], 1);
    v.box(14, 7, 1, 19, 10, 7, body); v.box(14, 11, 0, 19, 11, 8, blk); v.box(15, 8, 1, 18, 9, 1, [1, 0.85, 0.45], 0.8);
    v.box(0, 2, 1, 12, 7, 7, hex('#1971c2'), 0, 0.05, r); for (let x = 1; x < 12; x += 3) v.box(x, 5, 1, x + 1, 6, 1, [1, 0.85, 0.45], 0.8);
    return { vox: v, vs: 3, col: { w: 90, d: 27 }, h: 40 };
  };
  const ARM = {
    spoon: ['#c9ced6', '#e9ecef'], ruler: ['#ffd43b', '#343a40'], shovel: ['#1c7ed6', '#1864ab'], cue: ['#d9a066', '#5c2e0e'],
    glow: ['#ff4dd8', '#ff4dd8', 1], wrench: ['#adb5bd', '#868e96'], usb: ['#e9ecef', '#3ff0ff'], cane: ['#e03131', '#ffffff'],
    straw: ['#ff6b6b', '#ffffff'], barrier: ['#e03131', '#ffffff'],
  };
  // sweeper arm: pivot at origin, arm along +x. len in world units.
  CR.armMesh = function (look, len) {
    const [a, b, glow] = ARM[look] || ARM.barrier, ca = hex(a), cb = hex(b), vs = 2.4, n = Math.ceil(len / vs);
    const v = new Vox(n + 3, 6, 5);
    cyl(v, 2.5, 2.5, 2.5, 0, 5, () => [0.25, 0.25, 0.3]);
    for (let x = 2; x < n + 2; x++) { const c = Math.floor(x / 3) % 2 ? cb : ca; v.box(x, 2, 1, x, 4, 3, c, glow ? 1 : 0); }
    if (look === 'spoon') cyl(v, n, 2.5, 2.5, 2, 3, () => [ca[0], ca[1], ca[2]]);
    v.set(2.5, 5, 2.5, [1, 0.2, 0.2], 1);
    return G.mesh(v, vs, 2.5, 0, 2.5);
  };

  const cache = new Map();
  // get a meshed prop. Variants give the same name different looks (different seeds).
  CR.prop = function (name, opt = {}, seed = 1) {
    const key = name + JSON.stringify(opt) + '|' + seed;
    if (cache.has(key)) return cache.get(key);
    const r = U.rng(seed * 7919 + name.length * 131);
    const d = P[name](r, opt);
    const bld = G.mesh(d.vox, d.vs, d.vox.sx / 2, 0, d.vox.sz / 2);
    const res = { bld, col: d.col, h: d.h, light: d.light, lightY: d.lightY, size: [d.vox.sx * d.vs, d.vox.sy * d.vs, d.vox.sz * d.vs] };
    cache.set(key, res);
    return res;
  };
  CR.propRaw = (name, opt, seed) => { const r = U.rng(seed * 7919 + name.length * 131); return P[name](r, opt || {}); };

  // ---------------------------------------------------------------------------
  // Pixel sprites (billboards). Drawn into a 256x256 atlas. White block at (0,0) is used by untextured geometry.
  // ---------------------------------------------------------------------------
  const SPR = {
    tuft: { pal: { g: '#3f9b3f', G: '#6fcf5f', d: '#2a6b2a' }, art: [
      '....G.....G.....', '...Gg..G..g.....', '...g...g.Gg..G..', '..Gg..Gg.g..Gg..', '..g..Gg..g.Gg...', '.Gg..g...gGg..G.',
      '.g..Gg..Gg.g.Gg.', 'Gg.Gg..Gg..gGg..', 'g..g..Gg...gg...', 'dg.gdGgd.Ggdg.d.', 'ddgddgddgdgddgd.', '.dddddddddddddd.'] },
    flowerR: { pal: { p: '#ff4d6d', P: '#ffb3c1', y: '#ffd43b', g: '#3f9b3f' }, art: [
      '....pPp.........', '...pPyPp........', '....pPp...pPp...', '.....g...pPyPp..', '.....g....pPp...', '..g..g.....g....',
      '...g.g....gg....', '....gg...g.g....', '.....g..g..g....', '.....g.g...g....', '....ggg...ggg...'] },
    flowerB: { pal: { p: '#4dabf7', P: '#d0ebff', y: '#ffffff', g: '#2f8f4f' }, art: [
      '..pPp...........', '.pPyPp....pPp...', '..pPp....pPyPp..', '...g......pPp...', '...g...g...g....', '...g..g....g.g..',
      '...g.g.....gg...', '...gg......g....', '...g.......g....', '..ggg.....ggg...'] },
    soldier: { pal: { g: '#5c8a3a', G: '#7fb24d', d: '#3a5a24' }, art: [
      '......GG........', '.....GggG.......', '.....GggG.......', '......gg........', '....GgggggG.....', '...Gg.ggg.gGg...',
      '...g..ggg..ggg..', '......ggg.......', '......g.g.......', '.....gg.gg......', '....ddd.ddd.....'] },
    dino: { pal: { g: '#c2255c', G: '#f06595', w: '#ffffff', k: '#111111' }, art: [
      '..........GGG...', '.........GgwkG..', '.........GggggG.', '..G......Ggg....', '.Gg.....Ggg.....', 'Gg....GGggg.....',
      'g...GGggggg.....', 'gGGGggggggg.....', '.ggggggggg......', '...gg...gg......', '...gg...gg......'] },
    sparkle: { pal: { w: '#ffffff', y: '#fff3bf' }, art: ['...y...', '...w...', '.y.w.y.', 'yww.wwy', '.y.w.y.', '...w...', '...y...'] },
    ant: { pal: { k: '#1a1a1a', K: '#3b3b3b' }, art: ['.k...k..', '..k.k...', '.KKkKKK.', 'kKKkKKKk', '.KKkKKK.', 'k.k.k.k.'] },
    flake: { pal: { w: '#ffffff', b: '#d0ebff' }, art: ['..b.b..', 'b..w..b', '.bwwwb.', '.wwbww.', '.bwwwb.', 'b..w..b', '..b.b..'] },
    person: { pal: { s: '#f2c19b', r: '#e03131', b: '#1c7ed6', k: '#2b2b2b', y: '#ffd43b' }, art: ['..kk..', '..ss..', '..ss..', '.rrrr.', 'srrrrs', 's.rr.s', '..bb..', '..bb..', '.b..b.', '.k..k.'] },
    mushroom: { pal: { r: '#e03131', w: '#ffffff', s: '#f1e3c8' }, art: ['..rrrr..', '.rwrrwr.', 'rrrrrrrr', 'rwrrrrwr', '...ss...', '...ss...', '..ssss..'] },
    bubble: { pal: { w: '#ffffff', b: '#c5f6fa' }, art: ['..bbb..', '.b...b.', 'b..w..b', 'b...w.b', 'b.....b', '.b...b.', '..bbb..'] },
  };
  CR.buildAtlas = function () {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, 4, 4);
    const uv = {}; let px = 8, py = 0, rowH = 0;
    for (const [name, s] of Object.entries(SPR)) {
      const w = Math.max(...s.art.map((r) => r.length)), h = s.art.length;
      if (px + w > 256) { px = 0; py += rowH + 2; rowH = 0; }
      s.art.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const k = row[i]; if (k === '.') continue; x.fillStyle = s.pal[k]; x.fillRect(px + i, py + j, 1, 1); } });
      uv[name] = { u0: px / 256, v0: py / 256, u1: (px + w) / 256, v1: (py + h) / 256, w, h };
      px += w + 2; rowH = Math.max(rowH, h);
    }
    return { canvas: c, uv };
  };
})(window.CR);
