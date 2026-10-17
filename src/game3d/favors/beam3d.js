// "Ori, Can You...?" — the beam of light over the place of the task Ori is following, with a pulsing ring on the ground. One cylinder + one
// ring, additive, no depth write: it reads from across the neighbourhood and never hides anything.
import * as THREE from 'three';

const VERT = /* glsl */ `varying vec2 vUv; varying vec3 vW; void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FRAG = /* glsl */ `
varying vec2 vUv; varying vec3 vW;
uniform float uTime; uniform vec3 uColor; uniform float uAlpha;
void main() {
  float h = vUv.y;                                   // 0 at the ground, 1 at the top
  float fade = pow(1.0 - h, 1.6);
  float stripes = 0.65 + 0.35 * sin(vUv.x * 40.0 + uTime * 1.6) * sin(h * 18.0 - uTime * 2.4);
  float edge = 0.55 + 0.45 * sin(vUv.x * 6.2831 * 2.0);
  gl_FragColor = vec4(uColor, fade * stripes * edge * uAlpha);
}`;

export function createBeam({ color = 0xffa24a } = {}) {
  const group = new THREE.Group();
  group.name = 'beam';
  group.visible = false;
  const u = { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uAlpha: { value: 0.55 } };
  const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const beamGeo = new THREE.CylinderGeometry(1.05, 1.25, 46, 20, 1, true);
  const beam = new THREE.Mesh(beamGeo, mat);
  beam.position.y = 23;
  beam.frustumCulled = false;
  const ringGeo = new THREE.RingGeometry(1.5, 2.05, 40);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8, fog: false });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.y = 0.06;
  group.add(beam, ring);
  return {
    group,
    /** Stands the beam over (x, z) at ground height y. */
    set(x, z, y = 0) { group.position.set(x, y, z); group.visible = true; },
    hide() { group.visible = false; },
    get visible() { return group.visible; },
    update(time) {
      u.uTime.value = time;
      const p = 1 + 0.12 * Math.sin(time * 3.2);
      ring.scale.set(p, 1, p);
      ringMat.opacity = 0.55 + 0.25 * Math.sin(time * 3.2);
    },
    dispose() { beamGeo.dispose(); ringGeo.dispose(); mat.dispose(); ringMat.dispose(); },
  };
}
