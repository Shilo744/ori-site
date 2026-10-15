// Safari — the project showcase (a browser-looking window with a grid of project cards).
import { registerApp } from './registry.js';
import { ICON, I } from './icons.js';
import { esc, LIGHTS, cover } from './shared.js';

const template = (C) => `
    <header class="tb stb" data-drag>
      ${LIGHTS}
      <i class="ic">${I.sidebar}</i>
      <span class="nav"><i>${I.chevL}</i><i class="dim">${I.chevR}</i></span>
      <span class="sp"></span>
      <div class="addr"><i>${I.lock}</i><span>oriasher.com</span></div>
      <span class="sp"></span>
      <i class="ic">${I.share}</i><i class="ic">${I.plus}</i><i class="ic">${I.tabs}</i>
    </header>
    <div class="web">
      <div class="web-hero">
        <div class="eyebrow">Selected work · ${C.year}</div>
        <h1>Things I’ve made.</h1>
        <p>${esc(C.tagline)}</p>
      </div>
      <div class="web-grid">
        ${C.projects.map((p, i) => `
          <a class="card" href="${esc(p.url)}" target="_blank" rel="noopener">
            <div class="cover">${cover(p.hue, i)}</div>
            <div class="meta">
              <div class="row"><b>${esc(p.name)}</b><span>${esc(p.year)}</span></div>
              <p>${esc(p.blurb)}</p>
              <div class="chips">${p.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>
            </div>
          </a>`).join('')}
      </div>
    </div>`;

registerApp({
  id: 'safari',
  name: 'Safari',
  icon: ICON.safari,
  size: { w: 780, h: 468, minW: 520, minH: 320 },
  pos: { x: 90, y: 42 },
  dock: true,
  titlebar: 'none',
  aliases: [{ name: 'projects' }],
  mount(el, ctx) {
    el.innerHTML = template(ctx.content);
  },
});
