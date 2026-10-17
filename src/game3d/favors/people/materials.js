// "Ori, Can You...?" — the look of a character: one material per layer (skin with a warm back-scatter rim, cloth with a soft sheen, glossy eyes, glass
// lenses, silver) and the cartoon OUTLINE — an inverted hull whose width is measured in screen pixels, so a character stays outlined at any distance.
import * as THREE from 'three';

/** Shared by every outline material; the game updates `view` on resize (setOutlineView). */
export const outlineUniforms = { uPx: { value: 1.5 }, uView: { value: new THREE.Vector2(1280, 720) } };

export function setOutlineView(w, h, px = null) {
  outlineUniforms.uView.value.set(w, h);
  outlineUniforms.uPx.value = px ?? Math.max(1.1, Math.min(2.6, (h / 1080) * 1.7));
}

export function outlineMaterial(hex) {
  const m = new THREE.MeshBasicMaterial({ color: hex, side: THREE.BackSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uPx = outlineUniforms.uPx;
    sh.uniforms.uView = outlineUniforms.uView;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uPx;\nuniform vec2 uView;')
      .replace('#include <project_vertex>', `
        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
        vec4 clip = projectionMatrix * mvPosition;
        vec2 ndir = (projectionMatrix * vec4(normalize(transformedNormal), 0.0)).xy;
        vec2 pdir = ndir * uView;
        float pl = length(pdir);
        if (pl > 1e-6) clip.xy += (pdir / pl) * (2.0 * uPx) / uView * clip.w;
        gl_Position = clip;`);
  };
  m.customProgramCacheKey = () => 'ori-outline';
  m.userData.outline = true;
  return m;
}

/** A warm rim light on the skin (a cheap stand-in for light scattering through ears, fingers and cheeks). */
function skinSSS(m, strength = 1) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSSS = { value: strength };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSSS;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float rimS = pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), 2.4);
        totalEmissiveRadiance += uSSS * rimS * vec3(0.30, 0.085, 0.045);`);
  };
  m.customProgramCacheKey = () => 'ori-skin';
  return m;
}

/** @returns {Record<string, THREE.Material>} materials by layer name (assemble.js) */
export function createMaterials({ tier = 'high' } = {}) {
  const lit = tier !== 'low';
  const std = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, ...o });
  const phys = (o) => (lit ? new THREE.MeshPhysicalMaterial({ vertexColors: true, ...o }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: o.roughness }));
  const M = {
    skin: skinSSS(std({ roughness: 0.56, metalness: 0 })),
    tee: phys({ roughness: 0.92, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(0x7d8394) }),
    jeans: phys({ roughness: 0.88, sheen: 0.6, sheenRoughness: 0.6, sheenColor: new THREE.Color(0x56688f) }),
    shoes: std({ roughness: 0.42 }),
    hair: std({ roughness: 0.6, metalness: 0 }),
    eyes: std({ roughness: 0.2, metalness: 0, envMapIntensity: 0.4 }),
    shine: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    frame: std({ roughness: 0.28, metalness: 0.25 }),
    lens: new THREE.MeshPhysicalMaterial({ color: 0xd7ecff, vertexColors: false, transparent: true, opacity: 0.04, roughness: 0.03, metalness: 0, envMapIntensity: 0.7, depthWrite: false, side: THREE.DoubleSide }),
    metal: std({ roughness: 0.2, metalness: 0.95, envMapIntensity: 1.6 }),
    mouth: std({ roughness: 0.45 }),
    sweat: new THREE.MeshPhysicalMaterial({ color: 0x9fd8ff, roughness: 0.05, transparent: true, opacity: 0.85, emissive: 0x2f6fb0, emissiveIntensity: 0.25 }),
  };
  M.skin.userData.flush = true;
  return M;
}

export const OUTLINE_COLORS = { skin: 0x3b1d14, tee: 0x050506, jeans: 0x0a0d18, shoes: 0x2b2b2e, hair: 0x080403 };
