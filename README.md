# skybird-courier

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Motzumoto/skybird-courier/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Motzumoto/skybird-courier/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

**Skybird Courier** — an open-world-ish bush-flying game over the Armada Isles, a small volcanic
archipelago of its own. You fly a floatplane courier for the island mail: gate to gate across the
channels, over the caldera rim under flak, then down onto a lamp-lit strip before the light goes.
Keyboard and mouse, three sortie types, fuel and airframe damage, a working instrument panel with a
minimap, day-one save of your logbook, all in the browser with no build step and no network.

The game is `game/` and opens from `game/index.html`. Everything it draws is its own: the islands,
the aircraft, the livery, the names, the sound. three.js is vendored under `game/vendor/` as its
minified module build.

## Run it

```sh
node serve.ts          # serves game/ and opens http://localhost:8080
```

Or serve `game/` with any static file server and open `index.html` in desktop Chrome.

Hand in (Node 22.18+; the program copies `game/` and `screenshots/` into `/output` and writes the
dossier the judge reads):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Controls

| key | action |
| --- | --- |
| `W` / `S` | pitch down / up |
| `A` / `D` | roll left / right |
| `Q` / `E` | rudder |
| `Shift` / `Ctrl` | throttle up / down |
| `F` | flaps |
| `C` | chase / cockpit camera |
| `H` | hide the HUD |
| `P` | pause · `R` restart |

## Sorties

- **Mail run** — carry the satchel across the channel, take every gate, land under the lamp.
- **Caldera survey** — hold a low pass below 90 m over the rim of Caldeira Preta, twice, and come home.
- **Medevac** — reach the climber on Serra Alta, fly the ridge gate, set the floats down gently.

Stall it and the nose drops; land hard and the floats fold; run the tanks dry and the engine quits.
The logbook keeps your sorties and your best run.

## What is in the world

- A seeded heightfield builds six islands — jungle shelves, basalt cliffs, a breached caldera — and
  carves two levelled airstrips into the ground with threshold masts, edge lamps, PAPI bars, a tower,
  hangars and a windsock, so a landing is a lit target rather than a flat plate.
- Palm groves and tin-roofed fishing hamlets are scattered on the low ground and drawn as two
  instanced meshes; lighthouses stand on the outer rocks and sweep their beams over the water.
- Golden-hour sky with a long warm horizon, a sun glitter path on the sea, cloud banks over the
  caldera, fog and a lens streak; the sea itself is a wave-displaced surface.
- Gate courses are seeded per sortie and only the next gate is lit; the mission panel carries the
  gate count, the bearing to the next ring and a navline, with a minimap of the islands beside it.
- Flak blooms in puffs along the caldera approach and thins the airframe; damage trails smoke and
  bleeds power, and the HUD tapes creep down with it.
- Birds over the channels and fishing boats in the shallows keep the archipelago moving.

## Screenshots

The four images are not hand-placed: `game/src/shots.js` flies the game's own course to a gate or a
runway and poses the camera there, and `tools/shoot.mjs` renders each pose in headless Chromium at
1280x720, so the shots come out of the shipping code. `tools/playtest.mjs` is a headless play-through
that flies a sortie with real key events and reports the state and any console errors.

## Layout

```
game/index.html          shell, import map, HUD markup
game/ui/hud.css          panel styling
game/src/config.js       every tuning number
game/src/main.js         boot, loop, sortie rules
game/src/input.js        keyboard state
game/src/aircraft/       airframe mesh and the flight model
game/src/terrain/        island heightfield and its meshes, airstrips, lamps
game/src/render/         renderer, sky, sun, cameras
game/src/game/           gates, missions, birds and boats, ridge flak
game/src/ui/             instruments, minimap, screens
game/src/audio/          synthesised engine, wind, chime, impact
game/src/save/           logbook in local storage
game/src/shots.js        the four screenshot poses
game/vendor/             three.js, minified module build
vendor/makefun-game.ts   the kit's dossier library, unchanged
```

MIT licensed. Built by an AI agent for make.fun's “Make the best flight game” bounty, $500 in USDC.
