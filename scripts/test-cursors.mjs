// One pointer everywhere (T57), the static half: ui/cursors.css is the ONLY place that names a cursor shape. No other stylesheet, inline
// style or script may write a system cursor keyword (pointer / default / text / grab / *-resize …); they use var(--cur-…) or leave it alone.
// not-allowed / wait / progress / none are fine. The browser half (computed cursors on real elements) is scripts/lib/cursor-test.mjs.
//   node scripts/test-cursors.mjs
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const walk = (dir, out = []) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};
const rel = (p) => relative(ROOT, p).split(sep).join('/');
const ALLOWED = /^(var\(--cur-[a-z]+\)|not-allowed|wait|progress|none|inherit)$/;

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };

const src = walk(join(ROOT, 'src'));
const css = src.filter((p) => p.endsWith('.css') && !p.endsWith('cursors.css'));
const js = src.filter((p) => p.endsWith('.js'));

test('no stylesheet other than cursors.css names a system cursor', () => {
  const bad = [];
  for (const p of [...css, join(ROOT, 'public', 'index.html')]) {
    const text = readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of text.matchAll(/(?<![-\w])cursor\s*:\s*([^;}"']+)/g)) {
      const v = m[1].replace(/!important/, '').trim();
      if (!ALLOWED.test(v)) bad.push(`${rel(p)}: cursor: ${v}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('scripts only set the shared cursor variables (or clear the cursor)', () => {
  const bad = [];
  for (const p of js) {
    const text = readFileSync(p, 'utf8');
    for (const m of text.matchAll(/\.cursor\s*=\s*([^;\n]+)/g)) {
      const v = m[1].trim();
      if (!/--cur-/.test(v) && !/^''|^""/.test(v) && !/\?\s*'var\(--cur-[a-z]+\)'\s*:\s*''/.test(v)) bad.push(`${rel(p)}: .cursor = ${v}`);
    }
    for (const m of text.matchAll(/setProperty\(\s*['"]cursor['"]\s*,\s*([^)]+)\)/g)) if (!/--cur-/.test(m[1])) bad.push(`${rel(p)}: setProperty('cursor', ${m[1]})`);
    for (const m of text.matchAll(/cursor\s*:\s*(pointer|default|text|grab|grabbing|auto|crosshair|move|[nsew]{1,4}-resize)\b/g)) bad.push(`${rel(p)}: cursor: ${m[1]} in a script string`);
  }
  assert.deepEqual(bad, []);
});

const cssText = readFileSync(join(ROOT, 'src', 'ui', 'cursors.css'), 'utf8');
const jsText = readFileSync(join(ROOT, 'src', 'ui', 'cursors.js'), 'utf8');
const NAMES = ['arrow', 'hand', 'text', 'grab', 'grabbing', 'ew', 'ns', 'nwse', 'nesw'];

test('cursors.js defines the nine shapes and cursors.css has a fallback + a rule for each', () => {
  for (const name of NAMES) {
    assert.ok(new RegExp(`\\b${name}: \\{ body:`).test(jsText), `${name} shape in cursors.js`);
    assert.ok(cssText.includes(`--cur-${name}:`), `--cur-${name} fallback in cursors.css`);
    assert.ok(cssText.includes(`var(--cur-${name})`), `a rule uses --cur-${name}`);
  }
});

test('the page rule: the arrow everywhere, the hand on what can be clicked, the I-beam on text, resize shapes on every handle', () => {
  assert.match(cssText, /\*, \*::before, \*::after \{ cursor: var\(--cur-arrow\); \}/);
  assert.match(cssText, /a\[href\][^{]*button:not\(:disabled\)[^{]*\{ cursor: var\(--cur-hand\); \}/);
  assert.match(cssText, /textarea[^{]*\{ cursor: var\(--cur-text\); \}/);
  for (const [edges, shape] of [[['n', 's'], 'ns'], [['e', 'w'], 'ew'], [['ne', 'sw'], 'nesw'], [['nw', 'se'], 'nwse']]) {
    for (const e of edges) assert.ok(cssText.includes(`[data-rz='${e}']`), `handle ${e}`);
    assert.ok(new RegExp(`\\[data-rz='${edges[0]}'\\][^{]*\\{ cursor: var\\(--cur-${shape}\\) !important; \\}`).test(cssText), `${edges[0]} → ${shape}`);
  }
});

test('while a window is dragged or resized the shape is pinned on <html> (and survives leaving the screen)', () => {
  for (const k of ['grab', 'ns', 'ew', 'nesw', 'nwse']) assert.ok(cssText.includes(`html[data-cl='${k}']`), k);
  const desktop = readFileSync(join(ROOT, 'src', 'ui', 'desktop.js'), 'utf8');
  assert.match(desktop, /document\.documentElement\.dataset\.cl = kind/);
  assert.match(desktop, /delete document\.documentElement\.dataset\.cl/);
});

test('every handle edge the window manager can start has a cursor kind', () => {
  const wm = readFileSync(join(ROOT, 'src', 'ui', 'wm-interact.js'), 'utf8');
  const m = /cursorForEdge = \(edge\) => \(\{([^}]+)\}/.exec(wm);
  assert.ok(m, 'cursorForEdge');
  const kinds = Object.fromEntries([...m[1].matchAll(/(\w+): '(\w+)'/g)].map((x) => [x[1], x[2]]));
  assert.deepEqual(kinds, { n: 'ns', s: 'ns', e: 'ew', w: 'ew', ne: 'nesw', sw: 'nesw', nw: 'nwse', se: 'nwse' });
});

console.log(`${n} cursor tests passed`);
