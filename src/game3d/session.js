// NEON DRIFT — one play session: the track, the physics sim, the three.js scene, the camera and the car. The host (host.js) owns
// the overlay, the renderer and the loop and just calls `update(dt)` / `render()`. T43 adds race rules and rivals on top of this.
import * as THREE from 'three';
import { generateTrack, closest } from './track.js';
import { createCar, placeCar, createSim, DT } from './physics.js';
import { createDriver } from './autodrive.js';
import { buildRoad, buildWalls, buildPosts, buildGantry, buildSky, buildFloor } from './world3d.js';
import { createCarMesh } from './car-mesh.js';
import { createChaseCam } from './chase-cam.js';

const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * @param {object} o
 * @param {THREE.WebGLRenderer} o.renderer
 * @param {number} o.seed track seed
 * @param {string} [o.carType] 'hatch' | 'gt' | 'hyper'
 * @param {number} [o.paint]
 */
export function createSession({ renderer, seed = 7, carType = 'gt', paint = 0xff3ea5 }) {
  const track = generateTrack(seed);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x2a1250, 260, 2300);
  const size = renderer.getSize(new THREE.Vector2());
  const camera = new THREE.PerspectiveCamera(62, size.x / Math.max(1, size.y), 0.3, 6000);

  // lights: a cool sky fill and a low, warm "sun" from the horizon the player starts towards
  scene.add(new THREE.HemisphereLight(0xc4b5ff, 0x2c1550, 2.3));
  const sun = new THREE.DirectionalLight(0xffb18c, 2.6);
  scene.add(sun, sun.target);

  const road = buildRoad(track);
  const { walls, neon } = buildWalls(track);
  const posts = buildPosts(track);
  const gantry = buildGantry(track);
  const sky = buildSky();
  const floor = buildFloor(track.stats.minY);
  scene.add(road, walls, neon, ...posts, gantry, sky, floor);
  // the sky's sun sits ahead of the start line, and so does the key light
  const h0 = track.start.psi;
  sky.rotation.y = Math.atan2(-Math.cos(h0), -Math.sin(h0));
  sun.position.set(Math.cos(h0) * 300, 90, Math.sin(h0) * 300);

  const car = createCar(carType);
  const sim = createSim({ track, seed, cars: [car] });
  placeCar(car, track, 0, 0, 0);
  const mesh = createCarMesh(paint);
  scene.add(mesh.group);
  const cam = createChaseCam();

  const input = { throttle: 0, brake: 0, steer: 0, handbrake: false, boost: false };
  const driver = createDriver(track, car);
  const inputs = [input];
  const pose = { x: 0, y: 0, z: 0, psi: 0, vx: 0, vz: 0, speed: 0, u: 0, s: 0, lateral: 0, steer: 0, ax: 0, ay: 0, boosting: 0, drifting: 0, hit: 0 };
  const lap = { time: 0, count: 0, best: 0, last: 0, prevS: 0 };
  const hudState = { speed: 0, u: 0, gear: 1, boost: 0, boosting: 0, drifting: 0, time: 0 };
  let autopilot = false;

  /** Lap timer: counts the fixed steps and notices the wrap of the arc length at the start line. */
  function tickLap(steps) {
    lap.time += steps * DT;
    if (car.s - lap.prevS < -track.length / 2) {
      lap.count++;
      lap.last = lap.time;
      lap.best = lap.best ? Math.min(lap.best, lap.time) : lap.time;
      lap.time = 0;
    }
    lap.prevS = car.s;
  }

  function interpolate() {
    const a = sim.alpha;
    pose.x = car.prevX + (car.x - car.prevX) * a;
    pose.z = car.prevZ + (car.z - car.prevZ) * a;
    pose.psi = car.prevPsi + wrapPi(car.psi - car.prevPsi) * a;
    pose.y = car.y;
    pose.vx = car.vx; pose.vz = car.vz;
    pose.speed = car.speed; pose.u = car.u; pose.s = car.s; pose.lateral = car.lateral;
    pose.steer = car.steer; pose.ax = car.ax; pose.ay = car.ay;
    pose.boosting = car.boosting; pose.drifting = car.drifting; pose.hit = car.hit;
  }

  function resetCam() {
    interpolate();
    cam.reset();
    cam.update(camera, pose, 1, car.p.vRef);
  }
  resetCam();

  const api = {
    track, scene, camera, car, sim, mesh, lap, pose,
    get autopilot() { return autopilot; },
    set autopilot(v) { autopilot = !!v; },
    /** Camera mode: 0 chase, 1 far chase. */
    toggleCamera() { cam.state.mode = cam.state.mode ? 0 : 1; },
    /** Advances by a real frame time using `keys` (a CarInput-shaped reader) or the autopilot. Returns the fixed steps run. */
    update(dt, keys) {
      if (autopilot) driver(car, input);
      else if (keys) keys.read(input);
      const steps = sim.update(dt, inputs);
      tickLap(steps);
      return steps;
    },
    /** Runs exactly `n` fixed steps (tests/screenshots), with the autopilot or the last input. */
    step(n) {
      for (let i = 0; i < n; i++) {
        if (autopilot) driver(car, input);
        sim.step(inputs);
        tickLap(1);
      }
      sim.alpha = 1;
      resetCam(); // a jump in time: the camera snaps to the car instead of chasing it
    },
    /** Back onto the road at the nearest point, facing along it (the R key). */
    resetToRoad() {
      const c = closest(track, car.x, car.z, car.idx, {});
      placeCar(car, track, c.s, 0, car.speed * 0.5);
      cam.reset();
    },
    restart() {
      placeCar(car, track, 0, 0, 0);
      car.boost = 0;
      car.driftScore = 0;
      lap.time = 0; lap.count = 0; lap.best = 0; lap.last = 0; lap.prevS = 0;
      sim.accum = 0; sim.alpha = 0; sim.tick = 0; sim.time = 0;
      cam.reset();
    },
    /** Draws one frame. */
    render(dt) {
      interpolate();
      mesh.update(pose, track, dt);
      cam.update(camera, pose, dt, car.p.vRef);
      sky.userData.follow(camera);
      floor.userData.follow(camera);
      renderer.render(scene, camera);
    },
    resize(w, h) {
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    },
    /** Short summary for the HUD and the debug API. */
    hud() {
      hudState.speed = car.speed; hudState.u = car.u; hudState.gear = car.gear; hudState.boost = car.boost;
      hudState.boosting = car.boosting; hudState.drifting = car.drifting; hudState.time = lap.time;
      return hudState;
    },
    state() {
      return {
        seed, track: { length: Math.round(track.length), hairpins: track.stats.hairpins, minRadius: Math.round(track.stats.minRadius), attempts: track.attempts },
        s: Math.round(car.s), lateral: +car.lateral.toFixed(2), speedKmh: Math.round(car.speed * 3.6), gear: car.gear, rpm: Math.round(car.rpm),
        slipDeg: +(car.slip * 57.3).toFixed(1), drifting: car.drifting, boost: Math.round(car.boost), boosting: car.boosting, offroad: +car.offroad.toFixed(2),
        lap: lap.count, lapTime: +lap.time.toFixed(2), bestLap: +lap.best.toFixed(2), tick: sim.tick, autopilot, x: +car.x.toFixed(1), z: +car.z.toFixed(1),
      };
    },
    /** Releases every GPU resource this session created. */
    dispose() {
      mesh.dispose();
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

