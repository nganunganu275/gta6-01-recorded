// Porto Verde — shared tuning, world layout and palette.
// The city is a 3600x2700 grid: roads every 450 units, ocean along the south edge.
export const WORLD_W = 3600;
export const WORLD_H = 2700;
export const ROAD_GAP = 450;
export const ROAD_HALF = 50;
export const ROAD_XS = [225, 675, 1125, 1575, 2025, 2475, 2925, 3375];
export const ROAD_YS = [225, 675, 1125, 1575, 2025, 2475];
export const BEACH_Y = 2470;
export const OCEAN_Y = 2570;
export const DEFAULT_SEED = 20261123;

export const DISTRICTS = [
  { name: 'Northgate', x0: 0, y0: 0, x1: 1800, y1: 900 },
  { name: 'Saltmarket', x0: 1800, y0: 0, x1: 3600, y1: 900 },
  { name: 'Palm Row', x0: 0, y0: 900, x1: 1800, y1: 1800 },
  { name: 'Foundry', x0: 1800, y0: 900, x1: 3600, y1: 1800 },
  { name: 'The Docks', x0: 0, y0: 1800, x1: 1800, y1: 2470 },
  { name: 'Marina South', x0: 1800, y0: 1800, x1: 3600, y1: 2470 },
];

export function districtAt(x, y) {
  if (y >= BEACH_Y) return 'Coral Beach';
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
  return 'Porto Verde';
}

// Wanted heat thresholds: heat >= each value earns that star (1..5).
export const STAR_HEAT = [10, 30, 50, 70, 90];
export const HEAT_DECAY = 1.6; // per second while no cop can see the player

export const CAR_MODELS = {
  clipper: { name: 'Clipper', accel: 430, top: 560, grip: 2.6, hp: 100, len: 46, wid: 22 },
  sunrunner: { name: 'Sunrunner', accel: 560, top: 770, grip: 3.1, hp: 90, len: 46, wid: 22 },
  hauler: { name: 'Hauler', accel: 300, top: 430, grip: 2.1, hp: 170, len: 58, wid: 26 },
  boxer: { name: 'Boxer', accel: 330, top: 470, grip: 2.2, hp: 145, len: 54, wid: 24 },
  cruiser: { name: 'Interceptor', accel: 530, top: 730, grip: 3.0, hp: 130, len: 48, wid: 23 },
  vortex: { name: 'Vortex GT', accel: 650, top: 850, grip: 3.3, hp: 80, len: 46, wid: 22 },
};
export const TRAFFIC_MODELS = ['clipper', 'clipper', 'boxer', 'hauler', 'sunrunner'];
export const CAR_COLORS = ['#c0392b', '#2980b9', '#f1c40f', '#27ae60', '#8e44ad', '#e67e22', '#ecf0f1', '#2c3e50', '#16a085', '#d35400'];

export const PALETTE = {
  ground: '#c8ad7d',
  groundAlt: '#bfa175',
  road: '#3a3a42',
  roadEdge: '#2e2e35',
  sidewalk: '#b3a184',
  lane: '#e8d44d',
  ocean: '#2b7ba6',
  oceanDeep: '#1d5c80',
  sand: '#ecd9a0',
  buildingRoofs: ['#d98c5f', '#c96f4a', '#e0a458', '#9db38a', '#7fa3b8', '#b78fc4', '#d97b7b', '#8fb8a8'],
  wall: '#8a7a63',
  park: '#7ba05b',
};

export const PRICES = { spray: 100, heal: 50, ammo: 40, ammoRounds: 60 };
export const SAVE_KEY = 'porto-verde-save-v1';
export const BUST_SECONDS = 2.2;
