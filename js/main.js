// Cursor Racing — boot, main loop, PWA install + automatic updates.
(function (CR) {
  'use strict';
  const { Save, R, Game, UI, Audio } = CR;

  Save.load();
  CR.atlas = CR.buildAtlas();
  const cv = document.getElementById('cv');
  if (!R.init(cv)) {
    document.getElementById('scr-title').innerHTML = '<div class="panel" style="max-width:420px;margin:20vh auto;text-align:center"><h2>WebGL 2 needed</h2><p class="muted">This browser or device can\'t run the 3D renderer. Try an up-to-date Chrome, Safari, Edge or Firefox.</p></div>';
    document.getElementById('scr-title').classList.add('active');
    return;
  }
  UI.touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  UI.applySettings();
  UI.renderTitle();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (UI.inRace) UI.pause(); Audio.suspend(); } else Audio.resume();
  });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  let last = performance.now(), slow = 0, frames = 0;
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    try {
      if (UI.inRace) UI.pollInput();
      Game.update(dt);
      Game.render();
      if (UI.inRace) UI.hudFrame();
    } catch (e) { console.error(e); }
    // auto-lower quality if we are clearly too slow (first time only)
    frames++;
    if (dt > 0.034) slow++;
    if (frames === 240) { if (slow > 150 && !Save.data.settings.autoLowered && Save.data.settings.quality !== 'low') { Save.data.settings.quality = Save.data.settings.quality === 'high' ? 'medium' : 'low'; Save.data.settings.autoLowered = true; Save.save(); UI.applySettings(); UI.toast('Graphics lowered for smoother racing (Settings)'); } }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ---------------------------------------------------------------------------
  // Install prompt (Android / desktop Chromium). iOS gets instructions.
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); UI.install = e; if (UI.screen === 'menu') UI.renderMenu(); });
  window.addEventListener('appinstalled', () => { UI.install = null; UI.toast('Installed! Launch Cursor Racing from your home screen.'); });
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  UI.iosHint = /iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone;

  // ---------------------------------------------------------------------------
  // Service worker: offline cache + automatic updates. A new version (bumped VERSION in sw.js)
  // downloads in the background and is applied the next time you're on a menu, never mid-race.
  if (sessionStorage.getItem('cr-updated')) { sessionStorage.removeItem('cr-updated'); setTimeout(() => UI.toast(`Updated to v${UI.version}`), 900); }
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    let pending = null, reloading = false;
    const askVersion = (sw) => new Promise((res) => {
      if (!sw) return res(null);
      const ch = new MessageChannel(); ch.port1.onmessage = (e) => res(e.data && e.data.version);
      sw.postMessage({ type: 'VERSION' }, [ch.port2]); setTimeout(() => res(null), 1500);
    });
    const banner = document.getElementById('update');
    const tryApply = () => {
      if (!pending) return;
      if (UI.isSafe()) { banner.classList.add('hidden'); pending.postMessage({ type: 'SKIP_WAITING' }); pending = null; }
      else if (!UI.inRace) {
        banner.innerHTML = '<span>Update ready</span><button class="btn small primary" id="upd-now">Restart</button>';
        banner.classList.remove('hidden');
        document.getElementById('upd-now').onclick = () => { if (pending) { pending.postMessage({ type: 'SKIP_WAITING' }); pending = null; banner.classList.add('hidden'); } };
      }
    };
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading || !hadController) return; reloading = true;
      sessionStorage.setItem('cr-updated', '1'); location.reload();
    });
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
        const v = await askVersion(reg.active || navigator.serviceWorker.controller || (await navigator.serviceWorker.ready).active);
        if (v) { UI.version = v; document.querySelectorAll('.ver').forEach((el) => (el.textContent = 'v' + v)); }
        const watch = (w) => w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) { pending = w; tryApply(); } });
        if (reg.waiting && navigator.serviceWorker.controller) { pending = reg.waiting; tryApply(); }
        watch(reg.installing);
        reg.addEventListener('updatefound', () => watch(reg.installing));
        const check = () => reg.update().catch(() => {});
        setInterval(check, 20 * 60 * 1000);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
        setInterval(tryApply, 1500);
        UI.checkUpdate = async (manual) => {
          await check();
          setTimeout(() => { if (reg.installing || reg.waiting || pending) UI.toast('Downloading update...'); else if (manual) UI.toast(`You're on the latest version (v${UI.version})`); }, 900);
        };
      } catch (e) { console.warn('Service worker registration failed', e); }
    });
  }
  window.CursorRacing = CR;
})(window.CR);
