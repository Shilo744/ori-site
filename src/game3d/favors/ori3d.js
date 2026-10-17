// "Ori, Can You...?" — Ori himself. No photo anywhere: he is SCULPTED (people/head.js: a smooth stylised head from blended forms; hair.js: dense
// curls; face.js: eyes, lids, brows, moustache, goatee, glasses, hoop, an expressive mouth) and built on the shared skinned rig (people/*), so he
// blinks, smiles, grins, laughs, winks, gets flustered-but-smiling, gives a thumbs-up, checks his phone. Facing: +z at rotation 0 (see controller.js).
import * as THREE from 'three';
import { createPerson } from './people/person.js';
import { oriSpecFor, oriTier, oriKey } from './people/loader.js';

function emoteTexture(kind) {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  g.lineCap = 'round';
  if (kind === 'sparkle') {
    g.fillStyle = '#ffd84a';
    for (const [x, y, s] of [[44, 56, 1], [88, 40, 0.65], [84, 92, 0.8]]) {
      g.beginPath();
      for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; const r = (k % 2 ? 7 : 24) * s; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
      g.closePath(); g.fill();
    }
  } else if (kind === 'heart') {
    g.fillStyle = '#ff6f8f';
    g.beginPath(); g.moveTo(64, 98); g.bezierCurveTo(10, 62, 30, 20, 64, 46); g.bezierCurveTo(98, 20, 118, 62, 64, 98); g.fill();
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

export function createOri({ shadows = true, tier = 'high' } = {}) {
  // the tiers: High = the full hero (curls, outline, 0.0058 m skin); Medium = half the curls and a coarser skin; Low = a smooth cap of hair, no outline.
  // (The geometry was most likely built by the worker while the site was idle: createPerson finds it in the cache.)
  const T = oriTier(tier);
  const person = createPerson(oriSpecFor(tier), { shadows, tier, quality: T.q, outline: T.outline, key: oriKey(tier) });
  const root = person.group;
  root.name = 'ori';
  root.userData.faceSource = 'sculpted'; // (tests read it: there is no photo any more)
  const disposables = [];

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
  const blobGeo = new THREE.PlaneGeometry(0.9, 0.9);
  const blob = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  disposables.push(blobGeo, blob.material);
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.02;
  root.add(blob);

  // emotes: little billboards above his head (zzz when he is out of breath, sparkles / hearts for the good moments)
  const emoteMats = {};
  const emote = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, opacity: 0 }));
  emote.scale.set(0.5, 0.5, 1);
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

  let t = 0;
  let prevSpeed = 0;
  let locked = null; // dev / tests: hold one expression
  let forced = null; // dev / tests: pretend to be walking / running / out of breath
  let heldFor = 0; // seconds left of a timed held pose (the phone check when a task arrives)
  let flashMood = null;
  let flashFor = 0;
  const topY = person.headHeight + 0.18;
  return {
    group: root,
    person,
    head: person.bones.head,
    get height() { return topY; },
    setEmote,
    play: (g) => person.play(g),
    hold: (h) => { heldFor = 0; person.hold(h); },
    /** Holds a pose (phone / carry) for a few seconds, then lets it go. */
    holdFor(h, seconds) { person.hold(h); heldFor = seconds; },
    /** Wears an expression for a moment (a happy surprise when a task buzzes). */
    flash(mood, seconds = 1.2) { flashMood = mood; flashFor = seconds; },
    setMood: (m, k) => person.setMood(m, k),
    /** Dev / tests: keep one expression whatever the chaos is (null releases it). */
    lockMood(name) { locked = name || null; },
    /** Dev / tests: { speed, sprinting, winded } to animate as if he moved (null releases). */
    force(s) { forced = s || null; },
    /** s = the controller state (+ stress 0..1). Positions the group and animates the body and face. */
    update(dt, s, groundY = 0, stress = 0) {
      t += dt;
      root.position.set(s.x, groundY, s.z);
      root.rotation.y = s.heading;
      const acc = dt > 0 ? (s.speed - prevSpeed) / dt : 0;
      prevSpeed = s.speed;
      if (heldFor > 0) { heldFor -= dt; if (heldFor <= 0) person.hold(null); }
      if (flashFor > 0) flashFor -= dt;
      person.setMood(locked || (flashFor > 0 && flashMood) || (stress > 0.78 ? 'flustered' : stress > 0.5 ? 'grin' : 'smile'));
      const m = forced || s;
      person.update(dt, { speed: m.speed, sprinting: !!m.sprinting, winded: !!m.winded, stress, acc, hold: s.hold || undefined, talking: !!s.talking });
      setEmote((forced || s).winded ? 'zzz' : s.emote || null);
      if (emoteName) emote.position.set(0.3, topY + 0.28 + Math.sin(t * 5) * 0.025, 0);
      blob.visible = !shadows;
    },
    dispose() {
      person.dispose();
      disposables.forEach((d) => d.dispose && d.dispose());
    },
  };
}
