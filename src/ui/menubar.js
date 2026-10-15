// Menubar behaviour: the Apple / app / File / Edit / View / Go / Window / Help dropdowns.
import * as sound from '../audio.js';
import { content as C } from '../content.js';
import { esc } from './apps/shared.js';

/**
 * @param {object} o
 * @param {HTMLElement} o.root
 * @param {HTMLElement} o.menuLayer  the `.menus` container
 * @param {HTMLElement} o.appLabel   the bold app name in the menubar
 * @param {HTMLElement} o.cc         the Control Center panel (closed together with the menus, like macOS)
 * @param {object} o.wm              window manager
 * @param {() => number} o.scale
 * @param {{ restart: Function, shutdown: Function }} o.power
 */
export function createMenubar({ root, menuLayer, appLabel, cc, wm, scale, power }) {
  let menuOpen = null;
  let menuActions = [];

  const quitFront = () => { const a = wm.front(); if (a) wm.close(a); };
  const minimizeFront = () => { const a = wm.front(); if (a) wm.minimize(a); };

  function menuItems(key) {
    const name = appLabel.textContent;
    const ids = wm.ids();
    const std = {
      file: [{ l: 'New Window', k: '⌘N', dis: true }, { l: 'New Tab', k: '⌘T', dis: true }, { sep: 1 }, { l: 'Close Window', k: '⌘W', a: quitFront }],
      edit: [{ l: 'Undo', k: '⌘Z', dis: true }, { l: 'Redo', k: '⇧⌘Z', dis: true }, { sep: 1 }, { l: 'Cut', k: '⌘X', dis: true }, { l: 'Copy', k: '⌘C', dis: true }, { l: 'Paste', k: '⌘V', dis: true }, { l: 'Select All', k: '⌘A', dis: true }],
      view: [{ l: 'as Icons', k: '⌘1', dis: true }, { l: 'as List', k: '⌘2', dis: true }, { sep: 1 }, { l: 'Enter Full Screen', k: '⌃⌘F', dis: true }],
      go: [{ l: 'Back', k: '⌘[', dis: true }, { l: 'Forward', k: '⌘]', dis: true }, { sep: 1 }, { l: 'Home', k: '⇧⌘H', a: () => wm.open('finder') }, { l: 'Applications', k: '⇧⌘A', dis: true }],
      window: [{ l: 'Minimize', k: '⌘M', a: minimizeFront }, { l: 'Zoom', dis: true }, ...(ids.length ? [{ sep: 1 }] : []),
        ...ids.map((a) => ({ l: wm.get(a).def.menuTitle, a: () => wm.restore(a) }))],
      help: [{ l: `${name} Help`, a: () => wm.open('welcome') }],
    };
    if (key === 'apple') return [
      { l: 'About This Mac', a: () => wm.open('settings') }, { sep: 1 },
      { l: 'System Settings…', a: () => wm.open('settings') }, { l: 'App Store…', dis: true }, { sep: 1 },
      { l: 'Recent Items', dis: true, arrow: true }, { sep: 1 },
      { l: 'Force Quit…', k: '⌥⌘⎋', dis: true }, { sep: 1 },
      { l: 'Sleep', dis: true }, { l: 'Restart…', a: () => power.restart() }, { l: 'Shut Down…', a: () => power.shutdown() }, { sep: 1 },
      { l: 'Lock Screen', k: '⌃⌘Q', dis: true }, { l: `Log Out ${C.name}…`, k: '⇧⌘Q', dis: true },
    ];
    if (key === 'app') return [
      { l: `About ${name}`, dis: true }, { sep: 1 },
      { l: 'Settings…', k: '⌘,', a: () => wm.open('settings') }, { sep: 1 },
      { l: `Hide ${name}`, k: '⌘H', dis: true }, { l: 'Hide Others', k: '⌥⌘H', dis: true }, { sep: 1 },
      { l: `Quit ${name}`, k: '⌘Q', a: quitFront },
    ];
    return std[key] || [];
  }

  function show(key, anchor) {
    const items = menuItems(key);
    const rr = root.getBoundingClientRect(), r = anchor.getBoundingClientRect(), k = scale() || 1;
    menuActions = items.map((i) => i.a || null);
    menuLayer.innerHTML = `<div class="menu" style="left:${(r.left - rr.left) / k - 4}px">${items.map((it, i) => (it.sep
      ? '<hr />'
      : `<div class="mi${it.dis ? ' dis' : ''}" data-mi="${i}"><span>${esc(it.l)}</span>${it.arrow ? '<kbd>›</kbd>' : it.k ? `<kbd>${esc(it.k)}</kbd>` : ''}</div>`)).join('')}</div>`;
    root.querySelectorAll('.mbi').forEach((b) => b.classList.toggle('open', b === anchor));
    menuOpen = key;
  }

  function close() {
    menuLayer.innerHTML = '';
    root.querySelectorAll('.mbi.open').forEach((b) => b.classList.remove('open'));
    menuOpen = null;
    cc.hidden = true;
  }

  return {
    close,
    isOpen: () => !!menuOpen,
    /** Handles a click on a menu title or an enabled menu item. Returns true when the click was consumed. */
    handleClick(e) {
      const t = e.target;
      const menuBtn = t.closest('[data-menu]');
      if (menuBtn) {
        if (menuOpen === menuBtn.dataset.menu) close();
        else { cc.hidden = true; show(menuBtn.dataset.menu, menuBtn); }
        sound.click();
        return true;
      }
      const mi = t.closest('.mi:not(.dis)');
      if (mi) { const a = menuActions[+mi.dataset.mi]; close(); sound.click(); if (a) a(); return true; }
      return false;
    },
    /** While a menu is open, hovering another menu title switches to it (like macOS). */
    handleHover(e) {
      const b = e.target.closest('[data-menu]');
      if (b && menuOpen && menuOpen !== b.dataset.menu) show(b.dataset.menu, b);
    },
  };
}
