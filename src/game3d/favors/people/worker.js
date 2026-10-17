// "Ori, Can You...?" — the people factory, run in a Web Worker: building a sculpted character takes a second or two of pure number crunching, so it
// happens off the main thread (at idle, long before anybody launches the game). Messages in: { id, kind: 'person' | 'crowd', ... } -> out: { id, data } or { id, error }.
import { computePersonData } from './assemble.js';
import { crowdArchetype } from './crowd-figure.js';

function buffers(obj, out = new Set()) {
  for (const v of Object.values(obj || {})) {
    if (ArrayBuffer.isView(v)) out.add(v.buffer);
    else if (v && typeof v === 'object') buffers(v, out);
  }
  return out;
}

self.onmessage = (e) => {
  const { id, kind, spec, quality, style } = e.data;
  try {
    const data = kind === 'crowd' ? crowdArchetype(style) : computePersonData(spec, { quality });
    self.postMessage({ id, data }, [...buffers(data)]);
  } catch (err) {
    self.postMessage({ id, error: String((err && err.stack) || err) });
  }
};
