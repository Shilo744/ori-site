// Procedural MacBook Air (13"). Units are centimetres. Origin = centre of the base, resting on y = 0.
// Real dimensions: 30.41 × 21.50 × 1.13 cm, 13.6" 2560×1664 display (≈ 29.0 × 18.9 cm).
import * as THREE from 'three';
import { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { keyboardDeckTexture, keyboardBumpTexture } from './textures.js';
import { SCREEN_PX } from '../screen-size.js';

export const SCREEN_CM = { w: 29.03, h: 18.87 };
export { SCREEN_PX };

const W = 30.41, D = 21.5, H = 1.13, LID_T = 0.36;

function roundedRectShape(w, h, r) {
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

/** Flat slab with rounded plan corners and a smooth round-over on every edge. */
function slab(w, d, h, cornerR, bevel) {
  const shape = roundedRectShape(w - 2 * bevel, d - 2 * bevel, Math.max(0.2, cornerR - bevel));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: h - 2 * bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 6,
    curveSegments: 28,
  });
  geo.rotateX(-Math.PI / 2); // extrusion → +Y
  geo.computeBoundingBox();
  geo.translate(0, -geo.boundingBox.min.y, 0);
  geo.computeVertexNormals();
  return geo;
}

export function createMacBook({ screenElement, aniso = 8, openAngleDeg = 105 } = {}) {
  const group = new THREE.Group();
  group.name = 'macbook';

  const alu = new THREE.MeshStandardMaterial({ color: 0xd3d5da, metalness: 1, roughness: 0.42 });
  const aluDark = new THREE.MeshStandardMaterial({ color: 0x9a9da3, metalness: 1, roughness: 0.45 });

  // ── base ────────────────────────────────────────────────
  const base = new THREE.Mesh(slab(W, D, H, 1.35, 0.32), alu);
  base.castShadow = base.receiveShadow = true;
  group.add(base);

  // rubber feet (peek out slightly under the rim)
  const footMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.9 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.12, 20), footMat);
    f.position.set(sx * (W / 2 - 3), 0.05, sz * (D / 2 - 2.6));
    group.add(f);
  }

  // keyboard deck (silver, black keys, trackpad)
  const deckMat = new THREE.MeshStandardMaterial({
    map: keyboardDeckTexture({ aniso }),
    bumpMap: keyboardBumpTexture(),
    bumpScale: 0.9,
    metalness: 0.55,
    roughness: 0.52,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.62, D - 0.62), deckMat);
  deck.rotation.x = -Math.PI / 2;
  deck.position.y = H + 0.015;
  deck.receiveShadow = true;
  group.add(deck);

  // hinge barrel (mostly hidden, gives the dark gap under the lid)
  const hingeMat = new THREE.MeshStandardMaterial({ color: 0x2a2b2e, metalness: 0.8, roughness: 0.45 });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, W * 0.82, 20), hingeMat);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(0, H + 0.02, -D / 2 + 0.38);
  group.add(barrel);

  // ── lid ─────────────────────────────────────────────────
  const hinge = new THREE.Group();
  hinge.position.set(0, H + 0.04, -D / 2 + 0.45);
  hinge.rotation.x = -THREE.MathUtils.degToRad(openAngleDeg);
  group.add(hinge);

  const lid = new THREE.Mesh(slab(W, D, LID_T, 1.35, 0.17), alu);
  lid.position.set(0, 0, D / 2);
  lid.castShadow = lid.receiveShadow = true;
  hinge.add(lid);

  // black glass covering the inside face of the lid (rounded like the real thing)
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x060607,
    roughness: 0.1,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });
  const glass = new THREE.Mesh(new THREE.ShapeGeometry(roundedRectShape(W - 0.42, D - 0.42, 1.1), 24), glassMat);
  glass.rotation.x = Math.PI / 2; // faces local −Y
  glass.position.set(0, -0.012, D / 2);
  hinge.add(glass);

  // display position on the glass: slim top bezel, deeper bottom lip
  const bottom = 1.75;
  const sy = bottom + SCREEN_CM.h / 2;

  const off = new THREE.Mesh(
    new THREE.PlaneGeometry(SCREEN_CM.w, SCREEN_CM.h),
    new THREE.MeshBasicMaterial({ color: 0x0a0b0d })
  );
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

  void aluDark;
  return { group, screen: css, screenMesh: off, glow, hinge };
}
