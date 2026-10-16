// System preferences shared by System Settings, Control Center, the menubar and the audio / display layers (T11).
// Persisted as `system`; `system.set(key, value)` emits bus `system:change` { key, value }, which the effects layer
// (ui/system-fx.js) and every open view react to.
import { storage } from './storage.js';
import { bus } from './bus.js';

const prefersReduced = () => { try { return !!window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

const defaults = () => ({
  wifi: true, bluetooth: true, airdrop: false, dnd: false, bannerStyle: 'quiet',
  volume: 70, muted: false,
  brightness: 100, nightShift: false,
  reduceMotion: prefersReduced(),
});
let state = { ...defaults(), ...(storage.get('system', {}) || {}) };

const save = () => storage.set('system', state);

export const system = {
  defaults,
  get: (k) => state[k],
  all: () => ({ ...state }),
  set(key, value) {
    if (!(key in state) || state[key] === value) return false;
    state[key] = value;
    save();
    bus.emit('system:change', { key, value });
    return true;
  },
  toggle(key) { this.set(key, !state[key]); return state[key]; },
  /** Back to factory settings (Settings → General → Reset). */
  reset() {
    const was = state;
    state = defaults();
    storage.remove('system');
    Object.keys(state).forEach((k) => { if (was[k] !== state[k]) bus.emit('system:change', { key: k, value: state[k] }); });
  },
  on: (fn) => bus.on('system:change', fn),
};
