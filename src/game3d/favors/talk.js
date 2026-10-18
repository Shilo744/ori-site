// "Ori, Can You...?" — the conversation panel (DOM + the portraits). Two real 3D faces (Ori and whoever he is talking to) with their expressions
// and lip-flap, the speaker's name, the line typed out letter by letter with a blip per letter in that character's own voice (subtitles are always
// the text itself), numbered choices, a Compliment button (C), relationship hearts. The game feeds it effects through `onEffects`.
//   Space / Enter / click = next (first press finishes the line)     1-4 = choose     C = compliment     Esc = say goodbye
import './talk.css';
import { createRunner } from './dialogue.js';
import { graphFor } from './dialogue/index.js';
import { speaker } from './dialogue/cast.js';
import { complimentFor } from './dialogue/compliments.js';
import { blipPitch } from './voices.js';
import { createPortraits } from './portraits.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5S3.5 15 3.5 9.2A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8.5 2.2C20.5 15 12 20.5 12 20.5z"/></svg>';

/**
 * @param {HTMLElement} overlay the game overlay
 * @param {{ tier?: string, sfx: object, getRel: (id: string) => number, getFlags: () => Set<string>, onEffects: (fx: object, who: string, info: object) => void,
 *           onOpen?: (info: object) => void, onClose?: (info: object) => void }} o
 */
export function createTalk(overlay, { tier = 'high', sfx, getRel, getFlags, onEffects, onOpen, onClose }) {
  const root = document.createElement('section');
  root.className = 'fv-talk';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Conversation');
  root.innerHTML = `
    <div class="fv-tk-face ori" data-k="faceO"><canvas data-k="cvO" aria-hidden="true"></canvas><b>Ori</b></div>
    <div class="fv-tk-main fv-glass">
      <header><span class="fv-tk-name" data-k="name"></span><span class="fv-tk-role" data-k="role"></span><span class="fv-tk-hearts" data-k="hearts" aria-label="Friendship"></span></header>
      <p class="fv-tk-text" data-k="text" aria-live="polite"></p>
      <div class="fv-tk-choices" data-k="choices"></div>
      <footer><span data-k="hint"></span><button type="button" class="fv-tk-comp" data-k="comp"><i>✦</i> Compliment <kbd>C</kbd></button><button type="button" class="fv-tk-bye" data-k="bye">Bye <kbd>Esc</kbd></button></footer>
    </div>
    <div class="fv-tk-face them" data-k="faceT"><canvas data-k="cvT" aria-hidden="true"></canvas><b data-k="nameT"></b></div>
    <div class="fv-tk-floats" data-k="floats" aria-hidden="true"></div>`;
  overlay.append(root);
  const q = (k) => root.querySelector(`[data-k="${k}"]`);
  const el = Object.fromEntries(['faceO', 'cvO', 'faceT', 'cvT', 'name', 'nameT', 'role', 'hearts', 'text', 'choices', 'hint', 'comp', 'bye', 'floats'].map((k) => [k, q(k)]));

  const portraits = createPortraits({ tier });
  let who = null; // the speaker record of the other person
  let whoId = '';
  let flags = null;
  let ctx = null;
  let stack = []; // runners: the main conversation first, interludes (a compliment) on top
  let slotO = null;
  let slotT = null;
  let open = false;
  let line = null; // the current line (from the top runner)
  let shown = 0; // letters revealed
  let acc = 0;
  let speaking = 'ori';
  let info = null;
  let complimented = false;
  let token = 0;
  let unlockAt = 0;

  const heartsFor = (rel) => Math.max(0, Math.min(5, Math.round(rel / 20)));
  function drawHearts() {
    const n = heartsFor(ctx.rel);
    el.hearts.innerHTML = Array.from({ length: 5 }, (_, i) => `<i class="${i < n ? 'on' : ''}">${HEART}</i>`).join('');
  }
  function floatHeart(n = 1) {
    for (let i = 0; i < n; i++) {
      const h = document.createElement('i');
      h.className = 'fv-tk-float';
      h.innerHTML = HEART;
      h.style.left = `${46 + i * 7 + Math.random() * 6}%`;
      el.floats.append(h);
      setTimeout(() => h.remove(), 1500);
    }
  }
  function applyNew(effects, from) {
    for (let i = from; i < effects.length; i++) {
      const fx = effects[i];
      onEffects && onEffects(fx, whoId, info);
      if (fx.rel > 0) { floatHeart(Math.min(3, Math.ceil(fx.rel / 2))); }
    }
    drawHearts();
  }

  function who2speaker(s) { return s === 'stranger' ? whoId : s; }

  function show() {
    const run = stack[stack.length - 1];
    line = run.runner.line();
    if (!line) { next(); return; }
    shown = 0;
    acc = 0;
    speaking = line.speaker === 'ori' ? 'ori' : 'them';
    const sp = line.speaker === 'ori' ? null : speaker(who2speaker(line.speaker));
    el.name.textContent = line.speaker === 'ori' ? 'Ori' : who.name;
    el.role.textContent = line.speaker === 'ori' ? '' : who.role || '';
    el.faceO.classList.toggle('talking', speaking === 'ori');
    el.faceT.classList.toggle('talking', speaking === 'them');
    root.dataset.speaker = speaking;
    el.text.textContent = '';
    el.choices.innerHTML = '';
    el.choices.classList.remove('on');
    void sp;
    updateFooter();
  }

  function updateFooter() {
    const full = shown >= (line ? line.text.length : 0);
    el.hint.textContent = line && line.choices && full ? '1–' + line.choices.length + ' · choose' : full ? 'Space · next' : 'Space · skip';
    el.comp.hidden = complimented || !!stack[stack.length - 1].interlude;
  }

  function reveal(n) {
    const text = line.text;
    const voice = (line.speaker === 'ori' ? speaker('ori') : who).voice;
    for (let i = shown; i < Math.min(n, text.length); i++) sfx && sfx.blip(voice, blipPitch(voice, text[i], i));
    shown = Math.min(n, text.length);
    el.text.textContent = text.slice(0, shown);
    if (shown >= text.length) finishLine();
  }
  function finishLine() {
    el.text.textContent = line.text;
    shown = line.text.length;
    if (line.choices) {
      el.choices.innerHTML = line.choices.map((c, i) => `<button type="button" data-i="${c.index}"><kbd>${i + 1}</kbd><span>${esc(c.text)}</span></button>`).join('');
      el.choices.classList.add('on');
    }
    updateFooter();
  }

  function setFaces() {
    const mood = line ? line.emotion : 'smile';
    return mood;
  }

  function advance() {
    if (!open || !line) return;
    if (performance.now() < unlockAt) return;
    if (shown < line.text.length) { reveal(line.text.length); return; }
    if (line.choices) return; // a choice is needed
    const run = stack[stack.length - 1];
    const n0 = run.runner.effects.length;
    run.runner.advance();
    applyNew(run.runner.effects, n0);
    afterStep();
  }
  function choose(i) {
    if (!open || !line || !line.choices || shown < line.text.length) return;
    const c = line.choices[i];
    if (!c) return;
    const run = stack[stack.length - 1];
    const n0 = run.runner.effects.length;
    run.runner.choose(c.index);
    applyNew(run.runner.effects, n0);
    sfx && sfx.tap();
    afterStep();
  }
  function afterStep() {
    const run = stack[stack.length - 1];
    if (run.runner.done) {
      stack.pop();
      if (!stack.length) { close(); return; }
      if (run.interlude) { // back to where the conversation was
        const main = stack[stack.length - 1];
        void main;
      }
    }
    show();
  }
  function next() { afterStep(); }

  /** Ori pays a compliment: a little exchange about the other person, then back to where the conversation was. */
  function compliment() {
    if (!open || complimented || stack[stack.length - 1].interlude) return;
    complimented = true;
    const c = complimentFor(who.spec, whoId.startsWith('stranger') ? '' : whoId, (info.seed || 1) * 13 + whoId.length);
    const sid = whoId;
    const g = {
      id: 'compliment', start: 'a',
      nodes: {
        a: { s: 'ori', e: 'smile', t: c.ori, next: 'b' },
        b: { s: sid, e: c.emo, t: c.reply, fx: { rel: c.hearts, flag: `${sid}.complimented`, ...(c.hint ? { hint: c.hint } : {}) }, end: true },
      },
    };
    stack.push({ runner: createRunner(g, ctx), interlude: true });
    el.comp.hidden = true;
    show();
  }

  function close() {
    if (!open) return;
    open = false;
    root.classList.remove('on');
    setTimeout(() => { if (!open) root.hidden = true; }, 240);
    const i = info;
    info = null;
    onClose && onClose(i);
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]');
    if (b) { const idx = +b.dataset.i; const k = line.choices.findIndex((c) => c.index === idx); choose(k); return; }
    if (e.target.closest('[data-k="comp"]')) { compliment(); return; }
    if (e.target.closest('[data-k="bye"]')) { close(); return; }
    if (e.target.closest('.fv-tk-main') || e.target.closest('.fv-tk-face')) advance();
  });

  return {
    get isOpen() { return open; },
    get speaker() { return whoId; },
    get line() { return line ? { ...line, shown } : null; },
    /** Starts a conversation with a speaker id ('ima', 'clerk', 'stranger:7', 'roee' ...). `o`: { graph?, seed?, from? } */
    start(id, o = {}) {
      if (open) return false;
      whoId = id;
      who = speaker(id);
      info = { id, seed: o.seed || 1, from: o.from || null };
      const graph = o.graph || graphFor(id);
      flags = getFlags();
      ctx = { flags, rel: getRel(id) };
      stack = [{ runner: createRunner(graph, ctx), interlude: false }];
      complimented = false;
      open = true;
      root.hidden = false;
      el.nameT.textContent = who.name;
      el.hearts.hidden = !!who.stranger && false;
      drawHearts();
      requestAnimationFrame(() => root.classList.add('on'));
      unlockAt = performance.now() + 250;
      const mine = ++token;
      // the faces (building a character takes a moment: the text starts at once, the portraits join when they are ready)
      setTimeout(() => {
        if (mine !== token || !open) return;
        slotO = portraits.set(el.cvO, null, { ori: true });
        slotT = portraits.set(el.cvT, who.spec);
      }, 30);
      applyNew(stack[0].runner.effects, 0);
      onOpen && onOpen(info);
      show();
      return true;
    },
    /** Keys while a conversation is open: returns true when the key was used (everything else is swallowed too). */
    key(e) {
      if (!open) return false;
      if (e.code === 'Escape') { close(); return true; }
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE' || e.code === 'KeyF') { advance(); return true; }
      if (e.code === 'KeyC') { compliment(); return true; }
      const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
      if (m) { choose(+m[1] - 1); return true; }
      return true;
    },
    /** Per frame while open (dt seconds). */
    update(dt) {
      if (!open) return;
      if (line && shown < line.text.length) {
        const voice = (line.speaker === 'ori' ? speaker('ori') : who).voice;
        acc += dt;
        const n = Math.floor(acc / voice.rate);
        if (n > 0) { acc -= n * voice.rate; reveal(shown + n); }
      }
      const talkingNow = !!line && shown < line.text.length;
      const mood = line ? line.emotion : 'smile';
      if (slotO) portraits.draw(slotO, dt, { talking: talkingNow && speaking === 'ori', mood: speaking === 'ori' ? mood : (speaking === 'them' && line && /love|laugh|grin|proud|smile|wink/.test(line.emotion) ? 'smile' : 'smile') });
      if (slotT) portraits.draw(slotT, dt, { talking: talkingNow && speaking === 'them', mood: speaking === 'them' ? mood : 'smile' });
      void setFaces;
    },
    close,
    dispose() { open = false; token++; portraits.dispose(); root.remove(); },
  };
}
