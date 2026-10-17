// A tiny software rasteriser for the sculpted heads (dev tool — no browser, no GPU): `node scripts/mesh-preview.mjs head [out.png] [--yaw=0.4] [--pitch=0.1] [--cell=0.005]`
// draws the head mesh with a z-buffer, vertex colours and a soft key + fill light, so the face can be tuned while nothing else is running.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname } from 'node:path';

function crc32(buf) {
  let c; let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return (crc ^ 0xffffffff) >>> 0;
}
export function encodePNG(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1); }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const toSRGB = (v) => Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055));

/** meshes: [{ positions, normals, colors?, indices, color? }] ; view: { yaw, pitch, cx, cy, cz, scale } */
export function renderMeshes(meshes, { size = 640, yaw = 0, pitch = 0, center = [0, 0, 0], scale = 3.2, bg = [0.78, 0.84, 0.9] } = {}) {
  const W = size; const H = size;
  const depth = new Float32Array(W * H).fill(-1e9);
  const out = new Float32Array(W * H * 3);
  for (let i = 0; i < W * H; i++) { const t = i / (W * H); out[i * 3] = bg[0] * (1 - t * 0.15); out[i * 3 + 1] = bg[1] * (1 - t * 0.15); out[i * 3 + 2] = bg[2] * (1 - t * 0.12); }
  const cy = Math.cos(yaw); const sy = Math.sin(yaw); const cp = Math.cos(pitch); const sp = Math.sin(pitch);
  // camera space: rotate about y (yaw) then about x (pitch); the camera looks down -z, so larger z = nearer
  const rot = (x, y, z) => { const x1 = x * cy + z * sy; const z1 = -x * sy + z * cy; const y2 = y * cp - z1 * sp; const z2 = y * sp + z1 * cp; return [x1, y2, z2]; };
  const key = (() => { const l = [0.5, 0.7, 0.55]; const n = Math.hypot(...l); return l.map((v) => v / n); })();
  const fill = (() => { const l = [-0.6, 0.1, 0.5]; const n = Math.hypot(...l); return l.map((v) => v / n); })();
  const px = (x) => (x - center[0]) * scale * W * 0.5 + W / 2;
  for (const m of meshes) {
    const P = m.positions; const N = m.normals; const C = m.colors; const T = m.indices; const n = P.length / 3;
    const sx = new Float32Array(n); const sy2 = new Float32Array(n); const sz = new Float32Array(n); const sn = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const [x, y, z] = rot(P[i * 3] - center[0], P[i * 3 + 1] - center[1], P[i * 3 + 2] - center[2]);
      sx[i] = x * scale * W * 0.5 + W / 2; sy2[i] = H / 2 - y * scale * H * 0.5; sz[i] = z;
      const [nx, ny, nz] = rot(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]); sn[i * 3] = nx; sn[i * 3 + 1] = ny; sn[i * 3 + 2] = nz;
    }
    void px;
    for (let t = 0; t < T.length; t += 3) {
      const a = T[t]; const b = T[t + 1]; const c = T[t + 2];
      const x0 = sx[a]; const y0 = sy2[a]; const x1 = sx[b]; const y1 = sy2[b]; const x2 = sx[c]; const y2 = sy2[c];
      const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
      if (Math.abs(area) < 1e-9) continue;
      // back-face cull using the camera-space face normal (z of the cross product of the 3D edges)
      const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2))); const maxX = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)));
      const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2))); const maxY = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2)));
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const w0 = ((x1 - (x + 0.5)) * (y2 - (y + 0.5)) - (x2 - (x + 0.5)) * (y1 - (y + 0.5))) / area;
          const w1 = ((x2 - (x + 0.5)) * (y0 - (y + 0.5)) - (x0 - (x + 0.5)) * (y2 - (y + 0.5))) / area;
          const w2 = 1 - w0 - w1;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          const z = w0 * sz[a] + w1 * sz[b] + w2 * sz[c];
          const o = y * W + x;
          if (z <= depth[o]) continue; // keep the nearest (larger z)
          let nx = w0 * sn[a * 3] + w1 * sn[b * 3] + w2 * sn[c * 3];
          let ny = w0 * sn[a * 3 + 1] + w1 * sn[b * 3 + 1] + w2 * sn[c * 3 + 1];
          let nz = w0 * sn[a * 3 + 2] + w1 * sn[b * 3 + 2] + w2 * sn[c * 3 + 2];
          const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
          if (nz < -0.02 && !m.doubleSided) continue; // facing away
          depth[o] = z;
          const kd = Math.max(0, nx * key[0] + ny * key[1] + nz * key[2]);
          const fd = Math.max(0, nx * fill[0] + ny * fill[1] + nz * fill[2]);
          const rim = (1 - Math.max(0, nz)) ** 3 * 0.18;
          const light = 0.34 + kd * 0.78 + fd * 0.22 + rim;
          for (let k = 0; k < 3; k++) {
            const base = C ? w0 * C[a * 3 + k] + w1 * C[b * 3 + k] + w2 * C[c * 3 + k] : (m.color || [0.8, 0.8, 0.8])[k];
            out[o * 3 + k] = Math.min(1, base * light);
          }
        }
      }
    }
  }
  const rgb = new Uint8Array(W * H * 3);
  for (let i = 0; i < W * H * 3; i++) rgb[i] = toSRGB(out[i]);
  return { w: W, h: H, rgb };
}

export function savePNG(path, img) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, encodePNG(img.w, img.h, img.rgb)); }

// ── CLI ──
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('scripts/mesh-preview.mjs')) {
  const args = process.argv.slice(2);
  const opt = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v === undefined ? true : v]; }));
  const pos = args.filter((a) => !a.startsWith('--'));
  const what = pos[0] || 'head';
  const out = pos[1] || `shots/preview-${what}.png`;
  const { buildHead, skinColor } = await import('../src/game3d/favors/people/head.js');
  const face = await import('../src/game3d/favors/people/face.js');
  const { buildHair } = await import('../src/game3d/favors/people/hair.js');
  const { MeshBuilder } = await import('../src/game3d/favors/people/geo.js');
  const meshes = [];
  const views = (opt.views || '0').split(',').map(Number);
  let center = [0, 0, 0]; let scale = 3.4;
  if (what === 'head' || what === 'face') {
    const spec = opt.spec ? JSON.parse(opt.spec) : {};
    const h = buildHead(spec, { cell: Number(opt.cell || 0.0055) });
    meshes.push(h.mesh);
    center = [0, opt.cy !== undefined ? Number(opt.cy) : -0.02, 0]; scale = Number(opt.zoom || 3.0);
    if (what === 'face') {
      const ids = new Proxy({}, { get: () => 0 });
      const A = h.anchors;
      const skin = skinColor(h.face);
      const B = new MeshBuilder(); const L = new MeshBuilder(); const Hr = new MeshBuilder(); const G = new MeshBuilder(); const M = new MeshBuilder(); const Mt = new MeshBuilder();
      face.buildEyes(B, A, h.face, ids);
      face.buildLids(L, A, h.face, ids, skin);
      face.buildBrows(Hr, A, h.face, ids);
      face.buildFacialHair(Hr, A, h.face, ids, {}, '#1a1210', skin);
      face.buildGlasses(G, new MeshBuilder(), A, h.face, ids);
      face.buildHoop(Mt, A, h.face, ids);
      const lut = face.surfaceLUT(A.surface, -0.07, 0.07, -0.19, -0.03);
      const mouths = { neutral: { ...face.MOUTH_REST, smile: 0.15 }, smile: { ...face.MOUTH_REST, smile: 0.7 }, grin: { ...face.MOUTH_REST, smile: 1, open: 0.35, teeth: 1 }, laugh: { ...face.MOUTH_REST, smile: 1, open: 0.8, teeth: 1, tongue: 1 }, oh: { ...face.MOUTH_REST, smile: 0, open: 0.5, round: 0.8, tongue: 0.4 } };
      face.buildMouth(M, A, mouths[opt.mouth || 'smile'], lut, h.face.lipColor, ids);
      for (const b of [B, L, Hr, G, M, Mt]) meshes.push(b.finish());
      if (!opt.nohair) { const hair = buildHair(opt.hair ? { style: opt.hair } : { style: 'curly' }, A, { cell: Number(opt.hcell || 0.0075) }); if (hair) { meshes.push(hair.mesh); if (hair.curls) meshes.push(hair.curls); } }
    }
  }
  if (what === 'person') {
    const { buildPersonData, personStats } = await import('../src/game3d/favors/people/assemble.js');
    const { ORI_SPEC } = await import('../src/game3d/favors/people/specs.js');
    const t0 = performance.now();
    const data = buildPersonData(ORI_SPEC, { quality: Number(opt.q || 1) });
    console.log('built in', Math.round(performance.now() - t0), 'ms', JSON.stringify(personStats(data)));
    const mouths = { smile: { smile: 0.7, w: 1, open: 0, round: 0, asym: 0, teeth: 0, tongue: 0 } };
    for (const [k, m] of Object.entries(data.layers)) { if (k === 'lens') continue; meshes.push(m); }
    const mm = data.mouth(mouths.smile);
    mm.positions = mm.positions.map((v, i) => v + data.headPos[i % 3]);
    meshes.push(mm);
    center = [0, Number(opt.cy ?? 0.88), 0]; scale = Number(opt.zoom || 1.05);
  }
  if (what === 'pose') {
    const { buildPersonData } = await import('../src/game3d/favors/people/assemble.js');
    const { ORI_SPEC } = await import('../src/game3d/favors/people/specs.js');
    const { posedAt } = await import('../src/game3d/favors/people/anim.js');
    const { createFace, target } = await import('../src/game3d/favors/people/expressions.js');
    const { makeSkeleton, skinned } = await import('./lib/pose-skin.mjs');
    const data = buildPersonData(ORI_SPEC, { quality: Number(opt.q || 0.8) });
    const skel = makeSkeleton(data.rig);
    // --poses=walk@0.2,thumbsUp@0.8,... each "name[@time][:expression]" (names: idle, walk, run, sprint, tired, phone, carry or a gesture)
    const list = (opt.poses || 'idle,walk,run').split(',');
    const sheets = [];
    for (const item of list) {
      const [head, exprName] = item.split(':');
      const [nm, at] = head.split('@');
      const inp = nm === 'walk' ? { speed: 1.8 } : nm === 'run' ? { speed: 4.4 } : nm === 'sprint' ? { speed: 4.4, sprinting: true } : nm === 'tired' ? { winded: true } : {};
      const hold = nm === 'phone' || nm === 'carry' ? nm : null;
      const gesture = ['thumbsUp', 'facepalm', 'shrug', 'wave', 'cheer', 'nod', 'point', 'sigh', 'bow'].includes(nm) ? nm : null;
      let phaseT = Number(at ?? 0.9);
      const pose = posedAt(inp, { gesture, at: gesture ? phaseT : 1.5 + (nm === 'walk' || nm === 'run' || nm === 'sprint' ? phaseT * 0.5 : 0), hold });
      const expr = exprName || pose.expression || 'smile';
      const fc = { ...target(expr) };
      const meshesP = skinned(data, skel, pose, fc).filter((m) => m.layer !== 'lens');
      sheets.push(meshesP);
    }
    const imgsP = [];
    for (const meshesP of sheets) for (const yaw of views) imgsP.push(renderMeshes(meshesP, { yaw, pitch: Number(opt.pitch || 0.06), center: [0, Number(opt.cy ?? 0.85), 0], scale: Number(opt.zoom || 1.15), size: Number(opt.size || 520) }));
    const Wt = imgsP[0].w * imgsP.length; const Ht = imgsP[0].h; const rgbP = new Uint8Array(Wt * Ht * 3);
    imgsP.forEach((im, i) => { for (let y = 0; y < Ht; y++) rgbP.set(im.rgb.subarray(y * im.w * 3, (y + 1) * im.w * 3), (y * Wt + i * im.w) * 3); });
    savePNG(out, { w: Wt, h: Ht, rgb: rgbP });
    console.log('wrote', out, Wt + 'x' + Ht);
    process.exit(0);
  }
  const imgs = views.map((yaw) => renderMeshes(meshes, { yaw, pitch: Number(opt.pitch || 0.08), center, scale, size: Number(opt.size || 520) }));
  // contact sheet: the views side by side
  const W = imgs[0].w * imgs.length; const H = imgs[0].h; const rgb = new Uint8Array(W * H * 3);
  imgs.forEach((im, i) => { for (let y = 0; y < H; y++) rgb.set(im.rgb.subarray(y * im.w * 3, (y + 1) * im.w * 3), (y * W + i * im.w) * 3); });
  savePNG(out, { w: W, h: H, rgb });
  console.log('wrote', out, `${W}x${H}`);
}
