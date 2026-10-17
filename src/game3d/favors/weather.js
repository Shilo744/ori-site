// "Ori, Can You...?" — the weather (PURE except for createRain). A day may bring ONE afternoon shower: `weatherPlan(seed)` decides if and when, `weatherAt(plan, hour)`
// says how hard it rains, how wet the streets still are (the puddles linger for an hour after) and how grey the sky is. It never changes the gameplay,
// it is only the look (and a soft pitter-patter): the shower is the best moment for a rain check.
import * as THREE from 'three';

const mix = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
function hash(seed, k) { let h = Math.imul((seed | 0) + k * 374761393, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

/** When (if ever) it rains on this day: { rains, start, dur } in game hours. About every second day has a shower, always between 14:30 and 18:30. */
export function weatherPlan(seed = 1) {
  const rains = hash(seed, 1) < 0.5;
  return { rains, start: 14.5 + hash(seed, 2) * 3.2, dur: 0.55 + hash(seed, 3) * 0.6 };
}

/** { rain 0..1 (how hard it falls now), wet 0..1 (how wet the ground is), overcast 0..1 (how grey the sky is) } at a game hour. */
export function weatherAt(plan, hour) {
  if (!plan || !plan.rains) return { rain: 0, wet: 0, overcast: 0 };
  const end = plan.start + plan.dur;
  const rain = smooth((hour - plan.start) / 0.12) * (1 - smooth((hour - (end - 0.2)) / 0.2));
  const soak = smooth((hour - plan.start) / 0.3); // the ground gets wet within ~20 minutes
  const dry = 1 - smooth((hour - end) / 1.2); // and takes an hour to dry
  const wet = Math.min(soak, dry);
  const before = smooth((hour - (plan.start - 0.5)) / 0.5); // the sky greys over half an hour before
  const after = 1 - smooth((hour - end) / 0.8);
  return { rain: clamp01(rain), wet: clamp01(wet), overcast: clamp01(Math.max(rain, Math.min(before, after) * 0.85)) };
}

/** Greys a sky state from skyAt() in place: `o` is the overcast amount. Colours stay linear-ish sRGB triples. */
export function applyOvercast(s, o) {
  if (o <= 0.001) return s;
  const greyOf = (c) => { const l = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11; return [l, l * 1.01, l * 1.03]; };
  const toward = (c, k, dim) => { const g = greyOf(c); return [mix(c[0], g[0] * dim, k), mix(c[1], g[1] * dim, k), mix(c[2], g[2] * dim, k)]; };
  for (const key of ['top', 'mid', 'hor', 'fog', 'hemiS', 'sun', 'cloud']) s[key] = toward(s[key], 0.85 * o, key === 'top' ? 0.72 : key === 'sun' || key === 'cloud' ? 0.85 : 0.88);
  s.key = toward(s.key, 0.7 * o, 0.9);
  s.keyI *= 1 - 0.7 * o;
  s.hemiI *= 1 + 0.25 * o;
  s.fogN *= 1 - 0.5 * o;
  s.fogF *= 1 - 0.45 * o;
  s.exp *= 1 - 0.05 * o;
  s.sunVis *= 1 - o;
  s.lamps = Math.max(s.lamps, 0.55 * o * (s.isDay ? 1 : 0.8));
  s.win = Math.max(s.win, 0.35 * o);
  return s;
}

const RAIN_VERT = /* glsl */ `
attribute vec3 aSeed;
attribute float aEnd;
uniform float uTime; uniform vec3 uCam; uniform float uAlpha; uniform vec2 uWind;
varying float vA;
void main() {
  vec3 box = vec3(46.0, 24.0, 46.0);
  vec3 q = vec3(mod(aSeed.x * box.x - uCam.x - uWind.x * uTime * 0.6, box.x), mod(aSeed.y * box.y - uTime * (16.0 + aSeed.x * 6.0), box.y), mod(aSeed.z * box.z - uCam.z - uWind.y * uTime * 0.6, box.z));
  vec3 p = uCam + vec3(q.x - box.x * 0.5, q.y - 5.0, q.z - box.z * 0.5);
  p += vec3(uWind.x, 0.0, uWind.y) * 0.06 * aEnd * 1.0 + vec3(0.0, 0.85 * aEnd, 0.0);
  vec3 d = p - uCam;
  vA = uAlpha * (1.0 - smoothstep(14.0, 23.0, length(d.xz))) * (0.35 + 0.65 * aSeed.y) * (1.0 - aEnd * 0.7);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const RAIN_FRAG = /* glsl */ `varying float vA; void main() { gl_FragColor = vec4(0.82, 0.88, 0.97, vA * 0.55); }`;

/** The falling rain: a few thousand streaks that live in a box around the camera and fall in the vertex shader (no per-frame CPU work). */
export function createRain({ count = 2600 } = {}) {
  const pos = new Float32Array(count * 6);
  const seed = new Float32Array(count * 6);
  const end = new Float32Array(count * 2);
  let s = 12345;
  const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < count; i++) {
    const a = r(); const b = r(); const c = r();
    for (let k = 0; k < 2; k++) { seed.set([a, b, c], (i * 2 + k) * 3); end[i * 2 + k] = k; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
  g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  const u = { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uAlpha: { value: 0 }, uWind: { value: new THREE.Vector2(2.2, 0.6) } };
  const m = new THREE.ShaderMaterial({ uniforms: u, vertexShader: RAIN_VERT, fragmentShader: RAIN_FRAG, transparent: true, depthWrite: false, fog: false });
  const mesh = new THREE.LineSegments(g, m);
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.name = 'rain';
  return {
    mesh,
    update(camera, t, rain) {
      mesh.visible = rain > 0.01;
      u.uTime.value = t;
      u.uCam.value.copy(camera.position);
      u.uAlpha.value = rain;
    },
    dispose() { g.dispose(); m.dispose(); },
  };
}
