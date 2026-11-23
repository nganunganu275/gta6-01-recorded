// Porto Verde city generation: deterministic from a seed — roads, buildings,
// palms, parks and the fixed activity spots (safehouse, spray shop, hospital,
// gun shop, chop shop, taxi stand, docks, foundry).
import { WORLD_W, WORLD_H, ROAD_XS, ROAD_YS, ROAD_HALF, BEACH_Y, OCEAN_Y, PALETTE } from './config.js';
import { makeRng } from './random.js';

// Activity spots sit just off a road so the player can reach them on foot or by car.
export const SPOTS = {
  safehouse: { x: 760, y: 760, label: 'Safehouse', icon: 'H', color: '#2ecc71' },
  spray: { x: 1600, y: 1180, label: 'Spray Shop', icon: 'S', color: '#e67e22' },
  hospital: { x: 2500, y: 760, label: 'Hospital', icon: '+', color: '#e74c3c' },
  gunshop: { x: 760, y: 2080, label: 'Gun Shop', icon: 'G', color: '#f1c40f' },
  chopshop: { x: 2950, y: 2080, label: 'Chop Shop', icon: 'C', color: '#9b59b6' },
  taxi: { x: 1180, y: 1630, label: 'Taxi Stand', icon: 'T', color: '#3498db' },
  docks: { x: 380, y: 2320, label: 'The Docks', icon: 'D', color: '#1abc9c' },
  foundry: { x: 2900, y: 1420, label: 'Foundry Yard', icon: 'F', color: '#e74c3c' },
  marina: { x: 3350, y: 600, label: 'Marina', icon: 'M', color: '#3498db' },
};

export function onRoad(x, y) {
  for (const rx of ROAD_XS) if (Math.abs(x - rx) <= ROAD_HALF) return true;
  for (const ry of ROAD_YS) if (Math.abs(y - ry) <= ROAD_HALF) return true;
  return false;
}

export function nearestRoadX(x) {
  let best = ROAD_XS[0];
  for (const rx of ROAD_XS) if (Math.abs(rx - x) < Math.abs(best - x)) best = rx;
  return best;
}
export function nearestRoadY(y) {
  let best = ROAD_YS[0];
  for (const ry of ROAD_YS) if (Math.abs(ry - y) < Math.abs(best - y)) best = ry;
  return best;
}

function blockHasSpot(x0, y0, x1, y1) {
  for (const s of Object.values(SPOTS)) {
    if (s.x > x0 - 90 && s.x < x1 + 90 && s.y > y0 - 90 && s.y < y1 + 90) return true;
  }
  return false;
}

export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const palms = [];
  const parks = [];
  // Blocks are the rectangles between neighbouring roads.
  const xs = [0, ...ROAD_XS, WORLD_W];
  const ys = [0, ...ROAD_YS, BEACH_Y];
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const x0 = xs[i] + (i === 0 ? 0 : ROAD_HALF) + 26;
      const x1 = xs[i + 1] - (i === xs.length - 2 ? 0 : ROAD_HALF) - 26;
      const y0 = ys[j] + (j === 0 ? 0 : ROAD_HALF) + 26;
      const y1 = ys[j + 1] - (j === ys.length - 2 ? 0 : ROAD_HALF) - 26;
      if (x1 - x0 < 70 || y1 - y0 < 70) continue;
      if (blockHasSpot(x0, y0, x1, y1)) {
        // Keep a plaza around activity spots: a few palms, no buildings.
        for (let k = 0; k < 4; k++) palms.push({ x: rng.range(x0, x1), y: rng.range(y0, y1), s: rng.range(0.8, 1.3) });
        continue;
      }
      if (rng.chance(0.18)) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        for (let k = 0; k < 6; k++) palms.push({ x: rng.range(x0, x1), y: rng.range(y0, y1), s: rng.range(0.8, 1.4) });
        continue;
      }
      const n = rng.int(1, 3);
      for (let k = 0; k < n; k++) {
        const w = rng.range(90, Math.min(200, x1 - x0));
        const h = rng.range(70, Math.min(170, y1 - y0));
        const x = rng.range(x0, Math.max(x0 + 1, x1 - w));
        const y = rng.range(y0, Math.max(y0 + 1, y1 - h));
        buildings.push({
          x, y, w, h,
          roof: rng.pick(PALETTE.buildingRoofs),
          tall: rng.chance(0.25),
          windows: rng.int(2, 5),
        });
      }
      if (rng.chance(0.5)) palms.push({ x: rng.range(x0, x1), y: rng.range(y0, y1), s: rng.range(0.8, 1.2) });
    }
  }
  // Palm line along the beach.
  for (let x = 60; x < WORLD_W; x += 90) {
    if (rng.chance(0.7)) palms.push({ x: x + rng.range(-20, 20), y: BEACH_Y + rng.range(8, 60), s: rng.range(1.0, 1.5) });
  }
  return { buildings, palms, parks, spots: SPOTS, seed };
}

// Push a circle out of every building rect it overlaps; returns true on a hit.
export function collideBuildings(ent, r, city) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(ent.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(ent.y, b.y + b.h));
    const dx = ent.x - cx, dy = ent.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        ent.x = cx + (dx / d) * r;
        ent.y = cy + (dy / d) * r;
      } else {
        ent.x = b.x - r;
      }
    }
  }
  return hit;
}

export function clampToWorld(ent, r) {
  ent.x = Math.max(r, Math.min(WORLD_W - r, ent.x));
  // The ocean is a wall: nobody drives into the sea.
  ent.y = Math.max(r, Math.min(OCEAN_Y - 12 - r, ent.y));
}
