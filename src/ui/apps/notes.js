// Notes — About / Experience / Skills as notes. `open('about')` etc. select a note (see the aliases below).
import { registerApp } from './registry.js';
import { ICON, I } from './icons.js';
import { esc, LIGHTS } from './shared.js';

const noteDefs = (C) => ({
  about: () => ({
    title: 'About Me',
    html: `<h1>About Me</h1>
      ${C.about.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}
      <h2>Quick facts</h2>
      <ul>${C.about.facts.map(([k, v]) => `<li><b>${esc(k)}:</b> ${esc(v)}</li>`).join('')}</ul>`,
    preview: C.about.paragraphs[0],
  }),
  experience: () => ({
    title: 'Experience',
    html: `<h1>Experience</h1>
      ${C.experience.map((e) => `<div class="xp"><div class="xp-h"><b>${esc(e.role)}</b><span>${esc(e.period)}</span></div><div class="xp-c">${esc(e.company)}</div><p>${esc(e.summary)}</p></div>`).join('')}`,
    preview: `${C.experience[0].role} · ${C.experience[0].company}`,
  }),
  skills: () => ({
    title: 'Skills & Tools',
    html: `<h1>Skills &amp; Tools</h1><p>The things I reach for every day.</p>
      <div class="chips">${C.about.skills.map((s) => `<span>${esc(s)}</span>`).join('')}</div>`,
    preview: C.about.skills.slice(0, 4).join(', '),
  }),
});
const NOTE_ORDER = ['about', 'experience', 'skills'];

const template = (NOTES) => `
    <aside class="sb nl">${LIGHTS}<div class="dragzone" data-drag></div>
      <div class="nl-head"><b>Notes</b><span>${NOTE_ORDER.length} notes</span></div>
      <div class="nl-sec">Today</div>
      ${NOTE_ORDER.map((id) => { const n = NOTES[id](); return `<button class="nli" data-note="${id}"><b>${esc(n.title)}</b><span><em>${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</em> ${esc(n.preview.slice(0, 44))}…</span></button>`; }).join('')}
    </aside>
    <div class="pane">
      <header class="tb" data-drag>
        <span class="sp"></span>
        <i class="ic">${I.folder}</i><i class="ic">${I.share}</i><span class="search"><i>${I.search}</i><em>Search</em></span>
      </header>
      <article class="note"></article>
    </div>`;

registerApp({
  id: 'notes',
  name: 'Notes',
  icon: ICON.notes,
  size: { w: 690, h: 430, minW: 480, minH: 300 },
  pos: { x: 130, y: 54 },
  dock: true,
  titlebar: 'none',
  aliases: [
    { name: 'about', args: { note: 'about' } },
    { name: 'experience', args: { note: 'experience' } },
    { name: 'skills', args: { note: 'skills' } },
  ],
  mount(el, ctx, args) {
    const NOTES = noteDefs(ctx.content);
    el.innerHTML = template(NOTES);

    const select = (id) => {
      if (!NOTES[id]) return;
      el.querySelectorAll('.nli').forEach((b) => b.classList.toggle('on', b.dataset.note === id));
      const n = NOTES[id]();
      el.querySelector('.note').innerHTML = `${n.html}<div class="note-date">${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>`;
    };
    el.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-note]');
      if (!btn) return;
      ctx.sound.click();
      select(btn.dataset.note);
    });
    select((args && args.note) || 'about');

    // opened again (e.g. `open about` while Notes is already up): just switch note
    return { onOpen: (a) => { if (a && a.note) select(a.note); } };
  },
});
