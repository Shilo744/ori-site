// "Ori, Can You...?" — the journal (Tab): no phone, no messages. One card with how much the neighbourhood loves Ori, his boxer level and moves, the ladder of
// fighters, the goals and the little stats. Opening it stops the walking (the day itself goes on); Tab or Esc closes it.
import './fight.css';
import { MAX_LEVEL } from './boxer.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function createJournal({ root }) {
  const el = document.createElement('div');
  el.className = 'fi-overlay jr';
  el.hidden = true;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Journal');
  root.append(el);
  let getData = null;
  let isOpen = false;
  let timer = 0;

  function render() {
    const d = getData();
    const lovePct = Math.round(d.love);
    const hearts = Math.floor(d.love / 20);
    const xpPct = d.boxer.level >= MAX_LEVEL ? 100 : Math.round((d.boxer.xp / d.boxer.need) * 100);
    const moves = d.moves.map((m) => `<li class="${m.open ? 'on' : ''}"><b>${esc(m.name)}</b><small>${m.open ? esc(m.how) : `Level ${m.lv}`}</small></li>`).join('');
    const ladder = d.ladder.map((r) => `<li class="${r.beaten ? 'beaten' : r.open ? 'open' : 'locked'}"><i class="fi-av" style="--c:${r.color}">${esc(r.initial)}</i><div><b>${esc(r.name)}</b><small>${esc(r.title)}</small></div><em>${r.beaten ? 'Beaten' : r.open ? 'Ready' : esc(r.why)}</em></li>`).join('');
    const goals = d.goals.filter((g) => g.shown).map((g) => `<li class="${g.done ? 'done' : g.current ? 'now' : ''}"><i></i><div><b>${esc(g.title)}</b><small>${g.done ? 'Done!' : g.current ? `${esc(g.hint)} · ${g.have}/${g.need}` : ''}</small></div></li>`).join('');
    el.innerHTML = `<div class="fi-card fv-glass jr-card"><header><div class="g3d-kicker">JOURNAL · DAY ${d.day} · ${esc(d.clock)}</div><h2>Ori</h2></header>
      <section class="jr-love"><div class="jr-row"><b>Love of the neighbourhood</b><span>${lovePct} / 100</span></div><div class="jr-bar love"><i style="width:${lovePct}%"></i></div><div class="jr-hearts">${Array.from({ length: 5 }, (_, i) => `<i class="${i < hearts ? 'on' : ''}"></i>`).join('')}</div></section>
      <div class="jr-cols">
        <section><h3>Boxer · Lv ${d.boxer.level}</h3><div class="jr-bar xp"><i style="width:${xpPct}%"></i></div><small class="jr-sub">${d.boxer.level >= MAX_LEVEL ? 'Top level!' : `${d.boxer.xp} / ${d.boxer.need} XP to level ${d.boxer.level + 1}`} · ${d.boxer.wins} wins</small><ul class="jr-moves">${moves}</ul></section>
        <section><h3>The ladder</h3><ul class="jr-ladder">${ladder}</ul></section>
      </div>
      <section><h3>Goals</h3><ul class="jr-goals">${goals}</ul></section>
      <footer><small>${d.peaches} peaches · ${d.golden} of 12 golden peaches</small><button type="button" class="fi-btn" data-close="1">Close <kbd>Tab</kbd></button></footer></div>`;
  }
  el.addEventListener('click', (e) => { if (e.target.closest('[data-close]') || e.target === el) api.close(); });
  const api = {
    get isOpen() { return isOpen; },
    open(fn) { getData = fn; isOpen = true; el.hidden = false; render(); clearInterval(timer); timer = setInterval(() => { if (isOpen) render(); }, 1000); },
    close() { isOpen = false; el.hidden = true; el.innerHTML = ''; clearInterval(timer); },
    toggle(fn) { if (isOpen) api.close(); else api.open(fn); },
    key(e) {
      if (!isOpen) return false;
      if (e.code === 'Tab' || e.code === 'Escape' || e.code === 'KeyJ') { api.close(); return true; }
      return true;
    },
    dispose() { clearInterval(timer); el.remove(); },
  };
  return api;
}
