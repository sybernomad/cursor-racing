// Cursor Racing — save data, economy and championship state (localStorage).
(function (CR) {
  'use strict';
  const KEY = 'cursor-racing-save';
  const S = { data: null };
  const fresh = () => ({
    v: 1, coins: 150, car: 'zip', paint: {}, owned: { zip: true }, up: {},
    cups: { rookie: { unlocked: true, best: 0 } }, best: {}, cupRun: null,
    settings: { controls: 'stick', autoGas: true, diff: 1, quality: null, dof: true, bloom: true, shadows: true, shake: true, vib: true, sfx: 0.8, music: 0.5, laps: 3, rivals: 5, koRivals: 3, items: true, cupRivals: 3, cupLaps: 3, cupItems: false, hazards: true, cupHazards: true },
    stats: { races: 0, wins: 0, podiums: 0, cups: 0, koWins: 0, coinsEarned: 0 },
    seenHelp: false, tutorialDone: false,
  });
  S.load = function () {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) { d = null; }
    const f = fresh();
    if (!d || typeof d !== 'object') d = f;
    for (const k of Object.keys(f)) if (d[k] === undefined) d[k] = f[k];
    d.settings = Object.assign(f.settings, d.settings || {}); d.stats = Object.assign(f.stats, d.stats || {});
    // cups open in order: if a later cup is open (e.g. after new cups were added), open the ones before it
    let last = -1; CR.CUPS.forEach((c, i) => { if (d.cups[c.id] && d.cups[c.id].unlocked) last = i; });
    for (let i = 0; i <= last; i++) if (!d.cups[CR.CUPS[i].id]) d.cups[CR.CUPS[i].id] = { unlocked: true, best: 0 };
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
  S.bestOf = (ti, rev) => S.data.best[S.trackKey(ti, rev)] || {};
  S.setBest = (ti, rev, lap, race) => {
    const k = S.trackKey(ti, rev), b = S.data.best[k] || (S.data.best[k] = {});
    let nb = false;
    if (lap != null && (b.lap == null || lap < b.lap)) { b.lap = lap; nb = true; }
    if (race != null && (b.race == null || race < b.race)) b.race = race;
    S.save(); return nb;
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
