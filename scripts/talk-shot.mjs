// Dev tool (T61): screenshots of the conversation panel.   node scripts/talk-shot.mjs --name=T61-talk-mum --who=ima --at=mum --steps=3 [--choose=2] [--size=1600x900] [--no-build]
//   --steps = how many lines to advance before the shot; --choose = 1-based choice to pick when a choice appears (repeatable as 1,2,...)
import { build, serveDist, launchBrowser, newSession, loadSite, parseSize, sleep, settle } from './lib/harness.mjs';
import { join } from 'node:path';
import { SHOTS } from './lib/harness.mjs';
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const size = parseSize(args.size) || { width: 1600, height: 900 };
if (!args['no-build']) build();
const server = await serveDist();
const { browser } = await launchBrowser();
try {
  const s = await newSession(browser, server.origin, size);
  await loadSite(s, server.origin);
  const { page } = s;
  await page.evaluate(() => window.__ori.game3d.launch('favors', { quick: true }));
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 90000 });
  await page.evaluate(([at, hour]) => { const g = window.__ori.game3d; g.setHour(hour); g.teleport(at); }, [args.at || 'mum', +(args.hour || 13)]);
  await sleep(1500);
  const picks = String(args.choose || '1').split(',').map(Number);
  console.log('started', await page.evaluate((w) => window.__ori.game3d.talk(w), args.who || 'ima'));
  await sleep(1200);
  let pi = 0;
  for (let i = 0; i < +(args.steps || 0); i++) {
    await page.evaluate(() => window.__ori.game3d.talkKey('Space')); // finishes the line
    await sleep(120);
    const st = await page.evaluate(() => window.__ori.game3d.talkState());
    if (st.line && st.line.choices) { await page.evaluate((k) => window.__ori.game3d.talkKey('Digit' + k), picks[Math.min(pi++, picks.length - 1)]); await sleep(150); }
    else await page.evaluate(() => window.__ori.game3d.talkKey('Space'));
    await sleep(200);
  }
  if (args.comp) { await page.evaluate(() => window.__ori.game3d.talkKey('KeyC')); await sleep(200); }
  await sleep(+(args.wait || 700));
  if (args.type) await sleep(1500);
  else await page.evaluate(() => window.__ori.game3d.talkKey('Space')); // show the whole line
  await sleep(600);
  await settle(s, 2);
  const st = await page.evaluate(() => window.__ori.game3d.talkState());
  console.log(JSON.stringify(st).slice(0, 400));
  const out = join(SHOTS, `${args.name || 'T61-talk'}.png`);
  await page.screenshot({ path: out });
  console.log('wrote', out);
  s.errors.forEach((e) => console.log('ERR', e.kind, e.text.slice(0, 300)));
} finally { await browser.close(); await server.close(); }
