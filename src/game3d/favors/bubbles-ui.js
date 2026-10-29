// "Ori, Can You...?" — speech bubbles over people's heads (DOM, placed every frame from a world position): Ori's "Hi!" and the answer of whoever he greeted,
// the barks of passers-by, a heart that floats up when the love goes up. Pointer-events none; a few at a time.
import * as THREE from 'three';
import './bubbles.css';

export function createBubbles({ root }) {
  const layer = document.createElement('div');
  layer.className = 'fb-layer';
  root.append(layer);
  const items = [];
  const v = new THREE.Vector3();
  return {
    /**
     * @param {() => { x: number, y: number, z: number }} where the world point over the head (called every frame)
     * @param {{ name?: string, kind?: 'ori' | 'them' | 'boss', ms?: number, key?: string }} o
     */
    say(where, text, { name = '', kind = 'them', ms = 2600, key = null, dx = 0 } = {}) {
      if (key) for (let i = items.length - 1; i >= 0; i--) if (items[i].key === key) { items[i].el.remove(); items.splice(i, 1); }
      while (items.length > 5) { items[0].el.remove(); items.shift(); }
      const el = document.createElement('div');
      el.className = `fb fb-${kind}`;
      if (name) { const n = document.createElement('b'); n.textContent = name; el.append(n); }
      const t = document.createElement('span');
      t.textContent = text;
      el.append(t);
      layer.append(el);
      items.push({ el, where, t: 0, ms: ms / 1000, key, dx });
    },
    /** A heart that floats up from a world point. */
    heart(where) {
      const el = document.createElement('i');
      el.className = 'fb-heart';
      layer.append(el);
      items.push({ el, where, t: 0, ms: 1.3, key: null, heart: true });
    },
    update(dt, camera) {
      const w = root.clientWidth || 1;
      const h = root.clientHeight || 1;
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        it.t += dt;
        if (it.t >= it.ms) { it.el.remove(); items.splice(i, 1); continue; }
        const p = it.where();
        v.set(p.x, p.y + (it.heart ? it.t * 0.9 : 0), p.z).project(camera);
        const vis = v.z < 1 && Math.abs(v.x) < 1.15 && Math.abs(v.y) < 1.15;
        it.el.style.opacity = vis ? (it.t > it.ms - 0.3 ? String((it.ms - it.t) / 0.3) : '1') : '0';
        it.el.style.transform = `translate(${((v.x * 0.5 + 0.5) * w + (it.dx || 0)).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * h).toFixed(1)}px) translate(-50%, -100%)`;
      }
    },
    clear() { for (const it of items) it.el.remove(); items.length = 0; },
    get count() { return items.length; },
    dispose() { layer.remove(); items.length = 0; },
  };
}
