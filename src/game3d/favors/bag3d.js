// "Ori, Can You...?" — the speed bag (three.js): a stand with a wooden board and a teardrop leather bag that hangs from it on a swivel, set up in the ring for the
// drill (training.js). Only the look and the swing live here: the beat and the score are pure and tested on their own. The bag swings to the beat (the cue), swings
// wider the better the combo, and takes a kick when a punch lands.
import * as THREE from 'three';

export const BAG_Z = -0.34; // the bag hangs this far from the middle of the ring (Ori stands on the other side of it, 0.62 m from the bag: a glove reaches 0.4 m)
export const BAG_Y = 1.05; // the height of the middle of the bag above the floor (Ori is a small man: his gloves are at about 1 m)
const SWIVEL = 0.19; // from the middle of the bag up to the swivel under the board
export const FIST_LAG = 0.07; // seconds from the key to the glove arriving: the bag is closest to him then, not at the beat

const tex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };

function drawPeach(g, x, y, r) {
  g.fillStyle = '#ffb877';
  g.beginPath(); g.arc(x - r * 0.26, y, r * 0.78, Math.PI * 0.55, Math.PI * 1.9); g.arc(x + r * 0.26, y, r * 0.78, Math.PI * 1.1, Math.PI * 0.45); g.closePath(); g.fill();
  g.fillStyle = '#6fc76f'; g.beginPath(); g.ellipse(x + r * 0.34, y - r * 0.82, r * 0.34, r * 0.14, -0.5, 0, Math.PI * 2); g.fill();
}

export function createBagStage({ shadows = false } = {}) {
  const group = new THREE.Group();
  group.name = 'speed-bag';
  group.visible = false;
  const own = [];
  const keep = (o) => { own.push(o); return o; };

  const leatherTex = keep(tex(256, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#c9323a'); gr.addColorStop(0.5, '#e5484d'); gr.addColorStop(1, '#a8262c');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 3; g.setLineDash([9, 7]);
    g.beginPath(); g.moveTo(0, 36); g.lineTo(w, 36); g.moveTo(0, h - 36); g.lineTo(w, h - 36); g.stroke(); g.setLineDash([]);
    for (const u of [0.25, 0.5, 0.75]) drawPeach(g, w * u, h * 0.5, 30);
  }));
  const mats = {
    leather: keep(new THREE.MeshStandardMaterial({ map: leatherTex, roughness: 0.5, metalness: 0.05 })),
    wood: keep(new THREE.MeshStandardMaterial({ color: 0xc89a62, roughness: 0.7 })),
    metal: keep(new THREE.MeshStandardMaterial({ color: 0x2b2f3a, roughness: 0.45, metalness: 0.55 })),
    steel: keep(new THREE.MeshStandardMaterial({ color: 0xb9bfcc, roughness: 0.3, metalness: 0.8 })),
    accent: keep(new THREE.MeshStandardMaterial({ color: 0xff9f5b, roughness: 0.55 })),
  };
  const add = (geometry, material, x, y, z) => {
    const m = new THREE.Mesh(keep(geometry), material);
    m.position.set(x, y, z); m.castShadow = shadows; m.receiveShadow = false;
    group.add(m);
    return m;
  };

  // the stand: a heavy foot, a pole behind the bag and an arm out to the board
  const poleZ = BAG_Z - 0.95;
  const boardY = BAG_Y + SWIVEL + 0.03; // the board's middle; the arm lies on top of it
  const top = boardY + 0.0225 + 0.05 + 0.02; // the top of the pole, level with the arm
  add(new THREE.CylinderGeometry(0.3, 0.33, 0.07, 28), mats.metal, 0, 0.035, poleZ);
  add(new THREE.CylinderGeometry(0.2, 0.2, 0.016, 28), mats.accent, 0, 0.078, poleZ);
  add(new THREE.CylinderGeometry(0.035, 0.04, top, 14), mats.metal, 0, top / 2, poleZ);
  add(new THREE.BoxGeometry(0.05, 0.05, 0.95 + 0.04), mats.metal, 0, boardY + 0.0225 + 0.025, poleZ + 0.475);
  const board = add(new THREE.CylinderGeometry(0.26, 0.26, 0.045, 32), mats.wood, 0, boardY, BAG_Z);
  board.scale.set(1, 1, 0.78);
  add(new THREE.SphereGeometry(0.03, 12, 8), mats.steel, 0, BAG_Y + SWIVEL + 0.0, BAG_Z);

  // the bag: a teardrop on a pivot at the swivel
  const pivot = new THREE.Group();
  pivot.position.set(0, BAG_Y + SWIVEL, BAG_Z);
  group.add(pivot);
  const profile = [[0, -0.19], [0.045, -0.185], [0.085, -0.16], [0.12, -0.11], [0.14, -0.04], [0.146, 0.02], [0.13, 0.08], [0.09, 0.135], [0.05, 0.17], [0.03, 0.19]].map(([r, y]) => new THREE.Vector2(r, y));
  const bagGeo = keep(new THREE.LatheGeometry(profile, 28));
  bagGeo.rotateY(Math.PI); // (the seam goes behind the bag; the peaches are on the sides and the front)
  const bag = new THREE.Mesh(bagGeo, mats.leather);
  bag.position.y = -SWIVEL; // (the pivot is at the top of the bag)
  bag.castShadow = shadows;
  pivot.add(bag);

  // the swing: the beat's cos() times an amplitude that grows with the combo, plus a damped kick when a punch lands
  const S = { amp: 0.28, kick: 0, kickV: 0, squash: 0, t: 0 };
  const lerp = (a, b, k) => a + (b - a) * k;
  return {
    group, own,
    /** Where the middle of the bag is, in the world, once the group is placed (the words of the drill float up from here). */
    get center() { return { x: group.position.x, y: group.position.y + BAG_Y, z: group.position.z + BAG_Z }; },
    show(on) { group.visible = !!on; if (on) { S.amp = 0.28; S.kick = 0; S.kickV = 0; S.squash = 0; } },
    /** Dev / tests: where the middle of the bag is in the world right now, and the angle it hangs at. */
    bagWorld() { bag.updateWorldMatrix(true, false); const e = bag.matrixWorld.elements; return { x: e[12], y: e[13], z: e[14], angle: pivot.rotation.x }; },
    get visible() { return group.visible; },
    /** `v` = run.view() (training.js) or null when the bag only hangs there. */
    update(dt, v) {
      S.t += dt;
      let swing = 0;
      let amp = 0.08 + 0.02 * Math.sin(S.t * 1.7); // (hanging: a little sway)
      if (v) {
        const iv = Math.max(0.2, v.iv || 0.5);
        swing = Math.cos((v.phase - FIST_LAG / iv) * Math.PI * 2);
        amp = 0.28 + 0.4 * Math.min(1, v.combo / 16) + (v.accent ? 0.08 : 0);
      }
      S.amp = lerp(S.amp, amp, 1 - Math.exp(-dt * 5));
      // a damped spring: the kick rattles for a quarter of a second
      const w = 30; const z = 0.32;
      S.kickV += (-w * w * S.kick - 2 * z * w * S.kickV) * dt;
      S.kick += S.kickV * dt;
      S.squash = Math.max(0, S.squash - dt * 9);
      // positive rotation about x moves the bottom of the bag away from Ori (who is on the +z side): swing > 0 = towards him
      pivot.rotation.x = -S.amp * swing + S.kick;
      const sq = S.squash;
      bag.scale.set(1 + 0.16 * sq, 1 - 0.12 * sq, 1 + 0.16 * sq);
    },
    /** A punch lands: `power` 0..1 (PERFECT = 1). The bag is knocked away from him and squashes. */
    hit(power = 0.7) { S.kickV += 12 * power; S.squash = Math.min(1, S.squash + 0.5 + 0.5 * power); },
    /** A glove that only brushes it. */
    glance() { S.kickV += 2.4; S.squash = Math.min(1, S.squash + 0.15); },
    dispose() { group.removeFromParent(); for (const d of own) d.dispose(); },
  };
}
