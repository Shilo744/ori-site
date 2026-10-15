// Contract checks for src/core (storage, bus, achievements, notify), run inside the page; includes a reload to
// prove persistence.
export async function runCoreContract(session, { ok, fail }) {
  const { page } = session;
  const check = (cond, msg) => (cond ? ok(`core: ${msg}`) : fail(`core: ${msg}`));

  const r = await page.evaluate(() => {
    const { storage, bus, achievements, notifications } = window.__ori.core;
    const out = {};
    // storage
    storage.set('t:a', { n: 1, s: 'x' });
    out.storageGet = JSON.stringify(storage.get('t:a'));
    out.storageDefault = storage.get('t:missing', 'dflt');
    const sc = storage.scope('t:scope');
    sc.set('k', [1, 2]);
    out.scopeGet = JSON.stringify(sc.get('k'));
    out.scopeKeys = sc.keys().join();
    out.rawKey = window.localStorage.getItem('ori2:t:a') !== null;
    window.localStorage.setItem('ori2:t:bad', '{not json');
    out.badJson = storage.get('t:bad', 'safe');
    storage.remove('t:a');
    out.removed = storage.get('t:a', 'gone');
    sc.clear();
    out.scopeCleared = sc.keys().length;
    storage.remove('t:bad');
    // bus
    const seen = [];
    const off = bus.on('t:evt', (v) => seen.push(v));
    bus.once('t:evt', (v) => seen.push(`once${v}`));
    bus.emit('t:evt', 1);
    bus.emit('t:evt', 2);
    off();
    bus.emit('t:evt', 3);
    bus.on('t:throw', () => { throw new Error('boom'); });
    bus.on('t:throw', () => seen.push('after-throw'));
    const origErr = console.error; console.error = () => {};
    bus.emit('t:throw');
    console.error = origErr;
    out.bus = seen.join();
    // achievements + notify
    achievements.define([{ id: 't-ach', name: 'Test', goal: 3 }, { id: 't-one', name: 'One' }]);
    const unlocks = [];
    bus.on('achievement:unlock', (a) => unlocks.push(a.id));
    const before = notifications.recent().length;
    achievements.progress('t-ach', 2);
    out.prog = achievements.list().find((a) => a.id === 't-ach').progress;
    achievements.progress('t-ach', 1); // never lowers
    out.prog2 = achievements.list().find((a) => a.id === 't-ach').progress;
    achievements.increment('t-ach');
    out.unlockedByProgress = achievements.isUnlocked('t-ach');
    out.unlockOnce = [achievements.unlock('t-one'), achievements.unlock('t-one')].join();
    out.unlockEvents = unlocks.join();
    out.notified = notifications.recent().length - before;
    out.counts = JSON.stringify(achievements.counts());
    return out;
  });
  check(r.storageGet === '{"n":1,"s":"x"}', 'storage get/set round-trips JSON');
  check(r.storageDefault === 'dflt', 'storage returns the fallback for missing keys');
  check(r.scopeGet === '[1,2]' && r.scopeKeys === 'k', 'storage.scope prefixes keys');
  check(r.rawKey, 'values are persisted in localStorage under the ori2: namespace');
  check(r.badJson === 'safe', 'corrupt JSON falls back instead of throwing');
  check(r.removed === 'gone' && r.scopeCleared === 0, 'remove() / scope.clear() delete');
  check(r.bus === '1,once1,2,after-throw', 'bus: on / once / off, and a throwing handler does not break others');
  check(r.prog === 2 && r.prog2 === 2, 'achievements.progress only ever raises the counter');
  check(r.unlockedByProgress, 'reaching the goal unlocks');
  check(r.unlockOnce === 'true,false' && r.unlockEvents === 't-ach,t-one', 'unlock() fires once and emits achievement:unlock');
  check(r.notified === 2, 'each unlock queues a notification');
  check(r.counts === '{"unlocked":2,"total":2}', 'counts()');

  // persistence across a reload
  await page.evaluate(() => window.__ori.core.storage.set('t:persist', { ok: true }));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ori && window.__ori.ready, null, { timeout: 60000 });
  const after = await page.evaluate(() => {
    const { storage, achievements } = window.__ori.core;
    achievements.define([{ id: 't-ach', name: 'Test', goal: 3 }, { id: 't-one', name: 'One' }]);
    const res = { persisted: JSON.stringify(storage.get('t:persist')), unlocked: achievements.list().filter((a) => a.unlocked).map((a) => a.id).join() };
    achievements.reset();
    storage.remove('t:persist');
    res.afterReset = achievements.counts().unlocked;
    return res;
  });
  check(after.persisted === '{"ok":true}', 'storage survives a reload');
  check(after.unlocked === 't-ach,t-one', 'achievement state survives a reload');
  check(after.afterReset === 0, 'achievements.reset() clears progress');
}
