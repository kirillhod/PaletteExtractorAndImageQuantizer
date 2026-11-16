// @ts-check
/**
 * Minimal Chrome DevTools Protocol client for manual PEIQ UI checks.
 * Dev tooling only: it talks to a local Chrome and never ships with the site.
 *
 * Start Chrome first:
 *   chrome --headless=new --remote-debugging-port=9229 --user-data-dir=<temp>
 *
 * Usage:
 *   node cdp.mjs eval <script.js> [--width=360] [--height=800] [--dpr=3] [--port=9229]
 *   node cdp.mjs call <Domain.method> [json|@params.json] [--port=9229]
 *   node cdp.mjs shot <out.png> [--width=1280] [--height=900] [--dpr=1]
 *
 * `eval` runs the file as one expression with top-level await support:
 *   (async () => ({ title: document.title }))()
 */
import fs from 'node:fs';
import process from 'node:process';

/** @type {Record<string,string>} */
const flags = {};
/** @type {string[]} */
const rest = [];
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--')) {
    const [key, value = 'true'] = arg.slice(2).split('=');
    flags[key] = value;
  } else {
    rest.push(arg);
  }
}

const [command, ...params] = rest;
const port = Number(flags.port ?? 9229);
if (!command) {
  console.error('Usage: cdp.mjs eval <file.js> | call <Domain.method> [json] | shot <out.png>');
  process.exit(1);
}

const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = targets.find((entry) => entry.type === 'page');
if (!target) throw new Error(`No page target on port ${port}`);
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let nextId = 0;
/** @type {Map<number, { resolve:(value:any)=>void, reject:(error:Error)=>void }>} */
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(String(event.data));
  const entry = pending.get(message.id);
  if (!entry) return;
  pending.delete(message.id);
  if (message.error) entry.reject(new Error(message.error.message));
  else entry.resolve(message.result);
});

/**
 * @param {string} method
 * @param {Record<string, unknown>} [payload]
 * @returns {Promise<any>}
 */
function send(method, payload = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params: payload }));
  });
}

try {
  if (command === 'call') {
    const [method, json = '{}'] = params;
    if (!method) throw new Error('call needs a method');
    const text = json.startsWith('@') ? fs.readFileSync(json.slice(1), 'utf8') : json;
    console.log(JSON.stringify(await send(method, JSON.parse(text)), null, 2));
  } else if (command === 'eval') {
    const [file] = params;
    if (!file) throw new Error('eval needs a script file');
    const viewportWidth = Number(flags.width ?? 0);
    if (viewportWidth > 0) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: viewportWidth,
        height: Number(flags.height ?? 800),
        deviceScaleFactor: Number(flags.dpr ?? 1),
        mobile: viewportWidth < 600,
      });
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
    const result = await send('Runtime.evaluate', {
      expression: fs.readFileSync(file, 'utf8'),
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description ?? result.exceptionDetails.text,
      );
    }
    console.log(JSON.stringify(result.result.value, null, 2));
  } else if (command === 'shot') {
    const [out] = params;
    if (!out) throw new Error('shot needs an output path');
    const width = Number(flags.width ?? 1280);
    const height = Number(flags.height ?? 900);
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: Number(flags.dpr ?? 1),
      mobile: width < 600,
    });
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
    console.log(out);
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
} finally {
  socket.close();
}
