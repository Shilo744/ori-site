// NEON DRIFT — post-processing: HDR scene -> bloom -> speed FX (radial blur + chromatic aberration + vignette) -> ACES tone
// mapping / sRGB. The 'high' tier renders with 4x MSAA, 'medium' without; 'low' does not use this module at all (the renderer
// draws straight to the canvas with the same tone mapping).
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const SpeedShader = {
  uniforms: { tDiffuse: { value: null }, uSpeed: { value: 0 }, uVignette: { value: 0.35 }, uAberration: { value: 0.0016 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uSpeed, uVignette, uAberration;
    varying vec2 vUv;
    void main() {
      vec2 c = vUv - 0.5;
      float r = length(c);
      float ca = (uAberration + 0.0035 * uSpeed) * r * 2.0;
      float blur = uSpeed * 0.05 * smoothstep(0.08, 0.75, r);
      vec3 col;
      if (blur < 0.0006) {
        col = vec3(texture2D(tDiffuse, 0.5 + c * (1.0 + ca)).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, 0.5 + c * (1.0 - ca)).b);
      } else {
        col = vec3(0.0);
        for (int i = 0; i < 8; i++) {
          float t = float(i) / 7.0;
          vec2 q = c * (1.0 - blur * t);
          col += vec3(texture2D(tDiffuse, 0.5 + q * (1.0 + ca)).r, texture2D(tDiffuse, 0.5 + q).g, texture2D(tDiffuse, 0.5 + q * (1.0 - ca)).b);
        }
        col /= 8.0;
      }
      float vig = 1.0 - uVignette * smoothstep(0.3, 0.9, r * 1.25);
      gl_FragColor = vec4(col * vig, 1.0);
    }`,
};

/**
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera
 * @param {object} o { tier: 'high' | 'medium', bloom: { strength, radius, threshold } }
 */
export function createPost(renderer, scene, camera, { tier = 'high', bloom }) {
  const size = renderer.getSize(new THREE.Vector2());
  const pr = renderer.getPixelRatio();
  const rt = new THREE.WebGLRenderTarget(Math.max(1, size.x * pr), Math.max(1, size.y * pr), { type: THREE.HalfFloatType, samples: tier === 'high' ? 4 : 0 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(size.x * pr, size.y * pr), bloom.strength, bloom.radius, bloom.threshold);
  composer.addPass(bloomPass);
  const fx = new ShaderPass(SpeedShader);
  composer.addPass(fx);
  composer.addPass(new OutputPass());
  return {
    composer,
    bloomPass,
    fx,
    /** speed01: 0 below ~200 km/h, 1 at full speed; boost adds to the blur. */
    render(dt, speed01) {
      fx.uniforms.uSpeed.value = speed01;
      composer.render(dt);
    },
    setSize(w, h) {
      const p = renderer.getPixelRatio();
      composer.setPixelRatio(p);
      composer.setSize(w, h);
    },
    dispose() {
      composer.passes.forEach((p) => p.dispose && p.dispose()); // (EffectComposer.dispose does not dispose its passes)
      composer.dispose();
      rt.dispose();
    },
  };
}
