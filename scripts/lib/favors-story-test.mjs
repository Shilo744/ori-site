// "Ori, Can You...?" the short story "The Peach Tree" [experimental], browser checks (T34): after the first five hellos Mum starts whispering; five people give a clue when Ori says hello to them in
// the right order (the chip on the screen says who is next, a click on it makes the beam lead there), and the park holds a party: the band, the beam, a big reward, a trophy.
import { join } from 'node:path';
import { SHOTS, sleep, settle } from './harness.mjs';

export async function runFavorsStory(session, { ok, fail }) {
  const { page } = session;
  const check = (cond, msg) => (cond ? ok(`story: ${msg}`) : fail(`story: ${msg}`));
  const g = (fn, arg) => page.evaluate(fn, arg);
  const S = () => g(() => window.__ori.game3d.state());
  const hello = (id) => g((id) => window.__ori.game3d.game.sayHello(id), id);

  await g(() => window.__ori.game3d.launch('favors', { quick: true }));
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 60000 });
  await g(() => { const x = window.__ori.game3d; x.setHour(11); x.game.setWeather({ rain: 0, wet: 0, overcast: 0 }); window.__tl = new Set(); window.__tt = setInterval(() => { for (const t of document.querySelectorAll('.fv-toast')) window.__tl.add(t.textContent); }, 40); });

  // ── before the first goal is done there is no story ──
  await sleep(1400);
  check((await S()).story.chip === '' && !(await g(() => document.querySelector('.fv-story').classList.contains('on'))), 'a new player has no story chip yet');
  await g(() => { const c = window.__ori.game3d.game.campaign; c.state.progress.hellos = 5; c.state.progress.goalsDone = ['hello']; });
  await page.waitForFunction(() => window.__ori.game3d.state().story.chip !== '', null, { timeout: 4000 });
  await page.waitForFunction(() => /Mum has a secret/.test(document.querySelector('.fv-story').textContent), null, { timeout: 4000 });
  const s0 = await S();
  check(/Mum has a secret/.test(s0.story.chip) && (await g(() => document.querySelector('.fv-story').classList.contains('on'))), `after the five hellos the story begins: "${s0.story.chip}"`);
  await settle(session, 2);
  await page.screenshot({ path: join(SHOTS, 'T34-story-chip.png') });

  // ── the clues: only the next person gives one ──
  await hello('moti'); await sleep(300);
  check((await S()).story.n === 0, 'Moti first: just a hello (the story wants Mum)');
  const p0 = (await S()).peaches;
  await hello('ima');
  await page.waitForFunction(() => window.__ori.game3d.state().story.n === 1, null, { timeout: 3000 });
  await sleep(800);
  const bubble = await g(() => [...document.querySelectorAll('.fb')].map((b) => b.textContent).join(' | '));
  const s1 = await S();
  check(/whispering/.test(bubble) && /Ask Moti/.test(s1.story.chip) && s1.peaches >= p0 + 3, `Mum's clue is in her speech bubble and the chip moves on: "${s1.story.chip}" (+${s1.peaches - p0} peaches)`);
  check((await g(() => [...window.__tl])).some((t) => /Clue 1 of 5/.test(t)), 'with a toast: "Clue 1 of 5"');
  await g(() => window.__ori.game3d.teleport('mum')); // (away from his own door: at the spawn he is inside the 7 m of Moti's building, and the beam would clear itself with "You are at Home")
  await sleep(400);
  await page.click('.fv-story');
  await sleep(300);
  check((await S()).tracked === 'home', 'a click on the chip makes the beam lead to Moti');
  await hello('ima'); await sleep(300);
  check((await S()).story.n === 1, 'Mum again gives nothing new');
  for (const [id, n] of [['moti', 2], ['albert', 3], ['roee', 4], ['coach', 5]]) {
    await hello(id);
    await page.waitForFunction((n) => window.__ori.game3d.state().story.n === n, n, { timeout: 3000 });
  }
  const s5 = await S();
  check(/park/.test(s5.story.chip) && s5.story.end === 0, `five clues, and the chip says: "${s5.story.chip}"`);
  check((await g(() => [...window.__tl])).some((t) => /last clue/.test(t)), 'the fifth toast says it is the last one');

  // ── the party ──
  const l0 = (await S()).love; const pe0 = (await S()).peaches; const xp0 = (await S()).boxer.xp + (await S()).boxer.level * 1000;
  await g(() => window.__ori.game3d.setHour(11));
  await g(() => window.__ori.game3d.teleport({ x: -55, z: -116 }, 0)); // (the middle of the park)
  await page.waitForFunction(() => window.__ori.game3d.state().story.end === 1, null, { timeout: 12000 });
  await sleep(1200);
  const s6 = await S();
  check(s6.story.party && s6.story.chip === '' && s6.events.beam === 'party' && s6.events.band === true, 'in the park the party starts: the band plays, the beam says PEACH PARTY, the chip is gone');
  check(s6.peaches >= pe0 + 50 && s6.love >= l0 + 7 && (s6.boxer.xp + s6.boxer.level * 1000) > xp0, `and it pays: +${s6.peaches - pe0} peaches, love ${l0.toFixed(1)} -> ${s6.love.toFixed(1)}`);
  check((await g(() => [...window.__tl])).some((t) => /SURPRISE/.test(t)) && (s6.progress.trophies || []).includes('story'), 'SURPRISE! and the trophy "A tree of his own"');
  await settle(session, 2);
  await page.screenshot({ path: join(SHOTS, 'T34-party.png') });

  // ── once, and on the save ──
  const rt = await g(() => { const c = window.__ori.game3d.game.campaign; const r = c.importCode(c.exportCode()); return { ok: r.ok, story: c.state.progress.story, end: c.state.progress.storyEnd }; });
  check(rt.ok && rt.story === 5 && rt.end === 1, 'the story is on the save (also through a save code)');
  await g(() => window.__ori.game3d.teleport({ x: -55, z: -90 }, 0)); await sleep(500); await g(() => window.__ori.game3d.teleport({ x: -55, z: -116 }, 0));
  await sleep(4500);
  check((await S()).peaches < s6.peaches + 20, 'no second party for the same story');
  await g(() => clearInterval(window.__tt));
}
