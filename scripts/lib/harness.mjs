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

const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];

async function launchOne(channel, headless) {
  return chromium.launch({ channel, headless, args: ARGS });
}

/** Launches the system Chrome, falling back to Edge. If WebGL does not work headless, retries headed. */
export async function launchBrowser({ headed = false } = {}) {
  const tryModes = headed ? [false] : [true, false];
  let lastErr;
  for (const headless of tryModes) {
    for (const channel of ['chrome', 'msedge']) {
      try {
        const browser = await launchOne(channel, headless);
        const page = await browser.newPage();
        const gl = await page.evaluate(() => {
          const c = document.createElement('canvas');
          return !!(c.getContext('webgl2') || c.getContext('webgl'));
        });
        await page.close();
        if (gl) return { browser, channel, headless };
        await browser.close();
        lastErr = new Error(`WebGL unavailable in ${channel} (headless=${headless})`);
      } catch (e) {
        lastErr = e;
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
  await page.goto(`${origin}/${fast ? '?fast=1' : ''}${hash}`, { waitUntil: 'domcontentloaded' });
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

export async function snap(session, file) {
  await mkdir(join(file, '..'), { recursive: true });
  await session.page.screenshot({ path: file });
  return file;
}

export function parseSize(s) {
  const m = /^(\d+)x(\d+)$/.exec(s || '');
  return m ? { width: +m[1], height: +m[2] } : null;
}
