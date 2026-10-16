// NEON DRIFT — the player's car as a procedural mesh (T41 greybox: wedge body from an extruded side profile, glass cabin, wing,
// four wheels that steer and spin, tail/head lights, underglow + contact shadow). T42 upgrades materials and detail.
import * as THREE from 'three';
import { frameAt, surfaceNormal } from './track.js';
import { clamp } from './rng.js';

const WHEEL_R = 0.36;
const BODY_PROFILE = [
  [-2.2, -0.12], [2.16, -0.12], [2.26, 0.1], [2.2, 0.34], [1.45, 0.5], [0.6, 0.6],
  [-1.5, 0.6], [-2.1, 0.54], [-2.24, 0.3],
];
const CABIN_PROFILE = [[-1.2, 0.56], [-0.55, 1.0], [0.42, 1.02], [1.0, 0.58]];

function extrude(points, depth, bevel = 0.07) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 1 });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}

function glowTexture(inner, outer) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const x = cv.getContext('2d');
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * @param {number} paint hex colour of the body
 * @returns {{ group: THREE.Group, update: Function, dispose: Function }}
 */
export function createCarMesh(paint = 0xff3ea5) {
  const root = new THREE.Group(); // positioned/oriented on the road surface
  const body = new THREE.Group(); // rolls and pitches with the load
  root.add(body);
  const own = []; // everything to dispose
  const track = (o) => { own.push(o); return o; };

  const paintMat = track(new THREE.MeshStandardMaterial({ color: paint, metalness: 0.2, roughness: 0.4, emissive: paint, emissiveIntensity: 0.16 }));
  const glassMat = track(new THREE.MeshStandardMaterial({ color: 0x0b0a16, metalness: 0.9, roughness: 0.12 }));
  const darkMat = track(new THREE.MeshLambertMaterial({ color: 0x16141f }));
  const rimMat = track(new THREE.MeshStandardMaterial({ color: 0xcfd2e0, metalness: 0.8, roughness: 0.3 }));

  const shell = new THREE.Mesh(track(extrude(BODY_PROFILE, 1.78)), paintMat);
  const cabin = new THREE.Mesh(track(extrude(CABIN_PROFILE, 1.46, 0.06)), glassMat);
  body.add(shell, cabin);
  // wing
  const wing = new THREE.Mesh(track(new THREE.BoxGeometry(0.62, 0.06, 1.8)), paintMat);
  wing.position.set(-2.05, 0.98, 0);
  body.add(wing);
  const standGeo = track(new THREE.BoxGeometry(0.12, 0.36, 0.08));
  for (const z of [-0.55, 0.55]) {
    const st = new THREE.Mesh(standGeo, darkMat);
    st.position.set(-1.98, 0.78, z);
    body.add(st);
  }
  // lights
  const tailMat = track(new THREE.MeshBasicMaterial({ color: 0xff2347 }));
  const tail = new THREE.Mesh(track(new THREE.BoxGeometry(0.06, 0.13, 1.5)), tailMat);
  tail.position.set(-2.3, 0.4, 0);
  const headMat = track(new THREE.MeshBasicMaterial({ color: 0xcffbff }));
  const headGeo = track(new THREE.BoxGeometry(0.06, 0.1, 0.42));
  body.add(tail);
  for (const z of [-0.62, 0.62]) {
    const h = new THREE.Mesh(headGeo, headMat);
    h.position.set(2.27, 0.27, z);
    body.add(h);
  }
  // wheels
  const tireGeo = track(new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.3, 20));
  tireGeo.rotateX(Math.PI / 2);
  const rimGeo = track(new THREE.CylinderGeometry(WHEEL_R * 0.62, WHEEL_R * 0.62, 0.32, 10));
  rimGeo.rotateX(Math.PI / 2);
  const wheels = [];
  for (const [x, z, front] of [[1.4, -0.9, true], [1.4, 0.9, true], [-1.4, -0.9, false], [-1.4, 0.9, false]]) {
    const pivot = new THREE.Group(); // steers
    pivot.position.set(x, 0, z);
    const spin = new THREE.Group(); // spins
    spin.add(new THREE.Mesh(tireGeo, darkMat), new THREE.Mesh(rimGeo, rimMat));
    pivot.add(spin);
    root.add(pivot);
    wheels.push({ pivot, spin, front });
  }
  // underglow + contact shadow (flat planes just above the road)
  const glowTex = track(glowTexture('rgba(25,227,255,0.85)', 'rgba(25,227,255,0)'));
  const glow = new THREE.Mesh(track(new THREE.PlaneGeometry(4.2, 2.6)), track(new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = -WHEEL_R + 0.06;
  const shadowTex = track(glowTexture('rgba(0,0,0,0.7)', 'rgba(0,0,0,0)'));
  const shadow = new THREE.Mesh(track(new THREE.PlaneGeometry(5.4, 3.4)), track(new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -WHEEL_R + 0.03;
  root.add(shadow, glow);

  // scratch objects (no allocations per frame)
  const fr = {};
  const nm = {};
  const f = new THREE.Vector3();
  const n = new THREE.Vector3();
  const r = new THREE.Vector3();
  const m4 = new THREE.Matrix4();
  let spinAngle = 0;
  let roll = 0;
  let pitch = 0;

  /** Places the car on the road. `st` = interpolated pose { x, z, psi, s, lateral, speed, u, steer, ax, ay, boosting, drifting }. */
  function update(st, track, dt) {
    frameAt(track, st.s, fr);
    surfaceNormal(fr, nm);
    n.set(nm.nx, nm.ny, nm.nz);
    f.set(Math.cos(st.psi), 0, Math.sin(st.psi));
    f.addScaledVector(n, -f.dot(n)).normalize();
    r.crossVectors(f, n);
    m4.makeBasis(f, n, r);
    root.quaternion.setFromRotationMatrix(m4);
    const surfY = fr.y - Math.sin(fr.bank) * st.lateral;
    root.position.set(st.x, surfY + WHEEL_R, st.z);
    // body roll/pitch from the accelerations (smoothed)
    const rollT = clamp(st.ay * 0.0095, -0.075, 0.075);
    const pitchT = clamp(st.ax * 0.0045, -0.05, 0.05); // squats under power (nose up), dives under the brakes
    const k = 1 - Math.exp(-dt * 9);
    roll += (rollT - roll) * k;
    pitch += (pitchT - pitch) * k;
    body.rotation.set(roll, 0, pitch);
    spinAngle += (st.u / WHEEL_R) * dt;
    for (const w of wheels) {
      w.spin.rotation.z = -spinAngle;
      w.pivot.rotation.y = w.front ? -st.steer * 0.42 : 0;
    }
    glow.material.opacity = 0.55 + (st.boosting ? 0.45 : 0) + (st.drifting ? 0.2 : 0);
  }

  function dispose() {
    for (const o of own) o.dispose();
  }
  return { group: root, body, paintMat, update, dispose };
}
