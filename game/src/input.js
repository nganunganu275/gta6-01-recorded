// Keyboard + mouse state. Edge-triggered presses live in `justPressed`,
// cleared once per frame by main.js after the update step.
export const keys = new Set();
export const justPressed = new Set();
export const mouse = { x: 0, y: 0, down: false, clicked: false };

const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyE', 'KeyP', 'Escape', 'KeyM', 'KeyR']);

export function bindInput(canvas) {
  window.addEventListener('keydown', (e) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!e.repeat) justPressed.add(e.code);
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); mouse.down = false; });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('mousedown', (e) => { if (e.button === 0) { mouse.down = true; mouse.clicked = true; } });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function endFrameInput() {
  justPressed.clear();
  mouse.clicked = false;
}

export function axis() {
  let x = 0, y = 0;
  if (keys.has('KeyA')) x -= 1;
  if (keys.has('KeyD')) x += 1;
  if (keys.has('KeyW')) y -= 1;
  if (keys.has('KeyS')) y += 1;
  return { x, y };
}
