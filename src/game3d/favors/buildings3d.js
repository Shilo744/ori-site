// "Ori, Can You...?" — the buildings. Every lot becomes a real facade (buildings/facade.js: walls with openings and depth, windows with interior mapping,
// balconies, shopfronts, roofs); the geometry is merged per CHUNK of the neighbourhood and per material, so the ones behind the camera are never drawn and
// the whole city is a few dozen draw calls. Plants are instanced (buildings/foliage.js). The light of the day only moves a few uniforms.
import * as THREE from 'three';
import { mulberry32 } from '../rng.js';
import { GeoBuilder } from './gfx.js';
import { signAtlas } from './signs.js';
import { artAtlas } from './art.js';
import { createWindowMaterial } from './buildings/windows.js';
import { lotStyle, buildShell } from './buildings/facade.js';
import { makeGround } from './buildings/shopfront.js';
import { createExtras, buildBalconies, drainPipe } from './buildings/balconies.js';
import { rooftop, gableRoof, disposeRoofGeos } from './buildings/roofs.js';
import { foliageGeometries, buildFoliage } from './buildings/foliage.js';
import { FACES } from './buildings/face.js';

const CHUNK = 72; // metres: the neighbourhood is cut into squares this big

const KINDS = ['walls', 'trim', 'fine', 'roofs', 'tiles', 'metal', 'cloth', 'glass', 'signs', 'art'];
/** The kinds that are small detail: only drawn near the camera (and never cast a shadow). */
const DETAIL = new Set(['fine', 'metal']);
const DETAIL_RANGE = 72;
const FOLIAGE_RANGE = 58;

/**
 * @param {object} map from buildMap
 * @param {{ lib: object, aniso?: number, shadows?: boolean, tier?: string }} o  lib = the material library (materials.js)
 */
export function buildBuildings(map, { lib, aniso = 4, shadows = true, tier = 'high' } = {}) {
  const rnd = mulberry32(map.seed * 7 + 3);
  const atlas = signAtlas(aniso);
  const art = artAtlas(aniso);
  const chunks = new Map();
  const chunkOf = (lot) => {
    const cx = Math.floor((lot.rect.x0 + lot.rect.x1) / 2 / CHUNK);
    const cz = Math.floor((lot.rect.z0 + lot.rect.z1) / 2 / CHUNK);
    const key = `${cx},${cz}`;
    if (!chunks.has(key)) {
      const b = {};
      for (const k of KINDS) b[k] = new GeoBuilder();
      chunks.set(key, { key, b, inst: [] });
    }
    return chunks.get(key);
  };
  let windowCount = 0;
  const balconySpots = [];

  for (const lot of map.lots) {
    const place = lot.named ? map.places[lot.id] : null;
    const st = lotStyle(lot, rnd, lot.named);
    const ch = chunkOf(lot);
    const extras = createExtras(ch.b, ch.inst, rnd);
    const ground = makeGround(ch.b, lot, st, place, rnd, atlas, extras, art);
    const shell = buildShell(ch.b, lot, st, rnd, { ground, extras });
    buildBalconies(ch.b, lot, st, shell, ch.inst, rnd, balconySpots);
    if (st.style === 'house') gableRoof(ch.b, lot.rect, lot.h);
    else rooftop(ch.b, lot.rect, lot.h + 0.01, rnd, st);
    // a drain pipe down one corner of the street side
    drainPipe(ch.b, FACES[lot.side], lot.rect, 0.12, lot.h);
    windowCount += ch.b.glass.count / 4;
  }

  // ── materials ──
  const win = createWindowMaterial();
  const sideBoth = { side: THREE.DoubleSide };
  const mats = {
    walls: lib.std('stucco', { vertexColors: true, normalScale: 0.6 }),
    trim: lib.std('plaster', { vertexColors: true, normalScale: 0.6 }),
    fine: lib.std('plaster', { vertexColors: true, normalScale: 0.4 }),
    roofs: lib.std('concrete', { vertexColors: true, normalScale: 0.7 }),
    tiles: lib.std('roofTile', { vertexColors: true, extra: sideBoth }),
    metal: lib.plain({ roughness: 0.5, metalness: 0.25 }),
    cloth: lib.std('fabric', { vertexColors: true, normalScale: 0.25, extra: sideBoth, wind: { amp: 0.12, speed: 1.7 } }),
    glass: win.material,
    signs: new THREE.MeshStandardMaterial({ map: atlas.tex, emissiveMap: atlas.tex, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.1, roughness: 0.55, transparent: true, alphaTest: 0.4 }),
  };
  mats.art = new THREE.MeshStandardMaterial({ map: art.tex, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  lib.applyWet(mats.art);
  lib.applyWet(mats.signs);
  const fmats = {
    leaf: lib.plain({ roughness: 0.7, wind: { amp: 0.05, speed: 1.5 }, extra: { side: THREE.DoubleSide } }),
    bloom: lib.plain({ roughness: 0.6, wind: { amp: 0.05, speed: 1.5 } }),
    wood: lib.plain({ roughness: 0.6 }),
  };
  const fgeos = foliageGeometries();

  const group = new THREE.Group();
  group.name = 'buildings';
  group.userData.winUniform = win.uniforms.uWin; // (tests read how many windows glow)
  const castKinds = new Set(['walls', 'trim', 'tiles']); // (the roofs and the small detail do not cast: the budget goes to what the ground sees)
  let triangles = 0;
  const lod = []; // { x, z, detail: [meshes], foliage: [meshes] }
  for (const ch of chunks.values()) {
    const [kx, kz] = ch.key.split(',').map(Number);
    const rec = { x: (kx + 0.5) * CHUNK, z: (kz + 0.5) * CHUNK, detail: [], foliage: [] };
    lod.push(rec);
    for (const k of KINDS) {
      const B = ch.b[k];
      if (!B.count) continue;
      const geo = B.build(k === 'glass' ? { extraName: 'aLit', extraName2: 'aSize' } : k === 'cloth' ? { extraName2: 'aSway' } : {});
      const m = new THREE.Mesh(geo, mats[k]);
      m.name = `${k}-${ch.key}`;
      m.castShadow = shadows && castKinds.has(k);
      m.receiveShadow = k !== 'glass' && k !== 'signs';
      if (k === 'art') m.receiveShadow = true;
      group.add(m);
      if (DETAIL.has(k)) rec.detail.push(m);
      triangles += B.i.length / 3;
    }
    for (const im of buildFoliage(ch.inst, fgeos, fmats, { shadows: false })) { group.add(im); rec.foliage.push(im); triangles += (im.geometry.index ? im.geometry.index.count / 3 : im.geometry.attributes.position.count / 3) * im.count; }
  }
  Object.values(fgeos).forEach((g) => { g.leaf.dispose(); if (g.bloom) g.bloom.dispose(); });

  const rangeScale = tier === 'low' ? 0.3 : tier === 'medium' ? 0.6 : 1; // lower tiers draw the small detail only close by

  return {
    group,
    /** Where a person could stand on a balcony: [{ x, y, z, heading, seed }]. */
    balconies: balconySpots,
    stats: { windows: windowCount, lots: map.lots.length, chunks: chunks.size, triangles: Math.round(triangles), instances: [...chunks.values()].reduce((a, c) => a + c.inst.length, 0) },
    /** Per frame (cheap): the small detail and the plants are only drawn near the camera. */
    update(x, z) {
      for (const c of lod) {
        const d = Math.hypot(c.x - x, c.z - z) - CHUNK * 0.7;
        const det = d < DETAIL_RANGE * rangeScale;
        const fol = d < FOLIAGE_RANGE * rangeScale;
        for (const m of c.detail) m.visible = det;
        for (const m of c.foliage) m.visible = fol;
      }
    },
    /** win: 0..1 how many lit windows glow; lamps: 0..1 sign glow; glass: [r, g, b] the daytime reflection; day: 0 night .. 1 day. */
    setLight({ win: w, lamps, glass, day = 1 }) {
      win.uniforms.uWin.value = w;
      win.uniforms.uDay.value = day;
      win.uniforms.uGlass.value.setRGB(glass[0], glass[1], glass[2]);
      mats.signs.emissiveIntensity = 0.08 + lamps * 0.9;
    },
    dispose() {
      group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.isInstancedMesh) o.dispose(); });
      for (const m of [...Object.values(mats), ...Object.values(fmats)]) m.dispose();
      atlas.tex.dispose();
      art.tex.dispose();
      disposeRoofGeos();
    },
  };
}
