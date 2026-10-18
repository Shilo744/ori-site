// Dev probe (T60): triangles per kind that the camera / the sun's shadow camera really see.   node scripts/_probe.mjs [--at=home] [--hour=13]
import { serveDist, launchBrowser, newSession, loadSite, sleep } from './lib/harness.mjs';
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const server = await serveDist();
const { browser } = await launchBrowser();
try {
  const s = await newSession(browser, server.origin, { width: 1600, height: 900 });
  await loadSite(s, server.origin);
  const { page } = s;
  await page.evaluate(() => window.__ori.game3d.launch('favors', { quick: true }));
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 90000 });
  await page.evaluate(([at, hour]) => { const g = window.__ori.game3d; g.setHour(hour); g.teleport(at); }, [args.at || 'home', +(args.hour || 13)]);
  await sleep(2500);
  const r = await page.evaluate(() => {
    const g = window.__ori.game3d.game;
    const THREE_Frustum = g.camera.constructor && null;
    const sc = g.scene;
    const cam = g.camera;
    const out = { main: {}, shadow: {}, calls: 0 };
    const mat = cam.projectionMatrix.clone().multiply(cam.matrixWorldInverse);
    const sunL = sc.children.find((o) => o.isDirectionalLight);
    const smat = sunL.shadow.camera.projectionMatrix.clone().multiply(sunL.shadow.camera.matrixWorldInverse);
    // frustum planes (Gribb-Hartmann)
    const planesOf = (m) => { const e = m.elements; const pl = []; const row = (i) => [e[i], e[4 + i], e[8 + i], e[12 + i]]; const r0 = row(0); const r1 = row(1); const r2 = row(2); const r3 = row(3); const add = (a, b, s) => pl.push([a[0] + s * b[0], a[1] + s * b[1], a[2] + s * b[2], a[3] + s * b[3]]); for (const s of [1, -1]) { add(r3, r0, s); add(r3, r1, s); add(r3, r2, s); } return pl; };
    const e = mat.elements;
    const planes = [];
    const row = (i) => [e[i], e[4 + i], e[8 + i], e[12 + i]];
    const r0 = row(0); const r1 = row(1); const r2 = row(2); const r3 = row(3);
    const add = (a, b, s) => planes.push([a[0] + s * b[0], a[1] + s * b[1], a[2] + s * b[2], a[3] + s * b[3]]);
    for (const s of [1, -1]) { add(r3, r0, s); add(r3, r1, s); add(r3, r2, s); }
    const splanes = planesOf(smat);
    const inside = (c, rad, pls = planes) => pls.every((p) => { const l = Math.hypot(p[0], p[1], p[2]); return (p[0] * c.x + p[1] * c.y + p[2] * c.z + p[3]) / l > -rad; });
    sc.traverse((o) => {
      if (!(o.isMesh || o.isInstancedMesh || o.isLineSegments || o.isPoints) || !o.visible) return;
      let p = o.parent; let vis = true; while (p) { if (!p.visible) { vis = false; break; } p = p.parent; }
      if (!vis) return;
      const geo = o.geometry;
      if (!geo.boundingSphere) geo.computeBoundingSphere();
      const bs = o.isInstancedMesh ? (o.boundingSphere || (o.computeBoundingSphere(), o.boundingSphere)) : geo.boundingSphere;
      const c = bs.center.clone().applyMatrix4(o.isInstancedMesh ? o.matrixWorld : o.matrixWorld);
      const sc2 = o.matrixWorld.getMaxScaleOnAxis();
      const seen = o.frustumCulled === false || inside(c, bs.radius * sc2);
      const idx = geo.index ? geo.index.count : geo.attributes.position.count;
      const n = (idx / 3) * (o.isInstancedMesh ? o.count : 1);
      const k = (o.name || '?').replace(/-?[-0-9,:]+$/, '').replace(/^(crowd).*/, 'crowd').replace(/^(ori:).*/, 'ori');
      if (o.castShadow && (o.frustumCulled === false || inside(c, bs.radius * sc2, splanes))) out.shadow[k] = (out.shadow[k] || 0) + n;
      if (!seen) return;
      out.main[k] = (out.main[k] || 0) + n;
      out.calls++;
    });
    const sum = (o) => Math.round(Object.values(o).reduce((a, v) => a + v, 0) / 1000) + 'k';
    out.mainTotal = sum(out.main); out.shadowTotal = sum(out.shadow);
    const fmt = (o) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 16).map(([k, v]) => [k, Math.round(v / 1000) + 'k']));
    out.main = fmt(out.main); out.shadow = fmt(out.shadow);
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  s.errors.forEach((e) => console.log('ERR', e.kind, e.text.slice(0, 300)));
} finally { await browser.close(); await server.close(); }
