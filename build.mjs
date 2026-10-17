// Production build → ./dist  (plain <script>, so it even works from file://)
import * as esbuild from 'esbuild';
import { workerSourcePlugin } from './scripts/esbuild-worker-plugin.mjs';
import { cpSync, mkdirSync, rmSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });

await esbuild.build({
  entryPoints: ['src/main.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2020',
  outfile: 'dist/app.js',
  legalComments: 'none',
  plugins: [workerSourcePlugin({ minify: true })],
});

cpSync('public/index.html', 'dist/index.html');
console.log('Built → dist/  (open dist/index.html or upload the folder to any static host)');
