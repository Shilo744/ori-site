// Arcade tabs rendered as HTML strings: Leaderboard (personal bests + recent runs) and Achievements.
// Only escaped text and trusted SVG constants (achievement icons are defined in code) go into the markup.
import { esc } from './shared.js';
import { listGames } from '../games/catalog.js';
import { scores } from '../games/scores.js';
import { achievements } from '../../core/achievements.js';

export function ago(ts) {
  if (!ts) return '—';
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 172800) return 'yesterday';
  if (s < 86400 * 6) return `${Math.round(s / 86400)}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const fmt = (info, v) => (v == null ? '—' : info.format ? info.format(v) : String(v));

const TROPHY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a2 2 0 0 0 2 4M16 6h3a2 2 0 0 1-2 4M12 13v4M8.5 20h7M10 17h4"/></svg>';
const LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2.4"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

/** Rows of every score table: one per game, plus one per variant (e.g. Snake · Wrap). */
function tables(games) {
  return games.flatMap((g) => [{ info: g, id: g.id, label: '' }, ...g.variants.map((v) => ({ info: g, id: v.id, label: v.label }))]);
}

export function renderLeaderboard(selected) {
  const games = listGames();
  const rows = tables(games).map((t) => ({ ...t, s: scores.get(t.id) }));
  const anyPlays = rows.some((r) => r.s.plays > 0);
  if (!anyPlays) {
    return `<div class="arc-empty">${TROPHY}<h3>No runs on the board yet</h3><p>Play any game and your best scores and recent runs will show up here.</p><button class="gk-btn gk-primary" data-tab="games">Browse games</button></div>`;
  }
  const sel = rows.find((r) => r.id === selected && r.s.plays > 0) || rows.filter((r) => r.s.plays > 0).sort((a, b) => b.s.last - a.s.last)[0];
  const runs = [...sel.s.runs].sort((a, b) => (sel.info.lowerIsBetter ? a.score - b.score : b.score - a.score));
  return `
    <div class="arc-sec"><h2>Personal bests</h2><span>${rows.filter((r) => r.s.plays > 0).length} played</span></div>
    <div class="lb-table">
      ${rows.map((r) => `
        <button type="button" class="lb-row${r.id === sel.id ? ' on' : ''}${r.s.plays ? '' : ' none'}" data-lb="${esc(r.id)}" style="--accent:${esc(r.info.accent)}">
          <canvas class="lb-thumb" data-cover="${esc(r.info.id)}" width="112" height="63"></canvas>
          <span class="lb-name"><b>${esc(r.info.name)}</b><em>${esc(r.label || 'Classic')}</em></span>
          <span class="lb-best"><em>Best</em>${esc(fmt(r.info, r.s.best))}</span>
          <span class="lb-plays"><em>Plays</em>${r.s.plays}</span>
          <span class="lb-last"><em>Last</em>${esc(ago(r.s.last))}</span>
        </button>`).join('')}
    </div>
    <div class="arc-sec"><h2>Recent runs · ${esc(sel.info.name)}${sel.label ? ` (${esc(sel.label)})` : ''}</h2><span>last ${sel.s.runs.length}</span></div>
    <ol class="lb-runs">
      ${runs.map((run, i) => `<li class="${i === 0 ? 'top' : ''}"><i>${i + 1}</i><b>${esc(fmt(sel.info, run.score))}</b><span>${esc(ago(run.at))}</span></li>`).join('')}
    </ol>`;
}

export function renderAchievements() {
  const list = achievements.list();
  const { unlocked, total } = achievements.counts();
  const pct = total ? unlocked / total : 0;
  const R = 22, C = 2 * Math.PI * R;
  return `
    <div class="ach-head">
      <svg viewBox="0 0 56 56" class="ach-ring" aria-hidden="true"><circle cx="28" cy="28" r="${R}" class="bg"/>${pct > 0 ? `<circle cx="28" cy="28" r="${R}" class="fg" stroke-dasharray="${(C * pct).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 28 28)"/>` : ''}</svg>
      <div><b>${unlocked} of ${total} unlocked</b><span>${total ? 'Keep playing to collect them all.' : 'Nothing to unlock yet.'}</span></div>
    </div>
    <div class="ach-grid">
      ${list.map((a) => `
        <div class="ach ${a.unlocked ? 'on' : 'off'}" data-rarity="${esc(a.rarity)}">
          <div class="ach-ic">${a.unlocked ? (a.icon || TROPHY) : LOCK}</div>
          <div class="ach-tx"><b>${esc(a.name)}</b><span>${esc(a.desc)}</span>
            ${a.unlocked ? `<em>Unlocked ${esc(ago(a.at))}</em>` : a.goal > 1 ? `<div class="ach-bar"><i style="width:${Math.round((a.progress / a.goal) * 100)}%"></i></div><em>${a.progress} / ${a.goal}</em>` : '<em>Locked</em>'}
          </div>
          <u>${esc(a.rarity)}</u>
        </div>`).join('')}
    </div>`;
}
