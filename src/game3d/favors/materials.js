// "Ori, Can You...?" — the material library: the procedural maps of matgen.js uploaded as textures, ready-made MeshStandardMaterials that share them,
// and the two shader tricks every surface of the neighbourhood shares: WET (damp darkening, puddles that mirror the sky and flatten the bumps, streaks of
// lamp light on the road) and WIND (awnings, washing and flags that move with a per-vertex weight). Everything is generated in code, nothing is loaded.
import * as THREE from 'three';
import { generateMaterial, generateCard } from './matgen.js';

/** Texture size per material and tier (the tiling ground and walls get the most). */
const SIZES = {
  high: { bark: 256, frond: 256, leaves: 256, stucco: 512, paving: 512, asphalt: 512, plaster: 256, terrazzo: 256, concrete: 256, wood: 256, metal: 128, fabric: 128, sand: 256, lawn: 256, roofTile: 256 },
  medium: { bark: 128, frond: 128, leaves: 128, stucco: 256, paving: 256, asphalt: 256, plaster: 128, terrazzo: 128, concrete: 128, wood: 256, metal: 128, fabric: 128, sand: 128, lawn: 128, roofTile: 128 },
  low: { bark: 64, frond: 128, leaves: 64, stucco: 128, paving: 128, asphalt: 128, plaster: 64, terrazzo: 64, concrete: 64, wood: 128, metal: 64, fabric: 64, sand: 64, lawn: 64, roofTile: 64 },
};
export const MAX_LAMPS = 8;

function dataTexture(bytes, N, srgb, aniso) {
  const t = new THREE.DataTexture(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.length), N, N, THREE.RGBAFormat);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

const WET_COMMON = /* glsl */ `
varying vec3 vWPos;
uniform float uWet;
uniform float uLampGlow;
uniform vec4 uLamps[${MAX_LAMPS}];
float wHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float wNoise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wHash(i), wHash(i + vec2(1, 0)), f.x), mix(wHash(i + vec2(0, 1)), wHash(i + vec2(1, 1)), f.x), f.y); }
float wPuddle(vec2 p) { return wNoise(p * 0.21) * 0.6 + wNoise(p * 0.7) * 0.28 + wNoise(p * 2.3) * 0.12; }
`;

/** A tiny set of shared uniforms the whole world reads (weather, wind, time). */
function makeShared() {
  return {
    uWet: { value: 0 },
    uLampGlow: { value: 0 },
    uLamps: { value: Array.from({ length: MAX_LAMPS }, () => new THREE.Vector4(0, -100, 0, 0)) },
    uTime: { value: 0 },
    uWind: { value: 1 },
  };
}

export function createMaterialLibrary({ tier = 'high', aniso = 4 } = {}) {
  const sizes = SIZES[tier] || SIZES.high;
  const cache = new Map();
  const textures = [];
  const materials = [];
  const shared = makeShared();

  /** { map, normalMap, roughnessMap } of a named material (made on first use). */
  function maps(name) {
    if (cache.has(name)) return cache.get(name);
    const N = sizes[name] || 256;
    const m = name === 'frond' || name === 'leaves' ? generateCard(name, N, 1) : generateMaterial(name, N, 1);
    const set = { map: dataTexture(m.albedo, N, true, aniso), normalMap: dataTexture(m.normal, N, false, aniso), roughnessMap: dataTexture(m.rough, N, false, aniso) };
    textures.push(set.map, set.normalMap, set.roughnessMap);
    cache.set(name, set);
    return set;
  }

  /** The wet look: damp darkening everywhere, puddles + lamp streaks on upward-facing ground (ground: true). */
  function applyWet(mat, { ground = false } = {}) {
    const prev = mat.onBeforeCompile;
    mat.onBeforeCompile = (sh, r) => {
      if (prev) prev(sh, r);
      Object.assign(sh.uniforms, { uWet: shared.uWet, uLampGlow: shared.uLampGlow, uLamps: shared.uLamps });
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <project_vertex>', `#include <project_vertex>
          { vec4 wq = vec4(transformed, 1.0);
            #ifdef USE_INSTANCING
            wq = instanceMatrix * wq;
            #endif
            vWPos = (modelMatrix * wq).xyz; }`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\n${WET_COMMON}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          float wetPuddle = 0.0;
          ${ground ? 'wetPuddle = smoothstep(0.5 - 0.16 * uWet, 0.64 - 0.06 * uWet, wPuddle(vWPos.xz)) * uWet;' : ''}
          diffuseColor.rgb *= 1.0 - uWet * ${ground ? '0.42' : '0.2'} - wetPuddle * 0.25;`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor * (1.0 - uWet * 0.5), 0.045, wetPuddle);`)
        .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nvec3 geoNormal = normal;')
        .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(mix(normal, geoNormal, wetPuddle));')
        .replace('#include <opaque_fragment>', `
          ${ground ? `
          if (uWet > 0.01 && uLampGlow > 0.01) {
            vec3 toCam = cameraPosition - vWPos;
            vec2 vdir = normalize(toCam.xz + 1e-4);
            vec2 perp = vec2(-vdir.y, vdir.x);
            float streak = 0.0;
            for (int i = 0; i < ${MAX_LAMPS}; i++) {
              vec4 L = uLamps[i];
              if (L.w < 0.01) continue;
              vec2 d = vWPos.xz - L.xz;
              float along = dot(d, vdir);
              float across = dot(d, perp);
              float len = 1.2 + 0.55 * length(toCam.xz);
              streak += L.w * exp(-across * across / 0.45) * exp(-pow(max(along + 0.4, 0.0), 2.0) / (len * len)) * step(-0.8, along);
            }
            outgoingLight += vec3(1.0, 0.82, 0.55) * streak * wetPuddle * uLampGlow * 0.6;
          }` : ''}
          #include <opaque_fragment>`);
    };
    mat.userData.progKey = `${mat.userData.progKey || ''}|wet${ground ? 'G' : 'S'}`;
    mat.customProgramCacheKey = () => mat.userData.progKey;
    return mat;
  }

  /** Waves cloth / leaves in the wind: the per-vertex float attribute `aSway` (0..1) is how much a vertex moves. */
  function applyWind(mat, { amp = 0.1, speed = 1.6, axis = 'xz' } = {}) {
    const prev = mat.onBeforeCompile;
    mat.onBeforeCompile = (sh, r) => {
      if (prev) prev(sh, r);
      sh.uniforms.uTime = shared.uTime;
      sh.uniforms.uWind = shared.uWind;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aSway;\nuniform float uTime;\nuniform float uWind;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          {
            vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz;
            float ph = wp.x * 0.7 + wp.z * 0.9;
            float w = sin(uTime * ${speed.toFixed(2)} + ph) * 0.6 + sin(uTime * ${(speed * 2.3).toFixed(2)} + ph * 1.7) * 0.4;
            transformed.${axis === 'y' ? 'y' : 'x'} += w * ${amp.toFixed(3)} * aSway * uWind;
            ${axis === 'xz' ? `transformed.z += w * ${(amp * 0.7).toFixed(3)} * aSway * uWind;` : ''}
            transformed.y -= abs(w) * ${(amp * 0.25).toFixed(3)} * aSway * uWind;
          }`);
    };
    mat.userData.progKey = `${mat.userData.progKey || ''}|wind${amp}/${speed}/${axis}`;
    mat.customProgramCacheKey = () => mat.userData.progKey;
    return mat;
  }

  /** Leaf-cluster shading from the position alone (no texture): darker gaps between clumps of leaves, a few bright ones. */
  function applyLeaf(mat) {
    const prev = mat.onBeforeCompile;
    mat.onBeforeCompile = (sh, r) => {
      if (prev) prev(sh, r);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vObj;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          { vec3 q = vObj * 4.2;
            float c1 = abs(sin(q.x * 1.3 + sin(q.y * 1.7))) * abs(sin(q.y * 1.1 + sin(q.z * 1.9))) * abs(sin(q.z * 1.5 + q.x * 0.8));
            float c2 = abs(sin(q.x * 3.1 + q.z * 2.3)) * abs(sin(q.y * 2.9 - q.x * 1.7));
            diffuseColor.rgb *= 0.66 + 0.55 * smoothstep(0.04, 0.5, c1) + 0.12 * c2;
            diffuseColor.rgb *= mix(vec3(1.0), vec3(1.12, 1.06, 0.8), smoothstep(0.55, 0.95, c2)); }`);
    };
    mat.userData.progKey = `${mat.userData.progKey || ''}|leaf`;
    mat.customProgramCacheKey = () => mat.userData.progKey;
    return mat;
  }

  /**
   * A MeshStandardMaterial that uses a named material's maps. `tint` multiplies the albedo (vertex colours too when `vertexColors`).
   * `wet: 'ground' | 'surface' | false` adds the rain look.
   */
  function std(name, { color = 0xffffff, vertexColors = false, normalScale = 1, roughness = 1, metalness = 0, wet = 'surface', wind = null, extra = {} } = {}) {
    const m = maps(name);
    const mat = new THREE.MeshStandardMaterial({ map: m.map, normalMap: m.normalMap, roughnessMap: m.roughnessMap, color, vertexColors, roughness, metalness, ...extra });
    mat.normalScale.set(normalScale, normalScale);
    if (wind) applyWind(mat, wind);
    if (wet) applyWet(mat, { ground: wet === 'ground' });
    materials.push(mat);
    return mat;
  }

  /** A plain vertex-coloured material that still gets the wet / wind look (props, trim, foliage). */
  function plain({ color = 0xffffff, roughness = 0.8, metalness = 0, wet = 'surface', wind = null, leaf = false, extra = {} } = {}) {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, color, roughness, metalness, ...extra });
    if (wind) applyWind(mat, wind);
    if (leaf) applyLeaf(mat);
    if (wet) applyWet(mat, { ground: wet === 'ground' });
    materials.push(mat);
    return mat;
  }

  return {
    tier,
    shared,
    maps,
    std,
    plain,
    applyWet,
    applyWind,
    /** Weather + light: wet 0..1 (the rain left everything damp), lamps 0..1 (street lights on) and up to MAX_LAMPS world positions that mirror in puddles. */
    setWeather({ wet, lamps }) { shared.uWet.value = wet; shared.uLampGlow.value = lamps; },
    setLamps(list) {
      for (let i = 0; i < MAX_LAMPS; i++) {
        const l = list[i];
        if (l) shared.uLamps.value[i].set(l.x, l.y, l.z, l.i ?? 1); else shared.uLamps.value[i].set(0, -100, 0, 0);
      }
    },
    update(t, wind = 1) { shared.uTime.value = t; shared.uWind.value = wind; },
    stats() { return { textures: textures.length, materials: materials.length }; },
    dispose() { textures.forEach((t) => t.dispose()); materials.forEach((m) => m.dispose()); cache.clear(); textures.length = 0; materials.length = 0; },
  };
}
