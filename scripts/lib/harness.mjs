// Shared test harness: builds the site, serves dist/ on a random port, drives the system Chrome/Edge through
// playwright-core (no browser download) and collects every console error / page error / failed request.
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

export const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
export const DIST = join(ROOT, 'dist');
export const SHOTS = join(ROOT, 'shots');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2',
  '.map': 'application/json', '.ico': 'image/x-icon',
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function build() {
  const r = spawnSync(process.execPath, ['build.mjs'], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) {
    process.stderr.write(r.stdout || '');
    process.stderr.write(r.stderr || '');
    throw new Error('build failed');
  }
}

/** Tiny static server for dist/ on a random local port. */
export async function serveDist() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      let rel = decodeURIComponent(url.pathname);
      if (rel.endsWith('/')) rel += 'index.html';
      const file = normalize(join(DIST, rel));
      if (file !== DIST && !file.startsWith(DIST + sep)) { res.writeHead(403).end('forbidden'); return; }
      const st = await stat(file);
      if (!st.isFile()) throw new Error('not a file');
      res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(await readFile(file));
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  return { url: `http://127.0.0.1:${port}/`, origin: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(r)) };
}

// WebGL backends: the real GPU first (ANGLE on D3D11, high-performance adapter), SwiftShader (software) as the fallback.
// `ORI_SOFTWARE_GL=1` forces software for deterministic / CI runs.
const COMMON = ['--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
const GPU_ARGS = [...COMMON, '--use-angle=d3d11', '--enable-gpu', '--enable-gpu-rasterization', '--enable-webgl', '--force_high_performance_gpu'];
const SOFT_ARGS = [...COMMON, '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const isSoftwareRenderer = (r) => /swiftshader|llvmpipe|software|basic render/i.test(r || '');
export const forceSoftware = () => process.env.ORI_SOFTWARE_GL === '1';

/** The WebGL renderer string the browser actually uses ('' when WebGL is unavailable). */
async function readRenderer(page) {
  return page.evaluate(() => {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'unknown';
  });
}

let announced = false;

/**
 * Launches the system Chrome (falling back to Edge) on the real GPU when it can, otherwise on SwiftShader.
 * Returns { browser, channel, headless, renderer, software }.
 */
export async function launchBrowser({ headed = false } = {}) {
  const modes = [];
  if (!forceSoftware()) {
    if (!headed) modes.push({ args: GPU_ARGS, headless: true, soft: false });
    modes.push({ args: GPU_ARGS, headless: false, soft: false });
  }
  if (!headed) modes.push({ args: SOFT_ARGS, headless: true, soft: true });
  modes.push({ args: SOFT_ARGS, headless: false, soft: true });
  let lastErr;
  for (const mode of modes) {
    for (const channel of ['chrome', 'msedge']) {
      let browser;
      try {
        browser = await chromium.launch({ channel, headless: mode.headless, args: mode.args });
        const page = await browser.newPage();
        const renderer = await readRenderer(page);
        await page.close();
        if (!renderer) throw new Error(`WebGL unavailable in ${channel} (headless=${mode.headless})`);
        if (!mode.soft && isSoftwareRenderer(renderer)) throw new Error(`GPU mode fell back to software: ${renderer}`);
        const software = isSoftwareRenderer(renderer);
        if (!announced) { announced = true; console.error(`GL: ${renderer}  [${channel}, ${mode.headless ? 'headless' : 'headed'}${software ? ', software' : ', GPU'}]`); }
        return { browser, channel, headless: mode.headless, renderer, software };
      } catch (e) {
        lastErr = e;
        if (browser) await browser.close().catch(() => {});
      }
    }
  }
  throw lastErr || new Error('no browser could be launched');
}

/**
 * Opens a page and wires up error collection.
 * `errors` is a live array of { kind, text }; `warnings` is informational only.
 */
export async function newSession(browser, origin, { width = 1280, height = 800 } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  const warnings = [];
  const sameOrigin = (u) => !u || u.startsWith(origin) || u.startsWith('data:') || u.startsWith('blob:');

  page.on('console', (msg) => {
    const type = msg.type();
    const loc = msg.location();
    if (type === 'error') {
      // a failed third-party request (Google Fonts when offline) is not our bug
      if (!sameOrigin(loc.url) && /Failed to load resource/i.test(msg.text())) return;
      errors.push({ kind: 'console.error', text: `${msg.text()} ${loc.url ? `(${loc.url}:${loc.lineNumber})` : ''}`.trim() });
    } else if (type === 'warning') {
      warnings.push(msg.text());
    }
  });
  page.on('pageerror', (e) => errors.push({ kind: 'pageerror', text: e.stack || String(e) }));
  page.on('requestfailed', (req) => {
    if (sameOrigin(req.url())) errors.push({ kind: 'requestfailed', text: `${req.url()} — ${req.failure()?.errorText}` });
  });
  page.on('response', (res) => {
    if (sameOrigin(res.url()) && res.status() >= 400) errors.push({ kind: `http ${res.status()}`, text: res.url() });
  });

  return { context, page, errors, warnings, width, height };
}

/** Loads the page (with ?fast=1 unless told otherwise) and waits for the first rendered frame. */
export async function loadSite(session, origin, { fast = true, hash = '' } = {}) {
  const { page } = session;
  await page.goto(`${origin}/${fast ? '?fast=1&quiet=1' : ''}${hash}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ori && window.__ori.ready, null, { timeout: 60000 });
}

/** Clicks START, then enters the MacBook screen with a real click. Resolves when the UI is interactive. */
export async function enterScreen(session) {
  const { page, width, height } = session;
  await page.click('#intro-start', { timeout: 15000 });
  await page.waitForFunction(() => window.__ori.state === 'ready', null, { timeout: 15000 });
  await sleep(1100); // the intro overlay fades out and stops capturing clicks
  await page.mouse.click(width / 2, height / 2);
  const target = width < 860 ? 'flat' : 'screen';
  try {
    await page.waitForFunction((t) => window.__ori.state === t, target, { timeout: 12000 });
  } catch {
    await page.evaluate(() => window.__ori.enterScreen()); // fall back to the API so later steps still run
    await page.waitForFunction((t) => window.__ori.state === t, target, { timeout: 12000 });
  }
  await page.waitForFunction(() => document.querySelector('.mac .boot')?.classList.contains('done'), null, { timeout: 15000 }).catch(() => {});
  await sleep(250);
}

/** Leaves the screen (Esc) so the room can be photographed with the desktop still booted. */
export async function backToRoom(session) {
  const { page } = session;
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__ori.state === 'overview', null, { timeout: 12000 });
  await sleep(150);
}

/** Waits until the page has produced `frames` more animation frames (software WebGL renders ~1-2 fps, so a fixed sleep is not enough for CSS animations to be painted). */
export async function settle(session, frames = 2) {
  await session.page.evaluate((n) => new Promise((res) => {
    let left = n;
    const step = () => { if (--left <= 0) res(); else requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }), frames);
}

export async function snap(session, file, { frames = 2 } = {}) {
  await mkdir(join(file, '..'), { recursive: true });
  await settle(session, frames);
  await session.page.screenshot({ path: file });
  return file;
}

export function parseSize(s) {
  const m = /^(\d+)x(\d+)$/.exec(s || '');
  return m ? { width: +m[1], height: +m[2] } : null;
}
