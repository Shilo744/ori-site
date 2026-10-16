// "Ori, Can You...?" — Ori himself, a caricature built from the real photo: the face is a feathered oval cut out of the selfie and wrapped
// over a 1.3x head; around it everything is 3D so he reads from every angle — big dark curls (instanced), black temples of the glasses,
// the silver hoop, the rope chain, a black tee. Without the picture a drawn face stands in. Facing: +z at rotation 0 (see controller.js).
import * as THREE from 'three';
import { mulberry32 } from '../rng.js';
import { ORI } from './content.js';
import faceUrl from './assets/ori-face.jpg';

const R = 0.222; // head radius (a 1.3x caricature head)
const HEAD_Y = 1.7;

/** The photo as a soft oval (alpha fades at the edge), or null when it cannot be decoded. */
function loadFaceTexture() {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const S = 256;
      const c = document.createElement('canvas');
      c.width = S;
      c.height = S;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0, S, S);
      g.globalCompositeOperation = 'destination-in';
      g.save();
      g.translate(S * 0.52, S * 0.53); // the face sits a little right of the middle of the crop
      g.scale(0.9, 1.08);
      const grd = g.createRadialGradient(0, 0, S * 0.25, 0, 0, S * 0.45);
      grd.addColorStop(0, 'rgba(0,0,0,1)');
      grd.addColorStop(0.62, 'rgba(0,0,0,1)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.fillRect(-S / 2, -S / 2, S, S);
      g.restore();
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      resolve(t);
    };
    img.onerror = () => resolve(null);
    img.src = faceUrl;
  });
}

/** A drawn face (skin, eyes behind black glasses, moustache and goatee) for when the photo is missing. */
function fallbackFace() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#c58f6c';
  g.beginPath();
  g.ellipse(S / 2, S / 2, S * 0.42, S * 0.46, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#101114';
  g.lineWidth = 7;
  g.strokeRect(S * 0.16, S * 0.34, S * 0.27, S * 0.17);
  g.strokeRect(S * 0.57, S * 0.34, S * 0.27, S * 0.17);
  g.beginPath(); g.moveTo(S * 0.43, S * 0.4); g.lineTo(S * 0.57, S * 0.4); g.stroke();
  g.fillStyle = '#1b1210';
  g.beginPath(); g.arc(S * 0.3, S * 0.43, 8, 0, 7); g.arc(S * 0.7, S * 0.43, 8, 0, 7); g.fill();
  g.fillRect(S * 0.38, S * 0.66, S * 0.24, 8); // moustache
  g.fillRect(S * 0.46, S * 0.82, S * 0.08, 14); // goatee
  g.strokeStyle = '#7a3b2e';
  g.lineWidth = 5;
  g.beginPath(); g.moveTo(S * 0.42, S * 0.74); g.quadraticCurveTo(S * 0.5, S * 0.78, S * 0.58, S * 0.74); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The face as a patch of a slightly larger ellipsoid in front of the skull (so it wraps around instead of a flat card). */
function facePatch() {
  const nu = 14;
  const nv = 14;
  const pos = [];
  const uv = [];
  const idx = [];
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const u = i / nu;
      const v = j / nv;
      const x = (u - 0.5) * 2 * 0.2;
      const y = (v - 0.5) * 2 * 0.215;
      const z = Math.sqrt(Math.max(0.0004, (R + 0.012) ** 2 - x * x * 1.05 - y * y * 0.62));
      pos.push(x, y, z);
      uv.push(u, v);
    }
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i; idx.push(a, a + 1, a + nu + 2, a, a + nu + 2, a + nu + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function emoteTexture(kind) {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  g.lineCap = 'round';
  if (kind === 'sweat') {
    for (const [x, y, s] of [[44, 50, 1], [86, 78, 0.75]]) {
      g.fillStyle = '#7cc8ff';
      g.strokeStyle = '#2f7fc4';
      g.lineWidth = 4;
      g.beginPath(); g.moveTo(x, y - 24 * s); g.bezierCurveTo(x + 22 * s, y + 6 * s, x + 16 * s, y + 24 * s, x, y + 24 * s); g.bezierCurveTo(x - 16 * s, y + 24 * s, x - 22 * s, y + 6 * s, x, y - 24 * s); g.fill(); g.stroke();
    }
  } else if (kind === 'anger') {
    g.strokeStyle = '#e03a3a';
    g.lineWidth = 11;
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { g.beginPath(); g.arc(64 + Math.cos(a + 0.78) * 30, 64 + Math.sin(a + 0.78) * 30, 24, a + 0.2, a + 1.4); g.stroke(); }
  } else if (kind === 'sparkle') {
    g.fillStyle = '#ffd84a';
    for (const [x, y, s] of [[44, 56, 1], [88, 40, 0.65], [84, 92, 0.8]]) {
      g.beginPath();
      for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; const r = (k % 2 ? 7 : 24) * s; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
      g.closePath(); g.fill();
    }
  } else {
    g.fillStyle = '#6a7bd6';
    g.font = '800 54px Inter, system-ui, sans-serif';
    g.fillText('Z', 22, 62);
    g.font = '800 38px Inter, system-ui, sans-serif';
    g.fillText('z', 66, 84);
    g.font = '800 26px Inter, system-ui, sans-serif';
    g.fillText('z', 96, 104);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createOri({ shadows = true } = {}) {
  const L = ORI.look;
  const rnd = mulberry32(2026);
  const root = new THREE.Group();
  root.name = 'ori';
  root.userData.faceSource = 'drawn'; // 'photo' once the selfie cutout is in place (tests read it)
  const disposables = [];
  const mat = (color, rough = 0.7, metal = 0) => { const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }); disposables.push(m); return m; };
  const geo = (g) => { disposables.push(g); return g; };
  const mesh = (g, m, parent, { cast = true } = {}) => { const o = new THREE.Mesh(g, m); o.castShadow = shadows && cast; o.receiveShadow = false; parent.add(o); return o; };

  const skin = mat(L.skin, 0.65);
  const tee = mat(L.tee, 0.85);
  const jeans = mat(L.jeans, 0.8);
  const shoe = mat(L.shoes, 0.6);
  const silver = mat(L.chain, 0.25, 0.9);
  const frame = mat(L.glasses, 0.4);
  const hairMat = mat(L.hair, 0.5);
  hairMat.emissive = new THREE.Color(0x1c0f07);

  const body = new THREE.Group(); // leans and bobs
  root.add(body);

  // legs (pivot at the hip)
  const legs = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.1, 0.86, 0);
    body.add(pivot);
    const leg = mesh(geo(new THREE.CapsuleGeometry(0.075, 0.6, 4, 8)), jeans, pivot);
    leg.position.y = -0.4;
    const foot = mesh(geo(new THREE.BoxGeometry(0.13, 0.08, 0.26)), shoe, pivot);
    foot.position.set(0, -0.8, 0.05);
    legs.push(pivot);
  }
  // torso, neck, arms
  const torso = mesh(geo(new THREE.CapsuleGeometry(0.17, 0.32, 6, 12)), tee, body);
  torso.position.y = 1.12;
  torso.scale.set(1.08, 1, 0.78);
  const neck = mesh(geo(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 10)), skin, body);
  neck.position.y = 1.51;
  const arms = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.24, 1.36, 0);
    body.add(pivot);
    const sleeve = mesh(geo(new THREE.CapsuleGeometry(0.062, 0.2, 4, 8)), tee, pivot);
    sleeve.position.y = -0.14;
    const fore = mesh(geo(new THREE.CapsuleGeometry(0.052, 0.26, 4, 8)), skin, pivot);
    fore.position.y = -0.4;
    const hand = mesh(geo(new THREE.SphereGeometry(0.065, 8, 6)), skin, pivot);
    hand.position.y = -0.58;
    arms.push(pivot);
  }
  // the rope chain: a silver U on the chest
  const chain = mesh(geo(new THREE.TorusGeometry(0.15, 0.011, 6, 28, Math.PI * 1.1)), silver, body, { cast: false });
  chain.rotation.z = Math.PI * 0.95;
  chain.position.set(0, 1.45, 0.118);
  chain.scale.set(1, 1.25, 1);

  // head
  const head = new THREE.Group();
  head.position.y = HEAD_Y;
  body.add(head);
  const skull = mesh(geo(new THREE.SphereGeometry(R, 24, 18)), skin, head);
  skull.scale.set(0.94, 1.02, 0.96);
  const faceMat = new THREE.MeshStandardMaterial({ map: fallbackFace(), roughness: 0.75, transparent: true, alphaTest: 0.04, depthWrite: true });
  disposables.push(faceMat);
  const face = new THREE.Mesh(geo(facePatch()), faceMat);
  face.position.y = 0.0;
  face.renderOrder = 1;
  head.add(face);
  let faceTex = null;
  let alive = true;
  loadFaceTexture().then((t) => {
    if (!t || !alive) return;
    faceTex = t;
    if (faceMat.map) faceMat.map.dispose();
    faceMat.map = t;
    faceMat.needsUpdate = true;
    root.userData.faceSource = 'photo';
  });
  // ears + the silver hoop (his left ear = +x here, where the photo shows it)
  for (const sx of [-1, 1]) {
    const ear = mesh(geo(new THREE.SphereGeometry(0.05, 10, 8)), skin, head);
    ear.position.set(sx * 0.205, -0.02, -0.01);
    ear.scale.set(0.5, 1, 0.8);
  }
  const hoop = mesh(geo(new THREE.TorusGeometry(0.036, 0.0075, 6, 18)), silver, head, { cast: false });
  hoop.rotation.y = Math.PI / 2;
  hoop.position.set(0.225, -0.075, 0.0);
  // the temples of the glasses run back along the head
  for (const sx of [-1, 1]) {
    const arm = mesh(geo(new THREE.BoxGeometry(0.012, 0.016, 0.2)), frame, head, { cast: false });
    arm.position.set(sx * 0.2, 0.04, 0.07);
    arm.rotation.y = sx * 0.1;
  }
  // the curls: a dark cap to fill the gaps + ~120 instanced balls on a shell round the top, sides and back
  const cap = mesh(geo(new THREE.SphereGeometry(R * 1.04, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.66)), hairMat, head);
  cap.rotation.x = -0.2;
  cap.position.set(0, 0.015, -0.025);
  const curlGeo = geo(new THREE.IcosahedronGeometry(1, 1));
  const N = 280;
  const curls = new THREE.InstancedMesh(curlGeo, hairMat, N);
  curls.castShadow = shadows;
  const m = new THREE.Matrix4();
  const qn = new THREE.Quaternion();
  const col = new THREE.Color();
  let n = 0;
  let guard = 0;
  while (n < N && guard++ < 4000) {
    const u = rnd() * 2 - 1;
    const a = rnd() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const dx = s * Math.cos(a);
    const dy = u;
    const dz = s * Math.sin(a);
    if (dy < -0.05) continue; // nothing below the ears
    if (dz > 0.2 && dy < 0.6) continue; // keep the face clear
    if (dz > 0.2 && Math.abs(dx) < 0.62 && dy < 0.8) continue;
    const r = R * (0.96 + rnd() * 0.16);
    const size = 0.038 + rnd() * 0.036;
    m.compose(new THREE.Vector3(dx * r * 0.96, dy * r * 1.0 + 0.02, dz * r * 0.98), qn.setFromEuler(new THREE.Euler(rnd() * 6, rnd() * 6, rnd() * 6)), new THREE.Vector3(size, size * 0.92, size));
    curls.setMatrixAt(n, m);
    col.set(L.hair).offsetHSL(0, 0, (rnd() - 0.35) * 0.05);
    curls.setColorAt(n, col);
    n++;
  }
  curls.count = n;
  curls.instanceMatrix.needsUpdate = true;
  if (curls.instanceColor) curls.instanceColor.needsUpdate = true;
  head.add(curls);

  // a soft blob under his feet (the real shadow takes over on the higher tiers)
  const blobTex = (() => {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, 'rgba(0,0,0,0.45)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  disposables.push(blobTex);
  const blob = new THREE.Mesh(geo(new THREE.PlaneGeometry(0.9, 0.9)), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  disposables.push(blob.material);
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.02;
  root.add(blob);

  // emotes: little billboards above his head, driven by stress
  const emoteMats = {};
  const emote = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, opacity: 0 }));
  emote.scale.set(0.5, 0.5, 1);
  emote.position.set(0.3, 2.15, 0);
  root.add(emote);
  disposables.push(emote.material);
  let emoteName = null;
  function setEmote(name) {
    if (name === emoteName) return;
    emoteName = name;
    if (!name) { emote.material.opacity = 0; return; }
    if (!emoteMats[name]) { emoteMats[name] = emoteTexture(name); disposables.push(emoteMats[name]); }
    emote.material.map = emoteMats[name];
    emote.material.needsUpdate = true;
    emote.material.opacity = 1;
  }

  // animation state
  let phase = 0;
  let prevSpeed = 0;
  let squash = 0;
  let t = 0;

  return {
    group: root,
    head,
    get height() { return HEAD_Y + R + 0.14; },
    setEmote,
    /** s = the controller state (+ stress 0..1). Positions the group and animates the limbs. */
    update(dt, s, groundY = 0, stress = 0) {
      t += dt;
      root.position.set(s.x, groundY, s.z);
      root.rotation.y = s.heading;
      const sp = s.speed;
      const run = Math.min(1, sp / 4.4);
      phase += dt * (sp * 1.35 + (sp > 0.2 ? 2 : 0));
      const swing = Math.sin(phase) * 0.85 * run * (s.sprinting ? 1.25 : 1);
      legs[0].rotation.x = swing;
      legs[1].rotation.x = -swing;
      arms[0].rotation.x = -swing * 1.05;
      arms[1].rotation.x = swing * 1.05;
      arms[0].rotation.z = 0.06;
      arms[1].rotation.z = -0.06;
      const bob = Math.abs(Math.cos(phase)) * 0.055 * run + Math.sin(t * 2.2) * 0.008 * (1 - run);
      body.position.y = bob;
      body.rotation.x = Math.min(0.32, sp * 0.045) + (s.sprinting ? 0.08 : 0);
      head.rotation.x = -body.rotation.x * 0.6 + Math.sin(t * 1.3) * 0.02;
      head.rotation.z = Math.sin(phase * 0.5) * 0.04 * run + (stress > 0.6 ? Math.sin(t * 38) * 0.015 * stress : 0);
      // squash & stretch from the change of speed
      const acc = dt > 0 ? (sp - prevSpeed) / dt : 0;
      prevSpeed = sp;
      squash += (Math.max(-0.1, Math.min(0.12, acc * 0.004)) - squash) * Math.min(1, dt * 14);
      body.scale.set(1 - squash * 0.5, 1 + squash, 1 - squash * 0.5);
      // stress → emotes
      setEmote(stress > 0.85 ? 'anger' : stress > 0.5 ? 'sweat' : s.winded ? 'zzz' : null);
      if (emoteName) emote.position.y = 2.15 + Math.sin(t * 5) * 0.025;
      blob.visible = !shadows;
    },
    dispose() {
      alive = false;
      curls.dispose();
      disposables.forEach((d) => d.dispose && d.dispose());
      faceMat.map && faceMat.map.dispose();
      if (faceTex) faceTex.dispose();
    },
  };
}
