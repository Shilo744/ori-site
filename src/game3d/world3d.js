// NEON DRIFT — the static world as three.js meshes (T41 greybox: ribbon road with banking, walls with neon strips,
// roadside reflectors, a synthwave grid floor, a gradient sky dome, the start gantry). T42 replaces the materials and adds the
// environment; the geometry builders here stay. Everything is generated from the pure track tables.
import * as THREE from 'three';
import { frameAt, surfaceNormal, WALL_MARGIN } from './track.js';

const STEP = 2; // one road section every STEP samples (4 m)

const col = (hex) => new THREE.Color(hex);
const C = {
  runoff: col(0x3b2f4d),
  kerbA: col(0xd8264b),
  kerbB: col(0xf2eef8),
  line: col(0xf2eef8),
  asphalt: col(0x4a4858),
  asphaltB: col(0x514f61),
  start: col(0xffffff),
  wall: col(0x5b5772),
  wallB: col(0x6c6888),
  neonL: col(0x19e3ff),
  neonR: col(0xff3ea5),
};

/** Offsets across the road (m) relative to the half width: [lateral from edge, key]. */
function columns(hw) {
  const wm = WALL_MARGIN;
  return [-(hw + wm), -(hw + 2.4), -hw, -hw + 0.45, -0.14, 0.14, hw - 0.45, hw, hw + 2.4, hw + wm];
}

/**
 * Road ribbon with a colour per quad: run-off, kerb, edge line, asphalt, dashed centre line, asphalt, edge line, kerb, run-off.
 * @returns {THREE.Mesh}
 */
export function buildRoad(track) {
  const sections = Math.ceil(track.n / STEP);
  const quads = 9;
  const vCount = (sections + 1) * quads * 4;
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const colr = new Float32Array(vCount * 3);
  const idx = new Uint32Array((sections + 1) * quads * 6);
  const fr = {};
  const nm = {};
  const prev = new Array(10).fill(null).map(() => new THREE.Vector3());
  const cur = new Array(10).fill(null).map(() => new THREE.Vector3());
  let v = 0;
  let ii = 0;
  const tmpC = new THREE.Color();
  for (let k = 0; k <= sections; k++) {
    frameAt(track, ((k / sections) * track.length) % track.length, fr);
    surfaceNormal(fr, nm);
    const hw = fr.width / 2;
    const cs = columns(hw);
    const cb = Math.cos(fr.bank);
    const sb = Math.sin(fr.bank);
    for (let c = 0; c < 10; c++) {
      cur[c].set(fr.x + fr.rx * cs[c] * cb, fr.y - sb * cs[c] + 0.0, fr.z + fr.rz * cs[c] * cb);
    }
    if (k > 0) {
      const shade = Math.floor(k / 5) % 2;
      const dash = k % 6 < 3;
      const startLine = k === 1;
      for (let q = 0; q < quads; q++) {
        const base = v;
        const a = prev[q];
        const b = prev[q + 1];
        const c2 = cur[q + 1];
        const d = cur[q];
        const lift = q === 1 || q === 7 ? 0.015 : q === 2 || q === 6 || q === 4 ? 0.02 : 0;
        for (const p of [a, b, c2, d]) {
          pos[v * 3] = p.x; pos[v * 3 + 1] = p.y + lift; pos[v * 3 + 2] = p.z;
          nor[v * 3] = nm.nx; nor[v * 3 + 1] = nm.ny; nor[v * 3 + 2] = nm.nz;
          v++;
        }
        if (q === 0 || q === 8) tmpC.copy(C.runoff);
        else if (q === 1 || q === 7) tmpC.copy(k % 2 ? C.kerbA : C.kerbB);
        else if (q === 2 || q === 6) tmpC.copy(C.line);
        else if (q === 4) tmpC.copy(dash ? C.line : shade ? C.asphaltB : C.asphalt);
        else tmpC.copy(shade ? C.asphaltB : C.asphalt);
        if (startLine && q >= 2 && q <= 6) tmpC.copy(((q + k) & 1) ? C.start : C.asphalt);
        for (let m = 0; m < 4; m++) { colr[(base + m) * 3] = tmpC.r; colr[(base + m) * 3 + 1] = tmpC.g; colr[(base + m) * 3 + 2] = tmpC.b; }
        idx[ii++] = base; idx[ii++] = base + 1; idx[ii++] = base + 2;
        idx[ii++] = base; idx[ii++] = base + 2; idx[ii++] = base + 3;
      }
    }
    for (let c = 0; c < 10; c++) prev[c].copy(cur[c]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, v * 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor.subarray(0, v * 3), 3));
  g.setAttribute('color', new THREE.BufferAttribute(colr.subarray(0, v * 3), 3));
  g.setIndex(new THREE.BufferAttribute(idx.subarray(0, ii), 1));
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
  m.name = 'road';
  m.frustumCulled = false;
  return m;
}

/** Walls along both sides (inner face + top) and a thin glowing strip on the inner face. Returns { walls, neon }. */
export function buildWalls(track) {
  const sections = Math.ceil(track.n / STEP);
  const H = 1.2;
  const wallPos = [];
  const wallNor = [];
  const wallCol = [];
  const wallIdx = [];
  const neonPos = [];
  const neonCol = [];
  const neonIdx = [];
  const fr = {};
  const prevB = [null, null];
  const tmp = new THREE.Color();
  for (let k = 0; k <= sections; k++) {
    frameAt(track, ((k / sections) * track.length) % track.length, fr);
    const hw = fr.width / 2 + WALL_MARGIN;
    const cb = Math.cos(fr.bank);
    const sb = Math.sin(fr.bank);
    for (let side = 0; side < 2; side++) {
      const l = side === 0 ? -hw : hw;
      const bx = fr.x + fr.rx * l * cb;
      const bz = fr.z + fr.rz * l * cb;
      const by = fr.y - sb * l;
      const cur = { bx, by, bz, inx: -Math.sign(l) * fr.rx, inz: -Math.sign(l) * fr.rz };
      const pr = prevB[side];
      if (pr) {
        const base = wallPos.length / 3;
        // inner face: bottom(prev), bottom(cur), top(cur), top(prev)
        wallPos.push(pr.bx, pr.by - 0.3, pr.bz, cur.bx, cur.by - 0.3, cur.bz, cur.bx, cur.by + H, cur.bz, pr.bx, pr.by + H, pr.bz);
        for (let m = 0; m < 4; m++) wallNor.push(cur.inx, 0, cur.inz);
        tmp.copy(Math.floor(k / 4) % 2 ? C.wall : C.wallB);
        for (let m = 0; m < 4; m++) wallCol.push(tmp.r, tmp.g, tmp.b);
        if (side === 0) wallIdx.push(base, base + 1, base + 2, base, base + 2, base + 3);
        else wallIdx.push(base, base + 2, base + 1, base, base + 3, base + 2);
        // top cap, 0.6 m deep (towards the outside)
        const ob = wallPos.length / 3;
        const ox = -cur.inx * 0.6;
        const oz = -cur.inz * 0.6;
        wallPos.push(pr.bx, pr.by + H, pr.bz, cur.bx, cur.by + H, cur.bz, cur.bx + ox, cur.by + H, cur.bz + oz, pr.bx + ox, pr.by + H, pr.bz + oz);
        for (let m = 0; m < 4; m++) wallNor.push(0, 1, 0);
        for (let m = 0; m < 4; m++) wallCol.push(tmp.r * 1.2, tmp.g * 1.2, tmp.b * 1.2);
        if (side === 0) wallIdx.push(ob, ob + 1, ob + 2, ob, ob + 2, ob + 3);
        else wallIdx.push(ob, ob + 2, ob + 1, ob, ob + 3, ob + 2);
        // neon strip on the inner face, a hair in front of it
        const nb = neonPos.length / 3;
        const e = 0.02;
        const y0 = 0.7;
        const y1 = 0.95;
        neonPos.push(pr.bx + cur.inx * e, pr.by + y0, pr.bz + cur.inz * e, cur.bx + cur.inx * e, cur.by + y0, cur.bz + cur.inz * e, cur.bx + cur.inx * e, cur.by + y1, cur.bz + cur.inz * e, pr.bx + cur.inx * e, pr.by + y1, pr.bz + cur.inz * e);
        const nc = side === 0 ? C.neonL : C.neonR;
        for (let m = 0; m < 4; m++) neonCol.push(nc.r, nc.g, nc.b);
        if (side === 0) neonIdx.push(nb, nb + 1, nb + 2, nb, nb + 2, nb + 3);
        else neonIdx.push(nb, nb + 2, nb + 1, nb, nb + 3, nb + 2);
      }
      prevB[side] = cur;
    }
  }
  const mk = (p, n, c, i, mat, name) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    if (n) g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    g.setIndex(i);
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.name = name;
    m.frustumCulled = false;
    return m;
  };
  return {
    walls: mk(wallPos, wallNor, wallCol, wallIdx, new THREE.MeshLambertMaterial({ vertexColors: true }), 'walls'),
    neon: mk(neonPos, null, neonCol, neonIdx, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }), 'wall-neon'),
  };
}

/** Reflector posts every 36 m inside the walls: pure speed cue (instanced, 2 draw calls). */
export function buildPosts(track) {
  const gap = 36;
  const count = Math.floor(track.length / gap);
  const post = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 1.5, 0.28), new THREE.MeshLambertMaterial({ color: 0x25222f }), count * 2);
  const head = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.22, 0.34), new THREE.MeshBasicMaterial({ color: 0xffffff }), count * 2);
  const fr = {};
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  let i = 0;
  for (let k = 0; k < count; k++) {
    frameAt(track, k * gap + 7, fr);
    const cb = Math.cos(fr.bank);
    for (let side = -1; side <= 1; side += 2) {
      const l = side * (fr.width / 2 + 2.9);
      const x = fr.x + fr.rx * l * cb;
      const z = fr.z + fr.rz * l * cb;
      const y = fr.y - Math.sin(fr.bank) * l;
      m.makeTranslation(x, y + 0.75, z);
      post.setMatrixAt(i, m);
      m.makeTranslation(x, y + 1.5, z);
      head.setMatrixAt(i, m);
      head.setColorAt(i, c.set(side < 0 ? 0x19e3ff : 0xff3ea5));
      i++;
    }
  }
  post.instanceMatrix.needsUpdate = true;
  head.instanceMatrix.needsUpdate = true;
  if (head.instanceColor) head.instanceColor.needsUpdate = true;
  post.frustumCulled = false;
  head.frustumCulled = false;
  return [post, head];
}

/** Start/finish gantry: two pylons and a beam with a lit chequered underside. */
export function buildGantry(track) {
  const g = new THREE.Group();
  const fr = frameAt(track, 0, {});
  const hw = fr.width / 2 + 2;
  const beam = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.1, hw * 2 + 1.2), new THREE.MeshBasicMaterial({ color: 0xf5f2ff }));
  beam.position.set(0, 7.2, 0);
  const glow = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.28, hw * 2 + 1.25), new THREE.MeshBasicMaterial({ color: 0xff3ea5, fog: false }));
  glow.position.set(0, 6.55, 0);
  const pylonGeo = new THREE.BoxGeometry(0.9, 7.2, 0.9);
  const pylonMat = new THREE.MeshLambertMaterial({ color: 0x2d2a3a });
  for (const side of [-1, 1]) {
    const p = new THREE.Mesh(pylonGeo, pylonMat);
    p.position.set(0, 3.6, side * hw);
    g.add(p);
  }
  g.add(beam, glow);
  g.position.set(fr.x, fr.y, fr.z);
  g.rotation.y = -fr.heading;
  return g;
}

/** Vertical gradient dome + a low sun disc. Follows the camera (call `follow`). */
export function buildSky() {
  const geo = new THREE.SphereGeometry(3400, 28, 18);
  const p = geo.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const top = col(0x0a0626);
  const mid = col(0x3b1070);
  const hor = col(0xff4f9a);
  const below = col(0x1b0d3a);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 3400;
    if (y >= 0) {
      const t = Math.pow(y, 0.55);
      c.copy(hor).lerp(mid, Math.min(1, t * 2.2)).lerp(top, Math.max(0, t * 1.6 - 0.5));
    } else c.copy(hor).lerp(below, Math.min(1, -y * 6));
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  // sun
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const x = cv.getContext('2d');
  const gr = x.createRadialGradient(128, 128, 20, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,230,160,1)');
  gr.addColorStop(0.35, 'rgba(255,120,90,0.85)');
  gr.addColorStop(1, 'rgba(255,60,140,0)');
  x.fillStyle = gr;
  x.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  sun.position.set(0, 220, -3000);
  sun.renderOrder = -9;
  sun.frustumCulled = false;
  const group = new THREE.Group();
  group.add(dome, sun);
  group.userData.follow = (camera) => { group.position.copy(camera.position); };
  return group;
}

/** A big grid floor (canvas texture, tiled) under the track; it follows the camera in whole tiles so it never ends. */
export function buildFloor(minY) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const x = cv.getContext('2d');
  x.fillStyle = '#120a26';
  x.fillRect(0, 0, 256, 256);
  x.strokeStyle = 'rgba(255,62,165,0.9)';
  x.lineWidth = 3;
  x.strokeRect(1.5, 1.5, 253, 253);
  x.strokeStyle = 'rgba(25,227,255,0.25)';
  x.lineWidth = 1.5;
  x.beginPath();
  x.moveTo(128, 0); x.lineTo(128, 256); x.moveTo(0, 128); x.lineTo(256, 128);
  x.stroke();
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const tile = 40;
  const size = 6000;
  tex.repeat.set(size / tile, size / tile);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: tex }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = minY - 6;
  floor.frustumCulled = false;
  floor.userData.follow = (camera) => {
    floor.position.x = Math.round(camera.position.x / tile) * tile;
    floor.position.z = Math.round(camera.position.z / tile) * tile;
  };
  return floor;
}
