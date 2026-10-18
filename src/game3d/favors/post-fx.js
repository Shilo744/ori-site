// "Ori, Can You...?" — the finishing of every frame, in four small passes on top of the scene render (which also writes a DEPTH texture):
//   1. AO     ambient occlusion from the depth buffer (half resolution, a spiral of 12 taps, depth-aware blur in the next pass): corners, under awnings and
//             balconies, the foot of every wall and every car get their soft contact darkening.
//   2. SCENE  AO applied + a gentle depth of field (the far street and the near foreground soften, Ori stays sharp) + light SHAFTS (a radial march from the sun
//             through the sky pixels that the buildings leave open, strongest at golden hour).
//   3. BLOOM  the standard three bloom on whatever glows (lit windows, signs, lamps, the low sun).
//   4. GRADE  a colour grade that follows the time of day (warm gold at sunset, cool blue at night), a vignette, a hint of film grain, then tone mapping.
// 'medium' uses one AO ring at a third of the resolution and no DOF; 'low' does not use this module at all.
import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

const VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const AO_FRAG = /* glsl */ `
uniform sampler2D tDepth;
uniform mat4 uProj; uniform mat4 uProjInv;
uniform vec2 uRes;
uniform float uRadius; uniform float uIntensity;
varying vec2 vUv;
vec3 viewPos(vec2 uv) { float d = texture2D(tDepth, uv).x; vec4 c = uProjInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return c.xyz / c.w; }
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main() {
  float d0 = texture2D(tDepth, vUv).x;
  if (d0 >= 0.99999) { gl_FragColor = vec4(1.0); return; }
  vec3 P = viewPos(vUv);
  vec3 n = normalize(cross(dFdx(P), dFdy(P)));
  if (dot(n, P) > 0.0) n = -n;
  float rot = ign(gl_FragCoord.xy) * 6.2831853;
  float rpx = uRadius * uProj[1][1] / max(0.5, -P.z) * 0.5; // the radius on the screen, in uv-y units
  float occ = 0.0;
  for (int i = 0; i < SAMPLES; i++) {
    float a = rot + float(i) * 2.3999632;
    float r = (float(i) + 0.5) / float(SAMPLES);
    vec2 off = vec2(cos(a), sin(a)) * (0.15 + 0.85 * r) * rpx * vec2(uRes.y / uRes.x, 1.0);
    vec3 S = viewPos(vUv + off);
    vec3 v = S - P;
    float len = length(v);
    float fall = 1.0 - smoothstep(uRadius * 0.6, uRadius * 1.6, len);
    occ += max(0.0, dot(v / max(len, 1e-4), n) - 0.12) * fall;
  }
  float ao = 1.0 - clamp(occ / float(SAMPLES) * uIntensity, 0.0, 0.85);
  gl_FragColor = vec4(vec3(ao), 1.0);
}`;

const SCENE_FRAG = /* glsl */ `
uniform sampler2D tColor; uniform sampler2D tDepth; uniform sampler2D tAO;
uniform vec2 uRes; uniform vec2 uAoRes;
uniform float uNear; uniform float uFar;
uniform float uAoMix; uniform float uFocus; uniform float uDof;
uniform vec2 uSunUv; uniform float uShafts; uniform vec3 uSunCol;
varying vec2 vUv;
float lin(float d) { return (2.0 * uNear * uFar) / (uFar + uNear - (2.0 * d - 1.0) * (uFar - uNear)); }
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
float aoAt(vec2 uv, float z) {
  // a depth-aware blur of the half-resolution AO
  float sum = 0.0; float wsum = 0.0;
  vec2 px = 1.0 / uAoRes;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 q = uv + vec2(float(i), float(j)) * px * 1.5;
    float zq = lin(texture2D(tDepth, q).x);
    float w = exp(-abs(zq - z) * 2.5 / max(1.0, z * 0.25)) * (1.0 - 0.15 * float(abs(i) + abs(j)));
    sum += texture2D(tAO, q).x * w; wsum += w;
  }
  return sum / max(wsum, 1e-4);
}
// a NaN / Inf pixel (a hot specular, a zero-length normal) would smear through the bloom's blur chain as a big black block: never let one out
vec3 safe(vec3 c) { return (isnan(c.x + c.y + c.z) || isinf(c.x + c.y + c.z)) ? vec3(0.0) : min(c, vec3(32.0)); }
void main() {
  float d = texture2D(tDepth, vUv).x;
  float z = lin(d);
  bool sky = d >= 0.99999;
  // depth of field: soft far field, a little near field
  float coc = 0.0;
  if (uDof > 0.0 && !sky) coc = clamp(max((z - uFocus * 3.0) / (uFocus * 7.0), (uFocus * 0.45 - z) / (uFocus * 0.45) * 0.6), 0.0, 1.0);
  vec3 col;
  if (coc > 0.02) {
    col = vec3(0.0); float wsum = 0.0;
    float rad = coc * uDof * 4.0;
    float rot = ign(gl_FragCoord.xy) * 6.2831853;
    for (int i = 0; i < 10; i++) {
      float a = rot + float(i) * 2.3999632; float r = sqrt((float(i) + 0.5) / 10.0);
      vec2 q = vUv + vec2(cos(a), sin(a)) * r * rad / uRes;
      float zq = lin(texture2D(tDepth, q).x);
      float w = (zq > z - 2.0 || coc > 0.4) ? 1.0 : 0.15; // do not smear a near thing over a far one
      col += safe(texture2D(tColor, q).rgb) * w; wsum += w;
    }
    col += safe(texture2D(tColor, vUv).rgb); wsum += 1.0;
    col /= wsum;
  } else col = safe(texture2D(tColor, vUv).rgb);
  if (!sky && uAoMix > 0.0) {
    float ao = aoAt(vUv, z);
    col *= mix(1.0, ao, uAoMix);
  }
  // light shafts: march towards the sun and count the open sky on the way
  if (uShafts > 0.001) {
    vec2 toSun = uSunUv - vUv;
    float dist = length(toSun);
    float acc = 0.0;
    float j = ign(gl_FragCoord.xy + 7.0);
    for (int i = 0; i < SHAFT_TAPS; i++) {
      float t = (float(i) + j) / float(SHAFT_TAPS);
      vec2 p = vUv + toSun * t * 0.85;
      if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) continue;
      acc += step(0.99999, texture2D(tDepth, p).x) * (1.0 - t * 0.6);
    }
    float rays = acc / float(SHAFT_TAPS) * smoothstep(1.3, 0.05, dist);
    col += uSunCol * rays * uShafts * (sky ? 0.25 : 1.0);
  }
  gl_FragColor = vec4(safe(col), 1.0);
}`;

const GRADE_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform vec3 uTint; uniform float uSat; uniform float uContrast; uniform float uVignette; uniform float uGrain; uniform float uTime;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tColor, vUv).rgb * uTint;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSat);
  c = max(vec3(0.0), (c - 0.18) * uContrast + 0.18);
  vec2 q = vUv - 0.5;
  c *= 1.0 - uVignette * smoothstep(0.35, 0.95, length(q * vec2(1.15, 1.0)) * 1.25);
  float g = fract(sin(dot(vUv * 913.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  c += g * uGrain * (0.25 + l);
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const mkMat = (frag, uniforms, defines = {}) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, defines, depthTest: false, depthWrite: false });

/**
 * @param {THREE.WebGLRenderer} renderer @param {THREE.Scene} scene @param {THREE.PerspectiveCamera} camera
 * @param {{ tier?: 'high'|'medium', bloom?: { strength: number, radius: number, threshold: number } }} o
 */
export function createFavorsPost(renderer, scene, camera, { tier = 'high', bloom = { strength: 0.32, radius: 0.55, threshold: 0.9 } } = {}) {
  const high = tier === 'high';
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const W = Math.max(2, size.x);
  const H = Math.max(2, size.y);
  const aoScale = high ? 0.5 : 0.34;

  const depth = new THREE.DepthTexture(W, H);
  depth.type = THREE.UnsignedIntType;
  const rtScene = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: high ? 4 : 0, depthTexture: depth });
  const rtAO = new THREE.WebGLRenderTarget(Math.ceil(W * aoScale), Math.ceil(H * aoScale), { type: THREE.UnsignedByteType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
  const rtMix = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, depthBuffer: false });

  const aoU = {
    tDepth: { value: depth }, uProj: { value: new THREE.Matrix4() }, uProjInv: { value: new THREE.Matrix4() },
    uRes: { value: new THREE.Vector2(rtAO.width, rtAO.height) }, uRadius: { value: 1.3 }, uIntensity: { value: high ? 2.4 : 2.0 },
  };
  const sceneU = {
    tColor: { value: rtScene.texture }, tDepth: { value: depth }, tAO: { value: rtAO.texture },
    uRes: { value: new THREE.Vector2(W, H) }, uAoRes: { value: new THREE.Vector2(rtAO.width, rtAO.height) },
    uNear: { value: camera.near }, uFar: { value: camera.far },
    uAoMix: { value: 1 }, uFocus: { value: 9 }, uDof: { value: high ? Math.max(0.6, H / 1080) : 0 },
    uSunUv: { value: new THREE.Vector2(0.5, 0.5) }, uShafts: { value: 0 }, uSunCol: { value: new THREE.Color(1, 0.85, 0.6) },
  };
  const gradeU = {
    tColor: { value: rtMix.texture }, uTint: { value: new THREE.Color(1, 1, 1) }, uSat: { value: 1.06 }, uContrast: { value: 1.05 },
    uVignette: { value: 0.22 }, uGrain: { value: 0.012 }, uTime: { value: 0 },
  };
  const aoMat = mkMat(AO_FRAG, aoU, { SAMPLES: high ? 14 : 8 });
  const sceneMat = mkMat(SCENE_FRAG, sceneU, { SHAFT_TAPS: high ? 22 : 12 });
  const gradeMat = mkMat(GRADE_FRAG, gradeU);
  const quad = new FullScreenQuad(aoMat);
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(W, H), bloom.strength, bloom.radius, bloom.threshold);
  const sunV = new THREE.Vector3();
  let time = 0;

  return {
    bloomPass,
    uniforms: { ao: aoU, scene: sceneU, grade: gradeU },
    /**
     * look: { tint: [r,g,b], sat, contrast, vignette } the colour grade; sun: { dir: [x,y,z], color: [r,g,b], shafts: 0..1 } for the light shafts;
     * focus: the distance (m) that stays sharp (Ori); ao: 0..1 how strong the occlusion is.
     */
    setLook({ tint, sat, contrast, vignette, sun, focus, ao, bloomStrength } = {}) {
      if (tint) gradeU.uTint.value.setRGB(tint[0], tint[1], tint[2]);
      if (sat != null) gradeU.uSat.value = sat;
      if (contrast != null) gradeU.uContrast.value = contrast;
      if (vignette != null) gradeU.uVignette.value = vignette;
      if (focus != null) sceneU.uFocus.value = Math.max(3, focus);
      if (ao != null) sceneU.uAoMix.value = ao;
      if (bloomStrength != null) bloomPass.strength = bloomStrength;
      if (sun) {
        sunV.set(sun.dir[0], sun.dir[1], sun.dir[2]).multiplyScalar(500).add(camera.position).project(camera);
        const front = sunV.z < 1;
        sceneU.uSunUv.value.set(sunV.x * 0.5 + 0.5, sunV.y * 0.5 + 0.5);
        sceneU.uShafts.value = front ? sun.shafts : 0;
        sceneU.uSunCol.value.setRGB(sun.color[0], sun.color[1], sun.color[2]);
      }
    },
    render(dt) {
      time += dt;
      sceneU.uNear.value = camera.near;
      sceneU.uFar.value = camera.far;
      aoU.uProj.value.copy(camera.projectionMatrix);
      aoU.uProjInv.value.copy(camera.projectionMatrixInverse);
      // 1. the scene (colour + depth)
      renderer.setRenderTarget(rtScene);
      renderer.clear();
      renderer.render(scene, camera);
      // 2. ambient occlusion from the depth
      quad.material = aoMat;
      renderer.setRenderTarget(rtAO);
      quad.render(renderer);
      // 3. AO + depth of field + shafts
      quad.material = sceneMat;
      renderer.setRenderTarget(rtMix);
      quad.render(renderer);
      // 4. bloom (added onto the same target)
      bloomPass.render(renderer, null, rtMix, dt, false);
      // 5. the grade, tone mapping and sRGB, to the screen
      gradeU.uTime.value = time % 7.0;
      quad.material = gradeMat;
      renderer.setRenderTarget(null);
      quad.render(renderer);
    },
    setSize(w, h) {
      const p = renderer.getPixelRatio();
      const pw = Math.max(2, Math.floor(w * p));
      const ph = Math.max(2, Math.floor(h * p));
      rtScene.setSize(pw, ph);
      depth.image.width = pw; depth.image.height = ph;
      rtAO.setSize(Math.ceil(pw * aoScale), Math.ceil(ph * aoScale));
      rtMix.setSize(pw, ph);
      bloomPass.setSize(pw, ph);
      aoU.uRes.value.set(rtAO.width, rtAO.height);
      sceneU.uRes.value.set(pw, ph);
      sceneU.uAoRes.value.set(rtAO.width, rtAO.height);
      sceneU.uDof.value = high ? Math.max(0.6, ph / 1080) : 0;
    },
    dispose() {
      rtScene.dispose(); rtAO.dispose(); rtMix.dispose(); depth.dispose();
      aoMat.dispose(); sceneMat.dispose(); gradeMat.dispose();
      bloomPass.dispose();
      quad.dispose();
    },
  };
}
