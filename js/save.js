// Cursor Racing — save data, economy and championship state (localStorage).
(function (CR) {
  'use strict';
  const KEY = 'cursor-racing-save';
  const S = { data: null };
  const fresh = () => ({
    v: 1, coins: 150, car: 'zip', paint: {}, owned: { zip: true }, up: {},
    cups: { rookie: { unlocked: true, best: 0 } }, best: {}, cupRun: null,
    settings: { controls: 'fixed', ctl2: true, orient: 'landscape', orient2: true, autoGas: true, diff: 0, quality: 'medium', dof: true, bloom: true, shadows: true, shake: true, vib: true, sfx: 0.8, music: 0.5, laps: 3, rivals: 5, koRivals: 3, items: true, cupRivals: 3, cupLaps: 3, cupItems: false, hazards: true, cupHazards: true, derbyRivals: 7 },
    stats: { races: 0, wins: 0, podiums: 0, cups: 0, koWins: 0, coinsEarned: 0, derbies: 0, derbyWins: 0, wrecks: 0 },
    seenHelp: false, tutorialDone: false,
    derby: {}, derbyArena: 0, derbyHelp: false, // Demolition Derby: per-arena { wins, wrecks }, last arena, rules seen
  });
  S.load = function () {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) { d = null; }
    const f = fresh();
    if (!d || typeof d !== 'object') d = f;
    for (const k of Object.keys(f)) if (d[k] === undefined) d[k] = f[k];
    const oldCtl2 = !!(d.settings && d.settings.ctl2) || d === f, oldOr2 = !!(d.settings && d.settings.orient2) || d === f;
    d.settings = Object.assign(f.settings, d.settings || {}); d.stats = Object.assign(f.stats, d.stats || {});
    // cups open in order: if a later cup is open (e.g. after new cups were added), open the ones before it
    let last = -1; CR.CUPS.forEach((c, i) => { if (d.cups[c.id] && d.cups[c.id].unlocked) last = i; });
    for (let i = 0; i <= last; i++) if (!d.cups[CR.CUPS[i].id]) d.cups[CR.CUPS[i].id] = { unlocked: true, best: 0 };
    // 1.8: the fixed stick became the default touch control; players on the old default move to it once
    if (!oldCtl2) { if (d.settings.controls === 'stick') d.settings.controls = 'fixed'; d.settings.ctl2 = true; }
    // 1.9: sideways became the default way to play
    if (!oldOr2) { d.settings.orient = 'landscape'; d.settings.orient2 = true; }
    // 1.9.6: Time Trial keeps its own best lap (it used to share one with races), and race bests are kept
    // per lap count. The ghost's time is the old Time Trial best; old race bests had no lap count, so they go.
    for (const [k, b] of Object.entries(d.best || {})) {
      if (!b || typeof b !== 'object' || b.v2) continue;
      if (b.tt == null) { try { const g = JSON.parse(localStorage.getItem('cr-ghost-' + k)); if (g && typeof g.time === 'number') b.tt = g.time; } catch (e) { /* no ghost */ } }
      delete b.race; b.v2 = true;
    }
    // 1.11: the derby field is picked by total cars (4, 8, 12, 20 or 30); older saves move to the nearest size
    { const opts = [3, 7, 11, 19, 29], r = d.settings.derbyRivals; if (!opts.includes(r)) d.settings.derbyRivals = opts.reduce((a, b) => (Math.abs(b - r) <= Math.abs(a - r) ? b : a)); }
    S.data = d; return d;
  };
  S.save = function () { try { localStorage.setItem(KEY, JSON.stringify(S.data)); } catch (e) { /* storage full or blocked */ } };
  S.reset = function () { try { localStorage.removeItem(KEY); for (const k of Object.keys(localStorage)) if (k.startsWith('cr-ghost-')) localStorage.removeItem(k); } catch (e) { /* ignore */ } S.load(); S.save(); };

  // Backup code: the whole save as text, so it can be copied to another device or kept safe. Ghosts are not included.
  S.exportCode = () => 'CR1.' + btoa(unescape(encodeURIComponent(JSON.stringify(S.data))));
  S.importCode = (code) => {
    try {
      const m = String(code).trim().match(/^CR1\.([A-Za-z0-9+/=\s]+)$/); if (!m) return false;
      const d = JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/\s+/g, '')))));
      if (!d || typeof d !== 'object' || typeof d.coins !== 'number' || !d.owned || !d.settings) return false;
      if (!CR.CARS.some((c) => c.id === d.car)) d.car = 'zip';
      d.owned.zip = true;
      localStorage.setItem(KEY, JSON.stringify(d)); S.load(); return true;
    } catch (e) { return false; }
  };
  S.ups = (car) => S.data.up[car] || (S.data.up[car] = { eng: 0, grip: 0, boost: 0 });
  S.paintOf = (car) => S.data.paint[car] || CR.CARS.find((c) => c.id === car).paints[0];
  S.upCost = (car, kind) => { const lv = S.ups(car)[kind]; if (lv >= 5) return null; const pr = CR.CARS.find((c) => c.id === car).price; return Math.round(120 * (lv + 1) * (1 + pr / 1600) / 10) * 10; };
  S.addCoins = (n) => { S.data.coins += n; S.data.stats.coinsEarned += Math.max(0, n); S.save(); };
  S.trackKey = (ti, rev) => `${CR.TRACKS[ti].id}${rev ? '-r' : ''}`;
  // Per track: lap = fastest lap in any mode, tt = fastest Time Trial lap (the one the ghost replays),
  // races = fastest finish for each lap count ({ 3: 95.2, 5: 160.1 }).
  S.bestOf = (ti, rev) => S.data.best[S.trackKey(ti, rev)] || {};
  S.raceBest = (ti, rev, laps) => { const r = S.bestOf(ti, rev).races; return r ? r[laps] : undefined; };
  S.setBest = (ti, rev, lap, race, laps) => {
    const k = S.trackKey(ti, rev), b = S.data.best[k] || (S.data.best[k] = { v2: true });
    let nb = false;
    if (lap != null && (b.lap == null || lap < b.lap)) { b.lap = lap; nb = true; }
    if (race != null && laps) { const r = b.races || (b.races = {}); if (r[laps] == null || race < r[laps]) r[laps] = race; }
    S.save(); return nb;
  };
  // Time Trial only: true when this beats the Time Trial best (and so becomes the ghost)
  S.setTT = (ti, rev, lap) => {
    const k = S.trackKey(ti, rev), b = S.data.best[k] || (S.data.best[k] = { v2: true });
    if (lap == null || (b.tt != null && lap >= b.tt)) return false;
    b.tt = lap; S.save(); return true;
  };
  S.ghost = (ti, rev) => { try { return JSON.parse(localStorage.getItem('cr-ghost-' + S.trackKey(ti, rev))); } catch (e) { return null; } };
  S.setGhost = (ti, rev, g) => { try { localStorage.setItem('cr-ghost-' + S.trackKey(ti, rev), JSON.stringify(g)); } catch (e) { /* ignore */ } };
  S.cupUnlocked = (id) => !!(S.data.cups[id] && S.data.cups[id].unlocked);
  // tracks you can pick in Quick Race / Time Trial / Knockout: those in unlocked cups
  // a track is open once a cup that uses it is open; mirrored versions open with the Mirror Cup
  S.trackOpen = (ti, rev) => {
    if (CR.CUPS.some((c) => S.cupUnlocked(c.id) && c.races.some(([t, r]) => t === ti && r === rev))) return true;
    return rev && S.cupUnlocked('mirror') && S.trackOpen(ti, false);
  };

  CR.Save = S;
})(window.CR);
