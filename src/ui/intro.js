// The opening screen (T46): a frosted veil over the live room, a quiet greeting in several languages that settles on the name, and
// one pill button that appears only when the room is really ready. Our own type and layout (nothing borrowed from anyone's branding).
import './intro.css';

const GREETINGS = [
  { t: 'Hello', lang: 'en' },
  { t: 'שלום', lang: 'he', dir: 'rtl' },
  { t: 'Hola', lang: 'es' },
];
const WORD_MS = 1450;
const MIN_SHOW_MS = 1500; // the greeting is seen at least this long before the button appears
const SPEAKER = '<path d="M3.5 9.5v5h3.6L12 18.5v-13L7.1 9.5z"/><path class="w" d="M15.5 9a4.3 4.3 0 0 1 0 6M18.2 6.5a8 8 0 0 1 0 11"/>';
const SPEAKER_OFF = '<path d="M3.5 9.5v5h3.6L12 18.5v-13L7.1 9.5z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>';

/**
 * @param {object} o
 *   fast          ?fast=1: no cycling, the button at once
 *   name, tagline, year   the text
 *   whenReady     promise: the first frame of the room has been drawn
 *   getHours      () => hour of day 0..24 (the veil follows it)
 *   soundOn       () => boolean;  onSoundToggle() flips it (the HUD speaker button's logic)
 *   reduceMotion  () => boolean (Settings → Accessibility)
 */
export function createIntro({ fast = false, name, tagline, year, whenReady, getHours, soundOn, onSoundToggle, reduceMotion = () => false }) {
  const root = document.getElementById('intro');
  const q = (s) => root.querySelector(s);
  const el = { greet: q('#intro-greet'), name: q('#intro-name'), sub: q('#intro-sub'), btn: q('#intro-start'), hint: q('#intro-hint'), wait: q('#intro-wait'), ring: q('#intro-ring .fg'), status: q('#intro-status'), sound: q('#intro-sound') };
  const inertTargets = ['hud', 'prompt'].map((id) => document.getElementById(id)).filter(Boolean);
  let gone = false;
  let anim = null;
  const t0 = performance.now();
  const calm = () => reduceMotion() || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (calm()) root.classList.add('calm');
  inertTargets.forEach((n) => n.setAttribute('inert', ''));

  el.name.textContent = name;
  el.sub.textContent = `${tagline} · Portfolio ${year}`;

  // ── the veil follows the time of day ──
  function tone(h) {
    const night = h < 5.8 || h >= 19.4;
    const warm = !night && (h < 8 || h >= 16.8);
    root.dataset.tone = night ? 'dark' : warm ? 'warm' : 'light';
  }
  tone(getHours());
  const onSetTime = (e) => tone(e.detail && typeof e.detail.hours === 'number' ? e.detail.hours : getHours());
  window.addEventListener('ori:settime', onSetTime);

  // ── sound pill ──
  function setSound(on) {
    el.sound.setAttribute('aria-pressed', String(on));
    el.sound.setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
    el.sound.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${on ? SPEAKER : SPEAKER_OFF}</svg><span>${on ? 'Sound on' : 'Sound off'}</span>`;
  }
  setSound(soundOn());
  el.sound.addEventListener('click', () => onSoundToggle());

  // ── the greeting cycle, then the name ──
  const KF_IN_OUT = [
    { opacity: 0, filter: 'blur(14px)', transform: 'translateY(12px) scale(0.98)' },
    { opacity: 1, filter: 'blur(0)', transform: 'none', offset: 0.26 },
    { opacity: 1, filter: 'blur(0)', transform: 'none', offset: 0.74 },
    { opacity: 0, filter: 'blur(12px)', transform: 'translateY(-10px) scale(1.01)' },
  ];
  const play = (node, frames, ms, fill = 'forwards') => {
    try { anim = node.animate(frames, { duration: ms, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill }); return anim.finished.catch(() => {}); } catch { node.style.opacity = '1'; return Promise.resolve(); }
  };
  function showName(instant) {
    el.name.style.opacity = '1';
    el.sub.classList.add('on');
    if (instant || calm()) { el.name.classList.remove('shine'); return; }
    play(el.name, [{ opacity: 0, filter: 'blur(14px)', transform: 'translateY(12px)' }, { opacity: 1, filter: 'blur(0)', transform: 'none' }], 1100);
    el.name.classList.add('shine');
  }
  async function cycle() {
    if (fast || calm()) { showName(true); return; }
    for (const g of GREETINGS) {
      if (gone) return;
      el.greet.textContent = g.t;
      el.greet.lang = g.lang;
      el.greet.dir = g.dir || 'ltr';
      await play(el.greet, KF_IN_OUT, WORD_MS, 'both');
    }
    if (!gone) { el.greet.style.opacity = '0'; showName(false); }
  }

  // ── readiness: real steps (fonts, the first rendered frame) — the ring only shows when it takes a moment ──
  const steps = { fonts: false, scene: true, frame: false }; // (the scene is built before this module runs)
  const progress = () => (steps.fonts ? 0.3 : 0) + (steps.scene ? 0.3 : 0) + (steps.frame ? 0.4 : 0);
  function paint() {
    el.ring.style.strokeDashoffset = String(81.7 * (1 - progress()));
  }
  const fonts = (document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]) : Promise.resolve()).then(() => { steps.fonts = true; paint(); });
  const frame = Promise.resolve(whenReady).then(() => { steps.frame = true; paint(); });
  const waitTimer = 0; // (no loading state: the button is there from the first moment)
  paint();
  revealCta();
  function revealCta() {
    if (gone) return;
    clearTimeout(waitTimer);
    el.wait.hidden = true;
    el.status.textContent = '';
    el.btn.hidden = false;
    el.hint.hidden = false;
    if (fast) { el.btn.style.animation = 'none'; el.hint.style.animation = 'none'; }
    el.btn.focus({ preventScroll: true });
    el.btn.style.animationDelay = '0s';
  }

  // Return / Space starts as soon as the button is there
  const onKey = (e) => {
    if (gone || el.btn.hidden) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (document.activeElement === el.sound) return; // the sound pill keeps its own Enter / Space
    e.preventDefault();
    el.btn.click();
  };
  window.addEventListener('keydown', onKey);
  // the focus ring is for keyboard users only: the button is focused by script so Return works, which must not draw a ring by itself
  const onKbd = (e) => { if (e.key === 'Tab' || e.key.startsWith('Arrow')) root.classList.add('kbd'); };
  window.addEventListener('keydown', onKbd);

  cycle();

  return {
    el: root,
    setSound,
    /** The room takes over: the blur melts, the type lifts away; then the whole element is removed (no blur, no will-change left). */
    leave() {
      if (gone) return Promise.resolve();
      gone = true;
      clearTimeout(waitTimer);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keydown', onKbd);
      window.removeEventListener('ori:settime', onSetTime);
      inertTargets.forEach((n) => n.removeAttribute('inert'));
      if (anim) { try { anim.cancel(); } catch { /* done */ } }
      root.classList.add('leaving');
      return new Promise((res) => setTimeout(() => { root.remove(); res(); }, calm() ? 600 : 1350));
    },
  };
}
