// Entities: the player, cars, traffic, pedestrians, police, bullets and
// particles. All behaviour lives here; main.js only calls the update fns.
import { CAR_MODELS, TRAFFIC_MODELS, CAR_COLORS, ROAD_XS, ROAD_YS, ROAD_HALF, STAR_HEAT, HEAT_DECAY, BUST_SECONDS } from './config.js';
import { clamp, angleLerp, dist2 } from './random.js';
import { collideBuildings, clampToWorld, nearestRoadX, nearestRoadY } from './world.js';
import { sfxShot, sfxHit, sfxCrash, sfxExplode } from './audio.js';

export function starsForHeat(heat) {
  let s = 0;
  for (const t of STAR_HEAT) if (heat >= t) s++;
  return s;
}
export function addHeat(game, n) {
  game.heat = clamp(game.heat + n, 0, 100);
  game.stars = starsForHeat(game.heat);
}

export function createPlayer(x, y) {
  return { x, y, angle: -Math.PI / 2, hp: 100, money: 120, ammo: 60, car: null, speed: 0, fireCd: 0, hurtCd: 0, bustMeter: 0, dead: false };
}

export function createCar(x, y, angle, modelKey, color, opts = {}) {
  const m = CAR_MODELS[modelKey];
  return {
    x, y, angle, speed: 0, model: modelKey, name: m.name, color,
    hp: m.hp, maxHp: m.hp, police: !!opts.police, parked: !!opts.parked,
    wreck: false, burnT: 0, lastHit: -9, brake: false,
    ai: opts.ai || null, driver: opts.driver || null,
  };
}

function carRadius(car) { return CAR_MODELS[car.model].len * 0.5; }

export function spawnParkedCars(game, n) {
  const rng = game.rng;
  for (let i = 0; i < n; i++) {
    const vertical = rng.chance(0.5);
    const road = vertical ? rng.pick(ROAD_XS) : rng.pick(ROAD_YS);
    const along = rng.range(300, vertical ? 2400 : 3300);
    const side = rng.chance(0.5) ? 1 : -1;
    const x = vertical ? road + side * (ROAD_HALF - 16) : along;
    const y = vertical ? along : road + side * (ROAD_HALF - 16);
    const angle = vertical ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI);
    game.cars.push(createCar(x, y, angle, rng.pick(TRAFFIC_MODELS), rng.pick(CAR_COLORS), { parked: true }));
  }
}

export function spawnTrafficCar(game) {
  const rng = game.rng;
  const vertical = rng.chance(0.5);
  const road = vertical ? rng.pick(ROAD_XS) : rng.pick(ROAD_YS);
  const dir = rng.chance(0.5) ? 1 : -1;
  const lane = dir > 0 ? 20 : -20;
  const along = rng.range(200, vertical ? 2400 : 3400);
  const x = vertical ? road + lane : along;
  const y = vertical ? along : road + lane;
  const angle = vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
  const car = createCar(x, y, angle, rng.pick(TRAFFIC_MODELS), rng.pick(CAR_COLORS), {
    ai: { vertical, dir, road, lane, cruise: rng.range(190, 260), turnCd: rng.range(1, 4) },
  });
  car.speed = car.ai.cruise;
  game.cars.push(car);
  return car;
}

export function spawnPed(game, x, y) {
  const rng = game.rng;
  const vertical = rng.chance(0.5);
  const road = vertical ? rng.pick(ROAD_XS) : rng.pick(ROAD_YS);
  const dir = rng.chance(0.5) ? 1 : -1;
  const side = rng.chance(0.5) ? 1 : -1;
  const along = rng.range(200, vertical ? 2400 : 3400);
  const ped = {
    x: x ?? (vertical ? road + side * (ROAD_HALF + 14) : along),
    y: y ?? (vertical ? along : road + side * (ROAD_HALF + 14)),
    angle: 0, hp: 50, speed: rng.range(55, 85), vertical, dir, road, side,
    color: rng.pick(['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#ecf0f1', '#e67e22']),
    flee: 0, fleeX: 0, fleeY: 0, dead: false, walkPhase: rng.range(0, 6),
  };
  game.peds.push(ped);
  return ped;
}

// ---- particles -------------------------------------------------------------
export function spawnParticles(game, x, y, n, color, speed, life, size) {
  for (let i = 0; i < n; i++) {
    const a = game.rng.range(0, Math.PI * 2);
    const s = game.rng.range(speed * 0.3, speed);
    game.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: game.rng.range(life * 0.5, life), maxLife: life, color, size: game.rng.range(size * 0.6, size * 1.3) });
  }
}
export function updateParticles(game, dt) {
  for (const p of game.particles) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.94; p.vy *= 0.94;
    p.life -= dt;
  }
  game.particles = game.particles.filter((p) => p.life > 0);
}

// ---- bullets ---------------------------------------------------------------
export function fireBullet(game, x, y, angle, from) {
  const speed = 900;
  game.bullets.push({ x: x + Math.cos(angle) * 20, y: y + Math.sin(angle) * 20, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.9, from, dmg: from === 'player' ? 34 : 9 });
  spawnParticles(game, x + Math.cos(angle) * 24, y + Math.sin(angle) * 24, 3, '#ffd94d', 120, 0.12, 3);
  sfxShot();
}

function bulletHitsCircle(b, ex, ey, r) {
  return dist2(b.x, b.y, ex, ey) < r * r;
}

export function updateBullets(game, dt) {
  const p = game.player;
  for (const b of game.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0) continue;
    // Buildings stop bullets.
    let blocked = false;
    for (const bd of game.city.buildings) {
      if (b.x > bd.x && b.x < bd.x + bd.w && b.y > bd.y && b.y < bd.y + bd.h) { blocked = true; break; }
    }
    if (blocked) { b.life = 0; spawnParticles(game, b.x, b.y, 4, '#cccccc', 100, 0.2, 2); continue; }
    if (b.from === 'player') {
      for (const ped of game.peds) {
        if (!ped.dead && bulletHitsCircle(b, ped.x, ped.y, 14)) {
          b.life = 0; ped.hp -= b.dmg;
          spawnParticles(game, ped.x, ped.y, 6, '#c0392b', 140, 0.4, 3);
          if (ped.hp <= 0) { ped.dead = true; addHeat(game, 20); game.stats.kills++; game.toast('Pedestrian down — wanted level up!'); }
          else { ped.flee = 3; ped.fleeX = p.x; ped.fleeY = p.y; }
          sfxHit();
          break;
        }
      }
      if (b.life <= 0) continue;
      for (const cop of game.cops) {
        if (!cop.dead && bulletHitsCircle(b, cop.x, cop.y, 14)) {
          b.life = 0; cop.hp -= b.dmg;
          spawnParticles(game, cop.x, cop.y, 6, '#c0392b', 140, 0.4, 3);
          if (cop.hp <= 0) { cop.dead = true; addHeat(game, 30); game.stats.kills++; game.toast('Officer down — the heat is on!'); }
          sfxHit();
          break;
        }
      }
      if (b.life <= 0) continue;
      for (const g of game.gang) {
        if (!g.dead && bulletHitsCircle(b, g.x, g.y, 15)) {
          b.life = 0; g.hp -= b.dmg;
          spawnParticles(game, g.x, g.y, 6, '#c0392b', 140, 0.4, 3);
          if (g.hp <= 0) { g.dead = true; game.stats.kills++; game.player.money += 25; game.toast('Gang member down +$25'); }
          sfxHit();
          break;
        }
      }
      if (b.life <= 0) continue;
      for (const c of game.cars) {
        if (c.wreck) continue;
        if (bulletHitsCircle(b, c.x, c.y, carRadius(c))) {
          b.life = 0; damageCar(game, c, b.dmg, false);
          spawnParticles(game, b.x, b.y, 4, '#f39c12', 130, 0.25, 2);
          break;
        }
      }
    } else {
      // Enemy bullets only threaten the player.
      if (!p.dead && p.car === null && bulletHitsCircle(b, p.x, p.y, 15)) {
        b.life = 0; hurtPlayer(game, b.dmg);
      } else if (!p.dead && p.car && bulletHitsCircle(b, p.car.x, p.car.y, carRadius(p.car))) {
        b.life = 0; damageCar(game, p.car, b.dmg, false);
      }
    }
  }
  game.bullets = game.bullets.filter((b) => b.life > 0);
}

export function hurtPlayer(game, dmg) {
  const p = game.player;
  if (p.dead || p.hurtCd > 0) return;
  p.hp -= dmg;
  p.hurtCd = 0.25;
  spawnParticles(game, p.x, p.y, 5, '#c0392b', 120, 0.3, 3);
  if (p.hp <= 0) { p.hp = 0; p.dead = true; }
}

// ---- cars ------------------------------------------------------------------
export function damageCar(game, car, dmg, noisy) {
  if (car.wreck) return;
  car.hp -= dmg;
  if (noisy) sfxCrash();
  if (car.hp <= 0) {
    car.hp = 0; car.wreck = true; car.burnT = 1.6; car.speed = 0;
    spawnParticles(game, car.x, car.y, 20, '#f39c12', 220, 0.8, 5);
  }
}

function explodeCar(game, car) {
  sfxExplode();
  spawnParticles(game, car.x, car.y, 40, '#e67e22', 320, 0.9, 7);
  spawnParticles(game, car.x, car.y, 25, '#2c3e50', 120, 1.6, 9);
  game.wrecks.push({ x: car.x, y: car.y, angle: car.angle, model: car.model, color: '#1a1a1a' });
  const p = game.player;
  if (dist2(p.x, p.y, car.x, car.y) < 130 * 130) {
    if (p.car === car) { p.car = null; p.x = car.x + 40; p.y = car.y; }
    p.hp -= 45; p.hurtCd = 0.5;
    if (p.hp <= 0) { p.hp = 0; p.dead = true; }
  }
  for (const ped of game.peds) if (!ped.dead && dist2(ped.x, ped.y, car.x, car.y) < 120 * 120) ped.dead = true;
  game.cars.splice(game.cars.indexOf(car), 1);
}

function moveCarPhysics(car, dt, throttle, steer, handbrake) {
  const m = CAR_MODELS[car.model];
  if (throttle > 0) car.speed += m.accel * throttle * dt;
  else if (throttle < 0) car.speed += m.accel * 0.7 * throttle * dt;
  if (handbrake) car.speed *= Math.pow(0.12, dt);
  car.speed *= Math.pow(0.55, dt); // drag + rolling resistance
  car.speed = clamp(car.speed, -m.top * 0.4, m.top);
  const grip = m.grip * clamp(Math.abs(car.speed) / 120, 0, 1);
  car.angle += steer * grip * dt * Math.sign(car.speed || 1) * (handbrake ? 1.5 : 1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
}

function collideCarWithWorld(game, car) {
  const r = carRadius(car);
  if (collideBuildings(car, r * 0.8, game.city)) {
    if (Math.abs(car.speed) > 180 && game.time - car.lastHit > 0.5) {
      damageCar(game, car, Math.min(28, Math.abs(car.speed) * 0.05), true);
      car.lastHit = game.time;
      spawnParticles(game, car.x, car.y, 8, '#f1c40f', 180, 0.4, 3);
    }
    car.speed *= 0.35;
  }
  const ox = car.x, oy = car.y;
  clampToWorld(car, r);
  if (car.x !== ox || car.y !== oy) car.speed *= 0.4;
}

// Car-vs-car: push apart, then trade velocity along the collision normal
// (a real impulse, not an average — averaging stalls both cars when several
// pile up and each frame drags every speed toward zero).
function collideCars(game) {
  const cars = game.cars;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      const ra = carRadius(a), rb = carRadius(b);
      const dx = b.x - a.x, dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      const min = (ra + rb) * 0.72;
      if (d2 >= min * min || d2 < 0.01) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d, ny = dy / d;
      const push = (min - d) / 2 + 1;
      a.x -= nx * push; a.y -= ny * push;
      b.x += nx * push; b.y += ny * push;
      const avx = Math.cos(a.angle) * a.speed, avy = Math.sin(a.angle) * a.speed;
      const bvx = Math.cos(b.angle) * b.speed, bvy = Math.sin(b.angle) * b.speed;
      const rel = (bvx - avx) * nx + (bvy - avy) * ny; // approaching when < 0
      if (rel >= 0) continue;
      const imp = -rel * 0.6;
      const avx2 = avx - nx * imp, avy2 = avy - ny * imp;
      const bvx2 = bvx + nx * imp, bvy2 = bvy + ny * imp;
      a.speed = avx2 * Math.cos(a.angle) + avy2 * Math.sin(a.angle);
      b.speed = bvx2 * Math.cos(b.angle) + bvy2 * Math.sin(b.angle);
      if (-rel > 150 && game.time - a.lastHit > 0.5 && game.time - b.lastHit > 0.5) {
        damageCar(game, a, Math.min(22, -rel * 0.04), true);
        damageCar(game, b, Math.min(22, -rel * 0.04), false);
        a.lastHit = game.time; b.lastHit = game.time;
        spawnParticles(game, (a.x + b.x) / 2, (a.y + b.y) / 2, 8, '#f1c40f', 180, 0.4, 3);
      }
    }
  }
}

export function updateWrecksAndBurning(game, dt) {
  for (const car of [...game.cars]) {
    if (!car.wreck) continue;
    car.burnT -= dt;
    if (game.rng.chance(0.5)) spawnParticles(game, car.x, car.y, 2, '#2c3e50', 40, 1.2, 8);
    if (game.rng.chance(0.4)) spawnParticles(game, car.x, car.y, 2, '#e67e22', 80, 0.4, 5);
    if (car.burnT <= 0) explodeCar(game, car);
  }
}

// ---- traffic ---------------------------------------------------------------
function carAhead(game, car, aheadDist) {
  const ax = car.x + Math.cos(car.angle) * aheadDist;
  const ay = car.y + Math.sin(car.angle) * aheadDist;
  for (const o of game.cars) {
    if (o === car || o.wreck) continue;
    if (dist2(ax, ay, o.x, o.y) < 55 * 55) return true;
  }
  const p = game.player;
  if (p.car && p.car !== car && dist2(ax, ay, p.car.x, p.car.y) < 55 * 55) return true;
  return false;
}

export function updateTrafficCar(game, car, dt) {
  const ai = car.ai;
  if (!ai) return;
  ai.turnCd -= dt;
  const crossing = ai.vertical ? ROAD_YS : ROAD_XS;
  const along = ai.vertical ? car.y : car.x;
  // At an intersection, sometimes commit to a turn onto the crossing road.
  for (const c of crossing) {
    if (Math.abs(along - c) < 34 && ai.turnCd <= 0) {
      ai.turnCd = 3;
      if (game.rng.chance(0.4)) {
        const ndir = game.rng.chance(0.5) ? 1 : -1;
        ai.vertical = !ai.vertical;
        ai.dir = ndir;
        ai.road = c;
        ai.lane = ndir > 0 ? 20 : -20;
        car.angle = ai.vertical ? (ndir > 0 ? Math.PI / 2 : -Math.PI / 2) : (ndir > 0 ? 0 : Math.PI);
      }
      break;
    }
  }
  const target = carAhead(game, car, 85) ? 0 : ai.cruise;
  car.speed += clamp(target - car.speed, -320 * dt, 260 * dt);
  const want = ai.vertical ? Math.PI / 2 * ai.dir : (ai.dir > 0 ? 0 : Math.PI);
  car.angle = angleLerp(car.angle, want, Math.min(1, 6 * dt));
  if (ai.vertical) {
    car.y += ai.dir * car.speed * dt;
    car.x += (ai.road + ai.lane - car.x) * Math.min(1, 3 * dt);
  } else {
    car.x += ai.dir * car.speed * dt;
    car.y += (ai.road + ai.lane - car.y) * Math.min(1, 3 * dt);
  }
  clampToWorld(car, 24);
}

// ---- pedestrians -----------------------------------------------------------
export function updatePed(game, ped, dt) {
  if (ped.dead) return;
  ped.walkPhase += dt * 8;
  if (ped.flee > 0) {
    ped.flee -= dt;
    const a = Math.atan2(ped.y - ped.fleeY, ped.x - ped.fleeX);
    ped.x += Math.cos(a) * ped.speed * 2.1 * dt;
    ped.y += Math.sin(a) * ped.speed * 2.1 * dt;
    ped.angle = a;
    clampToWorld(ped, 10);
    return;
  }
  const crossing = ped.vertical ? ROAD_YS : ROAD_XS;
  const along = ped.vertical ? ped.y : ped.x;
  for (const c of crossing) {
    if (Math.abs(along - c) < 26 && game.rng.chance(0.012)) {
      ped.vertical = !ped.vertical;
      ped.dir = game.rng.chance(0.5) ? 1 : -1;
      ped.road = c;
      break;
    }
  }
  if (ped.vertical) {
    ped.y += ped.dir * ped.speed * dt;
    ped.x += (ped.road + ped.side * (ROAD_HALF + 14) - ped.x) * Math.min(1, 3 * dt);
    ped.angle = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    ped.x += ped.dir * ped.speed * dt;
    ped.y += (ped.road + ped.side * (ROAD_HALF + 14) - ped.y) * Math.min(1, 3 * dt);
    ped.angle = ped.dir > 0 ? 0 : Math.PI;
  }
  clampToWorld(ped, 10);
}

// ---- police ----------------------------------------------------------------
export function spawnCruiser(game) {
  const p = game.player;
  // Spawn on a road just off the player's view.
  const vertical = game.rng.chance(0.5);
  const road = vertical ? nearestRoadX(p.x) : nearestRoadY(p.y);
  const off = game.rng.chance(0.5) ? 1 : -1;
  const along = (vertical ? p.y : p.x) + off * game.rng.range(550, 800);
  const x = vertical ? road : along;
  const y = vertical ? along : road;
  const car = createCar(x, y, 0, 'cruiser', '#f4f6f7', { police: true, ai: { vertical, dir: off > 0 ? -1 : 1, road, chase: true } });
  game.cars.push(car);
  return car;
}

export function spawnFootCop(game) {
  const p = game.player;
  const a = game.rng.range(0, Math.PI * 2);
  const cop = {
    x: p.x + Math.cos(a) * game.rng.range(300, 420),
    y: p.y + Math.sin(a) * game.rng.range(300, 420),
    angle: 0, hp: 80, shootCd: game.rng.range(0.3, 1), dead: false, walkPhase: 0,
  };
  clampToWorld(cop, 12);
  game.cops.push(cop);
  return cop;
}

function updateCruiser(game, car, dt) {
  const p = game.player;
  const tx = p.car ? p.car.x : p.x;
  const ty = p.car ? p.car.y : p.y;
  const ai = car.ai;
  const sameV = Math.abs(car.x - tx) < 110;
  const sameH = Math.abs(car.y - ty) < 110;
  let steer = 0;
  let throttle = 1;
  if ((sameV && ai.vertical) || (sameH && !ai.vertical) || dist2(car.x, car.y, tx, ty) < 260 * 260) {
    // Direct chase: steer at the player and ram.
    const want = Math.atan2(ty - car.y, tx - car.x);
    let d = want - car.angle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    steer = clamp(d * 2.2, -1, 1);
  } else {
    // Grid navigation: drive to the intersection on the player's road axis.
    const ix = ai.vertical ? car.x : nearestRoadX(tx);
    const iy = ai.vertical ? nearestRoadY(ty) : car.y;
    if (dist2(car.x, car.y, ix, iy) < 46 * 46) {
      ai.vertical = !ai.vertical;
      ai.road = ai.vertical ? ix : iy;
      ai.dir = ai.vertical ? (ty > car.y ? 1 : -1) : (tx > car.x ? 1 : -1);
    }
    const want = ai.vertical ? (ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (ai.dir > 0 ? 0 : Math.PI);
    let d = want - car.angle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    steer = clamp(d * 2.2, -1, 1);
    // Ease onto the lane centre of the road we follow.
    if (ai.vertical) car.x += (ai.road - car.x) * Math.min(1, 2 * dt);
    else car.y += (ai.road - car.y) * Math.min(1, 2 * dt);
  }
  moveCarPhysics(car, dt, throttle, steer, false);
  collideCarWithWorld(game, car);
  // Cruisers never stack on top of each other: push apart.
  for (const o of game.cars) {
    if (o === car || !o.police || o.wreck) continue;
    const dx = car.x - o.x, dy = car.y - o.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < 52 * 52 && d2 > 0.01) {
      const d = Math.sqrt(d2);
      car.x += (dx / d) * 26 * dt * 8;
      car.y += (dy / d) * 26 * dt * 8;
    }
  }
}

function updateFootCop(game, cop, dt) {
  const p = game.player;
  if (cop.dead) return;
  cop.walkPhase += dt * 9;
  const d = Math.sqrt(dist2(cop.x, cop.y, p.x, p.y));
  const want = Math.atan2(p.y - cop.y, p.x - cop.x);
  cop.angle = angleLerp(cop.angle, want, Math.min(1, 8 * dt));
  if (d > 200) {
    cop.x += Math.cos(cop.angle) * 240 * dt;
    cop.y += Math.sin(cop.angle) * 240 * dt;
  } else if (d > 60) {
    cop.x += Math.cos(cop.angle) * 150 * dt;
    cop.y += Math.sin(cop.angle) * 150 * dt;
  }
  collideBuildings(cop, 12, game.city);
  clampToWorld(cop, 12);
  cop.shootCd -= dt;
  if (d < 300 && cop.shootCd <= 0 && p.car === null) {
    cop.shootCd = 0.9;
    fireBullet(game, cop.x, cop.y, cop.angle + game.rng.range(-0.12, 0.12), 'cop');
  }
}

export function updatePolice(game, dt) {
  const stars = game.stars;
  const cruisers = game.cars.filter((c) => c.police && !c.wreck);
  const wantCruisers = stars === 0 ? 0 : Math.min(1 + stars, 5);
  const wantCops = stars >= 3 ? Math.min(stars, 4) : 0;
  game.spawnCd -= dt;
  if (stars > 0 && cruisers.length < wantCruisers && game.spawnCd <= 0) {
    spawnCruiser(game);
    game.spawnCd = 1.2;
  }
  const liveCops = game.cops.filter((c) => !c.dead);
  if (stars >= 3 && liveCops.length < wantCops && game.spawnCd <= 0) {
    spawnFootCop(game);
    game.spawnCd = 1.0;
  }
  for (const c of cruisers) updateCruiser(game, c, dt);
  for (const cop of game.cops) updateFootCop(game, cop, dt);
  game.cops = game.cops.filter((c) => !c.dead || game.time - (c.deadAt || 0) < 0);
  // Heat decays only while no police unit is close enough to see the player.
  let seen = false;
  for (const c of cruisers) if (dist2(c.x, c.y, game.player.x, game.player.y) < 620 * 620) { seen = true; break; }
  if (!seen) for (const cop of game.cops) if (!cop.dead && dist2(cop.x, cop.y, game.player.x, game.player.y) < 420 * 420) { seen = true; break; }
  if (!seen && game.heat > 0) addHeat(game, -HEAT_DECAY * dt);
  // Bust: held still next to the law for BUST_SECONDS.
  const p = game.player;
  if (stars > 0 && !p.dead) {
    let held = false;
    if (p.car === null) {
      for (const cop of game.cops) if (!cop.dead && dist2(cop.x, cop.y, p.x, p.y) < 30 * 30) { held = true; break; }
    } else if (Math.abs(p.car.speed) < 30) {
      for (const c of cruisers) if (dist2(c.x, c.y, p.car.x, p.car.y) < 70 * 70) { held = true; break; }
    }
    p.bustMeter = held ? p.bustMeter + dt : Math.max(0, p.bustMeter - dt * 2);
    if (p.bustMeter >= BUST_SECONDS) game.state = 'busted';
  } else {
    p.bustMeter = 0;
  }
}

// ---- gang (mission 5) ------------------------------------------------------
export function spawnGang(game, x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = game.rng.range(0, Math.PI * 2);
    const r = game.rng.range(20, 130);
    game.gang.push({
      x: x + Math.cos(a) * r, y: y + Math.sin(a) * r,
      angle: 0, hp: 70, shootCd: game.rng.range(0.4, 1.4), dead: false, walkPhase: game.rng.range(0, 6),
    });
  }
}

export function updateGang(game, dt) {
  const p = game.player;
  for (const g of game.gang) {
    if (g.dead) continue;
    g.walkPhase += dt * 8;
    const d = Math.sqrt(dist2(g.x, g.y, p.x, p.y));
    const want = Math.atan2(p.y - g.y, p.x - g.x);
    g.angle = angleLerp(g.angle, want, Math.min(1, 8 * dt));
    if (d > 230) {
      g.x += Math.cos(g.angle) * 170 * dt;
      g.y += Math.sin(g.angle) * 170 * dt;
    }
    collideBuildings(g, 12, game.city);
    clampToWorld(g, 12);
    g.shootCd -= dt;
    if (d < 340 && g.shootCd <= 0) {
      g.shootCd = game.rng.range(0.8, 1.4);
      fireBullet(game, g.x, g.y, g.angle + game.rng.range(-0.14, 0.14), 'gang');
    }
  }
}

// ---- the player ------------------------------------------------------------
export function nearestCar(game, x, y, maxD) {
  let best = null, bestD = maxD * maxD;
  for (const c of game.cars) {
    if (c.wreck) continue;
    const d = dist2(x, y, c.x, c.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

export function enterCar(game, car) {
  const p = game.player;
  if (car.ai && car.ai.chase) return false; // a chasing cruiser is never free
  if (car.driver) {
    // Carjack: the driver flees on foot.
    const d = spawnPed(game, car.x + 30, car.y);
    d.flee = 4; d.fleeX = p.x; d.fleeY = p.y;
    car.driver = null;
    car.ai = null;
    addHeat(game, 15);
    game.stats.carsStolen++;
    game.toast(`Carjacked the ${car.name} — wanted level up!`);
  } else if (car.police) {
    addHeat(game, 20);
    game.toast('You stole a police cruiser!');
  }
  car.parked = false;
  car.ai = null;
  p.car = car;
  p.x = car.x; p.y = car.y;
  return true;
}

export function exitCar(game) {
  const p = game.player;
  const car = p.car;
  if (!car) return;
  p.car = null;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  p.angle = car.angle;
  car.speed *= 0.4;
}

export function updatePlayer(game, dt, input, aimWorld) {
  const p = game.player;
  if (p.dead) return;
  p.fireCd -= dt;
  p.hurtCd -= dt;
  if (p.car) {
    const car = p.car;
    let throttle = 0;
    if (input.keys.has('KeyW')) throttle = 1;
    if (input.keys.has('KeyS')) throttle = -1;
    let steer = 0;
    if (input.keys.has('KeyA')) steer -= 1;
    if (input.keys.has('KeyD')) steer += 1;
    const handbrake = input.keys.has('Space');
    car.brake = throttle < 0 || handbrake;
    moveCarPhysics(car, dt, throttle, steer, handbrake);
    collideCarWithWorld(game, car);
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    if (car.hp < 35 && game.rng.chance(0.3)) spawnParticles(game, car.x, car.y, 1, '#2c3e50', 30, 1.0, 7);
    return;
  }
  // On foot.
  const sprint = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
  const speed = sprint ? 335 : 225;
  let mx = 0, my = 0;
  if (input.keys.has('KeyA')) mx -= 1;
  if (input.keys.has('KeyD')) mx += 1;
  if (input.keys.has('KeyW')) my -= 1;
  if (input.keys.has('KeyS')) my += 1;
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my);
    p.x += (mx / len) * speed * dt;
    p.y += (my / len) * speed * dt;
  }
  collideBuildings(p, 13, game.city);
  clampToWorld(p, 13);
  p.angle = Math.atan2(aimWorld.y - p.y, aimWorld.x - p.x);
  if (input.mouse.down && p.fireCd <= 0 && p.ammo > 0) {
    p.fireCd = 0.13;
    p.ammo--;
    fireBullet(game, p.x, p.y, p.angle, 'player');
    if (game.stars > 0) addHeat(game, 0.4);
  }
}

export function updateCarsAndCollisions(game, dt) {
  for (const car of [...game.cars]) {
    if (car.wreck) continue;
    if (car.ai && !car.police) updateTrafficCar(game, car, dt);
    else if (!car.ai && car !== game.player.car && !car.parked) {
      // An abandoned car rolls to a stop.
      car.speed *= Math.pow(0.3, dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      collideCarWithWorld(game, car);
    }
  }
  collideCars(game);
  updateWrecksAndBurning(game, dt);
  // No top-ups while staging screenshots: a fresh spawn on the player's path
  // would wedge the staged car. (Recycling far-away cars stays on.)
  if (game.staging) return;
  // Keep traffic topped up near the player; recycle cars that drifted far away.
  const p = game.player;
  let traffic = 0;
  for (const car of [...game.cars]) {
    if (car.ai && !car.police) {
      traffic++;
      if (dist2(car.x, car.y, p.x, p.y) > 1500 * 1500) {
        game.cars.splice(game.cars.indexOf(car), 1);
        traffic--;
      }
    }
  }
  while (traffic < 12) { spawnTrafficCar(game); traffic++; }
  // Keep pedestrians topped up too.
  game.peds = game.peds.filter((ped) => !ped.dead || ped.deadAt);
  let alive = 0;
  for (const ped of [...game.peds]) {
    if (ped.dead) continue;
    alive++;
    if (dist2(ped.x, ped.y, p.x, p.y) > 1400 * 1400) {
      game.peds.splice(game.peds.indexOf(ped), 1);
      alive--;
    }
  }
  while (alive < 22) { spawnPed(game); alive++; }
}
