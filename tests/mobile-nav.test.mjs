import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = (await readFile(new URL('../public/mobile-nav.js', import.meta.url), 'utf8'))
  .replace('export function initMobileNav', 'function initMobileNav');
const actions = ['menu', 'store', 'lobby', 'redeem', 'profile'];

function navPage({ desktop = false, missing = null, routeFromGame = false } = {}) {
  const calls = [], observations = [], observers = [], closeActions = [], lobbyActions = [];
  class Node {
    constructor() { this.dataset = {}; this.attributes = new Map(); this.listeners = new Map(); this.open = false; this.hidden = false; }
    setAttribute(name, value) { this.attributes.set(name, value); }
    removeAttribute(name) { this.attributes.delete(name); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    addEventListener(type, listener) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(listener);
    }
    emit(type) { for (const listener of this.listeners.get(type) || []) listener({ target: this }); }
    click() { this.emit('click'); }
  }
  const ids = ['mobile-nav', 'catalog-categories', 'site-menu', 'other-dialog',
    ...actions.map(action => `mobile-nav-${action}`)];
  const nodes = Object.fromEntries(ids.map(id => [id, new Node()]));
  const body = new Node();
  body.dataset.view = 'lobby';
  nodes['mobile-nav'].hidden = true;
  nodes['catalog-categories'].dataset.activeMenu = 'lobby';
  const all = new Node();
  all.addEventListener('click', () => {
    calls.push({ action: 'all' });
    nodes['catalog-categories'].dataset.activeMenu = 'lobby';
  });
  nodes['catalog-categories'].querySelector = selector => {
    assert.equal(selector, '[data-category="all"]');
    return all;
  };
  const dialogs = ['site-menu', 'other-dialog'];
  const document = {
    body,
    querySelector(selector) {
      if (selector === 'dialog[open]:not(#site-menu)') return dialogs.filter(id => id !== 'site-menu').map(id => nodes[id]).find(node => node.open) || null;
      const id = selector.slice(1);
      return id === missing ? null : nodes[id] || null;
    },
  };
  const media = new Node();
  media.matches = desktop;
  const api = {
    openMenu(options) { calls.push({ action: 'menu', options }); nodes['site-menu'].open = true; },
    closeMenu(action) {
      calls.push({ action: 'menu:close' });
      nodes['site-menu'].open = false;
      if (action) closeActions.push(action);
    },
    openHome() { calls.push({ action: 'home' }); nodes['catalog-categories'].dataset.activeMenu = 'lobby'; body.dataset.page = 'home'; body.dataset.view = 'lobby'; },
    openStore() { calls.push({ action: 'store' }); nodes['catalog-categories'].dataset.activeMenu = 'store'; body.dataset.page = 'store'; body.dataset.view = 'lobby'; },
    openFeature(pageId) { calls.push({ action: 'feature', pageId }); nodes['catalog-categories'].dataset.activeMenu = pageId; body.dataset.page = 'feature'; body.dataset.view = 'lobby'; },
  };
  if (routeFromGame) api.returnToLobby = action => {
    calls.push({ action: 'lobby:return' });
    lobbyActions.push(() => { body.dataset.view = 'lobby'; action?.(); });
  };
  const context = {
    document, api,
    window: { matchMedia(query) { assert.equal(query, '(width > 1024px)'); return media; } },
    MutationObserver: class {
      constructor(callback) { this.callback = callback; observers.push(this); }
      observe(target, options) { observations.push({ target, options }); }
    },
  };
  vm.runInNewContext(`${source}\ninitMobileNav(api);`, context);
  return { nodes, body, calls, media, observations, observers,
    initialize() { vm.runInNewContext('initMobileNav(api);', context); },
    flush() { for (const observer of observers) observer.callback(); },
    flushClose() { while (closeActions.length) closeActions.shift()(); },
    flushLobby() { while (lobbyActions.length) lobbyActions.shift()(); },
    button(action) { return nodes[`mobile-nav-${action}`]; },
  };
}

function active(page) {
  return actions.filter(action => page.button(action).dataset.active === 'true');
}

test('mobile actions reuse canonical destinations and preserve the originating dialog button', () => {
  const page = navPage();
  assert.equal(page.nodes['mobile-nav'].hidden, false);
  assert.equal(page.body.dataset.mobileNav, 'true');
  assert.deepEqual(active(page), ['lobby']);

  page.button('menu').click();
  assert.equal(page.calls.at(-1).action, 'menu');
  assert.equal(page.calls.at(-1).options.returnFocusTo, page.button('menu'));
  assert.equal(page.button('menu').getAttribute('aria-expanded'), 'true');
  assert.deepEqual(active(page), ['menu']);
  page.nodes['site-menu'].open = false;
  page.flush();

  page.button('lobby').click();
  assert.equal(page.calls.at(-1).action, 'home');
  assert.equal(page.button('lobby').getAttribute('aria-current'), 'page');

  page.button('store').click();
  assert.equal(page.calls.at(-1).action, 'store');
  assert.deepEqual(active(page), ['store']);
  assert.equal(page.button('store').getAttribute('aria-current'), 'page');
  assert.equal(page.button('store').getAttribute('aria-expanded'), null);

  for (const action of ['redeem', 'profile']) {
    page.button(action).click();
    assert.deepEqual(page.calls.at(-1), { action: 'feature', pageId: action });
    assert.deepEqual(active(page), [action]);
    assert.equal(page.button(action).getAttribute('aria-current'), 'page');
    assert.equal(page.button(action).getAttribute('aria-expanded'), null);
    assert.equal(page.body.dataset.page, 'feature');
  }
});

test('the mobile Menu button closes the menu instead of trying to open it again', () => {
  const page = navPage();
  page.button('menu').click();
  assert.equal(page.nodes['site-menu'].open, true);
  page.button('menu').click();
  assert.equal(page.nodes['site-menu'].open, false);
  assert.deepEqual(page.calls.map(call => call.action), ['menu', 'menu:close']);
  assert.equal(page.button('menu').getAttribute('aria-expanded'), 'false');
  assert.deepEqual(active(page), ['lobby']);
});

test('menu destinations wait for the menu close handoff and update the active destination', () => {
  const expected = { lobby: 'home', store: 'store', redeem: 'feature', profile: 'feature' };
  for (const action of Object.keys(expected)) {
    const page = navPage();
    page.button('menu').click();
    page.button(action).click();
    assert.equal(page.nodes['site-menu'].open, false);
    assert.deepEqual(page.calls.map(call => call.action), ['menu', 'menu:close'], action);
    assert.equal(page.nodes['other-dialog'].open, false);
    page.flushClose();
    assert.equal(page.calls.at(-1).action, expected[action]);
    assert.deepEqual(active(page), [action]);
    if (expected[action] === 'feature') assert.equal(page.calls.at(-1).pageId, action);
  }
});

test('desktop and other open dialogs prevent hidden or overlapping actions', () => {
  for (const mode of ['desktop', 'other-dialog']) {
    const page = navPage({ desktop: mode === 'desktop' });
    if (mode === 'game') page.body.dataset.view = 'game';
    else if (page.nodes[mode]) page.nodes[mode].open = true;
    for (const action of actions) page.button(action).click();
    assert.equal(page.calls.length, 0, mode);
  }
  for (const otherDialog of ['other-dialog']) {
    const page = navPage();
    page.nodes['site-menu'].open = true;
    page.nodes[otherDialog].open = true;
    for (const action of actions) page.button(action).click();
    assert.equal(page.calls.length, 0, `menu plus ${otherDialog}`);
  }
  const page = navPage({ desktop: true });
  page.media.matches = false;
  page.media.emit('change');
  page.button('profile').click();
  assert.equal(page.calls.at(-1).pageId, 'profile', 'mobile actions resume after the breakpoint changes');
});

test('Menu preserves the current game while every page destination uses its router entry point', () => {
  for (const action of ['menu']) {
    const page = navPage({ routeFromGame: true });
    page.body.dataset.view = 'game';
    page.button(action).click();
    assert.equal(page.calls.at(-1).action, action);
    assert.equal(page.calls.some(call => call.action === 'lobby:return'), false);
    assert.equal(page.body.dataset.view, 'game');
  }
  for (const [action, destination] of [['lobby', 'home'], ['store', 'store'], ['redeem', 'feature'], ['profile', 'feature']]) {
    const page = navPage({ routeFromGame: true });
    page.body.dataset.view = 'game';
    page.button(action).click();
    assert.equal(page.calls.some(call => call.action === 'lobby:return'), false);
    assert.equal(page.body.dataset.view, 'lobby');
    assert.equal(page.calls.at(-1).action, destination);
    if (destination === 'feature') assert.equal(page.calls.at(-1).pageId, action);
  }
});

test('game details and active games clear every bottom destination even when the previous page has its own selection', () => {
  for (const gamePage of ['game-details', 'game']) {
    for (const previous of ['providers', 'store', 'redeem', 'profile']) {
      const page = navPage();
      page.nodes['catalog-categories'].dataset.activeMenu = previous;
      page.body.dataset.page = ['redeem', 'profile'].includes(previous) ? 'feature' : previous;
      page.flush();
      assert.deepEqual(active(page), [previous === 'providers' ? 'menu' : previous]);

      if (gamePage === 'game-details') page.body.dataset.page = 'game-details';
      else page.body.dataset.view = 'game';
      page.flush();
      assert.deepEqual(active(page), [], `${gamePage} from ${previous}`);
      for (const action of actions) {
        assert.equal(page.button(action).getAttribute('aria-current'), null, `${action} cannot claim to be the game page`);
      }
    }
  }
});

test('Menu opens over either game page and closing it restores no selection until Lobby is explicitly opened', () => {
  for (const gamePage of ['game-details', 'game']) {
    const page = navPage();
    page.body.dataset.page = 'game-details';
    page.body.dataset.view = gamePage === 'game' ? 'game' : 'lobby';
    page.flush();
    assert.deepEqual(active(page), []);

    page.button('menu').click();
    assert.deepEqual(active(page), ['menu']);
    assert.equal(page.button('menu').getAttribute('aria-expanded'), 'true');
    assert.equal(page.button('lobby').getAttribute('aria-current'), null);
    page.button('menu').click();
    assert.deepEqual(active(page), []);
    assert.equal(page.button('menu').getAttribute('aria-expanded'), 'false');
    for (const action of actions) assert.equal(page.button(action).getAttribute('aria-current'), null);

    page.button('lobby').click();
    assert.equal(page.calls.at(-1).action, 'home');
    assert.deepEqual(active(page), ['lobby']);
    assert.equal(page.button('lobby').getAttribute('aria-current'), 'page');
    assert.equal(page.body.dataset.page, 'home');
    assert.equal(page.body.dataset.view, 'lobby');
  }
});

test('Store follows a page opened outside the bottom bar without requiring an obsolete wallet dialog', () => {
  const page = navPage();
  page.body.dataset.page = 'store';
  page.flush();
  assert.deepEqual(active(page), ['store']);
  assert.equal(page.button('store').getAttribute('aria-current'), 'page');
  assert.equal(page.button('store').getAttribute('aria-expanded'), null);
  assert.equal(page.nodes['wallet-dialog'], undefined);
  page.body.dataset.page = 'category';
  page.nodes['catalog-categories'].dataset.activeMenu = 'new-releases';
  page.flush();
  assert.deepEqual(active(page), ['lobby']);
});

test('member feature pages select Menu without claiming that its drawer is open', () => {
  const page = navPage();
  page.body.dataset.page = 'feature';
  page.nodes['catalog-categories'].dataset.activeMenu = 'vip-club';
  page.flush();
  assert.deepEqual(active(page), ['menu']);
  assert.equal(page.nodes['site-menu'].open, false);
  assert.equal(page.button('menu').getAttribute('aria-expanded'), 'false');
  assert.equal(page.button('menu').getAttribute('aria-current'), null, 'Menu remains a dialog action, not a page link');
  assert.equal(page.button('lobby').getAttribute('aria-current'), null);

  page.button('menu').click();
  assert.equal(page.nodes['site-menu'].open, true);
  assert.equal(page.button('menu').getAttribute('aria-expanded'), 'true');
  page.button('menu').click();
  assert.equal(page.nodes['site-menu'].open, false);
  assert.equal(page.button('menu').getAttribute('aria-expanded'), 'false');
  assert.deepEqual(active(page), ['menu'], 'dismissing the drawer preserves the current feature destination');
  page.button('lobby').click();
  assert.deepEqual(active(page), ['lobby']);
});

test('state follows navigation from other surfaces and distinguishes destinations from dialog actions', () => {
  const page = navPage();
  for (const category of ['popular', 'spooky', 'picks', 'slots']) {
    page.nodes['catalog-categories'].dataset.activeMenu = category;
    page.flush();
    assert.deepEqual(active(page), ['lobby']);
    assert.equal(page.button('lobby').getAttribute('aria-current'), 'page');
  }
  for (const destination of ['providers', 'search']) {
    page.nodes['catalog-categories'].dataset.activeMenu = destination;
    page.body.dataset.page = destination;
    page.flush();
    assert.deepEqual(active(page), ['menu']);
    assert.equal(page.button('menu').getAttribute('aria-current'), null);
    assert.equal(page.button('menu').getAttribute('aria-expanded'), 'false');
  }

  page.nodes['catalog-categories'].dataset.activeMenu = 'store';
  page.body.dataset.page = 'store';
  page.flush();
  assert.deepEqual(active(page), ['store']);
  assert.equal(page.button('store').getAttribute('aria-current'), 'page');
  assert.equal(page.button('store').getAttribute('aria-expanded'), null);

  for (const destination of ['redeem', 'profile']) {
    page.nodes['catalog-categories'].dataset.activeMenu = destination;
    page.body.dataset.page = 'feature';
    page.flush();
    assert.deepEqual(active(page), [destination]);
    assert.equal(page.button(destination).getAttribute('aria-current'), 'page');
    assert.equal(page.button(destination).getAttribute('aria-expanded'), null);
    assert.equal(page.button('menu').getAttribute('aria-current'), null);
    assert.equal(page.button('menu').getAttribute('aria-expanded'), 'false');
  }
});

test('dialog state takes precedence and clears expanded/current attributes on dismissal', () => {
  const page = navPage();
  page.nodes['catalog-categories'].dataset.activeMenu = 'store';
  page.body.dataset.page = 'store';
  page.nodes['site-menu'].open = true;
  page.flush();
  assert.deepEqual(active(page), ['menu']);
  assert.equal(page.button('store').getAttribute('aria-current'), null);
  assert.equal(page.button('menu').getAttribute('aria-expanded'), 'true');
  page.nodes['site-menu'].open = false;
  page.flush();
  assert.deepEqual(active(page), ['store']);
  assert.equal(page.button('menu').getAttribute('aria-expanded'), 'false');
  assert.equal(page.button('menu').getAttribute('aria-current'), null);
  assert.equal(page.button('store').getAttribute('aria-current'), 'page');
});

test('initialization is idempotent, requires a complete shell and watches only relevant attributes', () => {
  const incomplete = navPage({ missing: 'mobile-nav-store' });
  assert.equal(incomplete.nodes['mobile-nav'].hidden, true);
  assert.equal(incomplete.observers.length, 0);

  const page = navPage();
  page.initialize();
  assert.equal(page.observers.length, 1);
  assert.equal(page.observations.length, 3);
  for (const observation of page.observations) {
    assert.equal(observation.options.attributes, true);
    assert.equal(observation.options.childList, undefined);
    assert.equal(observation.options.subtree, undefined);
    const expected = observation.target === page.body ? ['data-view', 'data-page']
      : observation.target === page.nodes['catalog-categories'] ? ['data-active-menu'] : ['open'];
    assert.deepEqual(Array.from(observation.options.attributeFilter), expected);
  }
  page.button('redeem').click();
  assert.equal(page.calls.length, 1, 'no duplicate click handlers are added');
});
