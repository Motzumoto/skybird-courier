// Hand-in program for Skybird Courier (Node 22.18+, standard library only).
//
// The playable game is this repository's game/ directory: static files, an ES module tree behind
// game/index.html, three.js vendored under game/vendor. Nothing is installed before this runs and
// nothing is fetched. What this program does is mechanical and the same twice:
//   1. refuse early if the files the scorer needs are missing, so a hand-in never half-writes;
//   2. copy game/ and the four screenshots beside it into the output directory;
//   3. write dossier.json with the kit's buildDossier, under the scorer's own caps.
// MAKEFUN_OUTPUT_DIR stands in for the grader's /output when run by hand.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const gameDir = join(here, 'game');
const screensDir = join(here, 'screenshots');

if (!existsSync(join(gameDir, 'index.html'))) {
  throw new Error('game/index.html is missing: the game is not in this checkout');
}
const screens = existsSync(screensDir)
  ? readdirSync(screensDir).filter((name) => /\.(jpe?g|png)$/i.test(name) && !name.startsWith('.'))
  : [];
if (screens.length < 3 || screens.length > 4) {
  throw new Error(`screenshots/ must hold 3 or 4 images, it holds ${screens.length}`);
}

mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
rmSync(join(out, 'screenshots'), { recursive: true, force: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(screensDir, join(out, 'screenshots'), { recursive: true });

// The scorer's caps, so a file over one is refused here with the reason, not on the server:
// 160 KiB of dossier text, four screenshots of at most 256 KiB, 993 game files and 48 MiB in all.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`handed in game/ (${readdirSync(join(out, 'game')).length} entries) and ${screens.length} screenshots`);
