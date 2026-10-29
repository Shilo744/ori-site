// "Ori, Can You...?" — a living character in three.js: the skinned layers of assemble.js on ONE skeleton, the cartoon outline, the animator
// (walk / run / gestures / held phone or box), the face (expressions, blinking, talking, a sweat drop) and the little props. `createPerson(spec)` is
// what Ori and every shopkeeper / neighbour who stops to talk is made with; the far crowd uses the same parts through an instanced shortcut.
import * as THREE from 'three';
import { buildPersonData, personStats } from './assemble.js';
import { createAnimator } from './anim.js';
import { createFace } from './expressions.js';
import { applyPose } from './pose-apply.js';
import { createMaterials, outlineMaterial, OUTLINE_COLORS } from './materials.js';
import { BODY_SCALE } from './body.js';

const OUTLINED = ['skin', 'shoes'];
const CAST = ['skin', 'tee', 'jeans', 'shoes']; // (the curls do not cast: ~140k triangles of shadow pass for a silhouette the head already gives)

function skinnedGeometry(m) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
  g.setAttribute('color', new THREE.BufferAttribute(m.colors, 3));
  if (m.skinIndex) {
    g.setAttribute('skinIndex', new THREE.BufferAttribute(m.skinIndex, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(m.skinWeight, 4));
  }
  g.setIndex(new THREE.BufferAttribute(m.indices, 1));
  return g;
}

/** A little cartoon iPhone and a cardboard box, held in the hands by the animator's `prop`. */
function makeProps(mats) {
  const phone = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.17, 0.012), new THREE.MeshStandardMaterial({ color: 0x1b1c20, roughness: 0.3, metalness: 0.5 }));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.158), new THREE.MeshBasicMaterial({ color: 0x8fd0ff }));
  screen.position.z = 0.0065;
  phone.add(body, screen);
  phone.userData.screen = screen;
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.26, 0.28), new THREE.MeshStandardMaterial({ color: 0xc89a62, roughness: 0.85 }));
  const tape = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.262, 0.282), new THREE.MeshStandardMaterial({ color: 0xe8d5a8, roughness: 0.7 }));
  box.add(tape);
  void mats;
  return { phone, box };
}

/** @param {object} spec person spec (specs.js) @param {{ shadows?: boolean, quality?: number, tier?: string, outline?: boolean, key?: string }} o */
export function createPerson(spec, { shadows = true, quality = 1, tier = 'high', outline = true, key = null } = {}) {
  const data = buildPersonData(spec, { quality, key: key || spec.id });
  const group = new THREE.Group();
  group.name = spec.id || 'person';
  if (spec.scale && spec.scale !== 1) group.scale.setScalar(spec.scale);
  const disposables = [];
  const mats = createMaterials({ tier });
  Object.values(mats).forEach((m) => disposables.push(m));

  // skeleton
  const bones = {};
  const rest = {};
  const list = data.rig.bones.map((b) => { const o = new THREE.Bone(); o.name = b.name; bones[b.name] = o; return o; });
  data.rig.bones.forEach((b, i) => {
    const pp = b.parent ? data.rig.bones.find((p) => p.name === b.parent).pos : [0, 0, 0];
    const local = [b.pos[0] - pp[0], b.pos[1] - pp[1], b.pos[2] - pp[2]];
    list[i].position.set(...local);
    rest[b.name] = local;
    (b.parent ? bones[b.parent] : group).add(list[i]);
  });
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(list);

  // layers
  const meshes = {};
  const outlines = [];
  for (const [name, m] of Object.entries(data.layers)) {
    const geo = skinnedGeometry(m);
    disposables.push(geo);
    const mesh = new THREE.SkinnedMesh(geo, mats[name]);
    mesh.name = `${spec.id || 'person'}:${name}`;
    mesh.frustumCulled = false;
    mesh.castShadow = shadows && CAST.includes(name);
    mesh.receiveShadow = false;
    if (name === 'lens') mesh.renderOrder = 3;
    if (name === 'glint') mesh.renderOrder = 4;
    group.add(mesh);
    mesh.bind(skeleton);
    meshes[name] = mesh;
    if (outline && OUTLINED.includes(name)) {
      const om = outlineMaterial(OUTLINE_COLORS[name] ?? 0x120a08);
      disposables.push(om);
      const o = new THREE.SkinnedMesh(geo, om);
      o.name = `${mesh.name}:outline`;
      o.frustumCulled = false;
      group.add(o);
      o.bind(skeleton);
      outlines.push(o);
    }
  }

  // the mouth (rebuilt when the expression changes; lives in the head frame)
  const CAP = 2400;
  const mg = new THREE.BufferGeometry();
  mg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(CAP * 3), 3));
  mg.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(CAP * 3), 3));
  mg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(CAP * 3), 3));
  mg.setIndex(new THREE.BufferAttribute(new Uint16Array(CAP * 6), 1));
  mg.setDrawRange(0, 0);
  disposables.push(mg);
  const mouthMesh = new THREE.Mesh(mg, mats.mouth);
  mouthMesh.frustumCulled = false;
  bones.head.add(mouthMesh);
  let mouthKey = '';
  function setMouth(ch) {
    const q = (v) => Math.round(v * 60);
    const k = `${q(ch.w)}|${q(ch.smile)}|${q(ch.open)}|${q(ch.round)}|${q(ch.asym)}|${q(ch.teeth)}|${q(ch.tongue)}`;
    if (k === mouthKey) return;
    mouthKey = k;
    const m = data.mouth({ w: ch.w, smile: ch.smile, open: ch.open, round: ch.round, asym: ch.asym, teeth: ch.teeth, tongue: ch.tongue });
    const n = Math.min(m.vertexCount, CAP);
    mg.attributes.position.array.set(m.positions.subarray(0, n * 3)); mg.attributes.position.needsUpdate = true;
    mg.attributes.normal.array.set(m.normals.subarray(0, n * 3)); mg.attributes.normal.needsUpdate = true;
    mg.attributes.color.array.set(m.colors.subarray(0, n * 3)); mg.attributes.color.needsUpdate = true;
    const idx = m.indices.length;
    if (idx <= CAP * 6) { mg.index.array.set(m.indices); mg.index.needsUpdate = true; mg.setDrawRange(0, idx); }
  }

  // a sweat drop for "flustered but smiling"
  const drop = new THREE.Mesh(new THREE.LatheGeometry(Array.from({ length: 14 }, (_, i) => { const t = i / 13; const a = t * Math.PI; return new THREE.Vector2(Math.sin(a) * 0.011 * (1 - 0.3 * Math.cos(a * 0.5)), -Math.cos(a) * 0.016 + 0.004 * (1 - t)); }), 10), mats.sweat);
  drop.geometry.scale(1, 1.25, 1);
  disposables.push(drop.geometry);
  drop.visible = false;
  bones.head.add(drop);

  // props in the hands
  const props = makeProps(mats);
  props.phone.visible = false; props.box.visible = false;
  bones.handR.add(props.phone);
  props.phone.position.set(-0.004, -0.075, 0.02); props.phone.rotation.set(0.1, 0, 0.0);
  bones.chest.add(props.box);
  props.box.position.set(0, -0.12, 0.3); props.box.visible = false;
  disposables.push(props.phone.children[0].geometry, props.phone.children[1].geometry, props.box.geometry, props.box.children[0].geometry);

  const animator = createAnimator();
  const face = createFace((spec.seed || 1) * 7919);
  let mood = 'smile';
  let moodK = 1;
  let faceName = '';
  let hairV = 0; let hairP = 0; let hairVz = 0; let hairPz = 0;
  const rootRot = new THREE.Euler();
  void rootRot;
  const api = {
    group, data, bones, skeleton, meshes, animator, face, stats: personStats(data),
    get headHeight() { return data.headPos[1] + 0.34; },
    setMood(name, k = 1) { mood = name; moodK = k; },
    play(g, speed) { animator.play(g, speed); },
    hold(name) { animator.hold(name); },
    setMirror(on) { animator.setMirror(on); },
    setOutline(on) { outlines.forEach((o) => { o.visible = on; }); },
    /** s = { speed, sprinting, winded, stress, hold, talking, acc }; returns nothing, moves the bones */
    update(dt, s = {}) {
      const pose = animator.update(dt, s);
      const want = pose.expression || mood;
      if (want !== faceName) { faceName = want; face.set(want, pose.expression ? 1 : moodK); }
      const ch = face.update(dt, { talk: !!s.talking, look: pose.look });
      applyPose(bones, rest, pose, ch);
      setMouth(ch);
      mats.skin.color.setRGB(1, 1 - 0.1 * ch.flush, 1 - 0.13 * ch.flush);
      // sweat drop slides down the temple
      const sw = ch.sweat;
      drop.visible = sw > 0.05;
      if (drop.visible) { const slide = (performance.now() * 0.00035) % 1; drop.position.set(0.098, 0.06 - slide * 0.04, 0.062); drop.scale.setScalar(0.9 * sw * (1 - slide * 0.4)); }
      // props
      props.phone.visible = pose.prop === 'phone';
      props.box.visible = pose.prop === 'box';
      // the curls bounce a little when he starts / stops
      const acc = s.acc || 0;
      hairV += (-hairP * 90 - hairV * 9 + acc * 0.9) * dt; hairP += hairV * dt;
      hairVz += (-hairPz * 90 - hairVz * 9) * dt; hairPz += hairVz * dt;
      bones.hair.rotation.set(clamp(hairP, -0.012, 0.012), 0, clamp(hairPz, -0.008, 0.008)); // (the whole hair mesh turns as one piece, so it must stay tiny or it reads as a wig)
    },
    dispose() { skeleton.dispose(); disposables.forEach((d) => d.dispose && d.dispose()); },
  };
  return api;
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export { BODY_SCALE };
