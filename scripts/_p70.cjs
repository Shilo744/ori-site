// T39: make the room interactions discoverable from the very first view (state `ready`).
const fs = require('fs');
const edit = (file, pairs) => {
  let s = fs.readFileSync(file, 'utf8'); const nl = s.includes('\r\n') ? '\r\n' : '\n'; s = s.replace(/\r\n/g, '\n');
  for (const [a, b] of pairs) { if (!s.includes(a)) throw new Error(file + ' missing: ' + a.slice(0, 70)); s = s.replace(a, b); }
  fs.writeFileSync(file, nl === '\r\n' ? s.replace(/\n/g, '\r\n') : s);
};

edit('src/scene/interactions.js', [
  // active in the first view too
  [`  const active = () => getState() === 'overview';`, `  const active = () => { const s = getState(); return s === 'overview' || s === 'ready'; }; // the first view after START counts: that is where visitors meet the room
  let touched = false; // the visitor has hovered / clicked something (stops the first-visit hint)
  let hintState = null; // { item, t0, dur }: a soft outline pulse that says "you can touch things"`],
  // hovering counts as touching, and ends the hint
  [`    if (hover === next) return;
    if (say) { say = null; }`, `    if (hover === next) return;
    if (next) { touched = true; endHint(); }
    if (say) { say = null; }`],
  // a click that hits a thing is consumed here (the stage must not also "enter the screen" on it)
  [`    const item = pickAt(e.clientX, e.clientY);
    if (item && !item.dom) trigger(item, e);
  });`, `    const item = pickAt(e.clientX, e.clientY);
    if (item && !item.dom) { e.stopPropagation(); trigger(item, e); }
  });`],
  [`  function trigger(item, event) {
    discover(item);`, `  function trigger(item, event) {
    touched = true;
    endHint();
    discover(item);`],
  // proxies never get smaller than ~14 px on screen (the first view is far away)
  [`    const item = { discoverable: true, ...def, hull: [], proxies: def.proxies || [] };
    item.proxies.forEach((p) => {`, `    const item = { discoverable: true, ...def, hull: [], proxies: def.proxies || [] };
    item.base = item.proxies.map((p) => p.scale.clone());
    item.radius = item.proxies.reduce((m, p) => { p.geometry.computeBoundingSphere(); return Math.max(m, p.geometry.boundingSphere.radius * Math.max(p.scale.x, p.scale.y, p.scale.z)); }, 0.5);
    item.proxies.forEach((p) => {`],
  [`  function update(dt, t) {
    if (!active()) {`, `  // keep every thing hoverable from the far first view: inflate its pick proxies so they cover at least \`MIN_PX\` on screen
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
      if (hintState) endHint();`],
  [`    hullMat.uniforms.uH.value = canvas.height;`, `    inflateProxies();
    hullMat.uniforms.uH.value = canvas.height;`],
  [`    if (say && performance.now() > say.until) { say = null; refreshTag(); }`, `    if (hintState && !hover) {
      const age = (performance.now() - hintState.t0) / 1000;
      if (age > hintState.dur) endHint();
      else { hintState.item.hull.forEach((x) => { x.visible = true; }); hullMat.uniforms.uAlpha.value = 0.12 + 0.8 * Math.pow(0.5 + 0.5 * Math.sin(age * 5.2 - 1.2), 2); }
    }
    if (say && performance.now() > say.until) { say = null; refreshTag(); }`],
  [`    get hoverId() { return hover ? hover.id : null; },`, `    get hoverId() { return hover ? hover.id : null; },
    /** True once the visitor has hovered or clicked any thing in the room. */
    get touched() { return touched; },
    get hintId() { return hintState ? hintState.item.id : null; },
    /** Softly pulses the outline of the first undiscovered thing in \`order\` (first-visit hint). Returns its id or null. */
    hint(order = ['lamp', 'cat', 'homepod', 'window', 'plant']) {
      if (hover || hintState) return null;
      const item = order.map((id) => items.get(id)).find((i) => i && !found.has(i.id) && i.hull.length);
      if (!item) return null;
      hintState = { item, t0: performance.now(), dur: 3.4 };
      return item.id;
    },`],
]);

edit('src/main.js', [
  [`stage.addEventListener('click', (e) => {
  if (state === 'ready') { enterScreen(); return; }`, `stage.addEventListener('click', (e) => {
  if (state === 'ready') {
    // first view: a click enters the screen only when it lands on the laptop; things in the room are handled by
    // scene/interactions.js (it stops the event); anything else just nudges the laptop
    if (e.target.closest('.mac') || hitsMac(e.clientX, e.clientY)) enterScreen(); else nudgeLaptop();
    return;
  }`],
  [`desktop.root.addEventListener('click', () => {
  if (state === 'overview') enterScreen();
});`, `desktop.root.addEventListener('click', () => {
  if (state === 'overview' || state === 'ready') enterScreen();
});
promptEl.addEventListener('click', () => { if (state === 'ready') enterScreen(); });

// a click on empty space in the first view: the laptop hops a little ("this is the thing to click")
let nudgeT = 1;
function nudgeLaptop() {
  nudgeT = 0;
  sound.blip(520, 0.05, 'triangle', 0.04);
  promptEl.classList.remove('nudge');
  void promptEl.offsetWidth;
  promptEl.classList.add('nudge');
}`],
  [`  else if (state === 'overview') enterScreen();
});

soundBtn`, `  else if (state === 'overview' || state === 'ready') enterScreen();
});

soundBtn`],
  [`  state = 'ready';
  promptEl.classList.add('on');`, `  state = 'ready';
  promptEl.classList.add('on');
  hud.classList.add('on'); // the HUD (and the "Discovered n/11" counter) is there from the first view
  viewBtn.hidden = false;
  // first-visit hint: if nobody has touched anything after a few seconds, softly pulse one thing's outline
  setTimeout(() => { if (state === 'ready' && !interactions.touched && !system.get('reduceMotion')) interactions.hint(); }, FAST ? 900 : 6000);`],
  [`  world.update(dt, t, state);`, `  if (nudgeT < 1) { nudgeT = Math.min(1, nudgeT + dt * 3.2); mac.group.scale.setScalar(1 + 0.045 * Math.sin(Math.PI * nudgeT)); if (nudgeT >= 1) mac.group.scale.setScalar(1); }
  world.update(dt, t, state);`],
]);

edit('public/index.html', [[`<div id="prompt" class="tag">Click anywhere to begin</div>`, `<div id="prompt" class="tag" role="button" tabindex="0">Click the laptop to start — or poke around the room</div>`]]);
edit('src/styles.css', [[`#prompt.on { animation: blink 1.6s steps(2, jump-none) infinite; }`, `#prompt.on { animation: blink 1.6s steps(2, jump-none) infinite; pointer-events: auto; cursor: pointer; }
#prompt.on.nudge { animation: promptNudge 0.6s ease; }
@keyframes promptNudge { 0% { transform: translateX(-50%) scale(1); } 30% { transform: translateX(-50%) scale(1.1); background: #3a46e0; } 100% { transform: translateX(-50%) scale(1); } }`]]);
console.log('T39 patch ok');
