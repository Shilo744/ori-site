// App registry — the single source of truth for everything that can open in a window on the macOS desktop.
// The Dock, Spotlight, the Apple/Window menus, the terminal `open` command and aliases all read from here.
// Adding an app = one new file in this folder that calls `registerApp({...})` + one import line in ./index.js.
//
//   registerApp({
//     id: 'snake', name: 'Snake',
//     icon: '<svg viewBox="0 0 64 64">…</svg>',            // squircle icon (Dock, Spotlight, Launchpad)
//     size: { w: 560, h: 480, minW: 420, minH: 380 },       // initial + minimum content size (px, 960×624 space)
//     category: 'app' | 'game',                              // default 'app'
//     dock: true | false,                                    // pinned in the Dock (registration order); default false
//     singleton: true,                                       // one window per app (the only mode supported so far)
//     titlebar: 'standard' | 'dark' | 'none',                // 'none' = the app draws its own header (el = the window)
//     mount(el, ctx, args) { …; return { destroy, onFocus, onBlur, onResize, onOpen, pause, resume }; },
//   });
//
// Optional extras: `pos:{x,y}` first position, `aliases:[{ name, args }]` extra names for `open(name)`,
// `hidden` (kept out of Spotlight / terminal listings), `dockId` (which Dock icon shows the running dot),
// `menuTitle` (name in the Window menu), `spotlightKind` (label in Spotlight, default Application / Game),
// `chrome: 'game'` (neon arcade window frame for a non-game app, e.g. the Arcade launcher).

const apps = new Map(); // id -> normalised definition (insertion order = Dock order)
const aliases = new Map(); // alias -> { id, args }

export function registerApp(def) {
  if (!def || !def.id || typeof def.mount !== 'function') throw new Error('registerApp: { id, mount } required');
  if (apps.has(def.id)) throw new Error(`registerApp: "${def.id}" already registered`);
  const size = { w: 560, h: 400, minW: 320, minH: 220, ...(def.size || {}) };
  const norm = {
    category: 'app',
    dock: false,
    singleton: true,
    titlebar: 'standard',
    hidden: false,
    aliases: [],
    pos: null,
    icon: '',
    ...def,
    size,
    menuTitle: def.menuTitle || def.name,
    dockId: def.dockId || def.id,
    spotlightKind: def.spotlightKind || (def.category === 'game' ? 'Game' : 'Application'),
  };
  apps.set(norm.id, norm);
  norm.aliases.forEach((a) => aliases.set(a.name, { id: norm.id, args: a.args || null }));
  return norm;
}

export const getApp = (id) => apps.get(id) || null;

/** All apps in registration order. Optional filter: `{ category, dock, hidden }`. */
export function listApps(filter = {}) {
  return [...apps.values()].filter((a) => Object.entries(filter).every(([k, v]) => a[k] === v));
}

/** `open('about')` → { def: notes, args: { note: 'about' } }. Accepts an app id or an alias. */
export function resolve(idOrAlias, args = null) {
  const direct = apps.get(idOrAlias);
  if (direct) return { def: direct, args };
  const al = aliases.get(idOrAlias);
  if (al) return { def: apps.get(al.id), args: args || al.args };
  return null;
}

export const listAliases = () => [...aliases.keys()];
