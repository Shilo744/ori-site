// "Ori, Can You...?" — the buildings: white Bauhaus blocks with window strips, balconies, shopfronts and the painted signs of the named
// places, all merged into five meshes (walls, trim, roofs, windows, signs) so the whole neighbourhood costs a handful of draw calls.
// Windows carry a per-window "lit" flag: by day they are glass, at dusk the lit ones glow warm (one shader uniform, no CPU work).
import * as THREE from 'three';
import { mulberry32 } from '../rng.js';
import { GeoBuilder } from './gfx.js';
import { wallTexture, signAtlas } from './textures.js';
import { PLACES } from './content.js';

const FLOOR = 3.1;
const FACES = {
  S: { o: (r) => [r.x0, r.z1], t: [1, 0], n: [0, 1], len: (r) => r.x1 - r.x0 },
  N: { o: (r) => [r.x1, r.z0], t: [-1, 0], n: [0, -1], len: (r) => r.x1 - r.x0 },
  E: { o: (r) => [r.x1, r.z1], t: [0, -1], n: [1, 0], len: (r) => r.z1 - r.z0 },
  W: { o: (r) => [r.x0, r.z0], t: [0, 1], n: [-1, 0], len: (r) => r.z1 - r.z0 },
};

const P = (f, r, s, y, e) => { const o = f.o(r); return [o[0] + f.t[0] * s + f.n[0] * e, y, o[1] + f.t[1] * s + f.n[1] * e]; };
/** A quad lying on a facade between along-positions s0..s1 and heights y0..y1, pushed out by e. */
function faceQuad(B, f, r, s0, s1, y0, y1, e, uv) {
  return B.quad(P(f, r, s0, y0, e), P(f, r, s1, y0, e), P(f, r, s1, y1, e), P(f, r, s0, y1, e), f.n[0], 0, f.n[1], uv);
}
/** A box standing on a facade: along s0..s1, heights y0..y1, from the wall out to depth d. */
function faceBox(B, f, r, s0, s1, y0, y1, d, d0 = 0) {
  const a = P(f, r, s0, y0, d0);
  const b = P(f, r, s1, y1, d);
  B.box(Math.min(a[0], b[0]), y0, Math.min(a[2], b[2]), Math.max(a[0], b[0]), y1, Math.max(a[2], b[2]));
}

/**
 * @param {object} map from buildMap
 * @param {{ aniso?: number }} o
 * @returns {{ group: THREE.Group, setLight(l: {win:number, lamps:number, glass:number[]}): void, dispose(): void, stats: object }}
 */
export function buildBuildings(map, { aniso = 4 } = {}) {
  const rnd = mulberry32(map.seed * 7 + 3);
  const walls = new GeoBuilder();
  const trim = new GeoBuilder();
  const roofs = new GeoBuilder();
  const wins = new GeoBuilder();
  const signs = new GeoBuilder();
  const atlas = signAtlas(aniso);
  const cyl = new THREE.CylinderGeometry(0.8, 0.8, 1.4, 12);
  const pole = new THREE.CylinderGeometry(0.3, 0.3, 1, 10);
  const mat4 = new THREE.Matrix4();
  let windowCount = 0;

  for (const lot of map.lots) {
    const r = lot.rect;
    const h = lot.h;
    const front = FACES[lot.side];
    const place = lot.named ? map.places[lot.id] : null;
    const tone = lot.named ? (lot.id === 'kiosk' ? PLACES.kiosk.tone : '#f5f1e9') : lot.tone;
    const floors = Math.max(1, Math.round(h / FLOOR));

    // body + roof
    walls.setColor(tone).box(r.x0, 0, r.z0, r.x1, h, r.z1, { uvMeters: [4, FLOOR], skip: { top: true, bottom: true } });
    if (lot.id === 'auntie') gable(roofs, r, h, rnd);
    else {
      roofs.setColor('#cfcbc4').box(r.x0 - 0.14, h, r.z0 - 0.14, r.x1 + 0.14, h + 0.5, r.z1 + 0.14);
      rooftop(roofs, r, h + 0.5, rnd, cyl, pole, mat4);
    }
    // a plinth band so the block sits on the street
    trim.setColor('#d6d1c8').box(r.x0 - 0.05, 0, r.z0 - 0.05, r.x1 + 0.05, 0.5, r.z1 + 0.05);

    for (const key of ['S', 'N', 'E', 'W']) {
      const f = FACES[key];
      const len = f.len(r);
      const isFront = key === lot.side;
      const nWin = Math.max(1, Math.floor((len - 1.6) / 3.2));
      const step = (len - 1.6) / nWin;
      for (let fl = 1; fl < floors; fl++) {
        const y0 = fl * FLOOR + 0.85;
        for (let k = 0; k < nWin; k++) {
          const sc = 0.8 + step * (k + 0.5);
          // (a window gives way to the balcony door on the front)
          trim.setColor('#fbfaf7');
          faceQuad(trim, f, r, sc - 0.95, sc + 0.95, y0 - 0.08, y0 + 1.5, 0.03);
          wins.attr = rnd() < 0.55 ? 1 : 0;
          const cool = rnd() < 0.2;
          wins.setColor(cool ? '#9fb7d4' : '#dfe9f2');
          faceQuad(wins, f, r, sc - 0.82, sc + 0.82, y0, y0 + 1.38, 0.05);
          windowCount++;
        }
        // balconies on every second floor of the front, two per floor
        if (isFront && fl % 2 === 0 && len > 14) {
          for (const frac of [0.3, 0.7]) {
            const sc = len * frac;
            trim.setColor(lot.accent || '#ece7de');
            faceBox(trim, f, r, sc - 1.4, sc + 1.4, fl * FLOOR, fl * FLOOR + 0.14, 1.15);
            trim.setColor('#f7f4ee');
            faceBox(trim, f, r, sc - 1.4, sc + 1.4, fl * FLOOR + 0.14, fl * FLOOR + 1.02, 1.15, 1.03);
            faceBox(trim, f, r, sc - 1.4, sc - 1.28, fl * FLOOR + 0.14, fl * FLOOR + 1.02, 1.15, 0.0);
            faceBox(trim, f, r, sc + 1.28, sc + 1.4, fl * FLOOR + 0.14, fl * FLOOR + 1.02, 1.15, 0.0);
          }
        }
      }
    }

    // ground floor + sign on the street side
    const len = front.len(r);
    const mid = len / 2;
    if (lot.id === 'kiosk') {
      trim.setColor(tone);
      faceBox(trim, front, r, 0.2, len - 0.2, 2.35, 2.55, 1.0); // awning
      wins.attr = 2;
      wins.setColor('#fff0cf');
      faceQuad(wins, front, r, 0.5, len - 0.5, 0.95, 2.2, 0.05);
      trim.setColor('#8a6a45');
      faceBox(trim, front, r, 0.4, len - 0.4, 0.0, 1.0, 0.42); // the counter
      signQuad(signs, atlas, front, r, 'kiosk', mid - 1.8, mid + 1.8, h + 0.1, h + 1.0);
    } else {
      // shop windows either side of the door
      const doorW = 1.7;
      const panes = [[0.9, mid - doorW / 2 - 0.5], [mid + doorW / 2 + 0.5, len - 0.9]];
      for (const [a, b] of panes) {
        if (b - a < 1.6) continue;
        trim.setColor('#4b4b50');
        faceQuad(trim, front, r, a - 0.08, b + 0.08, 0.55, 2.78, 0.03);
        wins.attr = place || rnd() < 0.5 ? 2 : 0;
        wins.setColor('#e4eef6');
        faceQuad(wins, front, r, a, b, 0.65, 2.7, 0.05);
      }
      if (place && place.kind === 'building') {
        const dTone = place.tone;
        trim.setColor(dTone);
        faceQuad(trim, front, r, mid - doorW / 2 - 0.12, mid + doorW / 2 + 0.12, 0, 2.62, 0.04);
        wins.attr = 0;
        wins.setColor('#2a2d34');
        faceQuad(wins, front, r, mid - doorW / 2, mid + doorW / 2, 0, 2.5, 0.07);
        trim.setColor('#f3efe7');
        faceBox(trim, front, r, mid - 1.5, mid + 1.5, 2.65, 2.8, 1.1); // canopy
        faceBox(trim, front, r, mid - 1.3, mid + 1.3, 0, 0.18, 1.3); // step
        const wide = lot.id === 'cityhall' ? 9.6 : 4.6;
        if (lot.id === 'cityhall') signQuad(signs, atlas, front, r, lot.id, mid - wide / 2, mid + wide / 2, 10.9, 10.9 + wide / 4.2 * 0.75); // above the colonnade
        else signQuad(signs, atlas, front, r, lot.id, mid - wide / 2, mid + wide / 2, 3.15, 3.15 + wide / 4.2);
        if (lot.id === 'cafe') {
          trim.setColor(dTone);
          faceBox(trim, front, r, 0.6, len - 0.6, 2.45, 2.65, 1.9); // awning
        }
        if (lot.id === 'cityhall') portico(trim, front, r, len, h);
      } else if (!place) {
        // a plain door on the street side of the apartment blocks
        trim.setColor('#cfc9be');
        faceQuad(trim, front, r, len * 0.5 - 0.95, len * 0.5 + 0.95, 0, 2.5, 0.04);
        wins.attr = 0;
        wins.setColor('#3a3f48');
        faceQuad(wins, front, r, len * 0.5 - 0.8, len * 0.5 + 0.8, 0, 2.4, 0.06);
      }
    }
  }

  // ── meshes ──
  const wallMap = wallTexture(aniso);
  wallMap.repeat.set(1, 1);
  const matWalls = new THREE.MeshStandardMaterial({ map: wallMap, vertexColors: true, roughness: 0.95, metalness: 0 });
  const matTrim = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
  const matRoof = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  const matSign = new THREE.MeshStandardMaterial({ map: atlas.tex, emissiveMap: atlas.tex, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.1, roughness: 0.6, transparent: true, alphaTest: 0.4 });
  const winUniforms = { uWin: { value: 0 }, uGlass: { value: new THREE.Color(0.45, 0.55, 0.65) }, uWarm: { value: new THREE.Color(1, 0.74, 0.42) } };
  const matWin = new THREE.MeshBasicMaterial({ vertexColors: true });
  matWin.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, winUniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aLit;\nvarying float vLit;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLit = aLit;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vLit;\nuniform float uWin;\nuniform vec3 uGlass;\nuniform vec3 uWarm;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float shop = step(1.5, vLit);
        float lit = step(0.5, vLit) * (1.0 - shop) * smoothstep(0.3, 0.85, uWin) + shop * smoothstep(0.25, 0.7, uWin);
        diffuseColor.rgb = mix(uGlass * diffuseColor.rgb, uWarm * (0.5 + 0.34 * diffuseColor.g), lit);`);
  };

  const group = new THREE.Group();
  group.name = 'buildings';
  group.userData.winUniform = winUniforms.uWin; // (tests read how many windows glow)
  const make = (b, mat, name, { cast = true, extra = false } = {}) => {
    const m = new THREE.Mesh(b.build({ extraName: extra ? 'aLit' : null }), mat);
    m.name = name;
    m.castShadow = cast;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  make(walls, matWalls, 'walls');
  make(trim, matTrim, 'trim');
  make(roofs, matRoof, 'roofs');
  make(wins, matWin, 'windows', { cast: false, extra: true }).receiveShadow = false;
  make(signs, matSign, 'signs', { cast: false }).receiveShadow = false;

  return {
    group,
    stats: { windows: windowCount, lots: map.lots.length },
    /** win: 0..1 how many lit windows glow; lamps: 0..1 sign glow; glass: [r, g, b] the daytime look of the windows. */
    setLight({ win, lamps, glass }) {
      winUniforms.uWin.value = win;
      winUniforms.uGlass.value.setRGB(glass[0], glass[1], glass[2]);
      matSign.emissiveIntensity = 0.08 + lamps * 0.9;
    },
    dispose() {
      for (const o of group.children) o.geometry.dispose();
      for (const m of [matWalls, matTrim, matRoof, matSign, matWin]) m.dispose();
      wallMap.dispose();
      atlas.tex.dispose();
      cyl.dispose();
      pole.dispose();
    },
  };
}

function signQuad(B, atlas, f, r, id, s0, s1, y0, y1) {
  const [u0, v0, u1, v1] = atlas.uv(id);
  B.setColor('#ffffff');
  faceQuad(B, f, r, s0, s1, y0, y1, 0.09, [u0, v0, u1, v0, u1, v1, u0, v1]);
}

/** Columns and a pediment across the front of City Hall. */
function portico(B, f, r, len, h) {
  B.setColor('#efece6');
  const n = 7;
  for (let i = 0; i < n; i++) {
    const s = 3 + ((len - 6) * i) / (n - 1);
    faceBox(B, f, r, s - 0.3, s + 0.3, 0, 8.6, 1.4, 0.8);
  }
  faceBox(B, f, r, 2.2, len - 2.2, 8.6, 9.6, 1.6, 0.0);
  faceBox(B, f, r, 2.0, len - 2.0, 9.6, 10.2, 1.8, 0.3);
}

/** Aunt's house: a gabled tile roof along the longer side. */
function gable(B, r, h, rnd) {
  const alongX = r.x1 - r.x0 >= r.z1 - r.z0;
  const rise = 2.6;
  B.setColor('#b5573c');
  const ov = 0.5;
  if (alongX) {
    const zm = (r.z0 + r.z1) / 2;
    B.quad([r.x0 - ov, h, r.z1 + ov], [r.x1 + ov, h, r.z1 + ov], [r.x1 + ov, h + rise, zm], [r.x0 - ov, h + rise, zm], 0, 0.9, 0.45);
    B.quad([r.x1 + ov, h, r.z0 - ov], [r.x0 - ov, h, r.z0 - ov], [r.x0 - ov, h + rise, zm], [r.x1 + ov, h + rise, zm], 0, 0.9, -0.45);
    B.setColor('#f3eee6');
    B.quad([r.x0, h, r.z0], [r.x0, h, r.z1], [r.x0, h + rise * 0.96, zm], [r.x0, h + rise * 0.96, zm], -1, 0, 0);
    B.quad([r.x1, h, r.z1], [r.x1, h, r.z0], [r.x1, h + rise * 0.96, zm], [r.x1, h + rise * 0.96, zm], 1, 0, 0);
  } else {
    const xm = (r.x0 + r.x1) / 2;
    B.quad([r.x1 + ov, h, r.z1 + ov], [r.x1 + ov, h, r.z0 - ov], [xm, h + rise, r.z0 - ov], [xm, h + rise, r.z1 + ov], 0.45, 0.9, 0);
    B.quad([r.x0 - ov, h, r.z0 - ov], [r.x0 - ov, h, r.z1 + ov], [xm, h + rise, r.z1 + ov], [xm, h + rise, r.z0 - ov], -0.45, 0.9, 0);
    B.setColor('#f3eee6');
    B.quad([r.x0, h, r.z1], [r.x1, h, r.z1], [xm, h + rise * 0.96, r.z1], [xm, h + rise * 0.96, r.z1], 0, 0, 1);
    B.quad([r.x1, h, r.z0], [r.x0, h, r.z0], [xm, h + rise * 0.96, r.z0], [xm, h + rise * 0.96, r.z0], 0, 0, -1);
  }
  void rnd;
}

/** Water tank, solar heater, antenna and a stair core: the Tel-Aviv roof. */
function rooftop(B, r, y, rnd, cyl, pole, mat4) {
  const w = r.x1 - r.x0;
  const d = r.z1 - r.z0;
  const at = (fx, fz) => [r.x0 + w * fx, r.z0 + d * fz];
  if (rnd() < 0.7) { const [x, z] = at(0.2 + rnd() * 0.5, 0.2 + rnd() * 0.5); B.geometry(cyl, mat4.makeTranslation(x, y + 1.2, z), 0xdfe3e8); B.setColor('#8a8f98').box(x - 0.6, y, z - 0.6, x + 0.6, y + 0.5, z + 0.6); }
  if (rnd() < 0.6) { const [x, z] = at(0.15 + rnd() * 0.6, 0.15 + rnd() * 0.6); B.setColor('#2b3a55').box(x - 0.9, y + 0.1, z - 0.6, x + 0.9, y + 0.5, z + 0.6); }
  if (rnd() < 0.5) { const [x, z] = at(0.2 + rnd() * 0.6, 0.2 + rnd() * 0.6); B.geometry(pole, mat4.compose(new THREE.Vector3(x, y + 1.6, z), new THREE.Quaternion(), new THREE.Vector3(0.12, 3.2, 0.12)), 0x9aa0a8); }
  if (rnd() < 0.8) { const [x, z] = at(0.55 + rnd() * 0.25, 0.55 + rnd() * 0.25); B.setColor('#e6e1d8').box(x - 1.2, y, z - 1.2, x + 1.2, y + 2.4, z + 1.2); }
}
