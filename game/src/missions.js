// Story missions and the taxi side job. Five missions, played in order, each a
// chain of steps: drive somewhere, pick someone up, steal a car, lose the heat,
// beat a clock, clear the Foundry. Completing all five ends the story.
import { SPOTS } from './world.js';
import { addHeat, spawnGang } from './entities.js';
import { dist2 } from './random.js';
import { sfxCash } from './audio.js';

export const MISSIONS = [
  {
    id: 'm1', name: 'The Pickup', pay: 250,
    brief: 'Dante Cole needs a driver. Pick him up at the Marina and take him to the Saltmarket meet.',
    steps: [
      { type: 'goto', x: 3350, y: 600, text: 'Pick up Dante at the Marina' },
      { type: 'goto', x: 2900, y: 300, text: 'Drive Dante to the Saltmarket meet' },
    ],
  },
  {
    id: 'm2', name: 'Borrowed Thunder', pay: 400,
    brief: 'A crimson Sunrunner is parked in Palm Row. Borrow it — permanently — and bring it to the Chop Shop.',
    steps: [
      { type: 'steal', x: 1150, y: 1150, text: 'Steal the crimson Sunrunner in Palm Row' },
      { type: 'deliver', x: SPOTS.chopshop.x, y: SPOTS.chopshop.y, text: 'Deliver the Sunrunner to the Chop Shop' },
    ],
  },
  {
    id: 'm3', name: 'Cooling Off', pay: 350,
    brief: 'The cops are all over you. Lose the heat — get your wanted level down — then lay low at the Safehouse.',
    steps: [
      { type: 'loseheat', text: 'Lose the cops — drop below 1 star' },
      { type: 'goto', x: SPOTS.safehouse.x, y: SPOTS.safehouse.y, text: 'Lay low at the Safehouse' },
    ],
  },
  {
    id: 'm4', name: 'Harbor Run', pay: 600,
    brief: 'A crate at the Docks has to reach the Foundry warehouse in 150 seconds. Drive like it matters.',
    steps: [
      { type: 'goto', x: SPOTS.docks.x, y: SPOTS.docks.y, text: 'Pick up the crate at the Docks' },
      { type: 'timed', x: 2900, y: 1420, seconds: 150, text: 'Deliver the crate to the Foundry — beat the clock!' },
    ],
  },
  {
    id: 'm5', name: "Rust Kings' Last Stand", pay: 1000,
    brief: 'The Rust Kings hold the Foundry Yard. Clear them out, then get to the Safehouse and end this.',
    steps: [
      { type: 'clear', x: SPOTS.foundry.x, y: SPOTS.foundry.y, count: 6, text: 'Clear the Rust Kings from the Foundry Yard' },
      { type: 'goto', x: SPOTS.safehouse.x, y: SPOTS.safehouse.y, text: 'Get back to the Safehouse' },
    ],
  },
];

export function createMissions() {
  return { index: 0, step: 0, timer: 0, started: false, done: false, targetCar: null };
}

function current(m) { return MISSIONS[m.index]; }
function currentStep(m) { return current(m).steps[m.step]; }

export function missionObjective(m) {
  if (m.done) return 'Story complete — Porto Verde is yours. Free roam!';
  if (!m.started) return 'Reach the gold marker to start: ' + current(m).name;
  return currentStep(m).text;
}

export function missionMarker(m) {
  if (m.done) return null;
  const s = currentStep(m);
  if (s.type === 'loseheat') return { x: SPOTS.safehouse.x, y: SPOTS.safehouse.y };
  return { x: s.x, y: s.y };
}

// The marker that starts the next mission (missions begin on arrival).
export function missionStartPos(m) {
  const s = current(m).steps[0];
  return { x: s.x, y: s.y };
}

function advanceStep(game) {
  const m = game.missions;
  m.step++;
  if (m.step >= current(m).steps.length) {
    const pay = current(m).pay;
    game.player.money += pay;
    game.stats.missionsDone++;
    sfxCash();
    game.toast(`${current(m).name} complete — +$${pay}`);
    m.index++;
    m.step = 0;
    m.started = false;
    m.targetCar = null;
    if (m.index >= MISSIONS.length) {
      m.done = true;
      game.state = 'complete';
    } else {
      game.toast(`New mission: ${current(m).name} — ${current(m).brief}`);
    }
    game.saveNow();
  }
}

export function updateMissions(game, dt) {
  const m = game.missions;
  if (m.done) return;
  const p = game.player;
  const step = currentStep(m);
  if (!m.started) {
    // Walk or drive into the gold marker to start the mission.
    const start = missionStartPos(m);
    if (dist2(p.x, p.y, start.x, start.y) < 90 * 90) {
      m.started = true;
      game.toast(`${current(m).name}: ${current(m).brief}`);
      if (current(m).id === 'm3') addHeat(game, 55); // the heat is already on
      if (current(m).id === 'm5') spawnGang(game, SPOTS.foundry.x, SPOTS.foundry.y, 6);
    }
    return;
  }
  switch (step.type) {
    case 'goto':
    case 'deliver': {
      if (dist2(p.x, p.y, step.x, step.y) < 85 * 85) advanceStep(game);
      break;
    }
    case 'steal': {
      // The crimson Sunrunner is parked at the marker from the start (main.js
      // spawns it and stores it as m.targetCar). Get in it to take it.
      if (m.targetCar && p.car === m.targetCar) advanceStep(game);
      break;
    }
    case 'loseheat': {
      if (game.stars === 0) advanceStep(game);
      break;
    }
    case 'timed': {
      if (m.timer <= 0) m.timer = step.seconds;
      m.timer -= dt;
      if (dist2(p.x, p.y, step.x, step.y) < 85 * 85) { m.timer = 0; advanceStep(game); }
      else if (m.timer <= 0) {
        m.timer = 0;
        game.toast('Too slow — the deal fell through. Try again!');
        m.started = false; // restart the mission from its first step
        m.step = 0;
      }
      break;
    }
    case 'clear': {
      const left = game.gang.filter((g) => !g.dead).length;
      if (left === 0) advanceStep(game);
      break;
    }
  }
}

// ---- taxi side job ---------------------------------------------------------
export function createTaxi() {
  return { state: 'idle', px: 0, py: 0, dx: 0, dy: 0, fare: 0, offerCd: 8 };
}

const FARE_SPOTS = [
  { x: 700, y: 300 }, { x: 2500, y: 300 }, { x: 300, y: 1150 }, { x: 2000, y: 1150 },
  { x: 1150, y: 1600 }, { x: 2950, y: 1600 }, { x: 700, y: 2300 }, { x: 2500, y: 2300 },
];

export function updateTaxi(game, dt) {
  const t = game.taxi;
  const p = game.player;
  t.offerCd -= dt;
  if (t.state === 'idle') {
    if (t.offerCd <= 0 && p.car && !game.missions.started) {
      const a = game.rng.pick(FARE_SPOTS);
      let b = game.rng.pick(FARE_SPOTS);
      while (b === a) b = game.rng.pick(FARE_SPOTS);
      t.px = a.x; t.py = a.y; t.dx = b.x; t.dy = b.y;
      t.fare = 30 + Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 60);
      t.state = 'pickup';
      game.toast(`Taxi fare offered: pick up a passenger ($${t.fare})`);
    }
    return;
  }
  if (t.state === 'pickup') {
    if (!p.car) { t.state = 'idle'; t.offerCd = 10; game.toast('Fare lost — you left the car.'); return; }
    if (dist2(p.x, p.y, t.px, t.py) < 80 * 80) {
      t.state = 'dropoff';
      game.toast('Passenger aboard — take them to the blue marker.');
    }
    return;
  }
  if (t.state === 'dropoff') {
    if (!p.car) { t.state = 'idle'; t.offerCd = 10; game.toast('Fare lost — you left the car.'); return; }
    if (dist2(p.x, p.y, t.dx, t.dy) < 80 * 80) {
      p.money += t.fare;
      sfxCash();
      game.toast(`Fare complete — +$${t.fare}`);
      t.state = 'idle';
      t.offerCd = 12;
    }
  }
}

export function taxiMarker(game) {
  const t = game.taxi;
  if (t.state === 'pickup') return { x: t.px, y: t.py, color: '#3498db' };
  if (t.state === 'dropoff') return { x: t.dx, y: t.dy, color: '#3498db' };
  return null;
}
