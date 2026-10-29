// Measuring sound in Node (no dependencies): an FFT, the numbers a sound is judged by (peak, DC offset, length, A-weighted loudness, spectral centroid, share of the energy in a
// band), a WAV writer, and a spectrogram drawn into a PNG (log frequency axis 30 Hz - 16 kHz, a waveform strip on top) that a person - or Claude - can LOOK at.
// Used by scripts/sound-render.mjs (the real sounds, rendered offline in the browser) and checked on synthetic signals by scripts/test-favors-sound.mjs.
import zlib from 'node:zlib';

/** In-place radix-2 FFT of (re, im); n must be a power of two. */
export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len; const wr = Math.cos(ang); const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1; let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k; const b = i + k + len / 2;
        const xr = re[b] * cr - im[b] * ci; const xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}
const pow2 = (n) => { let p = 1; while (p < n) p <<= 1; return p; };

/** A-weighting (the ear's sensitivity), as a linear amplitude factor. */
export function aWeight(f) {
  const f2 = f * f;
  const ra = (12194 ** 2 * f2 * f2) / ((f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2));
  return ra * 1.2589; // (+2 dB: 0 dB at 1 kHz)
}

const db = (x) => 20 * Math.log10(Math.max(x, 1e-9));

/** Mono mix of channels. */
export const mono = (ch) => (ch.length === 1 ? ch[0] : ch[0].map((v, i) => (v + ch[1][i]) / 2));

/** The power spectrum of the whole sample (zero padded): { freqs, power } for bins 0..n/2. */
export function powerSpectrum(x, rate) {
  const n = pow2(x.length);
  const re = new Float64Array(n); const im = new Float64Array(n);
  for (let i = 0; i < x.length; i++) re[i] = x[i];
  fft(re, im);
  const half = n / 2;
  const power = new Float64Array(half + 1);
  const M = Math.max(1, x.length);
  for (let k = 0; k <= half; k++) power[k] = ((re[k] * re[k] + im[k] * im[k]) * 2) / (n * M); // (so that the bins add up to the mean square of the signal)
  return { power, df: rate / n, n };
}

/** The share (0..1) of the energy that lies between lo and hi Hz. */
export function bandShare(x, rate, lo, hi) {
  const { power, df } = powerSpectrum(x, rate);
  let tot = 0; let band = 0;
  for (let k = 1; k < power.length; k++) { const f = k * df; tot += power[k]; if (f >= lo && f < hi) band += power[k]; }
  return tot > 0 ? band / tot : 0;
}

export function centroid(x, rate) {
  const { power, df } = powerSpectrum(x, rate);
  let num = 0; let den = 0;
  for (let k = 1; k < power.length; k++) { num += k * df * power[k]; den += power[k]; }
  return den > 0 ? num / den : 0;
}

/** RMS in dBFS of a window of the signal after the A-weighting. */
export function loudnessA(x, rate, from = 0, to = x.length) {
  const seg = x.subarray ? x.subarray(from, to) : x.slice(from, to);
  const { power, df } = powerSpectrum(seg, rate);
  let e = 0;
  for (let k = 1; k < power.length; k++) { const w = aWeight(k * df); e += power[k] * w * w; }
  return 10 * Math.log10(Math.max(e, 1e-18)); // (mean square, A-weighted: a full-scale sine at 1 kHz reads -3 dB)
}

/** The loudest 200 ms of the signal (the ear adds up what comes within about 200 ms), A-weighted, in dBFS: what "how loud does it feel" is measured by. */
export function loudestA(x, rate, win = 0.2, hop = 0.05) {
  const w = Math.round(win * rate); const h = Math.round(hop * rate);
  if (x.length <= w) return loudnessA(x, rate);
  let best = -200;
  for (let i = 0; i + w <= x.length; i += h) { const l = loudnessA(x, rate, i, i + w); if (l > best) best = l; }
  return best;
}

/** The numbers a sound is judged by. `x` = mono Float32Array. */
export function measure(x, rate) {
  let peak = 0; let sum = 0;
  for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > peak) peak = a; sum += x[i]; }
  const dc = sum / x.length;
  // the envelope: RMS over 10 ms
  const w = Math.max(1, Math.round(rate * 0.01));
  const env = [];
  for (let i = 0; i + w <= x.length; i += w) { let s = 0; for (let j = 0; j < w; j++) s += x[i + j] * x[i + j]; env.push(Math.sqrt(s / w)); }
  const emax = Math.max(...env, 1e-9);
  const lastAbove = (rel) => { const th = emax * 10 ** (rel / 20); let last = 0; env.forEach((e, i) => { if (e >= th) last = i; }); return (last + 1) * w / rate; };
  const peakAt = env.indexOf(emax) * w / rate;
  const tail50 = lastAbove(-50); const tail30 = lastAbove(-30);
  let first = 0; { const th = emax * 10 ** (-30 / 20); while (first < env.length - 1 && env[first] < th) first++; }
  const act = Math.max(1, Math.round(tail30 * rate));
  return {
    peak, peakDb: db(peak), dc, tail50, tail30, peakAt, startAt: first * w / rate,
    rmsDb: db(Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length)),
    loudA: loudestA(x, rate), loudActive: loudnessA(x, rate, 0, Math.min(x.length, act)),
    centroid: centroid(x.subarray ? x.subarray(0, Math.min(x.length, act)) : x.slice(0, act), rate),
  };
}

// ── files ──

/** 16-bit PCM WAV of 1 or 2 channels (Float32Array each). */
export function toWav(channels, rate) {
  const n = channels[0].length; const nc = channels.length;
  const buf = Buffer.alloc(44 + n * nc * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * nc * 2, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(nc, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * nc * 2, 28); buf.writeUInt16LE(nc * 2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * nc * 2, 40);
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < nc; c++) { buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, channels[c][i])) * 32767), o); o += 2; }
  return buf;
}

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** A PNG from RGBA bytes. */
export function toPng(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const PALETTE = [[0, 0, 4], [20, 11, 52], [58, 15, 110], [100, 25, 128], [140, 41, 129], [183, 55, 121], [222, 73, 104], [247, 112, 92], [254, 159, 109], [254, 205, 145], [252, 253, 191]];
const colour = (t) => { const x = Math.max(0, Math.min(1, t)) * (PALETTE.length - 1); const i = Math.min(PALETTE.length - 2, Math.floor(x)); const f = x - i; return PALETTE[i].map((c, k) => Math.round(c + (PALETTE[i + 1][k] - c) * f)); };

/**
 * A spectrogram + waveform picture of a mono signal: { w, h, rgba }. Time runs right (`px` pixels per second, or fitted to maxW), frequency up on a LOG axis from
 * 30 Hz to 16 kHz (the faint lines are 100 Hz, 1 kHz and 10 kHz), the waveform strip is on top; white ticks along the bottom every 100 ms (long every 500 ms).
 */
export function spectrogram(x, rate, { win = 2048, hop = 256, maxW = 1500, pxPerSec = 520, specH = 240, waveH = 48, seconds = null } = {}) {
  if (seconds) x = x.subarray(0, Math.min(x.length, Math.round(seconds * rate)));
  const frames = Math.max(1, Math.floor((x.length - win) / hop) + 1);
  const hopSec = hop / rate;
  const dur = x.length / rate;
  const pps = Math.min(pxPerSec, maxW / Math.max(0.05, dur));
  const W = Math.max(40, Math.min(maxW, Math.round(dur * pps)));
  const H = waveH + specH + 10;
  const rgba = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) { rgba[i * 4 + 3] = 255; rgba[i * 4] = 8; rgba[i * 4 + 1] = 8; rgba[i * 4 + 2] = 12; }
  const hann = new Float64Array(win); for (let i = 0; i < win; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (win - 1));
  const re = new Float64Array(win); const im = new Float64Array(win);
  const fLo = 30; const fHi = 16000; const nb = win / 2;
  // the dB of every frame at every row (row 0 = high frequencies)
  const rowBin = []; for (let r = 0; r < specH; r++) { const fq = fLo * (fHi / fLo) ** (1 - r / (specH - 1)); const kk = Math.min(nb - 2, (fq / (rate / 2)) * nb); rowBin.push([Math.floor(kk), kk - Math.floor(kk)]); }
  const dbs = new Float32Array(frames * specH);
  let maxDb = -200;
  for (let f = 0; f < frames; f++) {
    re.fill(0); im.fill(0);
    for (let i = 0; i < win; i++) re[i] = (x[f * hop + i] || 0) * hann[i];
    fft(re, im);
    for (let r = 0; r < specH; r++) {
      const [k0, fr] = rowBin[r];
      const m = Math.hypot(re[k0], im[k0]) * (1 - fr) + Math.hypot(re[k0 + 1], im[k0 + 1]) * fr;
      const d = db((m * 4) / win); // (a full-scale sine reads 0 dB)
      dbs[f * specH + r] = d;
      if (d > maxDb) maxDb = d;
    }
  }
  const top = Math.max(-30, maxDb); const floor = top - 70;
  for (let c = 0; c < W; c++) {
    const f = Math.min(frames - 1, Math.max(0, Math.round((c / pps - (win / 2) / rate) / hopSec)));
    for (let r = 0; r < specH; r++) {
      const [cr, cg, cb] = colour((dbs[f * specH + r] - floor) / (top - floor));
      const o = ((waveH + 10 + r) * W + c) * 4; rgba[o] = cr; rgba[o + 1] = cg; rgba[o + 2] = cb;
    }
  }
  // the waveform strip (min / max per column)
  const perCol = Math.max(1, Math.floor(x.length / W));
  for (let c = 0; c < W; c++) {
    let mn = 0; let mx = 0;
    for (let i = c * perCol; i < Math.min(x.length, (c + 1) * perCol); i++) { if (x[i] < mn) mn = x[i]; if (x[i] > mx) mx = x[i]; }
    const y0 = Math.round(waveH / 2 - Math.min(1, mx) * (waveH / 2 - 1)); const y1 = Math.round(waveH / 2 - Math.max(-1, mn) * (waveH / 2 - 1));
    for (let y = y0; y <= y1; y++) { const o = (y * W + c) * 4; rgba[o] = 120; rgba[o + 1] = 220; rgba[o + 2] = 160; }
  }
  const line = (y, a) => { for (let c = 0; c < W; c += 2) { const o = ((waveH + 10 + y) * W + c) * 4; rgba[o] = Math.min(255, rgba[o] + a); rgba[o + 1] = Math.min(255, rgba[o + 1] + a); rgba[o + 2] = Math.min(255, rgba[o + 2] + a); } };
  for (const fq of [100, 1000, 10000]) line(Math.round((1 - Math.log(fq / fLo) / Math.log(fHi / fLo)) * (specH - 1)), 70);
  // time ticks
  for (let t = 0; t <= dur; t += 0.1) { const c = Math.min(W - 1, Math.round(t * pps)); const long = Math.abs(t * 2 - Math.round(t * 2)) < 1e-6; for (let y = H - (long ? 8 : 4); y < H; y++) { const o = (y * W + c) * 4; rgba[o] = 255; rgba[o + 1] = 255; rgba[o + 2] = 255; } }
  return { w: W, h: H, rgba, pps };
}

/** Several pictures one above the other, left aligned, with a thin grey line between. */
export function stack(pics, gap = 3) {
  const W = Math.max(...pics.map((p) => p.w));
  const H = pics.reduce((s, p) => s + p.h + gap, 0);
  const rgba = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) { rgba[i * 4] = 40; rgba[i * 4 + 1] = 40; rgba[i * 4 + 2] = 48; rgba[i * 4 + 3] = 255; }
  let y0 = 0;
  for (const p of pics) { for (let y = 0; y < p.h; y++) rgba.set(p.rgba.subarray(y * p.w * 4, (y + 1) * p.w * 4), ((y0 + y) * W) * 4); y0 += p.h + gap; }
  return { w: W, h: H, rgba };
}
