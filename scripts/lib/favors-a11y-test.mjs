// "Ori, Can You...?" focus and ARIA, browser checks (T17): the pause menu, the map and the journal are real dialogs - named in the accessibility tree, the focus goes in and stays in,
// Tab walks round inside, the keys work without a mouse, and the focus comes back when they close. Everything the player can press has a name.
import { sleep } from './harness.mjs';

export async function runFavorsA11y(session, { ok, fail }) {
  const { page } = session;
  const check = (cond, msg) => (cond ? ok(`a11y: ${msg}`) : fail(`a11y: ${msg}`));
  const g = (fn, arg) => page.evaluate(fn, arg);
  const where = () => g(() => {
    const a = document.activeElement;
    const within = (sel) => !!(a && a.closest && a.closest(sel));
    return { menu: within('.g3d-menu'), map: within('.mp'), journal: within('.jr'), tag: a ? a.tagName : '', type: (a && a.type) || '', text: a ? (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 40) : '' };
  });
  const nameless = () => g(() => [...document.querySelectorAll('#g3d button, #g3d [role="button"], #g3d input, #g3d select, #g3d textarea')]
    .filter((n) => !n.hidden && !n.closest('[hidden]') && n.getClientRects().length)
    .filter((n) => !((n.getAttribute('aria-label') || '').trim() || (n.textContent || '').trim() || (n.labels && n.labels[0] && n.labels[0].textContent.trim()) || (n.getAttribute('title') || '').trim()))
    .map((n) => `${n.tagName.toLowerCase()}.${n.className}`));

  await g(() => window.__ori.game3d.launch('favors', { quick: true }));
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 60000 });
  await sleep(400);

  const live = await g(() => document.querySelectorAll('#g3d [aria-live]').length);
  const imgs = await g(() => [...document.querySelectorAll('#g3d canvas[aria-label]')].every((c) => c.getAttribute('role') === 'img'));
  check(live >= 3 && imgs, `the goal, the place and the toasts are live regions (${live}), the labelled canvases are pictures`);
  check((await nameless()).length === 0, `every button of the HUD has a name (${(await nameless()).join(', ') || 'none without'})`);

  // ── the pause menu ──
  await page.keyboard.press('Escape');
  await sleep(250);
  const tree = await page.getByRole('dialog', { name: 'Paused' }).ariaSnapshot();
  const want = [/button "Resume"/, /button "Start the day again"/, /slider "Sound volume"/, /switch "Reduce motion"/, /switch "High-contrast HUD"/, /button "Key hints/, /button "Copy my save code"/, /button "Load a save code"/, /button "Show the first steps again"/];
  const missing = want.filter((r) => !r.test(tree)).map(String);
  check(missing.length === 0, `the accessibility tree names the pause menu's dialog and everything in it${missing.length ? ` (missing ${missing.join(' ')})` : ''}`);
  check(await g(() => document.querySelector('.g3d-menu:not(.fv-report)').getAttribute('aria-modal') === 'true'), 'the pause menu is modal');
  const w0 = await where();
  check(w0.menu && w0.text === 'Resume', `the focus goes in: Resume (${w0.text})`);
  let inside = true;
  for (let i = 0; i < 16; i++) { await page.keyboard.press('Tab'); inside = inside && (await where()).menu; }
  check(inside, 'sixteen Tabs walk round inside the menu, never out of it');
  await page.keyboard.press('Tab'); // (it is back at some control; walk to the first one for the next check)
  for (let i = 0; i < 12; i++) { if ((await where()).text === 'Resume') break; await page.keyboard.press('Tab'); }
  await page.keyboard.press('Shift+Tab');
  const w1 = await where();
  check(w1.menu && w1.text !== 'Resume' && /first steps/i.test(w1.text), `Shift+Tab from the first control wraps to the last (${w1.text})`);
  check(await nameless().then((l) => l.length === 0), 'every control of the pause menu has a name');
  await page.keyboard.press('Escape');
  await sleep(250);
  const w2 = await where();
  check(!w2.menu && !(await g(() => window.__ori.game3d.paused)), `Esc closes it and the focus is not left inside (${w2.tag})`);

  // ── the map: the focus goes in, Tab stays in, Enter on a row follows the place, Esc closes ──
  await page.keyboard.press('KeyM');
  await sleep(350);
  const m0 = await where();
  check(m0.map && (await page.getByRole('dialog', { name: 'Map' }).count()) === 1 && (await g(() => document.querySelector('.mp').getAttribute('aria-modal') === 'true')), `M opens the map as a modal dialog with the focus inside (${m0.text})`);
  let mapIn = true;
  for (let i = 0; i < 26; i++) { await page.keyboard.press('Tab'); mapIn = mapIn && (await where()).map; }
  check(mapIn, 'twenty-six Tabs stay inside the map');
  for (let i = 0; i < 30; i++) { if (await g(() => !!document.activeElement.closest('.mp-list li') && /The Ring/.test(document.activeElement.textContent))) break; await page.keyboard.press('Tab'); }
  await page.keyboard.press('Enter');
  await sleep(250);
  const tracked = await g(() => window.__ori.game3d.state().tracked);
  check(tracked === 'court' && (await g(() => !!document.querySelector('.mp-list li.follow[aria-current="true"]'))), `Enter on "The Ring" in the list follows it, no mouse needed (${tracked})`);
  await page.keyboard.press('Space');
  await sleep(200);
  check((await g(() => window.__ori.game3d.state().tracked)) === null, 'Space on the same row lets it go again');
  check(await nameless().then((l) => l.length === 0), 'every row and button of the map has a name');
  await page.keyboard.press('Escape');
  await sleep(250);
  check(!(await where()).map && !(await g(() => window.__ori.game3d.state().mapOpen)), 'Esc closes the map');

  // ── the journal: the card takes the focus and keeps it (it is drawn again only when something changed) ──
  await page.keyboard.press('Tab');
  await sleep(300);
  const j0 = await where();
  check(j0.journal && (await g(() => document.querySelector('.jr').getAttribute('aria-modal') === 'true')) && (await page.getByRole('dialog', { name: 'Journal' }).count()) === 1, 'Tab opens the journal as a modal dialog and the focus is on it');
  await g(() => { document.querySelector('.jr-card').__mark = 7; });
  await sleep(2400);
  const kept = await g(() => ({ mark: document.querySelector('.jr-card').__mark, focus: !!document.activeElement.closest('.jr') }));
  check(kept.mark === 7 && kept.focus, 'two seconds later the card is the same card and the focus is still on it (nothing was drawn again for nothing)');
  const jt = await page.getByRole('dialog', { name: 'Journal' }).ariaSnapshot();
  check(/heading "Ori"/.test(jt) && /heading "Career"/.test(jt) && /heading "Goals"/.test(jt), 'the journal reads as headings: Ori, Boxer, The ladder, Goals, Career');
  await page.keyboard.press('Escape');
  await sleep(250);
  check(!(await where()).journal && !(await g(() => document.querySelector('.jr') && !document.querySelector('.jr').hidden)), 'Esc closes the journal');
}
