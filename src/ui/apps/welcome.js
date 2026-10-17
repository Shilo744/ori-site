// Welcome — the small intro card that greets visitors (shows up as "Finder" in the menubar, like the original).
import { registerApp } from './registry.js';
import { ICON } from './icons.js';
import { esc, LIGHTS } from './shared.js';

const template = (C) => `
    <div class="welcome" data-drag>
      ${LIGHTS}
      <div class="wl-av">${esc(C.initials)}</div>
      <h1>${esc(C.name)}</h1>
      <p class="role">${esc(C.title)}</p>
      <p class="tagline">${esc(C.tagline)}</p>
      <button class="btn wl-play" data-open="favors">Play: Ori, Can You...?</button>
      <div class="wl-btns">
        <button class="btn def" data-open="projects">View Projects</button>
        <button class="btn" data-open="about">About</button>
        <button class="btn" data-open="experience">Experience</button>
        <button class="btn" data-open="contact">Contact</button>
      </div>
    </div>`;

registerApp({
  id: 'welcome',
  name: 'Finder',
  menuTitle: 'Welcome',
  icon: ICON.finder,
  dockId: 'finder',
  size: { w: 480, h: 360, minW: 420, minH: 320 },
  pos: { x: 240, y: 84 },
  hidden: true,
  titlebar: 'none',
  aliases: [{ name: 'home' }],
  mount(el, ctx) {
    el.innerHTML = template(ctx.content);
  },
});
