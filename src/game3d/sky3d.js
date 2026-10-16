// NEON DRIFT — the sky: one dome with a gradient, a sun/moon disc with glow, stars and drifting clouds (all in one fragment
// shader, one draw call), plus a PMREM environment map rendered from that same dome so the car and the road reflect the sky.
import * as THREE from 'three';
import { LOOKS } from './biomes.js';

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
}`;

const FRAG = /* glsl */ `
varying vec3 vDir;
uniform vec3 uTop, uMid, uHorizon, uBelow, uSunDir, uSunColor, uCloudLit, uCloudShade;
uniform float uSunSize, uGlow, uPower, uStars, uCover, uTime;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return s;
}

void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col;
  if (h >= 0.0) {
    col = mix(uHorizon, uMid, smoothstep(0.0, 0.3, h));
    col = mix(col, uTop, smoothstep(0.18, 0.95, h));
  } else {
    col = mix(uHorizon, uBelow, smoothstep(0.0, -0.25, h));
  }
  float sd = max(dot(d, uSunDir), 0.0);
  // glow around the sun, a hot core and the disc itself
  col += uSunColor * (pow(sd, 6.0) * 0.28 + pow(sd, 36.0) * 0.5) * uGlow;
  float disc = smoothstep(cos(uSunSize * 1.35), cos(uSunSize), sd);
  col = mix(col, uSunColor * uPower, disc);
  // stars (only high enough above the horizon)
  if (uStars > 0.0 && h > 0.02) {
    vec3 sp = d * 380.0;
    vec3 cell = floor(sp);
    float r = hash3(cell);
    vec3 fp = fract(sp) - 0.5;
    float dot = smoothstep(0.34, 0.0, length(fp + 0.18 * vec3(hash3(cell + 3.1) - 0.5, hash3(cell + 7.7) - 0.5, hash3(cell + 9.3) - 0.5)));
    float tw = 0.65 + 0.35 * sin(uTime * (1.5 + r * 3.0) + r * 40.0);
    float star = step(0.9935, r) * dot * tw * smoothstep(0.02, 0.2, h);
    col += vec3(0.85, 0.9, 1.0) * star * uStars * 1.6;
  }
  // clouds on a plane above the viewer
  if (h > 0.01) {
    vec2 cp = d.xz / (h + 0.18) * 1.6 + vec2(uTime * 0.006, uTime * 0.002);
    float n = fbm(cp * 1.3);
    float c = smoothstep(1.0 - uCover, 1.0 - uCover + 0.28, n);
    float lit = clamp(fbm(cp * 1.3 + uSunDir.xz * 0.15) - n + 0.5, 0.0, 1.0);
    vec3 cc = mix(uCloudShade, uCloudLit, lit * 0.8 + sd * 0.35);
    col = mix(col, cc, c * smoothstep(0.01, 0.2, h) * 0.85);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** Unit vector for a sun placed `el` degrees above the horizon and `az` degrees left/right of the start direction. */
export function sunDirection(look, heading) {
  const el = (look.sun.el * Math.PI) / 180;
  const az = heading + (look.sun.az * Math.PI) / 180;
  const c = Math.cos(el);
  return new THREE.Vector3(Math.cos(az) * c, Math.sin(el), Math.sin(az) * c);
}

/**
 * @param {string} lookId key of LOOKS
 * @param {number} heading start heading of the track (rad): the sun sits ahead of the start line
 */
export function createSky(lookId, heading) {
  const look = LOOKS[lookId];
  const u = {
    uTop: { value: new THREE.Color(look.top) },
    uMid: { value: new THREE.Color(look.mid) },
    uHorizon: { value: new THREE.Color(look.horizon) },
    uBelow: { value: new THREE.Color(look.below) },
    uSunDir: { value: sunDirection(look, heading) },
    uSunColor: { value: new THREE.Color(look.sun.color) },
    uCloudLit: { value: new THREE.Color(look.cloud.lit) },
    uCloudShade: { value: new THREE.Color(look.cloud.shade) },
    uSunSize: { value: look.sun.size },
    uGlow: { value: look.sun.glow },
    uPower: { value: look.sun.power },
    uStars: { value: look.stars },
    uCover: { value: look.cloud.cover },
    uTime: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false });
  let envTarget = null;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(3400, 40, 24), material);
  mesh.renderOrder = -100;
  mesh.frustumCulled = false;
  return {
    mesh,
    material,
    look,
    sunDir: u.uSunDir.value,
    /** Moves the dome with the camera and animates the clouds/stars. */
    update(camera, time) {
      mesh.position.copy(camera.position);
      u.uTime.value = time;
    },
    /** A prefiltered environment map made from the dome (made once per session). */
    makeEnvironment(renderer) {
      const pm = new THREE.PMREMGenerator(renderer);
      const s = new THREE.Scene();
      const m2 = new THREE.Mesh(mesh.geometry, material);
      s.add(m2);
      envTarget = pm.fromScene(s, 0.02, 1, 8000);
      pm.dispose();
      return envTarget.texture;
    },
    dispose() {
      if (envTarget) envTarget.dispose();
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}
