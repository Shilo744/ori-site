// "Ori, Can You...?" — the 3D inside of a building, built from interiors.js on demand: a dollhouse room (the walls facing the camera are culled, so
// you see in from above), the floor and walls from the material library, furniture made of rounded boxes and cylinders, windows that follow the
// daylight, photo walls / whiteboards / signs drawn on canvases, and the people who stand in it (the same characters as the conversations).
// Only the room Ori is in exists; leaving frees it.
import * as THREE from 'three';
import { ROOMS, KINDS, WALL_H, DOOR_W, originOf, spawnOf, exitOf, spotsOf } from './interiors.js';
import { createPerson } from './people/person.js';
import { speaker } from './dialogue/cast.js';

const UB = new THREE.BoxGeometry(1, 1, 1);
const UC = new THREE.CylinderGeometry(1, 1, 1, 20);
const US = new THREE.SphereGeometry(1, 16, 12);
const col = (h) => new THREE.Color(h);

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** @param {{ scene: THREE.Scene, lib: object, tier: string, shadows: boolean }} o */
export function createInteriors({ scene, lib, tier = 'high', shadows = true }) {
  const people = new Map(); // speaker id -> { person, spec } kept for the whole game (building one takes ~0.2 s)
  let cur = null; // { id, group, mats, geos, tex, npcs: [{ person, x, z, rot, id }], light }
  let skyGlass = new THREE.Color(0xbfdcff);
  let day = 1;

  // ── materials and little builders (per room; freed with the room) ──
  function kit(room) {
    const mats = new Map();
    const geos = [];
    const tex = [];
    const own = [];
    const M = (hex, { r = 0.72, m = 0, e = null, ei = 1, t = false, o = 1, side = 0 } = {}) => {
      const k = `${hex}|${r}|${m}|${e}|${ei}|${t}|${o}|${side}`;
      if (mats.has(k)) return mats.get(k);
      const mat = new THREE.MeshStandardMaterial({ color: col(hex), roughness: r, metalness: m, transparent: t || o < 1, opacity: o, side: side ? THREE.DoubleSide : THREE.FrontSide });
      if (e) { mat.emissive = col(e); mat.emissiveIntensity = ei; }
      mats.set(k, mat);
      own.push(mat);
      return mat;
    };
    const put = (g, geo, mat, x, y, z, sx, sy, sz, rot = null, cast = true) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
      m.castShadow = shadows && cast && sy > 0.05;
      m.receiveShadow = shadows;
      g.add(m);
      return m;
    };
    /** a box w × h × d whose bottom is at y */
    const bx = (g, w, h, d, x, y, z, mat, rot, cast) => put(g, UB, mat, x, y + h / 2, z, w, h, d, rot, cast);
    const cy = (g, rt, h, x, y, z, mat, rb = null, cast) => { const m = put(g, UC, mat, x, y + h / 2, z, rt, h, rt, null, cast); if (rb != null) m.scale.set(rt, h, rt); return m; };
    const sp = (g, r, x, y, z, mat, sy = 1, cast = false) => put(g, US, mat, x, y, z, r, r * sy, r, null, cast);
    const tx = (t) => { tex.push(t); return t; };
    const quad = (g, w, h, x, y, z, mat, ry = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); geos.push(m.geometry); m.position.set(x, y, z); m.rotation.y = ry; g.add(m); return m; };
    return { M, bx, cy, sp, put, tx, quad, geos, tex, own, mats };
  }

  // ── the furniture ──
  const B = {
    sofa(g, K, it) {
      const c = it.c || '#8a8f9c';
      const fab = K.M(c, { r: it.plastic ? 0.18 : 0.92 });
      K.bx(g, 2.2, 0.38, 0.95, 0, 0.12, 0, fab); K.bx(g, 2.2, 0.55, 0.22, 0, 0.4, -0.37, fab); K.bx(g, 0.22, 0.34, 0.8, -1.0, 0.45, 0.04, fab); K.bx(g, 0.22, 0.34, 0.8, 1.0, 0.45, 0.04, fab);
      for (const s of [-0.5, 0.5]) K.bx(g, 0.82, 0.12, 0.7, s, 0.5, 0.1, fab);
      if (it.plastic) K.bx(g, 2.26, 0.04, 1.0, 0, 0.5, 0.0, K.M('#ffffff', { r: 0.05, t: true, o: 0.22 }), null, false);
      for (const s of [-1, 1]) K.bx(g, 0.08, 0.12, 0.08, s * 0.95, 0, 0.35, K.M('#2b2b2e'));
    },
    armchair(g, K, it) { const f = K.M(it.c || '#a0a8c0', { r: 0.9 }); K.bx(g, 0.95, 0.34, 0.95, 0, 0.12, 0, f); K.bx(g, 0.95, 0.5, 0.2, 0, 0.4, -0.37, f); K.bx(g, 0.2, 0.3, 0.8, -0.38, 0.4, 0.05, f); K.bx(g, 0.2, 0.3, 0.8, 0.38, 0.4, 0.05, f); K.bx(g, 0.6, 0.1, 0.62, 0, 0.46, 0.1, f); },
    coffeeTable(g, K, it) { const w = K.M(it.c || '#8a6a4a', { r: 0.5 }); K.bx(g, 1.1, 0.06, 0.6, 0, 0.38, 0, w); for (const [x, z] of [[-0.48, -0.24], [0.48, -0.24], [-0.48, 0.24], [0.48, 0.24]]) K.bx(g, 0.06, 0.38, 0.06, x, 0, z, w); if (it.doily) { K.cy(g, 0.22, 0.012, 0, 0.44, 0, K.M('#f6f1e6')); K.cy(g, 0.07, 0.1, 0, 0.45, 0, K.M('#c96a5a')); } },
    table(g, K, it) {
      const w = it.w ?? 1.8; const d = it.d ?? 0.9; const m = K.M(it.c || '#c8a878', { r: 0.55 });
      K.bx(g, w, 0.06, d, 0, 0.7, 0, m); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) K.bx(g, 0.07, 0.7, 0.07, x * (w / 2 - 0.1), 0, z * (d / 2 - 0.1), m);
      if (it.pot) { K.cy(g, 0.17, 0.2, 0, 0.76, 0, K.M('#b9c2c9', { m: 0.7, r: 0.3 })); K.cy(g, 0.14, 0.02, 0, 0.96, 0, K.M('#e9c46a', { r: 0.2 })); K.bx(g, 0.3, 0.02, 0.3, 0.5, 0.76, 0.1, K.M('#f6f1e6')); }
      if (it.snacks) for (let i = 0; i < 5; i++) K.bx(g, 0.22, 0.1, 0.16, -0.8 + i * 0.4, 0.76, (i % 2 ? 0.15 : -0.15), K.M(['#e5625e', '#f2c14e', '#43b581', '#4a90e2', '#b07ad8'][i]));
    },
    chair(g, K, it) { const m = K.M(it.c || '#6a5a4a', { r: 0.7 }); K.bx(g, 0.44, 0.05, 0.44, 0, 0.44, 0, m); K.bx(g, 0.44, 0.5, 0.05, 0, 0.46, -0.2, m); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) K.bx(g, 0.04, 0.44, 0.04, x * 0.18, 0, z * 0.18, m); },
    stool(g, K, it) { const m = K.M(it.c || '#5a4a3a', { r: 0.5 }); K.cy(g, 0.18, 0.05, 0, 0.62, 0, m); K.cy(g, 0.03, 0.6, 0, 0, 0, K.M('#9aa3ab', { m: 0.8, r: 0.3 })); },
    round(g, K, it) { const m = K.M(it.c || '#c9a57a', { r: 0.5 }); K.cy(g, 0.42, 0.05, 0, 0.7, 0, m); K.cy(g, 0.04, 0.7, 0, 0, 0, K.M('#3a3a3e', { m: 0.5 })); K.cy(g, 0.22, 0.03, 0, 0, 0, K.M('#3a3a3e', { m: 0.5 })); K.cy(g, 0.04, 0.08, 0.1, 0.75, 0.05, K.M('#f6f1e6')); },
    bed(g, K, it) { const f = K.M('#8a6a4a'); K.bx(g, 2.0, 0.28, 1.6, 0, 0.1, 0, f); K.bx(g, 1.9, 0.2, 1.5, 0, 0.38, 0, K.M(it.c || '#e8e3da', { r: 0.95 })); K.bx(g, 1.2, 0.07, 1.5, 0.25, 0.58, 0, K.M(it.sheet || '#7fa0d8', { r: 0.95 })); K.bx(g, 0.5, 0.12, 0.7, -0.75, 0.58, -0.35, K.M('#f6f3ee')); K.bx(g, 0.5, 0.12, 0.7, -0.75, 0.58, 0.35, K.M('#f6f3ee')); K.bx(g, 0.1, 0.8, 1.6, -1.0, 0, 0, f); },
    wardrobe(g, K, it) { const m = K.M(it.c || '#c9ad86'); K.bx(g, 1.6, 2.1, 0.6, 0, 0, 0, m); K.bx(g, 0.03, 1.9, 0.02, 0, 0.1, 0.31, K.M('#8a7050')); },
    shelf(g, K, it) {
      const w = it.w ?? 1.6; const m = K.M(it.c || '#b58a58', { r: 0.6 });
      K.bx(g, w, 1.9, 0.36, 0, 0, 0, m);
      const pal = it.stuff === 'trophies' ? ['#f2c14e', '#e9d27a', '#c9a227'] : it.stuff === 'cups' ? ['#f6f1e6', '#e5625e', '#4a90e2'] : it.stuff === 'parts' ? ['#9aa3ab', '#c96a3a', '#5a6a7a'] : ['#c0504d', '#4a90e2', '#43b581', '#f2c14e', '#e8d5a8', '#8a5a9a'];
      for (let r = 0; r < 4; r++) for (let i = 0; i < Math.floor(w / 0.2); i++) K.bx(g, 0.13, 0.22 + ((i * 7 + r * 3) % 4) * 0.04, 0.22, -w / 2 + 0.16 + i * 0.2, 0.2 + r * 0.45, 0.04, K.M(pal[(i + r * 2) % pal.length], { r: 0.6 }), null, false);
    },
    tv(g, K, it) { const u = K.M(it.c || '#4a3a2e', { r: 0.6 }); K.bx(g, 1.5, 0.5, 0.45, 0, 0, 0, u); K.bx(g, 1.0, 0.62, 0.05, 0, 0.72, 0.0, K.M('#0c0d12', { r: 0.2 })); K.bx(g, 0.92, 0.54, 0.02, 0, 0.76, 0.03, K.M('#274a73', { e: '#3f7fc0', ei: 0.35 })); K.cy(g, 0.03, 0.2, 0, 0.5, 0, K.M('#222')); },
    fridge(g, K, it) { const m = K.M(it.c || '#e4e6e8', { r: 0.25, m: 0.2 }); K.bx(g, 0.8, 1.9, 0.75, 0, 0, 0, m); K.bx(g, 0.76, 0.02, 0.02, 0, 1.2, 0.38, K.M('#9a9fa4')); K.bx(g, 0.04, 0.5, 0.04, 0.3, 1.3, 0.4, K.M('#9a9fa4')); if (it.magnets) for (let i = 0; i < 9; i++) K.bx(g, 0.07, 0.07, 0.02, -0.28 + (i % 3) * 0.2, 1.3 + Math.floor(i / 3) * 0.15, 0.39, K.M(['#e5625e', '#4a90e2', '#f2c14e', '#43b581'][i % 4])); },
    counter(g, K, it) {
      const w = it.w ?? 3; const d = it.d ?? 0.75; const body = K.M(it.c || '#8a6a4a', { r: 0.55 }); const top = K.M('#e8e2d6', { r: 0.3 });
      K.bx(g, w, 0.95, d, 0, 0, 0, body); K.bx(g, w + 0.08, 0.05, d + 0.1, 0, 0.95, 0, top);
      if (it.glass) { K.bx(g, w - 0.2, 0.5, 0.35, 0, 0.45, 0.2, K.M('#cfe6f2', { t: true, o: 0.28, r: 0.05 }), null, false); for (let i = 0; i < 9; i++) K.bx(g, 0.22, 0.09, 0.2, -w / 2 + 0.4 + i * (w - 0.8) / 8, 0.52 + (i % 2) * 0.22, 0.2, K.M(['#d6a15c', '#f2d9a6', '#c46a4a', '#7a4a2a'][i % 4])); }
      if (it.window) { K.bx(g, w, 1.2, 0.04, 0, 1.0, -d / 2 + 0.2, K.M('#cfe6f2', { t: true, o: 0.22, r: 0.05 }), null, false); K.bx(g, 0.5, 0.18, 0.04, w / 2 - 0.7, 1.0, d / 2, K.M('#f6f1e6')); }
    },
    espresso(g, K) { const m = K.M('#b9bec4', { m: 0.8, r: 0.25 }); K.bx(g, 0.7, 0.45, 0.5, 0, 0, 0, K.M('#3a3a3e')); K.bx(g, 0.74, 0.1, 0.54, 0, 0.45, 0, m); K.cy(g, 0.05, 0.22, -0.18, 0.1, 0.18, m); K.cy(g, 0.05, 0.22, 0.18, 0.1, 0.18, m); K.bx(g, 0.14, 0.14, 0.06, 0.24, 0.5, 0.2, K.M('#ffd36a', { e: '#ffb25b', ei: 0.6 })); },
    plant(g, K, it) { K.cy(g, 0.22, 0.38, 0, 0, 0, K.M('#c0683a', { r: 0.8 })); const l = K.M('#3f8a4a', { r: 0.7 }); K.sp(g, 0.34, 0, 0.78, 0, l, 1.2); K.sp(g, 0.26, 0.2, 1.0, 0.08, K.M('#52a35a', { r: 0.7 }), 1.1); K.sp(g, 0.24, -0.18, 0.94, -0.1, K.M('#356f3e', { r: 0.7 }), 1.1); },
    tree(g, K, it) { K.cy(g, 0.3, 0.45, 0, 0, 0, K.M('#b5683a', { r: 0.8 })); K.cy(g, 0.05, 1.3, 0, 0.4, 0, K.M('#6a4a2a')); K.sp(g, 0.62, 0, 1.75, 0, K.M('#3f8a4a', { r: 0.7 }), 0.9); if (it.lemon) for (let i = 0; i < 7; i++) K.sp(g, 0.07, Math.cos(i * 0.9) * 0.5, 1.6 + (i % 3) * 0.2, Math.sin(i * 0.9) * 0.5, K.M('#f6d330', { r: 0.4 }), 1.25); },
    lamp(g, K) { K.cy(g, 0.12, 0.03, 0, 0, 0, K.M('#2b2b2e')); K.cy(g, 0.015, 1.5, 0, 0, 0, K.M('#2b2b2e')); K.cy(g, 0.2, 0.28, 0, 1.5, 0, K.M('#fff0c8', { e: '#ffd890', ei: 0.9, o: 0.9, t: true })); },
    rug(g, K, it) { const w = it.w ?? 3; const d = it.d ?? 2; const m = K.M(it.c || '#b46a5a', { r: 1 }); K.bx(g, w, 0.015, d, 0, 0, 0, m, null, false); K.bx(g, w - 0.4, 0.018, d - 0.4, 0, 0, 0, K.M('#f2e6cc', { r: 1 }), null, false); K.bx(g, w - 0.7, 0.02, d - 0.7, 0, 0, 0, m, null, false); },
    photos(g, K, it) {
      const n = it.count || 40;
      const t = K.tx(canvasTex(1024, 256, (c, w, h) => { c.fillStyle = '#f1dfd0'; c.fillRect(0, 0, w, h); const cols = 10; const rows = Math.ceil(n / cols); const cw = w / cols; const ch = h / rows;
        for (let i = 0; i < n; i++) { const x = (i % cols) * cw + 6; const y = Math.floor(i / cols) * ch + 6; c.fillStyle = ['#8a6a4a', '#d9c3a0', '#2b2e38', '#e8e3da'][i % 4]; c.fillRect(x, y, cw - 12, ch - 12); c.fillStyle = ['#a8c8e8', '#e8c8a8', '#c8e8b8', '#f2d8e0'][(i * 3) % 4]; c.fillRect(x + 5, y + 5, cw - 22, ch - 22);
          c.fillStyle = '#c28e6e'; c.beginPath(); c.arc(x + cw / 2 - 6, y + ch / 2 - 2, 9 + (i % 3), 0, 6.3); c.fill(); c.fillStyle = '#2a1a12'; c.beginPath(); c.arc(x + cw / 2 - 6, y + ch / 2 - 10, 9 + (i % 3), Math.PI, 0); c.fill(); } }));
      K.quad(g, 4.4, 1.1, 0, 1.75, 0.04, new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
    },
    glassCase(g, K, it) { const w = K.M('#7a5a3c', { r: 0.5 }); K.bx(g, 1.4, 1.9, 0.5, 0, 0, 0, w); K.bx(g, 1.3, 1.1, 0.04, 0, 0.7, 0.24, K.M('#cfe6f2', { t: true, o: 0.22, r: 0.05 }), null, false); for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) K.cy(g, 0.06, 0.07, -0.55 + i * 0.22, 0.95 + r * 0.32, 0.1, K.M(['#f6f1e6', '#e8d9b0', '#d6e0f0'][(i + r) % 3], { r: 0.2 }), null, false); },
    desk(g, K, it) {
      const m = K.M(it.c || '#d9cdb8', { r: 0.5 }); K.bx(g, 1.6, 0.05, 0.8, 0, 0.72, 0, m); K.bx(g, 0.05, 0.72, 0.7, -0.74, 0, 0, m); K.bx(g, 0.05, 0.72, 0.7, 0.74, 0, 0, m);
      if (it.screen) { K.bx(g, 0.7, 0.42, 0.03, 0, 0.98, -0.22, K.M('#101218', { r: 0.2 })); K.bx(g, 0.64, 0.36, 0.01, 0, 1.0, -0.2, K.M('#2a4a78', { e: '#4a8fe0', ei: 0.55 })); K.bx(g, 0.1, 0.22, 0.1, 0, 0.77, -0.22, K.M('#9aa3ab', { m: 0.7 })); K.bx(g, 0.4, 0.02, 0.14, 0, 0.77, 0.12, K.M('#d8d8dc')); }
    },
    standing(g, K, it) { const m = K.M(it.c || '#cfd8dc', { r: 0.5 }); K.bx(g, 1.4, 0.05, 0.7, 0, 1.05, 0, m); K.bx(g, 0.08, 1.05, 0.5, -0.5, 0, 0, K.M('#8a949c', { m: 0.6 })); K.bx(g, 0.08, 1.05, 0.5, 0.5, 0, 0, K.M('#8a949c', { m: 0.6 })); K.bx(g, 0.6, 0.38, 0.03, 0, 1.3, -0.2, K.M('#101218')); K.bx(g, 0.55, 0.33, 0.01, 0, 1.31, -0.18, K.M('#2a4a78', { e: '#4a8fe0', ei: 0.55 })); },
    bench(g, K, it) { const w = it.w ?? 4; const m = K.M('#8a6a4a', { r: 0.5 }); K.bx(g, w, 0.07, 0.5, 0, 0.45, 0, m); K.bx(g, w, 0.5, 0.06, 0, 0.5, -0.24, m); for (let i = 0; i <= Math.floor(w / 1.6); i++) K.bx(g, 0.07, 0.45, 0.42, -w / 2 + 0.2 + i * ((w - 0.4) / Math.max(1, Math.floor(w / 1.6))), 0, 0, K.M('#3a3a3e', { m: 0.5 })); },
    queue(g, K) { K.bx(g, 0.7, 1.25, 0.55, 0, 0, 0, K.M('#c2342e', { r: 0.35 })); K.bx(g, 0.5, 0.3, 0.02, 0, 0.8, 0.28, K.M('#101218')); K.bx(g, 0.44, 0.22, 0.01, 0, 0.82, 0.285, K.M('#102a18', { e: '#3cff7a', ei: 0.9 })); K.bx(g, 0.24, 0.1, 0.1, 0, 0.45, 0.3, K.M('#f6f1e6')); K.bx(g, 0.08, 0.18, 0.02, 0.25, 0.62, 0.285, K.M('#ffd36a', { e: '#ffb25b', ei: 0.8 })); },
    display(g, K, it) { const t = K.tx(canvasTex(512, 128, (c, w, h) => { c.fillStyle = '#10141c'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffb25b'; c.font = '700 26px monospace'; c.fillText('NOW SERVING', 24, 46); c.fillStyle = '#ff5a4a'; c.font = '700 70px monospace'; c.fillText(String(it.now || 84), 270, 98); })); K.quad(g, 2, 0.5, 0, 2.7, 0.05, new THREE.MeshBasicMaterial({ map: t })); K.bx(g, 2.1, 0.6, 0.06, 0, 2.45, 0.0, K.M('#2b2e38')); },
    board(g, K, it) { const t = K.tx(canvasTex(512, 200, (c, w, h) => { c.fillStyle = it.mood ? '#f4efe6' : '#f7f8f6'; c.fillRect(0, 0, w, h); if (it.mood) { ['#9b6bff', '#e5625e', '#ffb25b', '#43b581', '#4a90e2', '#f2c14e'].forEach((x, i) => { c.fillStyle = x; c.fillRect(24 + (i % 3) * 160, 20 + Math.floor(i / 3) * 90, 130, 70); }); } else { c.strokeStyle = '#2a6ac8'; c.lineWidth = 4; c.font = '700 30px cursive'; c.fillStyle = '#2a6ac8'; c.fillText('ideas', 30, 52); c.fillStyle = '#d6453a'; c.fillText('snacks!', 300, 150); c.beginPath(); c.moveTo(30, 90); c.bezierCurveTo(120, 60, 200, 140, 300, 80); c.stroke(); c.strokeStyle = '#43b581'; c.beginPath(); c.arc(400, 60, 36, 0, 6.3); c.stroke(); } }));
      K.quad(g, 2.8, 1.1, 0, 1.55, 0.06, new THREE.MeshStandardMaterial({ map: t, roughness: 0.3 })); K.bx(g, 2.9, 0.06, 0.05, 0, 2.12, 0.03, K.M('#9aa3ab', { m: 0.7 })); K.bx(g, 2.9, 0.06, 0.05, 0, 0.96, 0.03, K.M('#9aa3ab', { m: 0.7 })); },
    poster(g, K, it) { const i = it.art || 0; const t = K.tx(canvasTex(220, 300, (c, w, h) => { const pal = [['#ffb25b', '#e5625e'], ['#8d939c', '#dfe3e8'], ['#4a90e2', '#c8e0f8'], ['#43b581', '#e8f6ee'], ['#2fb8d8', '#10141c'], ['#f2c14e', '#e5625e']][i % 6]; const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, pal[0]); gr.addColorStop(1, pal[1]); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.arc(w / 2, 110, 46 + (i % 3) * 8, 0, 6.3); c.fill(); c.fillStyle = 'rgba(20,24,36,0.8)'; c.fillRect(24, 220, w - 48, 14); c.fillRect(24, 246, (w - 48) * 0.6, 10); }));
      K.quad(g, 0.9, 1.2, 0, 1.6, 0.03, new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 })); },
    window(g, K, it) { const m = K.M('#f3f1ec', { r: 0.4 }); const glass = new THREE.MeshBasicMaterial({ color: skyGlass.clone() }); K.own.push(glass); (K.glass ||= []).push(glass);
      K.quad(g, 1.4, 1.3, 0, 1.7, 0.01, glass); for (const [x, y, w, h] of [[0, 2.37, 1.6, 0.08], [0, 1.03, 1.6, 0.08], [-0.76, 1.7, 0.08, 1.4], [0.76, 1.7, 0.08, 1.4], [0, 1.7, 0.04, 1.3]]) K.bx(g, w, h, 0.1, x, y - h / 2, 0.03, m); if (it.sill) K.bx(g, 1.7, 0.05, 0.22, 0, 0.98, 0.1, m); },
    rack(g, K, it) { const m = K.M('#7a8aa0', { m: 0.5, r: 0.4 }); K.bx(g, 1.1, 1.7, 0.4, 0, 0, 0, m); if (it.forms) for (let r = 0; r < 5; r++) for (let i = 0; i < 4; i++) K.bx(g, 0.2, 0.26, 0.04, -0.4 + i * 0.27, 0.15 + r * 0.32, 0.2, K.M(['#f6f1e6', '#ffe9a8', '#cfe6f2', '#f2d0d0'][(i + r) % 4])); },
    cooler(g, K) { K.bx(g, 0.4, 0.9, 0.4, 0, 0, 0, K.M('#e8eef2', { r: 0.4 })); K.cy(g, 0.15, 0.4, 0, 0.9, 0, K.M('#9fd8ff', { t: true, o: 0.55, r: 0.1 })); },
    cabinet(g, K, it) { const m = K.M(it.c || '#9aa3ab', { m: 0.3, r: 0.5 }); K.bx(g, 1.0, 1.35, 0.5, 0, 0, 0, m); for (let i = 0; i < 3; i++) K.bx(g, 0.96, 0.01, 0.01, 0, 0.45 + i * 0.4, 0.26, K.M('#5a6068')); if (it.router) K.bx(g, 0.24, 0.05, 0.16, 0.2, 1.37, 0.0, K.M('#202226'), null, false); },
    foosball(g, K) { K.bx(g, 1.4, 0.2, 0.8, 0, 0.7, 0, K.M('#2f8a4a', { r: 0.6 })); K.bx(g, 1.5, 0.05, 0.9, 0, 0.9, 0, K.M('#3a3a3e')); for (const x of [-1, 1]) for (const z of [-0.3, 0, 0.3]) K.bx(g, 0.05, 0.3, 0.05, x * 0.5 + z * 0.5, 0.4, z * 1.2, K.M('#9aa3ab')); for (const [x, z] of [[-0.65, -0.35], [0.65, -0.35], [-0.65, 0.35], [0.65, 0.35]]) K.bx(g, 0.07, 0.7, 0.07, x, 0, z, K.M('#3a3a3e')); },
    beanbag(g, K, it) { K.sp(g, 0.5, 0, 0.32, 0, K.M(it.c || '#e5625e', { r: 0.9 }), 0.7, true); },
    workbench(g, K, it) { const m = K.M(it.c || '#b58a58', { r: 0.55 }); K.bx(g, 2.6, 0.08, 0.8, 0, 0.88, 0, m); for (const x of [-1.2, 1.2]) for (const z of [-0.32, 0.32]) K.bx(g, 0.09, 0.88, 0.09, x, 0, z, K.M('#4a4a50', { m: 0.4 })); K.bx(g, 2.5, 0.05, 0.7, 0, 0.3, 0, K.M('#8a6a4a')); if (it.tools) { K.bx(g, 0.5, 0.12, 0.2, -0.7, 0.96, 0.05, K.M('#e5625e')); K.cy(g, 0.04, 0.24, 0.2, 0.96, 0.1, K.M('#f2c14e')); K.bx(g, 0.5, 0.04, 0.1, 0.9, 0.96, -0.1, K.M('#9aa3ab', { m: 0.8 })); } },
    pegboard(g, K) { K.bx(g, 2.4, 1.2, 0.04, 0, 1.2, 0.0, K.M('#c9b48a')); for (let i = 0; i < 8; i++) K.bx(g, 0.05, 0.28 + (i % 3) * 0.08, 0.05, -1.0 + i * 0.28, 1.5 - (i % 2) * 0.3, 0.05, K.M(['#9aa3ab', '#e5625e', '#4a90e2', '#f2c14e'][i % 4], { m: 0.4 }), null, false); },
    crates(g, K, it) { const m = K.M(it.c || '#c9a27a', { r: 0.8 }); K.bx(g, 0.9, 0.5, 0.9, 0, 0, 0, m); K.bx(g, 0.75, 0.45, 0.75, 0.04, 0.5, -0.02, K.M('#b58a58', { r: 0.8 })); K.bx(g, 0.2, 0.15, 0.22, 0.2, 0.95, 0.1, K.M('#e8d5a8')); },
    serverRack(g, K) { K.bx(g, 0.7, 1.9, 0.7, 0, 0, 0, K.M('#1c1f26', { m: 0.4 })); for (let i = 0; i < 9; i++) { K.bx(g, 0.5, 0.05, 0.02, 0, 0.2 + i * 0.19, 0.36, K.M('#101218')); K.bx(g, 0.04, 0.03, 0.02, 0.2, 0.22 + i * 0.19, 0.372, K.M('#3cff7a', { e: '#3cff7a', ei: 1.2 })); } },
    kioskShelf(g, K, it) { K.bx(g, 1.6, 1.9, 0.45, 0, 0, 0, K.M('#e8e2d6')); const cs = it.stuff === 'drinks' ? ['#4a90e2', '#e5625e', '#43b581', '#f2c14e'] : ['#ff7aa8', '#ffb25b', '#9b6bff', '#2fb8d8', '#f2c14e']; for (let r = 0; r < 5; r++) for (let i = 0; i < 7; i++) K.bx(g, 0.15, it.stuff === 'drinks' ? 0.3 : 0.14, 0.14, -0.66 + i * 0.22, 0.12 + r * 0.36, 0.1, K.M(cs[(i + r) % cs.length], { r: 0.4 }), null, false); },
    pot(g, K) { K.cy(g, 0.3, 0.5, 0, 0, 0, K.M('#c0683a')); K.sp(g, 0.4, 0, 0.8, 0, K.M('#3f8a4a'), 1); },
  };

  function windowGlass(K) { return K.glass || []; }

  // ── a whole room ──
  function build(id) {
    const r = ROOMS[id];
    const o = originOf(id);
    const group = new THREE.Group();
    group.name = `interior-${id}`;
    group.position.set(o.x, 0, o.z);
    const K = kit(r);
    const wallMat = lib.std('plaster', { color: col(r.wall), wet: false, normalScale: 0.2, extra: { side: THREE.FrontSide } });
    const floorMat = lib.std(r.floor === 'tile' ? 'paving' : r.floor, { color: r.floor === 'terrazzo' ? 0xf0ece4 : r.floor === 'tile' ? 0xe6dcc8 : 0xffffff, wet: false, normalScale: 0.4 });
    const trim = K.M('#f4f2ee', { r: 0.5 });
    const accent = K.M(r.accent, { r: 0.6 });
    const hw = r.w / 2; const hd = r.d / 2; const H = WALL_H;
    const plane = (w, h, x, y, z, ry, mat, uvs = 2.2) => {
      const g = new THREE.PlaneGeometry(w, h);
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / uvs, uv.getY(i) * h / uvs);
      K.geos.push(g);
      const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = shadows; group.add(m); return m;
    };
    // floor
    const fl = plane(r.w, r.d, 0, 0, 0, 0, floorMat, r.floor === 'wood' ? 3.4 : r.floor === 'terrazzo' ? 4 : 3); fl.rotation.x = -Math.PI / 2;
    // walls (their faces point INTO the room: the ones between the camera and the room are culled)
    plane(r.w, H, 0, H / 2, -hd, 0, wallMat);
    plane(r.d, H, -hw, H / 2, 0, Math.PI / 2, wallMat);
    plane(r.d, H, hw, H / 2, 0, -Math.PI / 2, wallMat);
    const sw = (r.w - DOOR_W) / 2;
    plane(sw, H, -hw + sw / 2, H / 2, hd, Math.PI, wallMat);
    plane(sw, H, hw - sw / 2, H / 2, hd, Math.PI, wallMat);
    plane(DOOR_W, H - 2.3, 0, 2.3 + (H - 2.3) / 2, hd, Math.PI, wallMat);
    // a painted band, baseboards, the caps of the walls (so the room has a silhouette from above)
    for (const [w, d, x, z] of [[r.w + 0.5, 0.25, 0, -hd - 0.12], [0.25, r.d + 0.5, -hw - 0.12, 0], [0.25, r.d + 0.5, hw + 0.12, 0], [sw + 0.25, 0.25, -hw + sw / 2, hd + 0.12], [sw + 0.25, 0.25, hw - sw / 2, hd + 0.12]]) K.bx(group, w, 0.16, d, x, H - 0.06, z, accent);
    for (const [w, d, x, z] of [[r.w, 0.04, 0, -hd + 0.02], [0.04, r.d, -hw + 0.02, 0], [0.04, r.d, hw - 0.02, 0]]) { K.bx(group, w, 0.14, d, x, 0, z, trim, null, false); K.bx(group, w, 0.5, d, x, 0.9, z, accent, null, false); }
    // the door frame, a mat, and a soft "light from outside"
    for (const x of [-DOOR_W / 2, DOOR_W / 2]) K.bx(group, 0.08, 2.3, 0.14, x, 0, hd - 0.05, trim);
    K.bx(group, DOOR_W + 0.16, 0.08, 0.14, 0, 2.3, hd - 0.05, trim);
    K.bx(group, 1.2, 0.02, 0.7, 0, 0, hd - 0.45, K.M('#6a5a4a', { r: 1 }), null, false);
    const out = K.quad(group, DOOR_W - 0.1, 2.25, 0, 1.13, hd + 0.02, new THREE.MeshBasicMaterial({ color: skyGlass.clone() }), Math.PI);
    K.own.push(out.material); (K.glass ||= []).push(out.material);
    // furniture
    for (const it of r.items) {
      const f = B[it.k];
      if (!f) continue;
      const g = new THREE.Group();
      g.position.set(it.x, 0, it.z);
      g.rotation.y = ((it.rot || 0) * Math.PI) / 180;
      f(g, K, it);
      group.add(g);
    }
    // people
    const npcs = [];
    for (const n of r.npcs) {
      const sp = speaker(n.id);
      let rec = people.get(n.id);
      if (!rec) {
        const person = createPerson(sp.spec, { shadows, quality: tier === 'low' ? 0.3 : 0.45, tier, outline: tier !== 'low', key: sp.spec.id });
        rec = { person };
        people.set(n.id, rec);
      }
      rec.person.group.position.set(o.x + n.x, 0, o.z + n.z);
      rec.person.group.rotation.y = (n.rot * Math.PI) / 180;
      rec.person.setMood('smile');
      scene.add(rec.person.group);
      npcs.push({ person: rec.person, id: n.id, x: o.x + n.x, z: o.z + n.z, rot: (n.rot * Math.PI) / 180, name: sp.name, speaker: sp });
    }
    scene.add(group);
    const warm = r.mood === 'warm' ? 0xffd9a8 : 0xe8f0ff;
    return { id, group, K, npcs, glass: windowGlass(K), geos: K.geos, tex: K.tex, own: K.own, light: { x: o.x, y: H - 0.5, z: o.z - 0.3, color: warm, dist: Math.max(r.w, r.d) * 1.6 }, hum: r.hum };
  }

  function free(c) {
    scene.remove(c.group);
    for (const n of c.npcs) scene.remove(n.person.group);
    for (const g of c.geos) g.dispose();
    for (const t of c.tex) t.dispose();
    for (const m of c.own) m.dispose();
  }

  return {
    get current() { return cur; },
    get inside() { return !!cur; },
    /** Builds the room (the caller hides the street). Returns { spawn, exit, spots, npcs, light, hum }. */
    enter(id) {
      if (cur) { free(cur); cur = null; }
      cur = build(id);
      this.setSky(skyGlass, day);
      return { spawn: spawnOf(id), exit: exitOf(id), spots: spotsOf(id), npcs: cur.npcs, light: cur.light, hum: cur.hum };
    },
    leave() { if (cur) { free(cur); cur = null; } },
    /** The window panes show the sky (a colour) and go dim at night. */
    setSky(color, dayness = 1) {
      skyGlass = color; day = dayness;
      if (!cur) return;
      const c = skyGlass.clone().multiplyScalar(0.35 + 0.65 * day);
      for (const m of cur.glass) m.color.copy(c);
    },
    /** Per frame: the people idle, breathe, blink, and turn to face Ori when he is near. */
    update(dt, ori) {
      if (!cur) return;
      for (const n of cur.npcs) {
        const dx = ori.x - n.x; const dz = ori.z - n.z;
        const d = Math.hypot(dx, dz);
        if (d < 4.5) {
          const want = Math.atan2(dx, dz);
          let a = want - n.person.group.rotation.y;
          a = Math.atan2(Math.sin(a), Math.cos(a));
          n.person.group.rotation.y += a * Math.min(1, dt * 3);
        }
        n.person.update(dt, { speed: 0 });
      }
    },
    /** Make a person wave / smile (used when Ori speaks to them). */
    npc(id) { return cur ? cur.npcs.find((n) => n.id === id) || null : null; },
    dispose() {
      if (cur) { free(cur); cur = null; }
      for (const r of people.values()) r.person.dispose();
      people.clear();
      UB.dispose(); UC.dispose(); US.dispose(); // (they are re-uploaded if another game starts)
    },
    KINDS,
  };
}
