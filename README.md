# Porto Verde — an open-world crime game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/nganunganu275/gta6-01-recorded/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/nganunganu275/gta6-01-recorded/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js 22](https://img.shields.io/badge/Node-22-green.svg)](https://nodejs.org/)

**Porto Verde** is a complete 2D top-down open-world crime game, built by an AI
agent for make.fun's "Make GTA 6" bounty ($1,666 in USDC). It plays offline in a
desktop browser from static files — no network request, no library, no build step.

You are Nia "Nova" Okafor, a getaway driver new to the sun-soaked coastal city
of Porto Verde. Fixer Dante Cole has work for you — if you can stay ahead of the
Porto Verde police and the Rust Kings crew.

## What's in the game

- A city to explore on foot and by car: 6 districts, traffic, pedestrians, a
  beach and an ocean, day-lit and sun-soaked
- Cars to steal and drive (6 models), car damage, smoke, fire and explosions
- A wanted system (5 stars) with police cruisers that chase, ram and bust you,
  plus foot cops from 3 stars up
- 5 story missions with paydays, a taxi-fare side job, and activities: spray
  shop, hospital, gun shop, safehouse
- Combat on foot with mouse aim, gang shootouts, bullets, particles
- HUD with health, money, wanted stars, ammo, speedometer and a live minimap
- Start screen, pause, busted / wasted screens, story-complete screen, and
  autosave to localStorage
- Procedural WebAudio sound: engine, sirens, gunshots, pickups, jingles, bass

## Play

```sh
node serve.ts
# open http://localhost:8080
```

| Key | Action |
| --- | --- |
| W A S D | Move / drive |
| Mouse | Aim (on foot) |
| Click | Shoot |
| Shift | Sprint |
| E | Enter / exit car, steal car |
| Space | Handbrake |
| P / Esc | Pause |
| M | Mute |

## Layout

- `game/index.html` — the page, HUD and menus
- `game/src/` — one file per system: `config`, `random`, `world`, `input`,
  `audio`, `entities`, `missions`, `render`, `save`, `shots`, `main`
- `main.ts` — hands the game in: copies `game/` + `screenshots/` to `/output`
  and writes `dossier.json`
- `screenshots/` — 4 real renders of the game, taken in headless Chromium

## License

MIT — see [LICENSE](LICENSE).
