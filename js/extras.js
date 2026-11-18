// Cursor Racing — the extras layered on the race: moving hazards (sweepers, shuttles, trains),
// bumpers, spring pads, jump gaps, power-ups, slipstream and launch starts.
// game.js calls in at a handful of places; everything else lives here.
(function (CR) {
  'use strict';
  const { U, R, Audio } = CR;
  const CAR_R = 11.5;
  const X = {};
  let G = null; // CR.Game, set in reset

  const ITEMS = {
    turbo: { name: 'Turbo', icon: '🔥' },
    oil: { name: 'Oil slick', icon: '🛢️' },
    shield: { name: 'Shield', icon: '🛡️' },
    shock: { name: 'Shockwave', icon: '💥' },
    marble: { name: 'Marble', icon: '🔮' },
  };
  X.ITEMS = ITEMS;

  X.reset = function (game) {
    G = game;
    const w = G.world;
    w.oil = [];
    X.marbles = [];
    X.marbleMesh = X.marbleMesh || CR.G.upload(R.gl, CR.prop('marble', {}, 2).bld);
    for (const row of w.itemRows) for (const b of row) { b.on = true; b.t = 0; }
    for (const c of G.cars) { c.item = null; c.itemHold = 0; c.shieldT = 0; c.spinT = 0; c.draft = 0; c.stallT = 0; c.revAt = null; c.hitT = 0; }
  };

  // ---------- launch start ----------
  // Press the gas in the last half-second of the countdown for a perfect start; floor it too early and you stall.
  X.countInput = function (c, count, throttle) {
    if (throttle > 0.2 && c.revAt == null) c.revAt = count;
    if (throttle <= 0.2 && count > 0.5) c.revAt = null; // let off before the window: no penalty
  };
  X.onGo = function () {
    for (const c of G.cars) {
      if (c.isPlayer && !G.autopilot) {
        if (c.revAt != null && c.revAt <= 0.55) { c.padT = 0.9; G.msg('PERFECT START!', 1.2, 'go'); Audio.play('pad'); }
        else if (c.revAt != null && c.revAt > 1.1) { c.stallT = 0.7; G.msg('TOO EARLY!', 1, 'warn'); Audio.play('error'); }
      } else if (!c.isPlayer && Math.random() < 0.3) c.padT = 0.6;
    }
  };

  // ---------- input filter: spins, stalls ----------
  X.filterInput = function (c, inp, dt) {
    if (c.stallT > 0) { c.stallT -= dt; return { steer: inp.steer, throttle: 0, brake: 0, boost: false }; }
    if (c.spinT > 0) { c.spinT -= dt; c.h += 11 * dt * (c.spinDir || 1); return { steer: 0, throttle: 0, brake: 0.3, boost: false }; }
    if (c.shieldT > 0) c.shieldT -= dt;
    if (c.hitT > 0) c.hitT -= dt;
    return inp;
  };

  // ---------- per-step world update ----------
  X.step = function (dt) {
    const w = G.world, t = G.time;
    // movers
    for (const m of w.movers) {
      if (m.type === 'sweeper') {
        const prev = m.ang; m.ang = m.base + Math.sin(t * m.speed + m.ph) * m.amp; m.omega = (m.ang - prev) / dt;
      } else {
        const ph = t * m.speed + m.ph, lat = Math.sin(ph) * m.reach;
        const px = m.x, py = m.y;
        m.x = m.cx + m.nx * lat; m.y = m.cy + m.ny * lat; m.vx = (m.x - px) / dt; m.vy = (m.y - py) / dt;
        m.dir = Math.cos(ph) >= 0 ? 1 : -1; m.roll = (m.roll || 0) + Math.hypot(m.vx, m.vy) * dt / 9 * m.dir;
        if (m.train && Math.abs(lat) < w.hw + 60 && G.player && Math.hypot(G.player.x - m.x, G.player.y - m.y) < 500 && (!m.horn || t - m.horn > 4)) { m.horn = t; Audio.play('horn'); }
      }
    }
    // item boxes come back after a few seconds
    for (const row of w.itemRows) for (const b of row) if (!b.on) { b.t -= dt; if (b.t <= 0) b.on = true; }
    for (let i = w.oil.length - 1; i >= 0; i--) { w.oil[i].t -= dt; if (w.oil[i].t <= 0) w.oil.splice(i, 1); }
    // slipstream: tuck in behind a car to go a bit faster and charge boost
    for (const c of G.cars) {
      if (c.state !== 'race' || c.air || c.out) { c.draft = Math.max(0, c.draft - dt * 2); continue; }
      const fx = Math.cos(c.h), fy = Math.sin(c.h); let tuck = false;
      if (c.vx * fx + c.vy * fy > 150) for (const o of G.cars) {
        if (o === c || o.out || o.state !== 'race') continue;
        const dx = o.x - c.x, dy = o.y - c.y, along = dx * fx + dy * fy, side = Math.abs(-dx * fy + dy * fx);
        if (along > 22 && along < 80 && side < 15) { tuck = true; break; }
      }
      c.draft = U.clamp(c.draft + (tuck ? dt * 2.2 : -dt * 1.5), 0, 1);
      if (c.draft > 0.5) { c.boost = Math.min(1, c.boost + dt * 0.07); if (c.isPlayer && Math.random() < 0.25) G.emit('wind', c.x + (Math.random() - 0.5) * 30, c.y + (Math.random() - 0.5) * 30, 6, 1, c); }
    }
    for (const c of G.cars) {
      if (c.state !== 'race' || (G.ko && c.out)) continue;
      // spring pads
      if (!c.air && c.z < 2) for (const s of w.springs) {
        if ((c.x - s.x) ** 2 + (c.y - s.y) ** 2 < 18 * 18) { c.air = true; c.vz = 330 * (c.def.lift || 1); c.onRamp = false; G.emit('dust', c.x, c.y, 1, 6); if (c.isPlayer) { Audio.play('spring'); Audio.vibrate(15); } else if (near(c)) Audio.play('spring', { vol: 0.4 }); }
      }
      // moving hazards
      if (c.z < 20) for (const m of w.movers) hitMover(c, m);
      // item boxes
      if (G.items && !c.item && c.z < 20) for (const row of w.itemRows) for (const b of row) {
        if (b.on && (c.x - b.x) ** 2 + (c.y - b.y) ** 2 < 20 * 20) {
          b.on = false; b.t = 3.5; c.item = rollItem(c); c.itemHold = 0.6 + Math.random() * 2.5;
          G.emit('spark', b.x, b.y, 12, 8);
          if (c.isPlayer) { Audio.play('item'); G.msg(ITEMS[c.item].name.toUpperCase(), 0.9, 'info'); }
        }
      }
    }
    marblesStep(dt);
  };
  function near(c) { return G.player && Math.hypot(G.player.x - c.x, G.player.y - c.y) < 400; }

  function hitMover(c, m) {
    let nx, ny, pen, mvx = 0, mvy = 0;
    if (m.type === 'sweeper') {
      // arm as a box from the pivot
      const ca = Math.cos(m.ang), sa = Math.sin(m.ang);
      const dx = c.x - m.x, dy = c.y - m.y, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
      const cu = U.clamp(u, 0, m.len), cv = U.clamp(v, -4, 4), lu = u - cu, lv = v - cv, d = Math.hypot(lu, lv);
      if (d >= CAR_R || d < 0.001) return;
      const nu = lu / d, nv = lv / d; nx = nu * ca - nv * sa; ny = nu * sa + nv * ca; pen = CAR_R - d;
      // the arm's own speed where it touches the car
      const sp = (m.omega || 0) * cu; mvx = -sa * sp; mvy = ca * sp;
    } else if (m.box) {
      const ca = Math.cos(m.oang), sa = Math.sin(m.oang);
      const dx = c.x - m.x, dy = c.y - m.y, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
      const cu = U.clamp(u, -m.hw, m.hw), cv = U.clamp(v, -m.hd, m.hd), lu = u - cu, lv = v - cv, d = Math.hypot(lu, lv);
      if (d >= CAR_R) return;
      if (d < 0.001) { nx = m.nx * (v >= 0 ? 1 : -1); ny = m.ny * (v >= 0 ? 1 : -1); pen = CAR_R; }
      else { const nu = lu / d, nv = lv / d; nx = nu * ca - nv * sa; ny = nu * sa + nv * ca; pen = CAR_R - d; }
      mvx = m.vx; mvy = m.vy;
    } else {
      const dx = c.x - m.x, dy = c.y - m.y, d = Math.hypot(dx, dy), rr = m.r + CAR_R;
      if (d >= rr || d < 0.001) return;
      nx = dx / d; ny = dy / d; pen = rr - d; mvx = m.vx; mvy = m.vy;
    }
    c.x += nx * pen; c.y += ny * pen;
    const rel = (c.vx - mvx) * nx + (c.vy - mvy) * ny;
    if (rel < 0) {
      c.vx -= 1.5 * rel * nx; c.vy -= 1.5 * rel * ny;
      if (rel < -90 && c.hitT <= 0) {
        c.hitT = 0.4; G.emit('spark', c.x - nx * CAR_R, c.y - ny * CAR_R, 8, 8);
        if (rel < -260 && c.shieldT <= 0) { c.spinT = 0.45; c.spinDir = Math.random() < 0.5 ? -1 : 1; }
        if (c.isPlayer) { Audio.play('wall', { vol: 1 }); G.shake(6); Audio.vibrate(20); }
      }
    }
  }

  // bumpers kick hard (called from game.js for colliders flagged as bumpers)
  X.bumper = function (c, k, nx, ny) {
    c.vx += nx * 300; c.vy += ny * 300; k.flash = 0.25;
    G.emit('spark', k.x + nx * k.r, k.y + ny * k.r, 10, 10);
    G.lightPulse(k.x, k.y, [1.4, 0.6, 1.4]);
    if (c.isPlayer) { Audio.play('boing'); G.shake(4); Audio.vibrate(15); } else if (near(c)) Audio.play('boing', { vol: 0.4 });
  };

  // ---------- jump gaps ----------
  // never respawn on the run-up to a gap: put the car down on the far side
  X.safeS = function (s) {
    const w = G.world;
    for (const g of w.gaps) {
      let d = s - g.s; if (d > w.L / 2) d -= w.L; if (d < -w.L / 2) d += w.L;
      if (d > -260 && d < g.len + 10) return g.s + g.len + 45;
    }
    return s;
  };

  // ---------- AI helpers ----------
  X.aiAdjust = function (c, inp, dt) {
    const w = G.world, a = c.ai, fx = Math.cos(c.h), fy = Math.sin(c.h);
    // keep speed and line up straight for a gap
    for (const g of w.gaps) {
      let d = g.s - c.s; if (d < -w.L / 2) d += w.L;
      if (d > 0 && d < 340) { inp.throttle = 1; inp.brake = 0; a.lane *= 0.9; if (d < 200 && c.boost > 0.1) inp.boost = true; }
    }
    // steer round bumpers and things that move across the road
    const obs = [];
    for (const k of w.hazards) if (k.type === 'bumper') obs.push(k.x, k.y, 16);
    for (const m of w.movers) if (m.type === 'shuttle') obs.push(m.x, m.y, m.box ? 30 : m.r);
    for (const b of X.marbles) obs.push(b.x, b.y, 8);
    for (let i = 0; i < obs.length; i += 3) {
      const dx = obs[i] - c.x, dy = obs[i + 1] - c.y, along = dx * fx + dy * fy, side = -dx * fy + dy * fx;
      if (along > 10 && along < 170 && Math.abs(side) < obs[i + 2] + 18) a.lane += (side > 0 ? -1 : 1) * dt * 2.4;
    }
    a.lane = U.clamp(a.lane, -0.7, 0.7);
    // power-ups
    if (c.item) {
      c.itemHold -= dt;
      if (c.itemHold <= 0 && aiWantsItem(c)) X.use(c);
    }
    return inp;
  };
  function aiWantsItem(c) {
    const w = G.world, fx = Math.cos(c.h), fy = Math.sin(c.h);
    let ahead = null, behind = 0, close = 0;
    for (const o of G.cars) {
      if (o === c || o.out || o.state !== 'race') continue;
      const dx = o.x - c.x, dy = o.y - c.y, d = Math.hypot(dx, dy);
      if (d < 120) close++;
      const along = dx * fx + dy * fy, side = Math.abs(-dx * fy + dy * fx);
      if (along > 40 && along < 420 && side < along * 0.25) ahead = o;
      if (along < -20 && along > -170 && side < 40) behind++;
    }
    const cm = w.curv[(Math.floor(c.s / 8) + 10) % w.N];
    switch (c.item) {
      case 'turbo': return cm < 0.002;
      case 'oil': return behind > 0;
      case 'shield': return close > 0 || c.itemHold < -4;
      case 'shock': return close > 1 || (close > 0 && c.itemHold < -3);
      case 'marble': return !!ahead || c.itemHold < -6;
    }
    return true;
  }
  function rollItem(c) {
    const order = G.standings(), n = Math.max(2, order.length), f = (order.indexOf(c)) / (n - 1);
    const table = f < 0.3 ? { oil: 35, shield: 25, marble: 25, turbo: 15 } : f < 0.7 ? { marble: 30, turbo: 25, shock: 20, oil: 15, shield: 10 } : { turbo: 40, shock: 30, marble: 20, shield: 10 };
    let sum = 0; for (const k in table) sum += table[k];
    let r = Math.random() * sum; for (const k in table) { r -= table[k]; if (r <= 0) return k; }
    return 'turbo';
  }

  // ---------- using items ----------
  X.use = function (c) {
    const it = c.item; if (!it || c.state !== 'race') return;
    c.item = null; c.usedItems = (c.usedItems || 0) + 1;
    const fx = Math.cos(c.h), fy = Math.sin(c.h), me = c.isPlayer, loud = me || near(c);
    switch (it) {
      case 'turbo': c.padT = 1.3; if (me) Audio.play('boost'); break;
      case 'oil': G.world.oil.push({ x: c.x - fx * 26, y: c.y - fy * 26, r: 30, t: 14, max: 14 }); if (loud) Audio.play('splash', { vol: me ? 0.8 : 0.4 }); break;
      case 'shield': c.shieldT = 6; if (loud) Audio.play('shield', { vol: me ? 1 : 0.4 }); break;
      case 'shock': {
        for (const o of G.cars) {
          if (o === c || o.out || o.state !== 'race') continue;
          const dx = o.x - c.x, dy = o.y - c.y, d = Math.hypot(dx, dy);
          if (d > 180 || d < 1) continue;
          if (o.shieldT > 0) { o.shieldT = 0; continue; }
          const k = (1 - d / 180) * 420 + 120; o.vx += dx / d * k; o.vy += dy / d * k; o.spinT = 0.35; o.spinDir = Math.random() < 0.5 ? -1 : 1;
          if (o.isPlayer) { G.shake(8); Audio.vibrate(40); }
        }
        G.emit('ring', c.x, c.y, 4, 36); G.lightPulse(c.x, c.y, [1.4, 1.2, 0.6]);
        if (loud) { Audio.play('shock', { vol: me ? 1 : 0.5 }); if (me) G.shake(5); }
        break;
      }
      case 'marble':
        X.marbles.push({ x: c.x + fx * 20, y: c.y + fy * 20, vx: fx * 560 + c.vx * 0.5, vy: fy * 560 + c.vy * 0.5, life: 3.2, owner: c, age: 0, bounces: 0, m: new Float32Array(16), rot: 0 });
        if (loud) Audio.play('shoot', { vol: me ? 1 : 0.4 });
        break;
    }
  };

  function marblesStep(dt) {
    const w = G.world, ms = X.marbles;
    for (let i = ms.length - 1; i >= 0; i--) {
      const b = ms[i]; b.life -= dt; b.age += dt;
      b.x += b.vx * dt; b.y += b.vy * dt; b.rot += Math.hypot(b.vx, b.vy) * dt / 7;
      let dead = b.life <= 0 || !w.inTable(b.x, b.y, -10) || w.surface(b.x, b.y, 0).type === 'void';
      for (const k of w.collidersNear(b.x, b.y)) {
        if (k.soft) continue;
        let nx, ny, pen;
        if (k.r) { const dx = b.x - k.x, dy = b.y - k.y, d = Math.hypot(dx, dy); if (d > k.r + 7 || d === 0) continue; nx = dx / d; ny = dy / d; pen = k.r + 7 - d; }
        else { const dx = b.x - k.x, dy = b.y - k.y, u = dx * k.c + dy * k.s, v = -dx * k.s + dy * k.c, cu = U.clamp(u, -k.hw, k.hw), cv = U.clamp(v, -k.hd, k.hd), lu = u - cu, lv = v - cv, d = Math.hypot(lu, lv); if (d > 7 || d < 0.001) continue; const nu = lu / d, nv = lv / d; nx = nu * k.c - nv * k.s; ny = nu * k.s + nv * k.c; pen = 7 - d; }
        b.x += nx * pen; b.y += ny * pen; const vn = b.vx * nx + b.vy * ny; if (vn < 0) { b.vx -= 2 * vn * nx; b.vy -= 2 * vn * ny; b.bounces++; }
        if (b.bounces > 4) dead = true;
      }
      for (const c of G.cars) {
        if (c.out || c.state !== 'race' || c.z > 20 || (c === b.owner && b.age < 0.4)) continue;
        if ((c.x - b.x) ** 2 + (c.y - b.y) ** 2 < (CAR_R + 7) ** 2) {
          dead = true; G.emit('spark', b.x, b.y, 8, 12);
          if (c.shieldT > 0) { c.shieldT = 0; if (c.isPlayer) Audio.play('shield'); continue; }
          c.vx = c.vx * 0.3 + b.vx * 0.25; c.vy = c.vy * 0.3 + b.vy * 0.25; c.spinT = 0.6; c.spinDir = Math.random() < 0.5 ? -1 : 1;
          if (c.isPlayer) { Audio.play('wall'); G.shake(7); Audio.vibrate(40); G.msg('HIT!', 0.7, 'warn'); }
          else if (b.owner.isPlayer) { Audio.play('bump'); G.msg(`GOT ${c.name.toUpperCase()}!`, 0.8, 'info'); }
        }
      }
      if (dead) { G.emit('poof', b.x, b.y, 6, 4); ms.splice(i, 1); }
    }
  }

  // ---------- drawing ----------
  X.render = function (cars, B, quadFn) {
    const w = G.world, t = G.time;
    for (const m of w.movers) {
      if (m.type === 'sweeper') CR.M4.model(m.x, 0, m.y, -m.ang, 0, 0, 1, m.m);
      else if (m.train) CR.M4.model(m.x, 0, m.y, -(m.oang + (m.dir < 0 ? Math.PI : 0)), 0, 0, 1, m.m);
      else if (m.box) CR.M4.model(m.x, 0, m.y, -m.oang, 0, 0, 1, m.m);
      else CR.M4.model(m.x, Math.abs(Math.sin(t * 8 + m.ph)) * 2, m.y, -(m.ang + Math.PI / 2 * m.dir), 0, 0, 1, m.m);
      cars.push({ mesh: m.mesh, m: m.m });
    }
    if (G.items) for (const row of w.itemRows) for (const b of row) {
      if (!b.on) continue;
      b.m = b.m || new Float32Array(16);
      CR.M4.model(b.x, 8 + Math.sin(t * 3 + b.x) * 3, b.y, t * 1.8 + b.y, 0.5, 0.4, 1, b.m);
      cars.push({ mesh: w.itemMesh, m: b.m });
    }
    for (const b of X.marbles) { CR.M4.model(b.x, 0, b.y, 0, b.rot, 0, 1, b.m); cars.push({ mesh: X.marbleMesh, m: b.m }); }
    // oil puddles as dark decals
    for (const o of w.oil) {
      const a = 0.75 * Math.min(1, o.t / 2), n = 10, ids = [];
      const cIdx = B.v(o.x, 0.25, o.y, 0, 1, 0, 0.03, 0.03, 0.05, a);
      for (let i = 0; i <= n; i++) { const ang = i / n * Math.PI * 2, rr = o.r * (0.85 + 0.15 * Math.sin(i * 2.7 + o.x)); ids.push(B.v(o.x + Math.cos(ang) * rr, 0.25, o.y + Math.sin(ang) * rr, 0, 1, 0, 0.08, 0.06, 0.12, a)); }
      for (let i = 0; i < n; i++) B.idx.push(cIdx, ids[i], ids[i + 1]);
    }
    // shields: a ring of sparkles round the car
    for (const c of G.cars) if (c.shieldT > 0 && !c.out) for (let i = 0; i < 8; i++) { const a = t * 4 + i / 8 * Math.PI * 2; quadFn(c.x + Math.cos(a) * 20, c.y + Math.sin(a) * 20, 8 + Math.sin(t * 6 + i) * 4, 1.6, [0.4, 0.95, 1], 0.9); }
  };

  CR.Extras = X;
})(window.CR);
