// Arcade — the game launcher: hero with "Continue playing", a grid of covers with best score / plays / last played,
// a Leaderboard tab and an Achievements tab. Games register themselves in ../games/catalog.js.
import './arcade.css';
import { registerApp } from './registry.js';
import { sq, lg } from './icons.js';
import { esc } from './shared.js';
import { bus } from '../../core/bus.js';
import { listGames, getGameInfo, coverOf } from '../games/catalog.js';
import { scores } from '../games/scores.js';
import { renderLeaderboard, renderAchievements, ago, fmt } from './arcade-views.js';

const ICON = sq('AR',
  `<rect width="64" height="64" fill="url(#gAR)"/>
   <circle cx="46" cy="14" r="22" fill="url(#gAR3)"/>
   <path d="M20.5 22h23a11 11 0 0 1 10.7 8.4l2.6 11.6a7.6 7.6 0 0 1-13.4 6.2L39.6 42H24.4l-3.8 6.2A7.6 7.6 0 0 1 7.2 42l2.6-11.6A11 11 0 0 1 20.5 22z" fill="url(#gAR2)"/>
   <path d="M20.5 22h23a11 11 0 0 1 10.7 8.4" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.2"/>
   <g fill="#2b2470"><rect x="17.6" y="28.2" width="3.2" height="10.4" rx="1.4"/><rect x="14" y="31.8" width="10.4" height="3.2" rx="1.4"/></g>
   <circle cx="43.4" cy="30.6" r="2.7" fill="#ff3da6"/><circle cx="49.2" cy="35.6" r="2.7" fill="#35f2ff"/>
   <circle cx="37.8" cy="35.6" r="1.6" fill="#8f6bff"/>`,
  lg('gAR', '#5b4bff', '#150f4a') + lg('gAR2', '#ffffff', '#c9cdf5') +
  '<radialGradient id="gAR3"><stop offset="0" stop-color="#7ef0ff" stop-opacity=".55"/><stop offset="1" stop-color="#7ef0ff" stop-opacity="0"/></radialGradient>');

const TABS = [['games', 'Games'], ['board', 'Leaderboard'], ['trophies', 'Achievements']];

function lastPlayed() {
  return listGames()
    .map((g) => ({ g, t: Math.max(0, ...[g.id, ...g.variants.map((v) => v.id)].map((id) => scores.get(id).last || 0)) }))
    .filter((x) => x.t > 0)
    .sort((a, b) => b.t - a.t)[0]?.g || null;
}

function heroHTML() {
  const g = lastPlayed();
  if (!g) {
    const first = listGames()[0];
    return `<section class="arc-hero" style="--accent:#35f2ff">
      <div class="arc-hero-bg"><i></i><i></i><i></i></div>
      <div class="arc-hero-copy"><div class="gk-kicker">Arcade</div><h1>Little games, <em>big neon.</em></h1>
        <p>Pick one below — your scores and trophies are saved on this device.</p>
        ${first ? `<div class="arc-hero-actions"><button type="button" class="gk-btn gk-primary" data-play="${esc(first.id)}">Play ${esc(first.name)}</button></div>` : ''}</div>
      ${first ? `<canvas class="arc-hero-art" data-cover="${esc(first.id)}" width="400" height="225"></canvas>` : ''}
    </section>`;
  }
  const s = scores.get(g.id);
  return `<section class="arc-hero" style="--accent:${esc(g.accent)}">
    <div class="arc-hero-bg"><i></i><i></i><i></i></div>
    <div class="arc-hero-copy"><div class="gk-kicker">Welcome back</div><h1>Pick up <em>${esc(g.name)}</em></h1>
      <p>${s.best != null ? `Your best is ${esc(fmt(g, s.best))}` : 'No score yet'} · ${s.plays} ${s.plays === 1 ? 'run' : 'runs'} · played ${esc(ago(s.last))}</p>
      <div class="arc-hero-actions"><button type="button" class="gk-btn gk-primary" data-play="${esc(g.id)}">Continue playing</button></div></div>
    <canvas class="arc-hero-art" data-cover="${esc(g.id)}" width="400" height="225"></canvas>
  </section>`;
}

const cardHTML = (g) => {
  const s = scores.get(g.id);
  return `<article class="arc-card" tabindex="0" role="button" aria-label="Play ${esc(g.name)}" data-play="${esc(g.id)}" style="--accent:${esc(g.accent)}">
    <canvas class="arc-cover" data-cover="${esc(g.id)}" width="400" height="225"></canvas>
    <div class="arc-meta"><b>${esc(g.name)}</b><span>${esc(g.tagline)}</span></div>
    <div class="arc-stats"><i><em>Best</em>${esc(fmt(g, s.best))}</i><i><em>Plays</em>${s.plays}</i><i><em>Last</em>${esc(ago(s.last))}</i></div>
    <div class="arc-cta" aria-hidden="true"><span>Play</span><svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z"/></svg></div>
    <div class="arc-hint">${esc(g.controls)}</div>
  </article>`;
};

const gamesHTML = () => `${heroHTML()}
  <div class="arc-sec"><h2>All games</h2><span>${listGames().length} ${listGames().length === 1 ? 'game' : 'games'}</span></div>
  <div class="arc-grid">${listGames().map(cardHTML).join('')}</div>`;

registerApp({
  id: 'arcade',
  name: 'Arcade',
  icon: ICON,
  size: { w: 720, h: 500, minW: 520, minH: 380 },
  pos: { x: 120, y: 38 },
  dock: true,
  titlebar: 'dark',
  chrome: 'game',
  aliases: [{ name: 'games' }],
  mount(el, ctx) {
    el.classList.add('gk', 'arc');
    el.innerHTML = `<nav class="arc-tabs" role="tablist">${TABS.map(([id, label]) => `<button type="button" role="tab" class="arc-tab" data-tab="${id}">${label}</button>`).join('')}</nav><div class="arc-body" tabindex="-1"></div>`;
    const body = el.querySelector('.arc-body');
    let tab = ctx.storage.get('arcade:tab', 'games');
    let lb = null; // selected leaderboard table id
    if (!TABS.some(([id]) => id === tab)) tab = 'games';

    function paintCovers() {
      body.querySelectorAll('canvas[data-cover]').forEach((cv) => {
        const info = getGameInfo(cv.dataset.cover);
        if (!info) return;
        const g = cv.getContext('2d');
        g.clearRect(0, 0, cv.width, cv.height);
        g.drawImage(coverOf(info.id), 0, 0, cv.width, cv.height);
      });
    }

    function render(keepScroll = true) {
      const top = keepScroll ? body.scrollTop : 0;
      body.innerHTML = tab === 'games' ? gamesHTML() : tab === 'board' ? renderLeaderboard(lb) : renderAchievements();
      body.dataset.view = tab;
      el.querySelectorAll('.arc-tab').forEach((b) => {
        const on = b.dataset.tab === tab;
        b.classList.toggle('on', on);
        b.setAttribute('aria-selected', String(on));
      });
      paintCovers();
      body.scrollTop = top;
    }

    function setTab(next) {
      if (next === tab) return;
      tab = next;
      ctx.storage.set('arcade:tab', tab);
      render(false);
    }

    el.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab]');
      if (t) { ctx.sound.click(); setTab(t.dataset.tab); return; }
      const lbRow = e.target.closest('[data-lb]');
      if (lbRow) { ctx.sound.click(); lb = lbRow.dataset.lb; render(); return; }
      const play = e.target.closest('[data-play]');
      if (play) { ctx.sound.click(); ctx.open(play.dataset.play); }
    });
    el.addEventListener('keydown', (e) => {
      const card = e.target.closest && e.target.closest('.arc-card');
      if (card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); ctx.sound.click(); ctx.open(card.dataset.play); }
    });
    // card tilt follows the pointer (offsetX/Y: the screen is a CSS3D plane, client coordinates are distorted)
    el.addEventListener('pointermove', (e) => {
      const card = e.target.closest && e.target.closest('.arc-card');
      if (!card || e.target !== card || ctx.isCompact()) return;
      const x = e.offsetX / card.clientWidth - 0.5, y = e.offsetY / card.clientHeight - 0.5;
      card.style.setProperty('--ry', `${(x * 9).toFixed(2)}deg`);
      card.style.setProperty('--rx', `${(-y * 9).toFixed(2)}deg`);
      card.style.setProperty('--gx', `${((x + 0.5) * 100).toFixed(1)}%`);
      card.style.setProperty('--gy', `${((y + 0.5) * 100).toFixed(1)}%`);
    });
    el.addEventListener('pointerout', (e) => {
      const card = e.target.closest && e.target.closest('.arc-card');
      if (card && !card.contains(e.relatedTarget)) { card.style.removeProperty('--rx'); card.style.removeProperty('--ry'); }
    });

    const offs = [bus.on('game:score', () => render()), bus.on('achievement:unlock', () => render()), bus.on('achievement:reset', () => render())];
    render(false);
    return {
      onOpen: () => render(),
      destroy: () => offs.forEach((off) => off()),
    };
  },
});
