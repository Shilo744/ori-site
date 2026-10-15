// System Settings — currently the "About this Mac" pane (functional panes arrive with T11).
import { registerApp } from './registry.js';
import { ICON, I, lg } from './icons.js';
import { esc, LIGHTS } from './shared.js';

const template = (C) => `
    <aside class="sb">${LIGHTS}<div class="dragzone" data-drag></div>
      <div class="sb-search"><i>${I.search}</i><em>Search</em></div>
      ${[['#0a84ff', 'Wi‑Fi'], ['#0a84ff', 'Bluetooth'], ['#34c759', 'Network'], ['#ff3b30', 'Notifications'], ['#ff2d55', 'Sound'], ['#5e5ce6', 'Focus'], ['#8e8e93', 'General', true], ['#0a84ff', 'Appearance'], ['#5856d6', 'Accessibility']]
        .map(([c, l, on]) => `<div class="sbi${on ? ' on' : ''}"><i class="sqi" style="background:${c}"></i><span>${l}</span></div>`).join('')}
    </aside>
    <div class="pane gray">
      <header class="tb" data-drag><span class="nav"><i>${I.chevL}</i><i class="dim">${I.chevR}</i></span><b class="tt c">About</b></header>
      <div class="set">
        <div class="set-hero">
          <svg viewBox="0 0 120 80" aria-hidden="true"><defs>${lg('lb', '#e9ebef', '#c3c7cf')}${lg('ls', '#5b3fd6', '#e8658b', 1, 1)}</defs><rect x="14" y="4" width="92" height="62" rx="6" fill="url(#lb)"/><rect x="18.5" y="8.5" width="83" height="53" rx="2.5" fill="url(#ls)"/><path d="M4 70h112l-6 5H10z" fill="url(#lb)"/></svg>
          <h2>MacBook Air</h2><p>13-inch, ${C.year}</p>
        </div>
        <div class="grp">
          ${[['Name', `${C.name}’s MacBook`], ['Role', C.title], ['Location', C.location], ['Email', C.contact.email], ['Portfolio', String(C.year)]]
            .map(([k, v]) => `<div class="kv"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}
        </div>
      </div>
    </div>`;

registerApp({
  id: 'settings',
  name: 'System Settings',
  icon: ICON.settings,
  size: { w: 640, h: 420, minW: 520, minH: 340 },
  pos: { x: 160, y: 50 },
  dock: true,
  titlebar: 'none',
  mount(el, ctx) {
    el.innerHTML = template(ctx.content);
  },
});
