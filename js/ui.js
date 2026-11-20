// Cursor Racing — menus, garage, results, HUD and touch/keyboard/gamepad controls.
(function (CR) {
  'use strict';
  const { U, Save, Audio, Game, R } = CR;
  const $ = (s, r = document) => r.querySelector(s);
  const UI = { screen: null, version: 'dev', install: null, touch: false };
  const POINTS = [10, 6, 3, 1];
  const POINTS_BIG = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]; // fields of more than four
  const pointsFor = (n, i) => (n <= 4 ? POINTS[i] : POINTS_BIG[i]) || 0;
  const REWARD = [120, 80, 50, 25];
  const PAY = 3;          // every race and cup payout is multiplied by this. Raise it to make coins come faster.
  const CUP_RETRIES = 3;  // restarts allowed per cup
  const retriesLeft = (run) => (run.retries == null ? CUP_RETRIES : run.retries);
  // Rivals sometimes turn up in a different car, so the whole collection shows up on track. maxTop caps how fast a car they may pick.
  function recast(r, maxTop = 9, chance = 0.6) {
    if (Math.random() > chance) return r;
    const pool = CR.CARS.filter((c) => c.top <= maxTop), c = pool[Math.floor(Math.random() * pool.length)];
    return c ? { ...r, car: c.id, paint: c.paints[0], acc: c.paints[1] } : r;
  }
  const CUP_RIVALS = { paper: ['Pip', 'Tinker', 'Lola'], chores: ['Tinker', 'Bonnie', 'Sprocket'], deep: ['Glitch', 'Kiwi', 'Ace'], twist: ['Blaze', 'Lola', 'Ace'], rookie: ['Pip', 'Moxie', 'Rusty'], pro: ['Vex', 'Moxie', 'Pip'], mirror: ['Nova', 'Vex', 'Rusty'], champ: ['Nova', 'Glitch', 'Vex'], workshop: ['Rusty', 'Moxie', 'Vex'], tour: ['Glitch', 'Nova', 'Pip'], legend: ['Nova', 'Glitch', 'Vex'] };
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
    ({ menu: renderMenu, cups: renderCups, shop: () => renderShop(), garage: () => renderGarage(), settings: renderSettings, title: renderTitle })[where]();
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
    const rv = CR.RIVALS.slice().sort(() => Math.random() - 0.5).slice(0, 7).map((r) => recast(r));
    Game.start({ mode: 'attract', track: t, reversed: Math.random() < 0.3, rivals: rv, ai: 1, items: true });
    Audio.setMusic('menu');
  };

  // ---------------------------------------------------------------------------
  function renderTitle() {
    const el = $('#scr-title');
    el.innerHTML = `<div class="logo"><span class="cur"></span>Cursor<br>Racing<small>tiny cars · big tables</small></div>
      <div class="tap">Tap to start</div><div class="ver">v${UI.version}</div><div class="titlefoot">A toy-car racer</div>`;
    show('title'); UI.attract();
    const start = () => { Audio.init(); Audio.play('go'); Audio.setMusic('menu'); renderMenu(); el.removeEventListener('click', start); };
    el.addEventListener('click', start); // click, not pointerup: the same tap must not also land on the menu that replaces this screen
  }

  function renderMenu() {
    const d = Save.data, run = d.cupRun;
    const el = $('#scr-menu');
    const won = CR.CUPS.filter((c) => d.cups[c.id] && d.cups[c.id].best).length;
    el.innerHTML = menuHTML(d, run, won);
    show('menu'); UI.attract();
    click($('#m-champ'), () => (run ? renderCupRun() : renderCups()));
    click($('#m-quick'), () => renderTracks('quick'));
    click($('#m-tt'), () => renderTracks('tt'));
    click($('#m-ko'), () => renderTracks('ko'));
    click($('#m-garage'), () => renderGarage());
    click($('#m-car'), () => renderGarage(CR.CARS.findIndex((c) => c.id === Save.data.car)));
    click($('#m-shop'), () => renderShop());
    click($('#m-set'), () => renderSettings());
    click($('#m-tutb'), startTutorial);
    click($('#m-rec'), renderRecords);
    if (UI.install) click($('#m-inst'), async () => { const p = UI.install; UI.install = null; p.prompt(); try { await p.userChoice; } catch (e) { /* */ } renderMenu(); });
    if (UI.iosHint) click($('#m-ios'), () => modal(`<h2>Install on iPhone / iPad</h2><ol class="help"><li>Open this page in <b>Safari</b>.</li><li>Tap the <b>Share</b> button.</li><li>Choose <b>Add to Home Screen</b>.</li></ol><p class="muted small">It then runs full screen and works offline.</p><div class="actions"><button class="btn primary" id="m-ok">Got it</button></div>`, (m) => click($('#m-ok', m), closeModal)));
    if (!Save.data.seenHelp) { Save.data.seenHelp = true; Save.save(); setTimeout(() => modal(`<h2>Welcome to Cursor Racing</h2><p class="muted">New here? A two-minute driving lesson covers steering, drifting, boost and power-ups, and pays 100 coins.</p><div class="actions"><button class="btn ghost" id="m-skip">Skip</button><button class="btn primary" id="m-tut">Driving lesson</button></div>`, (m) => { click($('#m-skip', m), closeModal, 'back'); click($('#m-tut', m), () => { closeModal(); startTutorial(); }); }), 400); }
  }

  // Main menu. Sideways: a rail on the left (logo, coins and the garage screens), the Championship banner,
  // three race cards with live info over a sketch of a track, and your car. Upright: the same in one column.
  function menuHTML(d, run, won) {
    const S = d.settings, cup = run && CR.CUPS.find((c) => c.id === run.cup);
    const chips = (a) => `<span class="mchips">${a.map((x) => `<i>${x}</i>`).join('')}</span>`;
    const stat = (n, l) => `<span class="mstat"><b>${n}</b>${l}</span>`;
    const open = []; CR.TRACKS.forEach((t, i) => { if (Save.trackOpen(i, false)) open.push(i); });
    const art = (ti) => (ti == null ? '' : `<span class="mart" style="background-image:url(${thumb(ti, false)})"></span>`);
    const ghosts = Object.values(d.best).filter((b) => b && b.tt != null).length;
    const tile = (id, ico, ttl, sub, cls = '', more = '') => `<button class="mtile ${cls}" id="${id}"><span class="ico">${ico}</span><span class="ttl">${ttl}</span><span class="sub">${sub}</span><span class="chev">›</span>${more}</button>`;
    const items = S.items ? 'Power-ups' : 'No power-ups';
    const cd = CR.CARS.find((c) => c.id === d.car), up = Save.ups(d.car);
    const pips = (n) => `<span class="pips">${'<i class="on"></i>'.repeat(n)}${'<i></i>'.repeat(5 - n)}</span>`;
    return `<div class="menu">
      <header class="menu-top"><div class="logo menu-logo"><span class="cur"></span>Cursor Racing</div><span class="menu-stats">${d.stats.races} races · ${d.stats.wins} wins · v${UI.version}</span>${coinsHTML()}
        ${UI.install ? '<button class="btn ghost small menu-inst" id="m-inst">📲 Install the game</button>' : ''}${UI.iosHint ? '<button class="btn ghost small menu-inst" id="m-ios">📲 Add to your home screen</button>' : ''}</header>
      <button class="mtile menu-champ" id="m-champ"><span class="ico">🏆</span><span class="kick">${run ? 'In progress' : 'Career'}</span><span class="ttl">Championship</span><span class="sub">${run ? `Continue ${cup.name}: race ${run.race + 1} of ${cup.races.length}` : 'Win cups to unlock new cars and mirrored tracks'}</span><span class="cupdots">${CR.CUPS.map((c) => `<i class="g${(d.cups[c.id] || {}).best || 0}"></i>`).join('')}<b>${won} / ${CR.CUPS.length} cups</b></span><span class="cta">${run ? 'Continue' : 'Play'} ›</span></button>
      ${tile('m-quick', '🏁', 'Quick Race', 'Up to 19 rivals on any open track', 'menu-play ac-red', art(open[open.length - 1]) + stat(d.stats.wins, d.stats.wins === 1 ? 'win' : 'wins') + chips([`${S.laps} ${S.laps === 1 ? 'lap' : 'laps'}`, `${S.rivals} ${S.rivals === 1 ? 'rival' : 'rivals'}`, items]))}
      ${tile('m-tt', '⏱️', 'Time Trial', 'Race your own ghost', 'menu-play ac-cyan', art(open[Math.min(1, open.length - 1)]) + stat(ghosts, ghosts === 1 ? 'ghost saved' : 'ghosts saved') + chips([`${open.length} ${open.length === 1 ? 'track' : 'tracks'} open`, 'Ghost of your best lap']))}
      ${tile('m-ko', '💥', 'Knockout', "Fall off screen and you're out", 'menu-play ac-pink', art(open[0]) + stat(d.stats.koWins, d.stats.koWins === 1 ? 'win' : 'wins') + chips([`${S.koRivals} rivals`, 'First to 4', items]))}
      <button class="menu-car" id="m-car"><img src="${carThumb(d.car)}" alt=""><span class="menu-car-t"><span class="kick">Your car</span><b>${cd.name}</b></span><span class="menu-car-u">${[['Engine', up.eng], ['Tyres', up.grip], ['Turbo', up.boost]].map(([n, l]) => `<span>${n}${pips(l)}</span>`).join('')}</span><span class="cta2">Change ›</span></button>
      <nav class="menu-more">
        ${tile('m-garage', '🔧', 'Garage', 'Your cars, paint and upgrades')}
        ${tile('m-shop', '🛒', 'Car Shop', `${CR.CARS.filter((c) => !d.owned[c.id]).length} cars to collect`)}
        ${tile('m-rec', '📊', 'Records', 'Trophies, best laps, career stats')}
        ${tile('m-tutb', '🎓', 'Driving Lesson', d.tutorialDone ? 'Replay the tutorial race' : 'Learn the ropes, earn 100 coins')}
        ${tile('m-set', '⚙️', 'Settings', 'Controls, screen, graphics, sound')}
      </nav>
    </div>`;
  }

  function help() {
    modal(`<h2>How to drive</h2><ul class="help">
      <li><b>Touch:</b> push the stick in the bottom-left corner toward where you want to go. The car turns that way and drives. (Settings has a floating stick and arrow buttons too.)</li>
      <li><b>Off the road:</b> small clutter like cereal, pebbles and nuts can be driven over, it just slows you down. Pencils, glow sticks, trees and walls are solid.</li>
      <li><b>Boost:</b> drift through corners (brake while turning) to fill the meter, then hold <b>BOOST</b>.</li>
      <li><b>Power-ups:</b> drive through the rainbow boxes, then tap <b>ITEM</b> (E on a keyboard): turbo, oil slick, shield, shockwave, a marble to fire, a magnet that pulls you up to the car ahead, or glue to leave a sticky trail behind you.</li>
      <li><b>Household hazards:</b> turntables spin you round, conveyor belts and fans push you sideways, dominoes slow you down until somebody knocks them over, and a see-saw is a wall until it tips your way.</li>
      <li><b>Launch:</b> press the gas in the last half-second of the countdown for a perfect start. Too early and you stall.</li>
      <li><b>Slipstream:</b> tuck in behind a car to go faster and charge boost.</li>
      <li><b>Stuck off the road?</b> You're put back after a few seconds, or use <b>Back to track</b> in the pause menu (R on a keyboard, Select on a gamepad).</li>
      <li><b>Keyboard:</b> arrows or WASD, Space to boost, E to use an item, R back to track, Esc to pause. Gamepads work too.</li>
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
    el.innerHTML = `<div class="wrap">${topbar('Championship')}<div class="split"><aside>
      <div class="panel setup">
        <div class="setrow"><span>Field</span><div class="seg" id="c-field">${[[3, '4 cars'], [7, '8'], [11, '12'], [19, '20']].map(([v, l]) => `<button data-v="${v}" class="${d.settings.cupRivals === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
        <div class="setrow"><span>Laps</span><div class="seg" id="c-laps">${[2, 3, 5].map((v) => `<button data-v="${v}" class="${d.settings.cupLaps === v ? 'on' : ''}">${v}</button>`).join('')}</div></div>
        <div class="setrow"><span>Power-ups</span><button class="tog ${d.settings.cupItems ? 'on' : ''}" id="c-items"></button><span class="muted small">${d.settings.cupItems ? 'Item boxes on the road' : 'Classic: pure racing'}</span></div>
        <div class="setrow"><span>Obstacles</span><button class="tog ${d.settings.cupHazards ? 'on' : ''}" id="c-haz"></button><span class="muted small">${d.settings.cupHazards ? 'Hazards, spills and jump gaps' : 'Clear road: ramps and boost pads only'}</span></div>
      </div>
      <p class="muted small side-note panel">Three races per cup. Points: ${d.settings.cupRivals > 3 ? '25 / 18 / 15 / 12 / 10 / 8 / 6 / 4 / 2 / 1 for the top ten' : '10 / 6 / 3 / 1'}. Finish the cup on the podium to open the next one. Win it to unlock a new car. These options apply to the next cup you start.</p></aside>
      <div class="cards" id="cuplist"></div></div></div>`;
    el.querySelectorAll('#c-field button').forEach((b) => click(b, () => { d.settings.cupRivals = +b.dataset.v; Save.save(); renderCups(); }));
    el.querySelectorAll('#c-laps button').forEach((b) => click(b, () => { d.settings.cupLaps = +b.dataset.v; Save.save(); renderCups(); }));
    click($('#c-haz', el), () => { d.settings.cupHazards = !d.settings.cupHazards; Save.save(); renderCups(); });
    click($('#c-items', el), () => { d.settings.cupItems = !d.settings.cupItems; Save.save(); renderCups(); });
    const list = $('#cuplist', el);
    CR.CUPS.forEach((cup, i) => {
      const st = d.cups[cup.id] || {}, open = !!st.unlocked;
      const card = document.createElement('div'); card.className = 'card' + (open ? '' : ' locked');
      const tr = cup.races.map(([t, r]) => CR.TRACKS[t].name + (r ? ' (R)' : '')).join(' · ');
      card.innerHTML = `<img class="thumb" src="${thumb(cup.races[0][0], cup.races[0][1])}" alt="">
        <span class="tag">${open ? (st.best ? ['', 'Gold', 'Silver', 'Bronze'][st.best] || '' : 'Open') : 'Locked'}</span>
        <h3><span class="trophy g${st.best && st.best <= 3 ? st.best : 0}"></span>${cup.name}</h3><div class="meta">${tr}</div>
        <div class="meta">Reward ${(cup.reward * PAY).toLocaleString()} coins${cup.unlock ? ' + ' + CR.CARS.find((c) => c.id === cup.unlock).name : ''}${i > 0 && !open ? ' · Podium in ' + CR.CUPS[i - 1].name : ''}</div>`;
      if (open) click(card, () => startCup(i));
      list.appendChild(card);
    });
    bind(el); show('cups');
  }
  function startCup(i) {
    const cup = CR.CUPS[i], S = Save.data.settings;
    // the cup's three named rivals, then others drawn at random to fill the field
    const names = CUP_RIVALS[cup.id].slice();
    const rest = CR.RIVALS.map((r) => r.name).filter((n) => !names.includes(n)).sort(() => Math.random() - 0.5);
    while (names.length < S.cupRivals && rest.length) names.push(rest.pop());
    const pts = { You: 0 }; for (const n of names) pts[n] = 0;
    // the fill-in rivals may bring a different car (kept for the whole cup); early cups only get slower ones
    const cars = {};
    const cap = 0.66 + i * 0.05, topOf = (id) => CR.CARS.find((c) => c.id === id).top;
    names.slice(3).forEach((n) => { const own = rival(n), r = recast(own, cap, topOf(own.car) > cap ? 1 : 0.6); if (r.car !== own.car) cars[n] = r.car; });
    Save.data.cupRun = { cup: cup.id, race: 0, pts, names, cars, laps: S.cupLaps, items: !!S.cupItems, hazards: S.cupHazards !== false, retries: CUP_RETRIES, live: false }; Save.save();
    continueCup();
  }
  function continueCup() {
    const run = Save.data.cupRun, ci = CR.CUPS.findIndex((c) => c.id === run.cup), cup = CR.CUPS[ci];
    if (run.race >= cup.races.length) return renderStandings();
    // a race that was started and not finished (restarted, quit, or the app closed) costs a retry
    if (run.live) {
      if (retriesLeft(run) > 0) run.retries = retriesLeft(run) - 1;
      else { forfeitCupRace(); return renderStandings(); }
    }
    run.live = true; Save.save();
    const [t, rev] = cup.races[run.race];
    const lvl = Math.min(5, ci + 1);
    const names = run.names || CUP_RIVALS[cup.id]; // runs saved by older versions have no names
    const rivals = names.map((n) => {
      const r = rival(n), cid = run.cars && run.cars[n], c = cid && CR.CARS.find((x) => x.id === cid);
      return { ...r, ...(c ? { car: c.id, paint: c.paints[0], acc: c.paints[1] } : {}), up: { eng: lvl, grip: lvl - 1, boost: lvl - 1 } };
    });
    startRace({ mode: 'race', track: t, reversed: rev, laps: run.laps || 3, items: !!run.items, hazards: run.hazards !== false, ai: cup.ai, rivals, cup: ci, grid: run.grid || null });
  }
  // out of retries: the race is scored with you last and the rivals in their current cup order
  function forfeitCupRace() {
    const run = Save.data.cupRun;
    const order = Object.keys(run.pts).filter((n) => n !== 'You').sort((a, b) => run.pts[b] - run.pts[a]).concat('You');
    order.forEach((n, i) => { run.pts[n] += pointsFor(order.length, i); });
    run.grid = order; run.race++; run.live = false; Save.save();
    UI.toast('Race forfeited: no retries left');
  }
  // the cup you're in the middle of: standings, options, and a way out
  function renderCupRun() {
    const d = Save.data, run = d.cupRun; if (!run) return renderCups();
    const ci = CR.CUPS.findIndex((c) => c.id === run.cup), cup = CR.CUPS[ci];
    if (run.race >= cup.races.length) return renderStandings();
    const el = $('#scr-standings'), list = Object.entries(run.pts).sort((a, b) => b[1] - a[1]), [t, rev] = cup.races[run.race], left = retriesLeft(run);
    el.innerHTML = `<div class="wrap res-wrap">${topbar(cup.name)}<div class="panel res"><div class="r-head">
      <h2>Race ${run.race + 1} of ${cup.races.length} · ${CR.TRACKS[t].name}${rev ? ' R' : ''}</h2>
      <div class="tags" style="margin:8px 0">${[`${list.length} cars`, `${run.laps || 3} laps`, run.items ? 'Power-ups on' : 'No power-ups', run.hazards !== false ? 'Obstacles on' : 'Clear road', `${left} ${left === 1 ? 'retry' : 'retries'} left`].map((x) => `<span>${x}</span>`).join('')}</div>
      ${run.live ? `<p class="muted small">You left a race unfinished. ${left ? 'Continuing uses one retry.' : 'You have no retries left, so continuing forfeits it.'}</p>` : ''}</div>
      <div class="r-main"><table class="table"><tr><th>#</th><th>Driver</th><th class="num">Points</th></tr>${list.map(([n, p], i) => `<tr class="${n === 'You' ? 'me' : ''}"><td>${i + 1}</td><td>${n}</td><td class="num">${p}</td></tr>`).join('')}</table></div>
      <div class="r-foot">${run.grid ? `<p class="muted small" style="text-align:center;margin:10px 0 0">You line up ${U.ordinal(run.grid.indexOf('You') + 1)} of ${run.grid.length}.</p>` : ''}
      <div class="actions"><button class="btn primary" id="cr-go">${run.live && !left ? 'Forfeit race' : 'Continue'}</button><button class="btn" id="cr-rst">Restart cup</button><button class="btn ghost" id="cr-quit">Abandon cup</button></div></div>
    </div></div>`;
    click($('#cr-go', el), continueCup);
    click($('#cr-rst', el), () => confirmBox('Restart this cup?', 'Points go back to zero and you start again from race 1, with the same rivals and options.', 'Restart', () => {
      for (const k of Object.keys(run.pts)) run.pts[k] = 0;
      run.race = 0; run.grid = null; run.retries = CUP_RETRIES; run.live = false; Save.save(); renderCupRun();
    }));
    click($('#cr-quit', el), () => confirmBox('Abandon this cup?', 'Your points in this cup are lost. Coins you earned in its races are kept.', 'Abandon', () => { d.cupRun = null; Save.save(); renderCups(); }));
    bind(el); show('standings');
  }

  // ---------------------------------------------------------------------------
  // Driving lesson: a short guided race. Each step waits until the player has done the thing.
  const touchy = () => UI.touch;
  const LESSON = [
    { text: () => (touchy() ? ({ fixed: 'Push the stick in the bottom-left corner toward where you want to go. The car turns that way and drives.', stick: 'Put your thumb on the left side of the screen and point it where you want to go.' }[Save.data.settings.controls] || 'Steer with the arrow buttons. The car drives itself forward.') : 'Drive with the arrow keys or WASD.'), goal: 'Follow the road', done: (p, t) => t.dist > 700 },
    { text: () => `Corners: hold ${touchy() ? 'BRAKE' : 'Down or S'} while turning at speed and the tail slides out. That is a drift, and it fills the boost meter.`, goal: 'Drift through a corner', done: (p, t) => t.drift > 0.5, hint: 16 },
    { text: () => `Your boost meter is topped up. Hold ${touchy() ? 'BOOST' : 'Space'} on a straight.`, goal: 'Use your boost', start: (p) => { p.boost = 1; }, done: (p, t) => t.boost > 0.6 },
    { text: () => `Drive through a rainbow box to pick up a power-up, then ${touchy() ? 'tap ITEM' : 'press E'} to use it.`, goal: 'Use a power-up', done: (p, t) => p.usedItems > t.items0, hint: 25, onHint: (p) => { if (!p.item) { p.item = 'turbo'; Game.msg('HAVE A TURBO', 1, 'info'); } } },
    { text: () => 'Stay close behind another car to slipstream: more speed and free boost. Chevron pads boost you too, and the table edge is a long way down.', goal: 'Cross the finish line', done: (p, t) => p.lap > t.lap0 },
  ];
  function startTutorial() {
    const rivals = [rival('Pip'), rival('Dash')];
    startRace({ mode: 'race', track: 0, reversed: false, laps: 99, items: true, ai: 0.8, rivals, tutorial: true });
    UI.lesson = { i: -1, t: null };
  }
  function lessonTick() {
    const L = UI.lesson, p = Game.player; if (!L || !p || Game.state === 'count' || Game.paused) return;
    const now = Game.raceT, dt = Math.min(0.1, now - (L.last ?? now)); L.last = now;
    if (L.i < 0 || LESSON[L.i].done(p, L.t)) {
      if (L.i >= 0) { Audio.play('best'); Game.emit('confetti', p.x, p.y, 20, 20); }
      L.i++;
      if (L.i >= LESSON.length) return lessonDone();
      const st = LESSON[L.i];
      L.t = { dist: 0, drift: 0, boost: 0, since: 0, hinted: false, items0: p.usedItems || 0, lap0: p.lap, px: p.x, py: p.y };
      if (st.start) st.start(p);
      H.coach.innerHTML = `<small>Lesson ${L.i + 1} of ${LESSON.length}</small><p>${st.text()}</p><b>&#9654; ${st.goal}</b>`;
      H.coach.classList.remove('pop'); void H.coach.offsetWidth; H.coach.classList.add('pop');
      return;
    }
    const t = L.t, st = LESSON[L.i], spd = Math.hypot(p.vx, p.vy);
    t.dist += Math.hypot(p.x - t.px, p.y - t.py) < 60 ? Math.hypot(p.x - t.px, p.y - t.py) : 0; t.px = p.x; t.py = p.y;
    if (p.slip > 60 && spd > 100 && !p.air) t.drift += dt;
    if (p.boosting && p.padT <= 0) t.boost += dt;
    t.since += dt;
    if (st.hint && t.since > st.hint && !t.hinted) { t.hinted = true; if (st.onHint) st.onHint(p); else H.coach.querySelector('b').insertAdjacentHTML('afterend', '<p class="muted small">Tip: get up to speed first, then brake and turn together.</p>'); }
  }
  function lessonDone() {
    const d = Save.data, first = !d.tutorialDone;
    UI.lesson = null; UI.inRace = false; teardownTouch(); Game.stop(); Audio.setMusic('menu'); Audio.play('win');
    d.tutorialDone = true; if (first) Save.addCoins(100); else Save.save();
    renderMenu();
    modal(`<h2>Lesson complete</h2><p>You can steer, drift, boost and use power-ups. ${first ? 'Here are <b class="gold">100 coins</b> for the garage.' : ''}</p><p class="muted small">One more trick: press the gas in the last half-second of the countdown for a perfect start.</p><div class="actions"><button class="btn ghost" id="m-ok">Menu</button><button class="btn primary" id="m-go">Championship</button></div>`, (m) => { click($('#m-ok', m), closeModal, 'back'); click($('#m-go', m), () => { closeModal(); renderCups(); }); });
  }

  // ---------------------------------------------------------------------------
  function renderTracks(mode) {
    const d = Save.data, el = $('#scr-tracks');
    const title = { quick: 'Quick Race', tt: 'Time Trial', ko: 'Knockout' }[mode];
    const mirrorOpen = Save.cupUnlocked('mirror'), rev = mirrorOpen && !!UI.trkMirror;
    el.innerHTML = `<div class="wrap">${topbar(title)}
      ${mode !== 'tt' || mirrorOpen ? `<div class="split"><aside>${mode !== 'tt' ? setupPanel(mode) : ''}
      ${mirrorOpen ? `<div class="row mirror-row"><div class="seg" id="t-dir"><button data-v="0" class="${rev ? '' : 'on'}">Normal</button><button data-v="1" class="${rev ? 'on' : ''}">Mirror</button></div><span class="muted small">Mirror runs every track the other way round.</span></div>` : ''}</aside>
      <div id="tl"></div></div>` : '<div id="tl"></div>'}</div>`;
    const tl = $('#tl', el), seen = new Set();
    // grouped by the cup that opens them
    CR.CUPS.forEach((cup, ci) => {
      const tis = cup.races.filter(([t, r]) => !r && !seen.has(t)).map(([t]) => t);
      if (!tis.length) return;
      tis.forEach((t) => seen.add(t));
      const cupOpen = Save.cupUnlocked(cup.id), how = ci ? `Finish on the podium in the ${CR.CUPS[ci - 1].name} to open these.` : '';
      const h = document.createElement('h2'); h.className = 'grp'; h.innerHTML = `${cup.name}${cupOpen ? '' : ` <span>Locked</span>`}`; tl.appendChild(h);
      if (!cupOpen) { const p = document.createElement('p'); p.className = 'muted small'; p.style.margin = '0 0 8px'; p.textContent = how; tl.appendChild(p); }
      const box = document.createElement('div'); box.className = 'cards'; tl.appendChild(box);
      for (const ti of tis) {
        const tr = CR.TRACKS[ti], open = Save.trackOpen(ti, rev), b = Save.bestOf(ti, rev), th = CR.THEMES[tr.theme], rl = mode === 'quick' ? d.settings.laps : 3;
        const card = document.createElement('div'); card.className = 'card' + (open ? '' : ' locked');
        card.innerHTML = `<img class="thumb" src="${thumb(ti, rev)}" alt=""><span class="tag">${open ? (rev ? 'Mirror' : th.name) : 'Locked'}</span>
          <h3>${tr.name}${rev ? ' R' : ''}</h3><div class="meta">${open ? (mode === 'tt' ? `Best lap ${U.fmtTime(b.tt)}` : mode === 'ko' ? `Best lap ${U.fmtTime(b.lap)}` : `Best lap ${U.fmtTime(b.lap)} · <span class="rb" data-ti="${ti}">${raceLabel(ti, rev, rl)}</span>`) : `Opens with the ${cup.name}`}</div>`;
        if (open) click(card, () => {
          const ghost = mode === 'tt' ? Save.ghost(ti, rev) : null;
          const S = d.settings, nR = mode === 'ko' ? U.clamp(S.koRivals, 3, 7) : U.clamp(S.rivals, 1, 19);
          const pool = mode === 'tt' ? [] : CR.RIVALS.slice().sort(() => Math.random() - 0.5).slice(0, nR).map((r) => recast(r));
          const top = CR.CUPS.reduce((m, c) => (Save.cupUnlocked(c.id) ? c.ai : m), 0.9);
          const lvl = CR.CUPS.filter((c) => Save.cupUnlocked(c.id)).length;
          startRace({ mode: mode === 'quick' ? 'race' : mode, track: ti, reversed: rev, laps: mode === 'quick' ? d.settings.laps : 3, items: mode !== 'tt' && d.settings.items, hazards: mode === 'tt' ? true : d.settings.hazards, ai: top, rivals: pool.map((r) => ({ ...r, up: { eng: lvl, grip: lvl - 1, boost: lvl - 1 } })), ghost: ghost && ghost.data, ghostCar: ghost && ghost.car, bestLap: b.tt, koTarget: 4, quick: mode });
        });
        else click(card, () => UI.toast(`Opens with the ${cup.name}. ${how}`, 3200), 'error');
        box.appendChild(card);
      }
    });
    el.querySelectorAll('#t-dir button').forEach((b) => click(b, () => { UI.trkMirror = b.dataset.v === '1'; renderTracks(mode); }));
    bindSetup(el, mode);
    bind(el); show('tracks');
  }

  // Records: career stats, trophies and best times in one place
  function renderRecords() {
    const d = Save.data, el = $('#scr-records'), s = d.stats, mirror = Save.cupUnlocked('mirror');
    const box = (l, v) => `<div><b>${v}</b><span>${l}</span></div>`;
    el.innerHTML = `<div class="wrap">${topbar('Records')}
      <div class="panel"><h2>Career</h2><div class="statgrid">${box('Races', s.races)}${box('Wins', s.wins)}${box('Podiums', s.podiums)}${box('Cups won', s.cups)}${box('Knockout wins', s.koWins)}${box('Coins earned', s.coinsEarned.toLocaleString())}${box('Cars owned', CR.CARS.filter((c) => d.owned[c.id]).length + ' / ' + CR.CARS.length)}</div></div>
      <div class="panel" style="margin-top:12px"><h2>Trophies</h2><div class="trophies">${CR.CUPS.map((c) => { const st = d.cups[c.id] || {}; return `<div class="${st.unlocked ? '' : 'off'}"><span class="trophy g${st.best || 0}"></span><b>${c.name}</b><span class="muted small">${st.best ? ['', 'Gold', 'Silver', 'Bronze'][st.best] : st.unlocked ? 'No trophy yet' : 'Locked'}</span></div>`; }).join('')}</div></div>
      <div class="panel" style="margin-top:12px"><h2>Track records</h2><table class="table"><tr><th>Track</th><th class="num">Best lap</th><th class="num">Best race</th>${mirror ? '<th class="num">Mirror lap</th>' : ''}</tr>
        ${CR.TRACKS.map((t, i) => { const a = Save.bestOf(i, false), m = Save.bestOf(i, true); return `<tr><td>${t.name}</td><td class="num">${U.fmtTime(a.lap)}</td><td class="num">${U.fmtTime(Save.raceBest(i, false, 3))}</td>${mirror ? `<td class="num">${U.fmtTime(m.lap)}</td>` : ''}</tr>`; }).join('')}</table>
        <p class="muted small" style="margin-bottom:0">Best race is your quickest 3-lap finish. Best lap counts every mode; Time Trial keeps its own best for the ghost.</p></div></div>`;
    bind(el); show('records');
  }

  // race setup: laps, field size, power-ups
  function setupPanel(mode) {
    const S = Save.data.settings, ko = mode === 'ko';
    const n = ko ? U.clamp(S.koRivals, 3, 7) : U.clamp(S.rivals, 1, 19);
    return `<div class="panel setup">
      ${ko ? '' : `<div class="setrow"><span>Laps</span><div class="stepper"><button class="btn small" data-k="laps" data-d="-1">&minus;</button><b id="v-laps">${S.laps}</b><button class="btn small" data-k="laps" data-d="1">+</button></div></div>`}
      <div class="setrow"><span>Rivals</span><input type="range" id="v-riv" min="${ko ? 3 : 1}" max="${ko ? 7 : 19}" value="${n}"><b id="v-rivn">${n}</b></div>
      <div class="setrow"><span>Power-ups</span><button class="tog ${S.items ? 'on' : ''}" id="v-items"></button><span class="muted small">${S.items ? 'Item boxes on the road' : 'Pure racing'}</span></div>
      <div class="setrow"><span>Obstacles</span><button class="tog ${S.hazards ? 'on' : ''}" id="v-haz"></button><span class="muted small">${S.hazards ? 'Hazards, spills and jump gaps' : 'Clear road: ramps and boost pads only'}</span></div>
    </div>`;
  }
  const raceLabel = (ti, rev, laps) => `${laps} lap${laps === 1 ? '' : 's'} ${U.fmtTime(Save.raceBest(ti, rev, laps))}`;
  function bindSetup(el, mode) {
    const S = Save.data.settings, ko = mode === 'ko';
    el.querySelectorAll('.stepper button').forEach((b) => click(b, () => { S.laps = U.clamp(S.laps + +b.dataset.d, 1, 9); Save.save(); $('#v-laps', el).textContent = S.laps;
      const rev = Save.cupUnlocked('mirror') && !!UI.trkMirror; el.querySelectorAll('.rb').forEach((x) => (x.textContent = raceLabel(+x.dataset.ti, rev, S.laps))); }));
    const r = $('#v-riv', el);
    if (r) r.addEventListener('input', () => { const v = +r.value; if (ko) S.koRivals = v; else S.rivals = v; $('#v-rivn', el).textContent = v; Save.save(); });
    const it = $('#v-items', el);
    if (it) click(it, () => { S.items = !S.items; Save.save(); renderTracks(mode); });
    const hz = $('#v-haz', el);
    if (hz) click(hz, () => { S.hazards = !S.hazards; Save.save(); renderTracks(mode); });
  }

  // ---------------------------------------------------------------------------
  const carThumbs = {};
  function carThumb(id) { // small picture for the garage strip, redrawn when the paint changes
    const paint = Save.paintOf(id), k = id + paint;
    if (!carThumbs[k]) { const c = CR.CARS.find((x) => x.id === id); carThumbs[k] = CR.voxIcon(CR.carVox(id, paint, c.paints[1]), 2).toDataURL(); }
    return carThumbs[k];
  }
  const statBar = (v, add = 0) => `<div class="bar"><b style="width:${Math.min(100, (v + add) * 100)}%"></b><i style="width:${Math.min(100, v * 100)}%"></i></div>`;
  const traits = (c) => [c.offroad >= 0.5 && 'Off-road', c.hover && 'Floats over spills', c.lift > 1.1 && 'Big jumps', c.charge > 1.1 && 'Fast boost charge', c.mass >= 1.2 && 'Heavyweight', c.mass <= 0.3 && 'Featherweight'].filter(Boolean);

  // Garage: only the cars you own. Pick one to drive, paint it, upgrade it.
  function renderGarage(sel) {
    const d = Save.data, el = $('#scr-garage');
    const mine = CR.CARS.map((c, i) => i).filter((i) => d.owned[CR.CARS[i].id]);
    let idx = sel != null ? sel : CR.CARS.findIndex((c) => c.id === (UI.gsel || d.car));
    if (!mine.includes(idx)) idx = CR.CARS.findIndex((c) => c.id === d.car);
    const car = CR.CARS[idx]; UI.gsel = car.id;
    const up = Save.ups(car.id), paint = Save.paintOf(car.id), pos = mine.indexOf(idx);
    el.innerHTML = `<div class="wrap">${topbar('Garage')}
      <div class="carstrip" id="g-strip">${mine.map((i) => `<button class="${i === idx ? 'sel' : ''} ${CR.CARS[i].id === d.car ? 'cur' : ''}" data-i="${i}" title="${CR.CARS[i].name}"><img src="${carThumb(CR.CARS[i].id)}" alt="${CR.CARS[i].name}"></button>`).join('')}
        <button class="more" id="g-shop" title="Car Shop">+<small>Shop</small></button></div>
      <p class="muted small" style="margin:0 0 10px">${mine.length} of ${CR.CARS.length} cars owned${d.car === car.id ? '' : ` · driving ${CR.CARS.find((c) => c.id === d.car).name}`}</p>
      <div class="garage">
        <div class="panel showcase"><div class="carnav"><button class="btn small" id="g-prev" ${mine.length < 2 ? 'disabled' : ''}>&larr;</button><h3>${car.name}</h3><button class="btn small" id="g-next" ${mine.length < 2 ? 'disabled' : ''}>&rarr;</button></div>
          <canvas id="g-icon"></canvas><p class="muted small" style="text-align:center;margin:6px 0 0">${car.desc}</p>
          <div class="tags" style="justify-content:center">${traits(car).map((t) => `<span>${t}</span>`).join('')}</div>
          <div class="paints" id="g-paint"></div></div>
        <div class="panel">
          <h2>Stats</h2>
          <div class="stat">Speed ${statBar(car.top, up.eng * 0.03)}</div><div class="stat">Accel ${statBar(car.accel, up.eng * 0.03)}</div>
          <div class="stat">Grip ${statBar(car.grip, up.grip * 0.04)}</div><div class="stat">Weight ${statBar(car.mass / 1.8)}</div>
          <div id="g-act" style="margin:12px 0">${d.car === car.id ? '<button class="btn" disabled>Selected</button>' : '<button class="btn primary" id="g-sel">Drive this car</button>'}</div>
          <h2 style="margin-top:6px">Upgrades</h2><div id="g-up"></div>
        </div>
      </div></div>`;
    CR.voxIcon(CR.carVox(car.id, paint, car.paints[1]), 9, $('#g-icon', el));
    const pl = $('#g-paint', el);
    for (const p of [car.paints[0], ...CR.PAINTS.filter((q) => q !== car.paints[0])]) {
      const s = document.createElement('div'); s.className = 'sw' + (p === paint ? ' sel' : ''); s.style.background = p;
      click(s, () => { d.paint[car.id] = p; Save.save(); renderGarage(idx); }); pl.appendChild(s);
    }
    if ($('#g-sel', el)) click($('#g-sel', el), () => { d.car = car.id; Save.save(); renderGarage(idx); });
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
    el.querySelectorAll('#g-strip button[data-i]').forEach((b) => click(b, () => renderGarage(+b.dataset.i)));
    click($('#g-shop', el), () => renderShop());
    const selB = $('#g-strip .sel', el), strip = $('#g-strip', el);
    requestAnimationFrame(() => { if (selB) strip.scrollLeft += selB.getBoundingClientRect().left - strip.getBoundingClientRect().left - strip.clientWidth / 2 + selB.clientWidth / 2; });
    click($('#g-prev', el), () => renderGarage(mine[(pos - 1 + mine.length) % mine.length]));
    click($('#g-next', el), () => renderGarage(mine[(pos + 1) % mine.length]));
    bind(el); show('garage');
  }

  // ---------------------------------------------------------------------------
  // Car Shop: every car you don't own yet, with search, sorting and filters.
  const SORTS = { price: ['Price: low to high', (a, b) => a.price - b.price], priceD: ['Price: high to low', (a, b) => b.price - a.price], top: ['Top speed', (a, b) => b.top - a.top], accel: ['Acceleration', (a, b) => b.accel - a.accel],
    grip: ['Grip', (a, b) => b.grip - a.grip], heavy: ['Heaviest', (a, b) => b.mass - a.mass], light: ['Lightest', (a, b) => a.mass - b.mass], name: ['Name', (a, b) => a.name.localeCompare(b.name)] };
  const FILTERS = { all: ['All', () => true], afford: ['Can afford', (c) => c.price <= Save.data.coins], offroad: ['Off-road', (c) => c.offroad >= 0.5], hover: ['Floats', (c) => !!c.hover], jump: ['Jumpers', (c) => c.lift > 1.1], charge: ['Fast boost', (c) => c.charge > 1.1], heavy: ['Heavy', (c) => c.mass >= 1.0], light: ['Light', (c) => c.mass <= 0.45] };
  function renderShop() {
    const d = Save.data, el = $('#scr-shop'), st = UI.shop || (UI.shop = { q: '', sort: 'price', filter: 'all' });
    const left = CR.CARS.filter((c) => !d.owned[c.id]).length;
    el.innerHTML = `<div class="wrap">${topbar('Car Shop')}
      <div class="panel shopbar">
        <input type="search" id="sh-q" placeholder="Search ${left} cars" value="${st.q.replace(/"/g, '&quot;')}" autocomplete="off" enterkeyhint="search">
        <label class="muted small">Sort <select id="sh-sort">${Object.entries(SORTS).map(([k, v]) => `<option value="${k}" ${st.sort === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></label>
        <div class="chips" id="sh-f">${Object.entries(FILTERS).map(([k, v]) => `<button data-k="${k}" class="${st.filter === k ? 'on' : ''}">${v[0]}</button>`).join('')}</div>
      </div>
      <p class="muted small" id="sh-count" style="margin:8px 2px"></p>
      <div class="cards shop" id="sh-list"></div></div>`;
    const list = $('#sh-list', el);
    const fill = () => {
      const q = st.q.trim().toLowerCase();
      const cars = CR.CARS.filter((c) => !d.owned[c.id] && FILTERS[st.filter][1](c) && (!q || (c.name + ' ' + c.desc + ' ' + traits(c).join(' ')).toLowerCase().includes(q))).sort(SORTS[st.sort][1]);
      $('#sh-count', el).textContent = left === 0 ? 'You own every car. Nice collection.' : cars.length ? `${cars.length} ${cars.length === 1 ? 'car' : 'cars'}` : 'No cars match. Try another search or filter.';
      list.innerHTML = '';
      for (const c of cars) {
        const gift = CR.CUPS.find((k) => k.unlock === c.id), can = d.coins >= c.price;
        const card = document.createElement('div'); card.className = 'card shopcard';
        card.innerHTML = `<div class="sc-top"><img src="${shopThumb(c)}" alt=""><div><h3>${c.name}</h3><div class="meta">${c.desc}</div></div></div>
          <div class="tags">${traits(c).map((t) => `<span>${t}</span>`).join('')}</div>
          <div class="mini"><span>Speed</span>${statBar(c.top)}<span>Accel</span>${statBar(c.accel)}<span>Grip</span>${statBar(c.grip)}<span>Weight</span>${statBar(c.mass / 1.8)}</div>
          <button class="btn small ${can ? 'primary' : ''}" ${can ? '' : 'disabled'}>${can ? 'Buy' : 'Need ' + (c.price - d.coins).toLocaleString() + ' more'} · ${c.price.toLocaleString()} <span class="coin" style="width:10px;height:10px"></span></button>
          ${gift ? `<div class="muted small" style="margin-top:6px">Or win the ${gift.name} to get it free.</div>` : ''}`;
        const b = card.querySelector('button');
        click(b, () => confirmBox('Buy ' + c.name + '?', `${c.price.toLocaleString()} coins. You have ${d.coins.toLocaleString()}.`, 'Buy', () => {
          d.coins -= c.price; d.owned[c.id] = true; Save.save(); Audio.play('buy');
          modal(`<h2>${c.name} is yours</h2><p class="muted">It's parked in your garage.</p><div class="actions"><button class="btn ghost" id="m-more">Keep shopping</button><button class="btn primary" id="m-drive">Drive it</button></div>`, (m) => {
            click($('#m-more', m), () => { closeModal(); renderShop(); }); click($('#m-drive', m), () => { closeModal(); d.car = c.id; Save.save(); renderGarage(CR.CARS.indexOf(c)); });
          });
        }));
        list.appendChild(card);
      }
    };
    const qi = $('#sh-q', el);
    qi.addEventListener('input', () => { st.q = qi.value; fill(); });
    $('#sh-sort', el).addEventListener('change', (e) => { st.sort = e.target.value; Audio.play('ui'); fill(); });
    el.querySelectorAll('#sh-f button').forEach((b) => click(b, () => { st.filter = b.dataset.k; el.querySelectorAll('#sh-f button').forEach((x) => x.classList.toggle('on', x === b)); fill(); }));
    fill(); bind(el); show('shop');
  }
  const shopThumbs = {};
  function shopThumb(c) { return shopThumbs[c.id] || (shopThumbs[c.id] = CR.voxIcon(CR.carVox(c.id, c.paints[0], c.paints[1]), 3).toDataURL()); }

  // ---------------------------------------------------------------------------
  function renderSettings(from) {
    const s = Save.data.settings, el = $('#scr-settings');
    const seg = (id, opts, val) => `<div class="seg" id="${id}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(val) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    const tog = (id, on) => `<button class="tog ${on ? 'on' : ''}" id="${id}" aria-pressed="${on}"></button>`;
    el.innerHTML = `<div class="wrap">${topbar('Settings', UI.inRace ? 'menu' : 'menu')}
      <div class="panel">
        <div class="set"><div class="lbl"><b>Touch controls</b><span>Stick: a joystick in the bottom-left corner. Float: put your thumb anywhere on the left and point. Buttons: left and right arrows.</span></div>${seg('s-ctl', [['fixed', 'Stick'], ['stick', 'Float'], ['buttons', 'Buttons']], s.controls)}</div>
        <div class="set"><div class="lbl"><b>Screen</b><span>Sideways is the default. Upright works too. Auto follows how you hold the phone.${screen.orientation && screen.orientation.lock ? '' : ' On iPhone, turn rotation lock off so the game can turn.'}</span></div>${seg('s-or', [['landscape', 'Sideways'], ['portrait', 'Upright'], ['auto', 'Auto']], s.orient)}</div>
        <div class="set"><div class="lbl"><b>Auto-accelerate</b><span>Buttons mode: the car drives itself forward</span></div>${tog('s-gas', s.autoGas)}</div>
        <div class="set"><div class="lbl"><b>Difficulty</b><span>How fast the rivals drive. On Easy they are slower and don't catch up as hard. Takes effect next race.</span></div>${seg('s-diff', [[0, 'Easy'], [1, 'Normal'], [2, 'Hard']], s.diff)}</div>
        <div class="set"><div class="lbl"><b>Graphics</b><span>Lower it if the game stutters</span></div>${seg('s-q', [['low', 'Low'], ['medium', 'Med'], ['high', 'High']], s.quality)}</div>
        <div class="set"><div class="lbl"><b>Tilt-shift blur</b><span>The miniature look at the top and bottom</span></div>${tog('s-dof', s.dof)}</div>
        <div class="set"><div class="lbl"><b>Bloom</b><span>Glow on lights and shiny things</span></div>${tog('s-bloom', s.bloom)}</div>
        <div class="set"><div class="lbl"><b>Shadows</b></div>${tog('s-shad', s.shadows)}</div>
        <div class="set"><div class="lbl"><b>Screen shake</b></div>${tog('s-shake', s.shake)}</div>
        <div class="set"><div class="lbl"><b>Vibration</b></div>${tog('s-vib', s.vib)}</div>
        <div class="set"><div class="lbl"><b>Sound effects</b></div><input type="range" id="s-sfx" min="0" max="1" step="0.05" value="${s.sfx}"></div>
        <div class="set"><div class="lbl"><b>Music</b></div><input type="range" id="s-mus" min="0" max="1" step="0.05" value="${s.music}"></div>
      </div>
      <div class="actions"><button class="btn" id="s-help">How to play</button><button class="btn" id="s-tut">Driving lesson</button><button class="btn" id="s-upd">Check for updates</button><button class="btn" id="s-cred">Credits</button><button class="btn" id="s-bak">Back up save</button><button class="btn" id="s-rst">Restore save</button><button class="btn ghost" id="s-reset">Reset progress</button></div>
      <details class="dev" ${UI.devOpen ? 'open' : ''}><summary>Developer options</summary><p class="muted small">For testing. These change your save.</p><div class="actions"><button class="btn small" id="d-coins">+10,000 coins</button><button class="btn small" id="d-cars">Unlock all cars</button><button class="btn small" id="d-cups">Open all cups</button><button class="btn small" id="d-tut">Reset driving lesson</button></div></details>
      <p class="muted small" style="text-align:center;margin-top:14px">Cursor Racing v${UI.version}</p></div>`;
    const segBind = (id, key, fn) => el.querySelectorAll(`#${id} button`).forEach((b) => click(b, () => { const v = b.dataset.v; s[key] = isNaN(+v) ? v : +v; Save.save(); applySettings(); if (fn) fn(); renderSettings(); }));
    const togBind = (id, key) => click($('#' + id, el), () => { s[key] = !s[key]; Save.save(); applySettings(); renderSettings(); });
    segBind('s-ctl', 'controls'); segBind('s-or', 'orient', () => applyOrientation(true)); segBind('s-diff', 'diff'); segBind('s-q', 'quality');
    togBind('s-gas', 'autoGas'); togBind('s-dof', 'dof'); togBind('s-bloom', 'bloom'); togBind('s-shad', 'shadows'); togBind('s-shake', 'shake'); togBind('s-vib', 'vib');
    $('#s-sfx', el).addEventListener('input', (e) => { s.sfx = +e.target.value; applySettings(); Save.save(); });
    $('#s-sfx', el).addEventListener('change', () => Audio.play('coin'));
    $('#s-mus', el).addEventListener('input', (e) => { s.music = +e.target.value; applySettings(); Save.save(); });
    click($('#s-help', el), help);
    click($('#s-tut', el), startTutorial);
    click($('#s-upd', el), () => (UI.checkUpdate ? UI.checkUpdate(true) : UI.toast('Updates work once the game is installed or served over https')));
    click($('#s-cred', el), () => modal(`<h2>Credits</h2><p>Cursor Racing is made from scratch: hand-written JavaScript, WebGL and Web Audio. Every car, prop, sprite, sound and song is generated in code. No third-party libraries, fonts, images or audio.</p>
      <p class="muted small">Inspired by classic top-down toy-car racers. Not affiliated with or endorsed by any of them. All trademarks belong to their owners.</p><p class="muted small">MIT licence. See LICENSE and CREDITS.md.</p><div class="actions"><button class="btn primary" id="m-ok">Close</button></div>`, (m) => click($('#m-ok', m), closeModal)));
    click($('#s-bak', el), () => modal(`<h2>Back up save</h2><p class="muted small">Copy this code and keep it somewhere safe. Paste it into Restore save, on this or another device, to get your progress back. Time Trial ghosts are not included.</p><textarea id="bk" readonly rows="6">${Save.exportCode()}</textarea><div class="actions"><button class="btn ghost" id="m-ok">Close</button><button class="btn primary" id="m-copy">Copy code</button></div>`, (m) => {
      click($('#m-ok', m), closeModal, 'back');
      click($('#m-copy', m), async () => { const ta = $('#bk', m); ta.focus(); ta.select(); try { await navigator.clipboard.writeText(ta.value); UI.toast('Copied'); } catch (e) { try { document.execCommand('copy'); UI.toast('Copied'); } catch (e2) { UI.toast('Select the code and copy it by hand'); } } });
    }));
    click($('#s-rst', el), () => modal(`<h2>Restore save</h2><p class="muted small">Paste a backup code. This replaces all progress on this device.</p><textarea id="bk" rows="6" placeholder="CR1..."></textarea><div class="actions"><button class="btn ghost" id="m-no">Cancel</button><button class="btn primary" id="m-yes">Restore</button></div>`, (m) => {
      click($('#m-no', m), closeModal, 'back');
      click($('#m-yes', m), () => { if (!Save.importCode($('#bk', m).value)) { Audio.play('error'); UI.toast('That is not a valid backup code'); return; } closeModal(); applySettings(); UI.toast('Save restored'); renderMenu(); }, null);
    }));
    $('details.dev', el).addEventListener('toggle', (e) => { UI.devOpen = e.target.open; });
    const dev = (id, msg, fn) => click($('#' + id, el), () => { fn(Save.data); Save.save(); UI.toast(msg); renderSettings(); }, 'coin');
    dev('d-coins', '+10,000 coins', (d) => { d.coins += 10000; });
    dev('d-cars', 'All cars unlocked', (d) => { for (const c of CR.CARS) d.owned[c.id] = true; });
    dev('d-cups', 'All cups open', (d) => { for (const c of CR.CUPS) if (!d.cups[c.id]) d.cups[c.id] = { unlocked: true, best: 0 }; else d.cups[c.id].unlocked = true; });
    dev('d-tut', 'Driving lesson reset', (d) => { d.tutorialDone = false; d.seenHelp = false; });
    click($('#s-reset', el), () => confirmBox('Reset progress?', 'This deletes coins, cars, upgrades, cups, best times and ghosts. It cannot be undone.', 'Reset', () => { Save.reset(); applySettings(); UI.toast('Progress reset'); renderMenu(); }));
    bind(el); show('settings');
  }
  function applySettings() {
    const s = Save.data.settings;
    if (!s.quality) s.quality = (UI.touch || (navigator.hardwareConcurrency || 4) <= 4) ? 'medium' : 'high';
    R.setQuality(s.quality, { dof: s.dof, bloom: s.bloom, shadows: s.shadows });
    Audio.enabled = s.sfx > 0; Audio.vol = s.sfx; Audio.music = s.music > 0; Audio.musicVol = s.music; Audio.vib = s.vib; Audio.apply();
    Game.settings.difficulty = s.diff; Game.settings.shake = s.shake; Game.settings.autoGas = s.autoGas;
    applyOrientation();
    if ($('#rotate')) checkRotate();
  }
  // Lock the screen sideways or upright. Browsers only allow it full screen or in the installed app,
  // so a refusal is quiet unless the player has just changed the setting.
  function applyOrientation(loud) {
    const o = Save.data.settings.orient, so = screen.orientation;
    if (!so || !so.lock) return;
    if (o === 'auto') { try { so.unlock(); } catch (e) { /* not locked */ } return; }
    so.lock(o).catch(() => { if (loud) UI.toast('Install the game to lock the screen, or use your phone\'s rotation lock'); });
  }
  UI.applyOrientation = applyOrientation;
  // Set to sideways but held upright (the lock isn't allowed in a browser tab, or on iPhone): ask the player to turn the phone.
  function checkRotate() {
    const el = $('#rotate'), want = Save.data.settings.orient === 'landscape' && UI.touch && window.innerHeight > window.innerWidth * 1.05;
    if (want && el.classList.contains('hidden')) {
      el.innerHTML = '<div class="rot-phone"></div><h2>Turn your phone sideways</h2><p class="muted small">Cursor Racing is made for playing sideways.</p><button class="btn small ghost" id="rot-up">Play upright instead</button>';
      el.classList.remove('hidden');
      $('#rot-up', el).addEventListener('click', () => { Save.data.settings.orient = 'portrait'; Save.save(); applyOrientation(); el.classList.add('hidden'); Audio.play('ui'); if (UI.screen === 'settings') renderSettings(); });
      if (UI.inRace && !Game.paused) pause();
    } else if (!want) el.classList.add('hidden');
  }
  UI.checkRotate = checkRotate;
  window.addEventListener('resize', () => setTimeout(checkRotate, 120));
  window.addEventListener('orientationchange', () => setTimeout(checkRotate, 300));
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
      Save.setBest(cfg.track, cfg.reversed, res.bestLap, res.total, cfg.laps || 3);
      const nb = Save.setTT(cfg.track, cfg.reversed, res.bestLap);
      if (res.ghost && nb) { Save.setGhost(cfg.track, cfg.reversed, { data: res.ghost.data, time: res.ghost.time, car: res.ghost.car }); }
      if (nb) { coins = 60 * PAY; notes.push('New best lap!'); }
      coins += 20 * PAY;
    } else if (cfg.mode === 'ko') {
      if (res.place === 1) { coins = 180 * PAY; d.stats.koWins++; d.stats.wins++; } else coins = (30 + me.points * 20) * PAY;
    } else {
      const m = cfg.cup != null ? 1 + cfg.cup * 0.25 : 0.6, N = res.order.length;
      coins = N === 4 ? Math.round(REWARD[res.place - 1] * m) : Math.round((N - res.place + 1) / N * (60 + N * 9) * Math.max(m, 0.8) + 10);
      coins *= PAY;
      if (res.place === 1) d.stats.wins++; if (res.place <= 3) d.stats.podiums++;
      if (Save.setBest(cfg.track, cfg.reversed, res.bestLap, res.total, cfg.laps || 3)) notes.push('New best lap!');
    }
    Save.addCoins(coins);
    if (cfg.cup != null) {
      const run = d.cupRun;
      res.order.forEach((o, i) => { run.pts[o.isPlayer ? 'You' : o.name] = (run.pts[o.isPlayer ? 'You' : o.name] || 0) + pointsFor(res.order.length, i); });
      run.grid = res.order.map((o) => (o.isPlayer ? 'You' : o.name)); // next race starts in this order
      run.race++; run.live = false; Save.save();
    }
    Audio.setMusic('menu');
    renderResults(cfg, res, coins, notes);
  }

  function renderResults(cfg, res, coins, notes) {
    const el = $('#scr-results'), me = res.order.find((o) => o.isPlayer);
    const ko = cfg.mode === 'ko', tt = cfg.mode === 'tt';
    const head = tt ? `<div class="bigplace">${U.fmtTime(res.bestLap)}</div><div class="reward">Best lap · total ${U.fmtTime(res.total)}</div>`
      : `<div class="bigplace">${U.ordinal(res.place)}</div><div class="reward">${ko ? (res.place === 1 ? 'Knockout champion!' : `You scored ${me.points}`) : (res.place === 1 ? 'Winner!' : res.place <= 3 ? 'Podium!' : res.place <= res.order.length / 2 ? 'Solid drive' : 'Keep at it')}</div>`;
    const rows = res.order.map((o, i) => `<tr class="${o.isPlayer ? 'me' : ''}"><td>${i + 1}</td><td><span class="chip" style="background:${o.paint}"></span>${o.name}</td><td class="muted small">${o.car}</td>
      <td class="num">${ko ? o.points + ' pts' : (o.est ? '~' : '') + U.fmtTime(o.time)}</td>${cfg.cup != null ? `<td class="num gold">${pointsFor(res.order.length, i) ? '+' + pointsFor(res.order.length, i) : ''}</td>` : ''}</tr>`).join('');
    // time trial: each lap, the fastest marked, and how it compares with your best before this run
    const lt = tt && Game.player ? Game.player.lapTimes : [], fast = Math.min(...lt), pb = Game.prevBest;
    const laps = lt.map((t, i) => `<tr class="${t === fast ? 'me' : ''}"><td>Lap ${i + 1}${i === 0 ? ' <span class="muted small">from the grid</span>' : ''}</td><td class="num">${U.fmtTime(t)}</td>
      <td class="num ${pb == null ? 'muted' : t < pb ? 'ahead' : 'behind'}">${pb == null ? '' : (t < pb ? '-' : '+') + Math.abs(t - pb).toFixed(2)}</td></tr>`).join('');
    const ttTable = `<h3 class="tt-track">${CR.TRACKS[cfg.track].name}${cfg.reversed ? ' (mirrored)' : ''}</h3><table class="table tt-laps"><tr><th>Lap</th><th class="num">Time</th><th class="num">${pb == null ? '' : 'vs best ' + U.fmtTime(pb)}</th></tr>${laps}</table>
      <p class="muted small" style="margin:8px 0 0">${res.ghost ? 'Your best lap is now the ghost for this track.' : pb == null ? '' : 'Beat your best lap and it becomes the ghost.'}</p>`;
    const cupNext = cfg.cup != null;
    el.innerHTML = `<div class="wrap res-wrap"><div class="panel res"><div class="r-head">${head}</div>
      <div class="r-main">${tt ? ttTable : `<table class="table"><tr><th>#</th><th>Driver</th><th>Car</th><th class="num">${ko ? 'Score' : 'Time'}</th>${cupNext ? '<th class="num">Pts</th>' : ''}</tr>${rows}</table>`}</div>
      <div class="r-foot"><p class="reward">${notes.join(' ')} +${coins} <span class="coin"></span></p>
      <div class="actions">${cupNext ? '<button class="btn primary" id="r-next">Standings</button>' : `<button class="btn primary" id="r-again">${tt ? 'Try again' : 'Race again'}</button><button class="btn" id="r-tracks">Tracks</button>`}<button class="btn ghost" id="r-menu">Menu</button></div></div>
    </div></div>`;
    show('results');
    if (cupNext) click($('#r-next', el), renderStandings);
    else { click($('#r-again', el), () => { const c = { ...UI.last }; if (c.mode === 'tt') { const g = Save.ghost(c.track, c.reversed); c.ghost = g && g.data; c.ghostCar = g && g.car; c.bestLap = Save.bestOf(c.track, c.reversed).tt; } startRace(c); }); click($('#r-tracks', el), () => renderTracks(cfg.quick || 'quick')); }
    click($('#r-menu', el), () => { if (cupNext) renderStandings(); else { Game.stop(); renderMenu(); } }, 'back');
    if (res.place === 1 && !tt) { Audio.play('win'); } else if (!tt && res.place === res.order.length) Audio.play('lose');
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
        coins = Math.round(cup.reward * PAY * [1, 0.6, 0.4][myPlace - 1]); d.stats.cups += myPlace === 1 ? 1 : 0;
        const next = CR.CUPS[ci + 1];
        if (next && !Save.cupUnlocked(next.id)) { d.cups[next.id] = { unlocked: true, best: 0 }; gifts.push(`${next.name} unlocked`); if (next.id === 'mirror') gifts.push('Mirror tracks open in Quick Race'); }
        if (myPlace === 1 && cup.unlock && !d.owned[cup.unlock]) { d.owned[cup.unlock] = true; gifts.push(`New car: ${CR.CARS.find((c) => c.id === cup.unlock).name}`); }
      }
      Save.addCoins(coins); d.cupRun = null; Save.save();
      extra = `<div class="reward">${myPlace <= 3 ? `<span class="trophy g${myPlace}"></span>${['Gold', 'Silver', 'Bronze'][myPlace - 1]} trophy! +${coins} <span class="coin"></span>` : 'Off the podium. Try the cup again.'}</div>${gifts.map((g) => `<div class="reward" style="color:var(--cyan)">${g}</div>`).join('')}`;
      if (myPlace === 1) Audio.play('win');
    }
    el.innerHTML = `<div class="wrap res-wrap"><div class="panel res"><div class="r-head"><h2>${cup.name} · ${done ? 'Final standings' : `after race ${run.race} of 3`}</h2>
      ${done ? `<div class="bigplace">${U.ordinal(myPlace)}</div>` : ''}${extra}</div>
      <div class="r-main"><table class="table"><tr><th>#</th><th>Driver</th><th class="num">Points</th></tr>${list.map(([n, p], i) => `<tr class="${n === 'You' ? 'me' : ''}"><td>${i + 1}</td><td>${n}</td><td class="num">${p}</td></tr>`).join('')}</table></div>
      <div class="r-foot">${!done && run.grid ? `<p class="muted small" style="text-align:center;margin:10px 0 0">Starting grid follows the last result: you line up ${U.ordinal(run.grid.indexOf('You') + 1)} of ${run.grid.length}.</p>` : ''}
      <div class="actions">${done ? '<button class="btn primary" id="st-cups">Cups</button>' : `<button class="btn primary" id="st-next">Next: ${CR.TRACKS[cup.races[run.race][0]].name}${cup.races[run.race][1] ? ' R' : ''}</button>`}<button class="btn ghost" id="st-menu">Menu</button></div></div></div></div>`;
    show('standings');
    if (done) click($('#st-cups', el), () => { Game.stop(); renderCups(); }); else click($('#st-next', el), continueCup);
    click($('#st-menu', el), () => { Game.stop(); renderMenu(); }, 'back');
  }

  // ---------------------------------------------------------------------------
  // HUD
  const H = {};
  function buildHUD(cfg) {
    const el = $('#scr-hud'), s = Save.data.settings;
    const ko = cfg.mode === 'ko', tt = cfg.mode === 'tt';
    el.innerHTML = `<div class="touch" id="touch"></div>
      <div class="hud-top">
        <div class="hud-box">${ko ? '<div class="ko-pips" id="h-ko"></div>' : tt ? `<div class="hud-gap" id="h-gap"><small>GHOST</small><span>--</span></div><div class="hud-lap" id="h-lap">LAP 1/3</div>` : `<div class="hud-pos" id="h-pos">1<sup>st</sup><small>/4</small></div><div class="hud-lap" id="h-lap">LAP 1/3</div>`}<div class="hud-time" id="h-time">0:00.00</div>${tt ? '<div class="hud-time" id="h-best"></div>' : ''}
          <div class="boostbar" id="h-bb"><i id="h-boost"></i></div></div>
        ${cfg.items && !UI.touch ? '<div class="hud-item" id="h-item" role="button" aria-label="Use item"></div>' : ''}
        <span class="spacer"></span><canvas class="minimap" id="h-map"></canvas><div class="hud-pause" id="h-pause" role="button" aria-label="Pause"></div>
      </div>
      <div class="hud-board" id="h-board"></div>
      <div class="hud-song" id="h-song">&#9834; ${Audio.songName(CR.TRACKS[cfg.track].theme)}</div>
      ${cfg.tutorial ? '<div class="hud-coach" id="h-coach"></div>' : ''}
      <div class="hud-msg" id="h-msg"></div>`;
    H.coach = $('#h-coach', el);
    H.item = $('#h-item', el); H.board = $('#h-board', el);
    if (H.item) H.item.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (Game.player) CR.Extras.use(Game.player); });
    H.pos = $('#h-pos', el); H.lap = $('#h-lap', el); H.time = $('#h-time', el); H.boost = $('#h-boost', el); H.bb = $('#h-bb', el); H.msg = $('#h-msg', el); H.ko = $('#h-ko', el); H.gap = $('#h-gap span', el); H.gapBox = $('#h-gap', el); H.best = $('#h-best', el);
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
    if (UI.lesson) { lessonTick(); if (!UI.inRace) return; }
    if (H.pos) {
      const order = Game.standings(), place = order.indexOf(p) + 1;
      if (c.place !== place) { c.place = place; H.pos.innerHTML = `${place}<sup>${U.ordinal(place).slice(-2)}</sup><small>/${Game.cars.length}</small>`; }
      const lap = Math.min(Game.laps, Math.max(1, p.lap + 1));
      if (c.lap !== lap) { c.lap = lap; H.lap.textContent = UI.lesson ? 'DRIVING LESSON' : `LAP ${lap}/${Game.laps}`; }
    }
    if (H.gap) {
      const lap = Math.min(Game.laps, Math.max(1, p.lap + 1));
      if (c.lap !== lap) { c.lap = lap; H.lap.textContent = `LAP ${lap}/${Game.laps}`; }
      const g = Game.ghostGap(), txt = g == null ? (Game.ghost ? '--' : 'none yet') : (g > 0 ? '+' : '-') + Math.abs(g).toFixed(2);
      const kind = g == null ? '' : g > 0.005 ? 'behind' : 'ahead';
      if (c.gap !== txt) { c.gap = txt; H.gap.textContent = txt; H.gapBox.className = 'hud-gap ' + kind; }
      const bl = Game.opts.bestLap, bt = bl == null ? 'BEST --' : 'BEST ' + U.fmtTime(bl);
      if (c.best !== bt) { c.best = bt; H.best.textContent = bt; }
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
    // touch screens: the ITEM button shows what you're holding; otherwise a slot in the top-left does
    if (Game.items) { const it = p.item || ''; if (c.item !== it) { c.item = it; const icon = it ? CR.Extras.ITEMS[it].icon : '';
      if (H.item) { H.item.innerHTML = icon; H.item.classList.toggle('full', !!it); }
      if (H.itemBtn) { H.itemBtn.innerHTML = icon || 'ITEM'; H.itemBtn.classList.toggle('full', !!it); } } }
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
    const gh = Game.ghost;
    if (gh && gh.on) { x.strokeStyle = '#3ff0ff'; x.lineWidth = 2; x.setLineDash([2, 2]); x.beginPath(); x.arc(gh.x * s, gh.y * s, 4, 0, 6.28); x.stroke(); x.setLineDash([]); }
  };

  // ---------------------------------------------------------------------------
  // input: keyboard + touch + gamepad -> Game.input
  const keys = new Set();
  window.addEventListener('keydown', (e) => {
    if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return; // typing in the shop search
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    keys.add(e.key.toLowerCase());
    if ((e.key === 'Escape' || e.key === 'p') && UI.inRace) { if (Game.paused) resume(); else pause(); }
    if (e.key.toLowerCase() === 'r' && UI.inRace && !Game.paused && !e.repeat) Game.rescue();
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
    } else if (s.controls === 'fixed') {
      // a joystick that always sits in the bottom-left corner; a touch near it grabs it
      const base = document.createElement('div'); base.className = 'stick-base fixed'; base.innerHTML = '<div class="stick-knob"></div><span>DRIVE</span>'; layer.appendChild(base);
      if (UI.stickUsed) base.classList.add('used');
      const knob = base.firstChild; let cx = 0, cy = 0;
      const set = (e) => {
        const dx = e.clientX - cx, dy = e.clientY - cy, max = 50, ll = Math.min(max, Math.hypot(dx, dy)), a = Math.atan2(dy, dx);
        knob.style.transform = `translate(${Math.cos(a) * ll}px, ${Math.sin(a) * ll}px)`;
        T.stick.mag = ll / max; T.stick.on = ll > 8; T.stick.x = Math.cos(a); T.stick.y = Math.sin(a);
      };
      layer.addEventListener('pointerdown', (e) => {
        if (e.target !== layer || T.stick.id != null) return;
        const r = base.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
        if (Math.hypot(e.clientX - cx, e.clientY - cy) > 150 && e.clientX > window.innerWidth * 0.45) return;
        e.preventDefault(); Audio.init(); layer.setPointerCapture(e.pointerId);
        T.stick.id = e.pointerId; base.classList.add('on', 'used'); UI.stickUsed = true; set(e);
      });
      layer.addEventListener('pointermove', (e) => { if (e.pointerId === T.stick.id) set(e); });
      const end = (e) => { if (e.pointerId !== T.stick.id) return; T.stick.id = null; T.stick.on = false; T.stick.mag = 0; knob.style.transform = ''; base.classList.remove('on'); };
      layer.addEventListener('pointerup', end); layer.addEventListener('pointercancel', end);
    } else {
      const base = document.createElement('div'); base.className = 'stick-base'; base.innerHTML = '<div class="stick-knob"></div>'; layer.appendChild(base);
      const hint = document.createElement('div'); hint.className = 'stick-hint'; hint.textContent = 'Touch & point to drive'; layer.appendChild(hint);
      const knob = base.firstChild; let ox = 0, oy = 0;
      layer.addEventListener('pointerdown', (e) => {
        if (e.target !== layer || T.stick.id != null || e.clientX > window.innerWidth * 0.62 || e.clientX < 28) return; // not at the very edge: that's the phone's back gesture
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
      if (gp.buttons[8] && gp.buttons[8].pressed && !UI.padBack && UI.inRace && !Game.paused) { UI.padBack = true; Game.rescue(); }
      if (gp.buttons[8] && !gp.buttons[8].pressed) UI.padBack = false;
    }
    I.steer = U.clamp(steer, -1, 1); I.throttle = thr; I.brake = brk; I.boost = boost; I.item = item;
    I.stick = T.stick.on ? T.stick : null;
  };

  // ---------------------------------------------------------------------------
  function pause() {
    if (!UI.inRace || Game.paused || !Game.on) return;
    Game.paused = true; Audio.engine(0, 0, false, false); Audio.skid(0);
    const cupRace = !!(UI.last && UI.last.cup != null && Save.data.cupRun), left = cupRace ? retriesLeft(Save.data.cupRun) : 0;
    modal(`<h2>Paused</h2>${cupRace ? `<p class="muted small">Cup race: ${left} ${left === 1 ? 'retry' : 'retries'} left. Restarting, or quitting and coming back, uses one.${left ? '' : ' With none left, quitting forfeits this race.'}</p>` : ''}
      <div class="actions" style="flex-direction:column"><button class="btn primary" id="p-res">Resume</button><button class="btn" id="p-rst" ${cupRace && !left ? 'disabled' : ''}>Restart${cupRace ? ` (${left} left)` : ''}</button><button class="btn" id="p-back">Back to track</button><button class="btn" id="p-help">How to drive</button><button class="btn ghost" id="p-quit">${cupRace && !left ? 'Forfeit race' : 'Quit to menu'}</button></div>`, (m) => {
      click($('#p-res', m), resume);
      click($('#p-back', m), () => { resume(); Game.rescue(); });
      click($('#p-rst', m), () => { closeModal(); Game.paused = false; if (UI.lesson) startTutorial(); else if (cupRace) continueCup(); else startRace({ ...UI.last }); });
      // the help box replaces this one; closing it brings the pause menu back
      click($('#p-help', m), () => { help(); const ok = $('#m-ok'); if (ok) ok.addEventListener('click', () => { Game.paused = false; pause(); }); });
      click($('#p-quit', m), () => {
        closeModal(); UI.inRace = false; UI.lesson = null; teardownTouch(); Game.stop(); Audio.setMusic('menu');
        if (cupRace && !left) { forfeitCupRace(); renderStandings(); } else renderMenu();
      }, 'back');
    });
  }
  function resume() { closeModal(); Game.paused = false; }
  UI.pause = pause;

  UI.renderTitle = renderTitle; UI.renderMenu = renderMenu; UI.show = show; UI.startRace = startRace; UI.startTutorial = startTutorial; UI.renderGarage = renderGarage; UI.renderShop = renderShop; UI.renderRecords = renderRecords; UI.renderCupRun = renderCupRun; UI.renderTracks = renderTracks; UI.renderCups = renderCups; UI.renderSettings = renderSettings;
  // ---------------------------------------------------------------------------
  // Back gestures. On phones a swipe from the screen edge (Android) or the browser's swipe-back (iPhone)
  // means "go back", and for a one-page game that means leaving it. So the page keeps one extra history
  // entry on top: a back gesture lands on the entry below, fires popstate, and the game handles it here
  // (pause the race, close a box, go up a screen) and puts the entry back. On the main menu a second back
  // within a couple of seconds is let through, so the game can still be closed that way.
  // Browsers only keep entries added after a tap, so the entry is (re)added on taps and key presses.
  const onTrap = () => !!(history.state && history.state.cr);
  function trap() { if (!onTrap()) { try { history.pushState({ cr: 1 }, ''); } catch (e) { /* not allowed here */ } } }
  ['pointerup', 'keydown'].forEach((t) => window.addEventListener(t, trap, true));
  window.addEventListener('popstate', () => { if (handleBack()) trap(); });
  function handleBack() {
    if (!$('#rotate').classList.contains('hidden')) return true;
    if (!$('#modal').classList.contains('hidden')) { if (!(UI.inRace && Game.paused)) { closeModal(); Audio.play('back'); } return true; }
    if (UI.inRace) { pause(); return true; }
    if (UI.screen === 'menu' || UI.screen === 'title') {
      if (UI.exitArm && Date.now() - UI.exitArm < 2500) { UI.exitArm = 0; try { history.back(); } catch (e) { /* first entry */ } return false; }
      UI.exitArm = Date.now(); UI.toast('Swipe back again to close the game'); return true;
    }
    const scr = $('#scr-' + UI.screen), b = scr && (scr.querySelector('.topbar [data-go]') || scr.querySelector('#r-menu, #st-menu'));
    if (b) b.click(); else renderMenu();
    return true;
  }

  UI.isSafe = () => !UI.inRace && ['title', 'menu', 'results', 'standings', 'cups', 'tracks', 'garage', 'shop', 'records', 'settings'].includes(UI.screen);
  CR.UI = UI;
})(window.CR);
