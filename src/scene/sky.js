// The sky seen through the window: one ShaderMaterial (gradient + sun/moon discs + stars + drifting clouds +
// a skyline with lit windows). Everything that changes with the time of day is a uniform, so the daylight
// system (daylight.js) never regenerates a texture — the only texture is the static skyline mask.
import * as THREE from 'three';

const rng = (seed) => {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
};

/**
 * Skyline mask (1024×512, data texture): R = building layer shade (far = light, near = dark), G = lit-window mask, A = silhouette.
 * The shader decides the actual colours, so the same texture serves day, dusk and night.
 */
function skylineMask() {
  const W = 1024, H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const r = rng(11);
  const layers = [
    { shade: 235, min: 70, max: 190, win: 0.22 },
    { shade: 140, min: 50, max: 150, win: 0.4 },
  ];
  for (const L of layers) {
    let x = -20;
    while (x < W) {
      const bw = 40 + r() * 70, bh = L.min + r() * (L.max - L.min);
      g.fillStyle = `rgb(${L.shade},0,0)`;
      g.fillRect(x, H - bh, bw, bh);
      // rooftop detail on a few towers
      if (r() > 0.72) g.fillRect(x + bw * 0.4, H - bh - 16, 3, 16);
      // windows: a grid, some of them lit at night
      for (let wy = H - bh + 10; wy < H - 8; wy += 11) {
        for (let wx = x + 7; wx < x + bw - 8; wx += 9) {
          if (r() < L.win) {
            g.fillStyle = `rgb(${L.shade},255,0)`;
            g.fillRect(wx, wy, 4, 5);
          }
        }
      }
      x += bw + r() * 6;
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace; // data, not colour
  t.anisotropy = 4;
  return t;
}

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
uniform vec3 uTop, uHorizon, uSunGlow, uCloudCol;
uniform vec2 uSun, uMoon;
uniform float uSunVis, uMoonVis, uStars, uCloudA, uWin, uTime, uNight;
uniform sampler2D tCity;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return s;
}

void main() {
  vec2 uv = vUv;
  const vec2 aspect = vec2(1.52, 1.0);

  // sky gradient: warm horizon → zenith
  float h = smoothstep(0.1, 0.98, uv.y);
  vec3 col = mix(uHorizon, uTop, pow(h, 0.75));

  // stars (twinkle), only high in the sky
  vec2 sp = uv * aspect * 170.0;
  vec2 id = floor(sp);
  float rnd = hash(id);
  float star = step(0.987, rnd) * (0.55 + 0.45 * sin(uTime * 1.6 + rnd * 80.0));
  star *= smoothstep(0.28, 0.75, uv.y) * smoothstep(0.5, 0.0, length(fract(sp) - 0.5));
  col += vec3(star) * uStars;

  // sun: glow + disc
  float ds = length((uv - uSun) * aspect);
  col += uSunGlow * (exp(-ds * 5.5) * 0.7 + exp(-ds * 18.0) * 0.8) * uSunVis;
  col = mix(col, vec3(1.0, 0.97, 0.88) * 1.4, smoothstep(0.052, 0.045, ds) * uSunVis);

  // moon: soft glow + a crescent made from two discs
  float dm = length((uv - uMoon) * aspect);
  col += vec3(0.55, 0.65, 0.95) * exp(-dm * 9.0) * 0.5 * uMoonVis;
  float disc = smoothstep(0.034, 0.031, dm);
  float bite = smoothstep(0.03, 0.027, length((uv - uMoon - vec2(0.012, 0.006)) * aspect));
  col = mix(col, vec3(0.93, 0.95, 1.0), clamp(disc - bite * 0.88, 0.0, 1.0) * uMoonVis);

  // clouds drifting slowly
  vec2 cp = vec2(uv.x * aspect.x * 2.2 + uTime * 0.012, uv.y * 2.6);
  float cl = fbm(cp + vec2(0.0, uTime * 0.002));
  cl = smoothstep(0.5, 0.82, cl) * smoothstep(0.16, 0.5, uv.y) * (1.0 - smoothstep(0.82, 1.0, uv.y));
  vec3 cloudCol = uCloudCol * (0.85 + 0.15 * smoothstep(0.5, 0.82, fbm(cp * 1.7 + 4.0)));
  col = mix(col, cloudCol, cl * uCloudA);

  // skyline: silhouettes tinted by time of day, lit windows after dark
  vec4 city = texture2D(tCity, uv);
  vec3 farDay = mix(uHorizon, vec3(0.62, 0.7, 0.8), 0.55);
  vec3 nearDay = mix(uHorizon, vec3(0.45, 0.53, 0.64), 0.65);
  vec3 farNight = vec3(0.045, 0.06, 0.11);
  vec3 nearNight = vec3(0.025, 0.033, 0.065);
  vec3 bFar = mix(farDay, farNight, uNight);
  vec3 bNear = mix(nearDay, nearNight, uNight);
  vec3 bcol = mix(bNear, bFar, smoothstep(0.45, 0.8, city.r));
  col = mix(col, bcol, city.a);
  float lit = city.g * city.a * uWin * (0.72 + 0.28 * hash(floor(uv * vec2(190.0, 100.0))));
  col += vec3(1.0, 0.78, 0.45) * lit * 1.15;

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

/** Creates the sky material; `daylight.js` drives its uniforms. */
export function createSkyMaterial() {
  const U = (v) => ({ value: v });
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTop: U(new THREE.Color(0x58a2f0)),
      uHorizon: U(new THREE.Color(0xd4eafb)),
      uSunGlow: U(new THREE.Color(0xfff6dd)),
      uCloudCol: U(new THREE.Color(0xffffff)),
      uSun: U(new THREE.Vector2(0.5, 0.5)),
      uMoon: U(new THREE.Vector2(0.5, -1)),
      uSunVis: U(1),
      uMoonVis: U(0),
      uStars: U(0),
      uCloudA: U(0.6),
      uWin: U(0),
      uTime: U(0),
      uNight: U(0),
      tCity: U(skylineMask()),
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    toneMapped: false,
    depthWrite: true,
  });
  return mat;
}
