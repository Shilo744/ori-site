// Procedural MacBook Air (13"). Units are centimetres. Origin = centre of the base, resting on y = 0.
// Real dimensions: 30.41 × 21.50 cm, 13.6" 2560×1664 display (≈ 29.0 × 18.9 cm).
//   • brushed-aluminium shell, black key-well + perforated deck plate with 78 real keycaps (macbook-keys.js)
//   • glass trackpad, speaker grilles, side ports, hinge, feet
//   • the lid opens/closes (setLid) — the CSS3D screen is hidden while the lid is nearly shut (CSS3D is not depth-tested)
import * as THREE from 'three';
import { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SCREEN_PX } from '../screen-size.js';
import * as sound from '../audio.js';
import { brushedTexture, deckTextures } from './macbook-textures.js';
import { buildLayout, createKeys, CAP } from './macbook-keys.js';

export const SCREEN_CM = { w: 29.03, h: 18.87 };
export { SCREEN_PX };

const W = 30.41, D = 21.5, H = 0.8, LID_T = 0.34;
const DECK = { w: W - 0.62, d: D - 0.62 };
const WELL_Y = H + 0.004;
const DECK_Y = H + 0.012;
const OPEN_DEG = 105;
const HIDE_SCREEN_BELOW_DEG = 70; // the DOM screen is not depth-tested: hide it once the lid is nearly shut
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function roundedRectPath(P, cx, cy, w, h, r) {
  const x = cx - w / 2, y = cy - h / 2;
  const s = new P();
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
const rrShape = (w, h, r) => roundedRectPath(THREE.Shape, 0, 0, w, h, r);

/** Flat slab with rounded plan corners and a smooth round-over on every edge. Base on y = 0. */
function slab(w, d, h, cornerR, bevel, segs = 5) {
  const geo = new THREE.ExtrudeGeometry(rrShape(w - 2 * bevel, d - 2 * bevel, Math.max(0.2, cornerR - bevel)), {
    depth: h - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: segs, curveSegments: 24,
  });
  geo.rotateX(-Math.PI / 2);
  geo.computeBoundingBox();
  geo.translate(0, -geo.boundingBox.min.y, 0);
  geo.computeVertexNormals();
  return geo;
}

/** The perforated deck plate: one rounded cut-out per keycap (+ the trackpad), planar UVs over the whole plate. */
function deckGeometry(layout, pad) {
  const shape = rrShape(DECK.w, DECK.d, 1.0);
  const m = 0.075; // gap around every cap
  layout.keys.forEach((k) => shape.holes.push(roundedRectPath(THREE.Path, k.x, -k.z, k.w + 2 * m, k.d + 2 * m, CAP.r + m)));
  shape.holes.push(roundedRectPath(THREE.Path, pad.x, -pad.z, pad.w + 0.09, pad.d + 0.09, pad.r + 0.045)); // a hairline gap, not a black frame
  const geo = new THREE.ShapeGeometry(shape, 4);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / DECK.w + 0.5, -pos.getZ(i) / DECK.d + 0.5);
  return geo;
}

function stadium(len, hgt) {
  const r = hgt / 2, s = new THREE.Shape();
  s.moveTo(-len / 2 + r, -r);
  s.lineTo(len / 2 - r, -r);
  s.absarc(len / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(-len / 2 + r, r);
  s.absarc(-len / 2 + r, 0, r, Math.PI / 2, Math.PI * 1.5, false);
  return new THREE.ShapeGeometry(s, 10);
}

export function createMacBook({ screenElement, aniso = 8, openAngleDeg = OPEN_DEG } = {}) {
  const group = new THREE.Group();
  group.name = 'macbook';

  // ── materials ──
  const brushed = brushedTexture({ aniso });
  const shellRepeat = (t, rx, ry) => { const c = t.clone(); c.repeat.set(rx, ry); c.needsUpdate = true; return c; };
  const alu = new THREE.MeshStandardMaterial({
    color: 0xdcdee3, metalness: 0.72, roughness: 0.92, roughnessMap: shellRepeat(brushed, 1 / 14, 1 / 14), bumpMap: shellRepeat(brushed, 1 / 14, 1 / 14), bumpScale: 0.35,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.7, metalness: 0.2 });

  // ── base ──
  const base = new THREE.Mesh(slab(W, D, H, 1.35, 0.2), alu);
  base.castShadow = base.receiveShadow = true;
  group.add(base);

  // rubber feet (merged: one draw call)
  const feetGeo = mergeGeometries([[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => {
    const g = new THREE.CylinderGeometry(0.9, 0.9, 0.12, 20);
    g.translate(sx * (W / 2 - 3), 0.05, sz * (D / 2 - 2.6));
    return g;
  }));
  group.add(new THREE.Mesh(feetGeo, new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.9 })));

  // ── keyboard well, deck plate, keycaps, trackpad ──
  const layout = buildLayout({ top: -8.75 });
  const pad = { x: 0, z: 6.25, w: 12.4, d: 7.0, r: 0.45 };

  const well = new THREE.Mesh(new THREE.PlaneGeometry(DECK.w - 0.2, DECK.d - 0.2), dark);
  well.rotation.x = -Math.PI / 2;
  well.position.y = WELL_Y;
  well.receiveShadow = true;
  group.add(well);

  // the trackpad's gap reads as a soft grey seam (not a hard black outline): a mid-grey plate under its cut-out
  const padWell = new THREE.Mesh(new THREE.ShapeGeometry(rrShape(pad.w + 0.2, pad.d + 0.2, pad.r + 0.1), 12), new THREE.MeshStandardMaterial({ color: 0x8c8f96, roughness: 0.6, metalness: 0.5 }));
  padWell.rotation.x = -Math.PI / 2;
  padWell.position.set(pad.x, WELL_Y + 0.0008, pad.z);
  group.add(padWell);

  const dt = deckTextures({ w: DECK.w, d: DECK.d, kbHalfW: layout.halfW, kbTop: layout.top, kbBottom: layout.bottom, aniso });
  const deckMat = new THREE.MeshStandardMaterial({
    map: dt.map, bumpMap: dt.bump, bumpScale: 0.5, metalness: 0.5, roughness: 1.0, roughnessMap: dt.bump,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const deck = new THREE.Mesh(deckGeometry(layout, pad), deckMat);
  deck.position.y = DECK_Y;
  deck.receiveShadow = true;
  group.add(deck);

  const keys = createKeys({ layout, baseY: WELL_Y, aniso });
  group.add(keys.mesh);

  // trackpad: a thin glass pane with a bevelled edge, flush with the deck
  const tpGeo = new THREE.ExtrudeGeometry(rrShape(pad.w - 0.04, pad.d - 0.04, pad.r - 0.02), {
    depth: 0.01, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3, curveSegments: 10,
  });
  tpGeo.rotateX(-Math.PI / 2);
  tpGeo.computeBoundingBox();
  tpGeo.translate(0, -tpGeo.boundingBox.max.y, 0); // top face at y = 0
  const trackpad = new THREE.Mesh(tpGeo, new THREE.MeshPhysicalMaterial({
    color: 0xc9ccd3, metalness: 0.45, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15,
  }));
  trackpad.position.set(pad.x, DECK_Y, pad.z);
  trackpad.receiveShadow = true;
  group.add(trackpad);

  // ── side ports: dark recesses on the flat part of the side wall (left: MagSafe + 2×USB-C, right: headphone jack) ──
  const ports = [];
  const port = (geo, side, z) => {
    geo.rotateY(side * Math.PI / 2);
    geo.translate(side * (W / 2 + 0.006), H / 2, z);
    ports.push(geo);
  };
  port(stadium(1.1, 0.24), -1, -2.9); // MagSafe
  port(stadium(0.86, 0.27), -1, 0.1); // USB-C
  port(stadium(0.86, 0.27), -1, 3.0); // USB-C
  port(new THREE.CircleGeometry(0.17, 20), 1, -2.9); // headphone jack
  group.add(new THREE.Mesh(mergeGeometries(ports), new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.35, metalness: 0.4 })));

  // ── hinge: dark barrel under the lid + two aluminium end caps ──
  const hingeY = H + 0.26;
  const hingeZ = -D / 2 + 0.45;
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, W * 0.86, 24), new THREE.MeshStandardMaterial({ color: 0x1f2023, metalness: 0.85, roughness: 0.4 }));
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(0, H + 0.14, hingeZ - 0.12);
  group.add(barrel);
  const capGeo = new THREE.CylinderGeometry(0.47, 0.47, 0.5, 24);
  for (const sx of [-1, 1]) {
    const c = new THREE.Mesh(capGeo, alu);
    c.rotation.z = Math.PI / 2;
    c.position.set(sx * (W * 0.43 + 0.2), H + 0.14, hingeZ - 0.12);
    c.castShadow = true;
    group.add(c);
  }

  // ── lid ──
  const hinge = new THREE.Group();
  hinge.position.set(0, hingeY, hingeZ);
  hinge.rotation.x = -THREE.MathUtils.degToRad(openAngleDeg);
  group.add(hinge);

  const lid = new THREE.Mesh(slab(W, D, LID_T, 1.35, 0.1, 3), alu);
  lid.position.set(0, 0, D / 2);
  lid.castShadow = lid.receiveShadow = true;
  hinge.add(lid);

  // black glass covering the inside face of the lid
  const glass = new THREE.Mesh(new THREE.ShapeGeometry(rrShape(W - 0.42, D - 0.42, 1.1), 24), new THREE.MeshPhysicalMaterial({
    color: 0x060607, roughness: 0.1, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08,
  }));
  glass.rotation.x = Math.PI / 2; // faces local −Y
  glass.position.set(0, -0.012, D / 2);
  hinge.add(glass);

  // display position on the glass: slim top bezel, deeper bottom lip
  const sy = 1.75 + SCREEN_CM.h / 2;
  const off = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_CM.w, SCREEN_CM.h), new THREE.MeshBasicMaterial({ color: 0x0a0b0d }));
  off.rotation.x = Math.PI / 2;
  off.position.set(0, -0.02, sy);
  hinge.add(off);

  // live DOM screen (rendered by CSS3DRenderer)
  const css = new CSS3DObject(screenElement);
  css.rotation.x = Math.PI / 2;
  css.position.set(0, -0.03, sy);
  css.scale.setScalar(SCREEN_CM.w / SCREEN_PX.w);
  hinge.add(css);

  // soft glow from the display onto the keyboard / desk
  const glow = new THREE.PointLight(0xdce8ff, 0, 0, 2);
  glow.position.set(0, 12, 14);
  group.add(glow);

  // ── lid animation ──
  let angle = openAngleDeg;
  let anim = null; // { from, to, t0, dur }
  let screenShown = true;
  const applyAngle = () => {
    hinge.rotation.x = -THREE.MathUtils.degToRad(angle);
    const show = angle > HIDE_SCREEN_BELOW_DEG;
    if (show !== screenShown) {
      screenShown = show;
      screenElement.style.visibility = show ? '' : 'hidden';
    }
  };

  /** Opens/closes the lid. `durationMs` 0 = instantly. Plays a soft click on opening and a thud when it shuts. */
  function setLid(open, durationMs = 1000) {
    const to = open ? openAngleDeg : 0;
    if (anim && anim.to === to) return;
    if (durationMs <= 0) { anim = null; angle = to; applyAngle(); return; }
    if (!anim && Math.abs(angle - to) < 0.01) return;
    anim = { from: angle, to, t0: performance.now(), dur: durationMs };
    if (open) sound.latch();
  }

  function update(dt) {
    const moved = keys.update(dt);
    if (anim) {
      const k = Math.min(1, (performance.now() - anim.t0) / anim.dur);
      const opening = anim.to > anim.from;
      // opening settles with a tiny overshoot, closing decelerates into the base
      angle = anim.from + (anim.to - anim.from) * ease(k) + (opening ? 2.4 * Math.sin(Math.PI * k) * (1 - k) * 1.6 : 0);
      applyAngle();
      if (k >= 1) {
        angle = anim.to;
        const closed = anim.to === 0;
        anim = null;
        applyAngle();
        if (closed) sound.thud();
      }
    }
    return moved || !!anim;
  }

  const _h = new THREE.Matrix4(), _q = new THREE.Quaternion(), _x = new THREE.Vector3(1, 0, 0);
  /** World matrix of the screen plane for a given lid angle (used to aim the camera at the screen while the lid is still closed). */
  function screenMatrixAt(deg, out = new THREE.Matrix4()) {
    group.updateWorldMatrix(true, false);
    _h.compose(hinge.position, _q.setFromAxisAngle(_x, -THREE.MathUtils.degToRad(deg)), hinge.scale);
    css.updateMatrix();
    return out.multiplyMatrices(group.matrixWorld, _h).multiply(css.matrix);
  }

  applyAngle();
  return {
    group,
    screen: css,
    screenMesh: off,
    glow,
    hinge,
    keys,
    setLid,
    update,
    screenMatrixAt,
    OPEN_DEG: openAngleDeg,
    get lidAngle() { return angle; },
    /** Target state of the lid (true while opening / open). */
    get lidOpen() { return anim ? anim.to > 0 : angle > 1; },
    /** 0 (shut) … 1 (fully open). */
    get openness() { return THREE.MathUtils.clamp(angle / openAngleDeg, 0, 1); },
    get lidMoving() { return !!anim; },
  };
}
