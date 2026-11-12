import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = (await readFile(new URL('../public/hero-carousel.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\r?\n/gm, '').replace('export function initHeroCarousel', 'function initHeroCarousel');

function heroPage({ reduced = false, intersection = true, starting = false } = {}) {
  const calls = [], timers = new Map(), mutations = [], intersections = [], animations = [], providerCalls = [];
  let timerId = 0, selected = 0, modal = false, factories = 0, now = 0;
  const document = { body: { dataset: { view: 'lobby' } }, hidden: false, activeElement: null };
  if (starting) Object.assign(document.body.dataset, { appState: 'loading', appStarting: 'true' });
  class Node {
    constructor() { this.dataset = {}; this.style = {}; this.attributes = new Map(); this.listeners = new Map(); this.children = []; this.hidden = false; this.disabled = false; this.textContent = ''; }
    append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
    replaceChildren() { this.children = []; }
    setAttribute(name, value) { this.attributes.set(name, value); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    addEventListener(type, callback) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(callback);
    }
    emit(type, details = {}) {
      const event = { target: this, defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; }, ...details };
      for (const callback of this.listeners.get(type) || []) callback(event);
      return event;
    }
    click() {
      if (this.disabled) return;
      const event = this.emit('click');
      for (let node = this.parent; node; node = node.parent) node.emit('click', event);
    }
    contains(node) { for (let next = node; next; next = next.parent) if (next === this) return true; return false; }
    closest(selector) {
      const properties = {
        '[data-hero-index]': ['heroIndex'],
        '[data-hero-category], [data-hero-feature]': ['heroCategory', 'heroFeature'],
      }[selector];
      if (!properties) throw new Error(`Unexpected selector: ${selector}`);
      return properties.some(property => Object.hasOwn(this.dataset, property)) ? this : this.parent?.closest(selector) || null;
    }
    scrollIntoView(options) { calls.push({ action: 'scroll-results', options }); }
    focus(options) { document.activeElement = this; calls.push({ action: 'focus-results', options }); }
    animate(keyframes, options) {
      let currentTime = 0, startedAt = now, playState = 'running';
      const animation = {
        target: this, keyframes, options,
        get currentTime() { return playState === 'running' ? Math.min(options.duration, currentTime + now - startedAt) : currentTime; },
        set currentTime(value) { currentTime = value; startedAt = now; },
        get playState() { return playState; },
        play() { startedAt = now; playState = 'running'; },
        pause() { currentTime = this.currentTime; playState = 'paused'; },
        cancel() { currentTime = null; playState = 'idle'; },
      };
      animations.push(animation);
      return animation;
    }
  }
  const ids = ['hero-carousel', 'hero-viewport', 'hero-track', 'hero-dots',
    'hero-status', 'hero-controls', 'catalog-categories', 'catalog-shelves'];
  const nodes = Object.fromEntries(ids.map(id => [id, new Node()]));
  const root = nodes['hero-carousel'];
  root.append(nodes['hero-viewport'], nodes['hero-controls']);
  nodes['hero-viewport'].append(nodes['hero-track']);
  nodes['hero-controls'].append(nodes['hero-dots']);
  nodes['hero-controls'].hidden = true;
  const slides = [
    ["Editor's Picks", { heroCategory: 'picks' }],
    ['Slots', { heroCategory: 'slots' }],
    ['Tap Games', { heroCategory: 'tap' }],
    ['Daily Bonus', { heroFeature: 'daily-bonus' }],
    ['VIP Tiers', { heroFeature: 'vip-club' }],
  ].map(([title, destination]) => {
    const slide = new Node(), cta = new Node();
    slide.dataset.heroTitle = title;
    Object.assign(cta.dataset, destination);
    slide.append(cta);
    nodes['hero-track'].append(slide);
    return slide;
  });
  nodes['hero-track'].querySelectorAll = selector => { assert.equal(selector, '.hero-carousel__slide'); return slides; };
  const firstShelf = new Node();
  nodes['catalog-shelves'].querySelector = selector => { assert.equal(selector, '.game-shelf'); return firstShelf; };
  let provider = 'netent', category = 'all';
  nodes['catalog-categories'].dataset.activeMenu = 'all';
  const categoryButtons = Object.fromEntries(['all', 'picks', 'tap', 'slots'].map(id => {
    const button = new Node();
    button.dataset.category = id;
    button.setAttribute('aria-pressed', String(id === 'all'));
    button.addEventListener('click', () => {
      calls.push({ action: 'category', id });
      if (id === 'all') provider = '';
      category = id;
      nodes['catalog-categories'].dataset.activeMenu = id;
      for (const [candidate, node] of Object.entries(categoryButtons)) node.setAttribute('aria-pressed', String(candidate === id));
    });
    return [id, button];
  }));
  nodes['catalog-categories'].querySelector = selector => categoryButtons[selector.match(/^\[data-category="([^"]+)"\]$/)?.[1]] || null;
  const listeners = new Map();
  const emit = type => { for (const callback of listeners.get(type) || []) callback(api, type); };
  const slideCount = slides.length;
  const api = {
    selectedScrollSnap: () => selected,
    scrollSnapList: () => [...slides.keys()],
    on(type, callback) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(callback); return api; },
    scrollTo(index, jump) { calls.push({ action: 'scrollTo', index, jump }); selected = ((index % slideCount) + slideCount) % slideCount; emit('select'); },
    scrollNext(jump) { calls.push({ action: 'scrollNext', jump }); selected = (selected + 1) % slideCount; emit('select'); },
    scrollPrev(jump) { calls.push({ action: 'scrollPrev', jump }); selected = (selected + slideCount - 1) % slideCount; emit('select'); },
  };
  const motion = new Node(); motion.matches = reduced;
  const window = new Node();
  window.matchMedia = query => { assert.equal(query, '(prefers-reduced-motion: reduce)'); return motion; };
  window.performance = { now: () => now };
  window.setTimeout = (callback, duration) => { const id = ++timerId; timers.set(id, { callback, duration, due: now + duration }); return id; };
  window.clearTimeout = id => timers.delete(id);
  class Observer {
    constructor(callback) { this.callback = callback; this.targets = []; }
    observe(node, options) { this.targets.push({ node, options }); }
    disconnect() { this.disconnected = true; }
  }
  class MutationObserver extends Observer { constructor(callback) { super(callback); mutations.push(this); } }
  class IntersectionObserver extends Observer { constructor(callback) { super(callback); intersections.push(this); } }
  if (intersection) window.IntersectionObserver = IntersectionObserver;
  const documentEvents = new Node();
  document.addEventListener = documentEvents.addEventListener.bind(documentEvents);
  document.querySelector = selector => selector === 'dialog[open]' ? (modal ? new Node() : null) : nodes[selector.slice(1)] || null;
  document.createElement = () => new Node();
  const catalog = {
    openHome() { provider = ''; category = 'all'; calls.push({ action: 'navigate', id: 'all' }); },
    openCategory(id) { provider = ''; category = id; calls.push({ action: 'navigate', id }); },
    openFeature(id) { calls.push({ action: 'feature', id }); },
    openProviders(options) {
      providerCalls.push(options);
      calls.push({ action: 'navigate', id: 'providers' });
      provider = '';
      category = 'providers';
      nodes['catalog-categories'].dataset.activeMenu = 'providers';
      for (const button of Object.values(categoryButtons)) button.setAttribute('aria-pressed', 'false');
    },
  };
  const context = { document, window, Element: Node, MutationObserver, IntersectionObserver,
    catalog,
    EmblaCarousel(viewport, options) { factories++; assert.equal(viewport, nodes['hero-viewport']); calls.push({ action: 'init', options }); return api; } };
  vm.runInNewContext(`${source}\ninitHeroCarousel(catalog);`, context);
  return {
    nodes, slides, calls, timers, api, document, firstShelf, categoryButtons, motion, window, mutations, intersections, animations, context, providerCalls,
    get factories() { return factories; }, get provider() { return provider; }, get category() { return category; },
    visible(value = true) { intersections[0]?.callback([{ target: root, isIntersecting: value }]); },
    elapse(duration) { now += duration; },
    fireTimer() { assert.equal(timers.size, 1); const [id, timer] = timers.entries().next().value; now = Math.max(now, timer.due); timers.delete(id); timer.callback(); },
    select(index) { selected = index; emit('select'); }, emit,
    modal(value) { modal = value; mutations[0].callback(); },
    visibility(value) { document.hidden = value; documentEvents.emit('visibilitychange'); },
    preferenceMotion(value) { document.body.dataset.reduceMotion = String(value); documentEvents.emit('loop:preferences-change'); },
  };
}

test('banner autoplay waits until the loader and first revealed paint finish', () => {
  const page = heroPage({ starting: true });
  page.visible();
  assert.equal(page.timers.size, 0);
  assert.equal(page.animations.some(animation => animation.playState === 'running'), false);
  page.document.body.dataset.appState = 'ready'; page.mutations[0].callback();
  assert.equal(page.timers.size, 0, 'the first revealed paint remains still');
  delete page.document.body.dataset.appStarting; page.mutations[0].callback();
  assert.equal(page.timers.size, 1);
  assert.equal([...page.timers.values()][0].duration, 6000);
});

test('initializes once, reveals controls, and labels the five promotions with one selected dot', () => {
  const page = heroPage();
  page.context.initHeroCarousel();
  assert.equal(page.factories, 1);
  assert.equal(page.calls[0].options.loop, true);
  assert.equal(page.nodes['hero-carousel'].dataset.ready, 'true');
  assert.equal(page.nodes['hero-controls'].hidden, false);
  const dots = page.nodes['hero-dots'].children;
  assert.equal(dots.length, 5);
  assert.equal(dots[0].getAttribute('aria-label'), "Show promotion 1: Editor's Picks");
  assert.deepEqual(dots.map(dot => dot.getAttribute('aria-pressed')), ['true', 'false', 'false', 'false', 'false']);
  assert.equal(page.slides[4].getAttribute('aria-label'), '5 of 5: VIP Tiers');
  assert.equal(page.nodes['hero-status'].textContent, '');
  assert.equal(page.timers.size, 0, 'intersection must confirm visibility before autoplay');
});

test('saved site motion preference pauses autoplay and fill without overriding the operating-system preference', () => {
  const page = heroPage(); page.visible();
  assert.equal(page.timers.size, 1);
  page.preferenceMotion(true);
  assert.equal(page.timers.size, 0);
  assert.equal(page.animations.filter(animation => animation.playState === 'running').length, 0);
  page.nodes['hero-viewport'].emit('keydown', { key: 'ArrowRight' });
  assert.equal(page.calls.at(-1).jump, true);
  page.preferenceMotion(false);
  assert.equal(page.timers.size, 1);
  page.motion.matches = true; page.motion.emit('change');
  page.preferenceMotion(false);
  assert.equal(page.timers.size, 0);
});

test('dots and viewport keys navigate through the loop and announce only manual changes', () => {
  const page = heroPage();
  page.nodes['hero-viewport'].emit('keydown', { key: 'ArrowLeft' });
  assert.equal(page.nodes['hero-dots'].children[4].getAttribute('aria-pressed'), 'true');
  assert.match(page.nodes['hero-status'].textContent, /Promotion 5 of 5: VIP Tiers/);
  page.nodes['hero-viewport'].emit('keydown', { key: 'ArrowRight' });
  assert.equal(page.nodes['hero-dots'].children[0].getAttribute('aria-pressed'), 'true');
  page.nodes['hero-dots'].children[2].children[0].click();
  assert.equal(page.nodes['hero-dots'].children[2].getAttribute('aria-pressed'), 'true');
  const key = page.nodes['hero-viewport'].emit('keydown', { key: 'ArrowRight' });
  assert.equal(key.defaultPrevented, true);
  assert.match(page.nodes['hero-status'].textContent, /Promotion 4 of 5: Daily Bonus/);
  const before = page.calls.length;
  assert.equal(page.nodes['hero-viewport'].emit('keydown', { key: 'ArrowLeft', altKey: true }).defaultPrevented, false);
  assert.equal(page.calls.length, before);
});

test('one six-second timer rotates without live announcements and stops for game, modal, hidden, and offscreen states', () => {
  const page = heroPage();
  page.visible();
  assert.equal([...page.timers.values()][0].duration, 6000);
  page.fireTimer();
  assert.equal(page.nodes['hero-dots'].children[1].getAttribute('aria-pressed'), 'true');
  assert.equal(page.nodes['hero-status'].textContent, '');
  assert.equal(page.timers.size, 1);
  page.select(4); page.fireTimer();
  assert.equal(page.nodes['hero-dots'].children[0].getAttribute('aria-pressed'), 'true');
  assert.equal(page.nodes['hero-status'].textContent, '');
  page.document.body.dataset.view = 'game'; page.mutations[0].callback();
  assert.equal(page.timers.size, 0);
  page.document.body.dataset.view = 'lobby'; page.mutations[0].callback();
  assert.equal(page.timers.size, 1);
  page.modal(true); assert.equal(page.timers.size, 0);
  page.modal(false); assert.equal(page.timers.size, 1);
  page.visibility(true); assert.equal(page.timers.size, 0);
  page.visibility(false); assert.equal(page.timers.size, 1);
  page.visible(false); assert.equal(page.timers.size, 0);
  page.visible(); assert.equal(page.timers.size, 1);
});

test('hover, focus, and dragging suspend rotation until all temporary pause states clear', () => {
  const page = heroPage(); page.visible();
  const root = page.nodes['hero-carousel'];
  root.emit('pointerenter', { pointerType: 'mouse' }); assert.equal(page.timers.size, 0);
  root.emit('pointerleave'); assert.equal(page.timers.size, 1);
  root.emit('pointerenter', { pointerType: 'touch' }); assert.equal(page.timers.size, 1);
  root.emit('focusin'); assert.equal(page.timers.size, 0);
  root.emit('focusout', { relatedTarget: page.nodes['hero-dots'].children[0] }); assert.equal(page.timers.size, 0);
  root.emit('focusout', { relatedTarget: null }); assert.equal(page.timers.size, 1);
  page.emit('pointerDown'); assert.equal(page.timers.size, 0);
  page.select(2); assert.equal(page.timers.size, 0);
  page.emit('pointerUp'); assert.equal(page.timers.size, 1);
  assert.match(page.nodes['hero-status'].textContent, /Tap Games/);
  root.emit('pointerenter', { pointerType: 'mouse' }); root.emit('focusin');
  root.emit('pointerleave'); assert.equal(page.timers.size, 0);
  root.emit('focusout', { relatedTarget: null }); assert.equal(page.timers.size, 1);
});

test('a tap without a slide change does not make a later autoplay movement announce', () => {
  const page = heroPage(); page.visible();
  page.emit('pointerDown'); page.emit('pointerUp'); page.emit('settle');
  page.fireTimer(); page.emit('settle');
  assert.equal(page.nodes['hero-status'].textContent, '');
});

test('reduced motion disables autoplay, jumps manual navigation, and updates without a page reload', () => {
  const page = heroPage({ reduced: true }); page.visible();
  assert.equal(page.timers.size, 0);
  page.nodes['hero-viewport'].emit('keydown', { key: 'ArrowRight' });
  assert.equal(page.calls.find(call => call.action === 'scrollNext').jump, true);
  page.motion.matches = false; page.motion.emit('change');
  assert.equal(page.timers.size, 1);
  page.nodes['hero-viewport'].emit('keydown', { key: 'ArrowRight' });
  assert.equal(page.calls.filter(call => call.action === 'scrollNext').at(-1).jump, false);
  page.motion.matches = true; page.motion.emit('change');
  assert.equal(page.timers.size, 0);
  page.motion.matches = false; page.motion.emit('change');
  assert.equal(page.timers.size, 1);
});

test('banner CTAs navigate directly without clicking a hidden toolbar or resetting home first', () => {
  for (let index = 0; index < 3; index++) {
    const page = heroPage({ reduced: index === 2 });
    const id = ['picks', 'slots', 'tap'][index];
    page.nodes['catalog-categories'].querySelector = () => { throw new Error('banner navigation must not query toolbar buttons'); };
    page.slides[index].children[0].click();
    assert.deepEqual(page.calls.filter(call => call.action === 'navigate').map(call => call.id), [id]);
    assert.equal(page.calls.some(call => ['category', 'scroll-results', 'focus-results'].includes(call.action)), false,
      'the destination owns rendering, scroll and focus');
    assert.equal(page.provider, '');
    assert.equal(page.category, id);
  }
  for (const id of ['all', 'providers']) {
    const page = heroPage();
    page.slides[0].children[0].dataset.heroCategory = id;
    page.slides[0].children[0].click();
    assert.deepEqual(page.calls.filter(call => call.action === 'navigate').map(call => call.id), [id]);
    if (id === 'providers') assert.equal(page.providerCalls.length, 1);
  }
});

test('reward banners open their feature routes without dispatching a catalog action', () => {
  const page = heroPage();
  page.slides[3].children[0].click();
  page.slides[4].children[0].click();
  assert.deepEqual(page.calls.slice(1), [
    { action: 'feature', id: 'daily-bonus' },
    { action: 'feature', id: 'vip-club' },
  ]);
});

test('leaving the lobby pauses the hidden hero immediately and resumes the remaining countdown on return', () => {
  const page = heroPage({ intersection: false });
  const root = page.nodes['hero-carousel'];
  const fill = page.animations.at(-1);
  page.elapse(1700);
  root.hidden = true;
  page.mutations[0].callback();
  assert.equal(page.timers.size, 0, 'the hidden page cannot retain an autoplay timer even without IntersectionObserver');
  assert.equal(fill.playState, 'paused');
  assert.equal(fill.currentTime, 1700);
  page.elapse(8000);
  page.window.emit('pageshow');
  assert.equal(page.timers.size, 0, 'other resume notifications cannot restart an off-home hero');
  root.hidden = false;
  page.mutations[0].callback();
  assert.equal(page.timers.size, 1);
  assert.equal([...page.timers.values()][0].duration, 4300);
  assert.equal(page.animations.at(-1), fill);
  const hiddenObservation = page.mutations[0].targets.find(target => target.node === root);
  assert.deepEqual([...hiddenObservation.options.attributeFilter], ['hidden']);
});

test('page suspension and carousel destruction clear timers; a restored page resumes safely', () => {
  const page = heroPage({ intersection: false });
  assert.equal(page.timers.size, 1);
  page.window.emit('pagehide'); assert.equal(page.timers.size, 0);
  page.window.emit('pageshow'); assert.equal(page.timers.size, 1);
  page.emit('destroy'); assert.equal(page.timers.size, 0);
  assert.equal(page.mutations[0].disconnected, true);
  assert.equal(page.nodes['hero-carousel'].dataset.ready, undefined);
  assert.equal(page.nodes['hero-controls'].hidden, true);
  page.window.emit('pageshow'); assert.equal(page.timers.size, 0);
});

test('white fill and rotation share one countdown, including pauses with overlapping reasons', () => {
  const page = heroPage(); page.visible();
  const root = page.nodes['hero-carousel'];
  const fill = page.animations.at(-1);
  assert.equal(fill.target.className, 'hero-carousel__dot-fill');
  assert.equal(fill.options.duration, 6000);
  assert.equal(fill.options.easing, 'linear');
  assert.equal(fill.playState, 'running');
  page.elapse(2000);
  root.emit('pointerenter', { pointerType: 'mouse' });
  assert.equal(fill.playState, 'paused');
  assert.equal(fill.currentTime, 2000);
  assert.equal(page.timers.size, 0);
  page.elapse(3000);
  root.emit('focusin'); root.emit('pointerleave');
  assert.equal(fill.currentTime, 2000, 'elapsed wall time while paused must not fill the mark');
  assert.equal(page.timers.size, 0, 'focus still prevents a mouse leave from resuming');
  root.emit('focusout', { relatedTarget: null });
  assert.equal(fill.playState, 'running');
  assert.equal([...page.timers.values()][0].duration, 4000);
  assert.equal(page.animations.at(-1), fill, 'resuming must preserve the existing fill');
  page.elapse(500);
  assert.equal(fill.currentTime, 2500);
  page.fireTimer();
  assert.equal(page.nodes['hero-dots'].children[1].getAttribute('aria-pressed'), 'true');
});

test('repeated visibility, reinitialization, and body notifications do not restart the fill or deadline', () => {
  const page = heroPage(); page.visible();
  const fill = page.animations.at(-1), count = page.animations.length;
  page.elapse(2000);
  page.visible(); page.mutations[0].callback(); page.emit('reInit');
  assert.equal(page.animations.length, count);
  assert.equal(fill.currentTime, 2000);
  assert.equal(page.timers.size, 1);
  assert.equal([...page.timers.values()][0].due, 6000);
  page.fireTimer();
  assert.equal(page.nodes['hero-dots'].children[1].getAttribute('aria-pressed'), 'true');
});

test('manual navigation, including selecting the current dot, starts a fresh synchronized countdown', () => {
  const page = heroPage(); page.visible();
  const firstFill = page.animations.at(-1);
  page.elapse(1750);
  page.nodes['hero-dots'].children[0].children[0].click();
  const restartedFill = page.animations.at(-1);
  assert.equal(firstFill.playState, 'idle');
  assert.notEqual(restartedFill, firstFill);
  assert.equal(restartedFill.currentTime, 0);
  assert.equal([...page.timers.values()][0].duration, 6000);
  page.elapse(700);
  page.nodes['hero-dots'].children[2].children[0].click();
  assert.equal(restartedFill.playState, 'idle');
  assert.equal(page.animations.at(-1).currentTime, 0);
  assert.equal(page.nodes['hero-dots'].children[2].getAttribute('aria-pressed'), 'true');
  assert.equal(page.timers.size, 1);
  assert.equal([...page.timers.values()][0].duration, 6000);
});

test('autoplay completion rolls over to exactly one new fill and timer', () => {
  const page = heroPage(); page.visible();
  const previous = page.animations.at(-1), count = page.animations.length;
  page.fireTimer();
  assert.equal(previous.playState, 'idle');
  assert.equal(page.animations.length, count + 1);
  assert.equal(page.animations.at(-1).currentTime, 0);
  assert.equal(page.animations.at(-1).playState, 'running');
  assert.equal(page.timers.size, 1);
  assert.equal([...page.timers.values()][0].duration, 6000);
  assert.equal(page.nodes['hero-status'].textContent, '', 'progress must not create live announcements');
});

test('reduced motion and destruction leave no running fill or rotation', () => {
  const page = heroPage({ reduced: true }); page.visible();
  assert.equal(page.animations.length, 0);
  assert.equal(page.timers.size, 0);
  page.motion.matches = false; page.motion.emit('change');
  const fill = page.animations.at(-1);
  assert.equal(fill.playState, 'running');
  page.elapse(1500);
  page.motion.matches = true; page.motion.emit('change');
  assert.equal(fill.playState, 'idle');
  assert.equal(page.timers.size, 0);
  page.motion.matches = false; page.motion.emit('change');
  const resumed = page.animations.at(-1);
  assert.notEqual(resumed, fill);
  page.emit('destroy');
  assert.equal(resumed.playState, 'idle');
  assert.equal(page.timers.size, 0);
  const animationCount = page.animations.length;
  page.window.emit('pageshow'); page.visible();
  page.motion.matches = true; page.motion.emit('change');
  page.motion.matches = false; page.motion.emit('change');
  assert.equal(page.animations.length, animationCount, 'destroyed carousels must not create new animations');
  assert.equal(page.animations.filter(animation => animation.playState === 'running').length, 0);
});
