// Porto Verde — boot, game loop, state machine, HUD wiring and activities.
// The world, entities and rendering live in their own modules; this file
// only connects them and owns the DOM.
import { DEFAULT_SEED, PRICES, districtAt } from './config.js';
import { makeRng } from './random.js';
import { buildCity, SPOTS } from './world.js';
import { keys, justPressed, mouse, bindInput, endFrameInput } from './input.js';
import {
  unlockAudio, toggleMute, engineStart, engineUpdate, engineStop,
  sirenStart, sirenStop, bassStart, bassStop, sfxClick, sfxCash, sfxBusted, sfxPickup,
} from './audio.js';
import {
  createPlayer, createCar, spawnParkedCars, spawnTrafficCar, spawnPed,
  updatePlayer, updateCarsAndCollisions, updatePolice, updateGang, updateBullets,
  updateParticles, updatePed, nearestCar, enterCar, exitCar, addHeat, starsForHeat,
} from './entities.js';
import { createMissions, updateMissions, missionObjective, createTaxi, updateTaxi } from './missions.js';
import { createCamera, updateCamera, drawGame, drawMinimap } from './render.js';
import { hasSave, saveGame, loadGameData, clearSave } from './save.js';
import { shotParam, seedParam, stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const minicanvas = document.getElementById('minimap');
const mctx = minicanvas.getContext('2d');
const $ = (id) => document.getElementById(id);

let W = 1280, H = 720;
function resizeCanvas() {
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W; canvas.height = H;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ---- toasts ----------------------------------------------------------------
let toastTimer = null;
function showToast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3600);
}

// ---- overlays --------------------------------------------------------------
const OVERLAYS = ['menu', 'pause', 'busted', 'wasted', 'complete'];
function showOverlay(name) {
  for (const o of OVERLAYS) $(`overlay-${o}`).classList.toggle('show', o === name);
  $('hud').classList.toggle('hidden', name === 'menu');
}
function hideOverlays() {
  for (const o of OVERLAYS) $(`overlay-${o}`).classList.remove('show');
  $('hud').classList.remove('hidden');
}

// ---- game creation ---------------------------------------------------------
function createGame(seed) {
  const rng = makeRng(seed);
  const city = buildCity(seed);
  const game = {
    time: 0, seed, rng, city,
    player: createPlayer(760, 830),
    cars: [], peds: [], cops: [], gang: [], bullets: [], particles: [], wrecks: [],
    heat: 0, stars: 0, spawnCd: 0,
    state: 'menu',
    missions: createMissions(),
    taxi: createTaxi(),
    cam: createCamera(),
    stats: { kills: 0, carsStolen: 0, missionsDone: 0 },
    district: '',
    autosaveT: 0,
    staging: false,
    sirenOn: false,
  };
  game.toast = showToast;
  game.saveNow = () => saveGame(game);
  spawnParkedCars(game, 14);
  for (let i = 0; i < 12; i++) spawnTrafficCar(game);
  for (let i = 0; i < 22; i++) spawnPed(game);
  // Mission 2's target: a crimson Sunrunner parked in Palm Row.
  const target = createCar(1160, 1200, 0, 'sunrunner', '#c0392b', { parked: true });
  game.cars.push(target);
  game.missions.targetCar = target;
  // A starter car by the Safehouse so the player can drive at once.
  game.cars.push(createCar(700, 850, -Math.PI / 2, 'clipper', '#2980b9', { parked: true }));
  game.cam.x = game.player.x;
  game.cam.y = game.player.y;
  return game;
}

let game = createGame(DEFAULT_SEED);

// ---- activities ------------------------------------------------------------
function nearSpot(p, spot, r) {
  return Math.hypot(p.x - spot.x, p.y - spot.y) < r;
}

function tryActivity() {
  const p = game.player;
  if (p.car) return false;
  if (nearSpot(p, SPOTS.spray, 70) && p.money >= PRICES.spray) {
    // The spray shop works on the car you arrived in — here it clears heat
    // and repairs the nearest car instead.
    const car = nearestCar(game, p.x, p.y, 120);
    if (car) { car.hp = car.maxHp; car.wreck = false; }
    p.money -= PRICES.spray;
    game.heat = 0; game.stars = 0;
    sfxCash();
    showToast('Resprayed — wanted level cleared, car repaired.');
    return true;
  }
  if (nearSpot(p, SPOTS.hospital, 70) && p.money >= PRICES.heal) {
    p.money -= PRICES.heal;
    p.hp = 100;
    sfxPickup();
    showToast('Patched up — full health.');
    return true;
  }
  if (nearSpot(p, SPOTS.gunshop, 70) && p.money >= PRICES.ammo) {
    p.money -= PRICES.ammo;
    p.ammo += PRICES.ammoRounds;
    sfxPickup();
    showToast(`+${PRICES.ammoRounds} rounds.`);
    return true;
  }
  if (nearSpot(p, SPOTS.safehouse, 70)) {
    p.hp = 100;
    saveGame(game);
    sfxPickup();
    showToast('Safehouse — healed and saved.');
    return true;
  }
  return false;
}

function interactKey() {
  const p = game.player;
  if (p.car) { exitCar(game); return; }
  const car = nearestCar(game, p.x, p.y, 62);
  if (car) { enterCar(game, car); return; }
  tryActivity();
}

// ---- one simulation step ---------------------------------------------------
function stepWorld(g, dt, input, stagingStep) {
  g.time += dt;
  const aimWorld = {
    x: input.mouse.x + g.cam.x - W / 2,
    y: input.mouse.y + g.cam.y - H / 2,
  };
  updatePlayer(g, dt, input, aimWorld);
  updateCarsAndCollisions(g, dt);
  for (const ped of g.peds) updatePed(g, ped, dt);
  updatePolice(g, dt);
  updateGang(g, dt);
  updateBullets(g, dt);
  updateParticles(g, dt);
  if (!stagingStep) {
    updateMissions(g, dt);
    updateTaxi(g, dt);
    g.autosaveT += dt;
    if (g.autosaveT > 60) { g.autosaveT = 0; saveGame(g); }
  }
  updateCamera(g.cam, g, W, H, dt);
  // District banner (skipped while staging screenshots).
  const d = districtAt(g.player.x, g.player.y);
  if (d !== g.district) {
    g.district = d;
    if (!stagingStep) {
      const banner = $('district');
      banner.textContent = d;
      banner.classList.add('show');
      setTimeout(() => banner.classList.remove('show'), 2200);
    }
  }
  if (g.player.dead && g.state === 'playing') g.state = 'wasted';
}

// ---- HUD -------------------------------------------------------------------
const hudCache = {};
function setText(id, value) {
  if (hudCache[id] !== value) { hudCache[id] = value; $(id).textContent = value; }
}

function updateHUD() {
  const p = game.player;
  const hpPct = Math.max(0, Math.round((p.hp / 100) * 100));
  $('hp-fill').style.width = `${hpPct}%`;
  $('hp-fill').style.background = p.hp > 50 ? '#2ecc71' : p.hp > 25 ? '#f1c40f' : '#e74c3c';
  setText('money', `$${p.money}`);
  setText('stars', '★'.repeat(game.stars) + '☆'.repeat(5 - game.stars));
  $('stars').style.color = game.stars > 0 ? '#ffd700' : 'rgba(255,255,255,0.55)';
  setText('ammo', p.car ? '' : `Ammo ${p.ammo}`);
  setText('speed', p.car ? `${Math.round(Math.abs(p.car.speed) * 0.36)} km/h` : '');
  setText('objective', missionObjective(game.missions));
  const m = game.missions;
  setText('timer', m.timer > 0 ? `⏱ ${Math.ceil(m.timer)}s` : '');
  setText('mission-name', m.done ? 'STORY COMPLETE' : `MISSION ${m.index + 1}/5 — ${['The Pickup', 'Borrowed Thunder', 'Cooling Off', 'Harbor Run', "Rust Kings' Last Stand"][m.index]}`);
  if (p.bustMeter > 0) {
    $('bust').classList.add('show');
    $('bust-fill').style.width = `${Math.min(100, (p.bustMeter / 2.2) * 100)}%`;
  } else {
    $('bust').classList.remove('show');
  }
  drawMinimap(mctx, game, 150);
}

// ---- audio state -----------------------------------------------------------
function updateAudio() {
  const p = game.player;
  if (game.state !== 'playing') { engineUpdate(0, false); sirenStop(); game.sirenOn = false; return; }
  engineStart();
  engineUpdate(p.car ? Math.abs(p.car.speed) / 850 : 0, !!p.car);
  if (game.stars > 0 && !game.sirenOn) { sirenStart(); game.sirenOn = true; }
  if (game.stars === 0 && game.sirenOn) { sirenStop(); game.sirenOn = false; }
}

// ---- state transitions -----------------------------------------------------
function startNewGame() {
  sfxClick();
  clearSave();
  game = createGame(DEFAULT_SEED);
  hideOverlays();
  bassStop();
  game.state = 'playing';
  showToast('Welcome to Porto Verde. Reach the gold marker to start: The Pickup.');
}

function continueGame() {
  sfxClick();
  const data = loadGameData();
  game = createGame(DEFAULT_SEED);
  if (data) {
    game.player.money = data.money;
    game.player.hp = data.hp;
    game.player.ammo = data.ammo;
    game.player.x = data.x;
    game.player.y = data.y;
    game.missions.index = Math.min(data.missionIndex, 4);
    game.stats.missionsDone = data.missionsDone;
    game.stats.kills = data.kills;
    game.stats.carsStolen = data.carsStolen;
    game.cam.x = data.x;
    game.cam.y = data.y;
  }
  hideOverlays();
  bassStop();
  game.state = 'playing';
  showToast('Welcome back to Porto Verde.');
}

function respawnAfterBust() {
  sfxClick();
  const p = game.player;
  const fine = Math.min(p.money, Math.max(50, Math.round(p.money * 0.2)));
  p.money -= fine;
  p.hp = 100;
  p.car = null;
  p.x = SPOTS.safehouse.x; p.y = SPOTS.safehouse.y + 40;
  p.bustMeter = 0;
  game.heat = 0; game.stars = 0;
  game.cops = [];
  game.cars = game.cars.filter((c) => !c.police);
  game.state = 'playing';
  hideOverlays();
  showToast(`Busted — fined $${fine}. The cops let you go at the Safehouse.`);
}

function respawnAfterWasted() {
  sfxClick();
  const p = game.player;
  const fee = Math.min(p.money, 100);
  p.money -= fee;
  p.hp = 100;
  p.dead = false;
  p.car = null;
  p.x = SPOTS.hospital.x; p.y = SPOTS.hospital.y + 40;
  p.bustMeter = 0;
  game.heat = Math.max(0, game.heat - 30);
  game.stars = starsForHeat(game.heat);
  game.state = 'playing';
  hideOverlays();
  showToast(`Wasted — hospital bill $${fee}.`);
}

function freeRoam() {
  sfxClick();
  game.state = 'playing';
  hideOverlays();
  showToast('Free roam — Porto Verde is yours.');
}

// ---- buttons ---------------------------------------------------------------
$('btn-new').addEventListener('click', startNewGame);
$('btn-continue').addEventListener('click', continueGame);
$('btn-resume').addEventListener('click', () => { sfxClick(); game.state = 'playing'; hideOverlays(); });
$('btn-restart').addEventListener('click', startNewGame);
$('btn-busted').addEventListener('click', respawnAfterBust);
$('btn-wasted').addEventListener('click', respawnAfterWasted);
$('btn-roam').addEventListener('click', freeRoam);
$('btn-quit').addEventListener('click', () => { sfxClick(); game.state = 'menu'; showOverlay('menu'); bassStart(); });
if (hasSave()) $('btn-continue').classList.remove('hidden');
else $('btn-continue').classList.add('hidden');

bindInput(canvas);
window.addEventListener('keydown', unlockAudio, { once: true });
window.addEventListener('mousedown', unlockAudio, { once: true });

// ---- main loop -------------------------------------------------------------
let last = performance.now();
let shownState = '';

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(1 / 30, (now - last) / 1000 || 0.016);
  last = now;
  if (game.state === 'playing') {
    if (justPressed.has('KeyE')) interactKey();
    if (justPressed.has('KeyM')) toggleMute();
    if (justPressed.has('Escape') || justPressed.has('KeyP')) {
      game.state = 'paused';
      showOverlay('pause');
    } else {
      stepWorld(game, dt, { keys, mouse }, false);
      updateHUD();
      updateAudio();
    }
  } else if (game.state === 'paused') {
    if (justPressed.has('Escape') || justPressed.has('KeyP')) {
      game.state = 'playing';
      hideOverlays();
    }
  } else if (game.state === 'menu') {
    // Slow drift over the city behind the title.
    game.time += dt;
    game.cam.x = 1500 + Math.sin(game.time * 0.05) * 200;
    game.cam.y = 1150 + Math.cos(game.time * 0.04) * 120;
  }
  if (game.state !== shownState) {
    shownState = game.state;
    if (game.state === 'busted') {
      sfxBusted();
      $('busted-fine').textContent = `Fine: $${Math.min(game.player.money, Math.max(50, Math.round(game.player.money * 0.2)))}`;
      showOverlay('busted');
    } else if (game.state === 'wasted') {
      showOverlay('wasted');
    } else if (game.state === 'complete') {
      $('complete-stats').textContent = `Missions ${game.stats.missionsDone}/5 · Kills ${game.stats.kills} · Cars stolen ${game.stats.carsStolen} · Cash $${game.player.money}`;
      showOverlay('complete');
    }
  }
  drawGame(ctx, game, W, H);
  if (game.state !== 'menu') drawMinimap(mctx, game, 150);
  endFrameInput();
}

// ---- boot ------------------------------------------------------------------
const shot = shotParam();
if (shot) {
  // Screenshot mode: stage one frozen frame, no loop, no audio.
  game = createGame(seedParam());
  game.staging = true;
  stageShot(game, shot, stepWorld);
  updateHUD();
  if (shot === 'start') {
    showOverlay('menu');
    $('btn-continue').classList.add('hidden');
  } else {
    hideOverlays();
  }
  drawGame(ctx, game, W, H);
  drawMinimap(mctx, game, 150);
  window.__shotDone = true;
} else {
  showOverlay('menu');
  bassStart();
  requestAnimationFrame(frame);
}
