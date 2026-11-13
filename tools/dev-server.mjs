// @ts-check
/**
 * Zero-dependency static dev server for local testing.
 *
 * ES modules cannot be loaded from file:// URLs, so this serves the repo
 * over http://localhost. Not used in production (GitHub Pages serves statics).
 *
 * Usage: node tools/dev-server.mjs [port]
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';

const ROOT = resolve(process.cwd());
const PORT = Number(process.argv[2] || process.env.PORT || 5173);

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
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(body);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';

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
    });
    res.end(data);
  } catch {
    sendText(res, 404, 'Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Palette Foundry dev server: http://localhost:${PORT}/`);
  console.log(`Serving ${ROOT}`);
});
