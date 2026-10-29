// "Ori, Can You...?" — the journal (Tab): no phone, no messages. One card with how much the neighbourhood loves Ori, his boxer level and moves, the ladder of
// fighters, the goals and the little stats. Opening it stops the walking (the day itself goes on); Tab or Esc closes it.
import './fight.css';
import './journal.css';
import { MAX_LEVEL } from './boxer.js';
import { modalFocus } from './a11y.js';

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
  let sig = null; // what was drawn last (without the clock): nothing is drawn again when nothing changed, so a reader's place is not lost
  let page = 'life'; // 'life' | 'wishes' | 'trophies' (the daily wishes and the achievements pages [experimental])
  const PAGES = ['life', 'wishes', 'trophies'];
  const focus = modalFocus(el, null, true);

  function render() {
    const d = getData();
    const now = `${page}|${JSON.stringify(d, (k, v) => (k === 'clock' ? undefined : v))}`;
    if (now === sig) { const c = el.querySelector('[data-clock]'); if (c) c.textContent = d.clock; return; }
    sig = now;
    const lovePct = Math.round(d.love);
    const hearts = Math.floor(d.love / 20);
    const xpPct = d.boxer.level >= MAX_LEVEL ? 100 : Math.round((d.boxer.xp / d.boxer.need) * 100);
    const moves = d.moves.map((m) => `<li class="${m.open ? 'on' : ''}"><b>${esc(m.name)}</b><small>${m.open ? esc(m.how) : `Level ${m.lv}`}</small></li>`).join('');
    const ladder = d.ladder.map((r) => `<li class="${r.beaten ? 'beaten' : r.open ? 'open' : 'locked'}"><i class="fi-av" style="--c:${r.color}">${esc(r.initial)}</i><div><b>${esc(r.name)}</b><small>${esc(r.title)}</small></div><em>${r.beaten ? 'Beaten' : r.open ? 'Ready' : esc(r.why)}</em></li>`).join('');
    const goals = d.goals.filter((g) => g.shown).map((g) => `<li class="${g.done ? 'done' : g.current ? 'now' : ''}"><i></i><div><b>${esc(g.title)}</b><small>${g.done ? 'Done!' : g.current ? `${esc(g.hint)} · ${g.have}/${g.need}` : ''}</small></div></li>`).join('');
    const career = (d.career || []).map((s) => `<li><b>${esc(s.value)}</b><small>${esc(s.label)}</small></li>`).join('');
    const list = d.trophies || [];
    const got = list.filter((t) => t.done).length;
    const wi = d.wishes || { rows: [], log: [] };
    const wrows = wi.rows || [];
    const wdone = wrows.filter((r) => r.done).length;
    const tabs = `<nav class="jr-tabs" role="tablist" aria-label="Journal pages"><button type="button" role="tab" id="jr-tab-life" aria-selected="${page === 'life'}" aria-controls="jr-panel" data-page="life">Life</button><button type="button" role="tab" id="jr-tab-wishes" aria-selected="${page === 'wishes'}" aria-controls="jr-panel" data-page="wishes">Wishes <b>${wdone} / ${wrows.length}</b></button><button type="button" role="tab" id="jr-tab-trophies" aria-selected="${page === 'trophies'}" aria-controls="jr-panel" data-page="trophies">Achievements <b>${got} / ${list.length}</b></button></nav>`;
    const sb = d.stamps || { list: [], count: 0, total: 0 };
    const stampBook = `<div class="sb-head"><b>Stamp book</b><span>${sb.count} / ${sb.total}</span></div><ul class="sb-grid" aria-label="Stamp book">${sb.list.map((s) => `<li class="sb${s.got ? ' on' : ''}" style="--c:${s.tone}"><i aria-hidden="true">${s.got ? esc(s.sign.split(' ')[0]) : '?'}</i><small>${esc(s.name)}${s.got ? '' : ' (not yet)'}</small></li>`).join('')}</ul>`;
    const gf = d.gifts || { list: [], count: 0, total: 0 };
    const giftBook = `<div class="sb-head"><b>Gifts from the neighbours</b><span>${gf.count} / ${gf.total}</span></div><ul class="sb-grid gf-grid" aria-label="Gifts from the neighbours">${gf.list.map((x) => `<li class="sb gf${x.got ? ' on' : ''}"${x.got ? ` title="${esc(x.line)}"` : ''}><i aria-hidden="true">${x.got ? esc(x.who.slice(0, 1)) : '?'}</i><small>${x.got ? esc(x.name) : `${esc(x.who)} ${x.have} / ${x.at}`}</small></li>`).join('')}</ul>`;
    const trophies = `<section class="jr-trophies" id="jr-panel" role="tabpanel" aria-labelledby="jr-tab-trophies">${stampBook}${giftBook}<div class="jr-row"><b>Achievements</b><span>${got} / ${list.length}</span></div><div class="jr-bar xp"><i style="width:${list.length ? Math.round((got / list.length) * 100) : 0}%"></i></div><ul class="tr-grid">${list.map((t) => `<li class="tr${t.done ? ' on' : ''}"><i class="tr-ic" data-shape="${t.shape}" style="--c:${t.done ? t.color : '#ffffff30'}"></i><div><b>${esc(t.name)}</b><small>${esc(t.done ? t.line : t.how)}</small>${!t.done && t.need > 1 ? `<span class="tr-bar"><i style="width:${Math.round((t.have / t.need) * 100)}%"></i></span>` : ''}${!t.done && t.need > 1 ? `<em class="tr-n">${Math.floor(t.have)} / ${t.need}</em>` : ''}</div></li>`).join('')}</ul></section>`;
    const logDays = (wi.log || []).slice(-13);
    const dots = (k) => `<span>${[0, 1, 2].map((i) => `<i class="${i < k ? 'on' : ''}"></i>`).join('')}</span>`;
    const dayCells = logDays.map((k, i) => `<span class="wi-day">${dots(k)}Day ${d.day - logDays.length + i}</span>`).join('') + `<span class="wi-day now">${dots(wdone)}Today</span>`;
    const wishes = `<section class="jr-wishes" id="jr-panel" role="tabpanel" aria-labelledby="jr-tab-wishes"><div class="jr-row"><b>Today's wishes</b><span>${wdone} / ${wrows.length}</span></div><ul class="wi-list">${wrows.map((r) => `<li class="wi t${r.tier}${r.done ? ' on' : r.late ? ' late' : ''}"><i class="wi-st" aria-hidden="true"></i><div><b>${esc(r.text)}</b><small>${r.done ? 'Done!' : r.late ? 'Not today. Maybe tomorrow!' : `${r.have} / ${r.n}`} · +${r.reward} peaches</small>${r.done || r.late ? '' : `<span class="tr-bar"><i style="width:${r.pct}%"></i></span>`}</div></li>`).join('')}</ul><p class="jr-sub">All three: +${wi.bonus || 30} peaches and a little love on top.</p><h3>Stickers</h3><div class="wi-days" role="img" aria-label="Wishes done on the days so far: ${[...logDays, wdone].join(', ')}">${dayCells}</div><small class="jr-sub">${wi.total || 0} wish${(wi.total || 0) === 1 ? '' : 'es'} done in all · ${wi.fullDays || 0} full day${(wi.fullDays || 0) === 1 ? '' : 's'}</small></section>`;
    const lifeBody = `<section class="jr-love"><div class="jr-row"><b>Love of the neighbourhood</b><span>${lovePct} / 100</span></div><div class="jr-bar love"><i style="width:${lovePct}%"></i></div><div class="jr-hearts">${Array.from({ length: 5 }, (_, i) => `<i class="${i < hearts ? 'on' : ''}"></i>`).join('')}</div></section>
      <div class="jr-cols">
        <section><h3>Boxer · Lv ${d.boxer.level}</h3><div class="jr-bar xp"><i style="width:${xpPct}%"></i></div><small class="jr-sub">${d.boxer.level >= MAX_LEVEL ? 'Top level!' : `${d.boxer.xp} / ${d.boxer.need} XP to level ${d.boxer.level + 1}`} · ${d.boxer.wins} wins</small>${d.driver && d.driver.xp > 0 ? `<small class="jr-sub">Driver level ${d.driver.level} · ${d.driver.xp} XP</small>` : ''}${d.fed ? `<small class="jr-sub fi-fed">${esc(d.fed)}</small>` : ''}<ul class="jr-moves">${moves}</ul></section>
        <section><h3>The ladder</h3><ul class="jr-ladder">${ladder}</ul></section>
      </div>
      <section><h3>Goals</h3><ul class="jr-goals">${goals}</ul></section>
      <section><h3>Career</h3><ul class="jr-career">${career}</ul></section>
      `;
    el.innerHTML = `<div class="fi-card fv-glass jr-card"><header><div class="g3d-kicker">JOURNAL · DAY ${d.day} · <span data-clock>${esc(d.clock)}</span></div><h2>Ori</h2>${tabs}</header>${page === 'trophies' ? trophies : page === 'wishes' ? wishes : `<div id="jr-panel" role="tabpanel" aria-labelledby="jr-tab-life">${lifeBody}</div>`}
      <footer><small>${d.peaches} peaches · ${d.golden} of 12 golden peaches · <kbd>←</kbd><kbd>→</kbd> pages</small><button type="button" class="fi-btn" data-close="1">Close <kbd>Tab</kbd></button></footer></div>`;
  }
  function setPage(p) { if (p === page) return; page = p; sig = null; render(); }
  el.addEventListener('click', (e) => { const t = e.target.closest('[data-page]'); if (t) { setPage(t.dataset.page); return; } if (e.target.closest('[data-close]') || e.target === el) api.close(); });
  const api = {
    get isOpen() { return isOpen; },
    open(fn) { getData = fn; isOpen = true; el.hidden = false; sig = null; page = 'life'; render(); focus.enter(); clearInterval(timer); timer = setInterval(() => { if (isOpen) render(); }, 1000); },
    close() { focus.leave(); isOpen = false; sig = null; el.hidden = true; el.innerHTML = ''; clearInterval(timer); },
    toggle(fn) { if (isOpen) api.close(); else api.open(fn); },
    key(e) {
      if (!isOpen) return false;
      if (e.code === 'Tab' || e.code === 'Escape' || e.code === 'KeyJ') { api.close(); return true; }
      if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'KeyQ') { setPage(PAGES[Math.max(0, PAGES.indexOf(page) - 1)]); return true; }
      if (e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'KeyE') { setPage(PAGES[Math.min(PAGES.length - 1, PAGES.indexOf(page) + 1)]); return true; }
      return true;
    },
    dispose() { clearInterval(timer); el.remove(); },
  };
  return api;
}
