// The opening screen (T46): a dialog over the live room, the button only when the room is ready, keyboard + sound pill, a transition
// that melts the blur and removes the whole element (no backdrop-filter left behind). Runs on the freshly loaded page, before START.
import { sleep } from './harness.mjs';

export async function runIntro(session, { ok, fail }) {
  const { page } = session;
  const check = (cond, msg) => (cond ? ok(`intro: ${msg}`) : fail(`intro: ${msg}`));
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const until = (fn, arg, timeout = 8000) => page.waitForFunction(fn, arg, { timeout }).then(() => true).catch(() => false);

  const info = await ev(() => {
    const r = document.getElementById('intro');
    const veil = r.querySelector('.iv-veil');
    const cs = getComputedStyle(veil);
    const btn = document.getElementById('intro-start');
    return {
      role: r.getAttribute('role'), labelled: r.getAttribute('aria-labelledby'), modal: r.getAttribute('aria-modal'),
      blur: cs.backdropFilter || cs.webkitBackdropFilter, tone: r.dataset.tone,
      btnHidden: btn.hidden, btnText: btn.textContent, focused: document.activeElement === btn,
      mono: /mono|courier/i.test(getComputedStyle(r).fontFamily), inertHud: document.getElementById('hud').hasAttribute('inert'),
      oldBox: !!r.querySelector('.box') || !!document.getElementById('intro-text'),
      title: document.getElementById('intro-name').textContent, sub: document.getElementById('intro-sub').textContent,
    };
  });
  check(info.role === 'dialog' && info.modal === 'true' && info.labelled === 'intro-title', 'it is a modal dialog labelled by the title');
  check(/blur\(28px\)/.test(info.blur || ''), `a frosted veil over the live room (${info.blur})`);
  check(!info.oldBox && !info.mono, 'the old bordered monospace box is gone');
  check(info.title === 'Ori Asher' && /Creative Developer · Portfolio 2026/.test(info.sub), 'the name and the tagline');
  check(!info.btnHidden && info.btnText === 'Enter' && info.focused, 'the Enter button is there (the room is ready) and has the focus');
  check(info.inertHud, 'the page behind is inert while the dialog is up');
  const cur = await ev(() => {
    const probe = (n) => { const d = document.createElement('div'); d.style.cursor = `var(--cur-${n})`; document.body.appendChild(d); const c = getComputedStyle(d).cursor; d.remove(); return c; };
    const g = (s) => getComputedStyle(document.querySelector(s)).cursor;
    return { arrow: probe('arrow'), hand: probe('hand'), root: g('#intro'), name: g('#intro-name'), btn: g('#intro-start'), snd: g('#intro-sound') };
  });
  check(/^(image-set|-webkit-image-set)\(|^url\(/.test(cur.arrow) && cur.root === cur.arrow && cur.name === cur.arrow && cur.btn === cur.hand && cur.snd === cur.hand, 'the opening screen uses the shared cursor: arrow over the veil, hand on Enter and Sound');
  const tones = await ev(() => {
    const r = document.getElementById('intro');
    const out = {};
    for (const h of [13, 23, 18]) { window.__ori.setTime(h); out[h] = r.dataset.tone; }
    window.__ori.setTime(13);
    return out;
  });
  check(tones[13] === 'light' && tones[23] === 'dark' && tones[18] === 'warm', `the veil follows the time of day (${JSON.stringify(tones)})`);

  // the sound pill shares the speaker's state
  const snd0 = await ev(() => document.getElementById('intro-sound').getAttribute('aria-pressed'));
  await page.click('#intro-sound');
  await sleep(150);
  const snd1 = await ev(() => ({ pressed: document.getElementById('intro-sound').getAttribute('aria-pressed'), muted: window.__ori.core.system.get('muted') }));
  check(snd0 === 'true' && snd1.pressed === 'false' && snd1.muted === true, 'the Sound pill mutes (and shows it)');
  await page.click('#intro-sound');
  await sleep(150);
  check((await ev(() => window.__ori.core.system.get('muted'))) === false, '…and unmutes');

  // Return starts, the veil melts, the element is removed afterwards
  // (Enter on the focused Sound pill belongs to the pill; the start key works from anywhere else)
  await page.focus('#intro-start');
  await page.keyboard.press('Enter');
  check(await until(() => document.getElementById('intro') && document.getElementById('intro').classList.contains('leaving')), 'Return starts the transition');
  await sleep(350);
  const mid = await ev(() => { const v = document.querySelector('#intro .iv-veil'); return v ? getComputedStyle(v).backdropFilter : 'gone'; });
  check(/blur\(/.test(mid) && !/blur\(28px\)/.test(mid), `mid-transition the blur is melting (${mid})`);
  check(await until(() => !document.getElementById('intro'), null, 4000), 'afterwards the whole element is removed (no blur / will-change left)');
  check(await ev(() => !document.getElementById('hud').hasAttribute('inert')), 'the page is interactive again');
}
