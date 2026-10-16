const fs = require('fs');
const edit = (file, pairs) => {
  let s = fs.readFileSync(file, 'utf8'); const nl = s.includes('\r\n') ? '\r\n' : '\n'; s = s.replace(/\r\n/g, '\n');
  for (const [a, b] of pairs) { if (!s.includes(a)) throw new Error(file + ' missing: ' + a.slice(0, 70)); s = s.split(a).join(b); }
  fs.writeFileSync(file, nl === '\r\n' ? s.replace(/\n/g, '\r\n') : s);
};
edit('src/ui/notifications.js', [
  [`{ tab: 'achievements' }`, `{ tab: 'trophies' }`],
  [`import { getApp } from './apps/registry.js';`, `import { getApp } from './apps/registry.js';\nimport { bus } from '../core/bus.js';`],
  [`    const icon = note.icon || meta.icon;`, `    const icon = note.icon || (meta.trophy ? TROPHY : meta.icon);`],
  [`  notifications.setSink(sink);`, `  notifications.setSink(sink);
  bus.on('nc:open', () => api.dismissAll()); // opening Notification Center sweeps the banners away (like macOS)`],
]);
edit('src/ui/notification-center.js', [
  [`import { appMeta, defaultAction } from './notifications.js';`, `import { appMeta, defaultAction, TROPHY_ICON } from './notifications.js';`],
  [`    const list = notifications.recent().slice(0, 12);`, `    const all = notifications.recent();
    const list = all.slice(0, 5);`],
  [`<i class="nc-ic\${meta.trophy ? ' trophy' : ''}">\${n.icon || meta.icon}</i>`, `<i class="nc-ic\${meta.trophy ? ' trophy' : ''}">\${n.icon || (meta.trophy ? TROPHY_ICON : meta.icon)}</i>`],
  [`</div>\`).join('') : '<div class="nc-empty">No new notifications</div>'}</div>`, `</div>\`).join('') + (all.length > list.length ? \`<div class="nc-more">+ \${all.length - list.length} older</div>\` : '') : '<div class="nc-empty">No new notifications</div>'}</div>`],
  [`    closeOthers();
    isOpen = true;`, `    closeOthers();
    bus.emit('nc:open');
    isOpen = true;`],
]);
edit('src/ui/notifications.js', [[`export function appMeta(id) {`, `export const TROPHY_ICON = TROPHY;
export function appMeta(id) {`]]);
edit('src/ui/notifications.css', [[`.mac .nc-empty {`, `.mac .nc-more { text-align: center; font-size: 11.5px; color: var(--t3); padding: 2px 0 0; }
.mac .nc-empty {`]]);
edit('src/main.js', [[`openApp('arcade', { tab: 'achievements' })`, `openApp('arcade', { tab: 'trophies' })`]]);
console.log('ok');
