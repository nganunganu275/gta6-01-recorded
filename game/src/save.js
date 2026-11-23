// Save / load via localStorage. Autosaves on mission completion and every
// 60 seconds; the start screen offers Continue when a save exists.
import { SAVE_KEY } from './config.js';

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
}

export function saveGame(game) {
  try {
    const p = game.player;
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      v: 1,
      money: p.money,
      hp: p.hp,
      ammo: p.ammo,
      x: Math.round(p.x),
      y: Math.round(p.y),
      missionIndex: game.missions.index,
      missionsDone: game.stats.missionsDone,
      kills: game.stats.kills,
      carsStolen: game.stats.carsStolen,
      savedAt: Date.now(),
    }));
    return true;
  } catch {
    return false;
  }
}

export function loadGameData() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* storage unavailable */ }
}
