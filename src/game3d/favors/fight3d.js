// "Ori, Can You...?" — THE RING in the street (three.js): a boxing ring on the court with a crowd that grows with the neighbourhood's love, and the fight mode
// that plays a bout (boxing.js) on it: the two fighters (Ori in his southpaw guard, the opponent a person from the cast), the animations that follow the sim,
// the hit-stop, the shakes, the sparks, the glitch of the hidden boss, the fight camera, the keys. The sim is pure and tested on its own; this file only shows it.
import * as THREE from 'three';
import { createPerson } from './people/person.js';
import { GESTURES } from './people/anim.js';
import { speaker } from './dialogue/cast.js';
import { createBout, RING } from './boxing.js';
import { createFightSfx } from './fight-sfx.js';
import { withCaptions } from './captions.js';
import { createFightMusic } from './fight-music.js';
import { createFightUi } from './fight-ui.js';
import { createFightTouch } from './fight-touch.js';
import { floatFor, floatWord } from './fight-floats.js';
import { createBagStage, FIST_LAG, BAG_Z } from './bag3d.js';
import { createBagRun, BAG } from './training.js';
import { TEXT } from './texts.js';
import { box } from './collide.js';

const PEAK = { jab: 0.4, cross: 0.5, hook: 0.55, upper: 0.6 }; // where in a punch's animation the fist lands
const WEIGHT = { jab: 0.45, cross: 0.8, hook: 0.95, upper: 1 }; // how heavy a punch sounds in the air (the whoosh of fight-sfx.js)
const PLATFORM = 0.6; // the ring floor above the court
const HALF_PLATFORM = 3.78;
const FALL = 0.75;
const RISE = 0.8; // (a fighter who was knocked down gets up over this long)
const HEAD_Y = 0.05; // the numbers float up from this far over the head of a fighter
const BAG_INTRO = 2.6; // seconds from the bell to GO in the speed-bag drill (three clicks, then GO is the fourth)
const BAG_ORI_Z = 0.3; // where Ori stands for the drill (the bag hangs on the other side of the middle of the ring, 0.64 m from him)
const GRADE_POWER = { perfect: 1, good: 0.7, ok: 0.45 };

const tex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function peachPath(g, x, y, r) {
  g.beginPath();
  g.arc(x - r * 0.28, y, r * 0.78, Math.PI * 0.55, Math.PI * 1.9);
  g.arc(x + r * 0.28, y, r * 0.78, Math.PI * 1.1, Math.PI * 0.45);
  g.closePath();
}

/** The ring: platform with canvas floor and apron, four posts with pads, three ropes a side, steps, floodlights and banners. */
function buildRing({ shadows }) {
  const group = new THREE.Group();
  group.name = 'the-ring';
  const own = [];
  const keep = (o) => { own.push(o); return o; };
  const floorTex = keep(tex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#f2ecdf'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e5484d'; g.fillRect(0, 0, w, 54); g.fillRect(0, h - 54, w, 54);
    g.fillStyle = '#3f7fe0'; g.fillRect(0, 0, 54, h); g.fillRect(w - 54, 0, 54, h);
    g.fillStyle = '#f2ecdf'; g.fillRect(40, 40, w - 80, h - 80);
    g.strokeStyle = '#1d1d24'; g.lineWidth = 6; g.strokeRect(40, 40, w - 80, h - 80);
    g.fillStyle = '#ff9f5b'; peachPath(g, w / 2, h / 2 + 14, 250); g.fill();
    g.strokeStyle = 'rgba(30,20,10,0.4)'; g.lineWidth = 7; g.beginPath(); g.moveTo(w / 2, h / 2 - 150); g.bezierCurveTo(w / 2 - 36, h / 2 - 20, w / 2 - 36, h / 2 + 80, w / 2, h / 2 + 200); g.stroke();
    g.fillStyle = '#58b35b'; g.beginPath(); g.ellipse(w / 2 + 60, h / 2 - 230, 90, 34, -0.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(40,30,20,0.6)'; g.font = '800 70px Inter, system-ui, sans-serif'; g.textAlign = 'center';
    g.fillText('THE RING', w / 2, 150); g.save(); g.translate(w / 2, h - 90); g.rotate(Math.PI); g.fillText('THE RING', 0, 0); g.restore();
  }));
  const apronTex = keep(tex(1024, 128, (g, w, h) => {
    g.fillStyle = '#1f2a4a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ff9f5b'; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10);
    g.fillStyle = '#fff'; g.font = '800 64px Inter, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('PEACH FIGHT NIGHT', w / 2, h / 2 + 4);
  }));
  const mats = {
    floor: keep(new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85 })),
    apron: keep(new THREE.MeshStandardMaterial({ map: apronTex, roughness: 0.8 })),
    post: keep(new THREE.MeshStandardMaterial({ color: 0x2b2f3a, roughness: 0.5, metalness: 0.4 })),
    red: keep(new THREE.MeshStandardMaterial({ color: 0xe5484d, roughness: 0.55 })),
    blue: keep(new THREE.MeshStandardMaterial({ color: 0x3f7fe0, roughness: 0.55 })),
    white: keep(new THREE.MeshStandardMaterial({ color: 0xf4f4f6, roughness: 0.55 })),
    rope: [0xe5484d, 0xf4f4f6, 0x3f7fe0].map((c) => keep(new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }))),
    lamp: keep(new THREE.MeshStandardMaterial({ color: 0xfff3d6, emissive: 0xffe2a0, emissiveIntensity: 2.2 })),
    dark: keep(new THREE.MeshStandardMaterial({ color: 0x3a3f4c, roughness: 0.7 })),
  };
  const geo = (g) => keep(g);
  // the platform
  const apron = new THREE.Mesh(geo(new THREE.BoxGeometry(HALF_PLATFORM * 2, PLATFORM, HALF_PLATFORM * 2)), [mats.apron, mats.apron, mats.floor, mats.apron, mats.apron, mats.apron]);
  apron.position.y = PLATFORM / 2;
  apron.castShadow = shadows; apron.receiveShadow = true;
  group.add(apron);
  // posts + pads + ropes
  const C = RING.half + 0.22;
  const colours = [mats.red, mats.blue, mats.white, mats.white];
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz], i) => {
    const post = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.1, 0.11, 1.75, 14)), mats.post);
    post.position.set(sx * C, PLATFORM + 0.875, sz * C); post.castShadow = shadows;
    const pad = new THREE.Mesh(geo(new THREE.BoxGeometry(0.34, 1.0, 0.34)), colours[i]);
    pad.position.set(sx * C, PLATFORM + 0.95, sz * C);
    group.add(post, pad);
  });
  const ropeGeo = geo(new THREE.CylinderGeometry(0.032, 0.032, C * 2, 8));
  for (let r = 0; r < 3; r++) {
    const y = PLATFORM + 0.5 + r * 0.4;
    for (const [axis, s] of [['x', -1], ['x', 1], ['z', -1], ['z', 1]]) {
      const m = new THREE.Mesh(ropeGeo, mats.rope[r]);
      if (axis === 'x') { m.rotation.z = Math.PI / 2; m.position.set(0, y, s * C); } else { m.rotation.x = Math.PI / 2; m.position.set(s * C, y, 0); }
      group.add(m);
    }
  }
  // steps on the south side
  for (let i = 0; i < 3; i++) {
    const st = new THREE.Mesh(geo(new THREE.BoxGeometry(2.0, 0.2 * (3 - i), 0.5)), mats.dark);
    st.position.set(0, 0.1 * (3 - i), HALF_PLATFORM + 0.25 + i * 0.5);
    st.castShadow = shadows; st.receiveShadow = true;
    group.add(st);
  }
  // floodlights on four poles
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const pole = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.07, 0.09, 6.4, 8)), mats.post);
    pole.position.set(sx * 5.4, 3.2, sz * 5.4);
    const head = new THREE.Mesh(geo(new THREE.BoxGeometry(0.9, 0.4, 0.5)), mats.lamp);
    head.position.set(sx * 5.4, 6.5, sz * 5.4); head.lookAt(0, 1.5, 0);
    group.add(pole, head);
  }
  // a banner across the north side
  const banner = new THREE.Mesh(geo(new THREE.PlaneGeometry(9, 1.5)), keep(new THREE.MeshStandardMaterial({
    map: keep(tex(1536, 256, (g, w, h) => { g.fillStyle = '#1f2a4a'; g.fillRect(0, 0, w, h); g.fillStyle = '#ff9f5b'; g.fillRect(0, 0, w, 14); g.fillRect(0, h - 14, w, 14); g.fillStyle = '#fff'; g.font = '900 150px Inter, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('FIGHT NIGHT', w / 2, h / 2 + 8); })), roughness: 0.9, side: THREE.DoubleSide,
  })));
  banner.position.set(0, 3.9, -5.6);
  group.add(banner);
  return { group, own };
}

/** Spectators round the ring: capsules with a head, in rows; how many stand there depends on the love. Instanced (two draw calls). */
function buildCrowd() {
  const MAX = 40;
  const body = new THREE.CapsuleGeometry(0.22, 0.55, 4, 8);
  const head = new THREE.SphereGeometry(0.17, 10, 8);
  const bm = new THREE.MeshStandardMaterial({ roughness: 0.8 });
  const hm = new THREE.MeshStandardMaterial({ roughness: 0.7 });
  const bodies = new THREE.InstancedMesh(body, bm, MAX);
  const heads = new THREE.InstancedMesh(head, hm, MAX);
  bodies.frustumCulled = false; heads.frustumCulled = false;
  const shirts = [0xe5625e, 0x4a90e2, 0xf2c14e, 0x43b581, 0xb07ad8, 0xff9a62, 0x2fb8d8, 0xf3efe7, 0xc46a8a, 0x7d8f69];
  const skins = [0xf1cba5, 0xe3b58c, 0xcf9770, 0xb57a53, 0x8b5a3c, 0x5e3a28];
  const slots = [];
  // two rows on the three sides the camera does not look from, and a few on the fourth
  let n = 0;
  for (let row = 0; row < 3 && n < MAX; row++) {
    const r = 5.3 + row * 1.05;
    const count = [14, 13, 13][row];
    for (let i = 0; i < count && n < MAX; i++) {
      const a = (i / count) * Math.PI * 2 + row * 0.19;
      slots.push({ x: Math.sin(a) * r * 1.0, z: Math.cos(a) * r * 0.78, ph: Math.random() * 6.28, a: Math.atan2(-Math.sin(a), -Math.cos(a)) });
      const c = new THREE.Color(shirts[(n * 7 + row) % shirts.length]);
      bodies.setColorAt(n, c);
      heads.setColorAt(n, new THREE.Color(skins[(n * 5 + 1) % skins.length]));
      n++;
    }
  }
  const dummy = new THREE.Object3D();
  let shown = 0;
  let cheer = 0;
  return {
    bodies, heads, own: [body, head, bm, hm],
    setCount(c) { shown = Math.max(0, Math.min(slots.length, c)); },
    cheer(k = 1) { cheer = Math.min(1.5, cheer + k); },
    update(dt, t, baseY, cam = null) {
      cheer = Math.max(0, cheer - dt * 0.9);
      bodies.count = shown; heads.count = shown;
      for (let i = 0; i < shown; i++) {
        const s = slots[i];
        const jump = Math.abs(Math.sin(t * 6 + s.ph)) * 0.18 * cheer + Math.sin(t * 1.3 + s.ph) * 0.012;
        const near = cam && Math.hypot(cam.x - s.x, cam.z - s.z) < 3.4 ? 0.001 : 1; // (somebody in front of the lens steps aside)
        dummy.position.set(s.x, baseY + 0.5 + jump, s.z); dummy.rotation.set(0, s.a, 0); dummy.scale.set(near, near * (1 + 0.06 * cheer * Math.sin(t * 9 + s.ph)), near);
        dummy.updateMatrix(); bodies.setMatrixAt(i, dummy.matrix);
        dummy.position.set(s.x, baseY + 1.2 + jump, s.z); dummy.scale.set(near, near, near); dummy.updateMatrix(); heads.setMatrixAt(i, dummy.matrix);
      }
      bodies.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true;
    },
  };
}

const starTex = () => tex(64, 64, (g) => {
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,214,120,0.95)'); gr.addColorStop(1, 'rgba(255,140,60,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
});

/**
 * A tall soft column of light over the ring with a floating "THE RING" sign: the landmark that can be seen from anywhere in the neighbourhood (it is off while a fight
 * is on, and it is the way to find the ring on a first walk).
 */
function buildBeacon() {
  const group = new THREE.Group();
  const cv = document.createElement('canvas'); cv.width = 8; cv.height = 256;
  const c = cv.getContext('2d');
  const gr = c.createLinearGradient(0, 256, 0, 0);
  gr.addColorStop(0, 'rgba(255,150,70,0.95)'); gr.addColorStop(0.3, 'rgba(255,150,80,0.5)'); gr.addColorStop(1, 'rgba(255,170,100,0)');
  c.fillStyle = gr; c.fillRect(0, 0, 8, 256);
  const colTex = new THREE.CanvasTexture(cv); colTex.colorSpace = THREE.SRGBColorSpace;
  const colMat = new THREE.MeshBasicMaterial({ map: colTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false, opacity: 0.5 });
  const colGeo = new THREE.CylinderGeometry(1.2, 2.6, 46, 20, 1, true);
  const col = new THREE.Mesh(colGeo, colMat);
  col.position.y = 23; col.renderOrder = 5; col.frustumCulled = false;
  group.add(col);
  const sv = document.createElement('canvas'); sv.width = 512; sv.height = 160;
  const x = sv.getContext('2d');
  x.fillStyle = 'rgba(28,20,24,0.9)'; x.beginPath(); x.roundRect(10, 10, 492, 140, 36); x.fill();
  x.strokeStyle = '#ff9f5b'; x.lineWidth = 8; x.stroke();
  x.fillStyle = '#ffffff'; x.font = '900 92px Inter, system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('THE RING', 256, 84);
  const signTex = new THREE.CanvasTexture(sv); signTex.colorSpace = THREE.SRGBColorSpace;
  const signMat = new THREE.SpriteMaterial({ map: signTex, transparent: true, depthWrite: false, fog: false, toneMapped: false });
  const sign = new THREE.Sprite(signMat);
  sign.scale.set(9, 2.8, 1); sign.position.y = 12.5; sign.renderOrder = 6;
  group.add(sign);
  return {
    group,
    /** t seconds, show: no fight is on, night 0..1 (a little stronger in the dark). */
    update(t, show, night) { group.visible = show; if (!show) return; colMat.opacity = 0.42 + 0.08 * Math.sin(t * 2) + 0.12 * night; sign.position.y = 12.5 + Math.sin(t * 1.3) * 0.25; },
    dispose() { colGeo.dispose(); colMat.dispose(); colTex.dispose(); signMat.dispose(); signTex.dispose(); },
  };
}

/**
 * @param {{ scene: THREE.Scene, map: object, tier: string, shadows: boolean, overlay: HTMLElement, getOri: () => object, groundAt: (x:number,z:number)=>number,
 *   setCamera: (cfg: object|null) => void, setFade: (a:number) => void, isMuted?: () => boolean, volume?: () => number, reduceMotion?: () => boolean, getLove: () => number, getLevel: () => number }} o
 */
export function createFightMode(o) {
  const { scene, map, tier, shadows, overlay, getOri, groundAt, setCamera, setFade } = o;
  const sfx = withCaptions(createFightSfx({ isMuted: o.isMuted, volume: o.volume }), 'ring', (t) => { if (o.caption) o.caption(t); }); // (the same call that makes a sound says its words, when the player asked for captions)
  let lastUpdate = performance.now(); // (the game stops calling update() when it is paused: the music notices and goes quiet)
  const music = createFightMusic({ audio: sfx.audio, active: () => performance.now() - lastUpdate < 500 });
  const calm = () => !!(o.reduceMotion && o.reduceMotion()); // reduce motion (T05): no shake, no hit-stop, no flashes, no swoop or spin of the camera, no zoom of the words
  const ui = createFightUi({ root: overlay });
  // the touch buttons do what the keys do (they are only on screen on a touch device)
  const stick = { x: 0, y: 0 };
  let touchGuard = false;
  const live = () => phase === 'fight' || phase === 'intro';
  const touch = createFightTouch({
    root: overlay,
    onJab: () => { if (live()) pend.jab = true; },
    onCross: () => { if (live()) pend.cross = true; },
    onDash: () => { if (live()) pend.dash = true; },
    onFury: () => { if (live()) pend.fury = true; },
    onGuard: (on) => { touchGuard = on; },
    onStick: (x, y) => { stick.x = x; stick.y = y; },
  });
  const rect = map.zones.court;
  const cx = (rect.x0 + rect.x1) / 2;
  const cz = (rect.z0 + rect.z1) / 2;
  const base = groundAt(cx, cz);
  const floorY = base + PLATFORM;

  // the ring is part of the street: built once, with a solid platform
  const ring = buildRing({ shadows });
  ring.group.position.set(cx, base, cz);
  const spot = new THREE.SpotLight(0xfff0d0, 0, 22, 0.75, 0.5, 1.4);
  spot.position.set(cx, base + 8, cz); spot.target.position.set(cx, floorY, cz);
  scene.add(ring.group, spot, spot.target);
  const beacon = buildBeacon();
  beacon.group.position.set(cx, base, cz);
  scene.add(beacon.group);
  map.world.addDynamic(box(cx - HALF_PLATFORM, cz - HALF_PLATFORM, cx + HALF_PLATFORM, cz + HALF_PLATFORM));
  const crowd = buildCrowd();
  crowd.bodies.position.set(cx, 0, cz); crowd.heads.position.set(cx, 0, cz);
  scene.add(crowd.bodies, crowd.heads);
  crowd.setCount(Math.floor(6 + (o.getLove ? o.getLove() : 0) * 0.3));

  // little effects: sparks on a hit, the boss's afterimages and pixels
  const sTex = starTex();
  const sparks = Array.from({ length: 10 }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })); s.visible = false; s.userData = { t: 0, life: 0.3, size: 1 }; scene.add(s); return s; });
  const ghostGeo = new THREE.CapsuleGeometry(0.3, 1.0, 4, 10);
  const ghosts = Array.from({ length: 4 }, () => { const m = new THREE.Mesh(ghostGeo, new THREE.MeshBasicMaterial({ color: 0x2fe0ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); m.visible = false; m.userData = { t: 0 }; scene.add(m); return m; });
  const pixelGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  const pixels = new THREE.InstancedMesh(pixelGeo, new THREE.MeshBasicMaterial({ color: 0x7ff0ff, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }), 40);
  pixels.frustumCulled = false; pixels.count = 0; scene.add(pixels);
  const pix = [];
  const dummy = new THREE.Object3D();

  // ── state ──
  let phase = 'off'; // off | fade | intro | fight | result | leaving
  let bout = null;
  let opp = null; // the opponent definition
  let foe = null; // { person, group }
  let me = null; // { person }
  let timeT = 0;
  let hitStop = 0;
  let shake = 0;
  let camPos = null;
  let camLook = null;
  let side = { x: 1, z: 0 }; // which side of the ring the camera stands on (one of the four middles: never a corner)
  let camRel = null; // where the camera is, relative to the middle of the ring (for the crowd)
  let held = new Set();
  const pend = { jab: false, cross: false, dash: false, fury: false };
  let koT = [0, 0];
  let upT = [0, 0]; // the time left of a get-up (Ori, the opponent)
  let introStage = 0;
  let phaseT = 0;
  let pending = null; // what to do when the fade is black
  let onEnd = null;
  let lastNight = 0;
  let bossIntro = false;
  let winPlayed = 0;
  let cb = {};
  const names = { me: 'Ori', foe: '', title: '' };
  // the speed-bag drill (training.js): the bag and its stand are made the first time they are needed
  let mode = 'bout'; // 'bout' (a fight) | 'bag' (the drill)
  let run = null;
  let stage = null;
  let clicks = 0;
  let hinted = false;
  let overT = 0;
  const contacts = []; // gloves on their way to the bag: { at, grade, power }
  const pv = new THREE.Vector3();

  function key(e) {
    if (ui.key(e)) return true; // the cards (the choice of fight, the result)
    if (phase === 'off') return false;
    const c = e.code;
    if (c === 'Escape') return false; // the pause menu
    if (phase !== 'fight' && phase !== 'intro') return true;
    if (!e.repeat) {
      if (c === 'KeyJ' || c === 'KeyZ') pend.jab = true;
      else if (c === 'KeyK' || c === 'KeyX') pend.cross = true;
      else if (c === 'Space') pend.dash = true;
      else if (c === 'KeyF') pend.fury = true;
    }
    held.add(c);
    return true;
  }
  const onUp = (e) => { held.delete(e.code); };
  const onBlur = () => { held.clear(); };
  window.addEventListener('keyup', onUp, true);
  window.addEventListener('blur', onBlur);

  function wish() {
    // the keys are the screen's: right is screen right, W is into the screen
    const rx = side.z; const rz = -side.x; // screen right
    const adv = Math.max(-1, Math.min(1, (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0) + stick.x));
    const into = Math.max(-1, Math.min(1, (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0) - (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0) + stick.y));
    return { mx: rx * adv - side.x * into, mz: rz * adv - side.z * into };
  }

  // ── the people ──
  function makeOpponent(def) {
    const spec = JSON.parse(JSON.stringify(speaker(def.cast).spec));
    const person = createPerson(spec, { shadows, tier, quality: tier === 'low' ? 0.45 : tier === 'medium' ? 0.65 : 0.85, outline: tier !== 'low' });
    person.group.name = `fighter-${def.id}`;
    person.group.rotation.order = 'YXZ'; // (a fall tips him about his own x axis, after the turn)
    scene.add(person.group);
    person.hold('guard');
    return { person, group: person.group };
  }
  function disposeOpponent() {
    if (!foe) return;
    scene.remove(foe.group);
    foe.person.dispose();
    foe = null;
  }

  /** Opens the ring: fade to black, put everybody in place, the bell. */
  let tipFlags = {}; // what the player has been told already (kept in the save)
  function start(def, { level = 1, boss = false, seed = 1, done, tips = null, buff = null, hpFrac = 1, round = 'ROUND 1' } = {}) {
    tipFlags = tips || {};
    ui.setCalm(calm());
    if (phase !== 'off' && phase !== 'leaving') return false;
    opp = def; onEnd = done || null; bossIntro = boss || !!def.hidden;
    phase = 'fade'; phaseT = 0;
    pending = () => {
      const ori = getOri();
      foe = makeOpponent(def);
      bout = createBout({ level, opp: def, seed, intro: bossIntro ? 3.6 : 2.6, buff, hpFrac });
      me = { person: ori.person };
      ori.setMirror(true); ori.hold('guard'); ori.group.rotation.order = 'YXZ';
      names.me = 'Ori'; names.level = level; names.foe = def.name; names.title = def.title; names.fury = !!bout.P.unlocks.fury;
      ui.show(bout, names); ui.setRound(round);
      mode = 'bout'; run = null;
      side = { x: 1, z: 0 }; koT = [0, 0]; upT = [0, 0]; introStage = 0; timeT = 0; winPlayed = 0; shake = 0; hitStop = 0; camPos = null; camLook = null;
      pend.jab = pend.cross = pend.dash = pend.fury = false; held = new Set(); stick.x = stick.y = 0; touchGuard = false;
      touch.show({ mode: 'bout', fury: names.fury }); ui.setTouch(touch.visible);
      spot.intensity = bossIntro ? 10 : 55;
      crowd.setCount(Math.floor(6 + (o.getLove ? o.getLove() : 0) * 0.3));
      phase = 'intro'; phaseT = 0;
    };
    return true;
  }

  function end() {
    // back to the street: Ori stands at the foot of the steps
    const ori = getOri();
    ori.setMirror(false); ori.hold(null); ori.force(null);
    ori.group.rotation.set(0, ori.group.rotation.y, 0); ori.group.rotation.order = 'XYZ';
    ui.hide(); ui.closeMenu(false);
    music.stop({ fade: 0.3 }); sfx.crowdStop(); sfx.setSlow(false);
    touch.hide(); ui.setTouch(false);
    if (stage) stage.show(false);
    run = null; contacts.length = 0; mode = 'bout'; stick.x = stick.y = 0; touchGuard = false;
    disposeOpponent();
    for (const s of sparks) s.visible = false;
    for (const gh of ghosts) gh.visible = false;
    pixels.count = 0; pix.length = 0;
    spot.intensity = 0;
    setCamera(null);
    bout = null;
    phase = 'leaving'; phaseT = 0;
    const cbk = onEnd; onEnd = null;
    if (cb.leave) cb.leave();
    if (cbk) cbk();
  }

  // ── events of the sim -> animations, sounds, effects ──
  /** The held pose of a fighter: the guard, the block when his guard is up, lying when he is down. */
  const tiredNow = new WeakMap();
  /** Out of breath (with a margin so it does not flicker at the edge): the bar is nearly empty until it has filled a third again. */
  const isTired = (f) => { const was = tiredNow.get(f) || false; const now = was ? f.st < f.maxSt * 0.32 : f.st < f.maxSt * 0.15; tiredNow.set(f, now); return now; };
  const holdFor = (f) => (f.state === 'ko' || f.state === 'down' ? 'ko' : f.state === 'win' ? null : f.blocking ? 'block' : isTired(f) ? 'tired' : 'guard');
  /** How far down a fighter is (0 standing .. 1 flat on the canvas): the fall eases in; after a knock-down the get-up eases out. */
  function fallOf(f, i, dt) {
    if (f.state === 'ko' || f.state === 'down') { upT[i] = 0; return 1 - (1 - Math.min(1, (koT[i] += dt) / FALL)) ** 2; }
    if (upT[i] > 0) { upT[i] = Math.max(0, upT[i] - dt); const u = upT[i] / RISE; if (upT[i] === 0) koT[i] = 0; return u * u * (3 - 2 * u); }
    koT[i] = 0; return 0;
  }
  /** Where a fighter moves, relative to the way he faces: { fwd, side } (side > 0 = to his right): the footwork. */
  const fwOf = (f) => (f.moving ? { fwd: f.mdx * Math.sin(f.face) + f.mdz * Math.cos(f.face), side: -f.mdx * Math.cos(f.face) + f.mdz * Math.sin(f.face) } : { fwd: 0, side: 0 });
  const fighterOf = (who) => (who === 'player' ? { person: me.person, f: bout.P, i: 0 } : { person: foe.person, f: bout.O, i: 1 });
  function spark(x, y, z, size = 1.2, life = 0.3) {
    const s = sparks.find((q) => !q.visible) || sparks[0];
    s.position.set(x, y, z); s.userData = { t: 0, life, size }; s.visible = true; s.material.opacity = 1; s.scale.setScalar(size * 0.3);
  }
  function ghost(x, z) {
    const g = ghosts.find((q) => !q.visible) || ghosts[0];
    g.position.set(cx + x, floorY + 0.95, cz + z); g.userData.t = 0; g.visible = true; g.material.opacity = 0.7;
    for (let k = 0; k < 14; k++) pix.push({ x: cx + x, y: floorY + 0.2 + Math.random() * 1.6, z: cz + z, vx: (Math.random() - 0.5) * 2.2, vy: Math.random() * 1.6, vz: (Math.random() - 0.5) * 2.2, t: 0 });
  }
  /** A number floats up over whoever the event is about (white hit, gold counter / perfect dodge, small grey block). */
  function floatEvent(e) {
    const f = floatFor(e);
    if (!f) return;
    const w = f.who === 'player' ? bout.P : bout.O;
    const who = f.who === 'player' ? me.person : foe.person;
    ui.floatAt(f, cx + w.x, floorY + (who.headHeight - 0.1) * who.group.scale.y + HEAD_Y, cz + w.z); // (just over his head, whatever his height)
  }
  function onEvent(e) {
    switch (e.type) {
      case 'swing': {
        const a = fighterOf(e.who);
        const D = e.wind / (PEAK[e.move] || 0.45);
        a.person.play(e.move, (GESTURES[e.move] || 0.4) / D);
        sfx.whoosh(e.wind, WEIGHT[e.move] ?? 0.6, e.who === 'player');
        if (e.who === 'opp' && phase === 'fight' && !tipFlags.wind) { tipFlags.wind = true; ui.subWord(touch.visible ? TEXT.tipWindTouch : 'Watch the wind-up: Space dashes through a punch, hold L guards it', 3400); }
        break;
      }
      case 'hit': {
        const t = fighterOf(e.target);
        { const amp = Math.min(1.8, 0.75 + e.dmg / 16); if (e.move === 'hook' || e.move === 'upper' || e.counter) t.person.play('stagger', 1.0, amp); else t.person.play('hit', 1.15, amp); } // (a jab flinches him, a heavy punch makes him reel)
        t.person.face.react('wince', 0.3); // the "oof"
        floatEvent(e);
        const x = cx + t.f.x; const z = cz + t.f.z;
        spark(x, floorY + 1.35, z, e.heavy ? 1.9 : 1.2);
        sfx.thud(e);
        shake = Math.min(0.5, shake + (e.heavy ? 0.28 : 0.13));
        hitStop = calm() ? 0 : e.heavy ? 0.085 : 0.045;
        if (e.target === 'player') { ui.flash('hurt'); crowd.cheer(0.3); sfx.gasp(0.7); } else { crowd.cheer(0.5); if (e.heavy || e.counter) sfx.gasp(e.counter ? 1 : 0.5); }
        if (e.counter) ui.bigWord('COUNTER!', 'good', 700);
        else if (e.who === 'player' && e.combo >= 4 && e.combo % 2 === 0) ui.subWord(`${e.combo} hit combo!`, 900);
        break;
      }
      case 'block': { const t = fighterOf(e.who); t.person.play('blockhit', 1.0); t.person.face.react('determined', 0.4); floatEvent(e); sfx.block(e.dmg); spark(cx + t.f.x, floorY + 1.3, cz + t.f.z, 0.8, 0.2); shake = Math.min(0.5, shake + 0.06); break; }
      case 'parry': { sfx.parry(); ui.bigWord('PARRY!', 'cyan', 700); ui.flash('perfect'); const t = fighterOf(e.who); spark(cx + t.f.x, floorY + 1.4, cz + t.f.z, 1.6, 0.35); shake = Math.min(0.5, shake + 0.12); fighterOf(e.by).person.play('hit', 1.2); fighterOf(e.by).person.face.react('wince', 0.3); fighterOf(e.who).person.face.react('determined', 0.5); break; }
      case 'perfect': ui.bigWord('PERFECT!', 'cyan', 800); ui.flash('perfect'); floatEvent(e); sfx.perfect(); crowd.cheer(0.8); break;
      case 'dash': { // a slip to the side, a step back or a lunge through: the body does what the sim did
        const a = fighterOf(e.who);
        let name = 'dodgeB';
        if (e.dir) {
          const fx = Math.sin(a.f.face); const fz = Math.cos(a.f.face);
          const fwd = e.dir[0] * fx + e.dir[1] * fz; const side = -e.dir[0] * fz + e.dir[1] * fx; // side > 0: to his right
          if (Math.abs(side) > Math.abs(fwd) * 0.8) name = (side > 0) !== (e.who === 'player') ? 'dodgeR' : 'dodgeL'; // (Ori is a southpaw: his poses are mirrored, so the names swap)
          else name = fwd < 0 ? 'dodgeB' : 'dodge';
        }
        a.person.play(name, 1.2); sfx.dash(); break;
      }
      case 'feint': fighterOf(e.who).person.play('dodgeB', 1.8); sfx.feint(); break; // (the punch was a fake: he snaps back out of it)
      case 'blink': { sfx.blink(); ghost(e.from[0], e.from[1]); break; }
      case 'guardbreak': sfx.guardbreak(); fighterOf(e.who).person.play('stagger', 0.9, 1.3); if (e.who === 'player') ui.subWord('Guard broken!', 900); else ui.subWord('His guard is broken - hit him!', 1200); break;
      case 'lag': sfx.lag(); ui.subWord('He is buffering... hit him!', 1500); break;
      case 'fury': ui.bigWord('PEACH FURY!', '', 900); sfx.fury(); break;
      case 'knockdown': { sfx.knockdown(e.who); music.pause(true); sfx.gasp(1); fighterOf(e.who).person.play('ko', 1.0); ui.bigWord('DOWN!', 'red', 1100); ui.flash('ko'); shake = 0.45; crowd.cheer(1.0); if (e.who === 'player') ui.subWord('Mash J / K to get up!', 2800); else ui.subWord('Count with the referee... he may get up', 2000); break; }
      case 'count': sfx.count(e.n); ui.bigWord(String(e.n), e.who === 'player' ? 'red' : 'good', 650); break;
      case 'getup': { sfx.getup(e.who); music.pause(false); upT[e.who === 'player' ? 0 : 1] = RISE; ui.bigWord(e.who === 'player' ? 'UP!' : 'HE IS UP!', e.who === 'player' ? 'good' : '', 800); break; }
      case 'ko': { if (!e.fromDown) fighterOf(e.who).person.play('ko', 1.0); sfx.ko(e.who); music.stop({ fade: 0.08 }); music.sting(e.who === 'opp' ? (opp && opp.hidden ? 'boss' : 'win') : 'lose', 1.6); if (e.who === 'opp') sfx.cheer(1.4, 1.0); ui.bigWord('K.O.!', 'red', 1700); ui.flash('ko'); shake = 0.6; crowd.cheer(1.4); break; }
      case 'over': if (e.how === 'time') { ui.bigWord(e.winner === 'player' ? 'YOU WIN!' : e.winner === 'opp' ? 'TIME!' : 'DRAW', e.winner === 'player' ? 'good' : '', 1500); sfx.bell(3); music.stop({ fade: 0.15 }); music.sting(e.winner === 'player' ? (opp && opp.hidden ? 'boss' : 'win') : 'lose', 1.0); if (e.winner === 'player') sfx.cheer(1, 0.6); } break;
      case 'tired': ui.subWord('Catch your breath!', 700); if (!tipFlags.tired) { tipFlags.tired = true; ui.subWord('Out of breath: your punches are slower and softer until you rest. Landing a punch or a parry gives breath back', 3600); } break;
      default: break;
    }
  }

  // ── the camera: beside the ring, Ori on the left; it follows the middle of the fight and pushes in on a heavy punch ──
  function camera(dt) {
    const P = bout.P; const O = bout.O;
    let ax = O.x - P.x; let az = O.z - P.z; const sep = Math.hypot(ax, az) || 1; ax /= sep; az /= sep;
    const rx = -az; const rz = ax; // Ori's right: the camera stands about there, on the nearest middle of a side of the ring
    const cardinal = (vx, vz) => (Math.abs(vx) > Math.abs(vz) ? { x: Math.sign(vx), z: 0 } : { x: 0, z: Math.sign(vz) });
    if (side.x * rx + side.z * rz < 0.4) side = cardinal(rx, rz); // (only when the fight has turned a lot)
    const mx = cx + (P.x + O.x) / 2; const mz = cz + (P.z + O.z) / 2;
    const aspect = Math.max(0.3, (overlay && overlay.clientWidth ? overlay.clientWidth / Math.max(1, overlay.clientHeight) : window.innerWidth / Math.max(1, window.innerHeight)));
    const baseDist = 5.4 + sep * 0.45;
    const dist = Math.min(13, Math.max(baseDist, (sep + 2.6) / (2 * Math.tan((40 * Math.PI) / 360) * aspect))); // (a narrow window sees little sideways: stand back until both fit across it; a wide screen is not touched)
    const want = new THREE.Vector3(mx + side.x * dist, floorY + 2.5 + sep * 0.1 + (dist - baseDist) * 0.22, mz + side.z * dist);
    const look = new THREE.Vector3(mx, floorY + 0.95, mz);
    let fov = 40;
    const introK = bout.time < bout.intro && !calm() ? 1 - smooth(0, bout.intro, bout.time) : 0;
    if (introK > 0) { // a swoop in from above and in front of the opponent
      const sx = mx + side.x * dist * 1.5 - ax * 3.2 * introK; const sz = mz + side.z * dist * 1.5 - az * 3.2 * introK;
      want.lerp(new THREE.Vector3(sx, floorY + 3.4, sz), introK * introK);
      fov = 40 + 6 * introK;
    }
    if (bout.over) { // first the whole ring (to watch him fall), then the winner in close up, slowly turning
      const w = bout.result && bout.result.winner === 'opp' ? O : P;
      const t = bout.over_t;
      const k2 = smooth(1.3, 2.6, t);
      const spin = calm() ? 0 : t * 0.5; // (the slow turn round the winner stands still)
      const close = new THREE.Vector3(cx + w.x + Math.sin(spin + (w === O ? 0 : 2)) * 3.4, floorY + 1.6, cz + w.z + Math.cos(spin + (w === O ? 0 : 2)) * 3.4);
      want.lerp(close, k2);
      look.lerp(new THREE.Vector3(cx + w.x, floorY + 1.2, cz + w.z), k2);
      fov = 40 - 2 * k2;
    }
    if (!camPos) { camPos = want.clone(); camLook = look.clone(); }
    const k = 1 - Math.exp(-dt * (introK > 0 ? 8 : 5.5));
    camPos.lerp(want, k); camLook.lerp(look, k);
    camRel = { x: camPos.x - cx, z: camPos.z - cz };
    shake *= Math.exp(-dt * 9);
    const sh = calm() ? 0 : shake * 0.12;
    const pos = [camPos.x + (Math.random() - 0.5) * sh, camPos.y + (Math.random() - 0.5) * sh, camPos.z + (Math.random() - 0.5) * sh];
    setCamera({ pos, look: [camLook.x, camLook.y, camLook.z], fov: fov - (bout.slow > 0 && !calm() ? 6 : 0) + (calm() ? 0 : shake * 4) });
  }

  function update(dt) {
    lastUpdate = performance.now();
    if (phase === 'fadeout') { phaseT += dt; setFade(Math.min(1, phaseT / 0.35)); if (phaseT >= 0.4) end(); return; }
    if (phase === 'off' || phase === 'leaving') { if (phase === 'leaving') { phaseT += dt; setFade(Math.max(0, 1 - phaseT / 0.5)); if (phaseT > 0.5) { phase = 'off'; setFade(0); } } return; }
    phaseT += dt;
    if (phase === 'fade') {
      setFade(Math.min(1, phaseT / 0.35));
      if (phaseT >= 0.4 && pending) { const f = pending; pending = null; f(); }
      return;
    }
    if (mode === 'bag') { if (run) updateBag(dt); return; }
    if (!bout) return;
    timeT += dt;
    if (phase === 'intro' && phaseT < 0.45) setFade(Math.max(0, 1 - phaseT / 0.45));
    // the bell and the words of the start
    if (phase === 'intro') {
      if (introStage === 0 && phaseT > 0.5) { introStage = 1; ui.subWord(`${opp.name} - ${opp.title}`, 1700); if (bossIntro && opp.hidden) { ui.bigWord('???', 'cyan', 1500); sfx.blink(); } else sfx.bell(1); sfx.crowdStart(o.getLove ? o.getLove() : 0); }
      if (introStage === 1 && phaseT > bout.intro - 0.5) { introStage = 2; ui.bigWord('FIGHT!', '', 900); sfx.bell(2); music.start({ boss: bossIntro && !!opp.hidden, intensity: 0.25 }); if (opp.pre) ui.subWord(opp.pre[Math.floor(Math.random() * opp.pre.length)], 2400); }
      if (bout.time >= bout.intro) { phase = 'fight'; phaseT = 0; }
    }
    if (hitStop > 0) { hitStop -= dt; camera(dt); return; }
    const w = phase === 'fight' ? wish() : { mx: 0, mz: 0 };
    const inp = { mx: w.mx, mz: w.mz, jab: pend.jab, cross: pend.cross, dash: pend.dash, fury: pend.fury, block: held.has('KeyL') || held.has('ShiftLeft') || held.has('ShiftRight') || touchGuard };
    pend.jab = pend.cross = pend.dash = pend.fury = false;
    bout.update(dt, phase === 'fight' || phase === 'result' ? inp : {});
    for (const e of bout.drain()) onEvent(e);
    ui.update(bout);
    sfx.setSlow(bout.slow > 0); // (slow motion dulls the mix)
    music.setIntensity(0.3 + 0.5 * (1 - Math.min(bout.P.hp / bout.P.maxHp, bout.O.hp / bout.O.maxHp)) + (bout.timeLeft < 20 ? 0.25 : 0)); // (the music builds as somebody gets hurt and in the last 20 seconds)
    camera(dt);
    if (bout.over && phase !== 'result' && bout.over_t > 2.2) {
      phase = 'result'; phaseT = 0;
      if (cb.result) cb.result(bout.result, opp);
    }
  }

  // ── the speed bag: a 20-second drill in the ring (training.js has the rules, bag3d.js the bag) ──
  /** Opens the ring for the drill: fade to black, the bag and its stand appear, three clicks, GO. */
  function startTraining({ done, tips = null } = {}) {
    tipFlags = tips || {};
    ui.setCalm(calm());
    if (phase !== 'off' && phase !== 'leaving') return false;
    opp = null; onEnd = done || null; bossIntro = false;
    phase = 'fade'; phaseT = 0;
    pending = () => {
      const ori = getOri();
      if (!stage) { stage = createBagStage({ shadows }); stage.group.position.set(cx, floorY, cz); scene.add(stage.group); }
      stage.show(true);
      mode = 'bag'; run = createBagRun(); bout = null;
      me = { person: ori.person };
      ori.setMirror(true); ori.hold('guard'); ori.group.rotation.order = 'YXZ';
      names.me = 'Ori'; names.fury = false;
      ui.showBag(); ui.updateBag(run.view());
      side = { x: 1, z: 0 }; introStage = 0; timeT = 0; shake = 0; hitStop = 0; camPos = null; camLook = null; clicks = 0; hinted = false; overT = 0; contacts.length = 0;
      pend.jab = pend.cross = pend.dash = pend.fury = false; held = new Set(); stick.x = stick.y = 0; touchGuard = false;
      spot.intensity = 55;
      crowd.setCount(Math.floor(6 + (o.getLove ? o.getLove() : 0) * 0.3));
      touch.show({ mode: 'bag' }); ui.setTouch(touch.visible);
      phase = 'intro'; phaseT = 0;
    };
    return true;
  }
  /** A glove goes at the bag: the rules grade it right now, the glove arrives FIST_LAG later (that is when the bag is knocked and the sound comes). */
  function throwBag(hand) {
    const r = run.punch(hand);
    if (!r) return;
    const move = hand === 'J' ? 'jab' : 'cross';
    me.person.play(move, (GESTURES[move] || 0.4) / (FIST_LAG / PEAK[move]));
    ui.bagFlash(r.grade);
    contacts.push({ at: timeT + FIST_LAG, grade: r.grade, power: GRADE_POWER[r.grade] || 0 });
    if (r.grade === 'off') return;
    const c = stage.center;
    const word = r.grade === 'perfect' ? TEXT.bagPerfect : r.grade === 'good' ? TEXT.bagGood : TEXT.bagOk;
    ui.floatAt(floatWord('opp', word, r.grade === 'perfect' ? 'gold' : r.grade === 'good' ? 'white' : 'grey', r.accent ? 1.2 : 0.95, { rise: 0.42, life: 0.7 }), c.x, c.y + 0.3, c.z);
  }
  function updateBag(dt) {
    timeT += dt;
    if (phase === 'intro') {
      if (phaseT < 0.45) setFade(Math.max(0, 1 - phaseT / 0.45));
      if (introStage === 0 && phaseT > 0.5) { introStage = 1; sfx.crowdStart(o.getLove ? o.getLove() : 0); ui.bigWord(TEXT.bagReady, '', 1000); ui.subWord(touch.visible ? TEXT.bagTipTouch : TEXT.bagTip, 3800); }
      const beat = 60 / BAG.bpm[0];
      while (clicks < 4 && phaseT >= BAG_INTRO - (3 - clicks) * beat) { clicks++; sfx.click(clicks === 4); } // (three clicks, and GO is the fourth)
      if (phaseT >= BAG_INTRO) { phase = 'fight'; phaseT = 0; ui.bigWord(TEXT.bagGo, 'good', 700); }
    }
    if (phase === 'fight' || phase === 'result') {
      if (phase === 'fight') {
        run.update(dt);
        if (pend.jab) throwBag('J');
        if (pend.cross) throwBag('K');
        for (const e of run.drain()) {
          if (e.type === 'beat' && e.accent) sfx.click(true);
          else if (e.type === 'over') { overT = 0; ui.bigWord(TEXT.bagTimeUp, '', 1300); sfx.bell(3); if (e.result.stars >= 3) crowd.cheer(1.1); }
        }
        if (run.over) { overT += dt; if (overT > 1.5) { phase = 'result'; phaseT = 0; touch.hide(); ui.setTouch(false); ui.hideBag(); if (cb.train) cb.train({ ...run.result }); } }
      }
    }
    pend.jab = pend.cross = pend.dash = pend.fury = false;
    // the gloves that were thrown a moment ago arrive
    for (let i = contacts.length - 1; i >= 0; i--) {
      const c = contacts[i];
      if (c.at > timeT) continue;
      contacts.splice(i, 1);
      if (c.grade === 'off') { stage.glance(); sfx.bagGlance(); continue; }
      const p = stage.center;
      stage.hit(c.power); sfx.bagHit(c.power);
      spark(p.x, p.y, p.z + 0.16, 0.55 + 0.55 * c.power, 0.18);
      shake = Math.min(0.5, shake + 0.03 + 0.05 * c.power);
      if (c.grade === 'perfect') crowd.cheer(0.1);
    }
    const v = run.view();
    ui.updateBag(v);
    if (!hinted && phase === 'fight' && v.lost >= 3) { hinted = true; ui.subWord(TEXT.bagHint, 2800); }
    cameraBag(dt);
  }
  /** The camera for the drill: beside the ring, Ori on the left, the bag swinging on the right; it steps back until both fit across a narrow window. */
  function cameraBag(dt) {
    const aspect = Math.max(0.3, (overlay && overlay.clientWidth ? overlay.clientWidth / Math.max(1, overlay.clientHeight) : window.innerWidth / Math.max(1, window.innerHeight)));
    const baseDist = 4.8;
    const dist = Math.min(9, Math.max(baseDist, 1.9 / (2 * Math.tan((40 * Math.PI) / 360) * aspect)));
    const zMid = cz + (BAG_ORI_Z + BAG_Z) / 2;
    const want = new THREE.Vector3(cx + dist, floorY + 2.05 + (dist - baseDist) * 0.2, zMid); // (above the top rope, which would cross the picture)
    const look = new THREE.Vector3(cx, floorY + 0.9, zMid);
    let fov = 40;
    const introK = phase === 'intro' && !calm() ? 1 - smooth(0.2, BAG_INTRO - 0.4, phaseT) : 0;
    if (introK > 0) { // a swoop in from above and behind the bag
      want.lerp(new THREE.Vector3(cx + dist * 1.5, floorY + 3.3, zMid - 1.6), introK * introK);
      fov = 40 + 5 * introK;
    }
    if (!camPos) { camPos = want.clone(); camLook = look.clone(); }
    const k = 1 - Math.exp(-dt * (introK > 0 ? 8 : 5.5));
    camPos.lerp(want, k); camLook.lerp(look, k);
    camRel = { x: camPos.x - cx, z: camPos.z - cz };
    shake *= Math.exp(-dt * 9);
    const sh = calm() ? 0 : shake * 0.12;
    setCamera({ pos: [camPos.x + (Math.random() - 0.5) * sh, camPos.y + (Math.random() - 0.5) * sh, camPos.z + (Math.random() - 0.5) * sh], look: [camLook.x, camLook.y, camLook.z], fov: fov + (calm() ? 0 : shake * 3) });
  }
  /** Per frame in the drill: Ori at the bag, the bag on its swivel. */
  function renderBag(dt, t, night) {
    lastNight = night;
    const ori = getOri();
    ori.hold('guard');
    ori.update(dt, { x: cx, z: cz + BAG_ORI_Z, heading: Math.PI, speed: 0, winded: false, sprinting: false }, floorY, 0);
    ori.group.rotation.x = 0;
    let v;
    if (phase === 'intro') { const iv = 60 / BAG.bpm[0]; const u = (phaseT - BAG_INTRO) / iv; v = { phase: u - Math.floor(u), iv, combo: 0, accent: false }; } else v = run.view();
    stage.update(dt, v);
    fx(dt);
    spot.intensity = 30 + 40 * night;
    return true;
  }

  /** The little effects age: sparks, the boss's afterimages, his pixels. */
  function fx(dt) {
    for (const s of sparks) if (s.visible) { s.userData.t += dt; const u = s.userData.t / s.userData.life; if (u >= 1) { s.visible = false; continue; } s.scale.setScalar(s.userData.size * (0.3 + u * 1.2)); s.material.opacity = 1 - u; }
    for (const g of ghosts) if (g.visible) { g.userData.t += dt; const u = g.userData.t / 0.45; if (u >= 1) { g.visible = false; continue; } g.material.opacity = 0.7 * (1 - u); g.scale.set(1 + u * 0.6, 1 + u * 0.15, 1 + u * 0.6); }
    for (let i = pix.length - 1; i >= 0; i--) { const p = pix[i]; p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.t > 0.6) pix.splice(i, 1); }
    pixels.count = Math.min(40, pix.length);
    for (let i = 0; i < pixels.count; i++) { const p = pix[i]; dummy.position.set(p.x, p.y, p.z); dummy.scale.setScalar(1 - p.t / 0.6); dummy.updateMatrix(); pixels.setMatrixAt(i, dummy.matrix); }
    pixels.instanceMatrix.needsUpdate = true;
  }

  const eased = (u) => 1 - (1 - Math.min(1, u)) ** 2;
  /** Per frame, after the sim: puts the two fighters on the ring and animates them. (Replaces ori.update while a fight is on.) */
  function render(dt, t, night = 0) {
    if (phase === 'off' || phase === 'leaving') return false;
    if (mode === 'bag') return run && stage ? renderBag(dt, t, night) : false;
    if (!bout || !foe) return false;
    lastNight = night;
    const ori = getOri();
    const k = bout.slow > 0 ? 0.35 : 1;
    const P = bout.P; const O = bout.O;
    // Ori
    const eP = fallOf(P, 0, dt);
    ori.hold(holdFor(P));
    if (P.blocking) me.person.face.react('determined', 0.15); // (a face set for the blow while the guard is up)
    if (O.blocking) foe.person.face.react('determined', 0.15);
    ori.update(dt * k, { x: cx + P.x, z: cz + P.z, heading: P.face, speed: P.moving * 0.5, winded: false, sprinting: false, fw: fwOf(P) }, floorY, 0);
    ori.group.rotation.x = -eP * 1.5;
    if (eP > 0) ori.group.position.y = floorY + 0.12 * eP;
    if (P.state === 'win' && t - winPlayed > 1.8) { winPlayed = t; ori.play('cheer'); }
    // the opponent
    const eO = fallOf(O, 1, dt);
    foe.group.position.set(cx + O.x, floorY + 0.12 * eO, cz + O.z);
    foe.group.rotation.set(-eO * 1.5, O.face, 0);
    // the boss glitches while he blinks
    const gl = O.blinking > 0 ? Math.sin(t * 90) : 0;
    foe.group.scale.setScalar(O.blinking > 0 ? 1 + gl * 0.03 : 1);
    foe.group.visible = !(O.blinking > 0.2 && Math.sin(t * 70) > 0.6);
    foe.person.hold(holdFor(O));
    foe.person.update(dt * k, { speed: O.moving * 0.5, fw: fwOf(O) });
    if (O.state === 'win' && t - winPlayed > 1.8) { winPlayed = t; foe.person.play('cheer'); }
    fx(dt);
    spot.intensity = bossIntro && opp.hidden ? 8 + 4 * Math.sin(t * 3) : 30 + 40 * night;
    return true;
  }

  return {
    ui, ring: ring.group, center: { x: cx, z: cz }, floorY,
    get active() { return phase !== 'off' && phase !== 'leaving'; }, // (leaving = already back on the street, the screen is just fading in)
    get phase() { return phase; },
    get bout() { return bout; },
    /** Dev / tests: reduce motion on?, the camera shake and the hit-stop as they are right now, and a way to push an event of the sim through the show (a hit, a knock-down...). */
    get calm() { return calm(); },
    get shakeNow() { return calm() ? 0 : shake; },
    get hitStopNow() { return hitStop; },
    debugEvent(e) { onEvent(e); },
    get opponent() { return opp; },
    /** Is the point (x, z) near enough to the ring to step up to it (Space)? */
    near(x, z, r = 7.2) { return Math.hypot(x - cx, z - cz) < r; },
    onResult(fn) { cb.result = fn; },
    onLeave(fn) { cb.leave = fn; },
    start, startTraining, end, update, render, key,
    onTrain(fn) { cb.train = fn; },
    /** Per frame, after the camera is placed: the floating numbers follow their fighters on the screen. */
    follow(dt, camera) {
      if (!ui.floatsLive && phase === 'off') return;
      const w = overlay.clientWidth || 1; const h = overlay.clientHeight || 1;
      const screen = (x, y, z) => { pv.set(x, y, z).project(camera); return pv.z > 1 ? null : { x: (pv.x * 0.5 + 0.5) * w, y: (-pv.y * 0.5 + 0.5) * h }; };
      ui.updateFloats(dt, screen);
      ui.updateBuffer(phase === 'fight' && bout && bout.O.lag > 0 && !bout.over ? screen(cx + bout.O.x, floorY + 2.3, cz + bout.O.z) : null); // (the boss is lagging: the ring over his head)
    },
    touch,
    get mode() { return mode; },
    get stage() { return stage; },
    get run() { return run; },
    /** The crowd stands and sways all the time (call every frame). */
    tick(dt, t) { crowd.update(dt, t, base, phase !== 'off' ? camRel : null); beacon.update(t, phase === 'off' || phase === 'leaving', lastNight); },
    /** Stops everything at once (the day is restarted, the game quits). */
    abort() { if (phase === 'off') return; pending = null; if (bout || run) end(); phase = 'off'; setFade(0); ui.hideCard(); ui.closeMenu(false); ui.hide(); touch.hide(); ui.setTouch(false); },
    /** The way out: fade to black, back to the street. */
    leave() { if (phase === 'off' || phase === 'leaving' || phase === 'fadeout') return; phase = 'fadeout'; phaseT = 0; ui.closeMenu(false); },
    /** The apron: where Ori stands when he comes out of the ring. */
    apron() { return { x: cx, z: cz + HALF_PLATFORM + 1.9 + 1.2, heading: Math.PI }; },
    setCrowd(love) { crowd.setCount(Math.floor(6 + love * 0.3)); },
    cheer(k) { crowd.cheer(k); },
    sfx, music,
    /** Dev / tests: the state of the fight in plain numbers. */
    snapshot() { if (mode === 'bag' && run) return { phase, mode, bag: { ...run.view(), over: run.over, result: run.result, state: { ...run.state } } }; return bout ? { phase, time: bout.time, over: bout.over, result: bout.result, side: { ...side }, P: { hp: bout.P.hp, st: bout.P.st, state: bout.P.state, x: bout.P.x, z: bout.P.z, meter: bout.P.meter, combo: bout.P.combo }, O: { hp: bout.O.hp, state: bout.O.state, phase: bout.O.phase, move: bout.O.move, x: bout.O.x, z: bout.O.z, t: bout.O.t, wind: bout.O.d ? bout.O.d.wind : 0, blinking: bout.O.blinking } } : { phase }; },
    dispose() {
      window.removeEventListener('keyup', onUp, true); window.removeEventListener('blur', onBlur);
      if (phase !== 'off') { const ori = getOri(); ori.setMirror(false); ori.hold(null); ori.force(null); disposeOpponent(); }
      scene.remove(ring.group, spot, spot.target, crowd.bodies, crowd.heads, pixels, beacon.group); beacon.dispose();
      for (const s of sparks) { scene.remove(s); s.material.dispose(); }
      for (const g of ghosts) { scene.remove(g); g.material.dispose(); }
      sTex.dispose(); ghostGeo.dispose(); pixelGeo.dispose(); pixels.material.dispose(); pixels.dispose();
      for (const d of ring.own) d.dispose();
      for (const d of crowd.own) d.dispose();
      crowd.bodies.dispose(); crowd.heads.dispose();
      if (stage) { stage.dispose(); stage = null; }
      touch.dispose();
      music.dispose(); sfx.dispose(); ui.dispose();
    },
  };
}
