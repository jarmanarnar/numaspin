import assert from 'node:assert/strict';
import test from 'node:test';
import { bootApplication } from '../public/bootstrap.js';

const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
const settle = () => new Promise(resolve => setImmediate(resolve));

function startup({ fonts = Promise.resolve(), fontLoad = Promise.resolve(), artwork = Promise.resolve(), minimum = Promise.resolve(), load, initialize, geometry = () => 0 } = {}) {
  const calls = [], logoCalls = [], timers = new Map(), frames = new Map();
  let timerId = 0, frameId = 0, now = 0, revealedAt;
  const element = () => ({
    getClientRects: () => [{}],
    getBoundingClientRect: () => ({ x: geometry(now), y: 0, width: 320, height: 400 }),
  });
  const nodes = {
    'app-loader': { hidden: false },
    'app-load-status': { className: 'visually-hidden', textContent: 'Loading NUMA SPIN…' },
    'app-load-retry': { hidden: true, addEventListener(type, action) { this[type] = action; } },
  };
  const pageImage = { ...element(), loading: 'lazy', decode: () => artwork };
  const closedDialogImage = { getClientRects: () => [], decode() { throw new Error('Hidden dialog image should not be loaded'); } };
  const doc = {
    body: { ...element(), dataset: { appState: 'loading', appStarting: 'true' } },
    fonts: { ready: fonts, load: () => fontLoad }, images: [pageImage, closedDialogImage],
    querySelector: selector => nodes[selector.slice(1)],
    querySelectorAll: () => [element()],
  };
  const scope = {
    location: { reload() { calls.push('reload'); } },
    console: { error() { calls.push('error'); } },
    setTimeout(action, delay) { timers.set(++timerId, { action, delay }); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    requestAnimationFrame(action) {
      assert.equal(doc.body.dataset.appStarting, 'true', 'startup motion stays disabled through reveal');
      if (doc.body.dataset.appState === 'ready') revealedAt ??= now;
      const id = ++frameId;
      frames.set(id, action);
      queueMicrotask(() => { if (frames.delete(id)) { now += 16; action(now); } });
      return id;
    },
    cancelAnimationFrame(id) { frames.delete(id); },
  };
  const ready = bootApplication({ document: doc, window: scope,
    createLogo(options) {
      assert.equal(options.document, doc);
      assert.equal(options.window, scope);
      logoCalls.push('start');
      return { minimum, stop() { logoCalls.push('stop'); } };
    },
    load: () => {
      assert.deepEqual(logoCalls, ['start'], 'the loader starts before application imports and initialization');
      return load ? load() : Promise.resolve({
        initApplication() {
          calls.push('initialize');
          initialize?.();
          return {
            prepareLayout() { calls.push('prepare-layout'); },
            restoreInitialScroll() { calls.push('restore-scroll'); },
          };
        },
      });
    },
  });
  return { doc, nodes, calls, logoCalls, timers, pageImage, ready,
    elapse(milliseconds) { now += milliseconds; },
    get revealedAt() { return revealedAt; } };
}

test('startup waits for every rendered page image, font readiness and settled layout', async () => {
  const fonts = deferred(), artwork = deferred();
  const page = startup({ fonts: fonts.promise, artwork: artwork.promise });
  await settle();
  assert.deepEqual(page.calls, ['initialize']);
  assert.equal(page.pageImage.loading, 'eager', 'lazy page artwork starts loading behind the loader');
  fonts.resolve(); await settle();
  assert.equal(page.doc.body.dataset.appState, 'loading');
  assert.equal(page.nodes['app-loader'].hidden, false);
  artwork.resolve();
  assert.equal(await page.ready, true);
  assert.deepEqual(page.calls, ['initialize', 'prepare-layout', 'restore-scroll']);
  assert.equal(page.doc.body.dataset.appState, 'ready');
  assert.equal(page.doc.body.dataset.appStarting, undefined);
  assert.equal(page.nodes['app-loader'].hidden, true);
  assert.ok(page.revealedAt >= 200);
  assert.equal(page.timers.size, 0);
  assert.deepEqual(page.logoCalls, ['start', 'stop']);
});

test('ready assets reveal the page without waiting for any animation cycle or legacy minimum', async () => {
  const page = startup({ minimum: new Promise(() => {}) });
  assert.equal(await page.ready, true);
  assert.equal(page.nodes['app-loader'].hidden, true);
  assert.equal(page.doc.body.dataset.appState, 'ready');
  assert.ok(page.revealedAt >= 200 && page.revealedAt < 1000);
  assert.equal(page.timers.size, 0);
  assert.deepEqual(page.logoCalls, ['start', 'stop']);
});

test('elapsed animation time never reveals assets that are still loading', async () => {
  const artwork = deferred();
  const page = startup({ artwork: artwork.promise, minimum: new Promise(() => {}) });
  await settle();
  page.elapse(10_000);
  await settle();
  assert.equal(page.doc.body.dataset.appState, 'loading');
  assert.equal(page.nodes['app-loader'].hidden, false);
  artwork.resolve();
  assert.equal(await page.ready, true);
  assert.equal(page.nodes['app-loader'].hidden, true);
  assert.deepEqual(page.logoCalls, ['start', 'stop']);
});

test('the real header font loads before the first wallet measurement', async () => {
  const fontLoad = deferred();
  const page = startup({ fontLoad: fontLoad.promise });
  await settle();
  assert.deepEqual(page.calls, []);
  assert.equal(page.doc.body.dataset.appState, 'loading');
  fontLoad.resolve();
  assert.equal(await page.ready, true);
});

test('account initialization completes before page assets, layout and reveal; persistence errors keep retry available', async () => {
  const account = deferred();
  const page = startup({ load: () => Promise.resolve({ initApplication: () => account.promise }) });
  await settle();
  assert.equal(page.doc.body.dataset.appState, 'loading');
  assert.equal(page.nodes['app-loader'].hidden, false);
  account.resolve({ prepareLayout() {}, restoreInitialScroll() {} });
  assert.equal(await page.ready, true);
  const failed = startup({ load: () => Promise.resolve({ initApplication: () => Promise.reject(new Error('Storage unavailable')) }) });
  assert.equal(await failed.ready, false);
  assert.equal(failed.nodes['app-load-retry'].hidden, false);
  assert.equal(failed.nodes['app-loader'].hidden, false);
});

test('a late layout change restarts the stability interval instead of slipping past a two-frame wait', async () => {
  const page = startup({ geometry: time => time < 96 ? 0 : 160 });
  assert.equal(await page.ready, true);
  assert.ok(page.revealedAt >= 296, 'all movement must finish before a full quiet interval is observed');
});

test('failed page images stop loader motion and offer retry immediately', async () => {
  const page = startup({ artwork: Promise.reject(new Error('Image unavailable')), minimum: new Promise(() => {}) });
  assert.equal(await page.ready, false);
  assert.equal(page.doc.body.dataset.appState, 'error');
  assert.equal(page.nodes['app-loader'].hidden, false);
  assert.equal(page.nodes['app-load-retry'].hidden, false);
  assert.deepEqual(page.logoCalls, ['start', 'stop']);
  assert.equal(page.timers.size, 0);
});

test('unresponsive page assets never reveal a partially loaded page on a timer', async () => {
  const page = startup({ artwork: new Promise(() => {}), minimum: new Promise(() => {}) });
  await settle();
  assert.equal(page.doc.body.dataset.appState, 'loading');
  assert.equal(page.nodes['app-loader'].hidden, false);
  [...page.timers.values()].find(timer => timer.delay === 15_000).action();
  assert.equal(await page.ready, false);
  assert.equal(page.doc.body.dataset.appState, 'error');
  assert.equal(page.nodes['app-loader'].hidden, false);
  assert.equal(page.timers.size, 0);
  assert.deepEqual(page.logoCalls, ['start', 'stop']);
});

test('failed imports and initialization failures expose a working retry', async () => {
  for (const options of [
    { load: () => Promise.reject(new Error('Module unavailable')) },
    { initialize() { throw new Error('Initialization failed'); } },
  ]) {
    const page = startup({ ...options, minimum: new Promise(() => {}) });
    assert.equal(await page.ready, false);
    assert.equal(page.doc.body.dataset.appState, 'error');
    assert.equal(page.nodes['app-load-retry'].hidden, false);
    page.nodes['app-load-retry'].click();
    assert.equal(page.calls.at(-1), 'reload');
    assert.equal(page.timers.size, 0);
    assert.deepEqual(page.logoCalls, ['start', 'stop']);
  }
});

test('an unresponsive application import reaches a covered, recoverable error state', async () => {
  const page = startup({ load: () => new Promise(() => {}), minimum: new Promise(() => {}) });
  [...page.timers.values()].find(timer => timer.delay === 15_000).action();
  assert.equal(await page.ready, false);
  assert.equal(page.doc.body.dataset.appState, 'error');
  assert.equal(page.calls.includes('initialize'), false);
  assert.equal(page.timers.size, 0);
  assert.deepEqual(page.logoCalls, ['start', 'stop']);
});
