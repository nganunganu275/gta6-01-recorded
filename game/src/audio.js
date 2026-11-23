// Procedural WebAudio sound — no audio files, everything is synthesised.
// The context only starts after the first user gesture (browsers require it),
// so screenshot staging stays silent and deterministic.
let ctx = null;
let master = null;
let engineOsc = null;
let engineGain = null;
let sirenOsc = null;
let sirenGain = null;
let sirenTimer = null;
let muted = false;
let bassTimer = null;

function ensure() {
  if (ctx) return true;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    return true;
  } catch {
    return false;
  }
}

export function unlockAudio() {
  if (ensure() && ctx.state === 'suspended') ctx.resume();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}
export function isMuted() { return muted; }

function blip(freq, dur, type, vol, slideTo) {
  if (!ensure() || muted || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol || 0.2, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function noiseBurst(dur, vol, filterFreq) {
  if (!ensure() || muted || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = filterFreq || 1200;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol || 0.3, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t);
}

export function sfxShot() { noiseBurst(0.12, 0.35, 2500); blip(160, 0.08, 'square', 0.12, 60); }
export function sfxHit() { blip(220, 0.06, 'triangle', 0.2, 140); }
export function sfxPickup() { blip(660, 0.09, 'sine', 0.25); setTimeout(() => blip(990, 0.12, 'sine', 0.25), 70); }
export function sfxCash() { blip(880, 0.08, 'sine', 0.22); setTimeout(() => blip(1174, 0.1, 'sine', 0.22), 80); setTimeout(() => blip(1568, 0.14, 'sine', 0.22), 160); }
export function sfxCrash() { noiseBurst(0.25, 0.4, 700); }
export function sfxExplode() { noiseBurst(0.7, 0.5, 400); blip(80, 0.5, 'sine', 0.4, 30); }
export function sfxBusted() { blip(392, 0.25, 'square', 0.15); setTimeout(() => blip(311, 0.4, 'square', 0.15), 250); }
export function sfxClick() { blip(1200, 0.04, 'sine', 0.12); }

export function engineStart() {
  if (!ensure() || engineOsc) return;
  engineOsc = ctx.createOscillator();
  engineOsc.type = 'sawtooth';
  engineGain = ctx.createGain();
  engineGain.gain.value = 0;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 400;
  engineOsc.connect(f); f.connect(engineGain); engineGain.connect(master);
  engineOsc.start();
}
export function engineUpdate(speed01, driving) {
  if (!engineOsc) return;
  const t = ctx.currentTime;
  engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, t, 0.05);
  engineGain.gain.setTargetAtTime(driving && !muted ? 0.05 + speed01 * 0.06 : 0, t, 0.1);
}
export function engineStop() {
  if (engineOsc) { try { engineOsc.stop(); } catch { /* already stopped */ } engineOsc = null; engineGain = null; }
}

export function sirenStart() {
  if (!ensure() || sirenOsc) return;
  sirenOsc = ctx.createOscillator();
  sirenOsc.type = 'triangle';
  sirenGain = ctx.createGain();
  sirenGain.gain.value = 0.045;
  sirenOsc.connect(sirenGain); sirenGain.connect(master);
  sirenOsc.start();
  let hi = true;
  sirenTimer = setInterval(() => {
    if (!sirenOsc) return;
    sirenOsc.frequency.setValueAtTime(hi ? 960 : 720, ctx.currentTime);
    hi = !hi;
  }, 420);
}
export function sirenStop() {
  if (sirenTimer) clearInterval(sirenTimer);
  sirenTimer = null;
  if (sirenOsc) { try { sirenOsc.stop(); } catch { /* already stopped */ } sirenOsc = null; sirenGain = null; }
}

// A lazy bass loop for the menu and free roam: four notes, soft triangle.
export function bassStart() {
  if (!ensure() || bassTimer) return;
  const notes = [55, 55, 65.4, 49];
  let i = 0;
  bassTimer = setInterval(() => {
    if (!muted) blip(notes[i % notes.length], 0.42, 'triangle', 0.1);
    i++;
  }, 480);
}
export function bassStop() {
  if (bassTimer) clearInterval(bassTimer);
  bassTimer = null;
}
