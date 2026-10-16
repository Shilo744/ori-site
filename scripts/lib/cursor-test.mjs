// One pointer everywhere (T57): the same arrow / hand / I-beam / grab / macOS resize images on the room, the HUD, the intro, the laptop
// screen (desktop, Dock, apps, links, text fields, resize handles, locked, compact) and the game overlays. Walks real elements and
// asserts their COMPUTED cursor is one of our images — and scans every element of the page for a stray system cursor.
import { backToRoom, settle, sleep } from './harness.mjs';

const IMG = /^(image-set|-webkit-image-set)\(|^url\(/;

/** In the page: every element must compute to one of our cursor images (not-allowed / wait / progress / none are fine). */
export function scanCursors() {
  const desc = (e) => e.tagName.toLowerCase() + (e.id ? `#${e.id}` : '') + (e.classList.length ? `.${[...e.classList].slice(0, 2).join('.')}` : '');
  const ours = /^(image-set|-webkit-image-set)\(|^url\(/;
  const bad = [];
  let n = 0;
  for (const e of document.querySelectorAll('*')) {
    n++;
    const c = getComputedStyle(e).cursor;
    if (ours.test(c) || /^(not-allowed|wait|progress|none)\b/.test(c)) continue;
    bad.push(`${desc(e)}: ${c.slice(0, 40)}`);
  }
  return { n, count: bad.length, bad: bad.slice(0, 6) };
}

export async function runCursors(session, { ok, fail }) {
  const { page } = session;
  const flat = session.width < 860;
  const check = (cond, msg) => (cond ? ok(`cursors: ${msg}`) : fail(`cursors: ${msg}`));
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const ref = (name) => ev((n) => { const d = document.createElement('div'); d.style.cursor = `var(--cur-${n})`; document.body.appendChild(d); const c = getComputedStyle(d).cursor; d.remove(); return c; }, name);
  const of = (sel) => ev((q) => { const e = document.querySelector(q); return e ? getComputedStyle(e).cursor : null; }, sel);
  const scan = async (label) => {
    const r = await ev(scanCursors);
    check(r.count === 0 && r.n > 50, `${label}: every one of ${r.n} elements shows our cursor images${r.count ? ` — strays: ${r.bad.join(' | ')}` : ''}`);
  };

  // ── the shapes themselves: nine distinct, drawn images with a black body and a white outline (or the reverse), hot spot inside ──
  const names = ['arrow', 'hand', 'text', 'grab', 'grabbing', 'ew', 'ns', 'nwse', 'nesw'];
  const refs = {};
  for (const n of names) refs[n] = await ref(n);
  check(names.every((n) => IMG.test(refs[n])) && new Set(Object.values(refs)).size === names.length, 'the nine cursor shapes are nine different images defined once on :root');
  const draw = await ev(async (list) => {
    const out = {};
    for (const n of list) {
      const v = getComputedStyle(document.documentElement).getPropertyValue(`--cur-${n}`);
      const m = /url\("(data:image\/svg\+xml,[^"]+)"\)\s*2x/.exec(v) || /url\("(data:image\/svg\+xml,[^"]+)"\)/.exec(v);
      const hot = /\)\s+(\d+) (\d+),\s*[a-z-]+\s*$/.exec(v);
      if (!m) { out[n] = null; continue; }
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = m[1]; });
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let dark = 0, light = 0;
      for (let i = 0; i < d.length; i += 4) { if (d[i + 3] > 200) { if (d[i] < 70) dark++; else if (d[i] > 190) light++; } }
      out[n] = { w: c.width, h: c.height, dark, light, hot: hot ? [+hot[1], +hot[2]] : null };
    }
    return out;
  }, names);
  const drawOk = names.every((n) => { const d = draw[n]; return d && d.dark > 25 && d.light > 25 && d.w <= 64 && d.h <= 64 && d.hot && d.hot[0] <= d.w / 2 && d.hot[1] <= d.h / 2; });
  check(drawOk, `each image renders (black + white pixels, ≤ 32 px, hot spot inside): ${names.map((n) => `${n} ${draw[n] ? `${draw[n].w}×${draw[n].h}` : '✗'}`).join(', ')}`);

  if (!flat) {
    // ── the room: the canvas, the HUD, the chevrons, the dots, the prompt ──
    await ev(() => window.__ori.setView('overview'));
    await page.mouse.move(8, 8); // (an earlier block may have left the pointer on a thing: the canvas then shows the hand)
    await page.waitForFunction(() => !window.__ori.interactions || window.__ori.interactions.hoverId === null, null, { timeout: 4000 }).catch(() => {});
    await sleep(300);
    const room = await ev(() => {
      const g = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).cursor : null; };
      return { html: g('html'), body: g('body'), canvas: g('#stage canvas') || g('canvas'), hud: g('#hud'), clock: g('#hud-clock'), found: g('#hud-found'), btn: g('#hud .btn'), trophies: g('#hud-trophies'),
        chev: g('.nav-chev:not(:disabled)'), dot: g('.st-dots button'), prompt: g('#prompt'), toasts: g('#toasts') };
    });
    check(room.html === refs.arrow && room.body === refs.arrow && room.canvas === refs.arrow && room.hud === refs.arrow && room.clock === refs.arrow && room.found === refs.arrow && room.toasts === refs.arrow,
      `the room, the page and the HUD labels show the arrow (not the system one)${Object.entries(room).filter(([k, v]) => ['html', 'body', 'canvas', 'hud', 'clock', 'found', 'toasts'].includes(k) && v !== refs.arrow).map(([k, v]) => ` — ${k}: ${String(v).slice(0, 30)}`).join('')}`);
    check(room.btn === refs.hand && room.trophies === refs.hand && room.chev === refs.hand && room.dot === refs.hand, 'the HUD buttons, the Trophies tag, the chevrons and the dots show the pointing hand');
    const promptOn = await ev(() => { const p = document.getElementById('prompt'); return p ? { on: p.classList.contains('on'), c: getComputedStyle(p).cursor } : null; });
    check(!promptOn || !promptOn.on || promptOn.c === refs.hand, 'the start prompt is a hand while it is clickable');
    // a real mouse over the empty room is the arrow; over the laptop it is the hand (inline var(--cur-hand), set by interactions.js)
    await page.mouse.move(8, 8);
    await sleep(120);
    check((await ev(() => getComputedStyle(document.elementFromPoint(8, 8)).cursor)) === refs.arrow, 'a mouse over the empty corner of the room shows the arrow');
    await scan('the room');
  }

  // ── the laptop screen ──
  if (!flat) {
    await ev(() => window.__ori.enterScreen());
    await page.waitForFunction(() => window.__ori.state === 'screen', null, { timeout: 15000 });
    await sleep(500);
  }
  await settle(session, 2);
  const scr = await ev(() => {
    const g = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).cursor : null; };
    const a = document.createElement('a'); a.href = '#t57'; a.textContent = 'x';
    const sp = document.querySelector('.mac .scr'); sp.appendChild(a);
    const link = getComputedStyle(a).cursor; a.remove();
    return { desktop: g('.mac .scr'), dock: g('.mac .dk'), link };
  });
  check(scr.desktop === refs.arrow && scr.dock === refs.arrow, 'on the macOS desktop and the Dock the arrow shows');
  check(scr.link === refs.hand, 'a link inside the screen gets the pointing hand');
  await ev(() => { window.__ori.openApp('terminal'); window.__ori.openApp('notes'); window.__ori.openApp('settings'); window.__ori.openApp('arcade'); });
  await settle(session, 2);
  await sleep(450);
  const apps = await ev(() => {
    const g = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).cursor : null; };
    return { text: g('.mac textarea') || g('.mac input[type="text"]') || g('.mac input:not([type])') || g('.mac input[type="search"]'), handles: [...document.querySelectorAll('.mac [data-rz]')].map((e) => e.dataset.rz + ':' + (getComputedStyle(e).cursor === ({ n: 'ns', s: 'ns', e: 'ew', w: 'ew', ne: 'nesw', sw: 'nesw', nw: 'nwse', se: 'nwse' }[e.dataset.rz]) ? 'x' : '')) };
  });
  check(apps.text && IMG.test(apps.text) && apps.text !== refs.arrow, 'a text field inside an app shows the I-beam');
  check(apps.handles.length >= 8, `resize handles exist on the open windows (${apps.handles.length})`);
  await scan('the screen with four apps open');

  // the shut laptop is a button; compact mode keeps the same images
  await ev(() => window.__ori.desktop.setLocked(true));
  check((await of('.mac')) === refs.hand, 'the shut screen shows the hand (it is the way in)');
  await ev(() => window.__ori.desktop.setLocked(false));
  await ev(() => window.__ori.desktop.setCompact(true));
  check((await of('.mac .scr')) === refs.arrow, 'compact mode keeps the arrow');
  await scan('compact mode');
  await ev(() => window.__ori.desktop.setCompact(false));

  if (!flat) {
    await backToRoom(session);
    await settle(session, 2);
    await scan('back in the room');
  }
}
