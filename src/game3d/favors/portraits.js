// "Ori, Can You...?" — the faces in the conversation panel. One small WebGL renderer draws each speaker's real 3D head (the same sculpted
// character as in the street, so the expressions, blinks and lip-flap are the real ones) and copies the picture into a 2D canvas.
// Nothing is rendered while no conversation is open; the renderer is created on the first conversation and freed on dispose().
import * as THREE from 'three';
import { createPerson } from './people/person.js';
import { oriSpecFor, oriTier, oriKey } from './people/loader.js';

const SIZE = 240;
const WARM = 0xfff1de;

export function createPortraits({ tier = 'high' } = {}) {
  let renderer = null;
  let scene = null;
  let camera = null;
  const slots = new Map(); // canvas -> { key, person, ctx }
  const lights = [];

  function ensure() {
    if (renderer) return true;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch { renderer = null; return false; }
    renderer.setPixelRatio(1);
    renderer.setSize(SIZE, SIZE, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(17, 1, 0.1, 20);
    const hemi = new THREE.HemisphereLight(0xdfeaff, 0x9a7a5c, 1.15);
    const key = new THREE.DirectionalLight(WARM, 2.6);
    key.position.set(0.9, 1.4, 2.2);
    const rim = new THREE.DirectionalLight(0xffc690, 1.3);
    rim.position.set(-1.6, 1.0, -1.4);
    scene.add(hemi, key, rim);
    lights.push(hemi, key, rim);
    return true;
  }

  /** Puts a character into a canvas (replacing the one that was there). Returns the slot, or null when WebGL is not available. */
  function set(canvas, spec, { ori = false } = {}) {
    if (!ensure()) return null;
    const key = ori ? oriKey(tier) : spec.id;
    const old = slots.get(canvas);
    if (old && old.key === key) return old;
    if (old) free(canvas);
    canvas.width = SIZE;
    canvas.height = SIZE;
    const person = ori
      ? createPerson(oriSpecFor(tier), { shadows: false, quality: oriTier(tier).q, tier, outline: tier !== 'low', key })
      : createPerson(spec, { shadows: false, quality: 0.5, tier, outline: tier !== 'low', key });
    person.group.visible = false;
    person.group.rotation.y = ori ? 0.32 : -0.32; // the two look a little toward each other
    scene.add(person.group);
    person.setMood('smile');
    person.update(0.016, {});
    person.update(0.016, {});
    const slot = { key, person, ctx: canvas.getContext('2d'), canvas, ori };
    slots.set(canvas, slot);
    return slot;
  }

  const head = new THREE.Vector3();
  /** Draws one slot: `talking` flaps the lips, `mood` sets the expression. */
  function draw(slot, dt, { talking = false, mood = null } = {}) {
    if (!slot || !renderer) return;
    const p = slot.person;
    if (mood) p.setMood(mood);
    p.update(dt, { talking, speed: 0 });
    for (const s of slots.values()) s.person.group.visible = s === slot;
    p.group.updateMatrixWorld(true);
    p.bones.head.getWorldPosition(head);
    const s = p.group.scale.x || 1;
    camera.position.set(head.x + 0.05 * s, head.y + 0.03 * s, head.z + 1.18 * s);
    camera.lookAt(head.x, head.y + (slot.ori ? 0.02 : -0.012) * s, head.z);
    renderer.render(scene, camera);
    slot.ctx.clearRect(0, 0, SIZE, SIZE);
    slot.ctx.drawImage(renderer.domElement, 0, 0, SIZE, SIZE);
  }

  function free(canvas) {
    const s = slots.get(canvas);
    if (!s) return;
    scene.remove(s.person.group);
    s.person.dispose();
    slots.delete(canvas);
  }

  return {
    set, draw, free,
    has: (canvas) => slots.has(canvas),
    dispose() {
      for (const c of [...slots.keys()]) free(c);
      lights.length = 0;
      if (renderer) { renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss(); renderer = null; }
    },
    get ready() { return !!renderer; },
  };
}
