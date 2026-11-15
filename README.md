# Cursor Racing

A top-down toy-car racer with a **pixel-art diorama** look: chunky voxel cars and pixel-art sprites on a lit
3D tabletop, with real-time shadows, bloom, a tilt-shift "miniature" blur, vignette and colour grading.
Race tiny cars across 12 tabletops (24 courses counting mirrored versions): a kitchen table, a study
desk, a backyard sandbox, a pool table, a bathroom counter, a bedroom at night, a garage workbench, a
gaming desk, a baking counter, a frosty windowsill, a picnic blanket and a model railway town. Drive off the edge and you drop to the floor.

Installable **Progressive Web App** with offline play and automatic updates. No build step and
no dependencies: open `index.html` or serve the folder.

## Play locally

Double-click `index.html` to play straight from disk. Install, offline and auto-update only work
over `http://localhost` or HTTPS, so to test those run a local server:

```bash
npx serve .            # or: python3 -m http.server 8080
```

Needs a browser with WebGL 2 (current Chrome, Safari 15+, Edge, Firefox).

## Controls

- **Touch, Stick mode (default):** put your thumb anywhere on the left side and point it where you
  want to go. The car turns that way and drives. **BOOST** and **BRAKE** are on the right.
- **Touch, Buttons mode:** left/right buttons, optional auto-accelerate (Settings).
- **Keyboard:** arrows or WASD, Space/Shift to boost, Esc or P to pause.
- **Gamepad:** left stick steers, A or RT accelerates, B or LT brakes, X or RB boosts, Start pauses.

Brake while turning at speed to drift. Drifting fills the boost meter. Chevron pads give a free boost.

## Modes

- **Championship:** seven cups of three races (points 10/6/3/1): Rookie, Pro, Workshop, Mirror,
  Grand Tour, Champion and Legend. A podium opens the next cup, and winning some cups gives you a new
  car. Mirror, Champion and Legend run tracks in reverse; once the Mirror Cup is open, every open track
  can also be raced mirrored in Quick Race, Time Trial and Knockout.
- **Quick Race:** any open track, 1/3/5 laps, three random rivals.
- **Time Trial:** solo, races against a ghost of your best lap (saved per track).
- **Knockout:** the camera follows the leader. Anyone who falls off the screen (or off the table)
  is out of the round. Last car standing scores a point, first to 4 wins.
- **Garage:** 6 cars (Zip, Dune Buggy, Bolt GT, Brick, Formula, Hover), 10 paint colours,
  and Engine / Tyres / Turbo upgrades (5 levels each) bought with coins from races.

Settings: control scheme, difficulty, graphics quality (Low/Med/High), tilt-shift, bloom, shadows,
screen shake, vibration, sound and music volume, update check, reset progress. If the game runs
slowly on first launch it lowers the graphics quality once on its own.

Progress is saved in `localStorage`.

## Deploy to GitHub Pages

1. Push this folder to a GitHub repository (the files at the repo root).
2. Repo **Settings > Pages > Build and deployment > Deploy from a branch**, pick `main` and `/ (root)`.
3. Open `https://<you>.github.io/<repo>/`. All paths are relative, so a project sub-path works.

`.nojekyll` is included so Pages serves the files untouched.

## Shipping updates (auto-update)

1. Make your changes.
2. Run `node tools/bump-version.mjs` (or edit `VERSION` in `sw.js`). **The version must change**
   or installed apps won't notice the update.
3. If you added new files, add them to the `ASSETS` list in `sw.js`.
4. Push. Installed copies check for updates on launch, when brought back to the foreground and every
   20 minutes. The new version downloads in the background and is applied the next time the player
   is on a menu (never mid-race). Settings has a manual "Check for updates" button.

## Adding or tuning tracks

Tracks live in `js/tracks.js`. Each one is a closed loop of points on a table `W x H`, plus:

- `start`: optional `[x, y]` for the start line (otherwise the straightest stretch is used),
- `zones`: puddles (`slick`) and goo (`sticky`) at a lap fraction `t`, lateral offset and size,
- `ramps`, `boosts`: placed by lap fraction,
- `pieces`: big props at fixed spots (they are skipped, with a console warning, if they'd sit on the road),
- `balls`: pushable pool balls.

Themes (same file) set the table painting, track paint, border props, scattered props and sprites,
whether the edge is a drop (`void`) or a wall, and the lighting preset.

## Project layout

```
index.html              app shell
manifest.webmanifest    PWA manifest
sw.js                   service worker (offline cache + updates)
css/style.css           UI styles
js/util.js              namespace, maths, matrices
js/gl.js                WebGL helpers, mesh builder, voxel mesher (with ambient occlusion)
js/models.js            voxel cars and props, pixel sprite atlas, menu car icons
js/tracks.js            lighting presets, themes, tracks, cups, cars, rivals
js/world.js             track centreline, surfaces, colliders, painted table, static geometry
js/render.js            renderer: shadows, point lights, bloom, tilt-shift, grading
js/game.js              physics, AI, laps, knockout, ghosts, particles, camera
js/audio.js             Web Audio synth effects, engine sound and music
js/save.js              save data and economy
js/ui.js                menus, garage, results, HUD, touch/keyboard/gamepad input
js/main.js              boot, game loop, install + update handling
icons/                  app icons
tools/                  version bump script, icon generator
```

## License

MIT, see `LICENSE`. Third-party notices: see `CREDITS.md` (there are none).
