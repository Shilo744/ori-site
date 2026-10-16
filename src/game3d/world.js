// NEON DRIFT — assembles the whole world of one track: sky + environment map + lights + fog, road, barriers, ground, horizon,
// structures and props. The session calls `update(camera, time)` every frame and `dispose()` on quit.
import * as THREE from 'three';
import { LOOKS } from './biomes.js';
import { createSky } from './sky3d.js';
import { sampleFrames, buildRoadMesh, buildBarriers, buildSupport } from './road3d.js';
import { buildGround, buildHorizon } from './horizon3d.js';
import { asphaltTexture } from './textures3d.js';
import { buildProps } from './props3d.js';
import { buildStructures, buildGantry } from './structures.js';
import { pickZones, zoneDepth, inZone } from './track-zones.js';

/**
 * @param {THREE.Scene} scene
 * @param {object} o { track, biome, lookId, renderer, tier }
 */
export function buildWorld(scene, { track, biome, lookId, renderer, tier = 'high' }) {
  const look = LOOKS[lookId || biome.look];
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const disposables = [];
  const track$ = (o) => { disposables.push(o); return o; };

  // atmosphere
  scene.fog = new THREE.Fog(look.fog.color, look.fog.near, look.fog.far);
  const heading = track.start.psi;
  const sky = createSky(lookId || biome.look, heading);
  scene.add(sky.mesh);
  const hemi = new THREE.HemisphereLight(look.hemi.sky, look.hemi.ground, look.hemi.intensity);
  const sun = new THREE.DirectionalLight(look.light.color, look.light.intensity);
  sun.position.copy(sky.sunDir).multiplyScalar(500);
  scene.add(hemi, sun, sun.target);
  if (tier !== 'low') {
    scene.environment = sky.makeEnvironment(renderer); // (its render target is released by sky.dispose)
    scene.environmentIntensity = look.envIntensity;
  }

  // geometry of the road and what stands under it
  const f = sampleFrames(track);
  const floorY = track.stats.minY - (biome.embank === 'viaduct' ? 14 : 9);
  const asphalt = track$(asphaltTexture(aniso));
  const road = buildRoadMesh(track, f, biome, asphalt);
  const { body: barriers, neon } = buildBarriers(track, f, biome);
  const zones = pickZones(track, biome.seed, { tunnels: biome.tunnels, bridges: biome.bridges });
  const support = buildSupport(track, f, biome, floorY, (k) => inZone(zones, 'bridge', f.s[k]));
  const structures = buildStructures(f, biome, zones, floorY);
  const ground = buildGround(biome, floorY, aniso);
  const horizon = buildHorizon(biome, look.fog.color, biome.seed);
  const gantry = buildGantry(track);
  const props = buildProps(track, f, biome, look, floorY, aniso);
  scene.add(road, barriers, neon, support.mesh, ground, horizon, gantry, props.group, structures.group);
  const base = { hemi: hemi.intensity, sun: sun.intensity, env: scene.environmentIntensity };

  return {
    look, sky, frames: f, floorY, road, ground, horizon, zones,
    /** `s` = the player's arc length: inside a tunnel the light dims. */
    update(camera, time, s = 0) {
      const dark = 1 - 0.78 * zoneDepth(track, zones, 'tunnel', s);
      hemi.intensity = base.hemi * dark;
      sun.intensity = base.sun * dark;
      scene.environmentIntensity = base.env * (0.25 + 0.75 * dark);
      sky.update(camera, time);
      ground.userData.follow(camera);
      horizon.userData.follow(camera);
      props.update(camera);
    },
    dispose() {
      sky.dispose();
      props.dispose();
      structures.dispose();
      horizon.userData.dispose();
      if (ground.userData.map) ground.userData.map.dispose();
      for (const o of disposables) o.dispose();
    },
  };
}
