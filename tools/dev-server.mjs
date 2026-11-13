// @ts-check
/**
 * Zero-dependency static dev server for local testing.
 *
 * ES modules cannot be loaded from file:// URLs, so this serves the repo over HTTP.
 * It binds to all interfaces by default so a phone on the same network can open it;
 * pass `--host=localhost` to keep it loopback-only.
 *
 * Usage:
 *   node tools/dev-server.mjs [port] [--host=0.0.0.0]
 *
 * Not used in production (GitHub Pages serves statics).
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';

const ROOT = resolve(process.cwd());

let portArg = '';
let hostArg = '';
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--host=')) hostArg = arg.slice('--host='.length);
  else if (!portArg) portArg = arg;
}

const PORT = Number(portArg || process.env.PORT || 5173);
const HOST = hostArg || process.env.PEIQ_HOST || '0.0.0.0';

const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.bmp', 'image/bmp'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.md', 'text/markdown; charset=utf-8'],
  ['.woff2', 'font/woff2'],
]);

/**
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {string} body
 */
function sendText(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';

  // Do not expose .git or other dotfiles when the server is reachable from the LAN.
  if (pathname.split('/').some((segment) => segment.startsWith('.'))) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  const filePath = resolve(join(ROOT, pathname));
  if (filePath !== ROOT && !filePath.startsWith(ROOT + sep)) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) {
      sendText(res, 404, 'Not found');
      return;
    }

    const data = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME.get(extname(filePath).toLowerCase()) || 'application/octet-stream',
      'Content-Length': data.byteLength,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(data);
  } catch {
    sendText(res, 404, 'Not found');
  }
});

/**
 * IPv4 addresses a phone on the same network can use.
 * @returns {string[]}
 */
function lanAddresses() {
  /** @type {string[]} */
  const addresses = [];
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      const ipv4 = entry.family === 'IPv4' || entry.family === 4;
      if (ipv4 && !entry.internal) addresses.push(entry.address);
    }
  }
  return addresses;
}

server.listen(PORT, HOST, () => {
  const allInterfaces = HOST === '0.0.0.0' || HOST === '::';
  console.log('PaletteExtractorAndImageQuantizer dev server');
  console.log(`  Local:   http://localhost:${PORT}/`);
  if (allInterfaces) {
    const addresses = lanAddresses();
    if (addresses.length === 0) {
      console.log('  Network: no external IPv4 interface found');
    }
    for (const address of addresses) {
      console.log(`  Network: http://${address}:${PORT}/`);
    }
    console.log('');
    console.log('Open a Network URL on a phone or tablet on the same Wi-Fi.');
    console.log('Allow Node.js on private networks if the firewall asks.');
  } else {
    console.log(`  Bound to ${HOST}; loopback-only if that is a local address.`);
  }
  console.log(`Serving ${ROOT}`);
});
