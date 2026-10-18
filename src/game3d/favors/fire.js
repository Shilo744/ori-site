// "Ori, Can You...?" — the afterburner flames of Ori's car: a pool of additive glow points that shoot out of the tail while he boosts, burn from white-yellow to orange to red and
// fade. One Points object, no textures (the glow is a soft round falloff in the fragment shader).
import * as THREE from 'three';

const N = 160;
const VERT = /* glsl */ `
attribute float aLife; attribute float aSize;
varying float vLife;
uniform float uScale;
void main() {
  vLife = aLife;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aLife > 0.0 ? aSize * (1.0 - 0.55 * (1.0 - aLife)) * uScale / max(0.5, -mv.z) : 0.0;
}`;
const FRAG = /* glsl */ `
varying float vLife;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float d = length(q) * 2.0;
  if (d > 1.0 || vLife <= 0.0) discard;
  float glow = pow(1.0 - d, 1.6);
  vec3 hot = vec3(1.0, 0.95, 0.65);
  vec3 mid = vec3(1.0, 0.5, 0.12);
  vec3 cool = vec3(0.85, 0.12, 0.05);
  vec3 c = vLife > 0.6 ? mix(mid, hot, (vLife - 0.6) / 0.4) : mix(cool, mid, vLife / 0.6);
  gl_FragColor = vec4(c * (0.6 + 1.2 * glow), glow * min(1.0, vLife * 1.6));
}`;

export function createFire(scene, { height = 700 } = {}) {
  const pos = new Float32Array(N * 3);
  const life = new Float32Array(N);
  const size = new Float32Array(N);
  const vel = new Float32Array(N * 3);
  const max = new Float32Array(N).fill(0.4);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aLife', new THREE.BufferAttribute(life, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uScale: { value: height } } });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  let head = 0;
  return {
    /** One flame particle at (x, y, z) with a velocity (m/s). */
    emit(x, y, z, vx, vy, vz, s = 0.7) {
      const i = head;
      head = (head + 1) % N;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
      max[i] = 0.28 + Math.random() * 0.22;
      life[i] = 1;
      size[i] = s * (0.7 + Math.random() * 0.6);
    },
    setHeight(h) { mat.uniforms.uScale.value = h; },
    update(dt) {
      for (let i = 0; i < N; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt / max[i];
        if (life[i] <= 0) { life[i] = 0; continue; }
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        vel[i * 3 + 1] += 1.2 * dt; // the heat rises a little
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aLife.needsUpdate = true;
      geo.attributes.aSize.needsUpdate = true;
    },
    dispose() { scene.remove(pts); geo.dispose(); mat.dispose(); },
  };
}
