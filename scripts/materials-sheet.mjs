// Dev tool (T60): renders every procedural material (albedo | normal | roughness) into one PNG sheet, with no browser.
//   node scripts/materials-sheet.mjs [--size=192] [--only=stucco,paving]
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { generateMaterial, MATERIAL_NAMES } from '../src/game3d/favors/matgen.js';

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const S = +(args.size || 192);
const gen = +(args.gen || 256);
const names = args.only ? String(args.only).split(',') : MATERIAL_NAMES;

const crcTable = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = (buf) => { let c = -1; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const cols = 3;
const W = cols * S + 4 * (cols + 1);
const H = names.length * S + 4 * (names.length + 1);
const sheet = new Uint8ClampedArray(W * H * 4).fill(40);
names.forEach((name, row) => {
  const t0 = Date.now();
  const m = generateMaterial(name, gen, 1);
  const ms = Date.now() - t0;
  [m.albedo, m.normal, m.rough].forEach((src, c) => {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const sx = Math.floor((x / S) * gen); const sy = Math.floor((y / S) * gen);
      const si = (sy * gen + sx) * 4;
      const di = ((4 + row * (S + 4) + y) * W + 4 + c * (S + 4) + x) * 4;
      if (c === 2) { sheet[di] = sheet[di + 1] = sheet[di + 2] = src[si + 1]; } else { sheet[di] = src[si]; sheet[di + 1] = src[si + 1]; sheet[di + 2] = src[si + 2]; }
      sheet[di + 3] = 255;
    }
  });
  console.log(name.padEnd(10), `${ms} ms @${gen}`);
});
mkdirSync('shots', { recursive: true });
writeFileSync('shots/T60-materials.png', png(W, H, sheet));
console.log('shots/T60-materials.png');
