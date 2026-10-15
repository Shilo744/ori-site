// 3D keyboard for the MacBook: layout (cm, deck coordinates), one InstancedMesh of rounded keycaps, legends from a
// texture atlas, and a spring-based press animation driven by real keydown/keyup (`event.code` → key).
//
// All keys share one rounded-cap geometry. Wider keys are produced in the vertex shader by shifting the vertices of the
// right/left (and front/back) halves apart, so the rounded corners and bevels keep their true radius at any width.
import * as THREE from 'three';
import { legendAtlas } from './macbook-textures.js';

export const CAP = { w: 1.709, d: 1.634, h: 0.22, r: 0.3, bevel: 0.085 };
export const KEY_TRAVEL = 0.06; // cm of travel when pressed

const UNIT = 27.25 / 14.5;
const KEY_PITCH_Z = UNIT * 0.96;
const GAP = 0.17;

/** Keyboard layout in deck coordinates: x right, z towards the user, (0,0) = centre of the deck plate. */
export function buildLayout({ top = -8.75 } = {}) {
  const keys = [];
  const x0 = -27.25 / 2;
  const row = (i) => top + (i + 0.5) * KEY_PITCH_Z;
  const add = (code, cx, cz, w, d, legend) => keys.push({ code, x: cx, z: cz, w, d, legend });

  const rows = [];
  const pair = (top_, main) => ({ top: top_, main });
  rows.push({
    widths: Array(14).fill(14.5 / 14),
    keys: [['Escape', { fn: 'esc' }], ...Array.from({ length: 12 }, (_, i) => [`F${i + 1}`, { fn: `F${i + 1}` }]), ['TouchID', { touchId: true }]],
  });
  rows.push({
    widths: [...Array(13).fill(1), 1.5],
    keys: [
      ['Backquote', pair('~', '`')], ['Digit1', pair('!', '1')], ['Digit2', pair('@', '2')], ['Digit3', pair('#', '3')], ['Digit4', pair('$', '4')],
      ['Digit5', pair('%', '5')], ['Digit6', pair('^', '6')], ['Digit7', pair('&', '7')], ['Digit8', pair('*', '8')], ['Digit9', pair('(', '9')],
      ['Digit0', pair(')', '0')], ['Minus', pair('_', '-')], ['Equal', pair('+', '=')], ['Backspace', { word: 'delete', align: 'right' }],
    ],
  });
  rows.push({
    widths: [1.5, ...Array(12).fill(1), 1],
    keys: [
      ['Tab', { word: 'tab' }], ...'QWERTYUIOP'.split('').map((c) => [`Key${c}`, { main: c }]),
      ['BracketLeft', pair('{', '[')], ['BracketRight', pair('}', ']')], ['Backslash', pair('|', '\\')],
    ],
  });
  rows.push({
    widths: [1.75, ...Array(11).fill(1), 1.75],
    keys: [
      ['CapsLock', { word: 'caps lock', dot: true }], ...'ASDFGHJKL'.split('').map((c) => [`Key${c}`, { main: c }]),
      ['Semicolon', pair(':', ';')], ['Quote', pair('"', "'")], ['Enter', { word: 'return', align: 'right' }],
    ],
  });
  rows.push({
    widths: [2.25, ...Array(10).fill(1), 2.25],
    keys: [
      ['ShiftLeft', { word: 'shift' }], ...'ZXCVBNM'.split('').map((c) => [`Key${c}`, { main: c }]),
      ['Comma', pair('<', ',')], ['Period', pair('>', '.')], ['Slash', pair('?', '/')], ['ShiftRight', { word: 'shift', align: 'right' }],
    ],
  });
  rows.push({
    widths: [1, 1, 1, 1.25, 5, 1.25, 1],
    keys: [
      ['Fn', { fn: 'fn' }], ['ControlLeft', { mod: 'control', sym: '⌃' }], ['AltLeft', { mod: 'option', sym: '⌥' }], ['MetaLeft', { mod: 'command', sym: '⌘' }],
      ['Space', {}], ['MetaRight', { mod: 'command', sym: '⌘' }], ['AltRight', { mod: 'option', sym: '⌥' }],
    ],
  });

  rows.forEach((r, ri) => {
    let x = x0;
    r.keys.forEach(([code, legend], i) => {
      const wu = r.widths[i] * UNIT;
      add(code, x + wu / 2, row(ri), wu - GAP, CAP.d, legend);
      x += wu;
    });
    if (ri === rows.length - 1) {
      // arrow cluster: ◂ ▴▾ ▸ (up / down are half-height keys stacked in one cell)
      const half = (KEY_PITCH_Z - GAP) / 2 - 0.03;
      const lower = row(ri) + half / 2 + 0.04, upper = row(ri) - half / 2 - 0.04;
      add('ArrowLeft', x + UNIT / 2, lower, UNIT - GAP, half, { arrow: 'left' });
      add('ArrowUp', x + UNIT * 1.5, upper, UNIT - GAP, half, { arrow: 'up' });
      add('ArrowDown', x + UNIT * 1.5, lower, UNIT - GAP, half, { arrow: 'down' });
      add('ArrowRight', x + UNIT * 2.5, lower, UNIT - GAP, half, { arrow: 'right' });
    }
  });
  keys.forEach((k, i) => { k.index = i; });
  const bottom = top + rows.length * KEY_PITCH_Z;
  return { keys, halfW: 27.25 / 2, top, bottom };
}

function roundedRect(w, h, r) {
  const x = -w / 2, y = -h / 2;
  const s = new THREE.Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

/** One rounded keycap (base size CAP.w × CAP.d, base on y = 0). Per-vertex `aSide` = 1 on the rounded edges (plain black). */
function capGeometry() {
  const { w, d, h, r, bevel: b } = CAP;
  const geo = new THREE.ExtrudeGeometry(roundedRect(w - 2 * b, d - 2 * b, r - b), {
    depth: h - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 4,
  });
  geo.rotateX(-Math.PI / 2);
  geo.computeBoundingBox();
  geo.translate(0, -geo.boundingBox.min.y, 0);
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2), side = new Float32Array(pos.count);
  const fw = w - 2 * b, fd = d - 2 * b;
  for (let i = 0; i < pos.count; i++) {
    const top = nor.getY(i) > 0.99;
    side[i] = top ? 0 : 1;
    // flat top: legend texture coordinates (v grows towards the back of the key, −z)
    uv[i * 2] = pos.getX(i) / fw + 0.5;
    uv[i * 2 + 1] = -pos.getZ(i) / fd + 0.5;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
  return geo;
}

function capMaterial(map, black) {
  const mat = new THREE.MeshStandardMaterial({ map, color: 0xffffff, roughness: 0.52, metalness: 0.05 });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec2 aExt;
attribute vec4 aRect;
attribute float aSide;`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>
#ifdef USE_MAP
  vMapUv = aSide > 0.5 ? vec2(${black[0].toFixed(4)}, ${black[1].toFixed(4)}) : aRect.xy + uv * aRect.zw;
#endif`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
  transformed.x += sign(position.x) * aExt.x;
  transformed.z += sign(position.z) * aExt.y;`);
  };
  mat.customProgramCacheKey = () => 'macbook-keycap';
  return mat;
}

/**
 * @param {object} o
 * @param {object} o.layout   from buildLayout()
 * @param {number} o.baseY    y of the key well floor (cap bottoms rest here)
 * @param {number} o.aniso
 */
export function createKeys({ layout, baseY, aniso = 8 }) {
  const keys = layout.keys;
  const n = keys.length;
  const atlas = legendAtlas(keys, { inset: 2 * CAP.bevel, aniso });
  const geo = capGeometry();

  const ext = new Float32Array(n * 2), rect = new Float32Array(n * 4);
  keys.forEach((k, i) => {
    ext[i * 2] = (k.w - CAP.w) / 2;
    ext[i * 2 + 1] = (k.d - CAP.d) / 2;
    rect.set(atlas.rects[i], i * 4);
  });
  geo.setAttribute('aExt', new THREE.InstancedBufferAttribute(ext, 2));
  geo.setAttribute('aRect', new THREE.InstancedBufferAttribute(rect, 4));

  const mesh = new THREE.InstancedMesh(geo, capMaterial(atlas.texture, atlas.black), n);
  mesh.name = 'keycaps';
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  const m = new THREE.Matrix4();
  keys.forEach((k, i) => mesh.setMatrixAt(i, m.makeTranslation(k.x, baseY, k.z)));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  // ── press animation: critically-ish damped spring per key; only moving keys are touched ──
  const byCode = new Map(keys.map((k) => [k.code, k.index]));
  const depth = new Float32Array(n), vel = new Float32Array(n), target = new Float32Array(n);
  const active = new Set();
  const arr = mesh.instanceMatrix.array;
  const STIFF = 1400, DAMP = 2 * Math.sqrt(STIFF) * 0.55;

  const set = (code, v) => {
    const i = byCode.get(code);
    if (i === undefined) return;
    target[i] = v;
    active.add(i);
  };

  function update(dt) {
    if (!active.size) return false;
    // sub-steps keep the spring stable even at very low frame rates
    const total = Math.min(dt, 0.1);
    const n = Math.max(1, Math.ceil(total * 120));
    const h = total / n;
    active.forEach((i) => {
      for (let s = 0; s < n; s++) {
        vel[i] += ((target[i] - depth[i]) * STIFF - vel[i] * DAMP) * h;
        depth[i] += vel[i] * h;
      }
      if (Math.abs(depth[i] - target[i]) < 0.002 && Math.abs(vel[i]) < 0.03) { depth[i] = target[i]; vel[i] = 0; active.delete(i); }
      arr[i * 16 + 13] = baseY - Math.max(-0.2, depth[i]) * KEY_TRAVEL;
    });
    mesh.instanceMatrix.needsUpdate = true;
    return true;
  }

  const down = (e) => { if (!e.repeat) set(e.code, 1); };
  const up = (e) => set(e.code, 0);
  const releaseAll = () => byCode.forEach((_, code) => { if (target[byCode.get(code)]) set(code, 0); });

  return {
    mesh,
    layout,
    press: (code) => set(code, 1),
    release: (code) => set(code, 0),
    releaseAll,
    update,
    /** Listens to real key events on `window` so typing anywhere on the desktop presses the 3D keys. */
    bind(target_ = window) {
      target_.addEventListener('keydown', down);
      target_.addEventListener('keyup', up);
      target_.addEventListener('blur', releaseAll);
      return () => { target_.removeEventListener('keydown', down); target_.removeEventListener('keyup', up); target_.removeEventListener('blur', releaseAll); };
    },
    /** Test hook: how far (0..1) each key is pressed right now. */
    depthOf: (code) => (byCode.has(code) ? depth[byCode.get(code)] : null),
    triangles: geo.attributes.position.count / 3 * n,
    dispose() { geo.dispose(); mesh.material.dispose(); atlas.texture.dispose(); },
  };
}
