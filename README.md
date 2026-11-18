# Cursor Racing

A top-down toy-car racer with a **pixel-art diorama** look: chunky voxel cars and pixel-art sprites on a lit
3D tabletop, with real-time shadows, bloom, a tilt-shift "miniature" blur, vignette and colour grading.
Race tiny cars on 15 tracks (30 courses counting mirrored versions): a kitchen table, a study
desk, a backyard sandbox, a pool table, a bathroom counter, a bedroom at night, a garage workbench, a
gaming desk, a baking counter, a frosty windowsill, a picnic blanket and a model railway town. Three
of the tables have a second layout: Lucky Clover (four big loops round a central roundabout), Pretzel
Twist (hairpin after hairpin) and Night Oval (a wide, fast oval for big fields). Drive off the edge and you drop to the floor.

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

- **Touch, Stick (default):** a joystick in the bottom-left corner. Push it toward where you want to
  go; the car turns that way and drives. **BOOST** and **BRAKE** are on the right.
- **Touch, Float:** put your thumb anywhere on the left side and point; the stick appears under it.
- **Touch, Buttons:** left/right buttons, optional auto-accelerate (Settings).
- **Keyboard:** arrows or WASD, Space/Shift to boost, Esc or P to pause.
- **Gamepad:** left stick steers, A or RT accelerates, B or LT brakes, X or RB boosts, Start pauses.

Brake while turning at speed to drift. Drifting fills the boost meter. Chevron pads give a free boost.
Tuck in behind another car to slipstream (a little extra speed, and the boost meter charges). Press the
gas in the last half-second of the countdown for a perfect start; press it too early and you stall.
Use a power-up with **ITEM** on touch, E or Q on a keyboard, Y or LB on a gamepad.
Small clutter beside the road (cereal, pebbles, nuts, keycaps, chocolate chips, snow, grapes and the
like) can be driven over: it just slows you down, so you can drive yourself back onto the road. Long
barriers (pencils, glow sticks), trees, big props and table walls are solid. If you land a jump on the
far side of a solid barrier you're put back on the road straight away, and a car stuck off the road is
put back after 3 seconds. **Back to track** in the pause menu (R, or Select on a gamepad)
does it on demand.

## Modes

- **Driving Lesson:** a short guided race that teaches steering, drifting, boost and power-ups one
  step at a time. Offered on first launch, pays 100 coins the first time, replayable from the menu.
- **Championship:** eight cups of three races: Rookie, Pro, Workshop, Mirror, Grand Tour, Twister, Champion
  and Legend. Finish a cup on the podium to open the next one; winning some cups gives you a new car.
  Mirror, Champion and Legend run tracks in reverse. Options on the cup screen: field of 4, 8, 12 or
  20 cars, 2/3/5 laps, power-ups on or off. Points are 10/6/3/1 with four cars, and
  25/18/15/12/10/8/6/4/2/1 for the top ten in bigger fields. Once the Mirror Cup is open, every open
  track can also be raced mirrored in Quick Race, Time Trial and Knockout. Each race after the first
  starts in the previous race's finishing order. A cup gives you three retries: restarting a race, or
  quitting and coming back, uses one, and with none left the race is forfeited (scored as last place).
  While a cup is running, the Championship button shows its standings with Continue, Restart cup and
  Abandon cup.
- **Quick Race:** any open track, 1 to 9 laps, **1 to 19 rivals** (a full 20-car grid), power-ups on or off.
- **Time Trial:** solo, races against a ghost of your best lap (saved per track).
- **Knockout:** the camera follows the leader. Anyone who falls off the screen (or off the table)
  is out of the round. Last car standing scores a point, first to 4 wins. 3 to 7 rivals, power-ups optional.
- **Garage:** the cars you own. Pick one to drive, repaint it (10 colours) and buy Engine / Tyres /
  Turbo upgrades (5 levels each) with coins from races.
- **Car Shop:** 64 cars to collect, from the Zip hatchback, Monster truck and Toy Tank to a shark, a
  dragon, a burger, a pencil and a jet. Search by name or description, sort by price, top speed,
  acceleration, grip or weight, and filter (can afford, off-road, floats, jumpers, fast boost, heavy,
  light). Each car has its own stats and some have a trick. A few cars are also cup prizes.
- **Records:** career stats, a trophy for each cup, and best lap and race times for every track.
- **Save backup:** Settings has Back up save (a code to copy) and Restore save (paste it back, on any
  device). Time Trial ghosts are not included.
- **Developer options:** at the bottom of Settings, for testing: add 10,000 coins, unlock all cars,
  open all cups, reset the driving lesson. Remove the `details.dev` block in `js/ui.js` to hide them.
- **Obstacles toggle:** Quick Race, Knockout and the Championship each have an Obstacles switch. Off
  gives a clear road: no moving hazards, bumpers, springs, jump gaps, spills or loose pool balls.
  Ramps and boost pads stay. Time Trial always runs with obstacles so best laps stay comparable.

## Hazards and power-ups

- **Road hazards:** puddles and goo, swinging sweeper arms, things that slide across the road (a robot
  vacuum, a rubber duck, a mouse, a rolling pin, a ladybug, a toy train at a level crossing), pinball
  bumpers that fling you, spring pads that launch you, and jump gaps where you need speed off the ramp.
- **Power-ups** (Quick Race, Knockout, and the Championship if you switch them on): drive through the rainbow boxes.
  Turbo, Oil slick (dropped behind you), Shield (6 seconds, bumps and hits bounce off), Shockwave
  (blasts nearby cars away) and Marble (fired ahead, bounces off walls). Cars further back get better items.

## Music

Every table has its own song, all synthesized live by a small step sequencer in `js/audio.js` (like
Ember Grid's rival themes): surf rock in the sandbox, lounge jazz on the pool table, chiptune on the
gaming desk, a polka at the bakery, a parade in Tiny Town, and more. The final lap kicks the song up a
gear. Songs live in the `SONGS` table: tempo, key, chord progression and per-step patterns.

Settings: control scheme, screen orientation (Auto, or locked Sideways or Upright: locking works in
the installed app on Android; on iPhone use the phone's rotation lock), difficulty (Easy by default), graphics quality (Low/Med/High), tilt-shift, bloom, shadows,
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

## Tuning the economy

Two numbers set how long the collection takes: `PRICE_SCALE` in `js/tracks.js` scales every car's
price, and `PAY` in `js/ui.js` multiplies every race and cup payout. `CUP_RETRIES` (also `js/ui.js`)
is the number of restarts allowed per cup.

## Adding or tuning tracks

Tracks live in `js/tracks.js`. Each one is a closed loop of points on a table `W x H`, plus:

- `start`: optional `[x, y]` for the start line (otherwise the straightest stretch is used),
- `zones`: puddles (`slick`) and goo (`sticky`) at a lap fraction `t`, lateral offset and size,
- `ramps`, `boosts`: placed by lap fraction,
- in a theme's `border`, `hard: true` makes small border props solid instead of drive-over,
- `pieces`: big props at fixed spots (they are skipped, with a console warning, if they'd sit on the road),
- `balls`: pushable pool balls.
- `cross: true`: set this when the road crosses itself, so the other stretch counts as road at the crossing.
- `hazards`: `sweeper` (swinging arm from one side), `shuttle` (something sliding across the road; a `train` look gets a level crossing), `bumper`, `spring`,
- a ramp with `gap: <length>` gets a drop just past it; cars respawn on the far side.

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
js/extras.js            moving hazards, bumpers, springs, gaps, power-ups, slipstream, launch starts
js/audio.js             Web Audio synth effects, engine sound and the per-table songs
js/save.js              save data and economy
js/ui.js                menus, garage, results, HUD, touch/keyboard/gamepad input
js/main.js              boot, game loop, install + update handling
icons/                  app icons
tools/                  version bump script, icon generator
```

## License

MIT, see `LICENSE`. Third-party notices: see `CREDITS.md` (there are none).
