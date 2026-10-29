// "Ori, Can You...?" — the beam of light over the place where a little event of the city is on (THREE) [experimental]: a soft column in the event's colour and a sign that bobs over it.
// One beacon is enough (the events never overlap); it is moved to the place of the event that is on and painted again when the event changes.
import * as THREE from 'three';

export function createEventBeacon() {
  const group = new THREE.Group();
  group.visible = false;
  const cv = document.createElement('canvas');
  cv.width = 8; cv.height = 256;
  const c = cv.getContext('2d');
  const gr = c.createLinearGradient(0, 256, 0, 0);
  gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = gr; c.fillRect(0, 0, 8, 256);
  const colTex = new THREE.CanvasTexture(cv);
  colTex.colorSpace = THREE.SRGBColorSpace;
  const colMat = new THREE.MeshBasicMaterial({ map: colTex, color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false, opacity: 0.4 });
  const colGeo = new THREE.CylinderGeometry(0.9, 1.9, 34, 16, 1, true);
  const col = new THREE.Mesh(colGeo, colMat);
  col.position.y = 17; col.renderOrder = 5; col.frustumCulled = false;
  group.add(col);
  const sv = document.createElement('canvas');
  sv.width = 512; sv.height = 160;
  const sx = sv.getContext('2d');
  const signTex = new THREE.CanvasTexture(sv);
  signTex.colorSpace = THREE.SRGBColorSpace;
  const signMat = new THREE.SpriteMaterial({ map: signTex, transparent: true, depthWrite: false, fog: false, toneMapped: false });
  const sign = new THREE.Sprite(signMat);
  sign.scale.set(7, 2.2, 1); sign.position.y = 9.5; sign.renderOrder = 6;
  group.add(sign);
  let shown = null;

  function paint(ev) {
    sx.clearRect(0, 0, 512, 160);
    sx.fillStyle = 'rgba(28,20,24,0.9)'; sx.beginPath(); sx.roundRect(10, 10, 492, 140, 36); sx.fill();
    sx.strokeStyle = ev.color; sx.lineWidth = 8; sx.stroke();
    sx.fillStyle = '#ffffff'; sx.font = '900 76px Inter, system-ui, sans-serif'; sx.textAlign = 'center'; sx.textBaseline = 'middle'; sx.fillText(ev.sign, 256, 84, 460);
    signTex.needsUpdate = true;
    colMat.color.set(ev.color);
  }
  return {
    group,
    get shown() { return shown; },
    /** Puts the beam over (x, z) for the event `ev` (events.js), `y` = the ground there, t = seconds, night 0..1 (a little stronger in the dark). */
    show(ev, x, y, z, t, night = 0) {
      if (shown !== ev.id) { shown = ev.id; paint(ev); }
      group.visible = true;
      group.position.set(x, y, z);
      colMat.opacity = 0.5 + 0.08 * Math.sin(t * 2) + 0.14 * night;
      sign.position.y = 9.5 + Math.sin(t * 1.3) * 0.22;
    },
    hide() { group.visible = false; shown = null; },
    dispose() { colGeo.dispose(); colMat.dispose(); colTex.dispose(); signMat.dispose(); signTex.dispose(); },
  };
}
