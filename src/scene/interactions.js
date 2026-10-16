// 3D interaction framework (T14): hover + click on objects in the room.
//   • picking uses invisible, cheap proxy meshes (a few primitives per object), never the render geometry
//   • hover = a soft inverted-hull outline (one shared shader, constant ~2 px) + a pointer cursor + a site-style `.tag`
//     label that follows the cursor; touch devices get the label as a short toast after a tap
//   • click = the object's own action; the first click on each "discoverable" object counts towards "Discovered n/N"
//     (persisted) and unlocks achievements
// Only active while the camera looks at the room (`overview`); the MacBook keeps its click-to-enter behaviour.
import * as THREE from 'three';

const OUTLINE_COLOR = 0x6a7bff;
const ease = (k) => 1 - Math.pow(1 - k, 3);

const hullMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, transparent: true, depthWrite: false,
  uniforms: { uColor: { value: new THREE.Color(OUTLINE_COLOR) }, uPx: { value: 2 }, uH: { value: 800 }, uAlpha: { value: 0 } },
  vertexShader: `
    uniform float uPx; uniform float uH;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vec3 n = normalize(normalMatrix * normal);
      mv.xyz += n * (uPx * 2.0 * max(1.0, -mv.z) / (uH * projectionMatrix[1][1]));
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: 'uniform vec3 uColor; uniform float uAlpha; void main() { gl_FragColor = vec4(uColor, uAlpha); }',
});
const proxyMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
const SKIP_NAMES = new Set(['steam', 'lightShaft', 'dust']);

/** @param {{camera, canvas, getState: () => string, tagEl: HTMLElement, counterEl: HTMLElement, storage, achievements, bus}} o */
export function createInteractions({ camera, canvas, getState, tagEl, counterEl, storage, achievements, bus }) {
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const items = new Map();
  const pickMeshes = [];
  const tweens = [];
  const ptr = { x: 0, y: 0, inside: false, touch: false };
  const found = new Set((storage.get('room:found', []) || []).filter((x) => typeof x === 'string'));
  let hover = null;
  let hoverT = 0;
  let say = null; // { text, until }
  let lastLabel = '';

  const total = () => [...items.values()].filter((i) => i.discoverable).length;
  const active = () => { const s = getState(); return s === 'overview' || s === 'ready'; }; // the first view after START counts: that is where visitors meet the room
  let touched = false; // the visitor has hovered / clicked something (stops the first-visit hint)
  let hintState = null; // { item, t0, dur }: a soft outline pulse that says "you can touch things"

  // ── tag + counter ──
  function labelOf(item) {
    const l = typeof item.label === 'function' ? item.label() : item.label;
    return l || item.name;
  }
  function placeTag(x = ptr.x, y = ptr.y) {
    const w = tagEl.offsetWidth || 120, h = tagEl.offsetHeight || 28;
    let tx = x + 16, ty = y + 20;
    if (tx + w > window.innerWidth - 8) tx = Math.max(8, x - w - 14);
    if (ty + h > window.innerHeight - 8) ty = Math.max(8, y - h - 12);
    tagEl.style.transform = `translate3d(${Math.round(tx)}px, ${Math.round(ty)}px, 0)`;
  }
  function refreshTag(force = false) {
    const text = say ? say.text : hover ? labelOf(hover) : '';
    if (!text) { tagEl.classList.remove('on'); lastLabel = ''; return; }
    if (text !== lastLabel || force) { tagEl.textContent = text; lastLabel = text; }
    placeTag();
    tagEl.classList.add('on');
  }
  function updateCounter(pop = false) {
    counterEl.textContent = `Discovered ${found.size}/${total()}`;
    if (pop) { counterEl.classList.remove('pop'); void counterEl.offsetWidth; counterEl.classList.add('pop'); }
  }

  // ── hover ──
  function setHover(next) {
    if (hover === next) return;
    if (next && next.discoverable) { touched = true; endHint(); } // hovering the laptop is the main call-to-action, not "touching the room"
    if (say) { say = null; } // a message from a click belongs to that object only
    if (hover) { hover.hull.forEach((h) => { h.visible = false; }); if (hover.onHover) hover.onHover(false); }
    hover = next;
    hoverT = 0;
    if (hover) { hover.hull.forEach((h) => { h.visible = true; }); hullMat.uniforms.uAlpha.value = 0; if (hover.onHover) hover.onHover(true); }
    canvas.style.cursor = hover ? 'pointer' : '';
    refreshTag();
  }

  function pickAt(x, y) {
    ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickMeshes, false)[0];
    return hit ? items.get(hit.object.userData.iid) || null : null;
  }

  // ── discovery ──
  function discover(item) {
    if (!item.discoverable || found.has(item.id)) return;
    found.add(item.id);
    storage.set('room:found', [...found]);
    updateCounter(true);
    achievements.unlock('curious');
    achievements.progress('room-explorer', found.size);
    bus.emit('room:discover', { id: item.id, found: found.size, total: total() });
  }

  function sayTag(text, ms = 1700, at = null) {
    say = { text, until: performance.now() + ms };
    refreshTag(true);
    if (at) { placeTag(at.x, at.y); tagEl.classList.add('on'); }
  }

  function trigger(item, event) {
    touched = true;
    endHint();
    discover(item);
    let msg;
    try { msg = item.onClick && item.onClick({ item, event, engine: { fx: api, say: sayTag } }); } catch (e) { console.error(e); }
    bus.emit('room:interact', { id: item.id });
    if (typeof msg === 'string' && msg) sayTag(msg, 1700, ptr.touch ? { x: ptr.x, y: ptr.y } : null);
    else if (ptr.touch) sayTag(labelOf(item), 1400, { x: ptr.x, y: ptr.y });
  }

  // ── events ──
  window.addEventListener('pointermove', (e) => {
    ptr.x = e.clientX;
    ptr.y = e.clientY;
    ptr.touch = e.pointerType === 'touch';
    ptr.inside = e.target === canvas;
    if (tagEl.classList.contains('on')) placeTag();
  });
  document.addEventListener('pointerleave', () => { ptr.inside = false; });
  canvas.addEventListener('pointerdown', (e) => { ptr.x = e.clientX; ptr.y = e.clientY; ptr.touch = e.pointerType === 'touch'; });
  canvas.addEventListener('click', (e) => {
    if (!active()) return;
    ptr.x = e.clientX;
    ptr.y = e.clientY;
    const item = pickAt(e.clientX, e.clientY);
    if (item && !item.dom) { e.stopPropagation(); trigger(item, e); }
  });

  // ── tween helpers for the objects' own reactions ──
  const addTween = (dur, tick, done) => { tweens.push({ t: 0, dur, tick, done }); };
  const api = {
    /** A little jump (cm) — phones, tablets. */
    hop(obj, h = 2.4, dur = 0.55) {
      const y0 = obj.position.y;
      addTween(dur, (k) => { obj.position.y = y0 + h * Math.sin(Math.PI * k) * (1 - 0.35 * k); }, () => { obj.position.y = y0; });
    },
    /** Scale up and settle back. */
    pulse(obj, s = 1.07, dur = 0.42) {
      const s0 = obj.scale.clone();
      addTween(dur, (k) => { obj.scale.copy(s0).multiplyScalar(1 + (s - 1) * Math.sin(Math.PI * k)); }, () => obj.scale.copy(s0));
    },
    /** Damped wobble about the z axis — wall art. */
    wobble(obj, amp = 0.05, dur = 1.0) {
      const r0 = obj.rotation.z;
      addTween(dur, (k) => { obj.rotation.z = r0 + amp * Math.sin(k * Math.PI * 5) * (1 - k) * (1 - k); }, () => { obj.rotation.z = r0; });
    },
    say: sayTag,
  };

  /**
   * @param {object} def
   * @param {string} def.id
   * @param {string} def.name
   * @param {string|(() => string)} [def.label]   tag text while hovering
   * @param {THREE.Mesh[]} def.proxies            invisible pick meshes (already parented to the object, first = representative)
   * @param {THREE.Object3D|THREE.Object3D[]} [def.outline]  object(s) whose meshes get the hover outline
   * @param {boolean} [def.discoverable]
   * @param {(ctx) => string|void} [def.onClick]  may return a message for the tag
   * @param {(on:boolean) => void} [def.onHover]
   */
  function register(def) {
    const item = { discoverable: true, ...def, hull: [], proxies: def.proxies || [] };
    item.base = item.proxies.map((p) => p.scale.clone());
    item.radius = item.proxies.reduce((m, p) => { p.geometry.computeBoundingSphere(); return Math.max(m, p.geometry.boundingSphere.radius * Math.max(p.scale.x, p.scale.y, p.scale.z)); }, 0.5);
    item.proxies.forEach((p) => {
      p.material = proxyMat;
      p.userData.iid = def.id;
      p.userData.noPick = true;
      pickMeshes.push(p);
    });
    const roots = [].concat(def.outline || []);
    const targets = [];
    roots.forEach((root) => root.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || o.userData.hull || o.userData.iid || SKIP_NAMES.has(o.name)) return;
      const mat = o.material;
      if (Array.isArray(mat) || mat.isShaderMaterial || mat.transparent || !o.geometry.attributes.normal) return;
      targets.push(o);
    }));
    targets.forEach((o) => {
      const h = new THREE.Mesh(o.geometry, hullMat);
      h.visible = false;
      h.userData.hull = true;
      h.raycast = () => {};
      h.renderOrder = 7;
      o.add(h);
      item.hull.push(h);
    });
    items.set(def.id, item);
    updateCounter();
    return item;
  }

  /** A DOM element (the MacBook screen) that shows the tag + pointer while hovered; its click is handled elsewhere. */
  function registerDom(el, def) {
    const item = { discoverable: false, ...def, hull: [], proxies: [], dom: true };
    items.set(def.id, item);
    el.addEventListener('pointerenter', () => { if (active() && !hover) setHover(item); });
    el.addEventListener('pointerleave', () => { if (hover === item) setHover(null); });
    return item;
  }

  // keep every thing hoverable from the far first view: inflate its pick proxies so they cover at least `MIN_PX` on screen
  const MIN_PX = 15, wp = new THREE.Vector3();
  function inflateProxies() {
    const h = Math.max(1, canvas.clientHeight);
    const perPx = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / h; // world cm per pixel at distance 1
    items.forEach((it) => {
      if (!it.proxies.length) return;
      it.proxies[0].getWorldPosition(wp);
      const need = MIN_PX * perPx * wp.distanceTo(camera.position); // world radius that is 15 px big
      const k = Math.min(3.5, Math.max(1, need / (it.radius * (it.worldScale || 1))));
      if (Math.abs(k - (it.k || 1)) < 0.03) return;
      it.k = k;
      it.proxies.forEach((p, i) => p.scale.copy(it.base[i]).multiplyScalar(k));
    });
  }
  function endHint() {
    if (!hintState) return;
    if (hover !== hintState.item) hintState.item.hull.forEach((x) => { x.visible = false; });
    hintState = null;
  }

  function update(dt, t) {
    if (!active()) {
      if (hintState) endHint();
      if (hover) setHover(null);
      if (say) { say = null; refreshTag(); }
      tagEl.classList.remove('on');
      return;
    }
    inflateProxies();
    hullMat.uniforms.uH.value = canvas.height;
    hullMat.uniforms.uPx.value = 1.8 * (canvas.height / Math.max(1, canvas.clientHeight));
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur);
      tw.tick(k);
      if (k >= 1) { if (tw.done) tw.done(); tweens.splice(i, 1); }
    }
    if (ptr.inside && !ptr.touch) {
      const hit = pickAt(ptr.x, ptr.y);
      if (hit !== hover && !(hover && hover.dom)) setHover(hit);
    } else if (!ptr.inside && hover && !hover.dom) setHover(null);
    if (hover && hover.hull.length) {
      hoverT = Math.min(1, hoverT + dt * 7);
      hullMat.uniforms.uAlpha.value = (0.25 + 0.65 * ease(hoverT)) * (0.92 + 0.08 * Math.sin(t * 5));
    }
    if (hintState && !(hover && hover.hull.length)) {
      const age = (performance.now() - hintState.t0) / 1000;
      if (age > hintState.dur) endHint();
      else { hintState.item.hull.forEach((x) => { x.visible = true; }); hullMat.uniforms.uAlpha.value = 0.12 + 0.8 * Math.pow(0.5 + 0.5 * Math.sin(age * 5.2 - 1.2), 2); }
    }
    if (say && performance.now() > say.until) { say = null; refreshTag(); }
    else if (hover && !say) refreshTag(); // live labels (the clock) change text without a new hover
  }

  updateCounter();
  const api2 = {
    register,
    registerDom,
    update,
    reset() { found.clear(); storage.remove('room:found'); updateCounter(); bus.emit('room:reset'); },
    found: () => [...found],
    total,
    ids: () => [...items.keys()],
    get hoverId() { return hover ? hover.id : null; },
    /** True once the visitor has hovered or clicked any thing in the room. */
    get touched() { return touched; },
    get hintId() { return hintState ? hintState.item.id : null; },
    /** Current opacity of the outline while a hint pulses (tests: shoot at the peak). */
    get hintAlpha() { return hintState ? hullMat.uniforms.uAlpha.value : 0; },
    /** Softly pulses the outline of the first undiscovered thing in `order` (first-visit hint). Returns its id or null. */
    hint(order = ['lamp', 'homepod', 'mug', 'art', 'ipad', 'plant', 'cat', 'window']) {
      if ((hover && hover.discoverable) || hintState) return null;
      const onScreen = (i) => { const p = api2.screenPos(i.id); return p && p.visible && p.x > 20 && p.y > 20 && p.x < window.innerWidth - 20 && p.y < window.innerHeight - 20; };
      const item = order.map((id) => items.get(id)).find((i) => i && !found.has(i.id) && i.hull.length && onScreen(i));
      if (!item) return null;
      hintState = { item, t0: performance.now(), dur: 3.4 };
      return item.id;
    },
    /** Number of outline hulls currently shown (tests). */
    visibleHulls: () => [...items.values()].reduce((n, i) => n + i.hull.filter((h) => h.visible).length, 0),
    /** The tag text on screen (tests). */
    get tagText() { return tagEl.classList.contains('on') ? tagEl.textContent : ''; },
    /** Client-pixel position of an object's representative proxy (tests and the tour). */
    screenPos(id) {
      const it = items.get(id);
      if (!it || !it.proxies[0]) return null;
      const v = new THREE.Vector3();
      it.proxies[0].getWorldPosition(v);
      v.project(camera);
      return { x: ((v.x + 1) / 2) * window.innerWidth, y: ((1 - v.y) / 2) * window.innerHeight, visible: v.z < 1 };
    },
    /** Programmatic click (keyboard users / tests): same path as a real click. */
    activate(id) { const it = items.get(id); if (it && !it.dom && active()) trigger(it, null); },
    fx: api,
  };
  return api2;
}
