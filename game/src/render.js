// Canvas rendering: the city, every entity, effects, and the minimap.
// The HUD text lives in the DOM (main.js); this file draws the world.
import { WORLD_W, WORLD_H, ROAD_XS, ROAD_YS, ROAD_HALF, BEACH_Y, OCEAN_Y, PALETTE, CAR_MODELS } from './config.js';
import { clamp, lerp } from './random.js';
import { missionMarker, missionStartPos, taxiMarker } from './missions.js';

export function createCamera() { return { x: 1800, y: 1350 }; }

export function updateCamera(cam, game, w, h, dt) {
  const p = game.player;
  const look = p.car ? 90 : 40;
  const tx = p.x + Math.cos(p.angle) * look;
  const ty = p.y + Math.sin(p.angle) * look;
  const k = Math.min(1, 5 * dt);
  cam.x = lerp(cam.x, tx, k);
  cam.y = lerp(cam.y, ty, k);
  cam.x = clamp(cam.x, w / 2 - 60, WORLD_W - w / 2 + 60);
  cam.y = clamp(cam.y, h / 2 - 60, WORLD_H - h / 2 + 60);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawRoads(ctx, game) {
  const { city } = game;
  void city;
  ctx.fillStyle = PALETTE.sidewalk;
  for (const rx of ROAD_XS) ctx.fillRect(rx - ROAD_HALF - 14, 0, (ROAD_HALF + 14) * 2, BEACH_Y);
  for (const ry of ROAD_YS) ctx.fillRect(0, ry - ROAD_HALF - 14, WORLD_W, (ROAD_HALF + 14) * 2);
  ctx.fillStyle = PALETTE.road;
  for (const rx of ROAD_XS) ctx.fillRect(rx - ROAD_HALF, 0, ROAD_HALF * 2, BEACH_Y);
  for (const ry of ROAD_YS) ctx.fillRect(0, ry - ROAD_HALF, WORLD_W, ROAD_HALF * 2);
  // Centre dashes.
  ctx.strokeStyle = PALETTE.lane;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  ctx.beginPath();
  for (const rx of ROAD_XS) { ctx.moveTo(rx, 0); ctx.lineTo(rx, BEACH_Y); }
  for (const ry of ROAD_YS) { ctx.moveTo(0, ry); ctx.lineTo(WORLD_W, ry); }
  ctx.stroke();
  ctx.setLineDash([]);
  // Crosswalks at every intersection.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const rx of ROAD_XS) {
    for (const ry of ROAD_YS) {
      for (let i = -2; i <= 2; i++) {
        ctx.fillRect(rx - ROAD_HALF + 8, ry + i * 16 - 4, 18, 8);
        ctx.fillRect(rx + ROAD_HALF - 26, ry + i * 16 - 4, 18, 8);
      }
    }
  }
}

function drawBuildings(ctx, game) {
  for (const b of game.city.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
    ctx.fillStyle = PALETTE.wall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    // Rooftop detail: a lighter inset + a few vents.
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(b.x + 10, b.y + 10, b.w - 20, b.h - 20);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    const cols = Math.max(1, Math.floor(b.w / 46));
    const rows = Math.max(1, Math.floor(b.h / 46));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) ctx.fillRect(b.x + 14 + i * 46, b.y + 14 + j * 46, 12, 12);
    if (b.tall) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(b.x + b.w * 0.3, b.y + b.h * 0.3, b.w * 0.4, b.h * 0.4);
    }
  }
}

function drawPalm(ctx, x, y, s) {
  ctx.strokeStyle = '#7a5c38';
  ctx.lineWidth = 4 * s;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 3 * s, y - 10 * s); ctx.stroke();
  ctx.strokeStyle = '#2e8b57';
  ctx.lineWidth = 3 * s;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x + 3 * s, y - 10 * s);
    ctx.quadraticCurveTo(x + Math.cos(a) * 12 * s, y - 10 * s + Math.sin(a) * 12 * s - 4 * s, x + Math.cos(a) * 18 * s, y - 10 * s + Math.sin(a) * 18 * s + 4 * s);
    ctx.stroke();
  }
}

function drawSpots(ctx, game) {
  for (const s of Object.values(game.city.spots)) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.arc(s.x + 2, s.y + 3, 20, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = s.color;
    ctx.beginPath(); ctx.arc(s.x, s.y, 19, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(s.icon, s.x, s.y + 1);
  }
}

function drawMarkers(ctx, game) {
  const t = game.time;
  const pulse = 1 + Math.sin(t * 4) * 0.12;
  const m = game.missions;
  const marker = m.started ? missionMarker(m) : missionStartPos(m);
  if (marker && !m.done) {
    const g = ctx.createLinearGradient(0, marker.y - 90, 0, marker.y);
    g.addColorStop(0, 'rgba(255,215,0,0)');
    g.addColorStop(1, 'rgba(255,215,0,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(marker.x - 10, marker.y - 90, 20, 90);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(marker.x, marker.y, 26 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.moveTo(marker.x, marker.y - 14); ctx.lineTo(marker.x + 10, marker.y); ctx.lineTo(marker.x, marker.y + 14); ctx.lineTo(marker.x - 10, marker.y);
    ctx.closePath(); ctx.fill();
  }
  const tm = taxiMarker(game);
  if (tm) {
    ctx.strokeStyle = tm.color;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(tm.x, tm.y, 22 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = tm.color;
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('$', tm.x, tm.y + 1);
  }
}

function drawCarShape(ctx, car, flashing) {
  const m = CAR_MODELS[car.model];
  const len = m.len, wid = m.wid;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-len / 2 + 3, -wid / 2 + 4, len, wid);
  // Wheels.
  ctx.fillStyle = '#111';
  ctx.fillRect(-len / 2 + 4, -wid / 2 - 3, 12, 6);
  ctx.fillRect(-len / 2 + 4, wid / 2 - 3, 12, 6);
  ctx.fillRect(len / 2 - 16, -wid / 2 - 3, 12, 6);
  ctx.fillRect(len / 2 - 16, wid / 2 - 3, 12, 6);
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -len / 2, -wid / 2, len, wid, 7);
  ctx.fill();
  if (car.police) {
    ctx.fillStyle = '#1c2733';
    ctx.fillRect(-6, -wid / 2, 16, wid);
    ctx.fillStyle = flashing ? '#ff2d2d' : '#2d7bff';
    ctx.fillRect(-8, -wid / 2 + 3, 7, 6);
    ctx.fillStyle = flashing ? '#2d7bff' : '#ff2d2d';
    ctx.fillRect(-8, wid / 2 - 9, 7, 6);
  }
  // Windshield + roof.
  ctx.fillStyle = 'rgba(160,210,235,0.9)';
  ctx.fillRect(len / 2 - 20, -wid / 2 + 4, 8, wid - 8);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-8, -wid / 2 + 4, 18, wid - 8);
  // Headlights.
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(len / 2 - 3, -wid / 2 + 2, 3, 5);
  ctx.fillRect(len / 2 - 3, wid / 2 - 7, 3, 5);
  // Brake lights.
  if (car.brake) {
    ctx.fillStyle = '#ff2222';
    ctx.fillRect(-len / 2, -wid / 2 + 2, 3, 5);
    ctx.fillRect(-len / 2, wid / 2 - 7, 3, 5);
  }
  // Damage: dark patches + smoke handled by particles.
  if (car.hp < car.maxHp * 0.5) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-len / 2 + 2, -wid / 2 + 2, 14, wid - 4);
  }
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, body, skin, gun) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(1, 2, 11, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(angle);
  if (gun) {
    ctx.fillStyle = '#222';
    ctx.fillRect(8, -2, 16, 4);
  }
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(3, 0, 6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function drawGame(ctx, game, w, h) {
  const cam = game.cam;
  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2 - cam.x, h / 2 - cam.y);
  // Ocean + beach along the south edge.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(0, BEACH_Y, WORLD_W, OCEAN_Y - BEACH_Y);
  const og = ctx.createLinearGradient(0, OCEAN_Y, 0, WORLD_H);
  og.addColorStop(0, PALETTE.ocean);
  og.addColorStop(1, PALETTE.oceanDeep);
  ctx.fillStyle = og;
  ctx.fillRect(0, OCEAN_Y, WORLD_W, WORLD_H - OCEAN_Y);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = 0; x < WORLD_W; x += 90) {
    ctx.moveTo(x, OCEAN_Y + 14 + Math.sin(game.time * 0.8 + x * 0.01) * 4);
    ctx.lineTo(x + 45, OCEAN_Y + 14 + Math.sin(game.time * 0.8 + x * 0.01) * 4);
  }
  ctx.stroke();
  // Parks.
  for (const pk of game.city.parks) {
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
  }
  drawRoads(ctx, game);
  drawBuildings(ctx, game);
  for (const pl of game.city.palms) drawPalm(ctx, pl.x, pl.y, pl.s);
  drawSpots(ctx, game);
  drawMarkers(ctx, game);
  // Wrecks.
  for (const wr of game.wrecks) {
    ctx.save();
    ctx.translate(wr.x, wr.y);
    ctx.rotate(wr.angle);
    ctx.fillStyle = '#141414';
    const m = CAR_MODELS[wr.model];
    roundRect(ctx, -m.len / 2, -m.wid / 2, m.len, m.wid, 7);
    ctx.fill();
    ctx.restore();
  }
  // Cars.
  const flashing = Math.floor(game.time * 2.5) % 2 === 0;
  for (const car of game.cars) drawCarShape(ctx, car, flashing);
  // Pedestrians.
  for (const ped of game.peds) {
    if (ped.dead) continue;
    const bob = Math.sin(ped.walkPhase) * 1.5;
    drawPerson(ctx, ped.x, ped.y + bob, ped.angle, ped.color, '#e8b98a', false);
  }
  // Foot cops.
  for (const cop of game.cops) {
    if (cop.dead) continue;
    drawPerson(ctx, cop.x, cop.y, cop.angle, '#1c3a5e', '#e8b98a', true);
  }
  // Gang.
  for (const g of game.gang) {
    if (g.dead) continue;
    drawPerson(ctx, g.x, g.y, g.angle, '#8b1a1a', '#d9a06b', true);
  }
  // The player on foot.
  const p = game.player;
  if (!p.dead && !p.car) drawPerson(ctx, p.x, p.y, p.angle, '#ff6b35', '#e8b98a', true);
  // Bullets.
  ctx.fillStyle = '#ffe14d';
  for (const b of game.bullets) {
    ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
  }
  // Particles.
  for (const pt of game.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  // Wanted / low-health vignette.
  if (game.stars > 0 || game.player.hp < 35) {
    const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.72);
    vg.addColorStop(0, 'rgba(200,0,0,0)');
    vg.addColorStop(1, game.player.hp < 35 ? 'rgba(200,0,0,0.45)' : 'rgba(200,0,0,0.18)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }
}

// ---- minimap ---------------------------------------------------------------
export function drawMinimap(mctx, game, size) {
  const s = size / WORLD_W;
  mctx.clearRect(0, 0, size, size);
  mctx.save();
  mctx.beginPath();
  mctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  mctx.clip();
  mctx.fillStyle = '#3a3a42';
  mctx.fillRect(0, 0, size, size);
  mctx.fillStyle = PALETTE.ocean;
  mctx.fillRect(0, OCEAN_Y * s, size, (WORLD_H - OCEAN_Y) * s);
  mctx.fillStyle = '#c8ad7d';
  mctx.fillRect(0, 0, size, BEACH_Y * s);
  mctx.strokeStyle = '#55555e';
  mctx.lineWidth = Math.max(2, ROAD_HALF * 2 * s);
  mctx.beginPath();
  for (const rx of ROAD_XS) { mctx.moveTo(rx * s, 0); mctx.lineTo(rx * s, BEACH_Y * s); }
  for (const ry of ROAD_YS) { mctx.moveTo(0, ry * s); mctx.lineTo(WORLD_W * s, ry * s); }
  mctx.stroke();
  const p = game.player;
  const flashing = Math.floor(game.time * 2.5) % 2 === 0;
  // Police blips.
  for (const car of game.cars) {
    if (!car.police || car.wreck) continue;
    mctx.fillStyle = flashing ? '#ff2d2d' : '#2d7bff';
    mctx.beginPath(); mctx.arc(car.x * s, car.y * s, 3.5, 0, Math.PI * 2); mctx.fill();
  }
  // Mission marker.
  const m = game.missions;
  const marker = !m.done ? (m.started ? missionMarker(m) : missionStartPos(m)) : null;
  if (marker) {
    mctx.fillStyle = '#ffd700';
    mctx.beginPath(); mctx.arc(marker.x * s, marker.y * s, 5, 0, Math.PI * 2); mctx.fill();
  }
  const tm = taxiMarker(game);
  if (tm) {
    mctx.fillStyle = '#3498db';
    mctx.beginPath(); mctx.arc(tm.x * s, tm.y * s, 4, 0, Math.PI * 2); mctx.fill();
  }
  // Player arrow.
  mctx.save();
  mctx.translate(p.x * s, p.y * s);
  mctx.rotate(p.angle);
  mctx.fillStyle = '#fff';
  mctx.strokeStyle = '#111';
  mctx.lineWidth = 1;
  mctx.beginPath();
  mctx.moveTo(7, 0); mctx.lineTo(-5, -5); mctx.lineTo(-5, 5);
  mctx.closePath(); mctx.fill(); mctx.stroke();
  mctx.restore();
  mctx.restore();
  // Ring.
  mctx.strokeStyle = 'rgba(255,255,255,0.85)';
  mctx.lineWidth = 2;
  mctx.beginPath();
  mctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  mctx.stroke();
}
