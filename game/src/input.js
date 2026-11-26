// Keyboard state, normalised into the one shape the flight model asks for.

const DOWN = new Set();
const TRACKED = new Set([
  'KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE', 'ShiftLeft', 'ShiftRight',
  'ControlLeft', 'ControlRight', 'KeyC', 'KeyF', 'KeyP', 'KeyR', 'KeyH', 'KeyG', 'Space', 'Escape', 'Enter',
]);

export function bindInput(handlers) {
  window.addEventListener('keydown', (event) => {
    if (TRACKED.has(event.code)) event.preventDefault();
    if (event.repeat) return;
    DOWN.add(event.code);
    if (event.code === 'KeyC') handlers.camera?.();
    if (event.code === 'KeyP' || event.code === 'Escape') handlers.pause?.();
    if (event.code === 'KeyR') handlers.restart?.();
    if (event.code === 'KeyH') handlers.hud?.();
    if (event.code === 'KeyF') handlers.flaps?.();
    if (event.code === 'KeyG') handlers.drop?.();
  });
  window.addEventListener('keyup', (event) => DOWN.delete(event.code));
  window.addEventListener('blur', () => DOWN.clear());
}

export function readInput() {
  return {
    pitch: (DOWN.has('KeyW') ? 1 : 0) - (DOWN.has('KeyS') ? 1 : 0),
    roll: (DOWN.has('KeyD') ? 1 : 0) - (DOWN.has('KeyA') ? 1 : 0),
    yaw: (DOWN.has('KeyE') ? 1 : 0) - (DOWN.has('KeyQ') ? 1 : 0),
    throttleUp: DOWN.has('ShiftLeft') || DOWN.has('ShiftRight'),
    throttleDown: DOWN.has('ControlLeft') || DOWN.has('ControlRight') || DOWN.has('Space'),
  };
}

export function clearInput() {
  DOWN.clear();
}

export const inputIdle = { pitch: 0, roll: 0, yaw: 0, throttleUp: false, throttleDown: false };
