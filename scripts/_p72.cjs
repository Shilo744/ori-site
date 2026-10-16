const fs = require('fs');
const edit = (file, pairs) => {
  let s = fs.readFileSync(file, 'utf8'); const nl = s.includes('\r\n') ? '\r\n' : '\n'; s = s.replace(/\r\n/g, '\n');
  for (const [a, b] of pairs) { if (!s.includes(a)) throw new Error(file + ' missing: ' + a.slice(0, 70)); s = s.replace(a, b); }
  fs.writeFileSync(file, nl === '\r\n' ? s.replace(/\n/g, '\r\n') : s);
};
edit('src/scene/interactions.js', [
  [`    if (next) { touched = true; endHint(); }`, `    if (next && next.discoverable) { touched = true; endHint(); } // hovering the laptop is the main call-to-action, not "touching the room"`],
  [`    if (hover) {
      hoverT = Math.min(1, hoverT + dt * 7);`, `    if (hover && hover.hull.length) {
      hoverT = Math.min(1, hoverT + dt * 7);`],
  [`    if (hintState && !hover) {`, `    if (hintState && !(hover && hover.hull.length)) {`],
  [`    hint(order = ['lamp', 'cat', 'homepod', 'window', 'plant']) {
      if (hover || hintState) return null;
      const item = order.map((id) => items.get(id)).find((i) => i && !found.has(i.id) && i.hull.length);`, `    hint(order = ['lamp', 'homepod', 'mug', 'art', 'ipad', 'plant', 'cat', 'window']) {
      if ((hover && hover.discoverable) || hintState) return null;
      const onScreen = (i) => { const p = api2.screenPos(i.id); return p && p.visible && p.x > 20 && p.y > 20 && p.x < window.innerWidth - 20 && p.y < window.innerHeight - 20; };
      const item = order.map((id) => items.get(id)).find((i) => i && !found.has(i.id) && i.hull.length && onScreen(i));`],
  [`  updateCounter();
  return {
    register,`, `  updateCounter();
  const api2 = {
    register,`],
]);
// close the object literal the way it was: "return {...};" -> "const api2 = {...}; return api2;"
let s = fs.readFileSync('src/scene/interactions.js', 'utf8'); const nl = s.includes('\r\n') ? '\r\n' : '\n'; s = s.replace(/\r\n/g, '\n');
const tailA = `    fx: api,
  };
}`;
if (!s.includes(tailA)) throw new Error('tail');
s = s.replace(tailA, `    fx: api,
  };
  return api2;
}`);
fs.writeFileSync('src/scene/interactions.js', nl === '\r\n' ? s.replace(/\n/g, '\r\n') : s);
// the test: only things that are in the first view
let t = fs.readFileSync('scripts/lib/interact-test.mjs', 'utf8').replace(/\r\n/g, '\n');
const a = `for (const [id, text] of [['lamp', /^Floor lamp/], ['cat', /^Cat/], ['homepod', /^HomePod/], ['window', /^Window/]]) {`;
if (!t.includes(a)) throw new Error('test');
t = t.replace(a, `// (the cat, window, vacuum and clock are outside the desk framing of the first view; the desk, lamp, HomePod, mug, art and iPad are in it)
    for (const [id, text] of [['lamp', /^Floor lamp/], ['homepod', /^HomePod/], ['mug', /^Coffee/], ['art', /^Wall art/], ['ipad', /^iPad/]]) {`);
t = t.replace(`'ready: lamp, cat, HomePod and window are all hoverable from the first view (tag + outline)'`, `'ready: lamp, HomePod, mug, wall art and iPad are all hoverable from the first view (tag + outline)'`);
fs.writeFileSync('scripts/lib/interact-test.mjs', t);
console.log('ok');
