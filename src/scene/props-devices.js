// Devices and desk accessories (T12). Units: centimetres, y-up; every group stands on y = 0 so index.js can drop it on the desk.
import * as THREE from 'three';
import { box, rbox, lathe, mesh, roundedRectShape, slabGeo, smooth } from './props.js';
import { mergeByMaterial } from './merge.js';

const flat = (shape, depth, mat, y = 0) => {
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 20 });
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, mat);
  m.position.y = y;
  m.castShadow = m.receiveShadow = true;
  return m;
};

// ── mug on a cork coaster ──
export function createMug(m) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(5.4, 5.4, 0.35, 40), m.clay, { y: 0.175 }));
  const prof = [[0, 0], [3.6, 0], [4.2, 0.4], [4.4, 9], [4.1, 9.5], [3.7, 9.5], [3.9, 8.9], [3.7, 1.2], [0, 1.2]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  g.add(mesh(new THREE.LatheGeometry(prof, 36), m.ceramic, { y: 0.35 }));
  g.add(mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.2, 28), m.coffee, { y: 8.15, cast: false }));
  g.add(mesh(new THREE.TorusGeometry(2.7, 0.62, 10, 24, Math.PI), m.ceramic, { x: 4.2, y: 5.15, rz: -Math.PI / 2 }));
  const merged = mergeByMaterial(g);
  merged.name = 'mug';
  return merged;
}

// Apple Magic Mouse: 5.71 × 11.35 × 2.16 cm, white glass top that tapers toward the front (−Z).
export function createMouse() {
  const g = new THREE.Group();
  const L = 11.35, Wd = 5.71, Ht = 2.16;
  const white = new THREE.MeshPhysicalMaterial({ color: 0xf6f6f4, roughness: 0.22, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.12 });
  const alu = new THREE.MeshStandardMaterial({ color: 0xd4d6da, metalness: 1, roughness: 0.38 });
  const seam = new THREE.MeshStandardMaterial({ color: 0x2a2b2f, roughness: 0.6 });

  g.add(flat(roundedRectShape(Wd - 0.5, L - 0.5, 2.3), 0.18, alu));
  g.add(flat(roundedRectShape(Wd - 0.9, L - 0.9, 2.15), 0.06, seam, 0.16)); // the dark gap between the aluminium base and the glass

  const bev = 0.55;
  const geo = new THREE.ExtrudeGeometry(roundedRectShape(Wd - 2 * bev, L - 2 * bev, 2.2), {
    depth: Ht - 0.18 - 2 * bev + 0.0001,
    bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 8, curveSegments: 28,
  });
  geo.rotateX(-Math.PI / 2);
  geo.computeBoundingBox();
  geo.translate(0, -geo.boundingBox.min.y + 0.2, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp((pos.getZ(i) + L / 2) / L, 0, 1);
    pos.setY(i, 0.2 + (pos.getY(i) - 0.2) * (0.42 + 0.58 * Math.pow(t, 0.8)));
  }
  geo.computeVertexNormals();
  const body = new THREE.Mesh(geo, white);
  body.castShadow = body.receiveShadow = true;
  g.add(body);
  return g;
}

// iPhone Pro: 7.15 × 14.67 × 0.83 cm — titanium frame with side buttons, USB-C + speaker grille, camera plateau on the back.
export function createIPhone(m, screenTex) {
  const g = new THREE.Group();
  const W = 7.15, L = 14.67, H = 0.83;
  g.add(mesh(rbox(W, H, L, 0.98, 5), m.titanium, { y: H / 2 }));
  const scr = new THREE.Mesh(
    new THREE.PlaneGeometry(W - 0.04, L - 0.04),
    new THREE.MeshBasicMaterial({ map: screenTex, transparent: true, alphaTest: 0.5, toneMapped: false })
  );
  scr.rotation.x = -Math.PI / 2;
  scr.position.y = H + 0.012;
  g.add(scr);
  // side buttons: action + volume on the left edge, power on the right
  [[-1, 0.86, -4.9, 1.3], [-1, 0.86, -2.9, 1.9], [-1, 0.86, -0.4, 1.9], [1, 0.86, -3.3, 2.9]].forEach(([s, , z, len]) => {
    g.add(mesh(rbox(0.26, 0.46, len, 0.12, 2), m.titanium, { x: s * (W / 2 + 0.05), y: H * 0.62, z, cast: false }));
  });
  // bottom edge: USB-C slot flanked by speaker grille dots
  g.add(mesh(rbox(0.9, 0.34, 0.12, 0.05, 2), m.black, { x: 0, y: H / 2, z: L / 2 + 0.01, cast: false }));
  for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) g.add(mesh(new THREE.SphereGeometry(0.07, 6, 5), m.black, { x: sx * (1.3 + i * 0.28), y: H / 2, z: L / 2 + 0.005, cast: false }));
  // camera plateau + three lenses + flash on the BACK (the phone lies face-up, so it sits just below the desk surface)
  g.add(mesh(rbox(3.4, 0.3, 3.4, 0.75, 4), m.titanium, { x: -1.35, y: -0.15, z: -L / 2 + 2.3, cast: false }));
  [[-2.2, -L / 2 + 1.5], [-0.5, -L / 2 + 1.5], [-1.35, -L / 2 + 3.2]].forEach(([x, z]) => {
    g.add(mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.12, 20), m.silver, { x, y: -0.34, z, cast: false }));
    g.add(mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.14, 20), m.glass, { x, y: -0.37, z, cast: false }));
  });
  return mergeByMaterial(g);
}

// iPad Air on a slim aluminium stand (landscape), leaning back ~12°.
export function createIPad(m, screenTex) {
  const g = new THREE.Group();
  const W = 24.76, Hh = 17.85, D = 0.6;
  const tilt = new THREE.Group();
  tilt.position.set(0, 0.4, 3.2);
  tilt.rotation.x = -0.22;
  tilt.add(mesh(rbox(W, Hh, D, 0.7, 4), m.silver, { y: Hh / 2 }));
  const bezel = new THREE.MeshPhysicalMaterial({ color: 0x050507, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.06 });
  const bz = new THREE.Mesh(new THREE.ShapeGeometry(roundedRectShape(W - 0.36, Hh - 0.36, 0.9), 14), bezel);
  bz.position.set(0, Hh / 2, D / 2 + 0.006);
  tilt.add(bz);
  const scr = new THREE.Mesh(
    new THREE.PlaneGeometry(W - 1.8, Hh - 1.8),
    new THREE.MeshBasicMaterial({ map: screenTex, transparent: true, alphaTest: 0.5, toneMapped: false })
  );
  scr.position.set(0, Hh / 2, D / 2 + 0.014);
  tilt.add(scr);
  // front camera on the bezel, power button on top, volume rocker on the side, speaker grilles on the sides
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.2, 18), new THREE.MeshBasicMaterial({ color: 0x1b2540 }));
  lens.position.set(0, Hh - 0.62, D / 2 + 0.018);
  tilt.add(lens);
  tilt.add(mesh(rbox(2.6, 0.26, 0.5, 0.12, 2), m.silver, { x: 8.2, y: Hh + 0.03, cast: false }));
  tilt.add(mesh(rbox(0.26, 3.4, 0.5, 0.12, 2), m.silver, { x: W / 2 + 0.04, y: Hh - 4.2, cast: false }));
  for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) tilt.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 6), m.black, { x: sx * (W / 2 + 0.005), y: 1.6 + i * 0.35, rz: Math.PI / 2, cast: false }));
  g.add(tilt);
  // stand: a foot plate, a back strut and a rubber pad where it meets the iPad
  g.add(mesh(rbox(14, 0.6, 9, 0.28, 3), m.silver, { y: 0.3, z: 2.4 }));
  g.add(mesh(rbox(10, 11, 0.7, 0.3, 3), m.silver, { y: 6.2, z: -1.6, rx: 0.5 }));
  g.add(mesh(rbox(11, 0.5, 1.4, 0.2, 2), m.rubber, { y: 0.78, z: 5.4, cast: false }));
  return mergeByMaterial(g);
}

// AirPods Pro case: 6.06 × 5.3 × 2.15 cm — lid on a barrel hinge, front LED, seam
export function createAirPods(m) {
  const g = new THREE.Group();
  const white = new THREE.MeshPhysicalMaterial({ color: 0xf7f7f7, roughness: 0.25, metalness: 0, clearcoat: 0.7 });
  g.add(mesh(rbox(6.06, 1.3, 5.3, 0.9, 5), white, { y: 0.65 }));
  g.add(mesh(rbox(6.0, 0.88, 5.24, 0.85, 5), white, { y: 1.74 }));
  g.add(mesh(box(5.5, 0.04, 0.04), m.black, { y: 1.3, z: 2.6, cast: false }));
  g.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 12), m.led, { y: 1.1, z: 2.66, rx: Math.PI / 2, cast: false }));
  // hinge barrel along the back + pins
  g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 4.2, 14), m.silver, { y: 1.3, z: -2.6, rz: Math.PI / 2 }));
  for (const sx of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.18, 14), m.titanium, { x: sx * 2.15, y: 1.3, z: -2.6, rz: Math.PI / 2, cast: false }));
  g.add(mesh(box(4.4, 0.03, 0.05), m.black, { y: 1.3, z: -2.28, cast: false }));
  return mergeByMaterial(g);
}

// HomePod mini: 9.7 cm wide, 8.4 cm tall, knitted mesh fabric, glass touch surface with an LED ring on top.
export function createHomePod(m) {
  const g = new THREE.Group();
  const body = mesh(new THREE.SphereGeometry(4.85, 48, 32), m.fabricWhite, { y: 4.2 });
  body.scale.y = 0.87;
  g.add(body);
  g.add(mesh(new THREE.CylinderGeometry(3.0, 3.0, 0.25, 40), m.white, { y: 8.32 }));
  g.add(mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.05, 40), m.led, { y: 8.47, cast: false }));
  g.add(mesh(new THREE.CylinderGeometry(0.28, 0.28, 3.4, 8), m.cable, { x: 0, y: 0.9, z: -4.0, rx: Math.PI / 2 + 0.25, cast: false })); // power cable stub
  const merged = mergeByMaterial(g);
  // the LED ring stays its own object (T13 / T19 pulse it)
  const ring = mesh(new THREE.TorusGeometry(1.1, 0.07, 8, 40), m.led, { y: 8.52, rx: Math.PI / 2, cast: false });
  ring.name = 'homepodRing';
  merged.add(ring);
  merged.name = 'homepod';
  return merged;
}

// ── desk mat (felt), under the MacBook ──
export function createDeskMat(m) {
  const mat = m.felt.clone();
  mat.color.setHex(0x7f828a);
  const g = new THREE.Group();
  g.add(mesh(slabGeo(58, 30, 0.34, 5, 0.12), mat, { y: 0.17, cast: false }));
  return g;
}

// ── notebook with an elastic band, and a pen lying across it ──
export function createNotebook(m) {
  const g = new THREE.Group();
  g.add(mesh(rbox(14.8, 1.3, 21, 0.55, 3), m.leather, { y: 0.65 }));
  g.add(mesh(rbox(14.0, 1.0, 20.3, 0.2, 2), m.paper, { x: 0.3, y: 0.65, z: 0.1, cast: false }));
  g.add(mesh(rbox(0.7, 1.4, 21.1, 0.2, 2), m.black, { x: 4.6, y: 0.65 }));
  g.add(mesh(rbox(0.25, 1.34, 21.2, 0.1, 2), m.cable, { x: -7.4, y: 0.65, cast: false })); // spine highlight
  const pen = new THREE.Group();
  pen.add(mesh(new THREE.CylinderGeometry(0.42, 0.34, 13.4, 16), m.metal, { rz: Math.PI / 2 }));
  pen.add(mesh(new THREE.CylinderGeometry(0.5, 0.5, 3.6, 16), m.silver, { x: 4.9, rz: Math.PI / 2 }));
  pen.add(mesh(rbox(3.0, 0.2, 0.3, 0.08, 2), m.silver, { x: 5.2, y: 0.5, cast: false }));
  pen.add(mesh(new THREE.ConeGeometry(0.34, 1.2, 14), m.titanium, { x: -7.2, rz: Math.PI / 2 }));
  pen.position.set(0.8, 1.3 + 0.45, 1.5);
  pen.rotation.y = 0.55;
  g.add(pen);
  return mergeByMaterial(g);
}

// ── two large books stacked (colour on the spines) ──
export function createBooksStack(m) {
  const g = new THREE.Group();
  const mats = [0x35495e, 0xd4b896, 0x8c4a3d].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }));
  [[24, 2.8, 31, mats[0], 0, 0.1], [21, 2.3, 28, mats[1], 0.4, -0.08], [18, 1.8, 24, mats[2], -0.3, 0.12]].reduce((y, [w, h, d, mat, x, ry]) => {
    const b = new THREE.Group();
    b.position.set(x, y, 0);
    b.rotation.y = ry;
    b.add(mesh(rbox(w, h, d, 0.4, 2), mat, { y: h / 2 }));
    b.add(mesh(rbox(w - 0.6, h - 0.8, d - 0.5, 0.2, 2), m.paper, { x: 0.4, y: h / 2, cast: false }));
    g.add(b);
    return y + h;
  }, 0);
  return mergeByMaterial(g);
}

// ── small succulent rosette in a white pot ──
export function createSucculent(m) {
  const g = new THREE.Group();
  g.add(mesh(lathe([[0, 0], [2.7, 0], [3.5, 0.5], [3.9, 4.4], [3.6, 4.9], [3.1, 4.9], [3.3, 4.4], [0, 4.1]], 36), m.ceramic));
  g.add(mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.4, 28), m.soil, { y: 4.1, cast: false }));
  const leafGeo = new THREE.SphereGeometry(1, 12, 8);
  const rings = [[10, 2.0, 1.5, 0.55, 4.3], [8, 1.7, 1.3, 0.85, 5.0], [6, 1.4, 1.1, 1.15, 5.7], [4, 1.1, 0.9, 1.45, 6.2]];
  rings.forEach(([n, len, wid, tilt, y], ri) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ri * 0.5;
      const holder = new THREE.Group();
      holder.position.set(Math.cos(a) * (0.5 + 0.35 * ri), y, Math.sin(a) * (0.5 + 0.35 * ri));
      holder.rotation.y = -a;
      const leaf = mesh(leafGeo, m.succulent, { x: len * 0.55, rz: -tilt });
      leaf.scale.set(len, wid * 0.32, wid * 0.62);
      holder.add(leaf);
      g.add(holder);
    }
  });
  g.add(mesh(new THREE.SphereGeometry(0.7, 10, 8), m.succulent, { y: 6.5 }));
  return mergeByMaterial(g);
}

// ── over-ear headphones hanging on an aluminium stand ──
export function createHeadphones(m) {
  const g = new THREE.Group();
  g.add(mesh(lathe([[0, 0], [6.8, 0], [7.2, 0.35], [7.0, 0.9], [0, 1.0]], 40), m.silver));
  g.add(mesh(new THREE.CylinderGeometry(0.55, 0.65, 22, 16), m.silver, { y: 12 }));
  g.add(mesh(new THREE.TorusGeometry(2.6, 0.5, 10, 24, Math.PI), m.silver, { y: 23.1, rz: 0, rx: 0 })); // cradle
  // the headphones: a band over the cradle, two oval cups with cushions
  const hp = new THREE.Group();
  hp.position.y = 18.6;
  hp.add(mesh(new THREE.TorusGeometry(8.4, 0.5, 10, 40, Math.PI * 1.02), m.metal, { y: 4.6, rz: -0.02 }));
  for (const s of [-1, 1]) {
    const cup = new THREE.Group();
    cup.position.set(s * 8.6, 3.2, 0);
    cup.add(mesh(new THREE.CylinderGeometry(3.6, 3.6, 1.7, 28), m.silver, { rz: Math.PI / 2 }));
    cup.add(mesh(new THREE.CylinderGeometry(3.4, 3.5, 1.4, 28), m.rubber, { x: -s * 1.5, rz: Math.PI / 2 }));
    cup.scale.set(1, 1, 0.78);
    hp.add(cup);
  }
  g.add(hp);
  return mergeByMaterial(g);
}

// ── small standing photo frame ──
export function createPhotoFrame(m, photoTex) {
  const g = new THREE.Group();
  const tilt = new THREE.Group();
  tilt.rotation.x = -0.16;
  tilt.position.set(0, 0.2, 0);
  tilt.add(mesh(rbox(14.4, 11, 1.1, 0.5, 3), m.white, { y: 5.5 }));
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(11.4, 8.2), new THREE.MeshStandardMaterial({ map: photoTex, roughness: 0.95, metalness: 0, envMapIntensity: 0.15, emissive: 0xffffff, emissiveMap: photoTex, emissiveIntensity: 0.12 }));
  photo.position.set(0, 5.5, 0.57);
  tilt.add(photo);
  g.add(tilt);
  g.add(mesh(rbox(3, 8.4, 0.5, 0.2, 2), m.white, { y: 4.0, z: -2.0, rx: 0.45 }));
  return mergeByMaterial(g);
}

/** A white USB-C cable following `points` (world positions), with a metal plug at the first point. */
export function createCable(m, points) {
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.4);
  g.add(mesh(new THREE.TubeGeometry(curve, 60, 0.2, 8), m.cable, { cast: false }));
  return g;
}
