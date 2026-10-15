// Finder — sidebar + a grid of the portfolio "files" (double-click opens the matching app).
import { registerApp } from './registry.js';
import { ICON, I, docIcon, folderIcon } from './icons.js';
import { esc, LIGHTS, sbItem } from './shared.js';

const template = (C) => `
    <aside class="sb">${LIGHTS}<div class="dragzone" data-drag></div>
      <div class="sb-sec">Favorites</div>
      ${sbItem('airdrop', 'AirDrop')}${sbItem('clock', 'Recents')}${sbItem('apps', 'Applications')}${sbItem('desktop', 'Desktop')}${sbItem('doc', 'Documents')}${sbItem('download', 'Downloads')}
      <div class="sb-sec">iCloud</div>${sbItem('cloud', 'iCloud Drive')}
      <div class="sb-sec">Locations</div>${sbItem('laptop', `${C.name.split(' ')[0]}’s MacBook`)}
    </aside>
    <div class="pane">
      <header class="tb" data-drag>
        <span class="nav"><i>${I.chevL}</i><i class="dim">${I.chevR}</i></span>
        <b class="tt"><i>${I.folder}</i>${esc(C.name)}</b>
        <span class="sp"></span>
        <span class="seg"><i class="on">${I.grid}</i><i>${I.list}</i></span>
        <span class="search"><i>${I.search}</i><em>Search</em></span>
      </header>
      <div class="fgrid">
        <div class="fitem" data-dopen="about"><div class="fic">${docIcon('#5b8def')}</div><span>About Me.txt</span></div>
        <div class="fitem" data-dopen="experience"><div class="fic">${docIcon('#34c759')}</div><span>Experience.pdf</span></div>
        <div class="fitem" data-dopen="projects"><div class="fic folder">${folderIcon()}</div><span>Projects</span></div>
        <div class="fitem" data-dopen="contact"><div class="fic">${docIcon('#ff9f0a')}</div><span>Contact.vcf</span></div>
      </div>
      <footer class="fstat">4 items, 128 GB available</footer>
    </div>`;

registerApp({
  id: 'finder',
  name: 'Finder',
  icon: ICON.finder,
  size: { w: 600, h: 380, minW: 440, minH: 300 },
  pos: { x: 120, y: 66 },
  dock: true,
  titlebar: 'none',
  mount(el, ctx) {
    el.innerHTML = template(ctx.content);
    el.addEventListener('click', (e) => {
      const item = e.target.closest('.fitem');
      if (!item) return;
      ctx.sound.click();
      el.querySelectorAll('.fitem.sel').forEach((n) => n.classList.remove('sel'));
      item.classList.add('sel');
    });
  },
});
