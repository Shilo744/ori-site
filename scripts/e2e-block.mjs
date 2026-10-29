// Runs ONE browser check block of the smoke suite on its own:  npm run test:life | test:daylight | test:interact | test:settings | test:notify | test:drift3d | test:driftrace | wm2   (or  node scripts/e2e-block.mjs <life|daylight|wm2|interact|settings|notify|drift|cursors> [--size=WxH] [--no-build])
import { build, serveDist, launchBrowser, newSession, loadSite, enterScreen, backToRoom, parseSize } from './lib/harness.mjs';
import { runLife } from './lib/life-test.mjs';
import { runDaylight } from './lib/daylight-test.mjs';
import { runWm2 } from './lib/wm2-test.mjs';
import { runInteract } from './lib/interact-test.mjs';
import { runSettings, runSettingsReload } from './lib/settings-test.mjs';
import { runNotify, runNotifyOnboarding } from './lib/notify-test.mjs';
import { runDrift } from './lib/drift-test.mjs';
import { runDriftRace } from './lib/drift-race-test.mjs';
import { runCursors } from './lib/cursor-test.mjs';
import { runFavors3d } from './lib/favors3d-test.mjs';
import { runFavorsPlay } from './lib/favors-play-test.mjs';
import { runFavorsLife } from './lib/favors-life-test.mjs';
import { runFavorsSound } from './lib/favors-sound-test.mjs';
import { runFavorsSettings } from './lib/favors-settings-test.mjs';
import { runFavorsRobust } from './lib/favors-robust-test.mjs';
import { runFavorsSoak } from './lib/favors-soak-test.mjs';
import { runFavorsA11y } from './lib/favors-a11y-test.mjs';
import { runFavorsArcade } from './lib/favors-arcade-test.mjs';
import { runFavorsLife3 } from './lib/favors-life3-test.mjs';
import { runFavorsTrophies } from './lib/favors-trophies-test.mjs';
import { runFavorsGuide } from './lib/favors-guide-test.mjs';
import { runFavorsEvents } from './lib/favors-events-test.mjs';
import { runFavorsStory } from './lib/favors-story-test.mjs';
import { runFavorsCoffee } from './lib/favors-coffee-test.mjs';
import { runFavorsParcel } from './lib/favors-parcel-test.mjs';
import { runFavorsTouch } from './lib/favors-touch-test.mjs';
import { runFavorsWishes } from './lib/favors-wishes-test.mjs';
import { runFavorsStamps } from './lib/favors-stamps-test.mjs';
import { runFavorsCaptions } from './lib/favors-captions-test.mjs';
import { runFavorsFood } from './lib/favors-food-test.mjs';
import { runFavorsPhoto } from './lib/favors-photo-test.mjs';
import { runFavorsGifts } from './lib/favors-gifts-test.mjs';
import { runFavorsCats } from './lib/favors-cats-test.mjs';
import { runFavorsLeague } from './lib/favors-league-test.mjs';
import { runLauncher, runIphoneLaunch } from './lib/launcher-test.mjs';

const BLOCKS = { 'favors-sound': async (s, h) => { await runFavorsSound(s, h); }, 'favors-settings': async (s, h) => { await runFavorsSettings(s, h); }, 'favors-robust': async (s, h) => { await runFavorsRobust(s, h); }, 'favors-soak': async (s, h) => { await runFavorsSoak(s, h); }, 'favors-a11y': async (s, h) => { await runFavorsA11y(s, h); }, 'favors-arcade': async (s, h) => { await runFavorsArcade(s, h); }, 'favors-life3': async (s, h) => { await runFavorsLife3(s, h); }, 'favors-trophies': async (s, h) => { await runFavorsTrophies(s, h); }, 'favors-guide': async (s, h) => { await runFavorsGuide(s, h); }, 'favors-events': async (s, h) => { await runFavorsEvents(s, h); }, 'favors-story': async (s, h) => { await runFavorsStory(s, h); }, 'favors-coffee': async (s, h) => { await runFavorsCoffee(s, h); }, 'favors-parcel': async (s, h) => { await runFavorsParcel(s, h); }, 'favors-touch': async (s, h) => { await runFavorsTouch(s, h); }, 'favors-wishes': async (s, h) => { await runFavorsWishes(s, h); }, 'favors-stamps': async (s, h) => { await runFavorsStamps(s, h); }, 'favors-captions': async (s, h) => { await runFavorsCaptions(s, h); }, 'favors-food': async (s, h) => { await runFavorsFood(s, h); }, 'favors-photo': async (s, h) => { await runFavorsPhoto(s, h); }, 'favors-gifts': async (s, h) => { await runFavorsGifts(s, h); }, 'favors-cats': async (s, h) => { await runFavorsCats(s, h); }, 'favors-league': async (s, h) => { await runFavorsLeague(s, h); }, 'favors-life': async (s, h) => { await runFavorsLife(s, h); }, 'favors-play': async (s, h) => { await runFavorsPlay(s, h); }, launcher: async (s, h) => { await runLauncher(s, h); await runIphoneLaunch(s, h); }, favors3d: async (s, h) => { await runFavors3d(s, h); }, cursors: runCursors, drift: runDrift, 'drift-race': runDriftRace, life: runLife, daylight: runDaylight, wm2: runWm2, interact: runInteract, settings: async (s, h) => { await runSettings(s, h); await runSettingsReload(s, h); }, notify: async (s, h) => { await runNotify(s, h); await runNotifyOnboarding(s, h); } };
const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith('--'));
const flag = (n) => args.includes(`--${n}`);
const size = parseSize((args.find((a) => a.startsWith('--size=')) || '').split('=')[1]) || { width: 1280, height: 800 };
if (!name || !BLOCKS[name]) {
  console.error(`usage: node scripts/e2e-block.mjs <${Object.keys(BLOCKS).join('|')}> [--size=1280x800] [--no-build]`);
  process.exit(2);
}
let failures = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { failures++; console.error(`  ✗ ${m}`); };

if (!flag('no-build')) build();
const server = await serveDist();
const { browser } = await launchBrowser();
try {
  const s = await newSession(browser, server.origin, size);
  await loadSite(s, server.origin);
  await enterScreen(s);
  if (size.width >= 860 && name !== 'wm2' && name !== 'settings' && name !== 'notify' && name !== 'launcher') await backToRoom(s); // wm2 works on the screen itself
  await BLOCKS[name](s, { ok, fail });
  s.errors.forEach((e) => fail(`${e.kind}: ${e.text.split('\n')[0]}`));
  await s.context.close();
} catch (e) {
  fail(`harness error: ${e.stack || e}`);
} finally {
  await browser.close();
  await server.close();
}
console.log(failures ? `\n${name.toUpperCase()} FAILED (${failures})` : `\n${name.toUpperCase()} OK`);
process.exit(failures ? 1 : 0);
