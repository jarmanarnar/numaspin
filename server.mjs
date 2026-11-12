import http from 'node:http';
import { watch } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const publicRoot = fileURLToPath(new URL('./public/', import.meta.url));
const basePath = '/luckyloopcasino/';
const types = new Map(Object.entries({
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2',
}));

function previewScript(revision) {
  return [
    '<script>',
    'async function checkPreview() {',
    '  try {',
    '    const response = await fetch("./__reload", { cache: "no-store" });',
    '    if (response.ok && await response.text() !== "' + revision + '") {',
    '      location.reload();',
    '      return;',
    '    }',
    '  } catch {',
    '    // Retry after a temporary preview connection failure.',
    '  }',
    '  setTimeout(checkPreview, 1000);',
    '}',
    'setTimeout(checkPreview, 1000);',
    '</script>',
  ].join('\n');
}

export function createAppServer({ liveReload = false } = {}) {
  let revision = Date.now();
  const watcher = liveReload ? watch(publicRoot, { recursive: true }, () => { revision += 1; }) : null;
  const server = http.createServer(async (request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    let url, pathname;
    try {
      url = new URL(request.url, 'http://localhost');
      pathname = decodeURIComponent(url.pathname);
    } catch {
      response.writeHead(400).end('Invalid path');
      return;
    }
    if (pathname === '/favicon.ico') { response.writeHead(204).end(); return; }
    const redirect = destination => response.writeHead(308, {
      Location: destination + url.search, 'Cache-Control': 'no-store',
    }).end();
    if (['/', '/index.html', '/luckyloopcasino', `${basePath}index.html`,
      '/atomic-design', '/atomic-design/', '/atomic-design/index.html',
      '/luckyloop-casino', '/luckyloop-casino/', '/luckyloop-casino/index.html'].includes(pathname)) {
      redirect(basePath);
      return;
    }
    const legacyPath = ['/atomic-design/', '/luckyloop-casino/'].find(prefix => pathname.startsWith(prefix));
    if (legacyPath) {
      redirect(basePath + pathname.slice(legacyPath.length));
      return;
    }
    if (!pathname.startsWith(basePath)) { response.writeHead(404).end('Not found'); return; }
    const relative = pathname.slice(basePath.length) || 'index.html';
    if (liveReload && relative === '__reload') {
      response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(request.method === 'HEAD' ? undefined : String(revision));
      return;
    }
    const target = path.resolve(publicRoot, relative);
    const relativeTarget = path.relative(publicRoot, target);
    const type = types.get(path.extname(target).toLowerCase());
    if (relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget) || !type) {
      response.writeHead(404).end('Not found');
      return;
    }
    try {
      if (!(await stat(target)).isFile()) throw new Error('Not a file');
      let body = await readFile(target);
      if (liveReload && request.method === 'GET' && relative === 'index.html') {
        body = body.toString('utf8').replace('</body>', previewScript(revision) + '\n</body>');
      }
      response.writeHead(200, {
        'Content-Type': type, 'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch { response.writeHead(404).end('Not found'); }
  });
  server.once('close', () => watcher?.close());
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createAppServer({ liveReload: process.argv.includes('--live-reload') });
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(Number(process.env.PORT || 4320), '127.0.0.1', () => {
    console.log(`NUMA SPIN: http://127.0.0.1:${server.address().port}${basePath}`);
  });
}
