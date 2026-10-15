// Tiny event emitter shared by the desktop, apps and the 3D scene.
//   const off = bus.on('achievement:unlock', (a) => ...);  bus.emit('theme:change', 'dark');  off();
const map = new Map(); // event -> Set<fn>

export function on(event, fn) {
  let set = map.get(event);
  if (!set) map.set(event, (set = new Set()));
  set.add(fn);
  return () => off(event, fn);
}

export function once(event, fn) {
  const stop = on(event, (...a) => { stop(); fn(...a); });
  return stop;
}

export function off(event, fn) {
  const set = map.get(event);
  if (!set) return;
  set.delete(fn);
  if (!set.size) map.delete(event);
}

export function emit(event, ...args) {
  const set = map.get(event);
  if (!set) return;
  for (const fn of [...set]) {
    try { fn(...args); } catch (e) { console.error(`[bus] handler for "${event}" threw`, e); }
  }
}

export const bus = { on, once, off, emit };
