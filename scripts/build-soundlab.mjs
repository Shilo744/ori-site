// Builds the sound lab (npm run soundlab): public/soundlab.js from scripts/lib/soundlab-entry.js. The dev server (npm run dev, http://localhost:5191) serves public/, so the lab is
// at http://localhost:5191/soundlab.html as soon as this has run. It plays every sound of the ring and the fight music with the very code the game uses. Run it again after
// changing fight-sfx.js, fight-music.js or sound-list.js (or `node scripts/build-soundlab.mjs --watch`).
import * as esbuild from 'esbuild';

const options = { entryPoints: ['scripts/lib/soundlab-entry.js'], bundle: true, format: 'iife', target: 'es2020', outfile: 'public/soundlab.js', logLevel: 'info' };
if (process.argv.includes('--watch')) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('\n  watching - the sound lab is at http://localhost:5191/soundlab.html\n');
} else {
  await esbuild.build(options);
  console.log('\n  the sound lab is at http://localhost:5191/soundlab.html  (start the dev server with: npm run dev)\n');
}
