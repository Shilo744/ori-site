// Pointer interaction for windows: drag by the title bar (with edge snapping + preview), resize from every edge/corner.
// Mouse / pen only in 3D mode; flat (compact) mode keeps windows full-width and ignores all of it.
import {
  MENUBAR_H, SNAP_EDGE, KEEP_VISIBLE, desktopSize, snapRect, clampRect, rectOf, applyRect, saveGeom,
} from './wm-geom.js';

export const EDGES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
export const HANDLES_HTML = EDGES.map((e) => `<i class="rz" data-rz="${e}"></i>`).join('');
/** In-screen cursor kind for a resize handle edge. */
export const cursorForEdge = (edge) => ({ n: 'ns', s: 'ns', e: 'ew', w: 'ew', ne: 'nesw', sw: 'nesw', nw: 'nwse', se: 'nwse' }[edge]);

const NO_DRAG = '.lights, button, input, textarea, a, .ic, .nav, .seg, .search, .addr';

/**
 * @param {object} o
 * @param {HTMLElement} o.root
 * @param {HTMLElement} o.layer          the `.wins` container (snap preview lives here)
 * @param {() => boolean} o.isCompact
 * @param {() => number} o.scale         CSS3D scale of the screen
 * @param {(el: HTMLElement) => object|null} o.entryOf
 * @param {(id: string) => void} o.focus
 * @param {(id: string, zone: string, restore: object|null) => void} o.snap   apply a snap zone (animated)
 * @param {(id: string) => void} o.leaveMode  window was dragged / resized out of zoom or snap
 * @param {(kind: string|null) => void} o.cursorLock  keep the in-screen cursor on a kind while dragging
 */
export function createInteract({ root, layer, isCompact, scale, entryOf, focus, snap, leaveMode, cursorLock }) {
  const preview = document.createElement('div');
  preview.className = 'snap-prev';
  layer.appendChild(preview);
  let previewZone = null;

  function showPreview(zone) {
    if (zone === previewZone) return;
    previewZone = zone;
    if (!zone) { preview.classList.remove('on'); return; }
    const r = snapRect(zone, desktopSize(root));
    preview.style.cssText = `left:${r.x + 6}px;top:${r.y + 6}px;width:${r.w - 12}px;height:${r.h - 12}px;`;
    preview.classList.add('on');
  }

  function start(e, winEl, kind, edge) {
    const en = entryOf(winEl);
    if (!en) return;
    const size = desktopSize(root);
    const k = scale() || 1;
    const rr = root.getBoundingClientRect();
    const def = en.def;
    let r0 = rectOf(winEl);

    // dragging a zoomed / tiled window (once it actually moves) gives its old size back, keeping the pointer in the same
    // spot of the title bar — a plain click or a double-click must not un-zoom it
    let pendingRestore = kind === 'drag' && en.mode !== 'normal' && !!en.restoreRect;
    const startPx = (e.clientX - rr.left) / k;

    const target = kind === 'drag' ? e.target.closest('[data-drag]') : e.target.closest('[data-rz]');
    try { target.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const sx = e.clientX, sy = e.clientY;
    cursorLock(kind === 'drag' ? 'grab' : cursorForEdge(edge));
    winEl.classList.add('dragging');
    let moved = false;
    let zone = null;

    const move = (ev) => {
      const dx = (ev.clientX - sx) / k, dy = (ev.clientY - sy) / k;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 2) return;
      moved = true;
      if (pendingRestore) {
        pendingRestore = false;
        const rs = en.restoreRect;
        const fx = (startPx - r0.x) / (r0.w || 1);
        r0 = clampRect({ x: startPx - rs.w * fx, y: r0.y, w: rs.w, h: rs.h }, def, size);
        applyRect(winEl, r0);
        leaveMode(en.id);
      }
      if (kind === 'drag') {
        const x = Math.max(-r0.w + KEEP_VISIBLE, Math.min(size.w - KEEP_VISIBLE, r0.x + dx));
        const y = Math.max(MENUBAR_H, Math.min(size.h - 60, r0.y + dy));
        winEl.style.left = `${x}px`;
        winEl.style.top = `${y}px`;
        const px = (ev.clientX - rr.left) / k, py = (ev.clientY - rr.top) / k;
        zone = py <= SNAP_EDGE + 2 ? 'zoom' : px <= SNAP_EDGE ? 'left' : px >= size.w - SNAP_EDGE ? 'right' : null;
        showPreview(zone);
      } else {
        resizeTo(winEl, def, r0, edge, dx, dy, size);
        if (en.mode !== 'normal') leaveMode(en.id);
      }
    };
    const up = (ev) => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
      target.removeEventListener('lostpointercapture', up);
      try { target.releasePointerCapture(ev.pointerId); } catch { /* ignore */ }
      winEl.classList.remove('dragging');
      cursorLock(null);
      showPreview(null);
      if (kind === 'drag' && zone) snap(en.id, zone, r0);
      else if (moved) saveGeom(en.id, rectOf(winEl));
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
    target.addEventListener('lostpointercapture', up); // capture lost for any reason: end the gesture instead of sticking
  }

  return {
    /** Pointer down anywhere on the desktop. Focuses the window; starts a resize on a handle, or a drag on a title bar. */
    onPointerDown(e) {
      const winEl = e.target.closest('.win');
      const en = winEl && entryOf(winEl);
      if (en) focus(en.id);
      if (!winEl || isCompact() || e.button > 0) return;
      const handle = e.target.closest('[data-rz]');
      if (handle) { start(e, winEl, 'resize', handle.dataset.rz); e.preventDefault(); return; }
      const bar = e.target.closest('[data-drag]');
      if (bar && !e.target.closest(NO_DRAG)) start(e, winEl, 'drag');
    },
    hidePreview: () => showPreview(null),
  };
}

function resizeTo(winEl, def, r0, edge, dx, dy, size) {
  const minW = (def.size && def.size.minW) || 240, minH = (def.size && def.size.minH) || 160;
  let { x, y, w, h } = r0;
  if (edge.includes('e')) w = Math.max(minW, Math.min(r0.w + dx, size.w - r0.x));
  if (edge.includes('w')) {
    const right = r0.x + r0.w;
    x = Math.max(0, Math.min(r0.x + dx, right - minW)); // can't shrink below the minimum, keep the left edge on screen
    w = right - x;
  }
  if (edge.includes('s')) h = Math.max(minH, Math.min(r0.h + dy, size.h - r0.y));
  if (edge.includes('n')) {
    const bottom = r0.y + r0.h;
    y = Math.max(MENUBAR_H, Math.min(r0.y + dy, bottom - minH)); // never above the menubar
    h = bottom - y;
  }
  applyRect(winEl, { x, y, w, h });
}
