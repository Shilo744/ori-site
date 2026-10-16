// NEON DRIFT — the player's car: clear-coated paint (reflects the sky through the scene's environment map), mirrored glass, wheels
// that steer and spin, a tail-light bar that glows harder under braking, headlight beams, underglow, boost flames; the body
// rolls and pitches with the load. 3 body types x 6 paints are parameters of `createCarMesh` (see car-parts.js).
import * as THREE from 'three';
import { frameAt, surfaceNormal } from './track.js';
import { clamp } from './rng.js';
import { buildCarParts, CAR_SPECS } from './car-parts.js';
import { glowTexture, beamTexture } from './textures3d.js';

/**
 * Everything the cars of one session share: the geometry of each body type, the glass / trim / tyre / rim materials and the
 * textures. Build one kit per session (cheap), pass it to every `createCarMesh`, dispose it once.
 */
export function createCarKit() {
  const cache = new Map();
  const own = [];
  const mine = (o) => { own.push(o); return o; };
  const common = {
    glassMat: mine(new THREE.MeshStandardMaterial({ color: 0x07080f, metalness: 0.9, roughness: 0.06, envMapIntensity: 1.4 })),
    trimMat: mine(new THREE.MeshStandardMaterial({ color: 0x0d0e14, metalness: 0.2, roughness: 0.55 })),
    headMat: mine(new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 0.95, 1).multiplyScalar(4), toneMapped: false })),
    tireMat: mine(new THREE.MeshStandardMaterial({ color: 0x0b0b0e, roughness: 0.88, metalness: 0 })),
    rimMat: mine(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.85, roughness: 0.28 })),
    ghostMat: mine(new THREE.MeshBasicMaterial({ color: 0x7ff3ff, transparent: true, opacity: 0.3, depthWrite: false })),
    glowTex: mine(glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0.3)')),
    shadowTex: mine(glowTexture('rgba(255,255,255,0.85)', 'rgba(255,255,255,0.35)')),
    beamTex: mine(beamTexture()),
  };
  return {
    common,
    /** The shared geometry of a body type. */
    parts(type) {
      if (!cache.has(type)) {
        const p = buildCarParts(type);
        for (const g of [p.paint, p.glass, p.trim, p.tail, p.head, p.wheels.tire, p.wheels.rim]) mine(g);
        cache.set(type, p);
      }
      return cache.get(type);
    },
    dispose() { own.forEach((o) => o.dispose()); cache.clear(); },
  };
}

/**
 * @param {object} o { type: 'hatch'|'gt'|'hyper', paint: hex, glow: hex (underglow), beam: number 0..1 (headlight strength),
 *   kit: shared resources (createCarKit), ghost: a see-through replay car }
 * @returns {{ group: THREE.Group, update: Function, setPaint: Function, dispose: Function, spec: object }}
 */
export function createCarMesh({ type = 'gt', paint = 0xff2d6f, glow = 0x19e3ff, beam = 0.35, kit = null, ghost = false } = {}) {
  const ownKit = kit ? null : createCarKit();
  const K = kit || ownKit;
  const parts = K.parts(type);
  const C = K.common;
  const spec = parts.spec;
  const root = new THREE.Group(); // placed and oriented on the road surface
  const body = new THREE.Group(); // rolls and pitches
  root.add(body);
  const own = [];
  const mine = (o) => { own.push(o); return o; };

  const paintMat = ghost ? C.ghostMat : mine(new THREE.MeshPhysicalMaterial({ color: paint, metalness: 0.3, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.2, emissive: paint, emissiveIntensity: 0.1 }));
  const glassMat = ghost ? C.ghostMat : C.glassMat;
  const trimMat = ghost ? C.ghostMat : C.trimMat;
  const tailMat = ghost ? C.ghostMat : mine(new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.03, 0.08).multiplyScalar(1.5), toneMapped: false }));
  const headMat = ghost ? C.ghostMat : C.headMat;
  const tireMat = ghost ? C.ghostMat : C.tireMat;
  const rimMat = ghost ? C.ghostMat : C.rimMat;

  const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); body.add(m); return m; };
  add(parts.paint, paintMat);
  add(parts.glass, glassMat);
  add(parts.trim, trimMat);
  add(parts.tail, tailMat);
  add(parts.head, headMat);

  // wheels
  const wheels = [];
  const tireGeo = parts.wheels.tire;
  const rimGeo = parts.wheels.rim;
  for (const [x, z, front] of [[spec.axle, -spec.track, true], [spec.axle, spec.track, true], [-spec.axle, -spec.track, false], [-spec.axle, spec.track, false]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0, z);
    const spin = new THREE.Group();
    spin.add(new THREE.Mesh(tireGeo, tireMat));
    const rim = new THREE.Mesh(rimGeo, rimMat);
    spin.add(rim);
    if (z < 0) rim.rotation.y = Math.PI; // the rim's face looks outwards on both sides
    pivot.add(spin);
    root.add(pivot);
    wheels.push({ pivot, spin, front });
  }

  // headlight beams: two open cones with a fading gradient, additive
  if (beam > 0.01 && !ghost) {
    const beamMat = mine(new THREE.MeshBasicMaterial({ map: C.beamTex, color: 0xcfe8ff, transparent: true, opacity: beam, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    const cone = mine(new THREE.ConeGeometry(3.4, 28, 14, 1, true));
    cone.rotateZ(Math.PI / 2); // the tip at the headlight, opening forwards (+x); the gradient fades away from the car
    cone.translate(14 + spec.L / 2 - 0.1, 0, 0);
    for (const z of [-1, 1]) {
      const b = new THREE.Mesh(cone, beamMat);
      b.scale.set(1, 0.42, 0.42);
      b.position.set(0, spec.body[3][1] - 0.04, z * (spec.W / 2 - 0.34));
      body.add(b);
    }
  }

  // underglow + contact shadow + brake glow + boost flames
  const glowTex = C.glowTex;
  const underMat = mine(new THREE.MeshBasicMaterial({ map: glowTex, color: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  const under = new THREE.Mesh(mine(new THREE.PlaneGeometry(spec.L * 0.95, spec.W * 1.5)), underMat);
  under.rotation.x = -Math.PI / 2;
  under.position.y = -spec.wheelR + 0.07;
  const shadow = new THREE.Mesh(mine(new THREE.PlaneGeometry(spec.L * 1.35, spec.W * 1.9)), mine(new THREE.MeshBasicMaterial({ map: C.shadowTex, transparent: true, depthWrite: false, color: 0x000000 })));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -spec.wheelR + 0.035;
  const brakeMat = mine(new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color(1, 0.1, 0.2).multiplyScalar(2), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide }));
  const brakeGlow = new THREE.Mesh(mine(new THREE.PlaneGeometry(3.2, 1.1)), brakeMat);
  brakeGlow.rotation.y = -Math.PI / 2;
  brakeGlow.position.set(-spec.L / 2 - 0.25, spec.body[7][1] - 0.1, 0);
  const flameMat = mine(new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.8, 1).multiplyScalar(3), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  const flameGeo = mine(new THREE.ConeGeometry(0.16, 1.7, 8, 1, true));
  flameGeo.rotateZ(Math.PI / 2);
  flameGeo.translate(-0.85, 0, 0);
  const flames = [];
  for (const z of [-0.42, 0.42]) {
    const fl = new THREE.Mesh(flameGeo, flameMat);
    fl.position.set(-spec.L / 2 - 0.05, 0.05, z);
    fl.visible = false;
    root.add(fl);
    flames.push(fl);
  }
  if (!ghost) root.add(shadow, under, brakeGlow);

  const fr = {};
  const nm = {};
  const f = new THREE.Vector3();
  const n = new THREE.Vector3();
  const r = new THREE.Vector3();
  const m4 = new THREE.Matrix4();
  let spinAngle = 0;
  let roll = 0;
  let pitch = 0;
  let flick = 0;

  /**
   * Places the car on the road. `st` = interpolated pose { x, z, psi, s, lateral, u, steer, ax, ay, brake, boosting, drifting }.
   */
  function update(st, track, dt) {
    frameAt(track, st.s, fr);
    surfaceNormal(fr, nm);
    n.set(nm.nx, nm.ny, nm.nz);
    f.set(Math.cos(st.psi), 0, Math.sin(st.psi));
    f.addScaledVector(n, -f.dot(n)).normalize();
    r.crossVectors(f, n);
    m4.makeBasis(f, n, r);
    root.quaternion.setFromRotationMatrix(m4);
    root.position.set(st.x, fr.y - Math.sin(fr.bank) * st.lateral + spec.wheelR, st.z);
    const k = 1 - Math.exp(-dt * 9);
    roll += (clamp(st.ay * 0.0095, -0.075, 0.075) - roll) * k;
    pitch += (clamp(st.ax * 0.0045, -0.05, 0.05) - pitch) * k; // squats under power, dives under the brakes
    body.rotation.set(roll, 0, pitch);
    spinAngle += (st.u / spec.wheelR) * dt;
    for (const w of wheels) {
      w.spin.rotation.z = -spinAngle;
      w.pivot.rotation.y = w.front ? -st.steer * 0.42 : 0;
    }
    underMat.opacity = 0.5 + (st.boosting ? 0.5 : 0) + (st.drifting ? 0.2 : 0);
    brakeMat.opacity += ((st.brake > 0.2 ? 0.85 : 0) - brakeMat.opacity) * Math.min(1, dt * 16);
    if (!ghost) tailMat.color.setRGB(1, 0.03, 0.08).multiplyScalar(1.5 + st.brake * 2.4);
    flick += dt * 60;
    for (const fl of flames) {
      fl.visible = !!st.boosting;
      if (st.boosting) fl.scale.set(0.8 + 0.5 * Math.abs(Math.sin(flick)), 1, 1);
    }
    flameMat.opacity = st.boosting ? 0.85 : 0;
  }

  return {
    group: root,
    body,
    spec,
    paintMat,
    update,
    setPaint(hex) { if (!ghost) { paintMat.color.set(hex); paintMat.emissive.set(hex); } },
    dispose() { own.forEach((o) => o.dispose()); if (ownKit) ownKit.dispose(); },
  };
}

export { CAR_SPECS };
