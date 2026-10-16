// Two small residents of the room (T13): a wall clock that shows the real time (smooth sweep second hand)
// and a robot vacuum that patrols the floor along a route that keeps clear of the furniture.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ROUTE, VACUUM_R } from './life-path.js';

const TAU = Math.PI * 2;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ───────────────────────── wall clock ─────────────────────────
function faceTexture(aniso = 4) {
  const S = 512, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#f6f4ee';
  g.fillRect(0, 0, S, S);
  g.translate(S / 2, S / 2);
  g.lineCap = 'round';
  for (let i = 0; i < 60; i++) {
    const hour = i % 5 === 0;
    g.save();
    g.rotate((i * TAU) / 60);
    g.strokeStyle = '#1d1d1f';
    g.lineWidth = hour ? 11 : 3.5;
    g.beginPath();
    g.moveTo(0, -S * 0.46);
    g.lineTo(0, -S * (hour ? 0.37 : 0.425));
    g.stroke();
    g.restore();
  }
  g.fillStyle = '#9a9aa0';
  g.font = '600 20px -apple-system, "SF Pro Text", Helvetica, Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('ORI', 0, S * 0.17);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}

/** Round graphite wall clock, face towards +z. Mount with `.position.set(x, y, wallZ)`. */
export function createWallClock(m, aniso) {
  const g = new THREE.Group();
  g.name = 'wallClock';
  const prof = [[0, 0], [17.2, 0], [17.9, 0.6], [17.9, 2.5], [17.3, 3.1], [16.2, 3.1], [15.5, 2.6], [15.5, 1.0], [0, 1.0]].map(([x, y]) => new THREE.Vector2(x, y));
  const caseGeo = new THREE.LatheGeometry(prof, 72).rotateX(Math.PI / 2);
  const body = new THREE.Mesh(caseGeo, m.metal);
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  const face = new THREE.Mesh(new THREE.CircleGeometry(15.5, 72), new THREE.MeshStandardMaterial({ map: faceTexture(aniso), roughness: 0.7 }));
  face.position.z = 1.04;
  face.receiveShadow = true;
  g.add(face);

  const hand = new THREE.MeshStandardMaterial({ color: 0x1b1b1e, roughness: 0.5 });
  const red = new THREE.MeshStandardMaterial({ color: 0xe0432d, roughness: 0.45 });
  const bar = (w, len, tail, depth = 0.3) => new RoundedBoxGeometry(w, len + tail, depth, 2, Math.min(w, depth) * 0.45).translate(0, (len - tail) / 2, 0);
  const hourH = new THREE.Mesh(bar(1.15, 8.6, 1.8), hand);
  const minH = new THREE.Mesh(bar(0.85, 12.8, 2.2), hand);
  hourH.position.z = 1.45;
  minH.position.z = 1.85;
  const sec = mergeGeometries([
    bar(0.32, 14.2, 3.6, 0.25),
    new THREE.CylinderGeometry(1.25, 1.25, 0.25, 24).rotateX(Math.PI / 2).translate(0, 10.2, 0),
    new THREE.CylinderGeometry(0.95, 0.95, 0.5, 20).rotateX(Math.PI / 2),
  ].map((geo) => (geo.index ? geo.toNonIndexed() : geo)));
  const secH = new THREE.Mesh(sec, red);
  secH.position.z = 2.3;
  for (const o of [hourH, minH, secH]) { o.castShadow = false; o.receiveShadow = false; g.add(o); }

  return {
    group: g,
    /** @param {number} hours local time in hours (may be fractional); @param {number} sec seconds incl. milliseconds (0..60) */
    set(hours, sec60) {
      const h = ((hours % 12) + 12) % 12;
      hourH.rotation.z = -(h / 12) * TAU;
      minH.rotation.z = -((hours * 60) % 60) / 60 * TAU;
      secH.rotation.z = -(sec60 / 60) * TAU;
    },
    /** Hand angles in degrees clockwise from 12 (for tests). */
    angles() {
      const deg = (r) => (((-r * 180) / Math.PI) % 360 + 360) % 360;
      return { hour: deg(hourH.rotation.z), minute: deg(minH.rotation.z), second: deg(secH.rotation.z) };
    },
    /** Real local time (with a smooth second hand). */
    setNow() {
      const d = new Date();
      const s = d.getSeconds() + d.getMilliseconds() / 1000;
      this.set(d.getHours() + d.getMinutes() / 60 + s / 3600, s);
    },
  };
}

// ───────────────────────── robot vacuum ─────────────────────────
export function createVacuum(m, rug) {
  const g = new THREE.Group();
  g.name = 'vacuum';
  const prof = [[0, 0.6], [15.6, 0.6], [16.9, 1.5], [17.2, 3.0], [17.2, 5.4], [16.4, 6.9], [14.2, 7.45], [0, 7.45]].map(([x, y]) => new THREE.Vector2(x, y));
  const shell = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), m.white);
  shell.castShadow = shell.receiveShadow = true;
  g.add(shell);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(11.6, 11.6, 0.3, 48), m.glass);
  plate.position.y = 7.55;
  plate.receiveShadow = true;
  g.add(plate);
  const turret = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.5, 1.9, 32), m.metal);
  turret.position.set(-2.5, 8.55, 0);
  turret.castShadow = true;
  g.add(turret);
  const bumper = new THREE.Mesh(new THREE.CylinderGeometry(17.3, 17.3, 3.7, 36, 1, true, Math.PI / 2 - 1.0, 2.0), m.metal);
  bumper.position.y = 3.6;
  bumper.material = m.metal.clone();
  bumper.material.side = THREE.DoubleSide;
  g.add(bumper);
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x6fe3b4, toneMapped: false });
  const led = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.14, 6, 40), ledMat);
  led.rotation.x = Math.PI / 2;
  led.position.set(4.5, 7.75, 0);
  g.add(led);
  const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.2, 12), ledMat);
  dot.position.set(4.5, 7.7, 0);
  g.add(dot);

  const curve = new THREE.CatmullRomCurve3(ROUTE.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
  const len = curve.getLength();
  // the stops: pause (and turn on the spot) at every other waypoint
  const nearestU = (x, z) => {
    let best = 0, bd = Infinity;
    for (let i = 0; i < 400; i++) { const p = curve.getPointAt(i / 400); const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = i / 400; } }
    return best;
  };
  const stops = ROUTE.filter((_, i) => i % 2 === 0).map(([x, z]) => nearestU(x, z)).sort((a, b) => a - b);
  let u = 0, speed = 0, pause = 0, nextStop = 0, yaw = 0, prevD = 1, seed = 11, dodge = 0;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const p = new THREE.Vector3(), tg = new THREE.Vector3();
  const place = (snap) => {
    curve.getPointAt(u, p);
    curve.getTangentAt(u, tg);
    const want = Math.atan2(-tg.z, tg.x);
    let d = ((want - yaw + Math.PI) % TAU + TAU) % TAU - Math.PI;
    yaw = snap ? want : yaw + d * 0.1;
    const onRug = 1 - sstep(rug.R - 4, rug.R + 1, Math.hypot(p.x - rug.x, p.z - rug.z));
    g.position.set(p.x, onRug * 1.1, p.z);
    g.rotation.y = yaw;
  };
  u = stops[0] ? stops[0] + 0.012 : 0;
  place(true);

  return {
    group: g,
    route: curve,
    /** Dodge / spin for a moment (T14 click). */
    dodge() { dodge = 1; pause = Math.max(pause, 1.2); },
    get speed() { return speed; },
    get u() { return u; },
    update(dt) {
      dodge = Math.max(0, dodge - dt / 1.4);
      pause = Math.max(0, pause - dt);
      const target = pause > 0 ? 0 : 11; // cm/s: a calm, slow patrol
      speed += (target - speed) * (1 - Math.exp(-dt * 2.4));
      u = (u + (speed * dt) / len) % 1;
      if (pause <= 0 && stops.length) {
        const d = ((stops[nextStop] - u) % 1 + 1) % 1;
        if (prevD < 0.2 && d > 0.8) { pause = 1.4 + rnd() * 1.8; nextStop = (nextStop + 1) % stops.length; }
        prevD = d;
      }
      place(false);
      if (dodge > 0) g.rotation.y += Math.sin((1 - dodge) * Math.PI) * 2.4; // a quick pirouette
      ledMat.color.setHex(pause > 0 ? 0x7cb7ff : 0x6fe3b4);
    },
    stops,
  };
}

export { VACUUM_R };
