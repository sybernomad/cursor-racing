// Cursor Racing — Web Audio synth. Every sound and the music are generated live (no audio files).
(function (CR) {
  'use strict';
  let ac = null, out = null, sfx = null, mus = null, noiseBuf = null, eng = null, skid = null;
  const A = { enabled: true, vol: 0.8, music: true, musicVol: 0.5 };
  const last = {};

  A.init = function () {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      out = ac.createGain(); out.gain.value = 0.9;
      const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      out.connect(comp); comp.connect(ac.destination);
      sfx = ac.createGain(); sfx.connect(out); mus = ac.createGain(); mus.connect(out);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      A.apply();
    } catch (e) { ac = null; }
  };
  A.apply = function () {
    if (!ac) return; const t = ac.currentTime;
    sfx.gain.setTargetAtTime(A.enabled ? 0.6 * A.vol : 0, t, 0.05);
    mus.gain.setTargetAtTime(A.music ? 0.3 * A.musicVol : 0, t, 0.3);
  };
  A.suspend = function () { if (ac && ac.state === 'running') ac.suspend(); };
  A.resume = function () { if (ac && ac.state === 'suspended') ac.resume(); };

  function env(g, t, a, peak, dcy) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy); }
  function tone(type, f0, f1, dur, vol, delay = 0, dest = sfx) {
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, 0.005, vol, dur); o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, freq = 1200, q = 1, type = 'bandpass', delay = 0, f1) {
    const t = ac.currentTime + delay, s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = q;
    const g = ac.createGain(); env(g, t, 0.003, vol, dur);
    s.connect(f); f.connect(g); g.connect(sfx); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  A.play = function (name, o = {}) {
    if (!A.enabled || !ac) return;
    const now = performance.now();
    const gap = { bump: 70, wall: 80, tick: 40, coin: 50, splash: 200, land: 120 }[name] || 0;
    if (gap && last[name] && now - last[name] < gap) return;
    last[name] = now;
    const v = o.vol ?? 1;
    switch (name) {
      case 'bump': noise(0.1, 0.45 * v, 900, 1.2); tone('square', 160, 70, 0.08, 0.12 * v); break;
      case 'wall': noise(0.14, 0.55 * v, 500, 0.9, 'lowpass'); tone('triangle', 220, 90, 0.1, 0.15 * v); break;
      case 'land': noise(0.12, 0.35 * v, 300, 0.7, 'lowpass'); tone('sine', 110, 50, 0.12, 0.25 * v); break;
      case 'jump': tone('square', 220, 660, 0.18, 0.08 * v); noise(0.2, 0.15 * v, 800, 0.6, 'bandpass', 0, 2400); break;
      case 'boost': noise(0.45, 0.35 * v, 400, 0.6, 'bandpass', 0, 3200); tone('sawtooth', 140, 420, 0.4, 0.07 * v); break;
      case 'pad': tone('square', 660, 1320, 0.12, 0.08 * v); tone('square', 990, 1980, 0.12, 0.05 * v, 0.06); break;
      case 'splash': noise(0.35, 0.4 * v, 1800, 0.8, 'bandpass', 0, 500); break;
      case 'fall': tone('sine', 700, 80, 0.9, 0.22 * v); break;
      case 'respawn': tone('triangle', 400, 900, 0.2, 0.1 * v); tone('triangle', 600, 1200, 0.2, 0.08 * v, 0.1); break;
      case 'ko': noise(0.5, 0.6 * v, 600, 0.6, 'lowpass', 0, 80); tone('square', 300, 60, 0.5, 0.12 * v); break;
      case 'count': tone('square', 440, 0, 0.14, 0.13); break;
      case 'go': tone('square', 880, 0, 0.35, 0.14); tone('square', 1320, 0, 0.35, 0.09); break;
      case 'lap': [784, 988, 1175].forEach((f, i) => tone('triangle', f, 0, 0.14, 0.12, i * 0.08)); break;
      case 'final': [659, 784, 988, 1319].forEach((f, i) => tone('square', f, 0, 0.12, 0.08, i * 0.09)); break;
      case 'best': [1046, 1318, 1568, 2093].forEach((f, i) => tone('triangle', f, 0, 0.12, 0.1, i * 0.06)); break;
      case 'win': [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone('square', f, 0, 0.2, 0.1, i * 0.12)); break;
      case 'lose': [392, 330, 262].forEach((f, i) => tone('triangle', f, 0, 0.28, 0.14, i * 0.18)); break;
      case 'ui': tone('sine', 1200, 900, 0.05, 0.08); break;
      case 'back': tone('sine', 800, 500, 0.06, 0.08); break;
      case 'coin': tone('square', 988, 0, 0.07, 0.07); tone('square', 1318, 0, 0.12, 0.07, 0.06); break;
      case 'buy': [784, 1046, 1318].forEach((f, i) => tone('triangle', f, 0, 0.12, 0.12, i * 0.07)); break;
      case 'error': tone('square', 180, 120, 0.15, 0.1); break;
      case 'wrong': tone('square', 330, 0, 0.12, 0.07); tone('square', 262, 0, 0.12, 0.07, 0.14); break;
    }
  };

  // continuous engine + tyre squeal for the player's car
  A.engine = function (spd, thr, boost, on) {
    if (!ac) return;
    if (!eng) {
      const o1 = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
      o1.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.Q.value = 3; g.gain.value = 0;
      o1.connect(f); o2.connect(f); f.connect(g); g.connect(sfx); o1.start(); o2.start();
      const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const sf = ac.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 2600; sf.Q.value = 4;
      const sg = ac.createGain(); sg.gain.value = 0; s.connect(sf); sf.connect(sg); sg.connect(sfx); s.start();
      eng = { o1, o2, f, g }; skid = { sg, sf };
    }
    const t = ac.currentTime;
    if (!on || !A.enabled) { eng.g.gain.setTargetAtTime(0, t, 0.08); skid.sg.gain.setTargetAtTime(0, t, 0.05); return; }
    // fake gears: pitch climbs then drops back as speed rises
    const gears = 4, gs = Math.min(spd, 1.3) * gears, gi = Math.min(gears - 1, Math.floor(gs)), gf = gs - gi;
    const base = 55 + gi * 9 + gf * (70 + gi * 10) + (boost ? 30 : 0);
    eng.o1.frequency.setTargetAtTime(base, t, 0.04); eng.o2.frequency.setTargetAtTime(base * 0.5, t, 0.04);
    eng.f.frequency.setTargetAtTime(400 + thr * 900 + spd * 600 + (boost ? 800 : 0), t, 0.06);
    eng.g.gain.setTargetAtTime(0.035 + thr * 0.03 + (boost ? 0.02 : 0), t, 0.06);
  };
  A.skid = function (level) {
    if (!skid || !ac) return;
    const t = ac.currentTime;
    skid.sg.gain.setTargetAtTime(A.enabled ? Math.min(0.12, level * 0.12) : 0, t, 0.05);
    skid.sf.frequency.setTargetAtTime(2200 + level * 900, t, 0.1);
  };

  // ---------------------------------------------------------------------------
  // Generative chiptune-ish music. 'menu' = laid back, 'race' = driving beat.
  // ---------------------------------------------------------------------------
  const PROG = [[0, 4, 7, 11], [-3, 0, 4, 7], [-7, -3, 0, 5], [-5, -1, 2, 7]]; // Cmaj7, Am7, Fmaj7(ish), G
  const hz = (st) => 261.63 * Math.pow(2, st / 12);
  const M = { mode: null, timer: null, step: 0, next: 0, verb: null, seed: 1 };
  function verb() {
    if (M.verb) return M.verb;
    const len = ac.sampleRate * 1.8, ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    const cv = ac.createConvolver(); cv.buffer = ir; const wet = ac.createGain(); wet.gain.value = 0.35; cv.connect(wet); wet.connect(mus);
    M.verb = cv; return cv;
  }
  function note(type, f, t, dur, vol, cut = 2400, wet = true) {
    const o = ac.createOscillator(), g = ac.createGain(), fl = ac.createBiquadFilter();
    o.type = type; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.value = cut;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(fl); fl.connect(g); g.connect(mus); if (wet) g.connect(verb());
    o.start(t); o.stop(t + dur + 0.05);
  }
  function drum(t, kind, vol) {
    if (kind === 'k') { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); o.connect(g); g.connect(mus); o.start(t); o.stop(t + 0.2); return; }
    const s = ac.createBufferSource(); s.buffer = noiseBuf; const f = ac.createBiquadFilter();
    f.type = kind === 'h' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'h' ? 7000 : 1800; f.Q.value = 0.8;
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'h' ? 0.04 : 0.14));
    s.connect(f); f.connect(g); g.connect(mus); s.start(t, Math.random() * 0.5); s.stop(t + 0.2);
  }
  const MEL = [0, 2, 1, 3, 2, 1, 0, 3, 1, 2, 3, 2, 0, 1, 2, 3];
  function schedule() {
    if (!ac || !M.mode) return;
    const race = M.mode === 'race', beat = race ? 0.14 : 0.26; // 16th notes
    while (M.next < ac.currentTime + 0.35) {
      const t = M.next, st = M.step, bar = Math.floor(st / 16), ch = PROG[bar % 4], b = st % 16;
      if (b === 0) for (const n of ch) note('triangle', hz(n - 12), t, beat * 15, race ? 0.018 : 0.028, 1400);
      // bass
      if (race ? b % 2 === 0 : b % 4 === 0) note('square', hz(ch[0] - 24) * (b % 8 === 6 ? 1.5 : 1), t, beat * 1.6, 0.05, 600, false);
      // lead arpeggio / melody
      if (race) { if (b % 2 === 0 || b === 7 || b === 15) note('square', hz(ch[MEL[(b + bar * 3) % 16]] + 12), t, beat * 1.4, 0.022, 3000); }
      else if (b % 4 === 2) note('triangle', hz(ch[MEL[(b + bar) % 16]] + 12), t, beat * 3, 0.035, 2600);
      if (race) {
        if (b % 4 === 0) drum(t, 'k', 0.5);
        if (b % 8 === 4) drum(t, 's', 0.16);
        if (b % 2 === 1) drum(t, 'h', 0.05);
      } else if (b % 8 === 4) drum(t, 'h', 0.03);
      M.step++; M.next += beat;
    }
  }
  A.setMusic = function (mode) {
    if (!ac || mode === M.mode) return;
    M.mode = mode; clearInterval(M.timer); M.timer = null;
    if (!mode) return;
    M.next = Math.max(M.next, ac.currentTime + 0.1); M.step = Math.floor(M.step / 16) * 16;
    M.timer = setInterval(schedule, 100); schedule();
  };
  A.vibrate = function (ms) { try { if (A.vib && navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ } };
  A.vib = true;

  CR.Audio = A;
})(window.CR);
