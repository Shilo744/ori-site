// The room comes alive (T13): wires every ambient animation to the render loop.
//   update(dt, t, state) — called each frame; does nothing in `flat`, ticks at 4 Hz while the camera is on the screen.
// Handles for T14 (interactions) and T19 (music): cat.pet(), plant.rustle(), mug.burst(), homepod.setActive()/setLevel(),
// vacuum.dodge(), clock.group, plus the raw objects for raycasting.
import * as THREE from 'three';
import { createCat } from './life-cat.js';
import { createWallClock, createVacuum } from './life-things.js';
import { createSteam, createShaft, createCandle, createSway } from './life-fx.js';

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const bump = (h, c, w) => Math.exp(-((h - c) * (h - c)) / (w * w));

const WHITE = new THREE.Color(1, 1, 1);
export const CLOCK_POS = { x: 226, y: 190 };

/**
 * @param {object} o
 * @param {THREE.Scene} o.scene
 * @param {THREE.WebGLRenderer} o.renderer
 * @param {object} o.ROOM
 * @param {object} o.mats           shared materials from createMaterials
 * @param {object} o.daylight       time-of-day controller
 * @param {THREE.DirectionalLight} o.sun
 * @param {number} o.aniso
 * @param {{plant,mug,homepod,shelf,bench}} o.parts  the placed prop groups
 * @param {{x:number,z:number,R:number}} o.rug
 * @param {{cz:number,cy:number,w:number,h:number}} o.win
 */
export function createLife({ scene, renderer, ROOM, mats, daylight, sun, aniso, parts, rug, win }) {
  // ── wall clock (back wall, right of the plant) ──
  const clock = createWallClock(mats, aniso);
  clock.group.position.set(CLOCK_POS.x, CLOCK_POS.y, ROOM.z0);
  scene.add(clock.group);

  // ── cat on the bench (bench local x runs along its length; the cushion sits at −44) ──
  const cat = createCat();
  cat.group.position.set(18, 45.4, -7); // on top of the folded blanket (seat 38 + blanket 7.5)
  cat.group.scale.setScalar(1.18);
  parts.bench.add(cat.group);

  // ── plant sway ──
  const sway = createSway();
  parts.plant.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh) return;
    if (o.material === mats.trunk) o.material = mats.trunk.clone();
    if ([mats.leafA, mats.leafB, mats.leafC, mats.leafD, mats.leafE].includes(o.material) || o.material.color.equals(mats.trunk.color)) sway.patch(o.material);
  });
  let gust = 0;

  // ── mug steam ──
  const steam = createSteam();
  steam.mesh.position.set(0, 9.2, 0);
  parts.mug.add(steam.mesh);

  // ── HomePod ring ──
  const ring = parts.homepod.getObjectByName('homepodRing');
  ring.material = ring.material.clone();
  const ringCol = new THREE.Color();
  let hpActive = false, hpTarget = 0, hpLevel = 0;

  // ── window light shaft + dust motes ──
  const shaft = createShaft(ROOM, win, renderer);
  scene.add(shaft.group);

  // ── candle ──
  const candle = createCandle(parts.shelf.getObjectByName('candleFlame'));

  // ── robot vacuum ──
  const vacuum = createVacuum(mats, rug);
  scene.add(vacuum.group);

  const tint = new THREE.Color();
  let acc = 0;
  let flicker = 1;

  const realNow = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60 + (d.getSeconds() + d.getMilliseconds() / 1000) / 3600; };

  function tickClock() {
    if (daylight.mode === 'auto' && !daylight.manual) { clock.setNow(); return; }
    const d = new Date();
    clock.set(daylight.hours, d.getSeconds() + d.getMilliseconds() / 1000);
  }

  function update(dt, t, state) {
    if (state === 'flat') return; // nothing of the room is on screen
    if (state === 'screen') { // the camera is on the laptop: keep the clock and the sway clock honest at 4 Hz, nothing else
      acc += dt;
      if (acc < 0.25) return;
      acc = 0;
      flicker = 1;
      return;
    }
    acc = 0;
    const s = daylight.state;
    const night = s.night;

    // clock
    tickClock();

    // cat
    cat.update(dt, t);

    // plant: calm sway + decaying gust
    gust = Math.max(0, gust - dt / 2.6);
    sway.uniforms.uSwayTime.value = t;
    sway.uniforms.uSwayAmp.value = 1 + 3.2 * gust * gust;

    // mug steam: strongest at breakfast, a little at lunch, again in the evening
    const h = s.hours;
    const amt = 0.34 + 0.55 * bump(h, 7.8, 2.0) + 0.4 * bump(h, 20.4, 2.6) + 0.22 * bump(h, 13.2, 1.8);
    tint.copy(WHITE).lerp(s.sky, 0.22);
    steam.update(dt, t, amt * (1 - 0.3 * night), tint);

    // HomePod: slow idle breathing, or a bright pulse that follows the music level
    hpLevel += (hpTarget - hpLevel) * (1 - Math.exp(-dt * 10));
    if (hpActive) {
      ringCol.setHSL((t * 0.07) % 1, 0.5, 0.64).multiplyScalar(0.55 + 0.45 * hpLevel);
      ring.scale.setScalar(1 + 0.32 * hpLevel + 0.04 * Math.sin(t * 7));
    } else {
      ringCol.setRGB(1, 0.95, 0.84).multiplyScalar(0.6 + 0.2 * Math.sin(t * 1.2));
      ring.scale.setScalar(1);
    }
    ring.material.color.copy(ringCol);

    // window light: a soft shaft with dust, only while the key light is the sun (or a very faint moon beam)
    const strength = sstep(0.4, 1.9, s.keyI) * (1 - 0.55 * night);
    shaft.update(t, sun, strength, 0.2);

    candle.update(t, Math.max(night, 0.15 + 0.6 * s.lamp));

    vacuum.update(dt, t);

    // laptop glow: a faint screen shimmer
    flicker = 1 + 0.012 * Math.sin(t * 13.1) + 0.008 * Math.sin(t * 31.7 + 1.3) + (Math.sin(t * 1.7) > 0.992 ? -0.03 : 0);
  }

  return {
    update,
    cat,
    clock,
    vacuum,
    candle,
    shaft,
    /** multiplier for the laptop glow light (read by the render loop) */
    get flicker() { return flicker; },
    plant: { object: parts.plant, rustle() { gust = 1; } },
    mug: { object: parts.mug, burst() { steam.burst(); } },
    homepod: {
      object: parts.homepod,
      get active() { return hpActive; },
      setActive(on) { hpActive = !!on; if (!on) hpTarget = 0; },
      /** 0..1 analyser level (T19); a steady 0.5 pulse while no analyser feeds it */
      setLevel(v) { hpTarget = Math.min(1, Math.max(0, +v || 0)); },
    },
    realNow,
    /** live values for the browser tests */
    debug() {
      return {
        swayAmp: sway.uniforms.uSwayAmp.value, swayTime: sway.uniforms.uSwayTime.value,
        steam: steam.mesh.material.uniforms.uAmt.value, steamVisible: steam.mesh.visible,
        shaft: shaft.material.uniforms.uAmt.value, dust: shaft.dustMaterial.uniforms.uAmt.value,
        ring: ring.material.color.getHex(), ringScale: ring.scale.x,
        catScale: cat.group.children[0].scale.y, clock: clock.angles(), vacuum: { x: vacuum.group.position.x, z: vacuum.group.position.z, speed: vacuum.speed },
        flicker,
      };
    },
  };
}
