// "Ori, Can You...?" — the sea: one big plane with a water shader. Three travelling waves give the surface a normal (so it catches the sky and the sun), the colour
// goes from clear turquoise at the shore to deep blue, a lacy foam line surges up the sand and back, white caps scatter further out, and the water is
// see-through where it is shallow. West is the sea: the sun sets into it, and at golden hour the glitter runs all the way to the camera.
import * as THREE from 'three';
import { BOUNDS } from './map.js';

const FAR = 700;

const VERT = /* glsl */ `
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = /* glsl */ `
varying vec3 vWorld;
uniform float uTime, uSunVis, uNight, uShore, uOvercast;
uniform vec3 uDeep, uShallow, uSky, uSunDir, uSunCol;
#include <fog_pars_fragment>
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
// a sum of travelling waves: returns the surface normal
vec3 waveNormal(vec2 p, float t, float calm) {
  vec2 g = vec2(0.0);
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 dir = normalize(vec2(1.0 + 0.5 * sin(fi * 2.1), 0.35 * cos(fi * 1.7 + 0.5)));
    float k = 0.55 + fi * 0.75;
    float ph = dot(p, dir) * k - t * (0.8 + fi * 0.4);
    float amp = (0.06 / (1.0 + fi * 1.2)) * calm;
    g += dir * cos(ph) * k * amp;
  }
  g += (vec2(vnoise(p * 2.2 + t * 0.5), vnoise(p * 2.2 - t * 0.4 + 9.0)) - 0.5) * 0.05 * calm;
  return normalize(vec3(-g.x, 1.0, -g.y));
}
void main() {
  vec2 p = vWorld.xz;
  // the water creeps up the sand and falls back
  float surge = 1.4 + sin(uTime * 0.55 + p.y * 0.09) * 1.0 + sin(uTime * 0.93 + p.y * 0.31) * 0.35;
  float d = uShore + surge - vWorld.x; // how far the water reaches past this point, m
  if (d < 0.0) discard;
  vec3 n = waveNormal(p, uTime, 1.0 + 0.6 * uOvercast);
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(V, n), 0.0), 3.0) * 0.5 + 0.02;
  float depth = d + max(0.0, uShore - vWorld.x);
  vec3 col = mix(uShallow, uDeep, smoothstep(0.4, 45.0, depth));
  col *= 0.88 + 0.3 * n.x * n.x * 4.0 + 0.12 * (vnoise(p * 0.8 + uTime * 0.3) - 0.5);
  col = mix(col, uSky * 0.85, fres);
  // the sun's glitter
  vec3 R = reflect(-V, n);
  float sp = pow(max(dot(R, uSunDir), 0.0), 260.0) * uSunVis * (1.0 - uOvercast);
  col += uSunCol * sp * 1.8;
  // foam: a lace at the edge, a trailing line, and a few white caps further out
  float lace = vnoise(p * 1.3 + uTime * 0.35) * 0.6 + vnoise(p * 4.1 - uTime * 0.6) * 0.4;
  float edge = smoothstep(0.7, 0.0, d - lace * 0.9);
  float trail = smoothstep(0.22, 0.0, abs(d - 1.9 - lace * 1.2)) * 0.5 * step(0.5, lace);
  float caps = smoothstep(0.72, 0.9, vnoise(p * vec2(0.12, 0.28) + vec2(-uTime * 0.12, 0.0))) * smoothstep(3.0, 14.0, depth) * 0.55;
  float foam = clamp(edge + trail + caps, 0.0, 1.0);
  col = mix(col, vec3(0.97, 0.98, 1.0) * (1.0 - uNight * 0.55), foam * 0.9);
  float alpha = clamp(d * 0.75, 0.0, 1.0) * 0.93 + foam * 0.07;
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export function createSea() {
  const shore = BOUNDS.x0 - 8;
  const u = {
    uTime: { value: 0 }, uSunVis: { value: 1 }, uNight: { value: 0 }, uOvercast: { value: 0 }, uShore: { value: shore },
    uDeep: { value: new THREE.Color(0x0c6f95) }, uShallow: { value: new THREE.Color(0x58c9c8) }, uSky: { value: new THREE.Color(0.7, 0.85, 1) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 0.95, 0.8) },
  };
  const mat = new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, u]), vertexShader: VERT, fragmentShader: FRAG, fog: true, transparent: true });
  // (merge clones the uniform objects: keep the live ones in mat.uniforms)
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(FAR + 12, FAR * 2, 1, 1), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(shore - FAR / 2 + 8, -0.12, 0); // it reaches 8 m up the beach: the surge needs somewhere to go
  mesh.name = 'sea';
  mesh.renderOrder = 2;
  const U = mat.uniforms;
  return {
    mesh,
    update(time, sky, overcast = 0) {
      U.uTime.value = time;
      U.uOvercast.value = overcast;
      if (!sky) return;
      const day = 1 - sky.night;
      U.uNight.value = sky.night;
      U.uSunVis.value = sky.sunVis;
      U.uSunDir.value.set(sky.sunDir[0], sky.sunDir[1], sky.sunDir[2]);
      U.uSunCol.value.setRGB(sky.sun[0], sky.sun[1], sky.sun[2]);
      U.uSky.value.setRGB(sky.hor[0] * 0.9 + 0.05, sky.hor[1] * 0.92 + 0.06, sky.hor[2] * 0.95 + 0.08);
      const g = 1 - overcast * 0.35;
      U.uDeep.value.setRGB((0.05 + 0.04 * day) * g, 0.43 * (1 - sky.night * 0.78) * g, 0.58 * (1 - sky.night * 0.7) * g);
      U.uShallow.value.setRGB(0.34 * (1 - sky.night * 0.7) * g, 0.79 * (1 - sky.night * 0.78) * g, 0.78 * (1 - sky.night * 0.6) * g);
    },
    dispose() { mesh.geometry.dispose(); mat.dispose(); },
  };
}
