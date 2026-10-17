// An esbuild plugin: `import src from 'worker-src:./path/to/worker.js'` bundles that file as its own script and gives back its SOURCE TEXT, so a page can start a
// Web Worker from a Blob (this works from file:// too, where `new Worker('x.js')` is blocked). Used by build.mjs and dev.mjs.
import * as esbuild from 'esbuild';
import { resolve } from 'node:path';

export function workerSourcePlugin({ minify = true } = {}) {
  return {
    name: 'worker-src',
    setup(build) {
      build.onResolve({ filter: /^worker-src:/ }, (args) => ({ path: resolve(args.resolveDir, args.path.slice('worker-src:'.length)), namespace: 'worker-src' }));
      build.onLoad({ filter: /.*/, namespace: 'worker-src' }, async (args) => {
        const r = await esbuild.build({ entryPoints: [args.path], bundle: true, minify, format: 'iife', target: 'es2020', write: false, metafile: true, legalComments: 'none', logLevel: 'silent' });
        const watchFiles = Object.keys(r.metafile.inputs).map((f) => resolve(f));
        return { contents: `export default ${JSON.stringify(r.outputFiles[0].text)};`, loader: 'js', watchFiles };
      });
    },
  };
}
