// Cursor Racing — race simulation: car physics, collisions, AI, laps, knockout rounds,
// ghosts, particles, skid marks and the chase camera.
(function (CR) {
  'use strict';
  const { U, R, Audio } = CR;
  const X = () => CR.Extras;
  const GRAV = 1150, CAR_R = 11.5, FLOOR_PAD = 6;

  const Game = {
    on: false, paused: false, mode: null, time: 0,
    input: { steer: 0, throttle: 0, brake: 0, boost: false, stick: null },
    settings: { difficulty: 1, shake: true, autoGas: true },
  };

  // ---------- car stats ----------
  function stats(def, up = {}) {
    const e = up.eng || 0, g = up.grip || 0, b = up.boost || 0;
    return {
      top: 255 + def.top * 150 + e * 11,
      accel: 300 + def.accel * 280 + e * 16,
      grip: 4.2 + def.grip * 6.5 + g * 0.55,
      turn: 3.5 + def.grip * 0.9 + g * 0.06,
      mass: 0.6 + def.mass,
      offroad: def.offroad || 0,
      hover: !!def.hover,
      boostPow: 1.28 + b * 0.035,
      boostDrain: 0.5 - b * 0.03,
      charge: (def.charge || 1) + b * 0.08,
    };
  }

  function makeCar(o) {
    const def = CR.CARS.find((c) => c.id === o.car) || CR.CARS[0];
    const c = {
      id: o.id, name: o.name, isPlayer: !!o.player, def, st: stats(def, o.up), paint: o.paint, acc: o.acc,
      mesh: CR.G.upload(R.gl, CR.carMesh(def.id, o.paint, o.acc)), m: new Float32Array(16),
      x: 0, y: 0, z: 0, h: 0, vx: 0, vy: 0, vz: 0, air: false, onRamp: false,
      ix: 0, s: 0, lat: 0, prog: 0, lap: 0, lapStart: 0, lapTimes: [], bestLap: null, finished: false, finishTime: 0,
      state: 'race', fallT: 0, inv: 0, boost: 0.3, boosting: false, padT: 0, slip: 0, wrongT: 0,
      pitch: 0, roll: 0, vis: { pitch: 0, roll: 0 }, steerVis: 0, out: false, outT: 0,
      ai: o.player ? null : { lane: (Math.random() - 0.5) * 0.6, laneT: 0, skill: o.skill || 1, stuckT: 0, revT: 0, wob: Math.random() * 6, globalT: 0 },
      globalT: Math.random() * 0.25, last: { x: 0, y: 0 }, skidL: null, skidR: null, points: 0,
    };
    if (o.player) c.cursor = CR.G.upload(R.gl, CR.cursorMesh('#3ff0ff'));
    return c;
  }

  // ---------- setup ----------
  // opts: { mode: 'race'|'tt'|'ko'|'attract', track (index), reversed, laps, ai (skill), player: {car, paint, up}, rivals: [..], onEnd }
  Game.start = function (opts) {
    Game.stop();
    Game.opts = opts; Game.mode = opts.mode;
    const def = CR.TRACKS[opts.track];
    const world = new CR.World(def, !!opts.reversed, { clean: opts.hazards === false });
    R.setWorld(world);
    Game.world = world;
    Game.cars = []; Game.parts = []; Game.skids = []; Game.motes = [];
    const diffMul = [0.84, 1, 1.06][Game.settings.difficulty] ?? 1; // Easy: rivals top out about 16% slower
    if (opts.mode !== 'attract') {
      const p = opts.player;
      Game.player = makeCar({ id: 0, name: 'You', player: true, car: p.car, paint: p.paint, acc: CR.CARS.find((c) => c.id === p.car).paints[1], up: p.up });
      Game.cars.push(Game.player);
    } else Game.player = null;
    if (opts.mode !== 'tt') {
      const rv = opts.rivals || CR.RIVALS.slice(0, 3);
      rv.forEach((r, i) => Game.cars.push(makeCar({ id: i + 1, name: r.name, car: r.car, paint: r.paint, acc: r.acc, skill: (opts.ai || 1) * diffMul * (0.97 + (rv.length > 1 ? i / (rv.length - 1) : 1) * 0.045), up: r.up })));
      if (opts.mode === 'attract') Game.cars.push(makeCar({ id: 9, name: 'Zip', car: 'zip', paint: '#ff4d5e', acc: '#ffd43b', skill: 0.95 }));
    }
    Game.laps = opts.laps || 3;
    Game.items = !!opts.items;
    // opts.grid: driver names in starting order ("You" for the player); anyone not named lines up behind
    if (opts.grid) { const pos = (c) => { const i = opts.grid.indexOf(c.isPlayer ? 'You' : c.name); return i < 0 ? 999 : i; }; Game.cars.sort((a, b) => pos(a) - pos(b)); }
    Game.placeGrid();
    Game.pulses = [];
    X().reset(Game);
    Game.time = 0; Game.raceT = 0; Game.count = opts.mode === 'attract' ? 0 : 3.2; Game.state = opts.mode === 'attract' ? 'race' : 'count';
    Game.lastCount = 4; Game.endT = 0; Game.results = null; Game.messages = [];
    Game.ko = opts.mode === 'ko' ? { target: opts.koTarget || 4, round: 1, between: 0, regroup: 0, grace: 2 } : null;
    // ghost (time trial)
    Game.ghost = null; Game.rec = [];
    if (opts.mode === 'tt' && opts.ghost) Game.ghost = { data: opts.ghost, mesh: CR.G.upload(R.gl, CR.carMesh(Game.player.def.id, '#ffffff', '#3ff0ff')), m: new Float32Array(16) };
    // camera
    const lead = Game.player || Game.cars[0];
    R.cam.x = lead.x; R.cam.y = lead.y; R.cam.pitch = 0.98; R.cam.fov = 0.5; R.cam.yaw = 0; R.cam.shake = 0; R.cam.flash = 0;
    Game.camT = { x: lead.x, y: lead.y };
    Game.intro = opts.mode === 'attract' ? 0 : 1;
    Game.on = true; Game.paused = false;
    for (let i = 0; i < 26; i++) Game.motes.push({ x: lead.x + (Math.random() - 0.5) * 900, y: lead.y + (Math.random() - 0.5) * 700, z: 20 + Math.random() * 160, p: Math.random() * 6 });
  };
  Game.stop = function () {
    if (!Game.cars) return;
    for (const c of Game.cars) { CR.G.free(R.gl, c.mesh); if (c.cursor) CR.G.free(R.gl, c.cursor); }
    if (Game.ghost) CR.G.free(R.gl, Game.ghost.mesh);
    Game.cars = []; Game.on = false; Audio.engine(0, 0, false, false);
  };

  Game.placeGrid = function (aroundS = null, keepOrder = false) {
    const w = Game.world, slots = w.gridSlots();
    const list = keepOrder ? Game.cars.slice() : Game.cars.slice();
    list.forEach((c, i) => {
      const sl = slots[i % slots.length];
      const base = aroundS == null ? 0 : aroundS;
      const p = w.at(base + sl[0]);
      c.x = p.x - p.ty * sl[1]; c.y = p.y + p.tx * sl[1]; c.h = Math.atan2(p.ty, p.tx);
      c.vx = c.vy = c.vz = 0; c.z = 0; c.air = false; c.state = 'race'; c.inv = 0; c.out = false; c.outT = 0;
      c.ix = w.nearestLocal(c.x, c.y, p.i, 4); c.s = w.project(c.x, c.y, c.ix).s;
      if (aroundS == null) { c.prog = c.s > w.L / 2 ? c.s - w.L : c.s; c.lap = 0; }
      c.goodS = c.s; c.goodI = c.ix; c.skidL = c.skidR = null;
    });
  };

  // ---------- main update ----------
  const FIXED = 1 / 120;
  Game.update = function (dt) {
    if (!Game.on || Game.paused) return;
    Game.time += dt;
    Game.acc = (Game.acc || 0) + Math.min(dt, 0.05);
    while (Game.acc >= FIXED) { step(FIXED); Game.acc -= FIXED; }
    updateParts(dt);
    updateCamera(dt);
    if (Game.player && Game.state !== 'done') {
      const p = Game.player, spd = Math.hypot(p.vx, p.vy) / p.st.top;
      Audio.engine(spd, Game.state === 'count' ? Math.max(0.3, Game.input.throttle) : Game.input.throttle || 0.2, p.boosting, p.state === 'race' && !p.out);
      Audio.skid(p.air || p.state !== 'race' ? 0 : U.clamp((p.slip - 45) / 120, 0, 1));
    } else Audio.engine(0, 0, false, false);
  };

  function step(dt) {
    const w = Game.world;
    if (Game.state === 'count') {
      Game.count -= dt; Game.intro = Math.max(0, Game.count / 3.2);
      const n = Math.ceil(Game.count);
      if (n < Game.lastCount && n >= 0) { Game.lastCount = n; if (n > 0) { Audio.play('count'); Game.msg(String(n), 0.8, 'count'); } }
      if (Game.player) { const I = Game.input; X().countInput(Game.player, Game.count, Math.max(I.throttle, I.stick && I.stick.on ? I.stick.mag : 0)); }
      if (Game.count <= 0) { Game.state = 'race'; Audio.play('go'); Game.msg('GO!', 0.9, 'go'); Game.raceT = 0; for (const c of Game.cars) c.lapStart = 0; X().onGo(); }
      for (const c of Game.cars) { physics(c, dt, { steer: 0, throttle: 0, brake: 1, boost: false }); }
      return;
    }
    if (Game.ko && Game.ko.regroup > 0) {
      Game.ko.regroup -= dt;
      if (Game.ko.regroup <= 0) koRegroup();
    }
    if (Game.ko && Game.ko.between > 0) {
      Game.ko.between -= dt;
      for (const c of Game.cars) physics(c, dt, { steer: 0, throttle: 0, brake: 1, boost: false });
      if (Game.ko.between <= 0) { Audio.play('go'); Game.msg('GO!', 0.8, 'go'); }
      return;
    }
    Game.raceT += dt;
    for (const c of Game.cars) {
      if (Game.ko && c.out) continue;
      let inp;
      if (c.isPlayer && !c.finished && Game.state !== 'done' && !Game.autopilot) inp = playerInput(c);
      else inp = aiInput(c, dt);
      inp = X().filterInput(c, inp, dt);
      physics(c, dt, inp);
      progress(c, dt);
    }
    X().step(dt);
    collideCars(dt);
    ballsStep(dt);
    for (let i = Game.pulses.length - 1; i >= 0; i--) { Game.pulses[i].t -= dt; if (Game.pulses[i].t <= 0) Game.pulses.splice(i, 1); }
    if (Game.ko) koCheck(dt);
    // ghost recording (time trial)
    if (Game.mode === 'tt' && Game.player && !Game.player.finished) {
      Game.recT = (Game.recT || 0) + dt;
      if (Game.recT >= 1 / 15) { Game.recT = 0; const p = Game.player; Game.rec.push(Math.round(p.x), Math.round(p.y), Math.round(p.h * 100), Math.round(p.z)); }
    }
    // end of race
    if (Game.mode !== 'attract' && !Game.ko && Game.state === 'race') {
      const p = Game.player;
      if (p.finished) { Game.state = 'done'; Game.endT = 0; }
    }
    if (Game.state === 'done') {
      Game.endT += dt;
      const allDone = Game.cars.every((c) => c.finished);
      if (Game.endT > 7 || (allDone && Game.endT > 2.2)) finish();
    }
  }

  // ---------- input ----------
  function playerInput(c) {
    const I = Game.input;
    let steer = I.steer, throttle = I.throttle, brake = I.brake;
    if (I.stick && I.stick.on) {
      // point the thumb where you want to go (screen up = north)
      const want = Math.atan2(I.stick.y, I.stick.x) + (R.cam.yaw || 0) * 0;
      const d = U.angDiff(c.h, want);
      steer = U.clamp(d * 2.4, -1, 1);
      throttle = Math.max(throttle, U.clamp(I.stick.mag * 1.4, 0, 1) * (Math.abs(d) > 2.7 && I.stick.mag > 0.5 ? 0.6 : 1));
    }
    if (I.item && !Game.itemLatch) { Game.itemLatch = true; X().use(c); }
    if (!I.item) Game.itemLatch = false;
    return { steer, throttle, brake, boost: I.boost };
  }

  function aiInput(c, dt) {
    const w = Game.world, a = c.ai || (c.ai = { lane: 0, laneT: 0, skill: 1, stuckT: 0, revT: 0, wob: 0, globalT: 0 });
    const spd = Math.hypot(c.vx, c.vy);
    const skill = a.skill * rubber(c);
    // lane drift + avoidance
    a.laneT -= dt;
    if (a.laneT <= 0) { a.laneT = 1.5 + Math.random() * 2.5; a.laneGoal = (Math.random() - 0.5) * 0.7; }
    a.lane += ((a.laneGoal ?? 0) - a.lane) * Math.min(1, dt * 0.8);
    for (const o of Game.cars) {
      if (o === c || o.out) continue;
      const dx = o.x - c.x, dy = o.y - c.y, d = Math.hypot(dx, dy);
      if (d > 70 || d < 1) continue;
      const fwd = (dx * Math.cos(c.h) + dy * Math.sin(c.h)) / d;
      if (fwd > 0.6) { const side = -dx * Math.sin(c.h) + dy * Math.cos(c.h); a.lane += (side > 0 ? -1 : 1) * dt * 1.2; }
    }
    a.lane = U.clamp(a.lane, -0.62, 0.62);
    const look = 46 + spd * 0.42;
    const tp = w.at(c.s + look), off = a.lane * w.hw + Math.sin(Game.time * 0.7 + a.wob) * 6 * (2 - skill);
    const tx = tp.x - tp.ty * off, ty = tp.y + tp.tx * off;
    const want = Math.atan2(ty - c.y, tx - c.x);
    let d = U.angDiff(c.h, want);
    let steer = U.clamp(d * 2.6, -1, 1), throttle = 1, brake = 0, boost = false;
    // corner speed from curvature ahead
    let cmax = 0; const i0 = Math.floor(c.s / 8);
    for (let k = 4; k < 8 + spd * 0.12; k += 2) cmax = Math.max(cmax, w.curv[(i0 + k) % w.N]);
    const latA = 520 + c.st.grip * 75;
    const vt = U.clamp(Math.sqrt(latA / Math.max(cmax, 0.0001)), 140, 9999) * (0.9 + skill * 0.1);
    if (spd > vt + 25) { throttle = 0; brake = spd > vt + 70 ? 1 : 0.35; } else if (spd > vt) throttle = 0.4;
    if (Math.abs(d) > 1.2 && spd > 150) { throttle = 0.2; brake = 0.6; }
    if (c.boost > 0.35 && cmax < 0.0016 && spd > 170 && Math.abs(d) < 0.15) boost = true;
    if (c.boosting && cmax > 0.003) boost = false;
    // stuck recovery
    if (spd < 22 && Game.state !== 'count') a.stuckT += dt; else a.stuckT = Math.max(0, a.stuckT - dt * 2);
    if (a.stuckT > 1.1) { a.revT = 0.8; a.stuckT = 0; a.stuckN = (a.stuckN || 0) + 1; if (a.stuckN > 3) { respawn(c); a.stuckN = 0; } }
    if (a.revT > 0) { a.revT -= dt; return { steer: -steer, throttle: 0, brake: 1, boost: false }; }
    if (spd > 60) a.stuckN = 0;
    // a rival that has been off the road for a while (fenced in by props, say) is put back on it
    a.offT = Math.abs(c.lat) > w.hw + 6 && !c.air ? (a.offT || 0) + dt : 0;
    if (a.offT > 3) { a.offT = 0; respawn(c); }
    c.aiTop = skill;
    return X().aiAdjust(c, { steer, throttle, brake, boost }, dt);
  }
  function rubber(c) {
    if (!Game.player || Game.mode === 'attract' || Game.ko) return 1;
    const gap = c.prog - Game.player.prog;
    if (Game.player.finished) return 1.02;
    const easy = Game.settings.difficulty === 0; // on Easy, rivals who fall behind barely catch up
    if (gap < -350) return easy ? 1.02 : 1.07; if (gap < -150) return easy ? 1.0 : 1.03; if (gap > 500) return 0.93; if (gap > 250) return 0.97;
    return 1;
  }

  // ---------- physics ----------
  function physics(c, dt, inp) {
    const w = Game.world, st = c.st;
    if (c.inv > 0) c.inv -= dt;
    if (c.state === 'fall') {
      c.fallT += dt; c.vz -= GRAV * dt; c.z += c.vz * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.vx *= 0.99; c.vy *= 0.99;
      c.h += c.spin * dt;
      if (c.z < w.floorY + FLOOR_PAD) { c.z = w.floorY + FLOOR_PAD; c.vx *= 0.8; c.vy *= 0.8; if (c.vz < -200) emit('dust', c.x, c.y, c.z, 6); c.vz = 0; }
      if (c.fallT > 1.25) { if (Game.ko) knockOut(c, 'fell'); else respawn(c); }
      return;
    }
    const fx = Math.cos(c.h), fy = Math.sin(c.h), rx = -fy, ry = fx;
    let vf = c.vx * fx + c.vy * fy, vl = c.vx * rx + c.vy * ry;
    const surf = c.air ? null : w.surface(c.x, c.y, c.lat);
    let topMul = 1, grip = 1;
    if (surf) {
      if (surf.type === 'void') { startFall(c); return; }
      topMul = surf.top; grip = surf.grip;
      if (surf.type === 'rough') topMul = U.lerp(surf.top, 1, st.offroad * 0.75);
      if (st.hover && (surf.type === 'slick' || surf.type === 'sticky')) { topMul = 1; grip = 0.8; }
      if (surf.type === 'boost' && c.padT <= 0.3) { if (c.padT <= 0) { if (c.isPlayer) { Audio.play('pad'); Audio.vibrate(15); } } c.padT = 0.75; }
      if (surf.type === 'slick' && !st.hover && Math.abs(vl) > 30 && Math.random() < 0.3) emit('splash', c.x, c.y, 2, 1);
      c.surf = surf.type;
    }
    if (c.padT > 0) c.padT -= dt;
    // boost
    c.boosting = false;
    if ((inp.boost && c.boost > 0.02) || c.padT > 0) {
      c.boosting = true;
      if (c.padT <= 0) c.boost = Math.max(0, c.boost - st.boostDrain * dt);
      if (c.isPlayer && !c.wasBoost && c.padT <= 0) Audio.play('boost');
    }
    c.wasBoost = c.boosting;
    const top = st.top * topMul * (c.boosting ? st.boostPow : 1) * (c.aiTop || 1) * (1 + 0.07 * (c.draft || 0)) * (Game.state === 'count' ? 0 : 1);
    if (!c.air) {
      // engine / brakes
      const acc = st.accel * (c.boosting ? 1.6 : 1);
      if (inp.throttle > 0 && top > 0) vf += acc * inp.throttle * (1 - vf / top) * dt;
      else vf -= vf * 0.65 * dt;
      if (topMul < 1 && vf > top) vf -= (vf - top) * 2.2 * dt;
      if (inp.brake > 0) {
        if (vf > 15) vf -= 760 * inp.brake * dt;
        else if (Game.state !== 'count') vf = Math.max(-st.top * 0.38, vf - st.accel * 0.6 * inp.brake * dt);
        else vf *= 0.9;
      }
      // grip: braking while turning lets the tail slide (that's the drift)
      const drift = inp.brake > 0 && Math.abs(inp.steer) > 0.3 && vf > 120;
      const g = st.grip * grip * (drift ? 0.35 : 1);
      vl *= Math.exp(-g * dt);
      // steering
      const sp = Math.abs(vf), turnK = U.clamp(sp / 85, 0, 1) * (1 - 0.28 * U.clamp(sp / st.top, 0, 1)) * (drift ? 1.35 : 1);
      c.h += inp.steer * st.turn * turnK * (vf >= 0 ? 1 : -1) * dt;
      c.slip = Math.abs(vl) + (inp.brake > 0 && vf > 120 ? 40 : 0);
      // drifting fills the boost meter
      if (Math.abs(vl) > 38 && vf > 110 && grip > 0.5) c.boost = Math.min(1, c.boost + dt * 0.3 * st.charge * U.clamp((Math.abs(vl) - 30) / 90, 0.2, 1));
    } else {
      c.h += inp.steer * 1.1 * dt; c.slip = 0;
    }
    c.steerVis += (inp.steer - c.steerVis) * Math.min(1, dt * 10);
    c.vx = fx * vf + rx * vl; c.vy = fy * vf + ry * vl;
    // integrate
    const ox = c.x, oy = c.y;
    c.x += c.vx * dt; c.y += c.vy * dt;
    // ramps + air
    if (!c.air) {
      const rh = w.rampHeight(c.x, c.y);
      if (rh) { c.z = rh.h; c.onRamp = true; c.rampSlope = rh.slope; }
      else if (c.onRamp) {
        c.onRamp = false;
        if (vf > 90) { c.air = true; c.vz = vf * 0.5 + 40; if (c.isPlayer) Audio.play('jump'); }
        else c.z = 0;
      } else c.z = st.hover ? 0 : 0;
    } else {
      c.vz -= GRAV * dt; c.z += c.vz * dt;
      if (c.z <= 0) {
        c.z = 0; c.air = false; c.landed = true;
        const s2 = w.surface(c.x, c.y, c.lat);
        if (c.vz < -120) { emit('dust', c.x, c.y, 1, 8); if (c.isPlayer) { Audio.play('land'); shake(5); Audio.vibrate(20); } }
        c.vz = 0;
        if (s2.type === 'void') { startFall(c); return; }
      }
    }
    staticCollide(c, ox, oy);
    if (c.onSoft && !c.air) {
      // bumping over clutter: lose speed fast (off-road cars cope better), rattle the car about
      const k = Math.exp(-(5.5 - 3 * (st.offroad || 0)) * dt); c.vx *= k; c.vy *= k;
      c.bumpT = 0.15;
      if (Math.random() < 0.3) emit('dust', c.x, c.y, 2, 1);
      if (c.isPlayer) { Audio.play('rumble'); if (Math.random() < 0.1) shake(1.5); }
    }
    if (c.bumpT > 0) c.bumpT -= dt;
    // visuals: pitch with accel, roll with cornering
    const ap = c.onRamp ? -Math.atan(c.rampSlope || 0) : (c.air ? U.clamp(c.vz / 900, -0.35, 0.3) * -1 : 0);
    c.vis.pitch += ((c.onRamp || c.air ? ap : -inp.throttle * 0.03 + (inp.brake > 0 ? 0.05 : 0)) - c.vis.pitch) * Math.min(1, dt * 8);
    c.vis.roll += (U.clamp(vl / 600, -0.12, 0.12) - c.vis.roll) * Math.min(1, dt * 8);
    // effects
    if (!c.air && c.state === 'race') {
      const spd = Math.hypot(c.vx, c.vy);
      if (c.slip > 55 && spd > 60) skid(c, true); else skid(c, false);
      if (c.slip > 70 && Math.random() < 0.4) emit(c.surf === 'rough' || c.surf === 'sticky' ? 'dust' : 'smoke', c.x - fx * 12, c.y - fy * 12, 2, 1);
      if (c.surf === 'rough' && spd > 120 && Math.random() < 0.25) emit('dust', c.x - fx * 12, c.y - fy * 12, 1, 1);
      if (c.boosting && Math.random() < 0.9) emit('flame', c.x - fx * 17, c.y - fy * 17, 5 + c.z, 1, c);
    } else skid(c, false);
  }

  function startFall(c) {
    c.state = 'fall'; c.fallT = 0; c.vz = 30; c.spin = (Math.random() - 0.5) * 6; c.air = false; c.onRamp = false;
    skid(c, false);
    if (c.isPlayer) { Audio.play('fall'); Audio.vibrate(40); Game.msg('OOPS!', 1, 'warn'); }
  }
  // Put a car back on the road. Normally where it last was on the road; if it has got further along
  // (it jumped over a barrier further up the track), at the spot level with it, so nobody loses ground.
  function respawn(c, forward = false) {
    const w = Game.world;
    let at = (c.goodS ?? c.s) - 20;
    if (forward && c.goodS != null) { let ds = c.s - c.goodS; if (ds < -w.L / 2) ds += w.L; if (ds > w.L / 2) ds -= w.L; if (ds > 0 && ds < 600) at = c.s + 10; }
    const s = X().safeS(at);
    const p = w.at(s);
    c.x = p.x; c.y = p.y; c.h = Math.atan2(p.ty, p.tx); c.z = 0; c.vx = c.vy = c.vz = 0; c.air = false; c.onRamp = false;
    // nudge sideways if another car sits on the spot
    for (const o of Game.cars) if (o !== c && Math.hypot(o.x - c.x, o.y - c.y) < 26) { c.x -= p.ty * 30; c.y += p.tx * 30; }
    c.state = 'race'; c.inv = 1.6; c.ix = w.nearestLocal(c.x, c.y, p.i, 6);
    const pr = w.project(c.x, c.y, c.ix); let ds = pr.s - c.s; if (ds > w.L / 2) ds -= w.L; if (ds < -w.L / 2) ds += w.L;
    c.prog += ds; c.s = pr.s;
    emit('poof', c.x, c.y, 8, 10);
    if (c.isPlayer) Audio.play('respawn');
  }

  function staticCollide(c, ox, oy) {
    const w = Game.world;
    c.onSoft = false;
    for (const k of w.collidersNear(c.x, c.y)) {
      if (c.z > k.h) continue;
      let nx, ny, pen;
      if (k.r) {
        const dx = c.x - k.x, dy = c.y - k.y, d = Math.hypot(dx, dy), rr = k.r + CAR_R;
        if (d >= rr || d === 0) continue;
        nx = dx / d; ny = dy / d; pen = rr - d;
      } else {
        const dx = c.x - k.x, dy = c.y - k.y, u = dx * k.c + dy * k.s, v = -dx * k.s + dy * k.c;
        const cu = U.clamp(u, -k.hw, k.hw), cv = U.clamp(v, -k.hd, k.hd);
        let lu = u - cu, lv = v - cv, d = Math.hypot(lu, lv);
        if (d >= CAR_R) continue;
        if (d < 0.001) { // centre inside the box: push out the short way
          const pu = k.hw - Math.abs(u), pv = k.hd - Math.abs(v);
          if (pu < pv) { lu = Math.sign(u) || 1; lv = 0; pen = pu + CAR_R; } else { lu = 0; lv = Math.sign(v) || 1; pen = pv + CAR_R; }
          d = 1;
        } else pen = CAR_R - d;
        const nu = lu / d, nv = lv / d; nx = nu * k.c - nv * k.s; ny = nu * k.s + nv * k.c;
      }
      if (k.soft) { c.onSoft = true; continue; } // drive-over clutter: slows you (below), doesn't stop you
      c.x += nx * pen; c.y += ny * pen;
      const vn = c.vx * nx + c.vy * ny;
      if (k.bumper) { if (vn < 0) { c.vx -= vn * nx; c.vy -= vn * ny; } if (!k.cool || Game.time - k.cool > 0.15) { k.cool = Game.time; X().bumper(c, k, nx, ny); } continue; }
      if (vn < 0) {
        c.vx -= 1.35 * vn * nx; c.vy -= 1.35 * vn * ny;
        c.vx *= 0.9; c.vy *= 0.9;
        if (vn < -70) {
          emit('spark', c.x - nx * CAR_R, c.y - ny * CAR_R, 6, Math.min(10, -vn / 25));
          if (c.isPlayer) { Audio.play('wall', { vol: Math.min(1, -vn / 250) }); shake(Math.min(7, -vn / 50)); Audio.vibrate(15); }
        }
      }
    }
  }

  function collideCars() {
    const cs = Game.cars;
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
      const a = cs[i], b = cs[j];
      if (a.state !== 'race' || b.state !== 'race' || a.inv > 0 || b.inv > 0 || a.out || b.out) continue;
      if (Math.abs(a.z - b.z) > 14) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), rr = CAR_R * 2;
      if (d >= rr || d === 0) continue;
      const nx = dx / d, ny = dy / d, pen = rr - d, ma = a.st.mass, mb = b.st.mass, tot = ma + mb;
      a.x -= nx * pen * (mb / tot); a.y -= ny * pen * (mb / tot); b.x += nx * pen * (ma / tot); b.y += ny * pen * (ma / tot);
      const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rv < 0) {
        const jimp = -(1.55) * rv / (1 / ma + 1 / mb);
        // a shield takes no push and gives a double one
        const sa = a.shieldT > 0, sb = b.shieldT > 0, ka = sa && !sb ? 0 : sb && !sa ? 2 : 1, kb = sb && !sa ? 0 : sa && !sb ? 2 : 1;
        a.vx -= (jimp / ma) * nx * ka; a.vy -= (jimp / ma) * ny * ka; b.vx += (jimp / mb) * nx * kb; b.vy += (jimp / mb) * ny * kb;
        if ((sa || sb) && rv < -40) { emit('spark', a.x + nx * CAR_R, a.y + ny * CAR_R, 8, 6); if (a.isPlayer || b.isPlayer) Audio.play('shield', { vol: 0.6 }); }
        if (rv < -50) {
          emit('spark', a.x + nx * CAR_R, a.y + ny * CAR_R, 7, Math.min(8, -rv / 30));
          if (a.isPlayer || b.isPlayer) { Audio.play('bump', { vol: Math.min(1, -rv / 200) }); shake(Math.min(6, -rv / 60)); Audio.vibrate(12); }
        }
      }
    }
    // cars vs balls
    for (const c of cs) for (const b of Game.world.balls) {
      if (c.state !== 'race' || b.out > 0 || c.z > 18) continue;
      const dx = b.x - c.x, dy = b.y - c.y, d = Math.hypot(dx, dy), rr = CAR_R + b.r;
      if (d >= rr || d === 0) continue;
      const nx = dx / d, ny = dy / d, pen = rr - d, tot = c.st.mass + b.mass;
      c.x -= nx * pen * (b.mass / tot); c.y -= ny * pen * (b.mass / tot); b.x += nx * pen * (c.st.mass / tot); b.y += ny * pen * (c.st.mass / tot);
      const rv = (b.vx - c.vx) * nx + (b.vy - c.vy) * ny;
      if (rv < 0) {
        const jimp = -1.8 * rv / (1 / c.st.mass + 1 / b.mass);
        c.vx -= (jimp / c.st.mass) * nx; c.vy -= (jimp / c.st.mass) * ny; b.vx += (jimp / b.mass) * nx; b.vy += (jimp / b.mass) * ny;
        if (c.isPlayer && rv < -60) { Audio.play('bump', { vol: 0.8 }); shake(3); }
      }
    }
  }

  function ballsStep(dt) {
    const w = Game.world, bs = w.balls;
    for (const b of bs) {
      if (b.out > 0) { b.out -= dt; b.z -= 400 * dt; if (b.out <= 0) { b.x = b.hx; b.y = b.hy; b.z = 0; b.vx = b.vy = 0; emit('poof', b.x, b.y, 10, 8); } continue; }
      b.x += b.vx * dt; b.y += b.vy * dt;
      const k = Math.exp(-0.9 * dt); b.vx *= k; b.vy *= k;
      const sp = Math.hypot(b.vx, b.vy); if (sp > 1) { b.dir = Math.atan2(b.vy, b.vx); b.rot -= sp * dt / b.r; }
      for (const h of w.holes) if (Math.hypot(b.x - h.x, b.y - h.y) < h.r - 4) { b.out = 3; Audio.play('splash', { vol: 0.4 }); }
      for (const col of w.collidersNear(b.x, b.y)) {
        if (col.soft) continue;
        if (col.r) { const dx = b.x - col.x, dy = b.y - col.y, d = Math.hypot(dx, dy), rr = col.r + b.r; if (d < rr && d > 0) { const nx = dx / d, ny = dy / d; b.x += nx * (rr - d); b.y += ny * (rr - d); const vn = b.vx * nx + b.vy * ny; if (vn < 0) { b.vx -= 1.8 * vn * nx; b.vy -= 1.8 * vn * ny; } } }
        else {
          const dx = b.x - col.x, dy = b.y - col.y, u = dx * col.c + dy * col.s, v = -dx * col.s + dy * col.c;
          const cu = U.clamp(u, -col.hw, col.hw), cv = U.clamp(v, -col.hd, col.hd), lu = u - cu, lv = v - cv, d = Math.hypot(lu, lv);
          if (d < b.r && d > 0.001) { const nu = lu / d, nv = lv / d, nx = nu * col.c - nv * col.s, ny = nu * col.s + nv * col.c; b.x += nx * (b.r - d); b.y += ny * (b.r - d); const vn = b.vx * nx + b.vy * ny; if (vn < 0) { b.vx -= 1.8 * vn * nx; b.vy -= 1.8 * vn * ny; } }
        }
      }
    }
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i], b = bs[j]; if (a.out > 0 || b.out > 0) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), rr = a.r + b.r;
      if (d >= rr || d === 0) continue;
      const nx = dx / d, ny = dy / d; a.x -= nx * (rr - d) / 2; a.y -= ny * (rr - d) / 2; b.x += nx * (rr - d) / 2; b.y += ny * (rr - d) / 2;
      const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rv < 0) { a.vx += rv * nx * 0.95; a.vy += rv * ny * 0.95; b.vx -= rv * nx * 0.95; b.vy -= rv * ny * 0.95; if (rv < -80) Audio.play('bump', { vol: 0.35 }); }
    }
  }

  // ---------- lap progress ----------
  function progress(c, dt) {
    const w = Game.world;
    if (c.state !== 'race') return;
    c.ix = w.nearestLocal(c.x, c.y, c.ix);
    c.globalT -= dt;
    if (c.globalT <= 0) { // catch shortcuts and spins across the infield
      c.globalT = 0.3;
      const g = w.nearestGlobal(c.x, c.y);
      const dl = Math.hypot(w.px[c.ix] - c.x, w.py[c.ix] - c.y);
      if (g.i >= 0 && g.d < dl - 50) {
        let ds = w.project(c.x, c.y, g.i).s - c.s; if (ds > w.L / 2) ds -= w.L; if (ds < -w.L / 2) ds += w.L;
        if (ds > -250 && ds < w.L * 0.22) c.ix = g.i;
      }
    }
    const pr = w.project(c.x, c.y, c.ix);
    let ds = pr.s - c.s; if (ds > w.L / 2) ds -= w.L; if (ds < -w.L / 2) ds += w.L;
    c.prog += ds; c.s = pr.s; c.lat = pr.lat;
    if (Math.abs(pr.lat) < w.hw && !c.air) { c.goodS = c.s; }
    rescueCheck(c, dt);
    // wrong way
    const tdot = Math.cos(c.h) * w.tx[c.ix] + Math.sin(c.h) * w.ty[c.ix];
    const sp = c.vx * w.tx[c.ix] + c.vy * w.ty[c.ix];
    if (tdot < -0.4 && sp < -30) c.wrongT += dt; else c.wrongT = Math.max(0, c.wrongT - dt * 2);
    if (c.isPlayer && c.wrongT > 1 && !Game.ko) { if (!c.wrongShown || Game.time - c.wrongShown > 2.5) { c.wrongShown = Game.time; Game.msg('WRONG WAY', 1.6, 'warn'); Audio.play('wrong'); } }
    if (Game.ko || Game.mode === 'attract') return;
    const lapNow = Math.floor(c.prog / w.L);
    if (lapNow > c.lap && !c.finished) {
      c.lap = lapNow;
      const lt = Game.raceT - c.lapStart; c.lapStart = Game.raceT; c.lapTimes.push(lt);
      const best = c.bestLap == null || lt < c.bestLap; if (best) c.bestLap = lt;
      if (c.lap >= Game.laps) {
        c.finished = true; c.finishTime = Game.raceT;
        if (c.isPlayer) { Game.msg('FINISH!', 2.2, 'go'); Audio.play(place(c) === 1 ? 'win' : 'lap'); emit('confetti', c.x, c.y, 30, 60); }
      } else if (c.isPlayer) {
        if (c.lap === Game.laps - 1) { Game.msg('FINAL LAP', 1.6, 'info'); Audio.play('final'); Audio.setIntensity(1); } else { Game.msg(`LAP ${c.lap + 1}`, 1.2, 'info'); Audio.play('lap'); }
      }
      if (c.isPlayer && Game.mode === 'tt') {
        const prev = Game.opts.bestLap;
        if (prev == null || lt < prev) { Game.opts.bestLap = lt; Game.newGhost = Game.rec.slice(Game.recLapStart || 0); Game.newGhostTime = lt; if (prev != null) { Game.msg('NEW BEST LAP!', 1.6, 'go'); Audio.play('best'); } }
        Game.recLapStart = Game.rec.length;
        Game.ghostT0 = Game.raceT;
      }
    }
  }
  // Cars fenced in off the road (a jump over the barrier, a spin into the scenery) get put back.
  // Landing a jump outside the barrier: back on the road almost at once. Stuck off the road and
  // not getting anywhere for a few seconds: same. Anyone can also ask for it (pause menu, R key).
  function offRoad(c) {
    const w = Game.world, edge = w.hw + 26;
    if (c.air || Math.abs(c.lat) <= edge) return false;
    return !w.def.cross || w.nearestGlobal(c.x, c.y, edge + 100).d > edge; // the other stretch at a crossing is road
  }
  function rescueCheck(c, dt) {
    if (c.landed) {
      c.landed = false;
      // over a wall you can't drive back through: straight back to the road. Over drive-over clutter, drive yourself back.
      if (Game.world.hardBorder && offRoad(c)) { c.strandT = 0.6; if (c.isPlayer) Game.msg('BACK ON TRACK', 0.9, 'info'); }
    }
    if (c.strandT > 0) { c.strandT -= dt; c.vx *= 0.9; c.vy *= 0.9; if (c.strandT <= 0) respawn(c, true); return; }
    if (offRoad(c)) {
      if (!c.offT) { c.offT = 0; c.offProg = c.prog; }
      c.offT += dt;
      if (c.offT > 3 && c.prog - c.offProg < 120) { c.offT = 0; if (c.isPlayer) Game.msg('BACK ON TRACK', 0.9, 'info'); respawn(c, true); }
      else if (c.offT > 3) { c.offT = 0.01; c.offProg = c.prog; } // still making headway: check again in a moment
    } else c.offT = 0;
  }
  Game.rescue = function () { const p = Game.player; if (p && p.state === 'race' && !p.finished && !(Game.ko && p.out) && Game.state === 'race') { respawn(p); Game.msg('BACK ON TRACK', 0.9, 'info'); } };

  function place(c) {
    const order = Game.standings();
    return order.indexOf(c) + 1;
  }
  Game.standings = function () {
    return Game.cars.slice().sort((a, b) => {
      if (Game.ko) { if (a.out !== b.out) return a.out ? 1 : -1; return b.prog - a.prog; }
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return b.prog - a.prog;
    });
  };

  // ---------- knockout ----------
  function koLeader() { let best = null; for (const c of Game.cars) if (!c.out && (!best || c.prog > best.prog)) best = c; return best; }
  function koCheck(dt) {
    if (Game.ko.between > 0 || Game.ko.regroup > 0) return;
    if (Game.ko.grace > 0) { Game.ko.grace -= dt; return; }
    const cam = R.cam, sd = cam.dist; cam.dist = cam.distShow || cam.dist; const sh = cam.shake; cam.shake = 0; R.camMatrices(); cam.dist = sd; cam.shake = sh;
    for (const c of Game.cars) {
      if (c.out || c.state === 'fall') continue;
      const p = R.project(c.x, c.y, c.z);
      const off = Math.abs(p[0]) > 1.04 || p[1] < -1.06 || p[1] > 1.08 || p[2] < 0;
      c.outT = off ? c.outT + dt : 0;
      if (c.outT > 0.2) knockOut(c, 'left behind');
    }
  }
  function knockOut(c, why) {
    if (c.out) return;
    c.out = true; c.state = 'race'; Audio.play('ko'); emit('poof', c.x, c.y, Math.max(c.z, 4), 14);
    if (c.isPlayer) { Game.msg('KNOCKED OUT', 1.4, 'warn'); Audio.vibrate(60); } else Game.msg(`${c.name} OUT`, 1.1, 'info');
    const alive = Game.cars.filter((k) => !k.out);
    if (alive.length === 2) Audio.setIntensity(1);
    if (alive.length <= 1) {
      const win = alive[0] || c;
      win.points++;
      Game.lastRoundWinner = win;
      if (win.points >= Game.ko.target) { Game.msg(win.isPlayer ? 'YOU WIN!' : `${win.name} WINS`, 2.5, 'go'); Game.state = 'done'; Game.endT = 0; for (const k of Game.cars) k.finished = true; if (win.isPlayer) Audio.play('win'); else Audio.play('lose'); return; }
      Game.msg(win.isPlayer ? 'ROUND WON! +1' : `${win.name} +1`, 1.6, win.isPlayer ? 'go' : 'info');
      if (win.isPlayer) Audio.play('best');
      Game.ko.round++;
      Game.ko.regroup = 0.9; Game.ko.winner = win;
    }
  }
  function koRegroup() {
    const win = Game.ko.winner, s = win.s, base = win.prog, L = Game.world.L;
    Game.cars.sort((a, b) => (a === win ? -1 : b === win ? 1 : 0));
    Game.placeGrid(s + 60, true);
    for (const k of Game.cars) { let d = k.s - s; if (d > L / 2) d -= L; if (d < -L / 2) d += L; k.prog = base + d; }
    for (const k of Game.cars) { k.out = false; k.outT = 0; k.boost = Math.max(k.boost, 0.3); }
    Audio.setIntensity(0);
    Game.ko.between = 1.4; Game.ko.grace = 2.2; Game.msg(`ROUND ${Game.ko.round}`, 1.2, 'info');
    Game.camT.x = win.x; Game.camT.y = win.y; R.cam.x = win.x; R.cam.y = win.y;
  }

  // ---------- end ----------
  function finish() {
    if (Game.results) return;
    const order = Game.standings();
    // estimate times for unfinished cars from their progress
    const w = Game.world;
    for (const c of order) if (!c.finished) { const left = Game.laps * w.L - c.prog; c.finishTime = Game.raceT + Math.max(1, left / (c.st.top * 0.75)); c.estimated = true; }
    order.sort((a, b) => Game.ko ? b.points - a.points : a.finishTime - b.finishTime);
    Game.results = {
      mode: Game.mode, order: order.map((c) => ({ name: c.name, isPlayer: c.isPlayer, car: c.def.name, paint: c.paint, time: c.finishTime, best: c.bestLap, est: !!c.estimated, points: c.points })),
      place: order.indexOf(Game.player) + 1,
      bestLap: Game.player ? Game.player.bestLap : null, total: Game.player ? Game.player.finishTime : 0,
      ghost: Game.newGhost ? { data: Game.newGhost, time: Game.newGhostTime } : null,
    };
    Game.on = false; Audio.engine(0, 0, false, false); Audio.skid(0);
    if (Game.opts.onEnd) Game.opts.onEnd(Game.results);
  }

  Game.msg = function (text, dur, kind) { Game.messages.push({ text, t: dur, max: dur, kind }); if (Game.onMsg) Game.onMsg(text, dur, kind); };
  function shake(a) { if (Game.settings.shake) R.cam.shake = Math.max(R.cam.shake, a); }
  Game.shake = shake;
  Game.lightPulse = function (x, y, col) { if (Game.pulses.length < 6) Game.pulses.push({ x, y, col, t: 0.25 }); };

  // ---------- camera ----------
  function updateCamera(dt) {
    const cam = R.cam;
    let lead = Game.player;
    if (Game.mode === 'attract' || Game.ko || (Game.player && Game.player.out)) lead = Game.ko ? (koLeader() || Game.player) : Game.standings()[0];
    if (!lead) return;
    const spd = Math.hypot(lead.vx, lead.vy);
    const la = Game.ko ? 0.45 : 0.32;
    let tx = lead.x + U.clamp(lead.vx * la, -170, 170), ty = lead.y + U.clamp(lead.vy * la, -150, 150);
    if (lead.state === 'fall') { tx = lead.x; ty = lead.y; }
    const k = 1 - Math.exp(-dt * (Game.ko ? 3.2 : 4.5));
    Game.camT.x += (tx - Game.camT.x) * k; Game.camT.y += (ty - Game.camT.y) * k;
    cam.x = Game.camT.x; cam.y = Game.camT.y;
    const baseR = Game.ko ? 250 : 200 + Math.min(spd, 420) * 0.12;
    const want = R.fitDist(baseR);
    cam.dist = cam.dist ? cam.dist + (want - cam.dist) * Math.min(1, dt * 2) : want;
    // intro sweep: start high and swung round, settle behind the grid as the lights count down
    const i = U.smooth(Game.intro || 0);
    cam.pitch = 0.98 + i * 0.25; cam.yaw = i * 0.9;
    if (Game.mode === 'attract') { cam.yaw = Math.sin(Game.time * 0.08) * 0.35; cam.pitch = 1.0 + Math.sin(Game.time * 0.05) * 0.08; }
    cam.distShow = cam.dist * (1 + i * 1.3);
    cam.shake = Math.max(0, cam.shake - dt * 30);
    cam.flash = Math.max(0, (cam.flash || 0) - dt * 2);
  }

  // ---------- particles ----------
  const PCOL = { smoke: [0.85, 0.85, 0.88], dust: null, spark: [1, 0.75, 0.3], flame: [1, 0.55, 0.15], poof: [1, 1, 1], splash: [0.85, 0.95, 1] };
  function emit(kind, x, y, z, n, car) {
    if (Game.parts.length > 700) return;
    const w = Game.world;
    const dust = { breakfast: [0.95, 0.9, 0.8], desk: [0.8, 0.7, 0.55], sandbox: [0.85, 0.72, 0.48], pool: [0.4, 0.75, 0.5], bath: [0.9, 0.95, 1], toybox: [0.6, 0.55, 0.9], garage: [0.8, 0.68, 0.5], computer: [0.5, 0.55, 0.7], bakery: [0.97, 0.95, 0.9], frost: [0.95, 0.98, 1], picnic: [0.9, 0.85, 0.7], town: [0.55, 0.7, 0.4] }[w.def.theme] || [0.85, 0.85, 0.85];
    for (let i = 0; i < n; i++) {
      const p = { x, y, z, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 3, col: PCOL[kind] || dust, add: false, grav: 0, drag: 2, grow: 1, a: 0.6 };
      const a = Math.random() * 6.28, s = Math.random();
      switch (kind) {
        case 'smoke': p.vx = Math.cos(a) * 20; p.vy = Math.sin(a) * 20; p.vz = 20 + s * 20; p.max = 0.6 + s * 0.4; p.size = 4 + s * 3; p.grow = 2.6; p.a = 0.35; break;
        case 'dust': p.col = dust; p.vx = Math.cos(a) * 60 * s; p.vy = Math.sin(a) * 60 * s; p.vz = 30 + s * 50; p.max = 0.5 + s * 0.4; p.size = 3 + s * 3; p.grow = 2; p.a = 0.5; p.grav = 120; break;
        case 'spark': p.vx = Math.cos(a) * 180 * s; p.vy = Math.sin(a) * 180 * s; p.vz = 60 + s * 160; p.max = 0.3 + s * 0.3; p.size = 1.6; p.add = true; p.grav = 700; p.drag = 1; p.a = 1; p.grow = 0.3; break;
        case 'flame': { const h = car.h + Math.PI + (Math.random() - 0.5) * 0.5; p.vx = Math.cos(h) * 120 + car.vx * 0.5; p.vy = Math.sin(h) * 120 + car.vy * 0.5; p.vz = 5; p.max = 0.15 + s * 0.12; p.size = 3 + s * 2; p.add = true; p.a = 0.9; p.grow = 0.4; p.col = s < 0.4 ? [1, 0.9, 0.4] : [1, 0.45, 0.12]; break; }
        case 'poof': p.vx = Math.cos(a) * 90 * s; p.vy = Math.sin(a) * 90 * s; p.vz = 40 + s * 60; p.max = 0.5 + s * 0.3; p.size = 5 + s * 4; p.grow = 2; p.a = 0.7; break;
        case 'splash': p.vx = Math.cos(a) * 50; p.vy = Math.sin(a) * 50; p.vz = 80 + s * 60; p.max = 0.45; p.size = 2.2; p.grav = 500; p.a = 0.8; break;
        case 'wind': { const h = car.h; p.vx = -Math.cos(h) * 260; p.vy = -Math.sin(h) * 260; p.vz = 0; p.max = 0.18; p.size = 1.1; p.a = 0.55; p.col = [1, 1, 1]; p.drag = 0; p.grow = 1; p.add = true; break; }
        case 'ring': { const ang = i / n * Math.PI * 2; p.vx = Math.cos(ang) * 420; p.vy = Math.sin(ang) * 420; p.vz = 10; p.max = 0.45; p.size = 3.2; p.add = true; p.a = 0.9; p.col = [1, 0.85, 0.4]; p.drag = 3; p.grow = 1.5; break; }
        case 'confetti': p.vx = Math.cos(a) * 140 * s; p.vy = Math.sin(a) * 140 * s; p.vz = 200 + s * 200; p.max = 2.2; p.size = 2.6; p.grav = 260; p.drag = 1.5; p.a = 1; p.grow = 1; p.col = [[1, 0.3, 0.4], [1, 0.85, 0.2], [0.3, 0.8, 1], [0.5, 1, 0.4], [0.9, 0.5, 1]][i % 5]; p.add = false; break;
      }
      p.kind = kind;
      Game.parts.push(p);
    }
  }
  Game.emit = emit;
  function updateParts(dt) {
    const ps = Game.parts;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i]; p.life += dt;
      if (p.life >= p.max) { ps[i] = ps[ps.length - 1]; ps.pop(); continue; }
      const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; p.vz -= p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.z < 0.5) { p.z = 0.5; p.vz *= -0.3; }
    }
    // skid fade
    const sk = Game.skids; for (let i = sk.length - 1; i >= 0; i--) { sk[i].t += dt; if (sk[i].t > 9) sk.splice(i, 1); }
    // ambient motes drift around the camera
    for (const m of Game.motes) {
      m.p += dt; m.x += Math.sin(m.p * 0.7) * 6 * dt + 4 * dt; m.y += Math.cos(m.p * 0.5) * 5 * dt; m.z += Math.sin(m.p) * 3 * dt;
      if (Math.abs(m.x - R.cam.x) > 520) m.x = R.cam.x - Math.sign(m.x - R.cam.x) * 500;
      if (Math.abs(m.y - R.cam.y) > 420) m.y = R.cam.y - Math.sign(m.y - R.cam.y) * 400;
    }
  }
  function skid(c, on) {
    if (!on) { c.skidL = c.skidR = null; return; }
    const fx = Math.cos(c.h), fy = Math.sin(c.h), rx = -fy, ry = fx;
    const L = [c.x - fx * 9 + rx * 7, c.y - fy * 9 + ry * 7], Rr = [c.x - fx * 9 - rx * 7, c.y - fy * 9 - ry * 7];
    if (c.skidL && Math.hypot(L[0] - c.skidL[0], L[1] - c.skidL[1]) > 4) {
      if (Game.skids.length > 900) Game.skids.shift();
      Game.skids.push({ a: c.skidL, b: L, t: 0 }, { a: c.skidR, b: Rr, t: 0 });
      c.skidL = L; c.skidR = Rr;
    } else if (!c.skidL) { c.skidL = L; c.skidR = Rr; }
  }

  // ---------- build the frame for the renderer ----------
  const B = { alpha: new CR.G.Builder(4096), add: new CR.G.Builder(4096), skid: new CR.G.Builder(4096) };
  function resetB(b) { b.n = 0; b.idx.length = 0; }
  Game.render = function () {
    if (!Game.world || !Game.cars) return;
    const cam = R.cam, saveD = cam.dist; cam.dist = cam.distShow || cam.dist;
    R.camMatrices();
    const cars = [], lights = [];
    for (const c of Game.cars) {
      if (Game.ko && c.out) continue;
      const bob = c.st.hover ? 3 + Math.sin(Game.time * 7 + c.id) * 1.2 : (c.state === 'race' && !c.air ? Math.abs(Math.sin(Game.time * 30 + c.id)) * Math.min(1, Math.hypot(c.vx, c.vy) / 300) * 0.4 : 0);
      const rat = c.bumpT > 0 ? (Math.random() - 0.5) : 0; // rattling over clutter
      R.carMatrix(c.x, c.y, c.z + bob + Math.abs(rat) * 4, c.h, c.vis.pitch + rat * 0.12, c.vis.roll + rat * 0.18, c.m);
      cars.push({ mesh: c.mesh, m: c.m, flicker: c.inv > 0 });
      if (c.boosting) lights.push({ x: c.x - Math.cos(c.h) * 22, y: 10 + c.z, z: c.y - Math.sin(c.h) * 22, col: [1.6, 0.8, 0.25], rad: 110 });
      if (Game.world.light === CR.LIGHT.night || Game.world.light === CR.LIGHT.monitor || Game.world.light === CR.LIGHT.dusk) lights.push({ x: c.x + Math.cos(c.h) * 30, y: 8 + c.z, z: c.y + Math.sin(c.h) * 30, col: [0.7, 0.68, 0.5], rad: 90 });
      if (c.cursor && Game.mode !== 'attract') {
        const m = c.cm || (c.cm = new Float32Array(16));
        const up = 38 + Math.sin(Game.time * 3) * 3 + c.z;
        CR.M4.model(c.x, up, c.y, Game.time * 1.6, 0, 0, 1, m);
        cars.push({ mesh: c.cursor, m });
      }
    }
    if (Game.ghost && Game.player && Game.state !== 'count') {
      const g = Game.ghost, t = Game.raceT - (Game.ghostT0 || 0), d = g.data, i = Math.floor(t * 15) * 4;
      if (i + 7 < d.length) {
        const f = t * 15 - Math.floor(t * 15);
        const x = U.lerp(d[i], d[i + 4], f), y = U.lerp(d[i + 1], d[i + 5], f), h = d[i + 2] / 100 + U.angDiff(d[i + 2] / 100, d[i + 6] / 100) * f, z = U.lerp(d[i + 3], d[i + 7], f);
        R.carMatrix(x, y, z, h, 0, 0, g.m); cars.push({ mesh: g.mesh, m: g.m, ghost: true, tint: [0.7, 1.2, 1.4] });
      }
    }
    for (const b of Game.world.balls) { b.m = b.m || new Float32Array(16); CR.M4.model(b.x, b.r + b.z, b.y, -b.dir, b.rot, 0, 1, b.m); }
    // particles as camera-facing pixel squares
    resetB(B.alpha); resetB(B.add); resetB(B.skid);
    const rt = R.right, up = R.up;
    const quad = (b, x, y, z, s, c, a) => {
      const i0 = b.v(x - rt[0] * s - up[0] * s, z - rt[1] * s - up[1] * s, y - rt[2] * s - up[2] * s, 0, 1, 0, c[0], c[1], c[2], a);
      const i1 = b.v(x + rt[0] * s - up[0] * s, z + rt[1] * s - up[1] * s, y + rt[2] * s - up[2] * s, 0, 1, 0, c[0], c[1], c[2], a);
      const i2 = b.v(x + rt[0] * s + up[0] * s, z + rt[1] * s + up[1] * s, y + rt[2] * s + up[2] * s, 0, 1, 0, c[0], c[1], c[2], a);
      const i3 = b.v(x - rt[0] * s + up[0] * s, z - rt[1] * s + up[1] * s, y - rt[2] * s + up[2] * s, 0, 1, 0, c[0], c[1], c[2], a);
      b.quad(i0, i1, i2, i3);
    };
    for (const p of Game.parts) {
      const t = p.life / p.max, s = p.size * (1 + (p.grow - 1) * t), a = p.a * (1 - t * t);
      quad(p.add ? B.add : B.alpha, p.x, p.y, p.z, s, p.col, a);
    }
    X().render(cars, B.skid, (x, y, z, s, c, a) => quad(B.add, x, y, z, s, c, a));
    for (const pu of Game.pulses) lights.push({ x: pu.x, y: 30, z: pu.y, col: pu.col.map((v) => v * pu.t * 5), rad: 220 });
    for (const m of Game.motes) quad(B.add, m.x, m.y, m.z, 1.2, [1, 0.92, 0.7], 0.35 + Math.sin(m.p * 2) * 0.2);
    const sc = ['toybox', 'pool', 'computer', 'garage'].includes(Game.world.def.theme) ? [0.02, 0.02, 0.04] : [0.12, 0.1, 0.1];
    for (const k of Game.skids) {
      const dx = k.b[0] - k.a[0], dy = k.b[1] - k.a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * 1.8, ny = dx / l * 1.8, al = 0.38 * (1 - k.t / 9);
      const i0 = B.skid.v(k.a[0] + nx, 0.2, k.a[1] + ny, 0, 1, 0, sc[0], sc[1], sc[2], al), i1 = B.skid.v(k.a[0] - nx, 0.2, k.a[1] - ny, 0, 1, 0, sc[0], sc[1], sc[2], al);
      const i2 = B.skid.v(k.b[0] - nx, 0.2, k.b[1] - ny, 0, 1, 0, sc[0], sc[1], sc[2], al), i3 = B.skid.v(k.b[0] + nx, 0.2, k.b[1] + ny, 0, 1, 0, sc[0], sc[1], sc[2], al);
      B.skid.quad(i0, i1, i2, i3);
    }
    // tilt-shift focus follows the car the camera is on
    const lead = (Game.player && !Game.ko && !Game.player.out) ? Game.player : (Game.ko ? koLeader() : Game.standings()[0]);
    let focusY = 0.5;
    if (lead) { const p = R.project(lead.x, lead.y, lead.z); focusY = U.clamp(p[1] * 0.5 + 0.5, 0.25, 0.75); }
    cam.dist = cam.distShow || saveD;
    R.render({ cars, parts: B, skid: B.skid, lights, time: Game.time, focusY, band: Game.mode === 'attract' ? 0.1 : 0.15, dof: Game.intro > 0 ? 1.4 : 1 });
    cam.dist = saveD;
  };

  CR.Game = Game;
})(window.CR);
