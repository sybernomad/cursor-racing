// Cursor Racing — menus, garage, results, HUD and touch/keyboard/gamepad controls.
(function (CR) {
  'use strict';
  const { U, Save, Audio, Game, R } = CR;
  const $ = (s, r = document) => r.querySelector(s);
  const UI = { screen: null, version: 'dev', install: null, touch: false };
  const POINTS = [10, 6, 3, 1];
  const REWARD = [120, 80, 50, 25];
  const CUP_RIVALS = { rookie: ['Pip', 'Moxie', 'Rusty'], pro: ['Vex', 'Moxie', 'Pip'], mirror: ['Nova', 'Vex', 'Rusty'], champ: ['Nova', 'Glitch', 'Vex'], workshop: ['Rusty', 'Moxie', 'Vex'], tour: ['Glitch', 'Nova', 'Pip'], legend: ['Nova', 'Glitch', 'Vex'] };
  const rival = (n) => CR.RIVALS.find((r) => r.name === n);

  // ---------------------------------------------------------------------------
  function show(name) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === 'scr-' + name));
    UI.screen = name;
  }
  function click(el, fn, snd = 'ui') { el.addEventListener('click', (e) => { Audio.init(); if (snd) Audio.play(snd); fn(e); }); }
  function bind(root) {
    root.querySelectorAll('[data-go]').forEach((b) => click(b, () => go(b.dataset.go), b.dataset.go === 'menu' ? 'back' : 'ui'));
  }
  function go(where) {
    ({ menu: renderMenu, cups: renderCups, garage: renderGarage, settings: renderSettings, title: renderTitle })[where]();
  }
  UI.toast = function (msg, ms = 2200) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(UI.tt); UI.tt = setTimeout(() => t.classList.remove('show'), ms); };
  function modal(html, after) { const m = $('#modal'); m.innerHTML = `<div class="panel">${html}</div>`; m.classList.remove('hidden'); if (after) after(m); bind(m); return m; }
  function closeModal() { $('#modal').classList.add('hidden'); $('#modal').innerHTML = ''; }
  function confirmBox(title, text, yes, fn) {
    modal(`<h2>${title}</h2><p class="muted">${text}</p><div class="actions"><button class="btn ghost" id="m-no">Cancel</button><button class="btn primary" id="m-yes">${yes}</button></div>`, (m) => {
      click($('#m-no', m), closeModal, 'back'); click($('#m-yes', m), () => { closeModal(); fn(); });
    });
  }
  const coinsHTML = () => `<span class="coins"><span class="coin"></span>${Save.data.coins.toLocaleString()}</span>`;
  const topbar = (title, back = 'menu') => `<div class="topbar"><button class="btn small ghost" data-go="${back}">&larr; Back</button><h1>${title}</h1><span class="spacer"></span>${coinsHTML()}</div>`;

  // ---------------------------------------------------------------------------
  // background attract race behind the menus
  UI.attract = function () {
    if (Game.on && Game.mode === 'attract') return;
    const t = Math.floor(Math.random() * CR.TRACKS.length);
    const rv = CR.RIVALS.slice().sort(() => Math.random() - 0.5).slice(0, 7);
    Game.start({ mode: 'attract', track: t, reversed: Math.random() < 0.3, rivals: rv, ai: 1, items: true });
    Audio.setMusic('menu');
  };

  // ---------------------------------------------------------------------------
  function renderTitle() {
    const el = $('#scr-title');
    el.innerHTML = `<div class="logo"><span class="cur"></span>Cursor<br>Racing<small>tiny cars · big tables</small></div>
      <div class="tap">Tap to start</div><div class="ver">v${UI.version}</div><div class="titlefoot">A toy-car racer</div>`;
    show('title'); UI.attract();
    const start = () => { Audio.init(); Audio.play('go'); Audio.setMusic('menu'); renderMenu(); el.removeEventListener('pointerup', start); };
    el.addEventListener('pointerup', start);
  }

  function renderMenu() {
    const d = Save.data, run = d.cupRun;
    const el = $('#scr-menu');
    el.innerHTML = `<div class="wrap">
      <div class="row"><div class="logo menu-logo"><span class="cur"></span>Cursor Racing</div><span class="spacer"></span>${coinsHTML()}</div>
      <div class="menu-grid">
        <button class="btn primary wide" id="m-champ"><span class="ico">🏆</span>Championship<span class="sub">${run ? `Continue ${CR.CUPS.find((c) => c.id === run.cup).name}: race ${run.race + 1} of 3` : 'Win cups to unlock new cars and mirrored tracks'}</span></button>
        <button class="btn" id="m-quick"><span class="ico">🏁</span>Quick Race<span class="sub">1 to 19 rivals, power-ups, any open track</span></button>
        <button class="btn" id="m-tt"><span class="ico">⏱️</span>Time Trial<span class="sub">Race your own ghost</span></button>
        <button class="btn" id="m-ko"><span class="ico">💥</span>Knockout<span class="sub">Fall off screen and you're out</span></button>
        <button class="btn cyan" id="m-garage"><span class="ico">🔧</span>Garage<span class="sub">Cars, paint and upgrades</span></button>
        <button class="btn ghost" id="m-set"><span class="ico">⚙️</span>Settings<span class="sub">Controls, graphics, sound</span></button>
        ${UI.install ? '<button class="btn ghost" id="m-inst"><span class="ico">📲</span>Install<span class="sub">Add to your home screen</span></button>' : ''}
        ${UI.iosHint ? '<button class="btn ghost" id="m-ios"><span class="ico">📲</span>Install<span class="sub">How to add to iPhone / iPad</span></button>' : ''}
      </div>
      <p class="muted small" style="margin-top:16px">Stats: ${d.stats.races} races, ${d.stats.wins} wins, ${d.stats.cups} cups. <span class="spacer"></span><span style="float:right">v${UI.version}</span></p>
    </div>`;
    show('menu'); UI.attract();
    click($('#m-champ'), () => (run ? continueCup() : renderCups()));
    click($('#m-quick'), () => renderTracks('quick'));
    click($('#m-tt'), () => renderTracks('tt'));
    click($('#m-ko'), () => renderTracks('ko'));
    click($('#m-garage'), () => renderGarage());
    click($('#m-set'), () => renderSettings());
    if (UI.install) click($('#m-inst'), async () => { const p = UI.install; UI.install = null; p.prompt(); try { await p.userChoice; } catch (e) { /* */ } renderMenu(); });
    if (UI.iosHint) click($('#m-ios'), () => modal(`<h2>Install on iPhone / iPad</h2><ol class="help"><li>Open this page in <b>Safari</b>.</li><li>Tap the <b>Share</b> button.</li><li>Choose <b>Add to Home Screen</b>.</li></ol><p class="muted small">It then runs full screen and works offline.</p><div class="actions"><button class="btn primary" id="m-ok">Got it</button></div>`, (m) => click($('#m-ok', m), closeModal)));
    if (!Save.data.seenHelp) { Save.data.seenHelp = true; Save.save(); setTimeout(help, 400); }
  }

  function help() {
    modal(`<h2>How to drive</h2><ul class="help">
      <li><b>Touch:</b> put your thumb on the left side and point it where you want to go. The car turns that way and drives.</li>
      <li><b>Boost:</b> drift through corners (brake while turning) to fill the meter, then hold <b>BOOST</b>.</li>
      <li><b>Power-ups:</b> drive through the rainbow boxes, then tap <b>ITEM</b> (E on a keyboard): turbo, oil slick, shield, shockwave or a marble to fire.</li>
      <li><b>Launch:</b> press the gas in the last half-second of the countdown for a perfect start. Too early and you stall.</li>
      <li><b>Slipstream:</b> tuck in behind a car to go faster and charge boost.</li>
      <li><b>Keyboard:</b> arrows or WASD, Space to boost, E to use an item, Esc to pause. Gamepads work too.</li>
      <li>Watch the edges: drive off the table and you drop to the floor.</li>
      <li><b>Knockout:</b> the camera follows the leader. Fall off the screen and you're out of the round.</li></ul>
      <div class="actions"><button class="btn primary" id="m-ok">Let's race</button></div>`, (m) => click($('#m-ok', m), closeModal));
  }

  // ---------------------------------------------------------------------------
  // track thumbnails
  const thumbs = {};
  function thumb(ti, rev) {
    const k = ti + (rev ? 'r' : '');
    if (thumbs[k]) return thumbs[k];
    const w = new CR.World(CR.TRACKS[ti], rev), th = CR.THEMES[w.def.theme];
    const c = document.createElement('canvas'), s = 200 / w.W; c.width = 200; c.height = Math.round(w.H * s);
    const x = c.getContext('2d');
    const tmp = document.createElement('canvas'); tmp.width = Math.ceil(w.W / 12); tmp.height = Math.ceil(w.H / 12);
    th.ground(tmp.getContext('2d'), tmp.width, tmp.height, U.rng(3));
    x.imageSmoothingEnabled = false; x.drawImage(tmp, 0, 0, c.width, c.height);
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, 0, c.width, c.height);
    x.lineJoin = 'round'; x.beginPath();
    for (let i = 0; i <= w.N; i += 2) { const j = i % w.N; i ? x.lineTo(w.px[j] * s, w.py[j] * s) : x.moveTo(w.px[j] * s, w.py[j] * s); }
    x.closePath(); x.strokeStyle = th.track.edgeA; x.lineWidth = w.width * s + 4; x.stroke(); x.strokeStyle = th.track.fill; x.lineWidth = w.width * s; x.stroke();
    const p = w.at(0), a = w.at(40);
    x.fillStyle = '#3ff0ff'; x.beginPath(); x.arc(p.x * s, p.y * s, 4, 0, 6.28); x.fill();
    x.strokeStyle = '#3ff0ff'; x.lineWidth = 2; x.beginPath(); x.moveTo(p.x * s, p.y * s); x.lineTo(a.x * s + (a.x - p.x) * s * 0.8, a.y * s + (a.y - p.y) * s * 0.8); x.stroke();
    return (thumbs[k] = c.toDataURL());
  }

  // ---------------------------------------------------------------------------
  function renderCups() {
    const d = Save.data, el = $('#scr-cups');
    el.innerHTML = `<div class="wrap">${topbar('Championship')}<div class="cards" id="cuplist"></div>
      <p class="muted small" style="margin-top:12px">Three races per cup. Points 10 / 6 / 3 / 1. Finish on the podium to open the next cup. Win it to unlock a new car.</p></div>`;
    const list = $('#cuplist', el);
    CR.CUPS.forEach((cup, i) => {
      const st = d.cups[cup.id] || {}, open = !!st.unlocked;
      const card = document.createElement('div'); card.className = 'card' + (open ? '' : ' locked');
      const tr = cup.races.map(([t, r]) => CR.TRACKS[t].name + (r ? ' (R)' : '')).join(' · ');
      card.innerHTML = `<img class="thumb" src="${thumb(cup.races[0][0], cup.races[0][1])}" alt="">
        <span class="tag">${open ? (st.best ? ['', 'Gold', 'Silver', 'Bronze'][st.best] || '' : 'Open') : 'Locked'}</span>
        <h3><span class="trophy g${st.best && st.best <= 3 ? st.best : 0}"></span>${cup.name}</h3><div class="meta">${tr}</div>
        <div class="meta">Reward ${cup.reward} coins${cup.unlock ? ' + ' + CR.CARS.find((c) => c.id === cup.unlock).name : ''}${i > 0 && !open ? ' · Podium in ' + CR.CUPS[i - 1].name : ''}</div>`;
      if (open) click(card, () => startCup(i));
      list.appendChild(card);
    });
    bind(el); show('cups');
  }
  function startCup(i) {
    const cup = CR.CUPS[i];
    const pts = { You: 0 }; for (const n of CUP_RIVALS[cup.id]) pts[n] = 0;
    Save.data.cupRun = { cup: cup.id, race: 0, pts }; Save.save();
    continueCup();
  }
  function continueCup() {
    const run = Save.data.cupRun, ci = CR.CUPS.findIndex((c) => c.id === run.cup), cup = CR.CUPS[ci];
    const [t, rev] = cup.races[run.race];
    const lvl = Math.min(5, ci + 1);
    const rivals = CUP_RIVALS[cup.id].map((n) => ({ ...rival(n), up: { eng: lvl, grip: lvl - 1, boost: lvl - 1 } }));
    startRace({ mode: 'race', track: t, reversed: rev, laps: 3, ai: cup.ai, rivals, cup: ci });
  }

  // ---------------------------------------------------------------------------
  function renderTracks(mode) {
    const d = Save.data, el = $('#scr-tracks');
    const title = { quick: 'Quick Race', tt: 'Time Trial', ko: 'Knockout' }[mode];
    UI.pick = UI.pick || { t: 0, rev: false };
    el.innerHTML = `<div class="wrap">${topbar(title)}
      ${mode !== 'tt' ? setupPanel(mode) : ''}
      <div class="cards" id="tl"></div></div>`;
    const tl = $('#tl', el);
    for (const rev of [false, true]) CR.TRACKS.forEach((tr, ti) => {
      const open = Save.trackOpen(ti, rev);
      if (rev && !open) return;
      const b = Save.bestOf(ti, rev), th = CR.THEMES[tr.theme];
      const card = document.createElement('div'); card.className = 'card' + (open ? '' : ' locked');
      card.innerHTML = `<img class="thumb" src="${thumb(ti, rev)}" alt=""><span class="tag">${open ? (rev ? 'Mirror' : th.name) : 'Locked'}</span>
        <h3>${tr.name}${rev ? ' R' : ''}</h3><div class="meta">Best lap ${U.fmtTime(b.lap)} · Race ${U.fmtTime(b.race)}</div>`;
      if (open) click(card, () => {
        const ghost = mode === 'tt' ? Save.ghost(ti, rev) : null;
        const S = d.settings, nR = mode === 'ko' ? U.clamp(S.koRivals, 3, 7) : U.clamp(S.rivals, 1, 19);
        const pool = mode === 'tt' ? [] : CR.RIVALS.slice().sort(() => Math.random() - 0.5).slice(0, nR);
        const top = CR.CUPS.reduce((m, c) => (Save.cupUnlocked(c.id) ? c.ai : m), 0.9);
        const lvl = CR.CUPS.filter((c) => Save.cupUnlocked(c.id)).length;
        startRace({ mode: mode === 'quick' ? 'race' : mode, track: ti, reversed: rev, laps: mode === 'quick' ? d.settings.laps : 3, items: mode !== 'tt' && d.settings.items, ai: top, rivals: pool.map((r) => ({ ...r, up: { eng: lvl, grip: lvl - 1, boost: lvl - 1 } })), ghost: ghost && ghost.data, bestLap: b.lap, koTarget: 4, quick: mode });
      });
      else card.title = 'Open its cup in the Championship first';
      tl.appendChild(card);
    });
    bindSetup(el, mode);
    bind(el); show('tracks');
  }

  // race setup: laps, field size, power-ups
  function setupPanel(mode) {
    const S = Save.data.settings, ko = mode === 'ko';
    const n = ko ? U.clamp(S.koRivals, 3, 7) : U.clamp(S.rivals, 1, 19);
    return `<div class="panel setup">
      ${ko ? '' : `<div class="setrow"><span>Laps</span><div class="stepper"><button class="btn small" data-k="laps" data-d="-1">&minus;</button><b id="v-laps">${S.laps}</b><button class="btn small" data-k="laps" data-d="1">+</button></div></div>`}
      <div class="setrow"><span>Rivals</span><input type="range" id="v-riv" min="${ko ? 3 : 1}" max="${ko ? 7 : 19}" value="${n}"><b id="v-rivn">${n}</b></div>
      <div class="setrow"><span>Power-ups</span><button class="tog ${S.items ? 'on' : ''}" id="v-items"></button><span class="muted small">${S.items ? 'Item boxes on the road' : 'Pure racing'}</span></div>
    </div>`;
  }
  function bindSetup(el, mode) {
    const S = Save.data.settings, ko = mode === 'ko';
    el.querySelectorAll('.stepper button').forEach((b) => click(b, () => { S.laps = U.clamp(S.laps + +b.dataset.d, 1, 9); Save.save(); $('#v-laps', el).textContent = S.laps; }));
    const r = $('#v-riv', el);
    if (r) r.addEventListener('input', () => { const v = +r.value; if (ko) S.koRivals = v; else S.rivals = v; $('#v-rivn', el).textContent = v; Save.save(); });
    const it = $('#v-items', el);
    if (it) click(it, () => { S.items = !S.items; Save.save(); renderTracks(mode); });
  }

  // ---------------------------------------------------------------------------
  const carThumbs = {};
  function carThumb(id) { // small picture for the garage strip, redrawn when the paint changes
    const paint = Save.paintOf(id), k = id + paint;
    if (!carThumbs[k]) { const c = CR.CARS.find((x) => x.id === id); carThumbs[k] = CR.voxIcon(CR.carVox(id, paint, c.paints[1]), 2).toDataURL(); }
    return carThumbs[k];
  }
  function renderGarage(sel) {
    const d = Save.data, el = $('#scr-garage');
    const idx = sel != null ? sel : CR.CARS.findIndex((c) => c.id === (UI.gsel || d.car));
    const car = CR.CARS[idx]; UI.gsel = car.id;
    const owned = !!d.owned[car.id], up = Save.ups(car.id), paint = Save.paintOf(car.id);
    const st = (v, add) => `<div class="bar"><b style="width:${Math.min(100, (v + add) * 100)}%"></b><i style="width:${Math.min(100, v * 100)}%"></i></div>`;
    const cupGift = CR.CUPS.find((c) => c.unlock === car.id);
    const ownedN = CR.CARS.filter((c) => d.owned[c.id]).length;
    el.innerHTML = `<div class="wrap">${topbar('Garage')}
      <div class="carstrip" id="g-strip">${CR.CARS.map((c, i) => `<button class="${i === idx ? 'sel' : ''} ${d.owned[c.id] ? '' : 'lock'}" data-i="${i}" title="${c.name}"><img src="${carThumb(c.id)}" alt="${c.name}"></button>`).join('')}</div>
      <p class="muted small" style="margin:0 0 10px">${ownedN} of ${CR.CARS.length} cars owned${d.car === car.id ? '' : ` · driving ${CR.CARS.find((c) => c.id === d.car).name}`}</p>
      <div class="garage">
        <div class="panel showcase"><div class="carnav"><button class="btn small" id="g-prev">&larr;</button><h3>${car.name}</h3><button class="btn small" id="g-next">&rarr;</button></div>
          <canvas id="g-icon"></canvas><p class="muted small" style="text-align:center;margin:6px 0 0">${car.desc}</p>
          <div class="paints" id="g-paint"></div></div>
        <div class="panel">
          <h2>Stats</h2>
          <div class="stat">Speed ${st(car.top, up.eng * 0.03)}</div><div class="stat">Accel ${st(car.accel, up.eng * 0.03)}</div>
          <div class="stat">Grip ${st(car.grip, up.grip * 0.04)}</div><div class="stat">Weight ${st(car.mass, 0)}</div>
          <div id="g-act" style="margin:12px 0"></div>
          ${owned ? `<h2 style="margin-top:6px">Upgrades</h2><div id="g-up"></div>` : ''}
        </div>
      </div></div>`;
    CR.voxIcon(CR.carVox(car.id, paint, car.paints[1]), 9, $('#g-icon', el));
    const pl = $('#g-paint', el);
    for (const p of [car.paints[0], ...CR.PAINTS.filter((q) => q !== car.paints[0])]) {
      const s = document.createElement('div'); s.className = 'sw' + (p === paint ? ' sel' : ''); s.style.background = p;
      click(s, () => { d.paint[car.id] = p; Save.save(); renderGarage(idx); }); pl.appendChild(s);
    }
    const act = $('#g-act', el);
    if (owned) act.innerHTML = d.car === car.id ? '<button class="btn" disabled>Selected</button>' : '<button class="btn primary" id="g-sel">Drive this car</button>';
    else act.innerHTML = `<button class="btn primary" id="g-buy" ${d.coins < car.price ? 'disabled' : ''}>Buy · ${car.price} coins</button>${cupGift ? `<div class="muted small" style="margin-top:6px">Or win the ${cupGift.name} to get it free.</div>` : ''}`;
    if ($('#g-sel', el)) click($('#g-sel', el), () => { d.car = car.id; Save.save(); renderGarage(idx); });
    if ($('#g-buy', el)) click($('#g-buy', el), () => confirmBox('Buy ' + car.name + '?', `${car.price} coins.`, 'Buy', () => { d.coins -= car.price; d.owned[car.id] = true; d.car = car.id; Save.save(); Audio.play('buy'); renderGarage(idx); }), 'ui');
    if (owned) {
      const ul = $('#g-up', el);
      for (const [k, name, txt] of [['eng', 'Engine', 'Top speed and acceleration'], ['grip', 'Tyres', 'Grip and steering'], ['boost', 'Turbo', 'Stronger boost, slower drain, faster charge']]) {
        const cost = Save.upCost(car.id, k), lv = up[k];
        const row = document.createElement('div'); row.className = 'upg';
        row.innerHTML = `<div><b>${name}</b><span class="pips">${[0, 1, 2, 3, 4].map((i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</span><div class="muted small">${txt}</div></div>
          ${cost == null ? '<span class="gold small">MAX</span>' : `<button class="btn small ${d.coins >= cost ? 'primary' : ''}" ${d.coins < cost ? 'disabled' : ''}>${cost} <span class="coin" style="width:10px;height:10px"></span></button>`}`;
        const b = row.querySelector('button');
        if (b) click(b, () => { if (d.coins < cost) return; d.coins -= cost; up[k]++; Save.save(); Audio.play('buy'); renderGarage(idx); }, null);
        ul.appendChild(row);
      }
    }
    el.querySelectorAll('#g-strip button').forEach((b) => click(b, () => renderGarage(+b.dataset.i)));
    const selB = $('#g-strip .sel', el), strip = $('#g-strip', el);
    requestAnimationFrame(() => { if (selB) strip.scrollLeft += selB.getBoundingClientRect().left - strip.getBoundingClientRect().left - strip.clientWidth / 2 + selB.clientWidth / 2; });
    click($('#g-prev', el), () => renderGarage((idx - 1 + CR.CARS.length) % CR.CARS.length));
    click($('#g-next', el), () => renderGarage((idx + 1) % CR.CARS.length));
    bind(el); show('garage');
  }

  // ---------------------------------------------------------------------------
  function renderSettings(from) {
    const s = Save.data.settings, el = $('#scr-settings');
    const seg = (id, opts, val) => `<div class="seg" id="${id}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(val) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    const tog = (id, on) => `<button class="tog ${on ? 'on' : ''}" id="${id}" aria-pressed="${on}"></button>`;
    el.innerHTML = `<div class="wrap">${topbar('Settings', UI.inRace ? 'menu' : 'menu')}
      <div class="panel">
        <div class="set"><div class="lbl"><b>Touch controls</b><span>Stick: point your thumb where to go. Buttons: classic left/right.</span></div>${seg('s-ctl', [['stick', 'Stick'], ['buttons', 'Buttons']], s.controls)}</div>
        <div class="set"><div class="lbl"><b>Auto-accelerate</b><span>Buttons mode: the car drives itself forward</span></div>${tog('s-gas', s.autoGas)}</div>
        <div class="set"><div class="lbl"><b>Difficulty</b><span>How hard the rivals drive. Takes effect next race.</span></div>${seg('s-diff', [[0, 'Easy'], [1, 'Normal'], [2, 'Hard']], s.diff)}</div>
        <div class="set"><div class="lbl"><b>Graphics</b><span>Lower it if the game stutters</span></div>${seg('s-q', [['low', 'Low'], ['medium', 'Med'], ['high', 'High']], s.quality)}</div>
        <div class="set"><div class="lbl"><b>Tilt-shift blur</b><span>The miniature look at the top and bottom</span></div>${tog('s-dof', s.dof)}</div>
        <div class="set"><div class="lbl"><b>Bloom</b><span>Glow on lights and shiny things</span></div>${tog('s-bloom', s.bloom)}</div>
        <div class="set"><div class="lbl"><b>Shadows</b></div>${tog('s-shad', s.shadows)}</div>
        <div class="set"><div class="lbl"><b>Screen shake</b></div>${tog('s-shake', s.shake)}</div>
        <div class="set"><div class="lbl"><b>Vibration</b></div>${tog('s-vib', s.vib)}</div>
        <div class="set"><div class="lbl"><b>Sound effects</b></div><input type="range" id="s-sfx" min="0" max="1" step="0.05" value="${s.sfx}"></div>
        <div class="set"><div class="lbl"><b>Music</b></div><input type="range" id="s-mus" min="0" max="1" step="0.05" value="${s.music}"></div>
      </div>
      <div class="actions"><button class="btn" id="s-help">How to play</button><button class="btn" id="s-upd">Check for updates</button><button class="btn" id="s-cred">Credits</button><button class="btn ghost" id="s-reset">Reset progress</button></div>
      <p class="muted small" style="text-align:center;margin-top:14px">Cursor Racing v${UI.version}</p></div>`;
    const segBind = (id, key, fn) => el.querySelectorAll(`#${id} button`).forEach((b) => click(b, () => { const v = b.dataset.v; s[key] = isNaN(+v) ? v : +v; Save.save(); applySettings(); if (fn) fn(); renderSettings(); }));
    const togBind = (id, key) => click($('#' + id, el), () => { s[key] = !s[key]; Save.save(); applySettings(); renderSettings(); });
    segBind('s-ctl', 'controls'); segBind('s-diff', 'diff'); segBind('s-q', 'quality');
    togBind('s-gas', 'autoGas'); togBind('s-dof', 'dof'); togBind('s-bloom', 'bloom'); togBind('s-shad', 'shadows'); togBind('s-shake', 'shake'); togBind('s-vib', 'vib');
    $('#s-sfx', el).addEventListener('input', (e) => { s.sfx = +e.target.value; applySettings(); Save.save(); });
    $('#s-sfx', el).addEventListener('change', () => Audio.play('coin'));
    $('#s-mus', el).addEventListener('input', (e) => { s.music = +e.target.value; applySettings(); Save.save(); });
    click($('#s-help', el), help);
    click($('#s-upd', el), () => (UI.checkUpdate ? UI.checkUpdate(true) : UI.toast('Updates work once the game is installed or served over https')));
    click($('#s-cred', el), () => modal(`<h2>Credits</h2><p>Cursor Racing is made from scratch: hand-written JavaScript, WebGL and Web Audio. Every car, prop, sprite, sound and song is generated in code. No third-party libraries, fonts, images or audio.</p>
      <p class="muted small">Inspired by classic top-down toy-car racers. Not affiliated with or endorsed by any of them. All trademarks belong to their owners.</p><p class="muted small">MIT licence. See LICENSE and CREDITS.md.</p><div class="actions"><button class="btn primary" id="m-ok">Close</button></div>`, (m) => click($('#m-ok', m), closeModal)));
    click($('#s-reset', el), () => confirmBox('Reset progress?', 'This deletes coins, cars, upgrades, cups, best times and ghosts. It cannot be undone.', 'Reset', () => { Save.reset(); applySettings(); UI.toast('Progress reset'); renderMenu(); }));
    bind(el); show('settings');
  }
  function applySettings() {
    const s = Save.data.settings;
    if (!s.quality) s.quality = (UI.touch || (navigator.hardwareConcurrency || 4) <= 4) ? 'medium' : 'high';
    R.setQuality(s.quality, { dof: s.dof, bloom: s.bloom, shadows: s.shadows });
    Audio.enabled = s.sfx > 0; Audio.vol = s.sfx; Audio.music = s.music > 0; Audio.musicVol = s.music; Audio.vib = s.vib; Audio.apply();
    Game.settings.difficulty = s.diff; Game.settings.shake = s.shake; Game.settings.autoGas = s.autoGas;
  }
  UI.applySettings = applySettings;

  // ---------------------------------------------------------------------------
  // racing
  function startRace(cfg) {
    const d = Save.data;
    UI.last = cfg;
    cfg.player = { car: d.car, paint: Save.paintOf(d.car), up: Save.ups(d.car) };
    cfg.onEnd = (res) => setTimeout(() => endRace(cfg, res), 300);
    Game.start(cfg);
    UI.inRace = true;
    buildHUD(cfg);
    show('hud');
    Audio.init(); Audio.setMusic(CR.TRACKS[cfg.track].theme);
  }

  function endRace(cfg, res) {
    UI.inRace = false; teardownTouch();
    const d = Save.data, me = res.order.find((o) => o.isPlayer);
    let coins = 0, notes = [];
    d.stats.races++;
    if (cfg.mode === 'tt') {
      const nb = Save.setBest(cfg.track, cfg.reversed, res.bestLap, res.total);
      if (res.ghost && nb) { Save.setGhost(cfg.track, cfg.reversed, { data: res.ghost.data, time: res.ghost.time }); }
      if (nb) { coins = 60; notes.push('New best lap!'); }
      coins += 20;
    } else if (cfg.mode === 'ko') {
      if (res.place === 1) { coins = 180; d.stats.koWins++; d.stats.wins++; } else coins = 30 + me.points * 20;
    } else {
      const m = cfg.cup != null ? 1 + cfg.cup * 0.25 : 0.6, N = res.order.length;
      coins = N === 4 ? Math.round(REWARD[res.place - 1] * m) : Math.round((N - res.place + 1) / N * (60 + N * 9) * Math.max(m, 0.8) + 10);
      if (res.place === 1) d.stats.wins++; if (res.place <= 3) d.stats.podiums++;
      if (Save.setBest(cfg.track, cfg.reversed, res.bestLap, res.total)) notes.push('New best lap!');
    }
    Save.addCoins(coins);
    if (cfg.cup != null) {
      const run = d.cupRun;
      res.order.forEach((o, i) => { run.pts[o.isPlayer ? 'You' : o.name] = (run.pts[o.isPlayer ? 'You' : o.name] || 0) + POINTS[i]; });
      run.race++; Save.save();
    }
    Audio.setMusic('menu');
    renderResults(cfg, res, coins, notes);
  }

  function renderResults(cfg, res, coins, notes) {
    const el = $('#scr-results'), me = res.order.find((o) => o.isPlayer);
    const ko = cfg.mode === 'ko', tt = cfg.mode === 'tt';
    const head = tt ? `<div class="bigplace">${U.fmtTime(res.bestLap)}</div><div class="reward">Best lap · total ${U.fmtTime(res.total)}</div>`
      : `<div class="bigplace">${U.ordinal(res.place)}</div><div class="reward">${ko ? (res.place === 1 ? 'Knockout champion!' : `You scored ${me.points}`) : (res.place === 1 ? 'Winner!' : res.place <= 3 ? 'Podium!' : 'Keep at it')}</div>`;
    const rows = res.order.map((o, i) => `<tr class="${o.isPlayer ? 'me' : ''}"><td>${i + 1}</td><td><span class="chip" style="background:${o.paint}"></span>${o.name}</td><td class="muted small">${o.car}</td>
      <td class="num">${ko ? o.points + ' pts' : (o.est ? '~' : '') + U.fmtTime(o.time)}</td>${cfg.cup != null ? `<td class="num gold">+${POINTS[i]}</td>` : ''}</tr>`).join('');
    const laps = tt && Game.player ? Game.player.lapTimes.map((t, i) => `Lap ${i + 1}: ${U.fmtTime(t)}`).join(' · ') : '';
    const cupNext = cfg.cup != null;
    el.innerHTML = `<div class="wrap" style="max-width:620px"><div class="panel">${head}
      ${tt ? `<p class="muted small" style="text-align:center">${laps}</p>` : `<table class="table"><tr><th>#</th><th>Driver</th><th>Car</th><th class="num">${ko ? 'Score' : 'Time'}</th>${cupNext ? '<th class="num">Pts</th>' : ''}</tr>${rows}</table>`}
      <p class="reward">${notes.join(' ')} +${coins} <span class="coin"></span></p>
      <div class="actions">${cupNext ? '<button class="btn primary" id="r-next">Standings</button>' : `<button class="btn primary" id="r-again">${tt ? 'Try again' : 'Race again'}</button><button class="btn" id="r-tracks">Tracks</button>`}<button class="btn ghost" id="r-menu">Menu</button></div>
    </div></div>`;
    show('results');
    if (cupNext) click($('#r-next', el), renderStandings);
    else { click($('#r-again', el), () => { const c = { ...UI.last }; if (c.mode === 'tt') { const g = Save.ghost(c.track, c.reversed); c.ghost = g && g.data; c.bestLap = Save.bestOf(c.track, c.reversed).lap; } startRace(c); }); click($('#r-tracks', el), () => renderTracks(cfg.quick || 'quick')); }
    click($('#r-menu', el), () => { if (cupNext) renderStandings(); else { Game.stop(); renderMenu(); } }, 'back');
    if (res.place === 1 && !tt) { Audio.play('win'); } else if (!tt && res.place === 4) Audio.play('lose');
  }

  function renderStandings() {
    const d = Save.data, run = d.cupRun, el = $('#scr-standings');
    if (!run) return renderMenu();
    const ci = CR.CUPS.findIndex((c) => c.id === run.cup), cup = CR.CUPS[ci];
    const list = Object.entries(run.pts).sort((a, b) => b[1] - a[1]);
    const done = run.race >= cup.races.length;
    const myPlace = list.findIndex(([n]) => n === 'You') + 1;
    let extra = '';
    if (done) {
      const st = d.cups[cup.id] || (d.cups[cup.id] = { unlocked: true, best: 0 });
      const prevBest = st.best;
      if (myPlace <= 3 && (!st.best || myPlace < st.best)) st.best = myPlace;
      let coins = 0, gifts = [];
      if (myPlace <= 3) {
        coins = Math.round(cup.reward * [1, 0.6, 0.4][myPlace - 1]); d.stats.cups += myPlace === 1 ? 1 : 0;
        const next = CR.CUPS[ci + 1];
        if (next && !Save.cupUnlocked(next.id)) { d.cups[next.id] = { unlocked: true, best: 0 }; gifts.push(`${next.name} unlocked`); if (next.id === 'mirror') gifts.push('Mirror tracks open in Quick Race'); }
        if (myPlace === 1 && cup.unlock && !d.owned[cup.unlock]) { d.owned[cup.unlock] = true; gifts.push(`New car: ${CR.CARS.find((c) => c.id === cup.unlock).name}`); }
      }
      Save.addCoins(coins); d.cupRun = null; Save.save();
      extra = `<div class="reward">${myPlace <= 3 ? `<span class="trophy g${myPlace}"></span>${['Gold', 'Silver', 'Bronze'][myPlace - 1]} trophy! +${coins} <span class="coin"></span>` : 'Off the podium. Try the cup again.'}</div>${gifts.map((g) => `<div class="reward" style="color:var(--cyan)">${g}</div>`).join('')}`;
      if (myPlace === 1) Audio.play('win');
    }
    el.innerHTML = `<div class="wrap" style="max-width:560px"><div class="panel"><h2>${cup.name} · ${done ? 'Final standings' : `after race ${run.race} of 3`}</h2>
      ${done ? `<div class="bigplace">${U.ordinal(myPlace)}</div>` : ''}${extra}
      <table class="table"><tr><th>#</th><th>Driver</th><th class="num">Points</th></tr>${list.map(([n, p], i) => `<tr class="${n === 'You' ? 'me' : ''}"><td>${i + 1}</td><td>${n}</td><td class="num">${p}</td></tr>`).join('')}</table>
      <div class="actions">${done ? '<button class="btn primary" id="st-cups">Cups</button>' : `<button class="btn primary" id="st-next">Next: ${CR.TRACKS[cup.races[run.race][0]].name}${cup.races[run.race][1] ? ' R' : ''}</button>`}<button class="btn ghost" id="st-menu">Menu</button></div></div></div>`;
    show('standings');
    if (done) click($('#st-cups', el), () => { Game.stop(); renderCups(); }); else click($('#st-next', el), continueCup);
    click($('#st-menu', el), () => { Game.stop(); renderMenu(); }, 'back');
  }

  // ---------------------------------------------------------------------------
  // HUD
  const H = {};
  function buildHUD(cfg) {
    const el = $('#scr-hud'), s = Save.data.settings;
    const ko = cfg.mode === 'ko';
    el.innerHTML = `<div class="touch" id="touch"></div>
      <div class="hud-top">
        <div class="hud-box">${ko ? '<div class="ko-pips" id="h-ko"></div>' : `<div class="hud-pos" id="h-pos">1<sup>st</sup><small>/4</small></div><div class="hud-lap" id="h-lap">LAP 1/3</div>`}<div class="hud-time" id="h-time">0:00.00</div>
          <div class="boostbar" id="h-bb"><i id="h-boost"></i></div></div>
        ${cfg.items ? '<div class="hud-item" id="h-item" role="button" aria-label="Use item"></div>' : ''}
        <span class="spacer"></span><canvas class="minimap" id="h-map"></canvas><div class="hud-pause" id="h-pause" role="button" aria-label="Pause"></div>
      </div>
      <div class="hud-board" id="h-board"></div>
      <div class="hud-song" id="h-song">&#9834; ${Audio.songName(CR.TRACKS[cfg.track].theme)}</div>
      <div class="hud-msg" id="h-msg"></div>`;
    H.item = $('#h-item', el); H.board = $('#h-board', el);
    if (H.item) H.item.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (Game.player) CR.Extras.use(Game.player); });
    H.pos = $('#h-pos', el); H.lap = $('#h-lap', el); H.time = $('#h-time', el); H.boost = $('#h-boost', el); H.bb = $('#h-bb', el); H.msg = $('#h-msg', el); H.ko = $('#h-ko', el);
    H.map = $('#h-map', el); const mm = Game.world.minimap; H.map.width = mm.canvas.width; H.map.height = mm.canvas.height; H.mctx = H.map.getContext('2d');
    H.cache = {};
    $('#h-pause', el).addEventListener('pointerdown', (e) => { e.stopPropagation(); pause(); });
    Game.onMsg = (text, dur, kind) => {
      const d = document.createElement('div'); d.className = kind || ''; d.textContent = text;
      H.msg.innerHTML = ''; H.msg.appendChild(d); clearTimeout(H.mt); H.mt = setTimeout(() => { if (d.parentNode) d.remove(); }, dur * 1000);
    };
    setupTouch($('#touch', el), s);
  }
  UI.hudFrame = function () {
    if (!UI.inRace || !Game.player) return;
    const p = Game.player, c = H.cache;
    if (H.pos) {
      const order = Game.standings(), place = order.indexOf(p) + 1;
      if (c.place !== place) { c.place = place; H.pos.innerHTML = `${place}<sup>${U.ordinal(place).slice(-2)}</sup><small>/${Game.cars.length}</small>`; }
      const lap = Math.min(Game.laps, Math.max(1, p.lap + 1));
      if (c.lap !== lap) { c.lap = lap; H.lap.textContent = `LAP ${lap}/${Game.laps}`; }
    }
    if (H.ko) {
      const k = Game.cars.map((x) => `<div style="color:${x.paint}">${x.isPlayer ? 'YOU' : x.name}${'<i></i>'.repeat(0)}${Array.from({ length: Game.ko.target }, (_, i) => `<i class="${i < x.points ? 'on' : ''}"></i>`).join('')}</div>`).join('');
      if (c.ko !== k) { c.ko = k; H.ko.innerHTML = k; }
    }
    const t = U.fmtTime(Game.state === 'count' ? 0 : (p.finished ? p.finishTime : Game.raceT));
    if (c.t !== t) { c.t = t; H.time.textContent = t; }
    const b = Math.round(p.boost * 100);
    if (c.b !== b) { c.b = b; H.boost.style.width = b + '%'; H.bb.classList.toggle('full', b >= 99); if (H.boostBtn) H.boostBtn.style.setProperty('--p', b + '%'); }
    // power-up slot
    if (H.item) { const it = p.item || ''; if (c.item !== it) { c.item = it; H.item.innerHTML = it ? CR.Extras.ITEMS[it].icon : ''; H.item.classList.toggle('full', !!it); if (H.itemBtn) { H.itemBtn.innerHTML = it ? CR.Extras.ITEMS[it].icon : 'ITEM'; H.itemBtn.classList.toggle('full', !!it); } } }
    // running order: the top few and you, a few times a second
    if (H.board && !Game.ko && (!c.boardT || Game.time - c.boardT > 0.25)) {
      c.boardT = Game.time;
      const order = Game.standings(), me = order.indexOf(p), show = Game.cars.length > 4 ? 5 : 0;
      let html = '';
      if (show) {
        const rows = new Set([0, 1, 2, 3, 4].filter((i) => i < order.length)); rows.add(me);
        if (me > 4) { rows.delete(4); rows.add(me - 1); }
        [...rows].sort((a, b) => a - b).forEach((i, k, arr) => { if (k && i - arr[k - 1] > 1) html += '<div class="gap">&middot;&middot;&middot;</div>'; const o = order[i]; html += `<div class="${o === p ? 'me' : ''}"><b>${i + 1}</b><i style="background:${o.paint}"></i>${o.isPlayer ? 'You' : o.name}</div>`; });
      }
      if (html !== c.board) { c.board = html; H.board.innerHTML = html; }
    }
    // minimap
    const mm = Game.world.minimap, x = H.mctx, s = mm.scale;
    x.clearRect(0, 0, H.map.width, H.map.height); x.drawImage(mm.canvas, 0, 0);
    for (const car of Game.cars) {
      if (Game.ko && car.out) continue;
      x.fillStyle = car.paint; x.strokeStyle = car.isPlayer ? '#3ff0ff' : '#000'; x.lineWidth = car.isPlayer ? 2 : 1;
      x.beginPath(); x.arc(car.x * s, car.y * s, car.isPlayer ? 4.5 : 3.5, 0, 6.28); x.fill(); x.stroke();
    }
  };

  // ---------------------------------------------------------------------------
  // input: keyboard + touch + gamepad -> Game.input
  const keys = new Set();
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    keys.add(e.key.toLowerCase());
    if ((e.key === 'Escape' || e.key === 'p') && UI.inRace) { if (Game.paused) resume(); else pause(); }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());
  const T = { stick: { on: false, x: 0, y: 0, mag: 0, id: null }, left: false, right: false, gas: false, brake: false, boost: false };

  function setupTouch(layer, s) {
    UI.touch = UI.touch || matchMedia('(pointer: coarse)').matches;
    T.stick.on = false; T.left = T.right = T.gas = T.brake = T.boost = false;
    if (!UI.touch) { layer.style.pointerEvents = 'none'; return; }
    const mk = (cls, label) => { const b = document.createElement('div'); b.className = 'tbtn ' + cls; b.innerHTML = label; layer.appendChild(b); return b; };
    const hold = (b, key) => {
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); b.setPointerCapture(e.pointerId); T[key] = true; b.classList.add('on'); Audio.init(); });
      const up = (e) => { T[key] = false; b.classList.remove('on'); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
    };
    const boost = mk('boost', '<span class="ring"></span>BOOST'); hold(boost, 'boost'); H.boostBtn = boost;
    hold(mk('brake', 'BRAKE'), 'brake');
    H.itemBtn = null;
    if (Game.items) { const ib = mk('itembtn', 'ITEM'); H.itemBtn = ib; ib.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (Game.player) CR.Extras.use(Game.player); }); }
    if (s.controls === 'buttons') {
      hold(mk('left', '&#9664;'), 'left'); hold(mk('right', '&#9654;'), 'right');
      if (!s.autoGas) hold(mk('gas', 'GAS'), 'gas');
    } else {
      const base = document.createElement('div'); base.className = 'stick-base'; base.innerHTML = '<div class="stick-knob"></div>'; layer.appendChild(base);
      const hint = document.createElement('div'); hint.className = 'stick-hint'; hint.textContent = 'Touch & point to drive'; layer.appendChild(hint);
      const knob = base.firstChild; let ox = 0, oy = 0;
      layer.addEventListener('pointerdown', (e) => {
        if (e.target !== layer || T.stick.id != null || e.clientX > window.innerWidth * 0.62) return;
        e.preventDefault(); Audio.init(); layer.setPointerCapture(e.pointerId);
        T.stick.id = e.pointerId; ox = e.clientX; oy = e.clientY; base.style.left = ox + 'px'; base.style.top = oy + 'px'; base.style.display = 'block'; knob.style.transform = ''; hint.style.display = 'none';
      });
      layer.addEventListener('pointermove', (e) => {
        if (e.pointerId !== T.stick.id) return;
        let dx = e.clientX - ox, dy = e.clientY - oy; const l = Math.hypot(dx, dy), max = 56;
        if (l > max) { // let the base trail the thumb so it never runs out of room
          ox += dx * (1 - max / l) * 0.5; oy += dy * (1 - max / l) * 0.5; base.style.left = ox + 'px'; base.style.top = oy + 'px';
          dx = e.clientX - ox; dy = e.clientY - oy;
        }
        const ll = Math.min(max, Math.hypot(dx, dy)), a = Math.atan2(dy, dx);
        knob.style.transform = `translate(${Math.cos(a) * ll}px, ${Math.sin(a) * ll}px)`;
        T.stick.mag = ll / max; T.stick.on = ll > 8; T.stick.x = Math.cos(a); T.stick.y = Math.sin(a);
      });
      const end = (e) => { if (e.pointerId !== T.stick.id) return; T.stick.id = null; T.stick.on = false; T.stick.mag = 0; base.style.display = 'none'; };
      layer.addEventListener('pointerup', end); layer.addEventListener('pointercancel', end);
    }
  }
  function teardownTouch() { T.stick.on = false; T.stick.id = null; T.boost = T.brake = T.left = T.right = T.gas = false; H.boostBtn = null; }

  UI.pollInput = function () {
    const I = Game.input, s = Save.data.settings;
    const k = (...a) => a.some((x) => keys.has(x));
    let steer = 0, thr = 0, brk = 0, boost = false;
    if (k('arrowleft', 'a')) steer -= 1; if (k('arrowright', 'd')) steer += 1;
    if (k('arrowup', 'w')) thr = 1; if (k('arrowdown', 's')) brk = 1;
    if (k(' ', 'shift', 'x')) boost = true;
    let item = k('e', 'q', 'enter', 'control');
    if (T.left) steer -= 1; if (T.right) steer += 1;
    if (T.gas) thr = 1; if (T.brake) brk = 1; if (T.boost) boost = true;
    if (UI.touch && s.controls === 'buttons' && s.autoGas && !T.brake) thr = Math.max(thr, 1);
    // gamepad
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp) continue;
      const ax = gp.axes[0] || 0;
      if (Math.abs(ax) > 0.15) steer += ax;
      if (gp.buttons[0] && gp.buttons[0].pressed) thr = 1; if (gp.buttons[7]) thr = Math.max(thr, gp.buttons[7].value);
      if (gp.buttons[1] && gp.buttons[1].pressed) brk = 1; if (gp.buttons[6]) brk = Math.max(brk, gp.buttons[6].value > 0.2 ? gp.buttons[6].value : 0);
      if ((gp.buttons[2] && gp.buttons[2].pressed) || (gp.buttons[5] && gp.buttons[5].pressed)) boost = true;
      if ((gp.buttons[3] && gp.buttons[3].pressed) || (gp.buttons[4] && gp.buttons[4].pressed)) item = true;
      if (gp.buttons[9] && gp.buttons[9].pressed && !UI.padStart && UI.inRace) { UI.padStart = true; Game.paused ? resume() : pause(); }
      if (gp.buttons[9] && !gp.buttons[9].pressed) UI.padStart = false;
    }
    I.steer = U.clamp(steer, -1, 1); I.throttle = thr; I.brake = brk; I.boost = boost; I.item = item;
    I.stick = T.stick.on ? T.stick : null;
  };

  // ---------------------------------------------------------------------------
  function pause() {
    if (!UI.inRace || Game.paused || !Game.on) return;
    Game.paused = true; Audio.engine(0, 0, false, false); Audio.skid(0);
    modal(`<h2>Paused</h2><div class="actions" style="flex-direction:column"><button class="btn primary" id="p-res">Resume</button><button class="btn" id="p-rst">Restart</button><button class="btn" id="p-help">How to drive</button><button class="btn ghost" id="p-quit">Quit to menu</button></div>`, (m) => {
      click($('#p-res', m), resume); click($('#p-rst', m), () => { closeModal(); Game.paused = false; startRace({ ...UI.last }); });
      click($('#p-help', m), help);
      click($('#p-quit', m), () => { closeModal(); UI.inRace = false; Game.stop(); if (UI.last.cup != null) { /* leave the cup run saved */ } Audio.setMusic('menu'); renderMenu(); }, 'back');
    });
  }
  function resume() { closeModal(); Game.paused = false; }
  UI.pause = pause;

  UI.renderTitle = renderTitle; UI.renderMenu = renderMenu; UI.show = show; UI.startRace = startRace; UI.renderGarage = renderGarage; UI.renderTracks = renderTracks; UI.renderCups = renderCups; UI.renderSettings = renderSettings;
  UI.isSafe = () => !UI.inRace && ['title', 'menu', 'results', 'standings', 'cups', 'tracks', 'garage', 'settings'].includes(UI.screen);
  CR.UI = UI;
})(window.CR);
