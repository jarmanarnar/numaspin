import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createAppServer } from '../server.mjs';

let server, origin;
before(async () => {
  server = createAppServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
});

test('canonical page serves NUMA SPIN branding and local styles', async () => {
  const response = await fetch(`${origin}/luckyloopcasino/`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>NUMA SPIN<\/title>/);
  assert.match(html, /href="styles.css"/);
  assert.match(html, /href="wallet.css"/);
  assert.match(html, /src="bootstrap.js"/);
  assert.doesNotMatch(html, /<style>/);
});

test('root and old entry links redirect to the branded path with query intact', async () => {
  for (const entry of ['/', '/atomic-design/', '/atomic-design/index.html', '/luckyloopcasino',
    '/luckyloop-casino', '/luckyloop-casino/', '/luckyloop-casino/index.html']) {
    const response = await fetch(`${origin}${entry}?review=1`, { redirect: 'manual' });
    assert.equal(response.status, 308);
    assert.equal(response.headers.get('location'), '/luckyloopcasino/?review=1');
  }
});

test('legacy asset links point at the same current app', async () => {
  for (const entry of ['/atomic-design/app.js', '/luckyloop-casino/app.js']) {
    const response = await fetch(origin + entry, { redirect: 'manual' });
    assert.equal(response.status, 308);
    assert.equal(response.headers.get('location'), '/luckyloopcasino/app.js');
  }
});

test('scripts, styles, fonts, provider marks and promotional artwork have correct types', async () => {
  for (const [file, type] of [['bootstrap.js', 'text/javascript'], ['app.js', 'text/javascript'], ['styles.css', 'text/css'],
    ['assets/providers/netent.svg', 'image/svg+xml'], ['assets/hero/picks-art.webp', 'image/webp'],
    ['assets/fonts/arimo-bold-latin.woff2', 'font/woff2']]) {
    const response = await fetch(`${origin}/luckyloopcasino/${file}`);
    assert.equal(response.status, 200);
    assert.ok(response.headers.get('content-type').startsWith(type));
    assert.equal(response.headers.get('cache-control'), 'no-store');
    if (type === 'font/woff2') {
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.equal(bytes.subarray(0, 4).toString(), 'wOF2');
    }
  }
  const response = await fetch(`${origin}/luckyloopcasino/app.js`, { method: 'HEAD' });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), '');
});

test('private files, archives and the rejected mobile preview are not served', async () => {
  for (const route of ['/package.json', '/.git/config', '/crown/', '/artifacts/',
    '/luckyloopcasino/preview/', '/luckyloopcasino/..%2fpackage.json',
    '/luckyloopcasino/%2e%2e%5cpackage.json']) {
    const response = await fetch(origin + route);
    assert.equal(response.status, 404, route);
  }
});

test('unsupported mutations are rejected', async () => {
  const response = await fetch(`${origin}/luckyloopcasino/`, { method: 'POST' });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET, HEAD');
});
