// Dev server: bundles src/ with esbuild and serves /public with live reload.
import * as esbuild from 'esbuild';

const ctx = await esbuild.context({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  outfile: 'public/app.js',
  sourcemap: true,
  logLevel: 'info',
  loader: { '.woff2': 'file' },
});

await ctx.watch();
const { port } = await ctx.serve({ servedir: 'public', port: 5191, host: '127.0.0.1' });
console.log(`\n  Ori Asher portfolio → http://localhost:${port}\n`);
