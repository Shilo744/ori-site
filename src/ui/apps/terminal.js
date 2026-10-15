// Terminal — a small zsh-like shell that answers questions about Ori (the rewrite with a virtual FS lands in T17).
import { registerApp, resolve, listApps } from './registry.js';
import { ICON } from './icons.js';
import { esc, LIGHTS } from './shared.js';

const template = (C) => `
    <header class="tb dark" data-drag>${LIGHTS}<b class="tt c">${esc(C.name.split(' ')[0].toLowerCase())} — -zsh — 80×24</b></header>
    <div class="term"><div class="out"></div><label class="in"><span>${esc(C.name.split(' ')[0].toLowerCase())}@macbook ~ %</span><input spellcheck="false" autocomplete="off" autocapitalize="off" /></label></div>`;

function initTerminal(el, ctx) {
  const C = ctx.content;
  const out = el.querySelector('.out');
  const input = el.querySelector('input');
  const first = C.name.split(' ')[0].toLowerCase();
  const history = [];
  let hi = 0;
  const print = (lines, cls = '') => {
    [].concat(lines).forEach((l) => {
      const d = document.createElement('div');
      if (cls) d.className = cls;
      d.innerHTML = l === '' ? '&nbsp;' : l;
      out.appendChild(d);
    });
    out.scrollTop = out.scrollHeight;
  };
  const openable = () => listApps({ category: 'app', hidden: false }).map((a) => a.id).join(', ');
  const commands = {
    help: () => ['Available commands:', '  <b>about</b>       who I am', '  <b>skills</b>      what I work with', '  <b>projects</b>    selected work', '  <b>experience</b>  where I\'ve worked', '  <b>contact</b>     get in touch', '  <b>open</b> &lt;app&gt;  open an app', '  <b>games</b>       list the arcade games', '  <b>play</b> &lt;game&gt; start a game', '  <b>clear</b>       clear the screen'],
    about: () => C.about.paragraphs.map(esc),
    whoami: () => [`${esc(C.name)} — ${esc(C.title)}, based in ${esc(C.location)}.`],
    skills: () => [C.about.skills.map(esc).join(' · ')],
    projects: () => C.projects.map((p) => `• <b>${esc(p.name)}</b> (${esc(p.year)}) — ${esc(p.blurb)}`),
    experience: () => C.experience.map((e) => `• <b>${esc(e.role)}</b> @ ${esc(e.company)} <span class="dim">${esc(e.period)}</span>`),
    contact: () => [`email: <b>${esc(C.contact.email)}</b>`, ...C.contact.links.map((l) => `${esc(l.label.toLowerCase())}: ${esc(l.url)}`)],
    date: () => [new Date().toString()],
    clear: () => { out.innerHTML = ''; return []; },
    open: (a) => (resolve(a) ? (ctx.open(a), [`opening ${esc(a)}…`]) : [`unknown app: ${esc(a || '')}  (try: ${openable()})`]),
    games: () => [
      'Arcade games (type <b>play &lt;id&gt;</b>):',
      ...listApps({ category: 'game' }).map((g) => `  <b>${esc(g.id)}</b>${' '.repeat(Math.max(1, 12 - g.id.length))}${esc(g.name)}`),
    ],
    play: (a) => {
      const g = a && listApps({ category: 'game' }).find((x) => x.id === a);
      if (!g) return [`unknown game: ${esc(a || '')}  (try: ${listApps({ category: 'game' }).map((x) => x.id).join(', ')})`];
      ctx.open(g.id);
      return [`launching ${esc(g.name)}…`];
    },
    sudo: () => ['Permission granted. Ori has been notified 🎉  Say hi: ' + esc(C.contact.email)],
  };
  print([`<span class="dim">Last login: ${new Date().toDateString()} on ttys001</span>`, `Welcome! Type <b>help</b> to see what you can do.`, '']);
  el.addEventListener('click', () => input.focus());
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const raw = input.value.trim();
      print(`<span class="dim">${esc(first)}@macbook ~ %</span> ${esc(raw)}`);
      input.value = '';
      if (raw) { history.push(raw); hi = history.length; }
      const [cmd, ...args] = raw.split(/\s+/);
      if (!cmd) return;
      const fn = commands[cmd.toLowerCase()];
      print(fn ? fn(args.join(' ').toLowerCase()) : [`zsh: command not found: ${esc(cmd)}`], fn ? '' : 'err');
    } else if (e.key === 'ArrowUp') {
      if (hi > 0) { hi--; input.value = history[hi]; }
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      if (hi < history.length) { hi++; input.value = history[hi] || ''; }
      e.preventDefault();
    }
  });
  setTimeout(() => input.focus(), 50);
}

registerApp({
  id: 'terminal',
  name: 'Terminal',
  icon: ICON.terminal,
  size: { w: 580, h: 350, minW: 400, minH: 240 },
  pos: { x: 70, y: 116 },
  dock: true,
  titlebar: 'none',
  mount(el, ctx) {
    el.innerHTML = template(ctx.content);
    initTerminal(el, ctx);
  },
});
