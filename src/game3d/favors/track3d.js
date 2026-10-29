// "Ori's Life" — the race tracks out of town (three.js) [experimental]: the world of a track, built the first time it is needed and far away from the city: the grass (or the sand and the sea), the road with its edge lines and its
// dashed middle, red and white kerbs, a barrier all round, trees (or palms), a grandstand, the chequered start line and the banner over it. The line, the width and the distances come from tracks.js; nothing here is collidable
// (the game keeps the car on the road: game.js trackWall). `show(id)` / `hide()` switch between the tracks. The obstacles (tracks.js hazards) are drawn here and judged in game.js (trackHazards).
import * as THREE from 'three';
import { buildTrack, TRACK_IDS } from './tracks.js';
import { mulberry32 } from '../rng.js';

const THEMES = {
  speedway: { ground: '#5d9a4e', speck: '#4b8640', barrier: ['#e5484d', '#f4f4f6'], crown: ['#2f7a3a', '#3f9a47', '#55b05a'], trunk: '#6b4a2a', trees: 150, sea: null },
  coast: { ground: '#e0c892', speck: '#cdb37c', barrier: ['#2fb8d8', '#f4f4f6'], crown: ['#2f9a5a', '#43b581', '#5ccb8f'], trunk: '#8a6a3a', trees: 90, sea: '#2f9fd0' },
  harbor: { ground: '#7b828d', speck: '#6a717c', barrier: ['#ff8a3d', '#f4f4f6'], crown: ['#2f7a3a'], trunk: '#6b4a2a', trees: 0, sea: '#2a7fb0', boxes: 56, cranes: 4 },
  ridge: { ground: '#7f9060', speck: '#6b7b4f', barrier: ['#f2c14e', '#2b2f38'], crown: ['#2a6b3f', '#357d4b', '#418f58'], trunk: '#5a4128', trees: 260, sea: null, rocks: 70 },
};

function tex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
/** A strip along the line between two sideways offsets (negative = left), `y` above the ground; v runs along it, one repeat per `vScale` metres. */
function ribbon(T, inner, outer, y, vScale) {
  const pos = []; const uv = []; const idx = [];
  for (let i = 0; i <= T.n; i++) {
    const d = i * T.seg;
    const a = T.offsetAt(d, inner); const b = T.offsetAt(d, outer);
    pos.push(a.x, y, a.z, b.x, y, b.z);
    uv.push(0, d / vScale, 1, d / vScale);
    if (i < T.n) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function buildWorld(id) {
  const T = buildTrack(id);
  const th = THEMES[T.theme];
  const rnd = mulberry32(T.n * 31 + 7);
  const g = new THREE.Group();
  g.name = `track-${id}`;
  const half = T.width / 2;
  const cx = T.path.reduce((s, p) => s + p[0], 0) / T.n; const cz = T.path.reduce((s, p) => s + p[1], 0) / T.n;
  const extent = Math.max(...T.path.map((p) => Math.hypot(p[0] - cx, p[1] - cz)));
  const mats = [];
  const lambert = (o) => { const m = new THREE.MeshLambertMaterial(o); mats.push(m); return m; };

  // the ground (and, on the coast, the sea beyond the road)
  const grass = tex(64, 64, (c, w, h) => { c.fillStyle = th.ground; c.fillRect(0, 0, w, h); for (let i = 0; i < 260; i++) { c.fillStyle = th.speck; c.globalAlpha = 0.5; c.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 3, 2 + rnd() * 3); } c.globalAlpha = 1; }, [260, 260]);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2800, 2800), lambert({ map: grass }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(cx, -0.06, cz); ground.receiveShadow = true;
  g.add(ground);
  if (th.sea) { const sea = new THREE.Mesh(new THREE.PlaneGeometry(2800, 900), new THREE.MeshLambertMaterial({ color: th.sea })); mats.push(sea.material); sea.rotation.x = -Math.PI / 2; sea.position.set(cx, -0.03, cz - extent - 440); g.add(sea); }

  // the road: asphalt, the white edge lines, a dashed middle
  const road = tex(128, 256, (c, w, h) => {
    c.fillStyle = '#383c46'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) { c.fillStyle = rnd() < 0.5 ? '#42464f' : '#2f333b'; c.fillRect(rnd() * w, rnd() * h, 2, 2); }
    c.fillStyle = '#f2f2f4'; c.fillRect(4, 0, 6, h); c.fillRect(w - 10, 0, 6, h); c.fillRect(w / 2 - 3, 0, 6, h / 2);
  }, [1, 1]);
  road.wrapS = road.wrapT = THREE.RepeatWrapping;
  const asphalt = new THREE.Mesh(ribbon(T, -half, half, 0.02, 10), lambert({ map: road, side: THREE.DoubleSide }));
  asphalt.receiveShadow = true;
  g.add(asphalt);
  // the kerbs: red and white, both sides
  const kerb = tex(32, 64, (c, w, h) => { c.fillStyle = th.barrier[0]; c.fillRect(0, 0, w, h / 2); c.fillStyle = '#f4f4f6'; c.fillRect(0, h / 2, w, h / 2); }, [1, 1]);
  kerb.wrapS = kerb.wrapT = THREE.RepeatWrapping;
  const kerbMat = lambert({ map: kerb, side: THREE.DoubleSide });
  g.add(new THREE.Mesh(ribbon(T, -half - 1.1, -half, 0.04, 4), kerbMat), new THREE.Mesh(ribbon(T, half, half + 1.1, 0.04, 4), kerbMat));

  // the barrier all round (boxes along both edges, alternating colours)
  const bGeo = new THREE.BoxGeometry(2.8, 0.9, 0.6);
  const count = Math.floor(T.total / 3) * 2;
  const barrier = new THREE.InstancedMesh(bGeo, lambert({ color: 0xffffff }), count);
  const dummy = new THREE.Object3D(); const col = new THREE.Color();
  let k = 0;
  for (let i = 0; i < Math.floor(T.total / 3); i++) for (const s of [-1, 1]) {
    const p = T.offsetAt(i * 3, s * (half + 1.7));
    dummy.position.set(p.x, 0.45, p.z); dummy.rotation.set(0, p.h - Math.PI / 2, 0); dummy.updateMatrix();
    barrier.setMatrixAt(k, dummy.matrix); barrier.setColorAt(k, col.set(th.barrier[i % 2]));
    k++;
  }
  barrier.instanceMatrix.needsUpdate = true; barrier.castShadow = true;
  g.add(barrier);

  // trees (palms on the coast), kept clear of the road
  const crowns = new THREE.InstancedMesh(new THREE.ConeGeometry(2.6, 5.5, 7), lambert({ color: 0xffffff }), Math.max(1, th.trees));
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.28, 0.4, 3.2, 6), lambert({ color: th.trunk }), Math.max(1, th.trees));
  let t = 0; let tries = 0;
  while (t < th.trees && tries++ < 4000) {
    const x = cx + (rnd() * 2 - 1) * (extent + 140); const z = cz + (rnd() * 2 - 1) * (extent + 140);
    if (th.sea && z < cz - extent - 40) continue;
    if (T.nearest(x, z).dist < half + 14) continue;
    const sc = 0.8 + rnd() * 0.9;
    dummy.position.set(x, 1.6 * sc, z); dummy.rotation.set(0, rnd() * 6, 0); dummy.scale.setScalar(sc); dummy.updateMatrix(); trunks.setMatrixAt(t, dummy.matrix);
    dummy.position.set(x, 5.4 * sc, z); dummy.updateMatrix(); crowns.setMatrixAt(t, dummy.matrix); crowns.setColorAt(t, col.set(th.crown[Math.floor(rnd() * th.crown.length)]));
    t++;
  }
  crowns.count = t; trunks.count = t;
  crowns.instanceMatrix.needsUpdate = true; trunks.instanceMatrix.needsUpdate = true;
  crowns.castShadow = trunks.castShadow = true;
  g.add(crowns, trunks);

  // the harbour: stacks of containers and a few cranes by the water; the hills: boulders by the road
  const farFromRoad = (x, z, min) => !(th.sea && z < cz - extent - 40) && T.nearest(x, z).dist >= half + min;
  if (th.boxes) {
    const palette = ['#e5484d', '#2f6fd0', '#f2c14e', '#43b581', '#9b6bff', '#ff8a3d', '#e8e9ee'];
    const boxes = new THREE.InstancedMesh(new THREE.BoxGeometry(12, 2.6, 2.6), lambert({ color: 0xffffff }), th.boxes * 2);
    let b = 0; let tr = 0;
    while (b < th.boxes * 2 - 1 && tr++ < 3000) {
      const x = cx + (rnd() * 2 - 1) * (extent + 90); const z = cz + (rnd() * 2 - 1) * (extent + 90);
      if (!farFromRoad(x, z, 11)) continue;
      const yaw = rnd() < 0.5 ? 0 : Math.PI / 2; const colr = palette[Math.floor(rnd() * palette.length)];
      dummy.scale.setScalar(1); dummy.rotation.set(0, yaw, 0);
      dummy.position.set(x, 1.3, z); dummy.updateMatrix(); boxes.setMatrixAt(b, dummy.matrix); boxes.setColorAt(b, col.set(colr)); b++;
      if (rnd() < 0.35) { dummy.position.set(x, 3.9, z); dummy.updateMatrix(); boxes.setMatrixAt(b, dummy.matrix); boxes.setColorAt(b, col.set(palette[Math.floor(rnd() * palette.length)])); b++; }
    }
    boxes.count = b; boxes.instanceMatrix.needsUpdate = true; boxes.castShadow = true;
    g.add(boxes);
  }
  if (th.cranes) {
    const red = lambert({ color: 0xe5484d }); const grey = lambert({ color: 0xdadde3 });
    for (let k = 0; k < th.cranes; k++) {
      const crane = new THREE.Group();
      for (const sx of [-4, 4]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(1.2, 30, 1.2), red); leg.position.set(sx, 15, 0); crane.add(leg); }
      const boom = new THREE.Mesh(new THREE.BoxGeometry(46, 1.8, 2.4), red); boom.position.set(-12, 30.5, 0);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 3.4), grey); cab.position.set(0, 28.5, 0);
      crane.add(boom, cab);
      crane.position.set(cx - extent * 0.8 + k * ((extent * 1.6) / Math.max(1, th.cranes - 1)), 0, cz - extent - 22);
      g.add(crane);
    }
  }
  if (th.rocks) {
    const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), lambert({ color: 0xffffff }), th.rocks);
    let r = 0; let tr = 0;
    while (r < th.rocks && tr++ < 3000) {
      const a = rnd() * T.n; const p = T.offsetAt(a * T.seg, (rnd() < 0.5 ? -1 : 1) * (half + 5 + rnd() * 16));
      if (T.nearest(p.x, p.z).dist < half + 4) continue;
      const sc = 1.4 + rnd() * 2.6;
      dummy.position.set(p.x, sc * 0.45, p.z); dummy.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); dummy.scale.set(sc, sc * (0.6 + rnd() * 0.3), sc); dummy.updateMatrix();
      rocks.setMatrixAt(r, dummy.matrix); rocks.setColorAt(r, col.set(rnd() < 0.5 ? '#8c8f96' : '#767a82')); r++;
    }
    dummy.scale.setScalar(1); dummy.rotation.set(0, 0, 0);
    rocks.count = r; rocks.instanceMatrix.needsUpdate = true; rocks.castShadow = true;
    g.add(rocks);
  }

  // the obstacles on the road: cones and barrels (knocked over by a car: `knock`), stacks of tyres, oil patches
  const hzs = T.hazards;
  const kinds = (k) => hzs.filter((h) => h.kind === k);
  const instanced = (geo, mat, count) => { const m = new THREE.InstancedMesh(geo, mat, Math.max(1, count)); m.count = count; m.castShadow = true; g.add(m); return m; };
  const coneGeo = new THREE.ConeGeometry(0.42, 1.0, 10); coneGeo.translate(0, 0.5, 0);
  const baseGeo = new THREE.BoxGeometry(0.95, 0.07, 0.95); baseGeo.translate(0, 0.035, 0);
  const barrelGeo = new THREE.CylinderGeometry(0.55, 0.6, 1.15, 14); barrelGeo.translate(0, 0.575, 0);
  const tyreGeo = new THREE.TorusGeometry(0.62, 0.26, 8, 14); tyreGeo.rotateX(Math.PI / 2);
  const oilGeo = new THREE.CircleGeometry(1, 28); oilGeo.rotateX(-Math.PI / 2);
  const coneH = kinds('cone'); const barrelH = kinds('barrel'); const tyreH = kinds('tyres'); const oilH = kinds('oil');
  const meshes = {
    cone: instanced(coneGeo, lambert({ color: 0xff7a1a }), coneH.length),
    base: instanced(baseGeo, lambert({ color: 0x20242c }), coneH.length),
    barrel: instanced(barrelGeo, lambert({ color: 0xffffff }), barrelH.length),
    tyre: instanced(tyreGeo, lambert({ color: 0xffffff }), tyreH.length * 3),
  };
  const oilMat = new THREE.MeshBasicMaterial({ color: 0x0b0d12, transparent: true, opacity: 0.88, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  mats.push(oilMat);
  const oils = instanced(oilGeo, oilMat, oilH.length); oils.castShadow = false;
  const slotsOf = new Map(); // hazard index -> what to move when it is knocked: [{ mesh, idx, x, y, z }]
  const put = (mesh, idx, x, y, z, yaw = 0, sx = 1, rz = 0) => { dummy.position.set(x, y, z); dummy.rotation.set(0, yaw, rz); dummy.scale.set(sx, sx, sx); dummy.updateMatrix(); mesh.setMatrixAt(idx, dummy.matrix); };
  coneH.forEach((h, k) => { put(meshes.cone, k, h.x, 0, h.z, k); put(meshes.base, k, h.x, 0, h.z, k); slotsOf.set(h.i, [{ mesh: meshes.cone, idx: k, x: h.x, y: 0, z: h.z, lie: 0.42 }, { mesh: meshes.base, idx: k, x: h.x, y: 0, z: h.z, lie: 0 }]); });
  barrelH.forEach((h, k) => { put(meshes.barrel, k, h.x, 0, h.z, 0); meshes.barrel.setColorAt(k, col.set(k % 2 ? th.barrier[0] : '#2f6fd0')); slotsOf.set(h.i, [{ mesh: meshes.barrel, idx: k, x: h.x, y: 0, z: h.z, lie: 0.58 }]); });
  tyreH.forEach((h, k) => {
    const list = [];
    for (let t = 0; t < 3; t++) { const idx = k * 3 + t; put(meshes.tyre, idx, h.x, 0.26 + t * 0.52, h.z, t * 0.7); meshes.tyre.setColorAt(idx, col.set(t % 2 ? th.barrier[0] : '#f4f4f6')); list.push({ mesh: meshes.tyre, idx, x: h.x, y: 0.26 + t * 0.52, z: h.z, lie: -1 }); }
    slotsOf.set(h.i, list);
  });
  oilH.forEach((h, k) => put(oils, k, h.x, 0.05, h.z, 0, h.r));
  const instMeshes = [meshes.cone, meshes.base, meshes.barrel, meshes.tyre, oils];
  for (const m of instMeshes) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  const home = instMeshes.map((m) => m.instanceMatrix.array.slice());
  g.userData.hz = {
    /** A cone or a barrel is knocked over: it lies down and slides a little in the way the car was going. */
    knock(i, dx, dz) {
      const list = slotsOf.get(i);
      if (!list) return;
      const far = list[0].mesh === meshes.barrel ? 2.8 : 1.8;
      for (const sl of list) {
        if (sl.lie < 0) continue;
        put(sl.mesh, sl.idx, sl.x + dx * far, sl.lie, sl.z + dz * far, Math.atan2(dx, dz), 1, sl.lie > 0 ? Math.PI / 2 : 0);
        sl.mesh.instanceMatrix.needsUpdate = true;
      }
    },
    reset() { instMeshes.forEach((m, k) => { m.instanceMatrix.array.set(home[k]); m.instanceMatrix.needsUpdate = true; }); },
  };

  // the start: a chequered line across the road, two poles and a banner
  const start = T.at(0);
  const gate = new THREE.Group();
  gate.position.set(start.x, 0, start.z); gate.rotation.y = start.h;
  const line = tex(64, 512, (c, w, h) => { const s = 32; for (let i = 0; i < h / s; i++) for (let j = 0; j < w / s; j++) { c.fillStyle = (i + j) % 2 ? '#ffffff' : '#161a22'; c.fillRect(j * s, i * s, s, s); } });
  const lineMesh = new THREE.Mesh(new THREE.PlaneGeometry(T.width, 2.4), new THREE.MeshBasicMaterial({ map: line, toneMapped: false }));
  mats.push(lineMesh.material);
  lineMesh.rotation.x = -Math.PI / 2; lineMesh.position.y = 0.06;
  const banner = tex(1024, 256, (c, w, h) => {
    c.fillStyle = '#10141c'; c.fillRect(0, 0, w, h);
    const s = 32;
    for (let i = 0; i < w / s; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#10141c'; c.fillRect(i * s, 0, s, s); c.fillStyle = i % 2 ? '#10141c' : '#ffffff'; c.fillRect(i * s, h - s, s, s); }
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#ffffff'; c.font = '900 104px Inter, system-ui, sans-serif'; c.fillText(T.name.toUpperCase(), w / 2, h / 2 - 12);
    c.fillStyle = '#ffb25b'; c.font = '800 40px Inter, system-ui, sans-serif'; c.fillText('START  -  FINISH', w / 2, h - 64);
  });
  const bannerMesh = new THREE.Mesh(new THREE.PlaneGeometry(T.width + 2, 2.2), new THREE.MeshBasicMaterial({ map: banner, side: THREE.DoubleSide, toneMapped: false }));
  mats.push(bannerMesh.material);
  bannerMesh.position.set(0, 7, 0);
  const poleGeo = new THREE.CylinderGeometry(0.2, 0.25, 8, 10); const poleMat = lambert({ color: 0xe7e9ee });
  for (const s of [-1, 1]) { const p = new THREE.Mesh(poleGeo, poleMat); p.position.set(s * (half + 1.4), 4, 0); gate.add(p); }
  gate.add(lineMesh, bannerMesh);
  g.add(gate);

  // a grandstand beside the start straight, full of little crowd dots
  const crowd = tex(256, 64, (c, w, h) => { c.fillStyle = '#4a5160'; c.fillRect(0, 0, w, h); for (let i = 0; i < 520; i++) { c.fillStyle = ['#ffb25b', '#e5484d', '#7fb6ff', '#f4f4f6', '#43b581', '#9b6bff'][Math.floor(rnd() * 6)]; c.fillRect(rnd() * w, rnd() * h, 3, 3); } });
  const stand = new THREE.Mesh(new THREE.BoxGeometry(46, 6, 9), lambert({ map: crowd }));
  const sp = T.offsetAt(60, half + 17);
  stand.position.set(sp.x, 3, sp.z); stand.rotation.y = sp.h - Math.PI / 2; stand.castShadow = true;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(48, 0.4, 11), lambert({ color: th.barrier[0] }));
  roof.position.set(sp.x, 8.4, sp.z); roof.rotation.y = stand.rotation.y;
  g.add(stand, roof);

  g.userData.dispose = () => { g.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.isInstancedMesh) o.dispose(); }); for (const m of mats) { if (m.map) m.map.dispose(); m.dispose(); } };
  return g;
}

/** @param {{ scene: import('three').Scene }} o */
export function createTrackWorld({ scene }) {
  const worlds = new Map();
  let shown = null;
  const api = {
    get shown() { return shown; },
    /** Shows the track `id` (built the first time) and hides the one before. */
    show(id) {
      if (!TRACK_IDS.includes(id)) return false;
      if (shown && shown !== id) worlds.get(shown).visible = false;
      if (!worlds.has(id)) { const w = buildWorld(id); worlds.set(id, w); scene.add(w); }
      worlds.get(id).visible = true;
      worlds.get(id).userData.hz.reset(); // (every visit starts with all the cones standing)
      shown = id;
      return true;
    },
    /** A cone or a barrel of the track on show is knocked over (hazard index, the way the car was going). */
    knock(i, dx, dz) { if (shown) worlds.get(shown).userData.hz.knock(i, dx, dz); },
    hide() { if (shown) worlds.get(shown).visible = false; shown = null; },
    dispose() { for (const w of worlds.values()) { scene.remove(w); w.userData.dispose(); } worlds.clear(); shown = null; },
  };
  return api;
}
