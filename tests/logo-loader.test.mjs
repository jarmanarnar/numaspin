import assert from 'node:assert/strict';
import test from 'node:test';
import { initLogoLoader, LOGO_MOTION } from '../public/logo-loader.js';

function setup({ reduced = false, hidden = false } = {}) {
  const frames = new Map();
  let frameId = 0;
  function emitter() {
    const listeners = new Map();
    return {
      listeners,
      addEventListener(type, listener) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(listener);
      },
      removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
      emit(type) { for (const listener of listeners.get(type) || []) listener(); },
    };
  }
  const brand = { dataset: {} };
  const doc = {
    ...emitter(), body: { dataset: {} }, hidden,
    querySelector(selector) {
      assert.equal(selector, '#app-loader-brand');
      return brand;
    },
    createElement() { throw new Error('The lightweight loader must not allocate canvases or decode images'); },
  };
  const motion = { ...emitter(), matches: reduced };
  const scope = {
    matchMedia(query) { assert.equal(query, '(prefers-reduced-motion: reduce)'); return motion; },
    setTimeout() { throw new Error('Loader motion must not schedule a minimum-duration timer'); },
    requestAnimationFrame(action) { frames.set(++frameId, action); return frameId; },
    cancelAnimationFrame(id) { frames.delete(id); },
  };
  const controller = initLogoLoader({ document: doc, window: scope });
  return { controller, brand, doc, motion, frames,
    paint() { const pending = [...frames.values()]; frames.clear(); pending.forEach(action => action()); },
  };
}
function assertStopped(page) {
  assert.equal(page.frames.size, 0);
  assert.equal(page.brand.dataset.paused, 'true');
  assert.equal([...page.doc.listeners.values()].some(listeners => listeners.size), false);
  assert.equal([...page.motion.listeners.values()].some(listeners => listeners.size), false);
}

test('inline animation has no cycle count or readiness promise and can stop on its first paint', () => {
  assert.deepEqual(LOGO_MOTION, { duration: 1800 });
  const page = setup();
  assert.equal('minimum' in page.controller, false);
  page.paint();
  assert.equal(page.brand.dataset.paused, 'false');
  page.controller.stop();
  assertStopped(page);
});

test('hidden tabs pause motion and resume without starting a countdown', () => {
  const page = setup();
  page.paint();
  page.doc.hidden = true; page.doc.emit('visibilitychange');
  assert.equal(page.brand.dataset.paused, 'true');
  assert.equal(page.frames.size, 0);
  page.doc.hidden = false; page.doc.emit('visibilitychange'); page.paint();
  assert.equal(page.brand.dataset.paused, 'false');
  page.controller.stop();
  assertStopped(page);
});

test('a background page can stop before any visible animation is painted', () => {
  const page = setup({ hidden: true });
  assert.equal(page.frames.size, 0);
  page.controller.stop();
  assertStopped(page);
});

test('reduced motion keeps a static wordmark without a display-duration timer', () => {
  const page = setup({ reduced: true });
  page.paint();
  assert.equal(page.brand.dataset.reduced, 'true');
  assert.equal(page.brand.dataset.paused, 'true');
  page.controller.stop();
  assertStopped(page);
});

test('OS and saved preferences still control animation independently of loading', () => {
  const page = setup();
  page.paint();
  page.motion.matches = true; page.motion.emit('change'); page.paint();
  assert.equal(page.brand.dataset.reduced, 'true');
  page.doc.body.dataset.reduceMotion = 'true';
  page.motion.matches = false; page.motion.emit('change'); page.paint();
  assert.equal(page.brand.dataset.paused, 'true');
  page.doc.body.dataset.reduceMotion = 'false'; page.doc.emit('loop:preferences-change'); page.paint();
  assert.equal(page.brand.dataset.reduced, 'false');
  assert.equal(page.brand.dataset.paused, 'false');
  page.controller.stop();
  assertStopped(page);
});

test('stopping cancels a pending paint and detaches every animation listener', () => {
  const page = setup();
  page.controller.stop();
  assertStopped(page);
  page.doc.hidden = false; page.doc.emit('visibilitychange');
  page.motion.emit('change'); page.doc.emit('loop:preferences-change'); page.paint();
  page.controller.stop();
  assertStopped(page);
});
