// "Ori, Can You...?" — the beach: striped parasols with scalloped edges, sun loungers with towels, sunbathers, a lifeguard tower with a flying flag, beach balls, buckets and a
// sandcastle, a wet-sand band where the sea reaches. The little things are instanced (a few draw calls for the whole shore).
import * as THREE from 'three';
import { mulberry32 } from '../rng.js';
import { GeoBuilder } from './gfx.js';
import { BOUNDS } from './map.js';

const M = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const V = new THREE.Vector3();
const S = new THREE.Vector3();
const E = new THREE.Euler();
function put(B, geo, x, y, z, color, { rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  M.compose(V.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), S.set(sx, sy, sz));
  B.geometry(geo, M, color);
}
const UMBRELLA_TINTS = [0xe5625e, 0xf2c14e, 0x2f9fd0, 0x43b581, 0xe28ab8, 0xff8a3d];
const TOWELS = [0x2f9fd0, 0xe5625e, 0xf2c14e, 0x8e6cd6, 0x43b581, 0xff8a3d, 0xffffff];

/** A flat triangle with its normal worked out from the corners (pointing up / outwards). */
function tri(B, a, b, c) {
  const ux = b[0] - a[0]; const uy = b[1] - a[1]; const uz = b[2] - a[2];
  const vx = c[0] - a[0]; const vy = c[1] - a[1]; const vz = c[2] - a[2];
  let nx = uy * vz - uz * vy; let ny = uz * vx - ux * vz; let nz = ux * vy - uy * vx;
  const l = Math.hypot(nx, ny, nz) || 1;
  nx /= l; ny /= l; nz /= l;
  if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
  B.quad(a, b, c, c, nx, ny, nz);
}

/** Parasol canopy as two meshes: the tinted wedges (instance colour) and the white ones, plus pole + finial. */
function umbrellaParts() {
  const tint = new GeoBuilder().setColor('#ffffff');
  const white = new GeoBuilder().setColor('#fbf8f0');
  const pole = new GeoBuilder().setColor('#d9d6cf');
  const n = 8;
  const top = [0, 2.66, 0];
  const R = 1.55; const yRim = 2.08; const drop = 0.16;
  const ring = (r, y, a) => [Math.cos(a) * r, y, Math.sin(a) * r];
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2; const a1 = ((i + 1) / n) * Math.PI * 2; const am = (a0 + a1) / 2;
    const B = i % 2 ? white : tint;
    const m0 = ring(R * 0.55, 2.46, a0); const m1 = ring(R * 0.55, 2.46, a1);
    const r0 = ring(R, yRim, a0); const r1 = ring(R, yRim, a1);
    tri(B, top, m0, m1);
    tri(B, m0, r0, r1); tri(B, m0, r1, m1);
    // a scalloped flap hanging off the rim of the wedge
    tri(B, r0, r1, ring(R * 1.01, yRim - drop, am));
  }
  const cyl = new THREE.CylinderGeometry(0.028, 0.034, 2.6, 8);
  put(pole, cyl, 0, 1.3, 0, '#d9d6cf');
  cyl.dispose();
  const ball = new THREE.SphereGeometry(0.06, 8, 6);
  put(pole, ball, 0, 2.7, 0, '#f2e3b0');
  ball.dispose();
  return { tint: tint.build(), white: white.build(), pole: pole.build() };
}

/** A sun lounger: aluminium frame + a padded mattress (the towel takes the instance colour). */
function loungerParts() {
  const frame = new GeoBuilder().setColor('#cfd3d8');
  const pad = new GeoBuilder().setColor('#ffffff');
  const tilt = 0.5;
  for (const x of [-0.32, 0.32]) {
    frame.box(x - 0.025, 0.0, -0.75, x + 0.025, 0.28, -0.7);
    frame.box(x - 0.025, 0.0, 0.7, x + 0.025, 0.2, 0.75);
    frame.box(x - 0.02, 0.25, -0.7, x + 0.02, 0.3, 0.55);
  }
  pad.box(-0.34, 0.3, -0.55, 0.34, 0.37, 0.22);
  // the back rest, tilted
  const back = new THREE.BoxGeometry(0.68, 0.07, 0.55);
  M.compose(V.set(0, 0.55, 0.52), Q.setFromEuler(E.set(-tilt, 0, 0)), S.set(1, 1, 1));
  pad.geometry(back, M, '#ffffff');
  back.dispose();
  return { frame: frame.build(), pad: pad.build() };
}

/** A person lying on a towel: tan skin, a swimsuit, a hat. The towel is its own instance-tinted mesh. */
function sunbatherParts(skin) {
  const B = new GeoBuilder();
  const sph = new THREE.SphereGeometry(1, 10, 8);
  const cap = new THREE.CapsuleGeometry(1, 1, 4, 8);
  put(B, sph, 0, 0.14, 0.75, skin, { sx: 0.11, sy: 0.11, sz: 0.12 }); // head
  put(B, cap, 0, 0.12, 0.25, skin, { rx: Math.PI / 2, sx: 0.15, sy: 0.3, sz: 0.1 }); // torso
  put(B, cap, 0, 0.1, -0.35, skin, { rx: Math.PI / 2, sx: 0.12, sy: 0.35, sz: 0.1 }); // legs
  put(B, cap, 0.28, 0.1, 0.25, skin, { rx: Math.PI / 2, sx: 0.045, sy: 0.3, sz: 0.045, rz: 0.1 });
  put(B, cap, -0.28, 0.1, 0.25, skin, { rx: Math.PI / 2, sx: 0.045, sy: 0.3, sz: 0.045, rz: -0.1 });
  put(B, cap, 0, 0.14, 0.02, '#e5625e', { rx: Math.PI / 2, sx: 0.155, sy: 0.07, sz: 0.11 }); // swimsuit
  put(B, sph, 0, 0.2, 0.78, '#f4e7c4', { sx: 0.19, sy: 0.03, sz: 0.19 }); // a straw hat
  sph.dispose(); cap.dispose();
  const towel = new GeoBuilder().setColor('#ffffff');
  towel.box(-0.4, 0.0, -0.95, 0.4, 0.03, 0.95);
  return { person: B.build(), towel: towel.build() };
}

function lifeguardTower() {
  const B = new GeoBuilder();
  B.setColor('#c79a62');
  for (const x of [-1.0, 1.0]) for (const z of [-0.9, 0.9]) B.box(x - 0.07, 0, z - 0.07, x + 0.07, 2.2, z + 0.07);
  B.setColor('#e8e2d4').box(-1.2, 2.2, -1.1, 1.2, 2.3, 1.1);
  B.setColor('#f6f1e6').box(-1.1, 2.3, -1.0, 1.1, 3.35, 1.0);
  B.setColor('#e5625e').box(-1.25, 3.35, -1.2, 1.25, 3.55, 1.2);
  B.setColor('#a8d4e6').box(-0.9, 2.65, 0.98, 0.9, 3.05, 1.02);
  B.setColor('#c79a62');
  for (let i = 0; i < 7; i++) B.box(-0.5, 0.25 + i * 0.28, -1.5 + i * 0.04, 0.5, 0.32 + i * 0.28, -1.0 - i * 0.0);
  B.setColor('#e5625e').box(-0.04, 3.55, 0.0, 0.04, 4.6, 0.08); // the flag pole
  B.setColor('#ffffff').box(-0.9, 2.25, 1.0, 0.9, 2.55, 1.1);
  return B.build();
}

export function buildBeach(map, { lib, shadows = true, tier = 'high' } = {}) {
  const rnd = mulberry32(map.seed * 13 + 5);
  const group = new THREE.Group();
  group.name = 'beach';
  const disposables = [];
  const mats = [];
  const vc = (rough = 0.7, extra = {}) => { const m = lib.plain({ roughness: rough, ...extra }); mats.push(m); return m; };
  const place = new THREE.Matrix4();
  const mk = (geo, mat, list, name, { tint = null, cast = shadows } = {}) => {
    if (!list.length) return null;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    const c = new THREE.Color();
    list.forEach((it, i) => {
      place.compose(V.set(it.x, it.y || 0, it.z), Q.setFromEuler(E.set(it.rx || 0, it.ry || 0, it.rz || 0)), S.set(it.s || 1, it.s || 1, it.s || 1));
      im.setMatrixAt(i, place);
      if (tint) im.setColorAt(i, c.set(it.c));
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = cast; im.receiveShadow = true; im.name = name;
    im.computeBoundingSphere();
    group.add(im);
    disposables.push(geo);
    return im;
  };

  // parasols (the map's umbrella spots), each with loungers or a sunbather beside it
  const spots = map.props.filter((p) => p.type === 'umbrella');
  const umb = spots.map((p, i) => ({ x: p.x, z: p.z, ry: p.rot, rx: (rnd() - 0.5) * 0.18, rz: (rnd() - 0.5) * 0.18, s: 1, c: UMBRELLA_TINTS[(p.v + i) % UMBRELLA_TINTS.length] }));
  const up = umbrellaParts();
  mk(up.tint, vc(0.8, { extra: { side: THREE.DoubleSide } }), umb, 'parasol-tint', { tint: true });
  mk(up.white, vc(0.8, { extra: { side: THREE.DoubleSide } }), umb, 'parasol-white');
  mk(up.pole, vc(0.5, { metalness: 0.4 }), umb, 'parasol-pole');
  const loungers = []; const towels = []; const bathers = [[], []];
  spots.forEach((p, i) => {
    const a = p.rot + 0.4;
    const around = (r, ang) => [p.x + Math.cos(ang) * r, p.z + Math.sin(ang) * r];
    if (rnd() < 0.6) {
      for (let k = 0; k < 2; k++) { const [x, z] = around(1.5 + k * 0.1, a + k * 0.9 - 0.4); loungers.push({ x, z, y: 0.02, ry: a + 1.57 + (k - 0.5) * 0.2, c: TOWELS[(i + k) % TOWELS.length] }); }
    } else {
      const [x, z] = around(1.1, a);
      towels.push({ x, z, y: 0.012, ry: a + rnd() * 0.4, c: TOWELS[(i * 3) % TOWELS.length] });
      bathers[i % 2].push({ x, z, y: 0.03, ry: towels[towels.length - 1].ry });
    }
  });
  const lg = loungerParts();
  mk(lg.frame, vc(0.5, { metalness: 0.5 }), loungers, 'lounger-frames');
  mk(lg.pad, vc(0.85), loungers, 'lounger-pads', { tint: true });
  const skins = ['#d9a077', '#b97c58'];
  skins.forEach((skin, k) => {
    const sp = sunbatherParts(skin);
    mk(sp.person, vc(0.7), bathers[k], `sunbather${k}`);
    if (k === 0) mk(sp.towel, vc(0.9), towels, 'towels', { tint: true });
    else sp.towel.dispose();
  });

  // little things on the sand: beach balls, buckets, flip-flops, a sandcastle
  {
    const B = new GeoBuilder();
    const ball = new THREE.SphereGeometry(0.2, 14, 10);
    const cols = ['#e5625e', '#fbf8f0', '#2f9fd0', '#f2c14e', '#43b581', '#fbf8f0'];
    // wedge colours by longitude: rebuild the geometry colours
    const pos = ball.attributes.position;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { const a = Math.atan2(pos.getZ(i), pos.getX(i)); const c = new THREE.Color(cols[Math.floor(((a + Math.PI) / (Math.PI * 2)) * 6) % 6]); col.set([c.r, c.g, c.b], i * 3); }
    ball.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const balls = [];
    for (let i = 0; i < 4; i++) { const sp = spots[(i * 3) % Math.max(1, spots.length)]; if (sp) balls.push({ x: sp.x + 2 + rnd() * 2, z: sp.z + (rnd() - 0.5) * 6, y: 0.2, s: 1 }); }
    mk(ball, vc(0.4), balls, 'beach-balls');
    B.setColor('#e5625e');
    const bucket = new THREE.CylinderGeometry(0.1, 0.075, 0.13, 10);
    put(B, bucket, 0, 0.065, 0, '#2f9fd0');
    put(B, bucket, 0.3, 0.065, 0.1, '#f2c14e', { rz: 1.4 });
    bucket.dispose();
    // a sandcastle: three towers and a wall
    const cone = new THREE.ConeGeometry(0.1, 0.16, 8);
    const tower = new THREE.CylinderGeometry(0.1, 0.12, 0.28, 10);
    for (const [x, z] of [[-0.35, 0], [0.35, 0], [0, 0.4]]) { put(B, tower, 1.4 + x, 0.14, z, '#dcc690'); put(B, cone, 1.4 + x, 0.36, z, '#dcc690'); }
    put(B, new THREE.BoxGeometry(0.8, 0.15, 0.1), 1.4, 0.075, 0.05, '#d4bd86');
    tower.dispose(); cone.dispose();
    const camp = spots.length ? spots[Math.floor(spots.length / 2)] : { x: -134, z: 0 };
    const geo = B.build();
    mk(geo, vc(0.9), [{ x: camp.x + 3, z: camp.z - 3, ry: 0.4 }], 'sandcastle');
  }
  // the lifeguard tower
  const tower = new THREE.Mesh(lifeguardTower(), vc(0.7));
  tower.position.set(-132, 0, -32);
  tower.rotation.y = Math.PI / 2;
  tower.castShadow = shadows;
  tower.receiveShadow = true;
  group.add(tower);
  disposables.push(tower.geometry);
  // its flag (waves in the wind)
  {
    const B = new GeoBuilder().setColor('#e5625e');
    const m = lib.plain({ roughness: 0.8, wind: { amp: 0.35, speed: 3.1 }, extra: { side: THREE.DoubleSide } });
    mats.push(m);
    const w = 1.1; const h = 0.6; const x0 = 0.04; const y0 = 4.0;
    const seg = 6;
    for (let i = 0; i < seg; i++) {
      const a = x0 + (w * i) / seg; const b = x0 + (w * (i + 1)) / seg;
      B.attr2 = i / seg;
      const i0 = B.count;
      B.vert(0, y0, a, 1, 0, 0, 0, 0); B.attr2 = (i + 1) / seg; B.vert(0, y0, b, 1, 0, 0, 0, 0); B.vert(0, y0 + h, b, 1, 0, 0, 0, 0); B.attr2 = i / seg; B.vert(0, y0 + h, a, 1, 0, 0, 0, 0);
      B.i.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
    }
    const flag = new THREE.Mesh(B.build({ extraName2: 'aSway' }), m);
    flag.position.copy(tower.position);
    flag.rotation.y = tower.rotation.y;
    group.add(flag);
    disposables.push(flag.geometry);
  }
  // the band of wet sand where the sea reaches (darker, a little shiny), fading out up the beach
  {
    const x0 = BOUNDS.x0 - 8;
    const B = new GeoBuilder();
    const z0 = BOUNDS.z0; const z1 = BOUNDS.z1;
    const steps = 5;
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps; const t1 = (i + 1) / steps;
      B.setColor(new THREE.Color().setRGB(0.5 + 0.42 * t0 * t0, 0.42 + 0.44 * t0 * t0, 0.32 + 0.36 * t0 * t0));
      B.floor(x0 + t0 * 7, z0, x0 + t1 * 7, z1, 0.004);
    }
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    mats.push(mat);
    const wet = new THREE.Mesh(B.build(), mat);
    wet.name = 'wet-sand';
    wet.receiveShadow = true;
    group.add(wet);
    disposables.push(wet.geometry);
  }
  void tier;
  return {
    group,
    dispose() { disposables.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); group.traverse((o) => { if (o.isInstancedMesh) o.dispose(); }); },
  };
}
