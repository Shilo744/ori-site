// A sleeping ginger cat curled up on the bench (T13). Built from displaced ellipsoids + tubes with painted vertex
// colours (one fur material, 5 draw calls): the body breathes, the ears twitch now and then, the tail tip flicks,
// and `pet()` lifts the head and purrs (T14 wires the click).
import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const col = (hex) => new THREE.Color(hex);
const PAL = {
  ginger: col('#dfa468'), stripe: col('#b3743f'), cream: col('#f5e8cf'), pink: col('#e9a8a0'), ink: col('#2b201b'), tipCol: col('#9a6234'),
};
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const _c = new THREE.Color();

/** Paint `geo` with `fn(position, normal, outColor)` into a `color` attribute; returns a creased, non-indexed copy. */
function paint(geo, fn) {
  const g = toCreasedNormals(geo, 1.1);
  const p = g.attributes.position, n = g.attributes.normal;
  const arr = new Float32Array(p.count * 3);
  const P = new THREE.Vector3(), N = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    P.fromBufferAttribute(p, i);
    N.fromBufferAttribute(n, i);
    fn(P, N, _c);
    arr[i * 3] = _c.r; arr[i * 3 + 1] = _c.g; arr[i * 3 + 2] = _c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(p.count * 2), 2));
  return g;
}
const flat = (c) => (P, N, out) => out.copy(c);
const fur = (P, N, out, stripes = 1) => {
  // tabby: darker bands across the back, cream belly, a touch of per-patch brightness variation
  const band = 0.5 + 0.5 * Math.sin(P.x * 0.95 + 1.5 * Math.sin(P.z * 0.33) + 0.6 * Math.sin(P.y * 0.8));
  const w = sstep(0.55, 0.8, band) * sstep(0.0, 0.5, N.y) * 0.85 * stripes;
  out.copy(PAL.ginger).lerp(PAL.stripe, w);
  out.lerp(PAL.cream, sstep(0.05, -0.55, N.y));
  const patch = 1 + 0.05 * Math.sin(P.x * 0.7 + P.z * 1.3) * Math.sin(P.y * 0.9 + 1.7);
  out.multiplyScalar(patch);
};

function ellipsoid(rx, ry, rz, x = 0, y = 0, z = 0, w = 40, h = 28) {
  const g = new THREE.SphereGeometry(1, w, h);
  g.scale(rx, ry, rz);
  g.translate(x, y, z);
  return g;
}

function bodyGeometry() {
  const g = new THREE.SphereGeometry(1, 56, 36);
  const p = g.attributes.position, v = new THREE.Vector3();
  const bumps = [ // [cx, cy, cz, radius, height]: shoulder, haunch, rump
    [-8, 6.5, 3, 7, 1.4], [8.5, 6, 2, 8.5, 2.0], [14, 5.5, 8, 5.5, 1.0],
  ];
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    let x = v.x * 18, y = v.y * 8.8, z = v.z * 12.5;
    if (y < -2.3) y = -2.3 + (y + 2.3) * 0.2; // flat underside: the cat sits, it does not roll
    z += 5.8 * (x / 18) * (x / 18); // banana curl: both ends bend towards +z
    y += 8.4;
    for (const [cx, cy, cz, r, hgt] of bumps) {
      const d2 = (x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2;
      y += hgt * Math.exp(-d2 / (r * r)) * Math.max(0, v.y);
    }
    p.setXYZ(i, x, y, z);
  }
  // front paws tucked under the chin
  const paws = [ellipsoid(3.4, 1.9, 2.1, -15.5, 2.0, 14.0, 20, 14), ellipsoid(3.2, 1.8, 2.0, -10.8, 1.9, 15.6, 20, 14)];
  const body = paint(g, (P, N, out) => {
    fur(P, N, out);
    // soft cream chest at the head end
    out.lerp(PAL.cream, sstep(-9, -17, P.x) * sstep(0.3, 1, N.z + 0.4) * 0.8);
  });
  const pawG = paws.map((pg) => paint(pg, flat(PAL.cream)));
  return mergeGeometries([body, ...pawG]);
}

function tailCurve() {
  const pts = [[16.8, 3.0, 4.0], [15.4, 2.3, 10.4], [9.2, 2.1, 15.4], [1.0, 2.1, 17.4], [-6.0, 2.1, 17.0], [-9.6, 2.6, 18.4]];
  return new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
}

/** A tube along `curve` between param a..b with a taper; coloured with soft rings and a darker tip. */
function tubePart(curve, a, b, segs) {
  const n = Math.max(6, segs);
  const pts = Array.from({ length: n }, (_, i) => curve.getPointAt(a + ((b - a) * i) / (n - 1)));
  const sub = new THREE.CatmullRomCurve3(pts);
  const radial = 10;
  const geo = new THREE.TubeGeometry(sub, n * 2, 1, radial, false);
  const pos = geo.attributes.position;
  const ctr = new THREE.Vector3(), v = new THREE.Vector3();
  const radius = (u) => 2.15 - 0.95 * u - 0.5 * sstep(0.9, 1, u);
  for (let i = 0; i <= n * 2; i++) {
    const u = a + ((b - a) * i) / (n * 2);
    sub.getPointAt(i / (n * 2), ctr);
    const r = radius(u);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, k).sub(ctr).multiplyScalar(r).add(ctr);
      pos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  const end = curve.getPointAt(b);
  const cap = new THREE.SphereGeometry(radius(b) * 0.98, 12, 8).translate(end.x, end.y, end.z);
  const paintTail = (P, N, out) => {
    fur(P, N, out, 0.4);
    const u = a + (b - a) * 0.5; // coarse: darker rings along the tail
    out.lerp(PAL.stripe, 0.6 * sstep(0.55, 0.8, 0.5 + 0.5 * Math.sin(P.x * 1.9 + P.z * 1.1)));
    out.lerp(PAL.tipCol, sstep(0.86, 1, u) * 0.0);
  };
  const part = mergeGeometries([paint(geo, paintTail), paint(cap, paintTail)]);
  return { geo: part, from: curve.getPointAt(a) };
}

function headGeometry() {
  const skin = (P, N, out) => {
    fur(P, N, out, 0.35);
    out.lerp(PAL.cream, sstep(0.2, -0.7, N.y) * 0.5);
  };
  const parts = [
    paint(ellipsoid(5.8, 5.2, 5.6, 0, 0, 0, 40, 28), skin),
    paint(ellipsoid(3.6, 3.0, 3.1, 1.0, -1.7, 3.5, 20, 14), skin),
    paint(ellipsoid(3.6, 3.0, 3.1, 1.0, -1.7, -3.5, 20, 14), skin),
    paint(ellipsoid(2.9, 2.0, 2.5, 4.5, -1.4, 0, 22, 14), flat(PAL.cream)), // muzzle
    paint(ellipsoid(0.85, 0.6, 1.0, 7.1, -0.5, 0, 12, 8), flat(PAL.pink)), // nose
  ];
  // closed eyes: two thin dark arcs (contented smile lines)
  for (const s of [1, -1]) {
    const c = new THREE.CatmullRomCurve3([
      new THREE.Vector3(4.55, 1.55, s * 1.9), new THREE.Vector3(4.78, 1.15, s * 2.7), new THREE.Vector3(4.55, 1.5, s * 3.5),
    ]);
    parts.push(paint(new THREE.TubeGeometry(c, 8, 0.17, 5, false), flat(PAL.ink)));
  }
  return mergeGeometries(parts);
}

function earGeometry() {
  const outer = new THREE.ConeGeometry(2.4, 4.7, 6, 1).translate(0, 2.35, 0);
  outer.scale(1, 1, 0.5);
  const inner = new THREE.ConeGeometry(1.5, 3.4, 6, 1).translate(0, 1.7, 0);
  inner.scale(1, 1, 0.3);
  inner.translate(0.35, 0.2, 0);
  return mergeGeometries([paint(outer, (P, N, out) => out.copy(PAL.ginger).lerp(PAL.stripe, 0.25 * sstep(2, 4.6, P.y))), paint(inner, flat(PAL.pink))]);
}

export function createCat() {
  const furMat = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.92, sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color(0xffe9c8),
  });
  const root = new THREE.Group();
  root.name = 'cat';

  const body = new THREE.Mesh(bodyGeometry(), furMat);
  body.castShadow = body.receiveShadow = true;
  const curve = tailCurve();
  const tailBase = tubePart(curve, 0, 0.8, 20);
  const tailTip = tubePart(curve, 0.8, 1, 8);
  body.geometry = mergeGeometries([body.geometry, tailBase.geo]);
  root.add(body);

  // tail tip: its own mesh pivoting at the joint
  const tip = new THREE.Mesh(tailTip.geo.translate(-tailTip.from.x, -tailTip.from.y, -tailTip.from.z), furMat);
  tip.position.copy(tailTip.from);
  tip.receiveShadow = true;
  root.add(tip);

  // head (muzzle points along +x; resting on the paws, nose tucked towards the tail)
  const head = new THREE.Group();
  const headBase = new THREE.Vector3(-13, 7.4, 9.2);
  head.position.copy(headBase);
  const headMesh = new THREE.Mesh(headGeometry(), furMat);
  headMesh.castShadow = headMesh.receiveShadow = true;
  head.add(headMesh);
  const earGeo = earGeometry();
  const ears = [1, -1].map((s) => {
    const e = new THREE.Mesh(earGeo, furMat);
    e.position.set(0.3, 4.1, s * 3.5);
    e.rotation.set(s * 0.38, 0, 0.1);
    e.userData.base = e.rotation.clone();
    head.add(e);
    return e;
  });
  const headYaw = -0.62, headPitch = -0.3;
  head.rotation.set(0, headYaw, headPitch);
  root.add(head);

  // ── animation state ──
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  let nextEar = 2.5 + rnd() * 3, nextTail = 4 + rnd() * 4;
  let ear = null, tail = null, awake = 0, purr = 0;

  return {
    group: root,
    /** Cat wakes up for a moment: head lifts, ears perk, tail swishes, a purr tremor (T14 calls this on click). */
    pet() { awake = 1; purr = 1; tail = { k: 0, dur: 1.8 }; },
    /** The cat hears you: one ear flick (hover). */
    notice() { if (!ear) ear = { k: 0, side: rnd() < 0.5 ? 0 : 1, dur: 0.5 }; },
    update(dt, t) {
      const b = Math.sin(t * 2.3 + 0.4);
      const inh = 0.5 + 0.5 * b; // 0..1 inhale
      const wake = awake;
      awake = Math.max(0, awake - dt / 3.2);
      purr = Math.max(0, purr - dt / 4.5);
      const buzz = purr > 0 ? Math.sin(t * 52) * 0.05 * Math.min(1, purr * 2) : 0;
      body.scale.set(1 + 0.012 * inh, 1 + 0.045 * inh + (wake > 0 ? 0.01 : 0), 1 + 0.016 * inh);
      body.position.y = buzz;
      // head follows the chest and lifts when petted
      const lift = Math.sin(Math.min(1, wake * 1.0) * Math.PI * 0.5) * Math.min(1, (wake) * 3);
      head.position.set(headBase.x, headBase.y + 0.28 * inh + lift * 2.0 + buzz, headBase.z + lift * 0.6);
      head.rotation.set(0, headYaw + Math.sin(t * 0.31) * 0.015, headPitch + lift * 0.42);
      // ear twitch (random, either ear) — perked up while petted
      nextEar -= dt;
      if (nextEar <= 0 && !ear) { ear = { k: 0, side: rnd() < 0.5 ? 0 : 1, dur: 0.5 }; nextEar = 3 + rnd() * 6; }
      ears.forEach((e, i) => {
        let tw = 0;
        if (ear && ear.side === i) tw = Math.sin(ear.k * Math.PI * 3) * (1 - ear.k) * 0.5;
        e.rotation.set(e.userData.base.x, e.userData.base.y, e.userData.base.z + tw - lift * 0.18);
      });
      if (ear) { ear.k += dt / ear.dur; if (ear.k >= 1) ear = null; }
      // tail tip flick
      nextTail -= dt;
      if (nextTail <= 0 && !tail) { tail = { k: 0, dur: 1.5 }; nextTail = 5 + rnd() * 8; }
      if (tail) {
        const e = Math.sin(tail.k * Math.PI);
        tip.rotation.set(0, Math.sin(tail.k * Math.PI * 4) * (1 - tail.k) * 0.55, e * 0.35);
        tail.k += dt / tail.dur;
        if (tail.k >= 1) { tail = null; tip.rotation.set(0, 0, 0); }
      }
    },
  };
}
