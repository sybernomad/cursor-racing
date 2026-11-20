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
    if (ac && M.id) { const id = M.id; M.id = null; A.setMusic(id); }
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
    const gap = { rumble: 85, bump: 70, wall: 80, tick: 40, coin: 50, splash: 200, land: 120 }[name] || 0;
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
      case 'horn': tone('square', 392, 0, 0.35, 0.06); tone('square', 494, 0, 0.35, 0.05); tone('square', 392, 0, 0.3, 0.06, 0.42); tone('square', 494, 0, 0.3, 0.05, 0.42); break;
      case 'spring': tone('sine', 180, 900, 0.3, 0.2 * v); tone('triangle', 360, 1400, 0.25, 0.06 * v); break;
      case 'boing': tone('sine', 520, 260, 0.22, 0.22 * v); tone('square', 1040, 520, 0.12, 0.05 * v); break;
      case 'item': [880, 1175, 1568].forEach((f, i) => tone('square', f, 0, 0.07, 0.07, i * 0.05)); break;
      case 'shield': tone('sine', 600, 1800, 0.3, 0.12 * v); noise(0.3, 0.12 * v, 4000, 2, 'bandpass', 0, 8000); break;
      case 'shock': noise(0.5, 0.6 * v, 200, 0.6, 'lowpass', 0, 60); tone('sine', 90, 30, 0.45, 0.4 * v); tone('sawtooth', 600, 80, 0.3, 0.08 * v); break;
      case 'shoot': tone('square', 1200, 300, 0.12, 0.08 * v); noise(0.08, 0.15 * v, 3000, 1); break;
      case 'rumble': noise(0.09, 0.22 * v, 260, 0.8, 'lowpass'); tone('square', 70 + Math.random() * 30, 50, 0.06, 0.05 * v); break;
      case 'wrong': tone('square', 330, 0, 0.12, 0.07); tone('square', 262, 0, 0.12, 0.07, 0.14); break;
    }
  };

  // continuous engine + tire squeal for the player's car
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
  // Music: a small step sequencer with a song for every table, plus the menu.
  // Each song names a tempo, key, mode, chord progression (one chord per bar) and the parts that
  // play on each 16th step. Melodies are composed once per song from a fixed seed, so a table
  // always has the same tune. setIntensity(1) on the final lap adds open hats and doubles the lead.
  // Patterns: '1' plays, '.' rests. Bass patterns use chord tones: 1 root, 3 third, 5 fifth, 8 octave,
  // 7 seventh, w walks to the next bar's root.
  // ---------------------------------------------------------------------------
  const MAJ = [0, 2, 4, 5, 7, 9, 11], MIN = [0, 2, 3, 5, 7, 8, 10], DOR = [0, 2, 3, 5, 7, 9, 10], MIX = [0, 2, 4, 5, 7, 9, 10];
  const SONGS = {
    menu: { name: 'Garage Radio', bpm: 104, key: 48, mode: MAJ, prog: [0, 5, 3, 4, 0, 5, 1, 4], swing: 0.1,
      drums: { k: '1.......1.1.....', s: '....1.......1...', h: '..1...1...1...1.', sh: '1111111111111111' },
      bass: { pat: '1.....5.1...5.w.', kind: 'pick' }, chord: { kind: 'pad' }, arp: { kind: 'marimba', pat: '1.1.1.1.1.1.1.11', seq: [0, 1, 2, 3, 2, 1] },
      lead: { kind: 'whistle', rhythm: '1..1..1.1...1.1.1...1..1..1.....', range: [7, 14] } },
    breakfast: { name: 'Sunny Side Up', bpm: 128, key: 53, mode: MAJ, prog: [0, 3, 1, 4, 0, 3, 4, 4], swing: 0.16, seven: true,
      drums: { k: '1...1...1...1...', s: '....1.......1...', h: '..1...1...1...1.', c: '....1.......1..1' },
      bass: { pat: '1..5..8.1..5..w.', kind: 'tri' }, chord: { kind: 'stab', pat: '..1...1...1...1.' }, arp: { kind: 'marimba', pat: '1.11.1.11.1.1.11', seq: [0, 2, 1, 3, 2, 1, 0, 2] },
      lead: { kind: 'chip', rhythm: '1.1.1...1.1.11..1.1.1...1...1...', range: [7, 15] } },
    desk: { name: 'Homework Beat', bpm: 88, key: 50, mode: DOR, prog: [0, 3, 6, 2, 0, 3, 4, 4], swing: 0.28, seven: true,
      drums: { k: '1.....1...1.....', br: '....1.......1...', h: '1.1.1.1.1.1.1.1.' },
      bass: { pat: '1.....5...1..3..', kind: 'sub' }, chord: { kind: 'keys', pat: '1.....1.....1...' }, arp: null,
      lead: { kind: 'flute', rhythm: '..1.1..1....1...1...1.1...1.....', range: [7, 13] } },
    sandbox: { name: 'Surf the Sandpit', bpm: 152, key: 52, mode: MIN, prog: [0, 5, 2, 6, 0, 5, 3, 4], swing: 0,
      drums: { k: '1.....1.1.......', s: '....1.......1...', h: '1.1.1.1.1.1.1.1.', t: '..............11' },
      bass: { pat: '1.1.1.1.5.5.5.5.', kind: 'pick' }, chord: { kind: 'strum', pat: '1..1..1...1..1..' }, arp: null,
      lead: { kind: 'twang', rhythm: '1.1.1.1.111.1...1.1.1.1.1...11..', range: [7, 14] } },
    pool: { name: 'Corner Pocket', bpm: 124, key: 46, mode: MAJ, prog: [1, 4, 0, 5, 1, 4, 0, 0], swing: 0.3, seven: true,
      drums: { k: '1.......1.......', br: '....1.......1...', ride: '1..11..11..11..1' },
      bass: { pat: '1...3...5...w...', kind: 'walk' }, chord: { kind: 'keys', pat: '...1......1.....' }, arp: { kind: 'vibes', pat: '1.....1.....1...', seq: [0, 1, 2, 3] },
      lead: { kind: 'sax', rhythm: '1..1.1....1.1...1.1..1.1.......1', range: [7, 13] } },
    bath: { name: 'Bubble Bath', bpm: 112, key: 55, mode: MAJ, prog: [0, 4, 5, 3, 0, 4, 3, 4], swing: 0.12,
      drums: { k: '1.......1.......', rim: '....1.......1...', sh: '1.1.1.1.1.1.1.1.' },
      bass: { pat: '1.....5.1.......', kind: 'sub' }, chord: { kind: 'pad' }, arp: { kind: 'pluck', pat: '1.1.11.1.1.11.1.', seq: [0, 1, 2, 3, 2, 1, 2, 3] },
      lead: { kind: 'bell', rhythm: '1...1...1.1.1...1...1.1...1.....', range: [9, 16] } },
    toybox: { name: 'Night Light', bpm: 118, key: 45, mode: MIN, prog: [0, 5, 2, 6, 0, 5, 3, 4], swing: 0, seven: true,
      drums: { k: '1...1...1...1...', s: '....1.......1...', h: '..1...1...1...1.' },
      bass: { pat: '1.1.1.1.1.1.1.1.', kind: 'saw' }, chord: { kind: 'pad' }, arp: { kind: 'synth', pat: '1111111111111111', seq: [0, 1, 2, 3, 2, 1] },
      lead: { kind: 'brass', rhythm: '1...1.1.1...1...1...1.1.1.1.....', range: [7, 14] } },
    garage: { name: 'Torque Wrench', bpm: 140, key: 40, mode: MIN, prog: [0, 0, 5, 6, 0, 0, 3, 4], swing: 0,
      drums: { k: '1.....1.1.1.....', s: '....1.......1...', h: '1.1.1.1.1.1.1.1.', c: '...............1' },
      bass: { pat: '1.1.1.1.1.1.1.1.', kind: 'saw' }, chord: { kind: 'power', pat: '1..1..1.....1.1.' }, arp: null,
      lead: { kind: 'guitar', rhythm: '1.1.11..1.1.1...1.111.1.1...1...', range: [7, 14] } },
    computer: { name: 'Press Start', bpm: 160, key: 48, mode: MIN, prog: [0, 6, 5, 6, 0, 6, 5, 4], swing: 0,
      drums: { k: '1...1...1...1...', s: '....1.......1...', h: '1111111111111111' },
      bass: { pat: '18181818181818w.', kind: 'square' }, chord: null, arp: { kind: 'chip', pat: '1111111111111111', seq: [0, 1, 2, 3, 2, 1, 0, 2] },
      lead: { kind: 'chip', rhythm: '1.1.1.1.11.11...1.1.1.1.1.1.1...', range: [9, 16] } },
    bakery: { name: 'Oven Timer Polka', bpm: 132, key: 46, mode: MAJ, prog: [0, 4, 4, 0, 0, 3, 4, 0], swing: 0.05,
      drums: { k: '1.......1.......', s: '....1.......1...', sh: '..1...1...1...1.' },
      bass: { pat: '1.......5.......', kind: 'tuba' }, chord: { kind: 'stab', pat: '....1.......1...' }, arp: { kind: 'glock', pat: '1...1...1...1.1.', seq: [2, 1, 0, 1] },
      lead: { kind: 'clarinet', rhythm: '1.1.1.1.1...1...1.1.1.1.1.1.1...', range: [7, 14] } },
    frost: { name: 'Frosted Glass', bpm: 100, key: 50, mode: MAJ, prog: [0, 5, 3, 4, 0, 5, 1, 4], swing: 0.08,
      drums: { k: '1.......1.......', sleigh: '1.1.1.1.1.1.1.1.', rim: '....1.......1...' },
      bass: { pat: '1.......5.......', kind: 'sub' }, chord: { kind: 'pad' }, arp: { kind: 'musicbox', pat: '1.1.1.1.1.1.1.1.', seq: [0, 2, 1, 3, 2, 1] },
      lead: { kind: 'flute', rhythm: '1...1.1.1.......1...1.1.1.......', range: [9, 15] } },
    picnic: { name: 'Ants in the Pants', bpm: 128, key: 55, mode: MIX, prog: [0, 6, 3, 0, 0, 6, 4, 0], swing: 0.18,
      drums: { k: '1.......1.1.....', c: '....1.......1...', sh: '1.1.1.1.1.1.1.1.' },
      bass: { pat: '1...5...1...5...', kind: 'pick' }, chord: { kind: 'strum', pat: '..1...1...1...1.' }, arp: { kind: 'banjo', pat: '1.11.11.1.11.11.', seq: [0, 1, 2, 1, 3, 1] },
      lead: { kind: 'whistle', rhythm: '1.1.1...1.1.1...1.111.1.1...1...', range: [7, 14] } },
    town: { name: 'Tiny Town Parade', bpm: 112, key: 48, mode: MAJ, prog: [0, 3, 4, 0, 0, 3, 1, 4], swing: 0,
      drums: { k: '1.......1.......', roll: '1.11....1.11..1.', s: '....1.......1...' },
      bass: { pat: '1...5...1...5...', kind: 'tuba' }, chord: { kind: 'stab', pat: '..1...1...1...1.' }, arp: { kind: 'glock', pat: '1.....1.1.....1.', seq: [0, 2, 1, 3] },
      lead: { kind: 'brass', rhythm: '1..11.1.1...1...1..11.1.1.1.1...', range: [7, 14] } },
    laundry: { name: 'Rinse and Repeat', bpm: 122, key: 52, mode: MAJ, prog: [0, 5, 3, 4, 0, 5, 3, 3], swing: 0.12,
      drums: { k: '1.......1.1.....', rim: '....1.......1...', sh: '1111111111111111' },
      bass: { pat: '1..1..5.1..1..w.', kind: 'pick' }, chord: { kind: 'keys', pat: '..1...1...1...1.' }, arp: { kind: 'pluck', pat: '1.1.1.1.1.1.1.11', seq: [0, 1, 2, 3, 2, 1] },
      lead: { kind: 'whistle', rhythm: '1.1...1.1.1.1...1.1...1.1...1...', range: [7, 14] } },
    shelf: { name: 'Dewey Decimal', bpm: 96, key: 45, mode: DOR, prog: [0, 3, 0, 4, 0, 3, 6, 4], swing: 0.3, seven: true,
      drums: { k: '1.......1.....1.', br: '....1.......1...', ride: '1..11..11..11..1' },
      bass: { pat: '1...3...5...w...', kind: 'walk' }, chord: { kind: 'keys', pat: '1.....1.....1...' }, arp: { kind: 'vibes', pat: '1.....1.....1...', seq: [0, 2, 1, 3] },
      lead: { kind: 'clarinet', rhythm: '..1.1..1....1...1...1.1...1.....', range: [7, 13] } },
    fridge: { name: 'Keep It Chill', bpm: 110, key: 53, mode: MAJ, prog: [0, 4, 5, 3, 0, 4, 1, 4], swing: 0.06,
      drums: { k: '1...1...1...1...', s: '....1.......1...', h: '..1...1...1...1.' },
      bass: { pat: '1.....5.1.....5.', kind: 'sub' }, chord: { kind: 'pad' }, arp: { kind: 'musicbox', pat: '1.1.1.1.1.1.1.1.', seq: [0, 2, 1, 3, 2, 1] },
      lead: { kind: 'bell', rhythm: '1...1.1.1...1...1...1.1.1.......', range: [9, 15] } },
    aquarium: { name: 'Fish Food', bpm: 92, key: 50, mode: MIN, prog: [0, 5, 3, 4, 0, 5, 6, 4], swing: 0.1, seven: true,
      drums: { k: '1.......1.......', rim: '....1.......1...', sh: '1.1.1.1.1.1.1.1.' },
      bass: { pat: '1.....5...1.....', kind: 'sub' }, chord: { kind: 'pad' }, arp: { kind: 'vibes', pat: '1.1...1.1...1.1.', seq: [0, 1, 2, 3, 2, 1] },
      lead: { kind: 'flute', rhythm: '1.......1.1.1...1.......1.1.....', range: [9, 15] } },
  };
  A.SONGS = SONGS;
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const M = { song: null, id: null, timer: null, step: 0, next: 0, verb: null, intensity: 0, dist: null };
  function verb() {
    if (M.verb) return M.verb;
    const len = ac.sampleRate * 1.8, ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    const cv = ac.createConvolver(); cv.buffer = ir; const wet = ac.createGain(); wet.gain.value = 0.3; cv.connect(wet); wet.connect(mus);
    M.verb = cv; return cv;
  }
  function distortion() {
    if (M.dist) return M.dist;
    const ws = ac.createWaveShaper(), n = 1024, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i / n * 2 - 1; curve[i] = Math.tanh(x * 4); }
    ws.curve = curve; const g = ac.createGain(); g.gain.value = 0.5; ws.connect(g); g.connect(mus); g.connect(verb());
    M.dist = ws; return ws;
  }
  // one oscillator voice with an envelope, filter and optional vibrato
  function osc(o) {
    const t = o.t, type = o.type || 'sine', f = o.f, dur = o.dur, vol = o.vol;
    const os = ac.createOscillator(), g = ac.createGain(); os.type = type; os.frequency.setValueAtTime(f, t);
    if (o.glide) os.frequency.exponentialRampToValueAtTime(o.glide, t + dur);
    if (o.vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = o.vib; lg.gain.value = f * 0.012; l.connect(lg); lg.connect(os.frequency); l.start(t); l.stop(t + dur + 0.1); }
    let node = os;
    if (o.cut) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(o.cut, t); if (o.cutTo) fl.frequency.exponentialRampToValueAtTime(o.cutTo, t + dur); fl.Q.value = o.q || 1; node.connect(fl); node = fl; }
    const att = o.att || 0.005;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + att);
    if (o.sus) { g.gain.setValueAtTime(vol, t + Math.max(att, dur - 0.05)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.06); }
    else g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (o.trem) { const l = ac.createOscillator(), lg = ac.createGain(), tg = ac.createGain(); l.frequency.value = o.trem; lg.gain.value = 0.5; tg.gain.value = 0.5; l.connect(lg); lg.connect(tg.gain); node.connect(tg); node = tg; l.start(t); l.stop(t + dur + 0.1); }
    node.connect(g); g.connect(o.dist ? distortion() : mus); if (o.wet && !o.dist) { const w = ac.createGain(); w.gain.value = o.wet; g.connect(w); w.connect(verb()); }
    os.start(t); os.stop(t + dur + 0.12);
  }
  function hit(o) { // filtered noise burst
    const t = o.t, s = ac.createBufferSource(); s.buffer = noiseBuf; const f = ac.createBiquadFilter();
    f.type = o.ft || 'highpass'; f.frequency.value = o.freq; f.Q.value = o.q || 0.8;
    const g = ac.createGain(); g.gain.setValueAtTime(o.vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    s.connect(f); f.connect(g); g.connect(mus); if (o.wet) { const w = ac.createGain(); w.gain.value = o.wet; g.connect(w); w.connect(verb()); }
    s.start(t, Math.random() * 0.5); s.stop(t + o.dur + 0.05);
  }
  function inst(kind, n, t, dur, vol) {
    const f = midi(n);
    switch (kind) {
      case 'chip': osc({ t, f, dur: Math.min(dur, 0.22), vol: vol * 0.55, type: 'square', cut: 3200 }); break;
      case 'whistle': case 'flute': osc({ t, f, dur: dur * 0.95, vol: vol * 0.9, type: 'sine', vib: 5.5, att: 0.03, sus: true, wet: 0.35 }); if (kind === 'flute') hit({ t, freq: f * 2, ft: 'bandpass', q: 8, vol: vol * 0.12, dur: 0.06 }); break;
      case 'bell': case 'musicbox': osc({ t, f, dur: 1.4, vol: vol * 0.7, type: 'sine', wet: 0.5 }); osc({ t, f: f * (kind === 'bell' ? 3.5 : 4), dur: 0.35, vol: vol * 0.25, type: 'sine' }); break;
      case 'glock': osc({ t, f: f * 2, dur: 0.6, vol: vol * 0.55, type: 'sine', wet: 0.4 }); osc({ t, f: f * 5.4, dur: 0.12, vol: vol * 0.15, type: 'sine' }); break;
      case 'vibes': osc({ t, f, dur: 1.1, vol: vol * 0.6, type: 'sine', trem: 5, wet: 0.5 }); break;
      case 'marimba': osc({ t, f, dur: 0.4, vol: vol * 0.8, type: 'sine', wet: 0.2 }); osc({ t, f: f * 4, dur: 0.06, vol: vol * 0.2, type: 'sine' }); break;
      case 'pluck': case 'banjo': osc({ t, f, dur: kind === 'banjo' ? 0.28 : 0.45, vol: vol * 0.7, type: kind === 'banjo' ? 'sawtooth' : 'triangle', cut: 3600, cutTo: 500, wet: 0.25 }); break;
      case 'synth': osc({ t, f, dur: 0.2, vol: vol * 0.4, type: 'sawtooth', cut: 2400, cutTo: 700, q: 4, wet: 0.3 }); break;
      case 'brass': osc({ t, f, dur, vol: vol * 0.5, type: 'sawtooth', cut: 600, cutTo: 2400, att: 0.04, sus: true, wet: 0.3 }); osc({ t, f: f * 1.005, dur, vol: vol * 0.3, type: 'sawtooth', cut: 1600, att: 0.04, sus: true }); break;
      case 'sax': osc({ t, f, dur, vol: vol * 0.45, type: 'sawtooth', cut: 1400, q: 3, vib: 4.5, att: 0.03, sus: true, wet: 0.35 }); break;
      case 'clarinet': osc({ t, f, dur, vol: vol * 0.5, type: 'square', cut: 1500, vib: 5, att: 0.02, sus: true, wet: 0.3 }); break;
      case 'twang': osc({ t, f, dur: dur * 0.9, vol: vol * 0.35, type: 'sawtooth', cut: 2600, cutTo: 900, trem: 9, dist: true }); break;
      case 'guitar': osc({ t, f, dur: dur * 0.95, vol: vol * 0.3, type: 'sawtooth', cut: 3000, vib: 6, sus: true, dist: true }); break;
      case 'keys': osc({ t, f, dur: 1.2, vol: vol * 0.45, type: 'sine', trem: 4, wet: 0.35 }); osc({ t, f: f * 2, dur: 0.4, vol: vol * 0.12, type: 'sine' }); break;
      case 'pad': osc({ t, f, dur, vol: vol * 0.35, type: 'triangle', att: dur * 0.3, sus: true, wet: 0.6 }); osc({ t, f: f * 1.006, dur, vol: vol * 0.25, type: 'triangle', att: dur * 0.3, sus: true }); break;
      case 'stab': osc({ t, f, dur: 0.16, vol: vol * 0.45, type: 'square', cut: 1800, wet: 0.2 }); break;
      case 'strum': osc({ t, f, dur: 0.35, vol: vol * 0.32, type: 'sawtooth', cut: 2200, cutTo: 600, wet: 0.25 }); break;
      case 'power': osc({ t, f, dur: 0.3, vol: vol * 0.28, type: 'sawtooth', cut: 2600, sus: true, dist: true }); break;
    }
  }
  function bassNote(kind, n, t, dur) {
    const f = midi(n);
    switch (kind) {
      case 'tri': osc({ t, f, dur: dur * 0.9, vol: 0.12, type: 'triangle' }); break;
      case 'sub': osc({ t, f, dur: dur * 1.2, vol: 0.14, type: 'sine', att: 0.01 }); break;
      case 'pick': case 'walk': osc({ t, f, dur: dur * 0.85, vol: 0.12, type: 'triangle', cut: 1200 }); osc({ t, f: f * 2, dur: 0.05, vol: 0.03, type: 'square', cut: 1500 }); break;
      case 'saw': osc({ t, f, dur: dur * 0.8, vol: 0.07, type: 'sawtooth', cut: 900, cutTo: 300, q: 4 }); break;
      case 'square': osc({ t, f, dur: dur * 0.7, vol: 0.05, type: 'square', cut: 1400 }); break;
      case 'tuba': osc({ t, f, dur: dur * 0.6, vol: 0.12, type: 'sawtooth', cut: 500, att: 0.02 }); break;
    }
  }
  function drumHit(kind, t, v = 1) {
    switch (kind) {
      case 'k': osc({ t, f: 150, glide: 42, dur: 0.18, vol: 0.5 * v, type: 'sine' }); break;
      case 's': hit({ t, freq: 1800, ft: 'bandpass', vol: 0.18 * v, dur: 0.14, wet: 0.2 }); osc({ t, f: 190, glide: 140, dur: 0.08, vol: 0.08 * v, type: 'triangle' }); break;
      case 'br': hit({ t, freq: 2600, ft: 'bandpass', q: 0.5, vol: 0.06 * v, dur: 0.18 }); break;
      case 'c': hit({ t, freq: 1400, ft: 'bandpass', q: 1.2, vol: 0.16 * v, dur: 0.1, wet: 0.3 }); hit({ t: t + 0.012, freq: 1400, ft: 'bandpass', q: 1.2, vol: 0.12 * v, dur: 0.08 }); break;
      case 'h': hit({ t, freq: 7500, vol: 0.045 * v, dur: 0.035 }); break;
      case 'oh': hit({ t, freq: 7000, vol: 0.04 * v, dur: 0.18 }); break;
      case 'ride': hit({ t, freq: 5200, ft: 'bandpass', q: 2, vol: 0.035 * v, dur: 0.3 }); break;
      case 'sh': hit({ t, freq: 6500, vol: 0.022 * v, dur: 0.05 }); break;
      case 'rim': osc({ t, f: 1700, dur: 0.03, vol: 0.06 * v, type: 'square', cut: 3000 }); break;
      case 't': osc({ t, f: 180, glide: 90, dur: 0.2, vol: 0.2 * v, type: 'sine' }); break;
      case 'roll': hit({ t, freq: 2200, ft: 'bandpass', q: 0.7, vol: 0.09 * v, dur: 0.07 }); break;
      case 'sleigh': for (let i = 0; i < 3; i++) hit({ t: t + i * 0.018, freq: 9000, ft: 'bandpass', q: 3, vol: 0.03 * v, dur: 0.06 }); break;
    }
  }
  // compose a lead line once per song: steps follow the rhythm; notes walk the scale, landing on chord tones on the beat
  function compose(song, id) {
    const rnd = (function (a) { return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })(id.length * 7919 + song.bpm);
    const phrase = () => { const out = []; let d = song.lead.range[0] + 2; for (let i = 0; i < 32; i++) { if (song.lead.rhythm[i] !== '1') { out.push(null); continue; } d += Math.round((rnd() - 0.5) * 4); d = Math.max(song.lead.range[0], Math.min(song.lead.range[1], d)); out.push(d); } return out; };
    const A1 = phrase(), B1 = phrase();
    return [A1, A1, B1, A1]; // AABA over 8 bars, 2 bars per phrase
  }
  function degreeNote(song, deg) { const m = song.mode, o = Math.floor(deg / 7), i = ((deg % 7) + 7) % 7; return song.key + m[i] + o * 12; }
  function chordNotes(song, bar) { const r = song.prog[bar % song.prog.length]; const ns = [r, r + 2, r + 4]; if (song.seven) ns.push(r + 6); return ns.map((d) => degreeNote(song, d)); }
  function playStep(song, step, t) {
    const s16 = step % 16, bar = Math.floor(step / 16) % 8, beat = 60 / song.bpm, sd = beat / 4;
    const chord = chordNotes(song, bar), root = chord[0], hot = M.intensity > 0.5;
    const D = song.drums;
    for (const k in D) if (D[k][s16] === '1') drumHit(k, t, k === 'h' && hot ? 1.3 : 1);
    if (hot && s16 % 4 === 2) drumHit('oh', t, 0.8);
    if (hot && !D.h && s16 % 2 === 1) drumHit('h', t, 0.7);
    const b = song.bass;
    if (b) { const ch = b.pat[s16]; if (ch !== '.') {
      let n = root - 12;
      if (ch === '3') n = chord[1] - 12; else if (ch === '5') n = chord[2] - 12; else if (ch === '8') n = root; else if (ch === '7') n = (chord[3] || chord[2]) - 12;
      else if (ch === 'w') { const nx = chordNotes(song, bar + 1)[0] - 12; n = nx + (nx > root - 12 ? -1 : 1); }
      if (b.kind === 'walk' && ch === '1' && s16 > 0) n = degreeNote(song, song.prog[bar] + Math.floor(s16 / 4)) - 12;
      bassNote(b.kind, n - 12 + 12, t, sd * 3);
    } }
    const c = song.chord;
    if (c) {
      if (c.kind === 'pad' && s16 === 0) for (const n of chord) inst('pad', n, t, beat * 4, 0.05);
      else if (c.pat && c.pat[s16] === '1') for (const n of (c.kind === 'power' ? [root - 12, root - 5, root] : chord)) inst(c.kind, n, t, sd * 3, 0.05);
    }
    const a = song.arp;
    if (a && a.pat[s16] === '1') { const idx = a.seq[(step) % a.seq.length] % chord.length; inst(a.kind, chord[idx] + 12, t, sd * 2, 0.06); }
    const L = song.lead;
    if (L) {
      const phrase = song.melody[Math.floor(bar / 2)], i = (bar % 2) * 16 + s16, d = phrase[i];
      if (d != null) {
        let len = 1; while (i + len < 32 && phrase[i + len] == null && len < 4) len++;
        // snap to a chord tone on strong beats
        let n = degreeNote(song, d);
        if (s16 % 4 === 0) { let best = n, bd = 99; for (const cn of chord) for (const o of [0, 12, 24]) { const cand = cn + o; if (Math.abs(cand - n) < bd) { bd = Math.abs(cand - n); best = cand; } } n = best; }
        inst(L.kind, n, t, sd * len, 0.07);
        if (hot) inst(L.kind, n + 12, t, sd * len, 0.03);
      }
    }
  }
  function schedule() {
    const song = M.song; if (!ac || !song || ac.state !== 'running') return;
    if (M.next < ac.currentTime - 0.25) M.next = ac.currentTime + 0.05;
    const sd = 60 / song.bpm / 4;
    while (M.next < ac.currentTime + 0.3) {
      const sw = (M.step % 2) ? sd * (song.swing || 0) : 0;
      playStep(song, M.step, M.next + sw);
      M.next += sd; M.step = (M.step + 1) % 128;
    }
  }
  // id: 'menu', a theme id (e.g. 'breakfast'), or null for silence
  A.setMusic = function (id) {
    if (!ac) { M.id = id; return; }
    if (id === M.id && M.timer) return;
    M.id = id; clearInterval(M.timer); M.timer = null; M.intensity = 0;
    const song = id && SONGS[id];
    if (!song) { M.song = null; return; }
    if (!song.melody) song.melody = compose(song, id);
    M.song = song; M.step = 0; M.next = ac.currentTime + 0.12;
    mus.gain.cancelScheduledValues(ac.currentTime); mus.gain.setValueAtTime(0.0001, ac.currentTime);
    A.apply();
    M.timer = setInterval(schedule, 60); schedule();
  };
  A.setIntensity = function (v) { M.intensity = v; };
  A.songName = (id) => (SONGS[id] ? SONGS[id].name : '');
  A.vibrate = function (ms) { try { if (A.vib && navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ } };
  A.vib = true;

  CR.Audio = A;
})(window.CR);
