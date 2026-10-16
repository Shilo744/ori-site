// The room's interactive things (T14): what you can hover and click, what it says and does.
// Pick proxies are invisible primitives parented to each object (cm, object-local coordinates).
import * as THREE from 'three';
import * as audio from '../audio.js';
import { roomSounds as sfx } from './room-sounds.js';
import { wallpaper } from '../core/wallpaper.js';
import { wallpaperName } from '../core/wallpapers.js';

const mk = (geo, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo); m.position.set(x, y, z); return m; };
const box = (w, h, d, x, y, z) => mk(new THREE.BoxGeometry(w, h, d), x, y, z);
const cyl = (r, h, x, y, z) => mk(new THREE.CylinderGeometry(r, r, h, 20), x, y, z);
const sph = (r, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = mk(new THREE.SphereGeometry(r, 14, 10), x, y, z); m.scale.set(sx, sy, sz); return m; };
const on = (parent, ...proxies) => { proxies.forEach((p) => parent.add(p)); return proxies; };

const pad2 = (n) => String(n).padStart(2, '0');

const ICON = {
  eye: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5C6.5 5 2.5 9.5 1.5 12c1 2.5 5 7 10.5 7s9.5-4.5 10.5-7C21.5 9.5 17.5 5 12 5zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm0-2a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg>',
  compass: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.3 5.7-2.2 6.4-6.4 2.2 2.2-6.4z"/></svg>',
  paw: '<svg viewBox="0 0 24 24" fill="currentColor"><ellipse cx="6.5" cy="10" rx="2" ry="2.6"/><ellipse cx="10.5" cy="6" rx="2" ry="2.8"/><ellipse cx="15.5" cy="6" rx="2" ry="2.8"/><ellipse cx="19" cy="10" rx="2" ry="2.6"/><path d="M12.8 11c3 0 6 3.4 5.2 6.2-.6 2-2.8 2-5.2 1-2.4 1-4.6 1-5.2-1C6.8 14.400 9.800 11 12.800 11z"/></svg>',
  bulb: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 0 0-4 12.700V17h8v-2.300A7 7 0 0 0 12 2z"/><rect x="9" y="18.500" width="6" height="1.800" rx=".9"/><rect x="10" y="21" width="4" height="1.400" rx=".7"/></svg>',
  note: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 3l10-2v13.300a3.500 3.500 0 1 1-2-3.200V5.600L11 6.800v10.500a3.500 3.500 0 1 1-2-3.200z"/></svg>',
};

/**
 * @param {object} o
 * @param {ReturnType<import('./interactions.js').createInteractions>} o.it
 * @param {object} o.world       createScene() result (parts, life, daylight, scene, mac)
 * @param {HTMLElement} o.screenEl  the MacBook screen DOM root
 * @param {{cycleTime: () => string, enterScreen: () => void}} o.hooks
 */
export function registerRoom({ it, world, screenEl, achievements, hooks }) {
  const { parts, life, daylight, ROOM } = world;

  // ── floor lamp: toggles the real warm light ──
  const lp = on(parts.lamp, sph(17, 0, 164, 0), cyl(5, 152, 0, 76, 0), cyl(15, 6, 0, 3, 0));
  it.register({
    id: 'lamp', name: 'Floor lamp', proxies: lp, outline: parts.lamp,
    label: () => (daylight.lamp.on ? 'Floor lamp · click to turn off' : 'Floor lamp · click to turn on'),
    onClick() {
      const state = daylight.lamp.toggle();
      sfx.lamp(state);
      achievements.increment('mood-lighting');
      return state ? 'Floor lamp · on' : 'Floor lamp · off';
    },
  });

  // ── HomePod: ambient music (T19 swaps the pad for the full engine) ──
  const hp = on(parts.homepod, sph(6.6, 0, 4.6, 0));
  it.register({
    id: 'homepod', name: 'HomePod', proxies: hp, outline: parts.homepod,
    label: () => (life.homepod.active ? 'HomePod · click to stop the music' : 'HomePod · click to play some music'),
    onClick() {
      if (audio.padOn()) { audio.padStop(); life.homepod.setActive(false); return 'HomePod · stopped'; }
      if (!audio.isEnabled()) return 'HomePod · sound is off (speaker button, top left)';
      audio.unlock();
      audio.padStart();
      life.homepod.setActive(true);
      achievements.unlock('house-dj');
      return 'HomePod · playing';
    },
  });

  // ── cat ──
  const catProxy = on(life.cat.group, box(40, 19, 36, 0, 9.5, 4));
  it.register({
    id: 'cat', name: 'Cat', proxies: catProxy, outline: life.cat.group,
    label: 'Cat · click to pet',
    onHover(over) { if (over) life.cat.notice(); },
    onClick() {
      life.cat.pet();
      sfx.purr();
      achievements.increment('cat-person');
      return 'Purrrr…';
    },
  });

  // ── fiddle-leaf fig: the leaves are flat sheets (no hull outline), so hovering makes them sway more ──
  const pl = on(parts.plant, sph(1, 0, 128, 0, 36, 62, 36), cyl(24, 44, 0, 22, 0));
  it.register({
    id: 'plant', name: 'Fiddle-leaf fig', proxies: pl,
    label: 'Fiddle-leaf fig · click to touch',
    onHover(over) { life.plant.alert(over); },
    onClick() { life.plant.rustle(); sfx.rustle(); return 'Rustle, rustle…'; },
  });

  // ── mug ──
  const mg = on(parts.mug, cyl(6.3, 11, 0, 5.5, 0));
  it.register({
    id: 'mug', name: 'Coffee', proxies: mg, outline: parts.mug,
    label: 'Coffee · click for a sip',
    onClick() { life.mug.burst(); sfx.clink(); return 'Still warm.'; },
  });

  // ── window: cycles Auto → Day → Golden hour → Night ──
  const wr = parts.windowRect;
  const wp = mk(new THREE.PlaneGeometry(wr.w, wr.h), ROOM.x0 + 1, wr.cy, wr.cz);
  wp.rotation.y = Math.PI / 2;
  world.scene.add(wp);
  it.register({
    id: 'window', name: 'Window', proxies: [wp], outline: parts.windowParts,
    label: 'Window · click to change the time of day',
    onClick() { sfx.window(); return `Window · ${hooks.cycleTime()}`; },
  });

  // ── wall art: it IS the desktop wallpaper — clicking cycles it for the whole screen (Settings → Wallpaper) ──
  const fr = on(parts.frame, box(124, 82, 6, 0, 0, 1.5));
  it.register({
    id: 'art', name: 'Wall art', proxies: fr, outline: parts.frame,
    label: () => `Wall art · ${wallpaperName(wallpaper.id)} · click for the next one`,
    onClick({ engine }) {
      wallpaper.cycle();
      engine.fx.wobble(parts.frame, 0.05, 0.95);
      sfx.art();
      return `Wall art · ${wallpaperName(wallpaper.id)}`;
    },
  });

  // ── wall clock ──
  const timeNow = () => {
    const d = new Date();
    if (daylight.mode === 'auto' && !daylight.manual) return { h: d.getHours(), m: d.getMinutes(), s: d.getSeconds(), d };
    const hrs = daylight.hours;
    return { h: Math.floor(hrs), m: Math.floor((hrs % 1) * 60), s: d.getSeconds(), d };
  };
  const clk = on(parts.clock, mk(new THREE.CylinderGeometry(18.5, 18.5, 4, 24).rotateX(Math.PI / 2), 0, 0, 1.5));
  it.register({
    id: 'clock', name: 'Wall clock', proxies: clk, outline: parts.clock,
    label: () => { const t = timeNow(); return `Wall clock · ${pad2(t.h)}:${pad2(t.m)}:${pad2(t.s)}`; },
    onClick({ engine }) {
      sfx.tick();
      engine.fx.pulse(parts.clock, 1.07, 0.4);
      const t = timeNow();
      return `It's ${pad2(t.h)}:${pad2(t.m)} · ${t.d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}`;
    },
  });

  // ── robot vacuum ──
  const vc = on(life.vacuum.group, cyl(18, 10, 0, 5, 0));
  it.register({
    id: 'vacuum', name: 'Robot vacuum', proxies: vc, outline: life.vacuum.group,
    label: 'Robot vacuum · click to say hi',
    onClick() { life.vacuum.dodge(); sfx.vacuum(); return 'Beep boop.'; },
  });

  // ── iPhone / iPad: a hop for now (T24 / T25 fly the camera to them) ──
  const ph = on(parts.iphone, box(9.5, 3, 17, 0, 1, 0));
  it.register({
    id: 'iphone', name: 'iPhone', proxies: ph, outline: parts.iphone,
    label: 'iPhone · click',
    onClick({ engine }) { engine.fx.hop(parts.iphone, 3.2, 0.6); sfx.phone(); return 'iPhone · 9:41'; },
  });
  const pd = on(parts.ipad, box(27, 20, 12, 0, 10, 1));
  it.register({
    id: 'ipad', name: 'iPad', proxies: pd, outline: parts.ipad,
    label: 'iPad · click',
    onClick({ engine }) { engine.fx.hop(parts.ipad, 2.6, 0.6); sfx.phone(); return 'iPad · more soon'; },
  });

  // ── MacBook: hover tag + pointer; a click enters the screen (the screen DOM / closed lid path lives in main.js) ──
  const mc = on(world.mac.group, box(31, 2.6, 22, 0, 1.3, 0));
  const macLabel = 'MacBook · click to open';
  it.register({
    id: 'mac', name: 'MacBook', proxies: mc, discoverable: false, label: macLabel,
    onClick() { sfx.mac(); hooks.enterScreen(); },
  });
  it.registerDom(screenEl, { id: 'mac-screen', name: 'MacBook', label: macLabel });

  // ── achievements (the Trophies UI arrives with T16) ──
  achievements.define([
    { id: 'curious', name: 'Curious', desc: 'Click on something in the room', icon: ICON.eye, rarity: 'common' },
    { id: 'room-explorer', name: 'Room explorer', desc: 'Discover everything in the room', icon: ICON.compass, rarity: 'rare', goal: it.total() },
    { id: 'cat-person', name: 'Cat person', desc: 'Pet the cat 10 times', icon: ICON.paw, rarity: 'common', goal: 10 },
    { id: 'mood-lighting', name: 'Mood lighting', desc: 'Flip the floor lamp 6 times', icon: ICON.bulb, rarity: 'common', goal: 6 },
    { id: 'house-dj', name: 'House DJ', desc: 'Put some music on with the HomePod', icon: ICON.note, rarity: 'common' },
  ]);
}
