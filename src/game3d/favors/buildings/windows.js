// "Ori, Can You...?" — window glass with INTERIOR MAPPING: every window is a flat quad, but the fragment shader ray-casts into an imaginary room behind it
// (floor, ceiling, side walls, back wall with a picture, a sofa, a lamp; shops get shelves, a counter and hanging lights), so the rooms have real parallax
// as the camera moves. Each window has its own room (colour, depth, curtains / blinds) from a seed in the vertex data; lit rooms glow at dusk.
//   aLit  = kind + 4 * seed(0..250): kind 0 = dark glass (a door), 1 = a room whose light is on in the evening, 2 = a shop (lit all day)
//   aSize = width(dm) * 100 + height(dm), in decimetres (so the room has the right proportions)
import * as THREE from 'three';

const VERT_HEAD = /* glsl */ `
attribute float aLit;
attribute float aSize;
varying float vLit;
varying float vSize;
varying vec3 vWorld;
varying vec3 vWN;
varying vec2 vWUv;
`;

const FRAG = /* glsl */ `
varying float vLit;
varying float vSize;
varying vec3 vWorld;
varying vec3 vWN;
varying vec2 vWUv;
uniform float uWin;     // how many lit rooms glow (0 by day .. 1 at night)
uniform float uDay;     // 0 night .. 1 full day
uniform vec3 uGlass;    // what the glass reflects (sky)
float h1(float n) { return fract(sin(n * 127.1 + 11.7) * 43758.5453); }
vec2 h2(float n) { return vec2(h1(n), h1(n + 17.31)); }
vec3 pal(float k) {
  k = floor(k * 8.0);
  if (k < 1.0) return vec3(0.93, 0.86, 0.74);
  if (k < 2.0) return vec3(0.88, 0.70, 0.62);
  if (k < 3.0) return vec3(0.70, 0.82, 0.72);
  if (k < 4.0) return vec3(0.68, 0.78, 0.88);
  if (k < 5.0) return vec3(0.95, 0.90, 0.66);
  if (k < 6.0) return vec3(0.85, 0.72, 0.84);
  if (k < 7.0) return vec3(0.96, 0.95, 0.92);
  return vec3(0.60, 0.72, 0.70);
}
// the room behind a window
vec3 room(vec3 o, vec3 dir, float W, float H, float seed, float kind, out float lightK) {
  float D = mix(2.8, 4.6, h1(seed * 3.1));
  float dx = abs(dir.x) < 1e-4 ? 1e-4 : dir.x;
  float dy = abs(dir.y) < 1e-4 ? 1e-4 : dir.y;
  float tx = dx > 0.0 ? (W - o.x) / dx : (0.0 - o.x) / dx;
  float ty = dy > 0.0 ? (H - o.y) / dy : (0.0 - o.y) / dy;
  float tz = -D / min(dir.z, -1e-3);
  float t = min(min(tx, ty), tz);
  vec3 p = o + dir * t;
  vec3 wallC = pal(h1(seed * 5.7));
  vec3 col;
  float shade = 1.0 - 0.45 * clamp(t / (D * 1.3), 0.0, 1.0);
  lightK = 1.0;
  bool shop = kind > 1.5;
  if (t == tz) { // the back wall
    float u = p.x / W; float v = p.y / H;
    col = wallC;
    if (shop) {
      // shelves: a grid of coloured goods on three shelves
      vec2 cell = floor(vec2(u * 11.0, v * 5.0));
      float on = step(0.22, h1(dot(cell, vec2(12.9, 78.2)) + seed));
      vec3 g = pal(h1(dot(cell, vec2(3.7, 9.1)) + seed * 2.0));
      float shelf = step(0.08, fract(v * 5.0)) * step(fract(v * 5.0), 0.88);
      col = mix(vec3(0.42, 0.30, 0.2), g * 0.95, on * shelf * step(0.12, v));
      col = mix(col, vec3(0.30, 0.22, 0.16), 1.0 - shelf);
    } else {
      vec2 pic = h2(seed * 9.0);
      if (u > 0.2 + pic.x * 0.15 && u < 0.38 + pic.x * 0.15 && v > 0.42 && v < 0.74) col = mix(col, pal(h1(seed * 2.2)) * 0.75, 0.9); // a picture
      if (u > 0.62 && u < 0.84 && v < 0.86 && h1(seed * 4.4) < 0.45) col = vec3(0.30, 0.25, 0.22); // a doorway
      if (v < 0.30 && u > 0.08 && u < 0.58) col = mix(pal(h1(seed * 6.6)) * 0.6, vec3(0.22), 0.3); // a sofa / bed
      if (length(vec2((u - 0.8) * W, (v - 0.55) * H)) < 0.22 && h1(seed * 8.8) < 0.5) { col = vec3(1.0, 0.92, 0.7); lightK = 1.6; } // a lamp
    }
    col *= shade * (shop ? 1.0 : 0.95);
  } else if (t == ty) { // floor or ceiling
    if (dir.y < 0.0) { // floor: warm wood, boards across
      float b = smoothstep(0.02, 0.22, fract(p.x * 1.6 + floor(p.z * 2.2) * 0.37));
      col = mix(vec3(0.43, 0.29, 0.19), vec3(0.50, 0.34, 0.22), b) * (shop ? 0.9 : 1.0);
      if (shop) col = mix(col, vec3(0.72, 0.64, 0.52), 0.55);
    } else { // ceiling with a glowing light patch
      col = vec3(0.92, 0.9, 0.86);
      float d = length(vec2(p.x - W * 0.5, p.z + D * 0.5));
      col += vec3(1.0, 0.85, 0.55) * smoothstep(0.9, 0.2, d) * 1.2;
    }
    col *= shade;
  } else { // a side wall
    col = wallC * 0.9 * shade;
    float u = -p.z / D;
    if (shop && p.y < H * 0.55 && p.y > 0.25 * H && fract(u * 5.0) < 0.5) col = mix(col, vec3(0.5, 0.38, 0.28), 0.6);
  }
  if (shop) { // the counter near the glass and a row of hanging lamps
    if (o.y < H * 0.3 && dir.z < 0.0) {
      float ct = 0.9 / -dir.z;
      vec3 cp = o + dir * ct;
      if (cp.y < 0.9 && cp.y > 0.0 && cp.x > 0.0 && cp.x < W && cp.z > -1.2) col = mix(col, vec3(0.78, 0.62, 0.42), 0.7);
    }
    lightK = 1.25;
  }
  return col;
}
`;

const COLOR = /* glsl */ `
#include <color_fragment>
{
  vec3 N = normalize(vWN);
  vec3 T = normalize(cross(vec3(0.0, 1.0, 0.0), N));
  vec3 V = normalize(vWorld - cameraPosition);
  vec3 dir = vec3(dot(V, T), V.y, dot(V, N));
  float kind = mod(vLit, 4.0);
  float seed = floor(vLit / 4.0) / 250.0;
  float W = max(0.5, floor(vSize / 100.0) / 10.0);
  float H = max(0.5, mod(vSize, 100.0) / 10.0);
  vec3 o = vec3(vWUv.x * W, vWUv.y * H, 0.0);
  float lightK;
  vec3 rc = room(o, dir, W, H, seed, kind, lightK);
  bool shop = kind > 1.5;
  float lit = shop ? 1.0 : step(0.5, kind) * smoothstep(0.3, 0.85, uWin);
  // daylight reaches the room through the window; a lit room shines warm
  vec3 day = rc * (0.16 + 0.55 * uDay);
  vec3 warm = rc * vec3(1.45, 1.1, 0.72) * lightK;
  vec3 inside = mix(day, warm, shop ? mix(0.55, 1.0, 1.0 - uDay) : lit);
  if (kind < 0.5) inside = rc * (0.05 + 0.2 * uDay);
  // curtains and blinds
  float cs = h1(seed * 21.0);
  if (!shop) {
    if (cs < 0.3 && vWUv.x < 0.34) inside = mix(inside, pal(h1(seed * 31.0)) * (0.2 + 0.4 * uDay + 0.8 * lit), 0.9);
    else if (cs > 0.84 && vWUv.y > 0.25 + 0.45 * h1(seed * 41.0)) inside = mix(inside, vec3(0.78, 0.75, 0.68) * (0.3 + 0.5 * uDay + 0.8 * lit), 0.55 + 0.35 * smoothstep(0.3, 0.7, abs(fract(vWUv.y * 7.0) - 0.5) * 2.0));
  }
  // reflections: the sky in the glass, stronger at a grazing angle
  float fres = 0.08 + 0.62 * pow(1.0 - clamp(abs(dir.z), 0.0, 1.0), 3.0);
  vec3 refl = uGlass * (0.7 + 0.5 * vWUv.y);
  diffuseColor.rgb = mix(inside, refl, fres) * diffuseColor.rgb;
}
`;

/** The window material + the uniforms the light of the day drives. */
export function createWindowMaterial() {
  const uniforms = { uWin: { value: 0 }, uDay: { value: 1 }, uGlass: { value: new THREE.Color(0.45, 0.55, 0.65) } };
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_HEAD}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vLit = aLit; vSize = aSize; vWUv = uv;
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        vWN = normalize(mat3(modelMatrix) * normal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG}`)
      .replace('#include <color_fragment>', COLOR);
  };
  mat.customProgramCacheKey = () => 'favors-window-v1';
  return { material: mat, uniforms };
}
