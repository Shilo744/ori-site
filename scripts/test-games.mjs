// Runs every pure-logic game test: scripts/test-<game>.mjs (2048, tetris, minesweeper, wordle…). Chess has its own runner (test:chess).
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const dir = fileURLToPath(new URL('.', import.meta.url));
const files = readdirSync(dir).filter((f) => /^test-.+\.mjs$/.test(f) && !['test-games.mjs', 'test-chess.mjs'].includes(f)).sort();
let failed = 0;
for (const f of files) {
  console.log(`\n▶ ${f}`);
  const r = spawnSync(process.execPath, [join(dir, f)], { stdio: 'inherit' });
  if (r.status !== 0) failed++;
}
console.log(failed ? `\n${failed} test file(s) FAILED` : `\nall ${files.length} game logic test files passed`);
process.exit(failed ? 1 : 0);
