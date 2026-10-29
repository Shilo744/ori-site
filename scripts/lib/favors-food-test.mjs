// "Ori, Can You...?" food for the next fight [experimental], browser checks: Mum's soup in Mum's flat, the ring's menu says what he ate, the next fight starts with the bigger body and the food is gone after it, the cafe's espresso keeps
// its old sprint and adds a ring help, another bite replaces the first, a new day clears it, the save code carries it.
import { join } from 'node:path';
import { SHOTS, sleep, settle } from './harness.mjs';

export async function runFavorsFood(session, { ok, fail }) {
  const { page } = session;
  const check = (cond, msg) => (cond ? ok(`food: ${msg}`) : fail(`food: ${msg}`));
  const g = (fn, arg) => page.evaluate(fn, arg);
  const S = () => g(() => window.__ori.game3d.state());
  const saw = (re) => page.waitForFunction((src) => [...window.__tl].some((t) => new RegExp(src).test(t)), re.source, { timeout: 3000 }).then(() => true, () => false);
  const fed = async () => (await S()).progress.fed;
  const goIn = async (pid) => {
    await g((p) => window.__ori.game3d.enter(p), pid);
    await page.waitForFunction((p) => window.__ori.game3d.insideId() === p, pid, { timeout: 8000 });
    await sleep(400);
  };
  const goOut = async () => {
    await g(() => window.__ori.game3d.leave());
    await page.waitForFunction(() => !window.__ori.game3d.insideId(), null, { timeout: 8000 });
    await sleep(300);
  };
  /** Stand next to the prop that has this `use` and press Space. */
  const useProp = async (use) => {
    const room = await g(() => window.__ori.game3d.insideInfo());
    const sp = room.spots.find((p) => p.use === use);
    if (!sp) return null;
    // (a small room has a door and a person near the prop: stand where the prop itself is the nearest thing)
    for (const [dx, dz] of [[0, 1.2], [-1.2, 0], [1.2, 0], [0, -1.2], [-1.2, 1], [-1.2, -1]]) {
      await g(([p, dx, dz]) => window.__ori.game3d.teleport({ x: p.x + dx, z: p.z + dz }, Math.PI), [sp, dx, dz]);
      await sleep(350);
      if ((await g(() => window.__ori.game3d.insideInfo().spot)) === sp.kind) break;
    }
    await page.waitForFunction(() => { const h = document.querySelector('.fv-gohint'); return !!h && h.classList.contains('on') && !/Go inside|Leave/.test(h.textContent); }, null, { timeout: 4000 }).catch(() => {}); // (the chip follows the frames: on a busy machine it lags a moment behind the teleport)
    const label = await g(() => (document.querySelector('.fv-gohint') || {}).textContent || '');
    await page.keyboard.press('Space');
    await sleep(350);
    return label.replace(/\s+/g, ' ').trim();
  };

  await g(() => window.__ori.game3d.launch('favors', { quick: true }));
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 60000 });
  await g(() => { const x = window.__ori.game3d; x.setHour(15); x.game.setWeather({ rain: 0, wet: 0, overcast: 0 }); window.__tl = new Set(); window.__tt = setInterval(() => { for (const t of document.querySelectorAll('.fv-toast')) window.__tl.add(t.textContent); }, 40); });
  await sleep(500);
  check((await fed()) === null, 'a new game has eaten nothing');

  // ── Mum's soup ──
  await goIn('mum');
  const label = await useProp('food:soup');
  check(/Take Mum's chicken soup/.test(label || ''), `at the pot the chip says "${label}"`);
  check((await saw(/Mum's chicken soup: Eat, eat, you are too thin\./)) && (await fed()) && (await fed()).id === 'soup' && (await fed()).day === 1, 'Space: the soup is eaten, with a toast, and remembered for today');
  await page.keyboard.press('Space');
  await sleep(300);
  check((await saw(/had Mum's chicken soup already/)) && (await fed()).id === 'soup', 'a second spoonful is just a kind word, nothing changes');
  await goOut();

  // ── the ring's menu says what he ate; the fight starts with the bigger body; the food is gone ──
  await g(() => { const gm = window.__ori.game3d.game; const p = gm.fight.apron(); window.__ori.game3d.teleport({ x: p.x, z: p.z }, Math.PI); });
  await sleep(350);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__ori.game3d.game.fight.ui.menuOpen, null, { timeout: 5000 });
  const menuLine = await g(() => (document.querySelector('.fi-fed') || {}).textContent || '');
  check(/Fed: Mum's chicken soup: more health/.test(menuLine), `the ring's menu says it ("${menuLine}")`);
  await settle(session, 2);
  await page.screenshot({ path: join(SHOTS, 'T25-food-menu.png') });
  await page.keyboard.press('Digit1');
  await page.waitForFunction(() => window.__ori.game3d.game.fight.phase === 'fight', null, { timeout: 15000 });
  const hp = await g(() => { const b = window.__ori.game3d.game.fight.bout; return { max: b.P.maxHp, now: b.P.hp, foe: b.O.maxHp }; });
  check(hp.max === 225 && hp.now === 225, `the fight starts with the soup in him: ${hp.max} health instead of 180`);
  check((await fed()) === null && (await saw(/Mum's chicken soup kicks in: more health/)), 'and the soup is gone (one fight), with a toast');
  await g(() => { const b = window.__ori.game3d.game.fight.bout; b.O.hp = 0; b.O.state = 'ko'; });
  await page.waitForFunction(() => window.__ori.game3d.game.fight.ui.cardOpen, null, { timeout: 15000 });
  await page.click('.fi-btn.primary');
  await page.waitForFunction(() => !window.__ori.game3d.game.fight.active && !window.__ori.game3d.game.fight.ui.cardOpen, null, { timeout: 12000 }).catch(() => {});
  await sleep(900);
  if (await g(() => window.__ori.game3d.game.fight.ui.menuOpen)) { await page.keyboard.press('Escape'); await page.waitForFunction(() => !window.__ori.game3d.game.fight.ui.menuOpen, null, { timeout: 4000 }); }

  // ── the cafe: the old sprint stays, the espresso adds a ring help ──
  await goIn('cafe');
  await useProp('coffee');
  check((await saw(/A fresh espresso\. Sprint button engaged\./)) && (await saw(/Roee's espresso: A tiny cup, a big kick\./)) && (await fed()).id === 'espresso', 'the espresso at the counter: the sprint as before, and now a help for the ring');
  await goOut();

  // ── another bite replaces the first (the kiosk's gum) ──
  await goIn('kiosk');
  await useProp('food:gum');
  check((await fed()).id === 'gum' && (await saw(/Kiosk gum: Minty\. The hands feel quicker\./)), 'the kiosk\'s gum replaces the espresso: one bite at a time');
  await goOut();
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => window.__ori.game3d.game.journal.isOpen, null, { timeout: 3000 });
  await sleep(350);
  const jl = await g(() => (document.querySelector('.jr-card .fi-fed') || {}).textContent || '');
  check(/Fed: Kiosk gum: quicker hands/.test(jl), `the journal's Life page says what he is carrying ("${jl}")`);
  await page.keyboard.press('Escape'); await sleep(250);

  // ── the save code carries it; a new day clears it ──
  const rt = await g(() => { const c = window.__ori.game3d.game.campaign; const was = JSON.stringify(c.state.progress.fed); const r = c.importCode(c.exportCode()); return { ok: r.ok, same: was === JSON.stringify(c.state.progress.fed), v: was }; });
  check(rt.ok && rt.same && /"gum"/.test(rt.v), 'the save code carries what he ate');
  await g(() => window.__ori.game3d.game.nextDay());
  await sleep(600);
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => window.__ori.game3d.game.journal.isOpen, null, { timeout: 3000 });
  await sleep(350);
  check(!(await g(() => !!document.querySelector('.jr-card .fi-fed'))), 'the next morning the gum is forgotten (a bite lasts for the day)');
  await page.keyboard.press('Escape'); await sleep(250);
  await g(() => clearInterval(window.__tt));
}
