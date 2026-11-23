// @ts-check
/**
 * Zero-dependency browser smoke check.
 *
 * `npm test` runs this after the Node suite. It starts the static dev server on a free
 * port, launches headless Chrome or Edge, and exercises the surfaces `node --test`
 * cannot reach: canvas rendering, worker wiring, theme painting, keyboard focus order,
 * the stage overlay, and export compression. It is a smoke check, not a replacement for
 * the visual review in docs/agent/browser-check.md; it exists so the release checklist
 * is not the only thing standing between a regression and a green build.
 *
 * Usage:
 *   node tools/browser-check.mjs
 *   CHROME_PATH=/path/to/chrome node tools/browser-check.mjs
 *
 * Exit code 0 means every check passed. Failures print the assertion and leave the
 * browser/server cleanup to the finally block.
 */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { encodeIndexedPng } from '../js/core/png/encode.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const HOST = '127.0.0.1';
const STARTUP_TIMEOUT = 20000;
const CHECK_TIMEOUT = 30000;

/** @typedef {{ name: string, ok: boolean, detail?: string, error?: Error }} CheckResult */

/** @type {CheckResult[]} */
const results = [];
/** @type {string[]} */
const pageErrors = [];

/**
 * @param {string} name
 * @param {() => Promise<string|void>} run
 */
async function check(name, run) {
  try {
    const detail = await run();
    results.push({ name, ok: true, detail: detail || undefined });
    console.log(`ok - ${name}${detail ? ` (${detail})` : ''}`);
  } catch (error) {
    const failure = error instanceof Error ? error : new Error(String(error));
    results.push({ name, ok: false, error: failure });
    console.log(`not ok - ${name}: ${failure.message}`);
  }
}

/** @param {number} ms */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {() => Promise<boolean>} predicate
 * @param {number} [timeout]
 * @param {string} [label]
 */
async function waitFor(predicate, timeout = STARTUP_TIMEOUT, label = 'condition') {
  const deadline = Date.now() + timeout;
  let lastError = null;
  for (;;) {
    try {
      if (await predicate()) return;
    } catch (error) {
      lastError = error;
    }
    if (Date.now() > deadline) {
      const suffix = lastError ? `; last error: ${lastError.message}` : '';
      throw new Error(`${label} timed out after ${timeout} ms${suffix}`);
    }
    await sleep(100);
  }
}

/** @param {string} file */
async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

/** @returns {Promise<number>} */
function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, HOST, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('could not allocate a port'));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}

/** @returns {Promise<string>} */
async function findChrome() {
  const configured = process.env.CHROME_PATH;
  if (configured) {
    if (await exists(configured)) return configured;
    throw new Error(`CHROME_PATH points at a missing file: ${configured}`);
  }

  /** @type {string[]} */
  const absolute = [];
  if (process.platform === 'win32') {
    const programFiles = process.env.PROGRAMFILES ?? 'C:\\Program Files';
    const programFilesX86 = process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)';
    const localAppData = process.env.LOCALAPPDATA ?? '';
    absolute.push(
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    );
  } else if (process.platform === 'darwin') {
    absolute.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    );
  } else {
    absolute.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium',
      '/opt/google/chrome/chrome',
      '/usr/bin/microsoft-edge',
    );
  }
  for (const file of absolute) {
    if (await exists(file)) return file;
  }

  const names =
    process.platform === 'win32'
      ? ['chrome.exe', 'msedge.exe']
      : ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge'];
  for (const directory of (process.env.PATH ?? '').split(path.delimiter)) {
    if (!directory) continue;
    for (const name of names) {
      const file = path.join(directory, name);
      if (await exists(file)) return file;
    }
  }
  throw new Error(
    'Chrome or Edge was not found. Install one or set CHROME_PATH to the executable.',
  );
}

/**
 * Minimal Chrome DevTools Protocol client. The browser suite talks to one page target;
 * this is deliberately the same shape as tools/cdp.mjs, without the command-line layer.
 *
 * @param {string} url
 */
async function connect(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', () => reject(new Error('CDP socket failed')), {
      once: true,
    });
  });

  let nextId = 0;
  /** @type {Map<number, { resolve:(value:any)=>void, reject:(error:Error)=>void }>} */
  const pending = new Map();
  /** @type {Map<string, ((params:any)=>void)[]>} */
  const listeners = new Map();

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id) {
      const entry = pending.get(message.id);
      if (!entry) return;
      pending.delete(message.id);
      if (message.error) entry.reject(new Error(`${message.error.message} (${message.method ?? ''})`));
      else entry.resolve(message.result);
      return;
    }
    const handlers = listeners.get(message.method);
    if (handlers) for (const handler of handlers) handler(message.params);
  });
  socket.addEventListener('close', () => {
    for (const entry of pending.values()) entry.reject(new Error('CDP socket closed'));
    pending.clear();
  });

  /**
   * @param {string} method
   * @param {Record<string, unknown>} [params]
   * @returns {Promise<any>}
   */
  function send(method, params = {}) {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }

  /**
   * @param {string} method
   * @param {(params:any)=>void} handler
   */
  function on(method, handler) {
    const handlers = listeners.get(method) ?? [];
    handlers.push(handler);
    listeners.set(method, handlers);
  }

  return { send, on, close: () => socket.close() };
}

/** @typedef {Awaited<ReturnType<typeof connect>>} Session */

/**
 * @param {Session} session
 * @param {string} expression
 * @param {boolean} [userGesture]
 * @returns {Promise<any>}
 */
async function evaluate(session, expression, userGesture = false) {
  /** @type {ReturnType<typeof setTimeout>|undefined} */
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('page evaluation timed out after 15000 ms')), 15000);
  });
  try {
    const result = await Promise.race([
      session.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
        userGesture,
      }),
      timeout,
    ]);
    if (result.exceptionDetails) {
      const text =
        result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text ??
        'evaluation failed';
      throw new Error(text);
    }
    return result.result.value;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {Session} session
 * @param {string} expression
 * @param {number} [timeout]
 * @param {string} [label]
 */
async function waitForExpression(session, expression, timeout = STARTUP_TIMEOUT, label = expression) {
  await waitFor(async () => Boolean(await evaluate(session, expression)), timeout, label);
}

/**
 * @param {Session} session
 * @param {string} key
 * @param {number} keyCode
 */
async function pressKey(session, key, keyCode) {
  await session.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key,
    code: key,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
  });
  await session.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key,
    code: key,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
  });
  await sleep(80);
}

/** @returns {Promise<{width:number,height:number,indices:Uint8Array,palette:{color:{r:number,g:number,b:number,a:number}}[]}>} */
async function makeFixture() {
  const width = 96;
  const height = 64;
  const palette = Array.from({ length: 16 }, (_, index) => ({
    color: {
      r: 24 + index * 14,
      g: 240 - index * 13,
      b: (index * 37) % 256,
      a: 255,
    },
  }));
  const indices = new Uint8Array(width * height);
  // Flat 8x8 tiles: the image has large uniform runs for the compressor, and the
  // palette has enough entries to exercise packing without a binary fixture.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      indices[y * width + x] = (Math.floor(x / 8) + Math.floor(y / 8) * 12) & 15;
    }
  }
  return { width, height, indices, palette };
}

/**
 * @param {number} viewportWidth
 * @param {number} viewportHeight
 * @param {boolean} full
 */
async function runViewport(viewportWidth, viewportHeight, full) {
  const chromePath = await findChrome();
  const port = await freePort();
  const debugPort = await freePort();
  const origin = `http://${HOST}:${port}`;
  const profile = await mkdtemp(path.join(os.tmpdir(), 'peiq-browser-'));
  /** @type {import('node:child_process').ChildProcess|null} */
  let server = null;
  /** @type {import('node:child_process').ChildProcess|null} */
  let browser = null;
  /** @type {Session|null} */
  let session = null;

  try {
    server = spawn(process.execPath, [path.join(ROOT, 'tools', 'dev-server.mjs'), String(port), `--host=${HOST}`], {
      cwd: ROOT,
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: true,
    });
    await waitFor(async () => {
      try {
        const response = await fetch(`${origin}/index.html`, { cache: 'no-store' });
        return response.ok;
      } catch {
        return false;
      }
    }, STARTUP_TIMEOUT, 'dev server');

    let browserLog = '';
    const extraFlags = (process.env.PEIQ_CHROME_FLAGS ?? '')
      .split(/\s+/)
      .filter(Boolean);
    browser = spawn(
      chromePath,
      [
        '--headless=new',
        `--remote-debugging-port=${debugPort}`,
        `--user-data-dir=${profile}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--hide-scrollbars',
        '--mute-audio',
        '--disable-background-networking',
        '--disable-sync',
        '--disable-extensions',
        '--lang=en-US',
        `--window-size=${viewportWidth},${viewportHeight}`,
        ...extraFlags,
        'about:blank',
      ],
      { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true },
    );
    browser.stderr?.on('data', (chunk) => {
      browserLog += String(chunk);
      if (browserLog.length > 8000) browserLog = browserLog.slice(-8000);
    });
    browser.on('exit', (code, signal) => {
      if (code !== 0 && code !== null) browserLog += `\nChrome exited with ${code} ${signal ?? ''}`;
    });

    await waitFor(async () => {
      try {
        const response = await fetch(`http://${HOST}:${debugPort}/json/list`, { cache: 'no-store' });
        if (!response.ok) return false;
        const targets = await response.json();
        return targets.some((target) => target.type === 'page');
      } catch {
        return false;
      }
    }, STARTUP_TIMEOUT, 'headless browser').catch((error) => {
      throw new Error(`${error.message}\n${browserLog.slice(-2000)}`);
    });

    const targets = await (
      await fetch(`http://${HOST}:${debugPort}/json/list`, { cache: 'no-store' })
    ).json();
    const target = targets.find((entry) => entry.type === 'page');
    if (!target) throw new Error('no page target');
    session = await connect(target.webSocketDebuggerUrl);

    session.on('Runtime.exceptionThrown', (params) => {
      pageErrors.push(
        params.exceptionDetails?.exception?.description ??
          params.exceptionDetails?.text ??
          'uncaught exception',
      );
    });
    session.on('Runtime.consoleAPICalled', (params) => {
      if (params.type !== 'error' && params.type !== 'assert') return;
      const text = (params.args ?? [])
        .map((arg) => arg.value ?? arg.description ?? arg.type ?? '')
        .join(' ');
      if (text) pageErrors.push(text);
    });
    session.on('Log.entryAdded', (params) => {
      if (params.entry?.level === 'error') pageErrors.push(params.entry.text ?? 'log error');
    });

    await session.send('Page.enable');
    await session.send('Runtime.enable');
    await session.send('Log.enable');
    await session.send('Emulation.setDeviceMetricsOverride', {
      width: viewportWidth,
      height: viewportHeight,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await session.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: 'dark' }],
    });
    await session.send('Storage.clearDataForOrigin', { origin, storageTypes: 'all' });

    /** @param {string} suffix */
    async function navigate(suffix = '') {
      await session.send('Page.navigate', { url: `${origin}/${suffix}` });
      await waitForExpression(
        session,
        "document.readyState === 'complete' && Boolean(document.getElementById('app-version')?.textContent.trim())",
        STARTUP_TIMEOUT,
        'app boot',
      );
      await sleep(150);
    }

    await navigate();

    const themeState = () =>
      evaluate(
        session,
        `(() => {
          const root = document.documentElement;
          const toggle = document.getElementById('theme-toggle');
          return {
            mode: root.getAttribute('data-theme-mode'),
            theme: root.getAttribute('data-theme'),
            toggle: toggle?.getAttribute('data-mode') ?? null,
            body: getComputedStyle(document.body).backgroundColor,
            panel: getComputedStyle(document.querySelector('.peiq-palette-panel')).backgroundColor,
            height: document.documentElement.scrollHeight,
            meta: document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null,
          };
        })()`,
      );

    await check(`theme painting and persistence at ${viewportWidth}px`, async () => {
      const auto = await themeState();
      assert.equal(auto.mode, 'auto', 'the first visit starts in auto mode');
      assert.equal(auto.theme, 'dark', 'auto follows the emulated dark system theme');
      assert.equal(auto.toggle, 'auto');

      await evaluate(session, "document.getElementById('theme-toggle').click()", true);
      await sleep(120);
      const light = await themeState();
      assert.equal(light.mode, 'light');
      assert.equal(light.theme, 'light');
      assert.equal(light.toggle, 'light');
      assert.notEqual(light.body, auto.body, 'the body background changes with the theme');
      assert.notEqual(light.panel, auto.panel, 'panel surfaces change with the theme');
      assert.equal(light.meta, '#f5f5f5', 'the theme-color meta follows the theme');
      assert.ok(Math.abs(light.height - auto.height) <= 1, 'theme switching does not shift layout');

      await navigate();
      const restored = await themeState();
      assert.equal(restored.mode, 'light', 'the light preference survives a reload');
      assert.equal(restored.theme, 'light');

      await evaluate(session, "document.getElementById('theme-toggle').click()", true);
      await sleep(120);
      const dark = await themeState();
      assert.equal(dark.mode, 'dark');
      assert.equal(dark.theme, 'dark');
      assert.equal(dark.body, auto.body, 'dark restores the original body color');

      await evaluate(session, "document.getElementById('theme-toggle').click()", true);
      await sleep(120);
      const backToAuto = await themeState();
      assert.equal(backToAuto.mode, 'auto');
      assert.equal(backToAuto.theme, 'dark', 'auto resolves through the system preference again');
      return 'auto -> light -> reload -> dark -> auto';
    });

    const fixture = await makeFixture();
    const fixturePng = await encodeIndexedPng({
      width: fixture.width,
      height: fixture.height,
      indices: fixture.indices,
      palette: fixture.palette,
    });
    const fixtureBase64 = Buffer.from(fixturePng).toString('base64');

    await check(`image load, worker result, and palette at ${viewportWidth}px`, async () => {
      await evaluate(
        session,
        `(async () => {
          const binary = Uint8Array.from(atob(${JSON.stringify(fixtureBase64)}), (c) => c.charCodeAt(0));
          const file = new File([binary], 'browser-check.png', { type: 'image/png' });
          const transfer = new DataTransfer();
          transfer.items.add(file);
          document.dispatchEvent(new DragEvent('drop', {
            bubbles: true,
            cancelable: true,
            dataTransfer: transfer,
          }));
          return true;
        })()`,
        true,
      );
      await waitForExpression(
        session,
        `(() => {
          const workspace = document.getElementById('workspace');
          return Boolean(
            workspace &&
              !workspace.hidden &&
              !document.getElementById('export-indexed').disabled &&
              document.querySelectorAll('#palette-strip .peiq-swatch').length >= 2,
          );
        })()`,
        CHECK_TIMEOUT,
        'worker result',
      );
      const state = await evaluate(
        session,
        `(() => ({
          width: ${fixture.width},
          height: ${fixture.height},
          palette: document.querySelectorAll('#palette-strip .peiq-swatch').length,
          exportEnabled: !document.getElementById('export-indexed').disabled,
          status: document.getElementById('statusbar')?.textContent?.trim() ?? '',
        }))()`,
      );
      assert.ok(state.palette >= 2, `expected a palette, got ${state.palette}`);
      assert.equal(state.exportEnabled, true, 'the export controls wait for the worker');
      assert.match(state.status, new RegExp(`${fixture.width}`), 'the status line names the source');
      return `${state.palette} colors`;
    });

    if (full) {
      await check('HEX copy button copies the selected entry', async () => {
        const result = await evaluate(
          session,
          `(async () => {
            const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
            const original = navigator.clipboard;
            const copied = [];
            try {
              Object.defineProperty(navigator, 'clipboard', {
                configurable: true,
                value: {
                  writeText: async (text) => {
                    copied.push(text);
                  },
                },
              });
            } catch (error) {
              return { error: String(error) };
            }
            document.getElementById('palette-edit').click();
            document.querySelector('#palette-strip .peiq-swatch').click();
            await sleep(80);
            const hex = document.getElementById('palette-hex').value;
            const button = document.getElementById('palette-copy-hex');
            const disabled = button.disabled;
            button.click();
            await sleep(120);
            const toast = [...document.querySelectorAll('.peiq-toast--success')]
              .map((node) => node.textContent)
              .pop() ?? '';
            document.getElementById('palette-edit').click();
            Object.defineProperty(navigator, 'clipboard', { configurable: true, value: original });
            return { hex, copied, disabled, toast };
          })()`,
        );
        assert.ok(!result.error, result.error);
        assert.equal(result.disabled, false, 'the button enables with a selected color');
        assert.match(result.hex, /^#[0-9a-f]{6}$/);
        assert.deepEqual(result.copied, [result.hex]);
        assert.match(result.toast, /Copied #/);
        return result.hex;
      });

      await check('preview captions copy HEX and RGB on click', async () => {
        const result = await evaluate(
          session,
          `(async () => {
            const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
            const original = navigator.clipboard;
            const copied = [];
            Object.defineProperty(navigator, 'clipboard', {
              configurable: true,
              value: {
                writeText: async (text) => {
                  copied.push(text);
                },
              },
            });
            document.getElementById('palette-preview-open').click();
            await sleep(180);
            document.querySelector('[data-mode="column"]').click();
            for (const id of ['palette-preview-hex', 'palette-preview-rgb']) {
              const box = document.getElementById(id);
              box.checked = true;
              box.dispatchEvent(new Event('change', { bubbles: true }));
            }
            await sleep(220);
            const labels = [...document.querySelectorAll('#palette-preview-strip .peiq-palette-preview__label')];
            const hexLabel = labels.find((node) => node.dataset.copyKind === 'hex');
            const rgbLabel = labels.find((node) => node.dataset.copyKind === 'rgb');
            const values = {
              labelCount: labels.length,
              hex: hexLabel?.dataset.copyValue ?? '',
              rgb: rgbLabel?.dataset.copyValue ?? '',
              hexAria: hexLabel?.getAttribute('aria-label') ?? '',
              rgbAria: rgbLabel?.getAttribute('aria-label') ?? '',
            };
            hexLabel?.click();
            await sleep(80);
            rgbLabel?.click();
            await sleep(120);
            document.getElementById('palette-preview-close').click();
            Object.defineProperty(navigator, 'clipboard', { configurable: true, value: original });
            return { ...values, copied };
          })()`,
        );
        assert.ok(result.labelCount >= 2, 'both captions render as buttons');
        assert.match(result.hex, /^#[0-9a-f]{6}$/);
        assert.match(result.rgb, /^\d+ \d+ \d+$/);
        assert.match(result.hexAria, /^Copy #/);
        assert.match(result.rgbAria, /^Copy RGB /);
        assert.deepEqual(result.copied, [result.hex, result.rgb]);
        return `${result.hex}, ${result.rgb}`;
      });
    }

    await check(`canvas paints a preview at ${viewportWidth}px`, async () => {
      const canvas = await evaluate(
        session,
        `(() => {
          const node = document.getElementById('view-canvas');
          const context = node.getContext('2d');
          const data = context.getImageData(0, 0, node.width, node.height).data;
          let opaque = 0;
          let samples = 0;
          const colors = new Set();
          const stepX = Math.max(1, Math.floor(node.width / 24));
          const stepY = Math.max(1, Math.floor(node.height / 16));
          for (let y = 0; y < node.height; y += stepY) {
            for (let x = 0; x < node.width; x += stepX) {
              const index = (y * node.width + x) * 4;
              samples++;
              if (data[index + 3] > 0) opaque++;
              colors.add(data[index] + ',' + data[index + 1] + ',' + data[index + 2] + ',' + data[index + 3]);
            }
          }
          return {
            width: node.width,
            height: node.height,
            samples,
            opaque,
            colors: colors.size,
            cssWidth: node.getBoundingClientRect().width,
          };
        })()`,
      );
      assert.ok(canvas.width > 0 && canvas.height > 0, 'the canvas has a backing store');
      assert.ok(canvas.cssWidth > 0, 'the canvas has a layout box');
      // The fitted image sits inside the frame, so transparent letterbox pixels are
      // expected; a blank or unpainted canvas has no opaque pixels at all.
      assert.ok(canvas.opaque > 0, 'the canvas is painted, not blank');
      assert.ok(canvas.colors > 2, `expected several colors, got ${canvas.colors}`);
      return `${canvas.width}x${canvas.height}, ${canvas.opaque}/${canvas.samples} opaque samples, ${canvas.colors} colors`;
    });

    if (full) {
      await check('indexed export is validated, decodable, and compressed', async () => {
        // The preview runs from the drop until the result lands, and a click during
        // that short window is intentionally ignored with a status message. Retry
        // until the export actually starts rather than depending on a fixed delay.
        const deadline = Date.now() + CHECK_TIMEOUT;
        for (;;) {
          const linkReady = await evaluate(
            session,
            "Boolean(document.querySelector('#download-result a[download$=\"-indexed.png\"]'))",
          );
          if (linkReady) break;
          const failure = await evaluate(
            session,
            "document.querySelector('.peiq-toast--error')?.textContent ?? ''",
          );
          if (failure) throw new Error(`indexed export failed: ${failure}`);
          const idle = await evaluate(
            session,
            "(() => { const button = document.getElementById('export-indexed'); return !button.disabled; })()",
          );
          if (idle) await evaluate(session, "document.getElementById('export-indexed').click()", true);
          if (Date.now() > deadline) {
            throw new Error(`indexed export timed out after ${CHECK_TIMEOUT} ms`);
          }
          await sleep(200);
        }
        const file = await evaluate(
          session,
          `(async () => {
            const link = document.querySelector('#download-result a[download$="-indexed.png"]');
            const bytes = new Uint8Array(await (await fetch(link.href)).arrayBuffer());
            const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
            const result = {
              name: link.download,
              size: bytes.length,
              width: bitmap.width,
              height: bitmap.height,
              signature: [...bytes.subarray(0, 8)],
              busy: document.getElementById('download-result').hasAttribute('inert'),
            };
            bitmap.close();
            return result;
          })()`,
        );
        const rawBytes = (Math.ceil((fixture.width * 4) / 8) + 1) * fixture.height;
        assert.equal(file.name.endsWith('-indexed.png'), true);
        assert.deepEqual(file.signature, [137, 80, 78, 71, 13, 10, 26, 10]);
        assert.equal(file.width, fixture.width);
        assert.equal(file.height, fixture.height);
        assert.equal(file.busy, false, 'the validated block is active after the job');
        assert.ok(
          file.size < rawBytes,
          `expected ${file.size} bytes to stay below the ${rawBytes}-byte raw stream`,
        );
        return `${file.size} bytes, raw stream ${rawBytes}`;
      });
    }

    if (full) {
      await check('keyboard focus order reaches every control with a visible ring', async () => {
        const positive = await evaluate(
          session,
          "[...document.querySelectorAll('[tabindex]')].filter((node) => Number(node.getAttribute('tabindex')) > 0).length",
        );
        assert.equal(positive, 0, 'no positive tabindex values');

        await evaluate(
          session,
          "document.getElementById('theme-toggle').focus(); document.activeElement?.blur(); document.getElementById('theme-toggle').focus();",
        );
        /** @type {{id:string, outline:string, visible:boolean, tag:string}[]} */
        const order = [];
        for (let index = 0; index < 14; index++) {
          await pressKey(session, 'Tab', 9);
          order.push(
            await evaluate(
              session,
              `(() => {
                const node = document.activeElement;
                const style = getComputedStyle(node);
                const rect = node.getBoundingClientRect();
                return {
                  id: node.id || '',
                  tag: node.tagName,
                  outline: style.outlineStyle,
                  shadow: style.boxShadow,
                  visible: rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight,
                };
              })()`,
            ),
          );
        }
        const invisible = order.filter((entry) => !entry.visible);
        assert.deepEqual(invisible, [], 'every focused control is visible');
        const ringless = order.filter(
          (entry) => entry.outline === 'none' && entry.shadow === 'none',
        );
        assert.deepEqual(ringless, [], 'every focused control shows a focus ring');
        return `${order.length} stops: ${order.slice(0, 5).map((entry) => entry.id || entry.tag).join(' -> ')}`;
      });

      await check('divider responds to the keyboard', async () => {
        const before = await evaluate(
          session,
          "(() => { const node = document.getElementById('divider'); node.focus(); return Number(node.getAttribute('aria-valuenow')); })()",
        );
        await pressKey(session, 'ArrowRight', 39);
        const after = await evaluate(
          session,
          "Number(document.getElementById('divider').getAttribute('aria-valuenow'))",
        );
        assert.ok(after > before, `expected the divider to advance, was ${before} then ${after}`);
        return `${before}% -> ${after}%`;
      });
    }

    await check(`layout at ${viewportWidth}x${viewportHeight}`, async () => {
      const layout = await evaluate(
        session,
        `(() => {
          const frame = document.getElementById('canvas-frame').getBoundingClientRect();
          const palette = document.querySelectorAll('#palette-strip .peiq-swatch').length;
          return {
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            frameWidth: frame.width,
            frameVisible: frame.width > 0 && frame.height > 0,
            palette,
            viewport: innerWidth,
          };
        })()`,
      );
      assert.ok(layout.overflow <= 0, `horizontal overflow is ${layout.overflow}px`);
      assert.equal(layout.frameVisible, true, 'the canvas frame is visible');
      assert.ok(layout.palette >= 2, 'the palette is visible');
      assert.ok(layout.frameWidth <= layout.viewport + 1, 'the frame stays inside the viewport');
    });

    if (viewportWidth <= 480) {
      await check('touch targets stay at least 44 px at 360 px', async () => {
        const small = await evaluate(
          session,
          `(() => {
            const selectors = ['#theme-toggle', '#help-toggle', '#canvas-maximize', '#canvas-hide', '#palette-edit'];
            return selectors.map((selector) => {
              const node = document.querySelector(selector);
              if (!node) return { selector, missing: true };
              const rect = node.getBoundingClientRect();
              return { selector, width: rect.width, height: rect.height };
            }).filter((entry) => !entry.missing && (entry.height < 44 || entry.width < 44));
          })()`,
        );
        assert.deepEqual(small, [], 'every sampled control is at least 44x44');
        return '5 controls at 44x44 or larger';
      });
    }

    await check('full screen and hidden canvas work, restore with Esc, and align the freed row', async () => {
        const normal = await evaluate(
          session,
          `(() => {
            const frame = document.getElementById('canvas-frame').getBoundingClientRect();
            return { x: frame.x, y: frame.y, width: frame.width, height: frame.height };
          })()`,
        );
        await evaluate(session, "document.getElementById('canvas-maximize').click()", true);
        await sleep(150);
        const max = await evaluate(
          session,
          `(() => {
            const frame = document.getElementById('canvas-frame').getBoundingClientRect();
            const exit = document.getElementById('canvas-exit');
            const rect = exit.getBoundingClientRect();
            return {
              stage: document.documentElement.dataset.stage,
              frame: { x: frame.x, y: frame.y, width: frame.width, height: frame.height },
              viewport: { width: innerWidth, height: innerHeight },
              active: document.activeElement?.id ?? '',
              exitVisible: rect.width > 0 && rect.height > 0,
              paletteHidden: getComputedStyle(document.querySelector('.peiq-palette-panel')).display === 'none',
            };
          })()`,
        );
        assert.equal(max.stage, 'max');
        assert.ok(Math.abs(max.frame.width - max.viewport.width) <= 1, 'the frame fills the width');
        assert.ok(Math.abs(max.frame.height - max.viewport.height) <= 1, 'the frame fills the height');
        assert.equal(max.exitVisible, true, 'the exit control is visible');
        assert.equal(max.active, 'canvas-exit', 'focus moves into the overlay');
        assert.equal(max.paletteHidden, true, 'the palette gives its space to the overlay');

        await pressKey(session, 'Escape', 27);
        const restored = await evaluate(
          session,
          `(() => {
            const frame = document.getElementById('canvas-frame').getBoundingClientRect();
            return {
              stage: document.documentElement.dataset.stage,
              active: document.activeElement?.id ?? '',
              frame: { x: frame.x, y: frame.y, width: frame.width, height: frame.height },
            };
          })()`,
        );
        assert.equal(restored.stage, 'normal');
        assert.equal(restored.active, 'canvas-maximize', 'focus returns to the opener');
        assert.ok(Math.abs(restored.frame.width - normal.width) <= 1, 'the frame returns to its slot');
        assert.ok(Math.abs(restored.frame.height - normal.height) <= 1);

        await evaluate(session, "document.getElementById('canvas-hide').click()", true);
        await sleep(150);
        const hidden = await evaluate(
          session,
          `(() => {
            const palette = document.querySelector('.peiq-palette-panel').getBoundingClientRect();
            const exportPanel = document.querySelector('.peiq-export-panel').getBoundingClientRect();
            const strip = document.getElementById('palette-strip');
            return {
              stage: document.documentElement.dataset.stage,
              frame: getComputedStyle(document.getElementById('canvas-frame')).display,
              palette: getComputedStyle(document.querySelector('.peiq-palette-panel')).display,
              paletteTop: palette.top,
              exportTop: exportPanel.top,
              stripMaxHeight: getComputedStyle(strip).maxHeight,
              stripClientHeight: strip.clientHeight,
              stripScrollHeight: strip.scrollHeight,
            };
          })()`,
        );
        assert.equal(hidden.stage, 'hidden');
        assert.equal(hidden.frame, 'none', 'hiding removes the canvas');
        assert.notEqual(hidden.palette, 'none', 'the palette keeps the freed row');
        if (viewportWidth >= 980) {
          assert.ok(
            Math.abs(hidden.paletteTop - hidden.exportTop) <= 1,
            `the palette starts on the export edge, delta ${hidden.paletteTop - hidden.exportTop}px`,
          );
          assert.equal(hidden.stripMaxHeight, 'none', 'the strip uses the freed height');
          assert.ok(
            hidden.stripClientHeight > 196,
            `the strip grows past the old 196 px cap, was ${hidden.stripClientHeight}px`,
          );
          const closed = await evaluate(
            session,
            `(() => {
              document.getElementById('rail-toggle').click();
              const palette = document.querySelector('.peiq-palette-panel').getBoundingClientRect();
              const exportPanel = document.querySelector('.peiq-export-panel').getBoundingClientRect();
              return {
                delta: palette.top - exportPanel.top,
                rail: document.documentElement.dataset.rail,
              };
            })()`,
          );
          assert.equal(closed.rail, 'closed');
          assert.ok(
            Math.abs(closed.delta) <= 1,
            `the palette stays on the export edge without the rail, delta ${closed.delta}px`,
          );
          await evaluate(session, "document.getElementById('rail-toggle').click()");
        }
        await pressKey(session, 'Escape', 27);
        assert.equal(
          await evaluate(session, 'document.documentElement.dataset.stage'),
          'normal',
        );

        await navigate();
        const afterReload = await evaluate(
          session,
          `(() => ({
            stage: document.documentElement.dataset.stage ?? '',
            stored: [...Object.keys(localStorage), ...Object.keys(sessionStorage)].filter((key) => /stage/i.test(key)),
          }))()`,
        );
        assert.ok(
          afterReload.stage === 'normal' || afterReload.stage === '',
          'a reload starts in the normal frame',
        );
        assert.deepEqual(afterReload.stored, [], 'the stage is never persisted');
        return 'max -> Esc, hidden -> Esc, reload normal';
      });

    await check(`no console errors at ${viewportWidth}px`, async () => {
      assert.deepEqual(pageErrors, []);
      return 'clean';
    });
  } finally {
    session?.close();
    if (browser) {
      if (browser.exitCode === null) {
        const exited = new Promise((resolve) => browser?.once('exit', resolve));
        if (process.platform === 'win32') {
          spawnSync('taskkill', ['/pid', String(browser.pid), '/T', '/F'], {
            stdio: 'ignore',
            windowsHide: true,
          });
        } else {
          browser.kill('SIGTERM');
        }
        await Promise.race([exited, sleep(3000)]);
      }
    }
    if (server) {
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], {
          stdio: 'ignore',
          windowsHide: true,
        });
      } else {
        server.kill('SIGTERM');
      }
    }
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 }).catch(() => {
      // Chrome can keep a lock on its profile for a moment after exit; the temp
      // directory is disposable and the OS cleans it on the next sweep.
    });
  }
}

async function main() {
  console.log('browser check: headless Chrome smoke suite');
  try {
    await runViewport(1280, 900, true);
    await runViewport(360, 800, false);
  } catch (error) {
    const failure = error instanceof Error ? error : new Error(String(error));
    results.push({ name: 'browser launch', ok: false, error: failure });
    console.log(`not ok - browser launch: ${failure.message}`);
  }

  const failed = results.filter((result) => !result.ok);
  const passed = results.length - failed.length;
  console.log(`browser check: ${passed} passed, ${failed.length} failed`);
  if (failed.length > 0) {
    for (const result of failed) {
      console.log(`\n${result.name}\n${result.error?.stack ?? result.error?.message ?? 'failed'}`);
    }
    process.exitCode = 1;
  }
}

await main();
