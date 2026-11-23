// Deterministic screenshot staging: ?shot=<name>&seed=<n> builds a fixed scene,
// runs the simulation forward a fixed number of seconds, then freezes on one
// frame. No randomness escapes the seeded RNG, so re-shoots are identical.
import { createCar, spawnCruiser, addHeat } from './entities.js';

export function shotParam() {
  const q = new URLSearchParams(location.search);
  return q.get('shot');
}

export function seedParam() {
  const q = new URLSearchParams(location.search);
  const s = parseInt(q.get('seed') || '7', 10);
  return Number.isFinite(s) ? s : 7;
}

// A synthetic input that just holds W (drive forward).
function driveInput() {
  return { keys: new Set(['KeyW']), mouse: { x: 640, y: 360, down: false, clicked: false } };
}

// Remove every non-police car inside a rectangle — clears the player's path
// for a chase or drive shot so nothing wedges the staged car to a stop.
function clearCarsInRect(game, x0, y0, x1, y1) {
  game.cars = game.cars.filter((c) => c.police || !(c.x > x0 && c.x < x1 && c.y > y0 && c.y < y1));
}

export function stageShot(game, name, stepWorld) {
  const p = game.player;
  const dt = 1 / 60;
  if (name === 'start') {
    // Title screen over downtown: camera high over Palm Row, traffic moving.
    game.state = 'menu';
    game.cam.x = 1500; game.cam.y = 1150;
    p.x = 1500; p.y = 1150;
    for (let i = 0; i < 60; i++) stepWorld(game, dt, driveInput(), true);
    game.cam.x = 1500; game.cam.y = 1150;
    return;
  }
  game.state = 'playing';
  if (name === 'drive') {
    clearCarsInRect(game, 650, 300, 1600, 1850);
    const car = createCar(1145, 1700, -Math.PI / 2, 'sunrunner', '#e67e22', {});
    car.speed = 420;
    game.cars.push(car);
    p.car = car;
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    for (let i = 0; i < 100; i++) stepWorld(game, dt, driveInput(), true);
  } else if (name === 'chase') {
    clearCarsInRect(game, 1100, 300, 2050, 1900);
    const car = createCar(1595, 1750, -Math.PI / 2, 'vortex', '#8e44ad', {});
    car.speed = 600;
    game.cars.push(car);
    p.car = car;
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    addHeat(game, 75); // 4 stars
    // Cruisers start close behind the player, closing in — close enough to
    // stay in frame at the end of staging, far enough not to box the car in.
    const behind = [110, 180, 260];
    const side = [-45, 40, -20];
    for (let i = 0; i < 3; i++) {
      const c = spawnCruiser(game);
      c.x = car.x + side[i];
      c.y = car.y + behind[i];
      c.speed = 560;
      c.angle = -Math.PI / 2;
    }
    for (let i = 0; i < 90; i++) stepWorld(game, dt, driveInput(), true);
  } else if (name === 'mission') {
    // Mission 2, second step: the Sunrunner is stolen, drive it to the Chop Shop.
    // The car starts ON the road east of the Marina — starting inside a block
    // wedges it against a building.
    clearCarsInRect(game, 2100, 1950, 3050, 2120);
    const m = game.missions;
    m.index = 1; m.step = 1; m.started = true;
    const car = m.targetCar;
    car.parked = false;
    car.x = 2200; car.y = 2025; car.angle = 0;
    car.speed = 380;
    p.car = car;
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    // Drive briefly toward the marker without reaching it (the marker stays
    // in frame and the mission stays in progress).
    for (let i = 0; i < 40; i++) stepWorld(game, dt, driveInput(), true);
  }
  // Snap the camera onto the player for an exact, repeatable frame. For the
  // chase the camera sits behind the player, so the pursuing cruisers read.
  const ahead = name === 'chase' ? -120 : 60;
  game.cam.x = p.x + Math.cos(p.angle) * ahead;
  game.cam.y = p.y + Math.sin(p.angle) * ahead;
}
