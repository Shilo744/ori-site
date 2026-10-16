// Appearance + accent colour (T11). Light / Dark / Auto (Auto = dark after sunset, following the room's time of day)
// and the macOS accent colours. Applied to the desktop root as `data-theme` and the `--ac*` CSS variables; persisted.
//   theme.setAppearance('dark') · theme.setAccent('pink') · theme.isDark() · bus 'theme:change'
import { storage } from './storage.js';
import { bus } from './bus.js';

export const ACCENTS = [
  { id: 'blue', name: 'Blue', color: '#007aff' },
  { id: 'purple', name: 'Purple', color: '#a550a7' },
  { id: 'pink', name: 'Pink', color: '#f74f9e' },
  { id: 'red', name: 'Red', color: '#ff5257' },
  { id: 'orange', name: 'Orange', color: '#f7821b' },
  { id: 'yellow', name: 'Yellow', color: '#e8a800' },
  { id: 'green', name: 'Green', color: '#43a82a' },
  { id: 'graphite', name: 'Graphite', color: '#8a8a8e' },
];
export const APPEARANCES = ['light', 'dark', 'auto'];

const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const toHex = (rgb) => `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
/** Mixes colour `a` towards `to` by `t` (0..1). */
export const mix = (a, to, t) => { const x = hex(a), y = hex(to); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };

/** The CSS variables for an accent colour in light / dark mode. */
export function accentVars(accentId, dark) {
  const base = (ACCENTS.find((a) => a.id === accentId) || ACCENTS[0]).color;
  const ac = dark ? mix(base, '#ffffff', 0.1) : base;
  return { '--ac': ac, '--ac-hi': mix(ac, '#ffffff', 0.28), '--ac-lo': mix(ac, '#000000', 0.1), '--ac-ic': mix(ac, '#ffffff', 0.2), '--ac-rgb': hex(ac).join(',') };
}

let appearance = storage.get('theme:appearance', 'light');
let accent = storage.get('theme:accent', 'blue');
if (!APPEARANCES.includes(appearance)) appearance = 'light';
if (!ACCENTS.some((a) => a.id === accent)) accent = 'blue';
let root = null;
let getNight = () => 0;
let dark = false;

const compute = () => appearance === 'dark' || (appearance === 'auto' && getNight() > 0.5);

function apply(announce = true) {
  const next = compute();
  const changed = next !== dark;
  dark = next;
  if (root) {
    root.dataset.theme = dark ? 'dark' : 'light';
    const vars = accentVars(accent, dark);
    Object.keys(vars).forEach((k) => root.style.setProperty(k, vars[k]));
    root.dataset.ac = accent; // (not data-accent: Settings looks for that attribute on its swatches)
  }
  document.documentElement.dataset.macTheme = dark ? 'dark' : 'light';
  if (announce || changed) bus.emit('theme:change', { appearance, accent, dark });
}

export const theme = {
  ACCENTS,
  get appearance() { return appearance; },
  get accent() { return accent; },
  isDark: () => dark,
  setAppearance(v) {
    if (!APPEARANCES.includes(v) || v === appearance) return false;
    appearance = v;
    storage.set('theme:appearance', v);
    apply();
    return true;
  },
  setAccent(id) {
    if (!ACCENTS.some((a) => a.id === id) || id === accent) return false;
    accent = id;
    storage.set('theme:accent', id);
    apply();
    return true;
  },
  /** Re-evaluate Auto (the room's light changed). */
  sync() { if (appearance === 'auto') apply(false); },
  /** Bind to the desktop root. `night` returns 0..1 (how dark it is in the room). */
  attach(el, { night } = {}) {
    root = el;
    if (night) getNight = night;
    apply(false);
    bus.on('daylight:change', () => this.sync());
    setInterval(() => this.sync(), 15000);
  },
};
