// Cursor Racing — Demolition Derby mode: car physics (shared with racing), car-to-car damage by hit
// zone, voxel denting, wrecks, falls, pickups, ramming AI, particles and the camera. Runs instead of
// CR.Game while a derby is on; shares its input and settings objects.
(function (CR) {
  'use strict';
  const { U, R, Audio, G } = CR;
  const GRAV = 1150, CAR_R = 11.5, FLOOR_PAD = 6;
  const SUDDEN = 150;          // seconds before sudden death starts draining everyone's health
  const DENT_MAX = 0.42;       // a car never loses more than this share of its voxels to dents

  const Game = {
    on: false, paused: false, mode: null, time: 0,
    input: CR.Game.input, settings: CR.Game.settings, // the UI fills these for whichever mode is running
  };
  const DIFF = [ // per difficulty: rival skill, top speed, how hard rivals hit you, how many may gang up on you
    { skill: 0.8, top: 0.9, toPlayer: 0.7, gang: 1 },
    { skill: 1.0, top: 0.97, toPlayer: 0.9, gang: 2 },
    { skill: 1.12, top: 1.02, toPlayer: 1.05, gang: 3 },
  ];
  const diff = () => DIFF[Game.settings.difficulty] || DIFF[0];

  // ---------- car stats ----------
  // the garage upgrades: eng (speed), grip (tires), boost (turbo). Health comes from the car's weight.
  function stats(def, up = {}) {
    const e = up.eng || 0, g = up.grip || 0, b = up.boost || 0;
    return {
      top: 235 + def.top * 130 + e * 10,
      accel: 320 + def.accel * 280 + e * 16,
      grip: 4.4 + def.grip * 6.5 + g * 0.55,
      turn: 3.9 + def.grip * 0.9 + g * 0.06,
      mass: 0.6 + def.mass,
      hp: Math.round(70 + def.mass * 70),
      hover: !!def.hover,
      boostPow: 1.38 + b * 0.03, boostDrain: 0.55 - b * 0.03, charge: (def.charge || 1) + b * 0.08,
    };
  }

  function makeCar(o) {
    const def = CR.CARS.find((c) => c.id === o.car) || CR.CARS[0];
    const vox = CR.carVox(def.id, o.paint, o.acc);
    let solid = 0; for (let i = 0; i < vox.solid.length; i++) solid += vox.solid[i];
    const st = stats(def, o.up);
    const c = {
      id: o.id, name: o.name, isPlayer: !!o.player, def, st, paint: o.paint, acc: o.acc, pcol: U.hex(o.paint),
      vox, solid0: solid, removed: [], mesh: G.upload(R.gl, G.mesh(vox, CR.CAR_VS, 8, 0, 4.5)), m: new Float32Array(16), dirty: false, remeshT: 0,
      x: 0, y: 0, z: 0, h: 0, vx: 0, vy: 0, vz: 0, spinV: 0, air: false,
      hp: st.hp, wrecked: false, out: false, how: null, state: 'race', fallT: 0, inv: 0, boost: 0.5, boosting: false, slip: 0,
      vis: { pitch: 0, roll: 0 }, steerVis: 0, flash: 0, wrecks: 0, dealt: 0, lastBy: null, lastByT: -99, skidL: null, skidR: null,
      ai: o.player ? null : { skill: o.skill || 1, target: null, retT: 0, revT: 0, backT: 0, stuckT: 0, wob: Math.random() * 6, bias: 0 },
    };
    if (o.player) c.cursor = G.upload(R.gl, CR.cursorMesh('#3ff0ff'));
    return c;
  }

  // ---------- setup ----------
  // opts: { mode: 'derby'|'attract', arena (index), player: {car, paint, up}, rivals: [...], onEnd }
  Game.start = function (opts) {
    CR.Game.stop(); // the race (or the attract race behind the menus) makes way
    Game.stop(); Game.autopilot = false;
    Game.opts = opts; Game.mode = opts.mode;
    const world = new CR.Arena(CR.ARENAS[opts.arena]);
    R.setWorld(world); Game.world = world;
    Game.cars = []; Game.parts = []; Game.skids = []; Game.motes = []; Game.pulses = []; Game.pickups = []; Game.elim = [];
    const D = diff();
    if (opts.mode !== 'attract') {
      const p = opts.player;
      Game.player = makeCar({ id: 0, name: 'You', player: true, car: p.car, paint: p.paint, acc: CR.CARS.find((c) => c.id === p.car).paints[1], up: p.up });
      Game.cars.push(Game.player);
    } else Game.player = null;
    (opts.rivals || CR.RIVALS.slice(0, 5)).forEach((r, i) => Game.cars.push(makeCar({ id: i + 1, name: r.name, car: r.car, paint: r.paint, acc: r.acc, skill: D.skill * (0.94 + Math.random() * 0.12) })));
    const slots = world.spawnSlots(Game.cars.length);
    Game.cars.forEach((c, i) => { const s = slots[i]; c.x = s.x; c.y = s.y; c.h = s.h; });
    Game.time = 0; Game.raceT = 0; Game.count = opts.mode === 'attract' ? 0 : 3.2; Game.state = opts.mode === 'attract' ? 'fight' : 'count';
    Game.lastCount = 4; Game.endT = 0; Game.results = null; Game.messages = []; Game.sudden = false; Game.pickT = 4;
    const lead = Game.player || Game.cars[0];
    R.cam.x = lead.x; R.cam.y = lead.y; R.cam.pitch = 0.98; R.cam.fov = 0.5; R.cam.yaw = 0; R.cam.shake = 0; R.cam.flash = 0; R.cam.dist = 0;
    Game.camT = { x: world.cx, y: world.cy };
    Game.intro = opts.mode === 'attract' ? 0 : 1;
    Game.pickMesh = { wrench: G.upload(R.gl, CR.prop('wrench', {}, 1).bld), nitro: G.upload(R.gl, CR.prop('battery', {}, 1).bld) };
    Game.on = true; Game.paused = false;
    for (let i = 0; i < 26; i++) Game.motes.push({ x: lead.x + (Math.random() - 0.5) * 900, y: lead.y + (Math.random() - 0.5) * 700, z: 20 + Math.random() * 160, p: Math.random() * 6 });
  };
  Game.stop = function () {
    if (!Game.cars) return;
    for (const c of Game.cars) { G.free(R.gl, c.mesh); if (c.cursor) G.free(R.gl, c.cursor); }
    if (Game.pickMesh) { G.free(R.gl, Game.pickMesh.wrench); G.free(R.gl, Game.pickMesh.nitro); Game.pickMesh = null; }
    Game.cars = []; Game.pickups = []; Game.on = false; Audio.engine(0, 0, false, false); Audio.skid(0);
  };
  const alive = () => Game.cars.filter((c) => !c.wrecked && !c.out);
  Game.alive = alive;

  // ---------- main update ----------
  const FIXED = 1 / 120;
  Game.update = function (dt) {
    if (!Game.on || Game.paused) return;
    Game.time += dt;
    Game.acc = (Game.acc || 0) + Math.min(dt, 0.05);
    while (Game.acc >= FIXED) { step(FIXED); Game.acc -= FIXED; }
    updateParts(dt);
    updateCamera(dt);
    const p = Game.player;
    if (p && Game.state !== 'done' && !p.wrecked && !p.out) {
      const spd = Math.hypot(p.vx, p.vy) / p.st.top;
      Audio.engine(spd, Game.state === 'count' ? Math.max(0.3, Game.input.throttle) : Game.input.throttle || 0.2, p.boosting, p.state === 'race');
      Audio.skid(p.air || p.state !== 'race' ? 0 : U.clamp((p.slip - 45) / 120, 0, 1));
    } else { Audio.engine(0, 0, false, false); Audio.skid(0); }
  };

  function step(dt) {
    if (Game.state === 'count') {
      Game.count -= dt; Game.intro = Math.max(0, Game.count / 3.2);
      const n = Math.ceil(Game.count);
      if (n < Game.lastCount && n >= 0) { Game.lastCount = n; if (n > 0) { Audio.play('count'); Game.msg(String(n), 0.8, 'count'); } }
      if (Game.count <= 0) { Game.state = 'fight'; Audio.play('go'); Game.msg('SMASH!', 1, 'go'); Game.raceT = 0; }
      for (const c of Game.cars) physics(c, dt, { steer: 0, throttle: 0, brake: 1, boost: false });
      return;
    }
    Game.raceT += dt;
    for (const c of Game.cars) {
      if (c.out) continue;
      let inp;
      if (c.wrecked || Game.state === 'done' && c.isPlayer) inp = NONE;
      else if (c.isPlayer && !Game.autopilot) inp = playerInput(c);
      else inp = aiInput(c, dt);
      physics(c, dt, inp);
      if (!c.wrecked && Game.state !== 'done') c.boost = Math.min(1, c.boost + dt * 0.05 * c.st.charge);
    }
    collideCars();
    ballsStep(dt);
    pickupsStep(dt);
    for (let i = Game.pulses.length - 1; i >= 0; i--) { Game.pulses[i].t -= dt; if (Game.pulses[i].t <= 0) Game.pulses.splice(i, 1); }
    // sudden death: nobody gets to hide forever
    if (Game.state === 'fight' && Game.raceT > SUDDEN) {
      if (!Game.sudden) { Game.sudden = true; Game.msg('SUDDEN DEATH', 2, 'warn'); Audio.play('final'); Audio.setIntensity(1); }
      for (const c of alive()) hurt(c, dt * 2.5, null, c.x, c.y, true);
    }
    if (Game.state === 'fight') {
      const left = alive();
      if (left.length <= 1) {
        Game.state = 'done'; Game.endT = 0; Game.winner = left[0] || null;
        if (Game.winner) { Game.winner.how = 'winner'; emit('confetti', Game.winner.x, Game.winner.y, 30, 60); }
        if (Game.mode !== 'attract') {
          if (Game.winner && Game.winner.isPlayer) { Game.msg('LAST ONE STANDING!', 3, 'go'); Audio.play('win'); } else if (Game.winner) Game.msg(`${Game.winner.name.toUpperCase()} WINS`, 2.5, 'info');
        }
      }
    }
    if (Game.state === 'done') { Game.endT += dt; if (Game.endT > (Game.mode === 'attract' ? 4 : 3.2)) finish(); }
  }
  const NONE = { steer: 0, throttle: 0, brake: 0, boost: false };

  // ---------- input ----------
  function playerInput(c) {
    const I = Game.input;
    let steer = I.steer, throttle = I.throttle, brake = I.brake;
    if (I.stick && I.stick.on) {
      // point the thumb where you want to go (screen up = north)
      const want = Math.atan2(I.stick.y, I.stick.x);
      const d = U.angDiff(c.h, want);
      steer = U.clamp(d * 2.4, -1, 1);
      throttle = Math.max(throttle, U.clamp(I.stick.mag * 1.4, 0, 1) * (Math.abs(d) > 2.7 && I.stick.mag > 0.5 ? 0.6 : 1));
    }
    return { steer, throttle, brake, boost: I.boost };
  }

  // Rivals pick a victim (close, hurt, someone who just hit them, now and then you), aim where it is
  // going to be, ram, back off and ram again. They grab a wrench when they are hurt and keep away from
  // edges and pockets. On Easy they hit softer and fewer of them pick on you at once.
  function aiInput(c, dt) {
    const w = Game.world, a = c.ai, D = diff(), spd = Math.hypot(c.vx, c.vy);
    const fx = Math.cos(c.h), fy = Math.sin(c.h);
    if (c.stunT > 0) return NONE;
    a.retT -= dt;
    if (!a.target || a.target.wrecked || a.target.out || a.retT <= 0) {
      a.retT = 1.6 + Math.random() * 2.2;
      const onPlayer = Game.cars.filter((k) => k.ai && k !== c && k.ai.target === Game.player).length;
      let best = null, bs = Infinity;
      for (const o of alive()) {
        if (o === c) continue;
        let s = Math.hypot(o.x - c.x, o.y - c.y) + (o.hp / o.st.hp) * 220 + Math.random() * 160;
        if (o.isPlayer) s += onPlayer >= D.gang ? 600 : -60;
        if (o === c.lastBy && Game.time - c.lastByT < 4) s -= 220;
        if (o === a.target) s -= 50;
        if (s < bs) { bs = s; best = o; }
      }
      a.target = best;
    }
    const t = a.target;
    let gx = w.cx, gy = w.cy, ram = false;
    const hurtF = c.hp / c.st.hp;
    let pick = null;
    for (const p of Game.pickups) {
      const d = Math.hypot(p.x - c.x, p.y - c.y);
      if ((p.type === 'wrench' && hurtF < 0.5 && d < 750) || (p.type === 'nitro' && c.boost < 0.35 && d < 320)) if (!pick || d < pick.d) pick = { p, d };
    }
    if (pick) { gx = pick.p.x; gy = pick.p.y; }
    else if (t) {
      const d = Math.hypot(t.x - c.x, t.y - c.y), lead = U.clamp(d / Math.max(spd, 160), 0, 0.9) * a.skill;
      gx = t.x + t.vx * lead; gy = t.y + t.vy * lead; ram = true;
    }
    const want = Math.atan2(gy - c.y, gx - c.x), dist = Math.hypot(gx - c.x, gy - c.y);
    let d = U.angDiff(c.h, want) + Math.sin(Game.time * 0.9 + a.wob) * 0.12 * (1.6 - a.skill);
    let steer = U.clamp(d * 2.8, -1, 1), throttle = 1, brake = 0, boost = false;
    if (Math.abs(d) > 1.3 && spd > 170) throttle = 0.35;
    // target right behind and close: back up into a turn rather than circling
    if (ram && Math.abs(d) > 2.2 && dist < 130) { throttle = 0; brake = 1; steer = -Math.sign(d); }
    if (ram && Math.abs(d) < 0.2 && dist < 420 && dist > 80 && c.boost > 0.35 && Math.random() < a.skill * 0.08) a.boostT = 0.6 + Math.random() * 0.5;
    if (a.boostT > 0) { a.boostT -= dt; boost = true; }
    // just landed a hit: back off a moment, then line up again
    if (a.backT > 0) { a.backT -= dt; return { steer: -steer * 0.6, throttle: 0, brake: 1, boost: false }; }
    // don't drive off the table or into a pocket
    // ...unless it is lined up on a victim that's nearer the edge: then it commits to the shove
    const px = c.x + c.vx * 0.5 + fx * 24, py = c.y + c.vy * 0.5 + fy * 24;
    const shove = ram && t && dist < 110 && Math.abs(d) < 0.4 && (w.edgeDist(t.x, t.y) < w.edgeDist(c.x, c.y) || (w.holes.length && w.holeAt(t.x, t.y, 90)));
    const danger = shove ? w.edgeDist(c.x + fx * 14, c.y + fy * 14) < 18 : (w.edgeDist(px, py) < 55 || w.holeAt(px, py, 26));
    if (shove && c.boost > 0.2 && Math.random() < a.skill * 0.05) a.boostT = 0.4;
    if (danger) {
      const home = Math.atan2(w.cy - c.y, w.cx - c.x), dh = U.angDiff(c.h, home);
      steer = U.clamp(dh * 3, -1, 1); boost = false; a.boostT = 0;
      if (Math.abs(dh) > 1.5) { throttle = 0; brake = 1; steer = -Math.sign(dh); } // facing out: reverse away from the edge
      else throttle = spd > 200 ? 0.4 : 1;
    }
    // stuck against something: reverse out
    if (spd < 25 && Game.state === 'fight') a.stuckT += dt; else a.stuckT = Math.max(0, a.stuckT - dt * 2);
    if (a.stuckT > 0.9) { a.revT = 0.7; a.stuckT = 0; }
    if (a.revT > 0) { a.revT -= dt; return { steer: -steer, throttle: 0, brake: 1, boost: false }; }
    c.aiTop = D.top * (0.96 + a.skill * 0.04);
    return { steer, throttle, brake, boost };
  }

  // ---------- physics ----------
  function physics(c, dt, inp) {
    const w = Game.world, st = c.st;
    if (c.inv > 0) c.inv -= dt;
    if (c.flash > 0) c.flash -= dt;
    if (c.stunT > 0) c.stunT -= dt;
    if (c.state === 'fall') {
      c.fallT += dt; c.vz -= GRAV * dt; c.z += c.vz * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.vx *= 0.99; c.vy *= 0.99;
      c.h += c.spin * dt; c.vis.roll += c.spin * 0.4 * dt;
      if (c.z < w.floorY + FLOOR_PAD) { if (c.vz < -200) { emit('dust', c.x, c.y, c.z, 6); emit('debris', c.x, c.y, c.z + 4, 8, c); } c.z = w.floorY + FLOOR_PAD; c.vx *= 0.8; c.vy *= 0.8; c.vz = 0; }
      if (c.fallT > 1.1 && !c.out) eliminate(c, 'fell');
      return;
    }
    if (c.out) return;
    const fx = Math.cos(c.h), fy = Math.sin(c.h), rx = -fy, ry = fx;
    let vf = c.vx * fx + c.vy * fy, vl = c.vx * rx + c.vy * ry;
    const surf = c.air ? null : w.surface(c.x, c.y);
    let topMul = 1, grip = 1;
    if (surf) {
      if (surf.type === 'void') { startFall(c); return; }
      topMul = surf.top; grip = surf.grip;
      if (st.hover && surf.type === 'slick') grip = 0.8;
      if (surf.type === 'slick' && Math.abs(vl) > 30 && Math.random() < 0.2) emit('splash', c.x, c.y, 2, 1);
      c.surf = surf.type;
    }
    // a battered car loses a little pace
    const health = c.hp / st.hp, limp = c.wrecked ? 0 : 0.82 + 0.18 * Math.min(1, health * 1.6);
    c.boosting = false;
    if (inp.boost && c.boost > 0.02 && !c.wrecked) {
      c.boosting = true; c.boost = Math.max(0, c.boost - st.boostDrain * dt);
      if (c.isPlayer && !c.wasBoost) Audio.play('boost');
    }
    c.wasBoost = c.boosting;
    const top = st.top * topMul * limp * (c.boosting ? st.boostPow : 1) * (c.aiTop || 1) * (Game.state === 'count' ? 0 : 1);
    if (!c.air) {
      const acc = st.accel * (c.boosting ? 1.7 : 1);
      if (inp.throttle > 0 && top > 0) vf += acc * inp.throttle * (1 - vf / top) * dt;
      else vf -= vf * (c.wrecked ? 2.4 : 0.65) * dt;
      if (inp.brake > 0) {
        if (vf > 15) vf -= 760 * inp.brake * dt;
        else if (Game.state !== 'count') vf = Math.max(-st.top * 0.5 * limp, vf - st.accel * 0.7 * inp.brake * dt);
        else vf *= 0.9;
      }
      const drift = inp.brake > 0 && Math.abs(inp.steer) > 0.3 && vf > 120;
      // knocked sideways by a big hit: the tires lose their bite for a moment and the car skids
      const g = st.grip * grip * (drift ? 0.35 : 1) * (c.wrecked ? 0.6 : 1) * (c.stunT > 0 ? 0.22 : 1);
      vl *= Math.exp(-g * dt);
      const sp = Math.abs(vf), turnK = U.clamp(sp / 75, 0, 1) * (1 - 0.25 * U.clamp(sp / st.top, 0, 1)) * (drift ? 1.35 : 1);
      c.h += inp.steer * st.turn * turnK * (vf >= 0 ? 1 : -1) * dt;
      c.slip = Math.abs(vl) + (inp.brake > 0 && vf > 120 ? 40 : 0);
      if (Math.abs(vl) > 38 && vf > 110 && grip > 0.5) c.boost = Math.min(1, c.boost + dt * 0.25 * st.charge * U.clamp((Math.abs(vl) - 30) / 90, 0.2, 1));
    }
    // spin from being hit off-center
    c.h += c.spinV * dt; c.spinV *= Math.exp(-(2.6 * grip + 0.6) * dt);
    c.steerVis += (inp.steer - c.steerVis) * Math.min(1, dt * 10);
    c.vx = fx * vf + rx * vl; c.vy = fy * vf + ry * vl;
    const ox = c.x, oy = c.y;
    c.x += c.vx * dt; c.y += c.vy * dt;
    if (c.air) {
      c.vz -= GRAV * dt; c.z += c.vz * dt;
      if (c.z <= 0) { c.z = 0; c.air = false; if (c.vz < -120) { emit('dust', c.x, c.y, 1, 8); if (c.isPlayer) { Audio.play('land'); shake(5); } } c.vz = 0; }
    }
    staticCollide(c, ox, oy);
    if (c.onSoft && !c.air) { const k = Math.exp(-4.5 * dt); c.vx *= k; c.vy *= k; c.bumpT = 0.15; if (Math.random() < 0.3) emit('dust', c.x, c.y, 2, 1); }
    if (c.bumpT > 0) c.bumpT -= dt;
    c.vis.pitch += ((c.air ? U.clamp(c.vz / 900, -0.35, 0.3) * -1 : -inp.throttle * 0.03 + (inp.brake > 0 ? 0.05 : 0)) - c.vis.pitch) * Math.min(1, dt * 8);
    c.vis.roll += (U.clamp(vl / 600, -0.12, 0.12) - c.vis.roll) * Math.min(1, dt * 8);
    if (!c.air) {
      const spd = Math.hypot(c.vx, c.vy);
      skid(c, c.slip > 55 && spd > 60);
      if (c.slip > 70 && Math.random() < 0.4) emit('smoke', c.x - fx * 12, c.y - fy * 12, 2, 1);
      if (c.boosting && Math.random() < 0.9) emit('flame', c.x - fx * 17, c.y - fy * 17, 5 + c.z, 1, c);
    } else skid(c, false);
    // damage smoke and fire
    const hf = c.hp / st.hp;
    if (c.wrecked) { if (Math.random() < 0.35) emit('blacksmoke', c.x + (Math.random() - 0.5) * 8, c.y + (Math.random() - 0.5) * 8, 14, 1); if (Math.random() < 0.3) emit('fire', c.x, c.y, 10, 1); }
    else if (hf < 0.25) { if (Math.random() < 0.4) emit('blacksmoke', c.x + fx * 10, c.y + fy * 10, 12, 1); if (Math.random() < 0.25) emit('fire', c.x + fx * 10, c.y + fy * 10, 10, 1); }
    else if (hf < 0.55 && Math.random() < 0.18) emit('smoke', c.x + fx * 10, c.y + fy * 10, 12, 1);
  }

  function startFall(c) {
    c.state = 'fall'; c.fallT = 0; c.vz = 30; c.spin = (Math.random() - 0.5) * 6; c.air = false;
    skid(c, false);
    if (c.isPlayer) { Audio.play('fall'); Audio.vibrate(40); }
    else if (Game.player && Math.hypot(c.x - R.cam.x, c.y - R.cam.y) < 700) Audio.play('fall', { vol: 0.5 });
  }

  function staticCollide(c) {
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
        if (d < 0.001) {
          const pu = k.hw - Math.abs(u), pv = k.hd - Math.abs(v);
          if (pu < pv) { lu = Math.sign(u) || 1; lv = 0; pen = pu + CAR_R; } else { lu = 0; lv = Math.sign(v) || 1; pen = pv + CAR_R; }
          d = 1;
        } else pen = CAR_R - d;
        const nu = lu / d, nv = lv / d; nx = nu * k.c - nv * k.s; ny = nu * k.s + nv * k.c;
      }
      if (k.soft) { c.onSoft = true; continue; }
      c.x += nx * pen; c.y += ny * pen;
      const vn = c.vx * nx + c.vy * ny;
      if (vn < 0) {
        c.vx -= 1.4 * vn * nx; c.vy -= 1.4 * vn * ny;
        c.vx *= 0.9; c.vy *= 0.9;
        if (vn < -70) {
          emit('spark', c.x - nx * CAR_R, c.y - ny * CAR_R, 6, Math.min(10, -vn / 25));
          if (c.isPlayer) { Audio.play('wall', { vol: Math.min(1, -vn / 250) }); shake(Math.min(7, -vn / 50)); Audio.vibrate(15); }
        }
        // slamming into a wall hurts, and counts as a hit for whoever shoved you there
        if (vn < -150 && !c.wrecked) {
          const by = c.lastBy && Game.time - c.lastByT < 1.2 ? c.lastBy : null;
          hurt(c, (-vn - 150) * 0.035, by, c.x - nx * CAR_R, c.y - ny * CAR_R, true);
        }
      }
    }
  }

  // Car vs car. The push is a bouncy impulse. Damage depends on how hard you hit and where:
  // the front is armored, the sides and the back are not. Boosting into someone hits harder.
  const zone = (f) => (f > 0.55 ? 0.45 : f < -0.55 ? 1.15 : 1.0);
  function collideCars() {
    const cs = Game.cars;
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
      const a = cs[i], b = cs[j];
      if (a.state !== 'race' || b.state !== 'race' || a.out || b.out) continue;
      if (Math.abs(a.z - b.z) > 14) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), rr = CAR_R * 2;
      if (d >= rr || d === 0) continue;
      const nx = dx / d, ny = dy / d, pen = rr - d;
      const ma = a.st.mass * (a.wrecked ? 1.6 : 1), mb = b.st.mass * (b.wrecked ? 1.6 : 1), tot = ma + mb;
      a.x -= nx * pen * (mb / tot); a.y -= ny * pen * (mb / tot); b.x += nx * pen * (ma / tot); b.y += ny * pen * (ma / tot);
      const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rv >= 0) continue;
      const jimp = -1.5 * rv / (1 / ma + 1 / mb);
      a.vx -= (jimp / ma) * nx; a.vy -= (jimp / ma) * ny; b.vx += (jimp / mb) * nx; b.vy += (jimp / mb) * ny;
      const imp = -rv;
      if (imp < 55) continue;
      const fa = Math.cos(a.h) * nx + Math.sin(a.h) * ny, fb = -(Math.cos(b.h) * nx + Math.sin(b.h) * ny);
      // off-center hits spin the car that gets hit
      const sa = -(-Math.sin(a.h) * nx + Math.cos(a.h) * ny), sb = -Math.sin(b.h) * nx + Math.cos(b.h) * ny;
      b.spinV = U.clamp(b.spinV + sb * imp * 0.011 * (fb < 0.4 ? 1 : 0.3) * Math.sqrt(ma / mb), -9, 9);
      a.spinV = U.clamp(a.spinV + sa * imp * 0.011 * (fa < 0.4 ? 1 : 0.3) * Math.sqrt(mb / ma), -9, 9);
      // a hard hit to the side or back leaves a rival dazed for a moment: that's when you shove it off the table
      if (fb < 0.55 && imp > 140) b.stunT = Math.max(b.stunT || 0, Math.min(0.6, imp / 600) * (b.isPlayer ? 0.6 : 1));
      if (fa < 0.55 && imp > 140) a.stunT = Math.max(a.stunT || 0, Math.min(0.6, imp / 600) * (a.isPlayer ? 0.6 : 1));
      const base = Math.max(0, imp - 70) * 0.055, cx = a.x + nx * CAR_R, cy = a.y + ny * CAR_R;
      const dB = base * zone(fb) * Math.sqrt(ma / mb) * (a.boosting ? 1.4 : 1) * (fa > 0.55 ? 1.15 : 0.8) * (a.wrecked ? 0.5 : 1);
      const dA = base * zone(fa) * Math.sqrt(mb / ma) * (b.boosting ? 1.4 : 1) * (fb > 0.55 ? 1.15 : 0.8) * (b.wrecked ? 0.5 : 1);
      hurt(b, dB, a.wrecked ? null : a, cx, cy);
      hurt(a, dA, b.wrecked ? null : b, cx, cy);
      // whoever did the ramming backs off for another go
      if (a.ai && fa > 0.55 && dB > dA) a.ai.backT = 0.35 + Math.random() * 0.35;
      if (b.ai && fb > 0.55 && dA > dB) b.ai.backT = 0.35 + Math.random() * 0.35;
      emit('spark', cx, cy, 7, Math.min(12, imp / 25));
      const me = a.isPlayer || b.isPlayer;
      if (me) { Audio.play('bump', { vol: Math.min(1, imp / 220) }); shake(Math.min(8, imp / 50)); Audio.vibrate(Math.min(60, imp / 6)); }
      else if (Game.player && Math.hypot(cx - R.cam.x, cy - R.cam.y) < 500) Audio.play('bump', { vol: Math.min(0.5, imp / 400) });
      if (imp > 250) { Game.lightPulse(cx, cy, [1, 0.7, 0.3]); if (me) R.cam.flash = Math.max(R.cam.flash || 0, Math.min(0.5, imp / 900)); }
      const big = Math.max(dA, dB);
      if (me && big > 22) {
        const mine = (a.isPlayer && dB > dA) || (b.isPlayer && dA > dB);
        if (mine) Game.msg(big > 40 ? 'DEVASTATING!' : big > 30 ? 'CRUNCH!' : 'SMASH!', 0.8, 'hit');
      }
    }
    for (const c of cs) for (const b of Game.world.balls) {
      if (c.state !== 'race' || c.out || b.out > 0 || c.z > 18) continue;
      const dx = b.x - c.x, dy = b.y - c.y, d = Math.hypot(dx, dy), rr = CAR_R + b.r;
      if (d >= rr || d === 0) continue;
      const nx = dx / d, ny = dy / d, pen = rr - d, tot = c.st.mass + b.mass;
      c.x -= nx * pen * (b.mass / tot); c.y -= ny * pen * (b.mass / tot); b.x += nx * pen * (c.st.mass / tot); b.y += ny * pen * (c.st.mass / tot);
      const rv = (b.vx - c.vx) * nx + (b.vy - c.vy) * ny;
      if (rv < 0) {
        const jimp = -1.8 * rv / (1 / c.st.mass + 1 / b.mass);
        c.vx -= (jimp / c.st.mass) * nx; c.vy -= (jimp / c.st.mass) * ny; b.vx += (jimp / b.mass) * nx; b.vy += (jimp / b.mass) * ny;
        if (-rv > 120) hurt(c, (-rv - 120) * 0.04, null, c.x + nx * CAR_R, c.y + ny * CAR_R, true);
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
      if (w.holeAt(b.x, b.y, -4)) { b.out = 3; Audio.play('splash', { vol: 0.4 }); }
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

  // ---------- damage ----------
  function hurt(c, dmg, by, px, py, quiet) {
    if (c.wrecked || c.out || dmg <= 0 || Game.state !== 'fight') return;
    if (by && by.isPlayer === false && c.isPlayer) dmg *= diff().toPlayer;
    c.hp -= dmg; c.flash = Math.max(c.flash, Math.min(0.3, dmg / 60));
    if (by && by !== c) { c.lastBy = by; c.lastByT = Game.time; by.dealt += dmg; by.boost = Math.min(1, by.boost + dmg * 0.006); }
    if (dmg >= 2) dent(c, px, py, dmg * 1.6);
    if (!quiet || dmg > 4) emit('debris', px, py, 8, Math.min(14, Math.ceil(dmg / 3)), c);
    if (c.hp <= 0) wreck(c);
  }
  // knock voxels off the side that was hit and scorch the paint round the hole
  function dent(c, px, py, dmg) {
    const v = c.vox, fx = Math.cos(c.h), fy = Math.sin(c.h), dx = px - c.x, dy = py - c.y;
    const vs = CR.CAR_VS, ix = 8 + (dx * fx + dy * fy) / vs, iz = 4.5 + (-dx * fy + dy * fx) / vs, iy = 2 + Math.random() * 3;
    let n = Math.min(9, Math.round(dmg / 4));
    while (n-- > 0 && c.removed.length < c.solid0 * DENT_MAX) {
      let best = -1, bd = Infinity;
      for (let x = 0; x < v.sx; x++) for (let y = 1; y < v.sy; y++) for (let z = 0; z < v.sz; z++) {
        const i = v.i(x, y, z); if (!v.solid[i]) continue;
        const d = (x - ix) ** 2 + ((y - iy) * 1.4) ** 2 + (z - iz) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
      if (best < 0 || bd > 30) break;
      c.removed.push(best, v.d[best * 4], v.d[best * 4 + 1], v.d[best * 4 + 2]); v.solid[best] = 0;
    }
    for (let x = Math.max(0, ix - 3 | 0); x <= Math.min(v.sx - 1, ix + 3 | 0); x++) for (let y = 0; y < v.sy; y++) for (let z = Math.max(0, iz - 3 | 0); z <= Math.min(v.sz - 1, iz + 3 | 0); z++) {
      const i = v.i(x, y, z); if (!v.solid[i] || Math.random() < 0.5) continue;
      const k = 0.82; v.d[i * 4] *= k; v.d[i * 4 + 1] *= k; v.d[i * 4 + 2] *= k;
    }
    c.dirty = true;
  }
  // a repair puts some of the lost panels back (scorch marks stay)
  function repair(c, frac) {
    const v = c.vox, n = Math.floor(c.removed.length / 4 * frac);
    for (let k = 0; k < n; k++) { const j = c.removed.length - 4; const i = c.removed[j]; v.solid[i] = 1; v.d[i * 4] = c.removed[j + 1]; v.d[i * 4 + 1] = c.removed[j + 2]; v.d[i * 4 + 2] = c.removed[j + 3]; c.removed.length = j; }
    c.dirty = true;
  }
  function wreck(c) {
    c.wrecked = true; c.hp = 0; c.boosting = false; c.how = 'wrecked'; c.wreckT = Game.time;
    const v = c.vox; for (let i = 0; i < v.solid.length; i++) if (v.solid[i]) { const k = 0.4 + Math.random() * 0.15; v.d[i * 4] *= k; v.d[i * 4 + 1] *= k; v.d[i * 4 + 2] *= k; v.d[i * 4 + 3] = 0; }
    c.dirty = true;
    emit('poof', c.x, c.y, 10, 16); emit('debris', c.x, c.y, 10, 24, c); emit('fire', c.x, c.y, 8, 10);
    Game.lightPulse(c.x, c.y, [1.4, 0.6, 0.2]);
    // a leaking wreck leaves an oil slick
    const w = Game.world; if (w.dyn.length < 8) w.dyn.push({ x: c.x, y: c.y, r: 30 });
    score(c);
  }
  function eliminate(c, how) {
    c.out = true; c.how = c.wrecked ? c.how : how;
    if (!c.wrecked) score(c);
  }
  function score(c) {
    Game.elim.push(c);
    const by = c.lastBy && Game.time - c.lastByT < 6 && c.lastBy !== c ? c.lastBy : null;
    if (by) by.wrecks++;
    c.killer = by;
    Audio.play('ko', { vol: c.isPlayer || (by && by.isPlayer) ? 1 : 0.5 });
    const left = alive().length;
    if (Game.mode === 'attract') return;
    const fell = c.how === 'fell';
    if (c.isPlayer) { Game.msg(fell ? 'OVER THE EDGE!' : 'WRECKED!', 2, 'warn'); Audio.vibrate(80); shake(8); }
    else if (by && by.isPlayer) { Game.msg(fell ? `PUSHED ${c.name.toUpperCase()} OFF!` : `WRECKED ${c.name.toUpperCase()}!`, 1.6, 'hit'); Audio.play('best'); }
    else Game.msg(`${c.name.toUpperCase()} ${fell ? 'FELL' : 'WRECKED'} · ${left} LEFT`, 1.3, 'info');
    if (left === 2) Audio.setIntensity(1);
  }

  // ---------- pickups ----------
  function pickupsStep(dt) {
    if (Game.state !== 'fight') return;
    Game.pickT -= dt;
    const max = Math.min(6, 2 + Math.floor(Game.cars.length / 6)); // more wrenches and batteries about in a big field
    if (Game.pickT <= 0) {
      Game.pickT = 6 + Math.random() * 4;
      if (Game.pickups.length < max) {
        const s = Game.world.randomSpot(), type = Math.random() < 0.6 ? 'wrench' : 'nitro';
        Game.pickups.push({ type, x: s.x, y: s.y, t: 0, m: new Float32Array(16) });
        emit('poof', s.x, s.y, 8, 8);
      }
    }
    for (let i = Game.pickups.length - 1; i >= 0; i--) {
      const p = Game.pickups[i]; p.t += dt;
      for (const c of Game.cars) {
        if (c.wrecked || c.out || c.state !== 'race' || Math.hypot(c.x - p.x, c.y - p.y) > 26) continue;
        if (p.type === 'wrench') { const add = c.st.hp * 0.35; c.hp = Math.min(c.st.hp, c.hp + add); repair(c, 0.45); if (c.isPlayer) Game.msg('REPAIRED +35%', 1.1, 'go'); }
        else { c.boost = 1; if (c.isPlayer) Game.msg('NITRO FULL', 1.1, 'go'); }
        if (c.isPlayer) { Audio.play('item'); Audio.vibrate(15); }
        emit('ring', p.x, p.y, 6, 18);
        Game.pickups.splice(i, 1); break;
      }
    }
  }

  // ---------- end ----------
  function finish() {
    if (Game.results) return;
    // order: the winner, then everyone in reverse order of going out; any still running ranked by health
    const order = [], rest = alive().sort((a, b) => b.hp - a.hp);
    for (const c of rest) order.push(c);
    for (let i = Game.elim.length - 1; i >= 0; i--) if (!order.includes(Game.elim[i])) order.push(Game.elim[i]);
    Game.results = {
      mode: Game.mode, time: Game.raceT,
      order: order.map((c) => ({ name: c.name, isPlayer: c.isPlayer, car: c.def.name, paint: c.paint, wrecks: c.wrecks, dealt: Math.round(c.dealt), how: c.how || 'survived', by: c.killer ? c.killer.name : null })),
      place: Game.player ? order.indexOf(Game.player) + 1 : 0,
    };
    Game.on = false; Audio.engine(0, 0, false, false); Audio.skid(0);
    if (Game.opts.onEnd) Game.opts.onEnd(Game.results);
  }
  // the player is out: let the rest fight it out at speed, or call it now
  Game.skip = function () { if (Game.state === 'fight' || Game.state === 'done') { Game.state = 'done'; finish(); } };

  Game.msg = function (text, dur, kind) { Game.messages.push({ text, t: dur, max: dur, kind }); if (Game.onMsg) Game.onMsg(text, dur, kind); };
  function shake(a) { if (Game.settings.shake) R.cam.shake = Math.max(R.cam.shake, a); }
  Game.lightPulse = function (x, y, col) { if (Game.pulses.length < 6) Game.pulses.push({ x, y, col, t: 0.25 }); };

  // ---------- camera ----------
  // on you while you're in; then on whoever wrecked you, or the healthiest car still going
  Game.focus = function () {
    const p = Game.player;
    if (p && !p.out && (!p.wrecked || Game.time - (p.wreckT || 0) < 2)) return p;
    if (p && p.killer && !p.killer.wrecked && !p.killer.out) return p.killer;
    const a = alive().sort((x, y) => y.hp - x.hp);
    return a[0] || Game.cars[0];
  };
  function updateCamera(dt) {
    const cam = R.cam, lead = Game.focus();
    if (!lead) return;
    const spd = Math.hypot(lead.vx, lead.vy);
    let tx = lead.x + U.clamp(lead.vx * 0.28, -150, 150), ty = lead.y + U.clamp(lead.vy * 0.28, -130, 130);
    if (lead.state === 'fall') { tx = lead.x; ty = lead.y; }
    if (Game.mode === 'attract') { tx = Game.world.cx + Math.sin(Game.time * 0.1) * 150; ty = Game.world.cy; }
    const k = 1 - Math.exp(-dt * 4);
    Game.camT.x += (tx - Game.camT.x) * k; Game.camT.y += (ty - Game.camT.y) * k;
    cam.x = Game.camT.x; cam.y = Game.camT.y;
    const want = R.fitDist(Game.mode === 'attract' ? Math.min(Game.world.W, Game.world.H) * 0.48 : 250 + Math.min(spd, 420) * 0.12);
    cam.dist = cam.dist ? cam.dist + (want - cam.dist) * Math.min(1, dt * 2) : want;
    const i = U.smooth(Game.intro || 0);
    cam.pitch = 0.98 + i * 0.25; cam.yaw = i * 0.9;
    if (Game.mode === 'attract') { cam.yaw = Math.sin(Game.time * 0.08) * 0.35; cam.pitch = 1.0 + Math.sin(Game.time * 0.05) * 0.08; }
    cam.distShow = cam.dist * (1 + i * 1.3);
    cam.shake = Math.max(0, cam.shake - dt * 30);
    cam.flash = Math.max(0, (cam.flash || 0) - dt * 2);
  }

  // ---------- particles ----------
  const PCOL = { smoke: [0.85, 0.85, 0.88], spark: [1, 0.75, 0.3], flame: [1, 0.55, 0.15], poof: [1, 1, 1], splash: [0.2, 0.2, 0.25], blacksmoke: [0.12, 0.11, 0.11] };
  function emit(kind, x, y, z, n, car) {
    if (Game.parts.length > 900) return;
    const dust = [0.85, 0.8, 0.72];
    for (let i = 0; i < n; i++) {
      const p = { x, y, z, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 3, col: PCOL[kind] || dust, add: false, grav: 0, drag: 2, grow: 1, a: 0.6 };
      const a = Math.random() * 6.28, s = Math.random();
      switch (kind) {
        case 'smoke': p.vx = Math.cos(a) * 20; p.vy = Math.sin(a) * 20; p.vz = 20 + s * 20; p.max = 0.6 + s * 0.4; p.size = 4 + s * 3; p.grow = 2.6; p.a = 0.35; break;
        case 'blacksmoke': p.vx = Math.cos(a) * 14 + 8; p.vy = Math.sin(a) * 14; p.vz = 40 + s * 30; p.max = 1.2 + s * 0.6; p.size = 4 + s * 3; p.grow = 3.2; p.a = 0.55; p.drag = 0.8; break;
        case 'fire': p.vx = Math.cos(a) * 25 * s; p.vy = Math.sin(a) * 25 * s; p.vz = 50 + s * 50; p.max = 0.35 + s * 0.25; p.size = 3 + s * 2; p.add = true; p.a = 0.9; p.grow = 0.5; p.col = s < 0.4 ? [1, 0.85, 0.3] : [1, 0.4, 0.1]; break;
        case 'dust': p.vx = Math.cos(a) * 60 * s; p.vy = Math.sin(a) * 60 * s; p.vz = 30 + s * 50; p.max = 0.5 + s * 0.4; p.size = 3 + s * 3; p.grow = 2; p.a = 0.5; p.grav = 120; break;
        case 'spark': p.vx = Math.cos(a) * 200 * s; p.vy = Math.sin(a) * 200 * s; p.vz = 60 + s * 180; p.max = 0.3 + s * 0.3; p.size = 1.6; p.add = true; p.grav = 700; p.drag = 1; p.a = 1; p.grow = 0.3; break;
        case 'debris': { // chunks of bodywork in the car's paint
          const sp = 90 + s * 160; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.vz = 120 + s * 220; p.max = 0.9 + s * 0.8; p.size = 1.6 + s * 1.4; p.grav = 900; p.drag = 0.6; p.a = 1; p.grow = 1; p.bounce = true;
          const c = car && car.pcol ? car.pcol : [0.5, 0.5, 0.5], k = Math.random() < 0.25 ? 0.25 : 0.7 + Math.random() * 0.4; p.col = [c[0] * k, c[1] * k, c[2] * k]; break;
        }
        case 'flame': { const h = car.h + Math.PI + (Math.random() - 0.5) * 0.5; p.vx = Math.cos(h) * 120 + car.vx * 0.5; p.vy = Math.sin(h) * 120 + car.vy * 0.5; p.vz = 5; p.max = 0.15 + s * 0.12; p.size = 3 + s * 2; p.add = true; p.a = 0.9; p.grow = 0.4; p.col = s < 0.4 ? [1, 0.9, 0.4] : [1, 0.45, 0.12]; break; }
        case 'poof': p.vx = Math.cos(a) * 90 * s; p.vy = Math.sin(a) * 90 * s; p.vz = 40 + s * 60; p.max = 0.5 + s * 0.3; p.size = 5 + s * 4; p.grow = 2; p.a = 0.7; break;
        case 'splash': p.vx = Math.cos(a) * 50; p.vy = Math.sin(a) * 50; p.vz = 80 + s * 60; p.max = 0.45; p.size = 2.2; p.grav = 500; p.a = 0.8; break;
        case 'ring': { const ang = i / n * Math.PI * 2; p.vx = Math.cos(ang) * 300; p.vy = Math.sin(ang) * 300; p.vz = 10; p.max = 0.4; p.size = 3; p.add = true; p.a = 0.9; p.col = [0.5, 1, 0.6]; p.drag = 3; p.grow = 1.5; break; }
        case 'confetti': p.vx = Math.cos(a) * 140 * s; p.vy = Math.sin(a) * 140 * s; p.vz = 200 + s * 200; p.max = 2.2; p.size = 2.6; p.grav = 260; p.drag = 1.5; p.a = 1; p.grow = 1; p.col = [[1, 0.3, 0.4], [1, 0.85, 0.2], [0.3, 0.8, 1], [0.5, 1, 0.4], [0.9, 0.5, 1]][i % 5]; break;
      }
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
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.z < 0.5) { p.z = 0.5; p.vz *= p.bounce ? -0.35 : -0.3; if (p.bounce) { p.vx *= 0.6; p.vy *= 0.6; } }
    }
    const sk = Game.skids; for (let i = sk.length - 1; i >= 0; i--) { sk[i].t += dt; if (sk[i].t > 12) sk.splice(i, 1); }
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
      if (Game.skids.length > 1200) Game.skids.shift();
      Game.skids.push({ a: c.skidL, b: L, t: 0 }, { a: c.skidR, b: Rr, t: 0 });
      c.skidL = L; c.skidR = Rr;
    } else if (!c.skidL) { c.skidL = L; c.skidR = Rr; }
  }

  // ---------- build the frame for the renderer ----------
  const B = { alpha: new G.Builder(4096), add: new G.Builder(4096), skid: new G.Builder(4096) };
  function resetB(b) { b.n = 0; b.idx.length = 0; }
  Game.render = function () {
    if (!Game.world || !Game.cars) return;
    const cam = R.cam, saveD = cam.dist; cam.dist = cam.distShow || cam.dist;
    R.camMatrices();
    const cars = [], lights = [];
    for (const c of Game.cars) {
      // dents are re-meshed at most a few times a second
      if (c.dirty && Game.time - c.remeshT > 0.08) { c.dirty = false; c.remeshT = Game.time; G.free(R.gl, c.mesh); c.mesh = G.upload(R.gl, G.mesh(c.vox, CR.CAR_VS, 8, 0, 4.5)); }
      const bob = c.st.hover && !c.wrecked ? 3 + Math.sin(Game.time * 7 + c.id) * 1.2 : (c.state === 'race' && !c.air && !c.wrecked ? Math.abs(Math.sin(Game.time * 30 + c.id)) * Math.min(1, Math.hypot(c.vx, c.vy) / 300) * 0.4 : 0);
      const rat = c.bumpT > 0 ? (Math.random() - 0.5) : 0;
      const tilt = c.wrecked ? 0.18 * Math.sin(c.id * 3.1) : 0; // wrecks sag to one side
      R.carMatrix(c.x, c.y, c.z + bob + Math.abs(rat) * 4, c.h, c.vis.pitch + rat * 0.12, c.vis.roll + rat * 0.18 + tilt, c.m);
      const f = c.flash > 0 ? 1 + c.flash * 2.5 : 1;
      cars.push({ mesh: c.mesh, m: c.m, tint: c.flash > 0 ? [f, 1, 1] : null });
      if (c.boosting) lights.push({ x: c.x - Math.cos(c.h) * 22, y: 10 + c.z, z: c.y - Math.sin(c.h) * 22, col: [1.6, 0.8, 0.25], rad: 110 });
      if (c.wrecked && !c.out) lights.push({ x: c.x, y: 16, z: c.y, col: [1.1, 0.45, 0.15].map((v) => v * (0.8 + Math.random() * 0.4)), rad: 90 });
      if (Game.world.light === CR.LIGHT.night || Game.world.light === CR.LIGHT.monitor) lights.push({ x: c.x + Math.cos(c.h) * 30, y: 8 + c.z, z: c.y + Math.sin(c.h) * 30, col: [0.7, 0.68, 0.5], rad: 90 });
      if (c.cursor && Game.mode !== 'attract' && !c.out) {
        const m = c.cm || (c.cm = new Float32Array(16));
        CR.M4.model(c.x, 38 + Math.sin(Game.time * 3) * 3 + c.z, c.y, Game.time * 1.6, 0, 0, 1, m);
        cars.push({ mesh: c.cursor, m });
      }
    }
    // pickups bob and turn, with a little glow under them
    for (const p of Game.pickups) {
      const sc = p.type === 'wrench' ? 0.42 : 0.62, pop = Math.min(1, p.t * 4);
      CR.M4.model(p.x, 6 + Math.sin(Game.time * 3 + p.x) * 3, p.y, Game.time * 1.8, p.type === 'wrench' ? 0 : 0.4, 0, sc * pop, p.m);
      cars.push({ mesh: Game.pickMesh[p.type], m: p.m, tint: p.type === 'wrench' ? [1.1, 1.3, 1.1] : [1.3, 1.2, 0.8] });
      lights.push({ x: p.x, y: 20, z: p.y, col: p.type === 'wrench' ? [0.4, 1.2, 0.5] : [1.2, 0.9, 0.3], rad: 80 });
    }
    for (const b of Game.world.balls) { b.m = b.m || new Float32Array(16); CR.M4.model(b.x, b.r + b.z, b.y, -b.dir, b.rot, 0, 1, b.m); }
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
      const t = p.life / p.max, s = p.size * (1 + (p.grow - 1) * t), a = p.bounce ? p.a * (1 - Math.max(0, t - 0.7) / 0.3) : p.a * (1 - t * t);
      quad(p.add ? B.add : B.alpha, p.x, p.y, p.z, s, p.col, a);
    }
    for (const pu of Game.pulses) lights.push({ x: pu.x, y: 30, z: pu.y, col: pu.col.map((v) => v * pu.t * 5), rad: 220 });
    for (const m of Game.motes) quad(B.add, m.x, m.y, m.z, 1.2, [1, 0.92, 0.7], 0.35 + Math.sin(m.p * 2) * 0.2);
    const sc = ['toybox', 'pool', 'computer', 'garage'].includes(Game.world.def.theme) ? [0.02, 0.02, 0.04] : [0.12, 0.1, 0.1];
    for (const k of Game.skids) {
      const dx = k.b[0] - k.a[0], dy = k.b[1] - k.a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * 1.8, ny = dx / l * 1.8, al = 0.38 * (1 - k.t / 12);
      const i0 = B.skid.v(k.a[0] + nx, 0.2, k.a[1] + ny, 0, 1, 0, sc[0], sc[1], sc[2], al), i1 = B.skid.v(k.a[0] - nx, 0.2, k.a[1] - ny, 0, 1, 0, sc[0], sc[1], sc[2], al);
      const i2 = B.skid.v(k.b[0] - nx, 0.2, k.b[1] - ny, 0, 1, 0, sc[0], sc[1], sc[2], al), i3 = B.skid.v(k.b[0] + nx, 0.2, k.b[1] + ny, 0, 1, 0, sc[0], sc[1], sc[2], al);
      B.skid.quad(i0, i1, i2, i3);
    }
    const lead = Game.focus();
    let focusY = 0.5;
    if (lead) { const p = R.project(lead.x, lead.y, lead.z); focusY = U.clamp(p[1] * 0.5 + 0.5, 0.25, 0.75); }
    R.render({ cars, parts: B, skid: B.skid, lights, time: Game.time, focusY, band: Game.mode === 'attract' ? 0.1 : 0.16, dof: Game.intro > 0 ? 1.4 : 1 });
    cam.dist = saveD;
  };

  CR.Derby = Game;
})(window.CR);
