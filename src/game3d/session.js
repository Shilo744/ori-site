// NEON DRIFT — the 3D side of one track: scene, world, camera, post-processing and the car meshes. It owns no game rules (the
// controller in game.js drives the runner and moves the camera); `render(dt, fx)` draws one frame. Dispose it to release the GPU.
import * as THREE from 'three';
import { generateTrack } from './track.js';
import { buildWorld } from './world.js';
import { BIOMES } from './biomes.js';
import { createCarMesh, createCarKit } from './car-mesh.js';
import { createPost } from './post.js';

/**
 * @param {object} o
 * @param {THREE.WebGLRenderer} o.renderer
 * @param {string} [o.biome] 'city' | 'desert' | 'coast' (picks the seeded track and the look)
 * @param {number} [o.seed] overrides the biome's track seed
 * @param {string} [o.look] 'night' | 'sunset' | 'dawn' | 'noon' (overrides the biome's look)
 * @param {string} [o.tier] 'high' | 'medium' | 'low'
 */
export function createSession({ renderer, biome: biomeId = 'city', seed, look, tier = 'high' }) {
  const biome = BIOMES[biomeId] || BIOMES.city;
  seed = seed ?? biome.seed;
  const track = generateTrack(seed);
  const scene = new THREE.Scene();
  const size = renderer.getSize(new THREE.Vector2());
  const camera = new THREE.PerspectiveCamera(62, size.x / Math.max(1, size.y), 0.3, 6000);

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const world = buildWorld(scene, { track, biome, lookId: look, renderer, tier });
  renderer.toneMappingExposure = world.look.exposure;
  const kit = createCarKit();
  const post = tier === 'low' ? null : createPost(renderer, scene, camera, { tier, bloom: world.look.bloom });
  const meshes = new Set();
  const night = world.look.stars > 0.5;

  const api = {
    track, scene, camera, world, biome, seed, tier, kit, post, night,
    /** A car mesh in this scene. `lite` rivals skip the headlight beams. */
    addCar({ type = 'gt', paint = 0xff2d6f, ghost = false, lite = false } = {}) {
      const mesh = createCarMesh({ type, paint, glow: biome.road.neonL, beam: ghost || lite ? 0 : night ? 0.38 : 0.12, kit, ghost });
      scene.add(mesh.group);
      meshes.add(mesh);
      return mesh;
    },
    removeCar(mesh) {
      if (!meshes.delete(mesh)) return;
      scene.remove(mesh.group);
      mesh.dispose();
    },
    /** Draws one frame from the current camera. `speed01` drives the speed blur, `focusS` the tunnel darkening. */
    render(dt, speed01 = 0, focusS = 0) {
      world.update(camera, performance.now() / 1000, focusS);
      renderer.info.reset(); // stats() then covers every pass of the frame
      if (post) post.render(dt, speed01);
      else renderer.render(scene, camera);
    },
    resize(w, h) {
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      if (post) post.setSize(w, h);
    },
    /** Releases every GPU resource this session created. */
    dispose() {
      for (const m of meshes) { scene.remove(m.group); m.dispose(); }
      meshes.clear();
      kit.dispose();
      if (post) post.dispose();
      world.dispose();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        for (const m of mats) {
          for (const k of ['map', 'alphaMap', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'envMap']) if (m[k]) m[k].dispose();
          m.dispose();
        }
        if (o.isInstancedMesh) o.dispose();
      });
      scene.clear();
    },
  };
  return api;
}
