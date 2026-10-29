// "Ori, Can You...?" — the balance lab (pure sim, a few seconds): the win rate, the length of the fights and the knock-downs for every opponent at several levels,
// for a careful bot and a masher. Writes .night/balance.md and lists the odd spots (a later opponent that is easier, an opponent that gets harder as you level up).
//   node scripts/balance-lab.mjs [--runs=24] [--levels=1,3,5,8,10] [--out=.night/balance.md]
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runGrid, violations, toMarkdown } from './lib/balance.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const opt = (n, d) => { const a = process.argv.slice(2).find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const runs = Math.max(2, Number(opt('runs', 24)) || 24);
const levels = String(opt('levels', '1,3,5,8,10')).split(',').map(Number).filter((n) => n >= 1 && n <= 10);
const out = join(root, opt('out', '.night/balance.md'));

const t0 = Date.now();
const grid = runGrid({ runs, levels });
const viol = violations(grid);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, toMarkdown(grid, viol));
console.log(toMarkdown(grid, viol));
console.log(`written to ${out} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
