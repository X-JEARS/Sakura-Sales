import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../public', import.meta.url)));
const port = Number(process.env.PORT || 8765);
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

async function existingFile(pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return null; }
  const candidate = resolve(root, `.${decoded}`);
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) return null;
  try { return (await stat(candidate)).isFile() ? candidate : null; } catch { return null; }
}

createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method || '')) {
    response.writeHead(404).end('Not found');
    return;
  }

  const url = new URL(request.url || '/', 'http://localhost');
  const requested = await existingFile(url.pathname === '/' ? '/index.html' : url.pathname);
  const file = requested || resolve(root, 'index.html');
  response.setHeader('Content-Type', contentTypes[extname(file)] || 'application/octet-stream');
  response.writeHead(200);
  if (request.method === 'HEAD') response.end();
  else createReadStream(file).pipe(response);
}).listen(port, '127.0.0.1', () => {
  console.log(`Local preview: http://127.0.0.1:${port}`);
});
