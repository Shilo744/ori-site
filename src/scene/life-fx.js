// Room atmosphere (T13): mug steam, the window light shaft with floating dust, candle glow, plant sway.
// Everything is driven by uniforms (no per-frame geometry/texture work) and costs one draw call per effect.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const noRaycast = (mesh) => { mesh.raycast = () => {}; return mesh; };

// ───────────────────────── mug steam ─────────────────────────
/** Two crossed planes with a procedural wisp shader. `amount` 0..1 fades it; `burst()` puffs it up for a moment. */
export function createSteam() {
  const a = new THREE.PlaneGeometry(11, 20, 1, 1);
  const b = a.clone().rotateY(Math.PI / 2);
  const geo = mergeGeometries([a.translate(0, 10, 0), b.translate(0, 10, 0)]);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uAmt: { value: 0.6 }, uTint: { value: new THREE.Color(1, 1, 1) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform float uTime; uniform float uAmt; uniform vec3 uTint; varying vec2 vUv;
      float wisp(vec2 uv, float seed, float speed) {
        float y = uv.y;
        float sway = (sin(y * 5.0 - uTime * speed + seed) * 0.5 + sin(y * 11.0 - uTime * speed * 1.6 + seed * 1.7) * 0.25) * 0.2 * (0.2 + y);
        float x = uv.x - 0.5 - sway;
        float w = mix(0.045, 0.17, y);
        float core = exp(-(x * x) / (w * w));
        float pat = 0.5 + 0.5 * sin(y * 10.0 - uTime * speed * 2.0 + seed * 3.0);
        return core * (0.12 + 0.88 * pat * pat);
      }
      void main() {
        float y = vUv.y;
        float a = wisp(vUv, 0.0, 1.0) * 0.6 + wisp(vUv + vec2(0.12, 0.0), 2.3, 1.3) * 0.55 + wisp(vUv - vec2(0.14, 0.0), 4.1, 0.9) * 0.5;
        a *= smoothstep(0.0, 0.07, y) * (1.0 - smoothstep(0.45, 1.0, y));
        a *= smoothstep(0.0, 0.2, 0.5 - abs(vUv.x - 0.5));
        gl_FragColor = vec4(uTint, clamp(a * uAmt * 1.7, 0.0, 0.95));
      }`,
  });
  const mesh = noRaycast(new THREE.Mesh(geo, mat));
  mesh.name = 'steam';
  mesh.renderOrder = 3;
  mesh.frustumCulled = false;
  let burst = 0;
  return {
    mesh,
    burst() { burst = 1; },
    /** @param {number} amount 0..1 base visibility (time of day) */
    update(dt, t, amount, tint) {
      burst = Math.max(0, burst - dt / 2.4);
      mat.uniforms.uTime.value = t;
      mat.uniforms.uAmt.value = Math.min(1.6, amount + burst * 0.9);
      mat.uniforms.uTint.value.copy(tint);
      mesh.scale.y = 1 + burst * 0.55;
      mesh.visible = mat.uniforms.uAmt.value > 0.02;
    },
  };
}

// ───────────────────────── window light shaft + dust ─────────────────────────
/**
 * A faint volumetric shaft that leaves the window along the sun's direction, plus drifting dust motes inside it.
 * @param {{x0:number,x1:number,z0:number,z1:number,h:number}} ROOM
 * @param {{cz:number,cy:number,w:number,h:number}} win  window opening
 */
export function createShaft(ROOM, win, renderer) {
  const hw = win.w / 2 - 28, hh = win.h / 2 - 26; // inset: the rounded corners and frame never show a hard rectangle
  const x = ROOM.x0 + 0.6;
  const C = [
    [x, win.cy - hh, win.cz - hw], [x, win.cy - hh, win.cz + hw], [x, win.cy + hh, win.cz + hw], [x, win.cy + hh, win.cz - hw],
  ];
  const pos = [], ext = [], edge = [], across = [];
  for (let i = 0; i < 4; i++) {
    const a = C[i], b = C[(i + 1) % 4];
    const e = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const l = Math.hypot(...e);
    const en = [e[0] / l, e[1] / l, e[2] / l];
    // two triangles of the side quad: (a,0) (b,0) (b,1) / (a,0) (b,1) (a,1)
    [[a, 0, 0], [b, 0, 1], [b, 1, 1], [a, 0, 0], [b, 1, 1], [a, 1, 0]].forEach(([p, k, u]) => { pos.push(...p); ext.push(k); across.push(u); edge.push(...en); });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aExt', new THREE.Float32BufferAttribute(ext, 1));
  geo.setAttribute('aEdge', new THREE.Float32BufferAttribute(edge, 3));
  geo.setAttribute('aU', new THREE.Float32BufferAttribute(across, 1));
  const shared = {
    uDir: { value: new THREE.Vector3(1, -0.6, 0) },
    uLen: { value: 300 },
    uColor: { value: new THREE.Color(1, 0.95, 0.85) },
  };
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { ...shared, uAmt: { value: 0 } },
    vertexShader: `
      attribute float aExt; attribute vec3 aEdge; attribute float aU;
      uniform vec3 uDir; uniform float uLen;
      varying float vExt; varying float vU; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main() {
        vec3 p = position + uDir * uLen * aExt;
        vN = cross(aEdge, uDir);
        vV = cameraPosition - p;
        vP = p; vExt = aExt; vU = aU;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uAmt;
      varying float vExt; varying float vU; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main() {
        float f = abs(dot(normalize(vN), normalize(vV)));
        float a = pow(f, 2.1) * pow(1.0 - vExt, 1.7) * smoothstep(0.0, 0.1, vExt) * smoothstep(0.0, 22.0, vP.y) * smoothstep(0.0, 0.35, vU) * smoothstep(0.0, 0.35, 1.0 - vU);
        a *= step(${ROOM.z0.toFixed(1)}, vP.z) * step(vP.z, ${ROOM.z1.toFixed(1)}) * step(vP.x, ${ROOM.x1.toFixed(1)});
        gl_FragColor = vec4(uColor, a * uAmt);
      }`,
  });
  const shaft = noRaycast(new THREE.Mesh(geo, mat));
  shaft.name = 'lightShaft';
  shaft.frustumCulled = false;
  shaft.renderOrder = 4;

  // dust: every mote lives inside the same prism (so it follows the sun) and wanders on slow sines — all on the GPU
  const N = 84;
  const seed = new Float32Array(N * 4);
  let s = 12345;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < N * 4; i++) seed[i] = rnd();
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3));
  pg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const dustMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      ...shared,
      uAmt: { value: 0 },
      uTime: { value: 0 },
      uViewH: { value: 800 },
      uWin: { value: new THREE.Vector4(x, win.cy, win.cz, 0) },
      uSize: { value: new THREE.Vector2(hw * 2, hh * 2) },
    },
    vertexShader: `
      attribute vec4 aSeed;
      uniform vec3 uDir; uniform float uLen; uniform float uTime; uniform float uViewH; uniform vec4 uWin; uniform vec2 uSize;
      varying float vA;
      void main() {
        vec3 p = vec3(uWin.x, uWin.y + (aSeed.y - 0.5) * uSize.y, uWin.z + (aSeed.x - 0.5) * uSize.x) + uDir * (aSeed.z * 0.92 * uLen);
        float t = uTime;
        p += vec3(sin(t * 0.23 + aSeed.w * 40.0), sin(t * 0.17 + aSeed.x * 30.0) * 0.8, cos(t * 0.19 + aSeed.y * 50.0)) * (5.0 + 8.0 * aSeed.w);
        p.y += sin(t * 0.09 + aSeed.z * 20.0) * 6.0;
        float inside = step(${ROOM.z0.toFixed(1)}, p.z) * step(p.z, ${ROOM.z1.toFixed(1)}) * step(p.x, ${ROOM.x1.toFixed(1)}) * step(4.0, p.y);
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float worldSize = 0.55 + 0.75 * aSeed.w;
        gl_PointSize = max(1.9, projectionMatrix[1][1] * uViewH * 0.5 * worldSize / max(1.0, -mv.z));
        float tw = 0.55 + 0.45 * sin(t * (0.5 + aSeed.w * 0.9) + aSeed.x * 60.0);
        vA = inside * tw * smoothstep(0.0, 0.12, aSeed.z) * (1.0 - smoothstep(0.7, 0.95, aSeed.z));
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uAmt; varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.05, d);
        gl_FragColor = vec4(uColor, a * a * vA * uAmt);
      }`,
  });
  const dust = noRaycast(new THREE.Points(pg, dustMat));
  dust.name = 'dust';
  dust.frustumCulled = false;
  dust.renderOrder = 5;

  const dir = new THREE.Vector3();
  const group = new THREE.Group();
  group.add(shaft, dust);
  return {
    group,
    /** @param {THREE.DirectionalLight} sun  @param {number} strength 0..1 (sun above the horizon, bright light) */
    update(t, sun, strength, shaftScale = 0.1, dustScale = 1) {
      dir.copy(sun.target.position).sub(sun.position).normalize();
      // length until the beam reaches the floor (low sun: long, capped)
      const len = THREE.MathUtils.clamp(win.cy / Math.max(0.14, -dir.y), 80, 420);
      shared.uDir.value.copy(dir);
      shared.uLen.value = len;
      shared.uColor.value.copy(sun.color);
      shaft.visible = dust.visible = strength > 0.01;
      mat.uniforms.uAmt.value = strength * shaftScale;
      dustMat.uniforms.uAmt.value = strength * dustScale;
      dustMat.uniforms.uTime.value = t;
      dustMat.uniforms.uViewH.value = renderer.domElement.height;
    },
    material: mat,
    dustMaterial: dustMat,
  };
}

// ───────────────────────── candle glow (a soft additive halo, strongest in the dark) ─────────────────────────
let glowTex = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,214,140,1)');
  grad.addColorStop(0.25, 'rgba(255,184,96,0.55)');
  grad.addColorStop(1, 'rgba(255,160,70,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

/** Flickering flame + halo for the shelf candle. `flame` is the existing `candleFlame` mesh. */
export function createCandle(flame) {
  const halo = noRaycast(new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, toneMapped: false,
  })));
  halo.position.copy(flame.position);
  halo.position.y += 0.2;
  halo.scale.setScalar(15);
  halo.renderOrder = 6;
  flame.parent.add(halo);
  const base = flame.position.clone();
  const baseScale = flame.scale.clone();
  return {
    halo,
    update(t, dark) {
      const f = 0.55 * Math.sin(t * 9.7) + 0.35 * Math.sin(t * 15.3 + 1.1) + 0.25 * Math.sin(t * 23.0 + 2.4);
      flame.scale.set(baseScale.x * (1 + 0.1 * f), baseScale.y * (1 + 0.17 * f), baseScale.z * (1 + 0.1 * f));
      flame.position.x = base.x + 0.06 * Math.sin(t * 5.3) * (0.6 + 0.4 * f);
      halo.material.opacity = (0.1 + 0.7 * dark) * (0.9 + 0.12 * f);
      halo.scale.setScalar(13 + 4 * dark + 0.5 * f);
    },
  };
}

// ───────────────────────── plant sway (vertex shader patch) ─────────────────────────
const SWAY_KEY = 'ori-sway';
/** Shared uniforms for every swaying material: `time` (seconds) and `amp` (1 = calm, >1 = rustle). */
export function createSway() {
  const uniforms = { uSwayTime: { value: 0 }, uSwayAmp: { value: 1 } };
  const patch = (mat, { base = 36, span = 130 } = {}) => {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uSwayTime = uniforms.uSwayTime;
      sh.uniforms.uSwayAmp = uniforms.uSwayAmp;
      sh.vertexShader = `uniform float uSwayTime; uniform float uSwayAmp;\n${sh.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        float swH = clamp((position.y - ${base.toFixed(1)}) / ${span.toFixed(1)}, 0.0, 1.0);
        float swW = swH * swH;
        float swP = position.y * 0.045 + position.x * 0.11 + position.z * 0.09;
        transformed.x += (sin(uSwayTime * 1.15 + swP) * 0.9 + sin(uSwayTime * 2.3 + swP * 1.7) * 0.35) * swW * uSwayAmp;
        transformed.z += (cos(uSwayTime * 0.95 + swP * 1.3) * 0.7 + sin(uSwayTime * 2.9 + swP) * 0.3) * swW * uSwayAmp;
        transformed.y += sin(uSwayTime * 3.4 + swP * 2.0 + position.x) * 0.18 * swW * uSwayAmp;
      `)}`;
    };
    mat.customProgramCacheKey = () => `${SWAY_KEY}-${base}-${span}`;
    mat.needsUpdate = true;
  };
  return { uniforms, patch };
}
