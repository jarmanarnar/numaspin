import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { CATEGORIES, getGamesForCategory } from '../public/collections.js';
import { createMemberState, dailyStatus, claimDailyReward } from '../public/member-state.js';
import { getFavoriteGames } from '../public/catalog-page-model.js';

const source = (await readFile(new URL('../public/site-menu.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\r?\n/gm, '').replace('export function initSiteMenu', 'function initSiteMenu');

function menuPage({ desktop = false, routeFromGame = false, storage = new Map(), favorites = [] } = {}) {
  const calls = [], closeEvents = [], observers = [], windowEvents = {}, providerCalls = [], lobbyActions = [], helpCalls = [];
  const document = { body: { dataset: { view: 'lobby' } }, activeElement: null };
  let clock = new Date(2026, 9, 31, 12), memberState = createMemberState({ favorites }), timerId = 0;
  const memberListeners = [], timers = new Map();
  class Node {
    constructor(tagName = 'div') {
      this.tagName = tagName.toUpperCase();
      this.tabIndex = ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY', 'A'].includes(this.tagName) ? 0 : -1;
      this.dataset = {};
      this.attributes = new Map();
      this.listeners = new Map();
      this.children = [];
      this.textContent = '';
      this.visible = true;
      this.open = false;
      this.hidden = false;
      this.inert = false;
      this.style = {};
    }
    get parentElement() { return this.parent || null; }
    get nextSibling() {
      return this.parent?.children[this.parent.children.indexOf(this) + 1] || null;
    }
    append(...children) { for (const child of children) this.appendChild(child); }
    appendChild(child) {
      child.parent?.removeChild(child);
      child.parent = this;
      this.children.push(child);
      return child;
    }
    removeChild(child) {
      const index = this.children.indexOf(child);
      if (index >= 0) this.children.splice(index, 1);
      child.parent = null;
      return child;
    }
    insertBefore(child, before) {
      if (child === before) return child;
      if (!before) return this.appendChild(child);
      child.parent?.removeChild(child);
      const index = this.children.indexOf(before);
      assert.ok(index >= 0, 'insertBefore reference belongs to this parent');
      child.parent = this;
      this.children.splice(index, 0, child);
      return child;
    }
    replaceChildren(...children) {
      for (const child of [...this.children]) this.removeChild(child);
      this.append(...children);
    }
    setAttribute(key, value) { this.attributes.set(key, value); }
    removeAttribute(key) { this.attributes.delete(key); }
    getAttribute(key) { return this.attributes.get(key) ?? null; }
    addEventListener(type, listener) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(listener);
    }
    emit(type, details = {}) {
      const event = {
        target: this, defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, ...details,
      };
      for (const listener of this.listeners.get(type) || []) listener(event);
      return event;
    }
    click() {
      const event = this.emit('click');
      for (let parent = this.parent; parent; parent = parent.parent) parent.emit('click', event);
    }
    closest(selector) {
      const property = {
        '[data-menu-category]': 'menuCategory',
        '[data-menu-feature]': 'menuFeature',
        '[data-menu-disclosure]': 'menuDisclosure',
        '[data-tooltip]': 'tooltip',
      }[selector];
      if (!property) throw new Error(`Unexpected selector ${selector}`);
      return this.dataset[property] ? this : this.parent?.closest(selector) || null;
    }
    contains(node) { for (let next = node; next; next = next.parent) if (next === this) return true; return false; }
    querySelectorAll(selector) {
      assert.equal(selector, 'button, a[href], input, select, textarea, summary, [tabindex]');
      const descendants = this.children.flatMap(child => [child, ...child.descendants()]);
      return descendants.filter(child => ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY'].includes(child.tagName)
        || (child.tagName === 'A' && (child.href || child.getAttribute('href')))
        || child.attributes.has('tabindex'));
    }
    descendants() { return this.children.flatMap(child => [child, ...child.descendants()]); }
    focus() { if (this.getClientRects().length && !this.disabled && !this.hasInertAncestor()) document.activeElement = this; }
    hasInertAncestor() { for (let next = this; next; next = next.parent) if (next.inert) return true; return false; }
    getClientRects() {
      for (let next = this; next; next = next.parent) {
        if (!next.visible || next.hidden || (next.tagName === 'DIALOG' && !next.open)) return [];
      }
      return [{}];
    }
    getBoundingClientRect() { return this.bounds || { left: 0, right: 320, top: 0, bottom: 700, width: 320, height: 700 }; }
    show() { this.open = true; calls.push('menu:open'); }
    showModal() { throw new Error('Mobile Menu must not create a modal above the persistent bottom navigation'); }
    close() { this.open = false; calls.push('menu:close'); closeEvents.push(() => this.emit('close')); }
  }
  document.body = new Node();
  document.body.dataset.view = 'lobby';
  const ids = ['menu-toggle', 'site-menu', 'menu-navigation', 'menu-buy', 'menu-redeem',
    'catalog-categories', 'coin-wallet', 'site-logo', 'other-dialog',
    'site-sidebar', 'sidebar-footer', 'sidebar-content', 'menu-content', 'menu-shortcuts',
    'menu-mobile-header', 'menu-search', 'menu-daily-bonus', 'menu-daily-amount', 'menu-daily-badge', 'menu-tooltip', 'site-search', 'site-search-input',
    'bottom-menu', 'mobile-nav', 'mobile-nav-menu', 'mobile-nav-store', 'mobile-nav-lobby', 'mobile-nav-redeem', 'mobile-nav-profile',
    'lobby-view', 'game-view', 'store-view', 'feature-view', 'game-details-view'];
  const nodes = Object.fromEntries(ids.map(id => {
    const tagName = id === 'site-menu' || id === 'other-dialog' || id === 'site-search' ? 'dialog'
      : id === 'menu-toggle' || id === 'menu-buy' || id === 'menu-redeem' || id === 'menu-search' || id === 'menu-daily-bonus'
        || id === 'bottom-menu' || id.startsWith('mobile-nav-') ? 'button'
        : id === 'site-logo' ? 'a' : id === 'site-search-input' ? 'input' : 'div';
    const node = new Node(tagName);
    node.id = id;
    return [id, node];
  }));
  nodes['menu-tooltip'].hidden = true;
  nodes['mobile-nav-menu'].visible = false;
  nodes['menu-tooltip'].bounds = { left: 0, right: 120, top: 0, bottom: 32, width: 120, height: 32 };
  const headerParent = new Node();
  headerParent.append(nodes['menu-toggle'], nodes['site-logo']);
  nodes['site-menu'].append(nodes['menu-mobile-header'], nodes['menu-content']);
  nodes['menu-mobile-header'].append(nodes['menu-shortcuts']);
  nodes['menu-shortcuts'].append(nodes['menu-buy'], nodes['menu-redeem']);
  nodes['menu-content'].append(nodes['menu-daily-bonus'], nodes['menu-search'], nodes['menu-navigation']);
  nodes['menu-daily-bonus'].append(nodes['menu-daily-amount'], nodes['menu-daily-badge']);
  nodes['site-sidebar'].append(nodes['sidebar-content'], nodes['sidebar-footer']);
  nodes['mobile-nav'].append(...['menu', 'store', 'lobby', 'redeem', 'profile'].map(action => nodes[`mobile-nav-${action}`]));
  document.body.append(headerParent, nodes['site-sidebar'], nodes['lobby-view'], nodes['game-view'], nodes['store-view'],
    nodes['feature-view'], nodes['game-details-view'], nodes['mobile-nav'], nodes['site-menu']);
  const documentEvents = new Node();
  document.addEventListener = documentEvents.addEventListener.bind(documentEvents);
  const breakpoint = new Node();
  breakpoint.matches = desktop;
  nodes['coin-wallet'].dataset.currency = 'GC';
  nodes['catalog-categories'].dataset.activeMenu = 'lobby';
  const categoryButtons = new Map(CATEGORIES.map(category => category.id).map(id => {
    const button = new Node();
    button.dataset.category = id;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      calls.push(`category:${id}`);
      nodes['catalog-categories'].dataset.activeMenu = id;
      for (const [candidate, node] of categoryButtons) node.setAttribute('aria-pressed', String(candidate === id));
    });
    return [id, button];
  }));
  nodes['catalog-categories'].querySelector = selector => {
    if (selector === '[data-category][aria-pressed="true"]') {
      return [...categoryButtons.values()].find(node => node.getAttribute('aria-pressed') === 'true') || null;
    }
    return categoryButtons.get(selector.match(/^\[data-category="([^"]+)"\]$/)?.[1]) || null;
  };
  document.querySelector = selector => {
    if (selector === 'dialog[open]') return ['site-menu', 'other-dialog', 'site-search'].map(id => nodes[id]).find(node => node.open) || null;
    return nodes[selector.slice(1)] || null;
  };
  document.createElement = tag => new Node(tag);
  const pageHeading = new Node();
  function routeCategory(id) {
    assert.equal(nodes['site-menu'].open, false);
    calls.push(`category:${id}`);
    nodes['catalog-categories'].dataset.activeMenu = id;
    document.body.dataset.view = 'lobby';
    document.body.dataset.page = 'category';
    for (const [candidate, node] of categoryButtons) node.setAttribute('aria-pressed', String(candidate === id));
    pageHeading.focus();
  }
  const catalog = {
    member: {
      getState: () => memberState,
      getDailyStatus: now => dailyStatus(memberState, now),
      subscribe(listener) { memberListeners.push(listener); },
    },
    openHowToPlay(options) {
      assert.equal(nodes['site-menu'].open, false);
      assert.equal(nodes['lobby-view'].inert, false, 'restore the page before opening another dialog');
      calls.push('help:open');
      helpCalls.push(options);
    },
    openHome() {
      assert.equal(nodes['site-menu'].open, false);
      calls.push('home:open');
      nodes['catalog-categories'].dataset.activeMenu = 'lobby';
      document.body.dataset.view = 'lobby'; document.body.dataset.page = 'home';
      pageHeading.focus();
    },
    openCategory(id) { routeCategory(id); },
    openFavorites() { routeCategory('favorites'); },
    openStore() {
      assert.equal(nodes['site-menu'].open, false);
      calls.push('store:open');
      document.body.dataset.view = 'lobby';
      document.body.dataset.page = 'store';
      nodes['catalog-categories'].dataset.activeMenu = 'store';
      pageHeading.focus();
    },
    openFeature(id) {
      assert.equal(nodes['site-menu'].open, false);
      calls.push(`feature:${id}`);
      document.body.dataset.view = 'lobby';
      document.body.dataset.page = id;
      nodes['catalog-categories'].dataset.activeMenu = id;
      pageHeading.focus();
    },
    openSearch() {
      assert.equal(nodes['site-menu'].open, false);
      nodes['catalog-categories'].dataset.activeMenu = 'search';
      document.body.dataset.view = 'lobby';
      document.body.dataset.page = 'search';
      calls.push('search:open');
      nodes['site-search-input'].focus();
    },
    openProviders(options) {
      assert.equal(nodes['site-menu'].open, false);
      providerCalls.push(options);
      calls.push('category:providers');
      document.body.dataset.view = 'lobby';
      document.body.dataset.page = 'providers';
      pageHeading.focus();
      nodes['catalog-categories'].dataset.activeMenu = 'providers';
      for (const button of categoryButtons.values()) button.setAttribute('aria-pressed', 'false');
    },
  };
  if (routeFromGame) catalog.returnToLobby = action => {
    calls.push('lobby:return');
    lobbyActions.push(() => { document.body.dataset.view = 'lobby'; action?.(); });
  };
  const context = {
    document, Element: Node, CATEGORIES, getGamesForCategory, getFavoriteGames, catalog,
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : [clock])); } },
    setTimeout(callback, delay) { timers.set(++timerId, { callback, delay }); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    createShelfIcon: () => new Node(),
    window: {
      innerWidth: 1280, innerHeight: 900,
      addEventListener(type, callback) { windowEvents[type] = callback; },
      matchMedia(query) {
        assert.equal(query, '(width > 1024px)');
        return breakpoint;
      },
    },
    MutationObserver: class {
      constructor(callback) { this.callback = callback; this.targets = []; observers.push(this); }
      observe(node) { this.targets.push(node); }
      disconnect() { this.targets = []; }
    },
  };
  const api = vm.runInNewContext(`${source}\ninitSiteMenu(catalog);`, context);
  const flushClose = () => { while (closeEvents.length) closeEvents.shift()(); };
  const item = id => nodes['menu-navigation'].descendants().find(node => node.dataset.menuCategory === id);
  const feature = id => nodes['menu-content'].descendants().find(node => node.dataset.menuFeature === id);
  const socialCasino = nodes['menu-navigation'].children[0];
  const casinoItems = socialCasino?.nextSibling;
  const resize = matches => {
    breakpoint.matches = matches;
    breakpoint.emit('change', { matches });
  };
  return { nodes, document, calls, categoryButtons, observers, windowEvents, context, api,
    item, feature, socialCasino, casinoItems, flushClose, providerCalls, helpCalls, headerParent, resize, pageHeading,
    keydown: (key, options = {}) => documentEvents.emit('keydown', { key, ...options }),
    claimDaily() { memberState = claimDailyReward(memberState, clock).state; memberListeners.forEach(listener => listener()); },
    setFavorites(favorites) { memberState = createMemberState({ ...memberState, favorites }); memberListeners.forEach(listener => listener()); },
    tickMinutes(minutes) {
      clock = new Date(clock.getTime() + minutes * 60_000);
      const queued = [...timers.values()]; timers.clear(); queued.forEach(timer => timer.callback());
    },
    flushLobby() { while (lobbyActions.length) lobbyActions.shift()(); } };
}

test('desktop sidebar retains its width across refresh and a mobile layout round trip', () => {
  const storage = new Map();
  const first = menuPage({ desktop: true, storage });
  assert.equal(first.document.body.dataset.sidebar, 'expanded');
  const refreshed = menuPage({ desktop: true, storage });
  assert.equal(refreshed.document.body.dataset.sidebar, 'expanded');
  assert.equal(refreshed.nodes['menu-toggle'].getAttribute('aria-expanded'), 'true');
  refreshed.resize(false);
  assert.equal(refreshed.nodes['site-menu'].open, false, 'desktop state must not open a mobile drawer');
  refreshed.resize(true);
  assert.equal(refreshed.document.body.dataset.sidebar, 'expanded');
  refreshed.nodes['menu-toggle'].click();
  assert.equal(menuPage({ desktop: true, storage }).document.body.dataset.sidebar, 'collapsed');
});

test('blocked browser storage does not prevent sidebar initialization or toggling', () => {
  const storage = { get() { throw new Error('Blocked'); }, set() { throw new Error('Blocked'); } };
  const page = menuPage({ desktop: true, storage });
  assert.equal(page.document.body.dataset.sidebar, 'expanded');
  page.nodes['menu-toggle'].click();
  assert.equal(page.document.body.dataset.sidebar, 'collapsed');
});

test('menu opens once, focuses BUY, and only lists available collections', () => {
  const page = menuPage();
  page.context.initSiteMenu();
  page.nodes['menu-toggle'].click();
  assert.equal(page.nodes['site-menu'].open, true);
  assert.equal(page.nodes['menu-toggle'].getAttribute('aria-expanded'), 'true');
  assert.equal(page.document.activeElement, page.nodes['menu-buy']);
  assert.equal(page.nodes['menu-toggle'].listeners.get('click').length, 1);
  assert.equal(page.item('lobby'), undefined, 'Lobby must not appear in the menu');
  assert.equal(page.item('all'), undefined, 'All Games must not have a separate menu destination');
  assert.equal(page.categoryButtons.has('all'), false);
  for (const category of CATEGORIES) assert.equal(!!page.item(category.id), getGamesForCategory(category.id).length > 0);
  assert.equal(page.casinoItems.children.at(-1), page.item('providers'));
  assert.equal(page.categoryButtons.has('providers'), false);
});

test('the drawer focuses Daily Bonus when the guest shortcuts are hidden', () => {
  const page = menuPage();
  page.nodes['menu-shortcuts'].hidden = true;
  page.nodes['menu-toggle'].click();
  assert.equal(page.document.activeElement, page.nodes['menu-daily-bonus']);
});

test('sidebar keeps categories and Search without a Lobby destination', () => {
  const page = menuPage({ desktop: true });
  const popular = page.item('popular');
  assert.equal(page.item('lobby'), undefined);
  assert.equal(page.item('all'), undefined);
  page.socialCasino.click();
  popular.click();
  assert.equal(page.calls.at(-1), 'category:popular');
  assert.equal(page.document.body.dataset.page, 'category');
  page.observers[0].callback();
  assert.equal(popular.getAttribute('aria-current'), 'page');
  page.nodes['menu-search'].click();
  assert.equal(page.calls.at(-1), 'search:open');
  assert.equal(page.document.body.dataset.page, 'search');
  assert.equal(page.document.activeElement, page.nodes['site-search-input']);
  page.observers[0].callback();
  assert.equal(popular.getAttribute('aria-current'), null);
});

test('Escape closes the drawer, resets its trigger and restores focus', () => {
  const page = menuPage();
  page.nodes['menu-toggle'].click();
  const event = page.nodes['site-menu'].emit('cancel');
  assert.equal(event.defaultPrevented, true);
  assert.equal(page.nodes['site-menu'].open, false);
  page.flushClose();
  assert.equal(page.nodes['menu-toggle'].getAttribute('aria-expanded'), 'false');
  assert.equal(page.document.activeElement, page.nodes['menu-toggle']);
  assert.equal(page.observers[0].targets.length, 0);
});

test('a caller can open the drawer and receive focus again when it is dismissed', () => {
  const page = menuPage();
  assert.equal(page.context.initSiteMenu(), page.api, 'reinitialization returns the same menu controller');
  page.api.openMenu({ returnFocusTo: page.nodes['bottom-menu'] });
  assert.equal(page.nodes['site-menu'].open, true);
  assert.equal(page.document.activeElement, page.nodes['menu-buy']);
  page.nodes['site-menu'].emit('cancel');
  page.flushClose();
  assert.equal(page.document.activeElement, page.nodes['bottom-menu']);
});

test('a hidden drawer opener falls back to the visible header control', () => {
  const page = menuPage();
  page.api.openMenu({ returnFocusTo: page.nodes['bottom-menu'] });
  page.nodes['bottom-menu'].visible = false;
  page.api.closeMenu();
  page.flushClose();
  assert.equal(page.document.activeElement, page.nodes['menu-toggle']);
});

test('a hidden caller and header hamburger fall back to the visible bottom Menu button', () => {
  const page = menuPage();
  page.nodes['menu-toggle'].visible = false;
  page.nodes['mobile-nav-menu'].visible = true;
  page.api.openMenu({ returnFocusTo: page.nodes['bottom-menu'] });
  page.nodes['bottom-menu'].visible = false;
  page.api.closeMenu();
  page.flushClose();
  assert.equal(page.document.activeElement, page.nodes['mobile-nav-menu']);
});

test('changing between desktop and bottom navigation transfers focus to the visible menu control', () => {
  const page = menuPage({ desktop: true });
  page.nodes['menu-toggle'].focus();
  page.nodes['menu-toggle'].visible = false;
  page.nodes['mobile-nav-menu'].visible = true;
  page.resize(false);
  assert.equal(page.document.activeElement, page.nodes['mobile-nav-menu']);

  page.nodes['menu-toggle'].visible = true;
  page.nodes['mobile-nav-menu'].visible = false;
  page.resize(true);
  assert.equal(page.document.activeElement, page.nodes['menu-toggle']);
});

test('resizing an open bottom-menu drawer to desktop keeps focus on the desktop trigger after native close', () => {
  const page = menuPage();
  page.nodes['menu-toggle'].visible = false;
  page.nodes['mobile-nav-menu'].visible = true;
  page.api.openMenu({ returnFocusTo: page.nodes['mobile-nav-menu'] });
  assert.equal(page.document.activeElement, page.nodes['menu-buy']);
  page.nodes['menu-toggle'].visible = true;
  page.nodes['mobile-nav-menu'].visible = false;
  page.resize(true);
  page.flushClose();
  assert.equal(page.nodes['site-menu'].open, false);
  assert.equal(page.document.activeElement, page.nodes['menu-toggle']);
});

test('game navigation closes the menu and restores its visible shell opener', () => {
  const page = menuPage();
  page.api.openMenu({ returnFocusTo: page.nodes['bottom-menu'] });
  page.document.body.dataset.view = 'game';
  page.windowEvents.hashchange();
  page.flushClose();
  assert.equal(page.nodes['site-menu'].open, false);
  assert.equal(page.document.activeElement, page.nodes['bottom-menu']);
});

test('choosing a category from a caller-opened drawer keeps focus on that category', () => {
  const page = menuPage();
  page.api.openMenu({ returnFocusTo: page.nodes['bottom-menu'] });
  page.socialCasino.click();
  page.item('popular').click();
  page.flushClose();
  assert.equal(page.calls.at(-1), 'category:popular');
  assert.equal(page.document.activeElement, page.pageHeading);
});

test('inside clicks leave the drawer open while backdrop clicks dismiss it', () => {
  const page = menuPage();
  page.nodes['menu-toggle'].click();
  page.nodes['site-menu'].emit('click', { clientX: 100, clientY: 50 });
  assert.equal(page.nodes['site-menu'].open, true);
  page.nodes['site-menu'].emit('click', { clientX: 500, clientY: 50 });
  assert.equal(page.nodes['site-menu'].open, false);
});

test('a quick reopen waits until the previous native close event finishes', () => {
  const page = menuPage();
  page.nodes['menu-toggle'].click();
  page.api.closeMenu();
  page.nodes['menu-toggle'].click();
  assert.equal(page.nodes['site-menu'].open, false);
  assert.equal(page.calls.filter(call => call === 'menu:open').length, 1);
  page.flushClose();
  page.nodes['menu-toggle'].click();
  assert.equal(page.nodes['site-menu'].open, true);
  assert.equal(page.nodes['menu-toggle'].getAttribute('aria-expanded'), 'true');
  assert.ok(page.observers[0].targets.length > 0);
});

test('category and Providers page navigation runs only after the drawer closes', () => {
  const page = menuPage();
  page.nodes['menu-toggle'].click();
  page.socialCasino.click();
  assert.equal(page.nodes['site-menu'].open, true);
  page.item('slots').click();
  assert.equal(page.nodes['site-menu'].open, false);
  assert.ok(!page.calls.includes('category:slots'));
  page.flushClose();
  assert.equal(page.document.activeElement, page.pageHeading);
  assert.equal(page.calls.at(-1), 'category:slots');
  page.nodes['menu-toggle'].click();
  assert.equal(page.item('slots').getAttribute('aria-current'), 'page');
  assert.equal(page.categoryButtons.has('providers'), false);
  page.item('providers').click();
  assert.equal(page.nodes['site-menu'].open, false);
  assert.equal(page.providerCalls.length, 0, 'Providers waits for the native drawer close event');
  page.flushClose();
  assert.equal(page.calls.at(-1), 'category:providers');
  assert.equal(page.providerCalls.length, 1);
  assert.equal(page.providerCalls[0], undefined);
  assert.ok([...page.categoryButtons.values()].every(button => button.getAttribute('aria-pressed') === 'false'));
  page.nodes['menu-toggle'].click();
  assert.equal(page.item('providers').getAttribute('aria-current'), 'page');
  assert.equal(page.item('slots').getAttribute('aria-current'), null);
});

test('BUY opens the Store page only after the mobile menu closes and keeps destination focus', () => {
  const page = menuPage();
  page.nodes['menu-toggle'].click();
  page.nodes['menu-buy'].click();
  page.nodes['menu-toggle'].click();
  assert.equal(page.nodes['site-menu'].open, false);
  assert.equal(page.calls.includes('store:open'), false);
  page.flushClose();
  assert.equal(page.document.body.dataset.page, 'store');
  assert.equal(page.document.activeElement, page.pageHeading);
  assert.deepEqual(page.calls.slice(-2), ['menu:close', 'store:open']);
});

test('mobile search opens after the drawer closes while desktop search opens directly', () => {
  const mobile = menuPage();
  mobile.nodes['menu-toggle'].click();
  mobile.nodes['menu-search'].click();
  assert.equal(mobile.nodes['site-menu'].open, false);
  assert.equal(mobile.nodes['site-search'].open, false);
  mobile.flushClose();
  assert.equal(mobile.nodes['catalog-categories'].dataset.activeMenu, 'search');
  assert.equal(mobile.document.activeElement, mobile.nodes['site-search-input']);

  const desktop = menuPage({ desktop: true });
  desktop.nodes['menu-search'].click();
  assert.equal(desktop.nodes['catalog-categories'].dataset.activeMenu, 'search');
  assert.equal(desktop.document.activeElement, desktop.nodes['site-search-input']);
  assert.equal(desktop.calls.some(call => call === 'menu:open' || call === 'menu:close'), false);
});

test('the Daily Bonus banner opens its page without a duplicate menu row', () => {
  const page = menuPage({ desktop: true });
  page.nodes['menu-daily-bonus'].click();
  assert.equal(page.calls.at(-1), 'feature:daily-bonus');
  assert.equal(page.document.activeElement, page.pageHeading);
  assert.equal(page.feature('daily-bonus'), undefined);
  assert.equal(page.nodes['menu-daily-amount'].textContent, '1,000 GC');
  assert.equal(page.nodes['menu-daily-badge'].textContent, 'Ready');
  assert.equal(page.feature('promotions'), undefined);
});

test('the Daily Bonus banner follows claims, next reward amounts and the next local calendar day', () => {
  const page = menuPage({ desktop: true });
  page.claimDaily();
  assert.equal(page.nodes['menu-daily-amount'].textContent, '2,000 GC');
  assert.equal(page.nodes['menu-daily-badge'].textContent, '12h');
  page.tickMinutes(11 * 60 + 30);
  assert.equal(page.nodes['menu-daily-badge'].textContent, '30m');
  page.tickMinutes(30);
  assert.equal(page.nodes['menu-daily-amount'].textContent, '2,000 GC');
  assert.equal(page.nodes['menu-daily-badge'].textContent, 'Ready');
});

test('the mobile daily banner waits for menu closure before opening Daily Bonus', () => {
  const page = menuPage();
  page.api.openMenu();
  page.nodes['menu-daily-bonus'].click();
  assert.equal(page.nodes['site-menu'].open, false);
  assert.equal(page.calls.includes('feature:daily-bonus'), false);
  page.flushClose();
  assert.equal(page.calls.at(-1), 'feature:daily-bonus');
});

test('member destinations navigate after the mobile drawer closes', () => {
  const page = menuPage();
  for (const id of ['vip-club', 'rank-system', 'free-money',
    'invite-friends', 'partners', 'affiliate-program',
    'profile', 'history', 'notifications', 'support', 'blog', 'settings']) {
    assert.ok(page.feature(id), `${id} has a dedicated sidebar entry`);
    assert.equal(page.feature(id).dataset.tooltip, page.feature(id).getAttribute('aria-label'));
  }
  assert.equal(page.feature('crypto-earn'), undefined, 'removed page must not remain in navigation');
  assert.equal(page.feature('lounge'), undefined, 'removed Lounge must not remain in navigation');
  assert.equal(page.feature('missions'), undefined, 'removed Missions must not remain in navigation');
  assert.equal(page.feature('bonus-hub'), undefined, 'removed Bonus Hub must not remain in navigation');
  page.nodes['menu-toggle'].click();
  page.feature('vip-club').click();
  assert.equal(page.nodes['site-menu'].open, false);
  assert.equal(page.calls.includes('feature:vip-club'), false);
  page.flushClose();
  assert.equal(page.calls.at(-1), 'feature:vip-club');
  assert.equal(page.document.activeElement, page.pageHeading);
  page.nodes['menu-toggle'].click();
  assert.equal(page.feature('vip-club').getAttribute('aria-current'), 'page');
  assert.equal(page.item('lobby'), undefined);
});

test('Favorites appears once above Popular and opens the catalog after closing the mobile drawer', () => {
  for (const desktop of [true, false]) {
    const page = menuPage({ desktop, favorites: ['nunchucksr96f100'] });
    const favorites = page.item('favorites');
    assert.equal(favorites.hidden, false);
    assert.equal(page.casinoItems.children[0], favorites);
    assert.equal(page.casinoItems.children[1], page.item('popular'));
    assert.equal(page.nodes['menu-content'].descendants().filter(node => node.dataset.menuCategory === 'favorites').length, 1);
    assert.equal(page.feature('favorites'), undefined, 'Favorites is a casino destination, separate from account tools');
    page.api.openMenu();
    page.socialCasino.click();
    favorites.click();
    if (!desktop) {
      assert.equal(page.nodes['site-menu'].open, false);
      assert.equal(page.calls.includes('category:favorites'), false);
      page.flushClose();
      page.api.openMenu();
    } else page.observers[0].callback();
    assert.ok(page.calls.includes('category:favorites'));
    assert.equal(favorites.getAttribute('aria-current'), 'page');
    assert.equal(page.item('popular').getAttribute('aria-current'), null);
  }
});

test('Favorites is absent from desktop and mobile navigation until the first valid saved game and hides after the last removal', () => {
  for (const desktop of [true, false]) {
    const page = menuPage({ desktop });
    const favorites = page.item('favorites');
    page.api.openMenu();
    page.socialCasino.click();
    assert.equal(favorites.getClientRects().length, 0);
    page.setFavorites(['removed-game']);
    assert.equal(favorites.hidden, true);
    page.setFavorites(['nunchucksr96f100']);
    assert.equal(favorites.hidden, false);
    assert.equal(favorites.getClientRects().length, 1);
    assert.equal(favorites.nextSibling, page.item('popular'));
    favorites.focus();
    page.setFavorites([]);
    assert.equal(favorites.getClientRects().length, 0);
    assert.equal(page.document.activeElement, page.item('popular'), 'focus must not remain in a hidden item');
    assert.equal(page.item('popular').hidden, false);
    page.setFavorites(['SanQuentin']);
    assert.equal(favorites.getClientRects().length, 1);
    assert.equal(page.casinoItems.children.filter(node => node.dataset.menuCategory === 'favorites').length, 1);
  }
});

test('REDEEM opens a separate preview destination instead of performing a transaction', () => {
  const page = menuPage({ desktop: true });
  assert.equal(page.nodes['menu-redeem'].disabled, false);
  page.nodes['menu-redeem'].click();
  assert.equal(page.calls.at(-1), 'feature:redeem');
  assert.equal(page.calls.includes('store:open'), false);
});

test('Social Casino opens the desktop rail, toggles the categories in place and restores focus when closing', () => {
  const page = menuPage({ desktop: true });
  page.nodes['menu-toggle'].click();
  const { socialCasino, casinoItems } = page;
  assert.equal(socialCasino.dataset.menuDisclosure, 'social-casino');
  assert.equal(socialCasino.getAttribute('aria-label'), 'Social Casino');
  assert.equal(socialCasino.getAttribute('aria-expanded'), 'false');
  assert.equal(socialCasino.getAttribute('aria-controls'), casinoItems.id);
  assert.equal(casinoItems.hidden, true);
  assert.equal(page.item('popular').getClientRects().length, 0);

  socialCasino.click();
  assert.equal(page.document.body.dataset.sidebar, 'expanded');
  assert.equal(socialCasino.getAttribute('aria-expanded'), 'true');
  assert.equal(page.item('popular').getClientRects().length, 1);
  assert.equal(page.feature('partners').getAttribute('aria-expanded'), 'false');

  page.item('popular').focus();
  socialCasino.click();
  assert.equal(casinoItems.hidden, true);
  assert.equal(page.document.activeElement, socialCasino);
  assert.equal(page.document.body.dataset.sidebar, 'expanded');
  assert.deepEqual(page.calls, []);
});

test('mobile Social Casino reveals the active category and respects a manual collapse', () => {
  const page = menuPage();
  const { socialCasino, casinoItems } = page;
  page.api.openMenu();
  assert.equal(casinoItems.hidden, true);
  socialCasino.click();
  assert.equal(page.nodes['site-menu'].open, true);
  page.item('slots').click();
  page.flushClose();
  assert.equal(page.calls.at(-1), 'category:slots');

  page.api.openMenu();
  assert.equal(socialCasino.dataset.childActive, 'true');
  assert.equal(socialCasino.getAttribute('aria-expanded'), 'true');
  assert.equal(page.item('slots').getAttribute('aria-current'), 'page');
  socialCasino.click();
  page.observers[0].callback();
  assert.equal(casinoItems.hidden, true);
});

test('Partners unfolds in place with only Referral and Affiliate, and keeps hidden children out of focus', () => {
  const page = menuPage({ desktop: true });
  const partners = page.feature('partners');
  const list = partners.nextSibling;
  assert.equal(partners.getAttribute('aria-expanded'), 'false');
  assert.equal(partners.getAttribute('aria-controls'), list.id);
  assert.equal(list.hidden, true);
  assert.equal(page.feature('invite-friends').getClientRects().length, 0);
  assert.deepEqual(list.children.map(item => item.getAttribute('aria-label')), ['Referral', 'Affiliate']);
  partners.click();
  assert.equal(list.hidden, false);
  assert.equal(partners.getAttribute('aria-expanded'), 'true');
  assert.equal(page.calls.some(call => call.startsWith('feature:')), false);
  page.feature('invite-friends').focus();
  partners.click();
  assert.equal(list.hidden, true);
  assert.equal(page.document.activeElement, partners);
});

test('Partners expands from the desktop icon rail and its children close when the rail collapses', () => {
  const page = menuPage({ desktop: true });
  page.nodes['menu-toggle'].click();
  const partners = page.feature('partners');
  partners.click();
  assert.equal(page.document.body.dataset.sidebar, 'expanded');
  assert.equal(partners.nextSibling.hidden, false);
  page.nodes['menu-toggle'].click();
  assert.equal(page.document.body.dataset.sidebar, 'collapsed');
  assert.equal(partners.getAttribute('aria-expanded'), 'false');
  assert.equal(partners.nextSibling.hidden, true);
});

test('mobile Partners stays in the menu until a child is chosen and reveals the selected destination on return', () => {
  const page = menuPage();
  page.api.openMenu({ returnFocusTo: page.nodes['mobile-nav-menu'] });
  const partners = page.feature('partners');
  partners.click();
  assert.equal(page.nodes['site-menu'].open, true);
  page.feature('invite-friends').click();
  assert.equal(page.calls.includes('feature:invite-friends'), false);
  page.flushClose();
  assert.equal(page.calls.at(-1), 'feature:invite-friends');
  page.api.openMenu();
  assert.equal(partners.getAttribute('aria-expanded'), 'true');
  assert.equal(page.feature('invite-friends').getAttribute('aria-current'), 'page');
  partners.click();
  page.observers[0].callback();
  assert.equal(partners.nextSibling.hidden, true, 'unrelated state updates must not undo a manual collapse');
  partners.click();
  page.feature('affiliate-program').click();
  page.flushClose();
  assert.equal(page.calls.at(-1), 'feature:affiliate-program');
});

test('How to Play appears immediately below Settings and opens help without changing pages', () => {
  const page = menuPage({ desktop: true });
  const help = page.feature('how-to-play');
  assert.equal(page.feature('settings').nextSibling, help);
  assert.equal(help.getAttribute('aria-haspopup'), 'dialog');
  assert.equal(help.getAttribute('aria-controls'), 'how-to-play-dialog');
  help.click();
  assert.equal(page.calls.at(-1), 'help:open');
  assert.equal(page.helpCalls[0].returnFocusTo, help);
  assert.equal(page.calls.some(call => call.startsWith('feature:')), false);
  assert.equal(page.document.body.dataset.view, 'lobby');
});

test('mobile How to Play waits for menu close and restores focus to its persistent opener', () => {
  const page = menuPage();
  page.nodes['mobile-nav-menu'].visible = true;
  page.api.openMenu({ returnFocusTo: page.nodes['mobile-nav-menu'] });
  page.feature('how-to-play').click();
  assert.equal(page.nodes['site-menu'].open, false);
  assert.equal(page.helpCalls.length, 0, 'wait for the native menu close event');
  page.flushClose();
  assert.equal(page.calls.at(-1), 'help:open');
  assert.equal(page.helpCalls[0].returnFocusTo, page.nodes['mobile-nav-menu']);
});

test('drawer button accents track the selected currency only while open', () => {
  const page = menuPage();
  page.nodes['menu-toggle'].click();
  assert.equal(page.nodes['site-menu'].dataset.currency, 'GC');
  page.nodes['coin-wallet'].dataset.currency = 'SC';
  page.observers[0].callback();
  assert.equal(page.nodes['site-menu'].dataset.currency, 'SC');
  page.api.closeMenu();
  page.flushClose();
  page.nodes['coin-wallet'].dataset.currency = 'GC';
  page.observers[0].callback();
  assert.equal(page.nodes['site-menu'].dataset.currency, 'SC');
  page.nodes['menu-toggle'].click();
  assert.equal(page.nodes['site-menu'].dataset.currency, 'GC');
});

test('entering a game closes an existing menu and still allows reopening the game shell menu', () => {
  const page = menuPage();
  page.nodes['menu-toggle'].click();
  page.document.body.dataset.view = 'game';
  page.nodes['menu-toggle'].visible = false;
  page.windowEvents.hashchange();
  page.flushClose();
  assert.equal(page.nodes['site-menu'].open, false);
  assert.equal(page.document.activeElement, page.nodes['site-logo']);
  page.nodes['menu-toggle'].click();
  assert.equal(page.nodes['site-menu'].open, true);
});

test('desktop sidebar toggles without creating a modal or moving its shared content twice', () => {
  const page = menuPage({ desktop: true });
  assert.equal(page.nodes['site-sidebar'].hidden, false);
  assert.equal(page.nodes['menu-toggle'].parentElement, page.headerParent);
  assert.equal(page.nodes['menu-shortcuts'].parentElement, page.nodes['sidebar-footer']);
  assert.equal(page.nodes['menu-content'].parentElement, page.nodes['sidebar-content']);
  assert.equal(page.document.body.dataset.sidebar, 'expanded');
  assert.equal(page.nodes['menu-toggle'].getAttribute('aria-expanded'), 'true');
  assert.equal(page.nodes['site-menu'].open, false);

  page.nodes['menu-toggle'].click();
  assert.equal(page.document.body.dataset.sidebar, 'collapsed');
  assert.equal(page.nodes['site-sidebar'].dataset.expanded, 'false');
  assert.equal(page.nodes['menu-toggle'].getAttribute('aria-expanded'), 'false');
  page.nodes['menu-toggle'].click();
  assert.equal(page.document.body.dataset.sidebar, 'expanded');
  assert.equal(page.nodes['site-sidebar'].dataset.expanded, 'true');
  assert.equal(page.nodes['site-menu'].open, false);
  assert.equal(page.calls.includes('menu:open'), false);
  assert.deepEqual(page.nodes['sidebar-footer'].children, [page.nodes['menu-shortcuts']]);
  assert.deepEqual(page.nodes['sidebar-content'].children, [page.nodes['menu-content']]);
});

test('desktop collection, Providers and BUY actions run immediately without a drawer close event', () => {
  const page = menuPage({ desktop: true });
  page.socialCasino.click();
  page.item('popular').click();
  assert.equal(page.calls.at(-1), 'category:popular');
  assert.equal(page.document.activeElement, page.pageHeading);
  page.item('providers').click();
  assert.equal(page.calls.at(-1), 'category:providers');
  assert.equal(page.providerCalls.length, 1);
  assert.equal(page.providerCalls[0], undefined);
  page.nodes['menu-buy'].click();
  assert.equal(page.document.body.dataset.page, 'store');
  assert.equal(page.document.activeElement, page.pageHeading);
  assert.equal(page.calls.some(call => call === 'menu:open' || call === 'menu:close'), false);
  page.flushClose();
  assert.equal(page.calls.at(-1), 'store:open');
});

test('switching an open mobile drawer to desktop closes it while the bottom bar stays in its original parent', () => {
  const page = menuPage();
  assert.equal(page.nodes['site-sidebar'].hidden, true);
  page.nodes['menu-toggle'].click();
  assert.equal(page.nodes['site-menu'].open, true);
  assert.equal(page.nodes['mobile-nav'].parentElement, page.document.body);
  page.resize(true);
  assert.equal(page.nodes['mobile-nav'].parentElement, page.document.body);
  assert.equal(page.nodes['site-menu'].open, false);
  assert.equal(page.nodes['site-sidebar'].hidden, false);
  assert.equal(page.nodes['menu-toggle'].parentElement, page.headerParent);
  assert.equal(page.nodes['menu-shortcuts'].parentElement, page.nodes['sidebar-footer']);
  assert.equal(page.nodes['menu-content'].parentElement, page.nodes['sidebar-content']);
  assert.equal(page.document.body.dataset.sidebar, 'expanded');
  page.flushClose();
  assert.ok(page.observers[0].targets.length > 0, 'desktop observation survives a queued native close event');
  page.nodes['menu-toggle'].click();
  assert.equal(page.document.body.dataset.sidebar, 'collapsed');
  assert.equal(page.nodes['site-menu'].open, false);
});

test('switching an expanded desktop sidebar to mobile restores the header and starts with a closed drawer', () => {
  const page = menuPage({ desktop: true });
  page.resize(false);
  page.flushClose();
  assert.equal(page.nodes['site-sidebar'].hidden, true);
  assert.equal(page.nodes['menu-toggle'].parentElement, page.headerParent);
  assert.deepEqual(page.headerParent.children, [page.nodes['menu-toggle'], page.nodes['site-logo']]);
  assert.equal(page.nodes['menu-shortcuts'].parentElement, page.nodes['menu-mobile-header']);
  assert.deepEqual(page.nodes['menu-mobile-header'].children, [page.nodes['menu-shortcuts']]);
  assert.equal(page.nodes['menu-content'].parentElement, page.nodes['site-menu']);
  assert.equal(page.nodes['site-menu'].open, false);
  assert.equal(page.nodes['menu-toggle'].getAttribute('aria-expanded'), 'false');
  page.nodes['menu-toggle'].click();
  assert.equal(page.nodes['site-menu'].open, true);
  assert.equal(page.document.activeElement, page.nodes['menu-buy']);
  assert.equal(page.nodes['menu-content'].parentElement, page.nodes['site-menu']);
});

test('collapsed desktop navigation shows one custom tooltip for pointer and keyboard interaction', () => {
  const page = menuPage({ desktop: true });
  page.nodes['menu-toggle'].click();
  const item = page.socialCasino;
  const sidebar = page.nodes['site-sidebar'];
  const tooltip = page.nodes['menu-tooltip'];
  item.bounds = { left: 8, right: 52, top: 160, bottom: 204, width: 44, height: 44 };

  assert.equal(item.getAttribute('title'), null, 'the custom label must not compete with a native title');
  assert.equal(tooltip.hidden, true);
  sidebar.emit('pointerover', { target: item.children[0] });
  assert.equal(tooltip.hidden, false);
  assert.equal(tooltip.textContent, 'Social Casino');
  assert.equal(item.getAttribute('aria-describedby'), 'menu-tooltip');
  assert.ok(Number.parseFloat(tooltip.style.left) > item.bounds.right);
  sidebar.emit('pointerout', { target: item, relatedTarget: null });
  assert.equal(tooltip.hidden, true);
  assert.equal(item.getAttribute('aria-describedby'), null);

  sidebar.emit('focusin', { target: item });
  assert.equal(tooltip.hidden, false);
  assert.equal(tooltip.textContent, 'Social Casino');
  sidebar.emit('focusout', { target: item, relatedTarget: null });
  assert.equal(tooltip.hidden, true);
});

test('expanded and mobile navigation never show collapsed-rail tooltips', () => {
  const page = menuPage({ desktop: true });
  page.nodes['menu-toggle'].click();
  const item = page.socialCasino;
  const sidebar = page.nodes['site-sidebar'];
  const tooltip = page.nodes['menu-tooltip'];
  sidebar.emit('focusin', { target: item });
  assert.equal(tooltip.hidden, false);

  page.nodes['menu-toggle'].click();
  assert.equal(tooltip.hidden, true, 'expansion clears a visible collapsed label');
  sidebar.emit('pointerover', { target: item });
  sidebar.emit('focusin', { target: item });
  assert.equal(tooltip.hidden, true);

  page.resize(false);
  page.nodes['menu-toggle'].click();
  assert.equal(page.nodes['site-menu'].open, true);
  sidebar.emit('pointerover', { target: item });
  sidebar.emit('focusin', { target: item });
  assert.equal(tooltip.hidden, true);
  assert.equal(item.getAttribute('aria-describedby'), null);
});

test('collapsed tooltips are dismissed by navigation but remain available in the game shell', () => {
  const page = menuPage({ desktop: true });
  page.nodes['menu-toggle'].click();
  const item = page.socialCasino;
  const sidebar = page.nodes['site-sidebar'];
  const tooltip = page.nodes['menu-tooltip'];
  sidebar.emit('pointerover', { target: item });
  assert.equal(tooltip.hidden, false);
  page.nodes['menu-content'].emit('scroll');
  assert.equal(tooltip.hidden, true);

  page.nodes['other-dialog'].open = true;
  sidebar.emit('focusin', { target: item });
  assert.equal(tooltip.hidden, true);
  page.nodes['other-dialog'].open = false;
  sidebar.emit('pointerover', { target: item });
  assert.equal(tooltip.hidden, false);
  page.document.body.dataset.view = 'game';
  page.windowEvents.hashchange();
  assert.equal(tooltip.hidden, true);
  sidebar.emit('pointerover', { target: item });
  assert.equal(tooltip.hidden, false);
});

test('game shell menu preserves the game until BUY opens the Store page', () => {
  const page = menuPage({ routeFromGame: true });
  page.document.body.dataset.view = 'game';
  page.nodes['mobile-nav-menu'].visible = true;
  page.api.openMenu({ returnFocusTo: page.nodes['mobile-nav-menu'] });
  assert.equal(page.nodes['site-menu'].open, true);
  page.api.closeMenu();
  page.flushClose();
  assert.equal(page.document.activeElement, page.nodes['mobile-nav-menu']);
  assert.equal(page.document.body.dataset.view, 'game');
  assert.equal(page.calls.includes('lobby:return'), false);

  page.api.openMenu({ returnFocusTo: page.nodes['mobile-nav-menu'] });
  page.nodes['mobile-nav-menu'].visible = false;
  page.api.closeMenu();
  page.flushClose();
  assert.equal(page.document.activeElement, page.nodes['menu-toggle'], 'a hidden game opener falls back to the visible shell menu control');
  page.nodes['mobile-nav-menu'].visible = true;

  page.api.openMenu({ returnFocusTo: page.nodes['mobile-nav-menu'] });
  page.nodes['menu-buy'].click();
  page.flushClose();
  assert.equal(page.document.body.dataset.page, 'store');
  assert.equal(page.document.body.dataset.view, 'lobby');
  assert.equal(page.document.activeElement, page.pageHeading);
  assert.equal(page.calls.includes('lobby:return'), false);
});

test('game shell category and provider navigation opens its own destination after menu close', () => {
  for (const id of ['popular', 'providers']) {
    const page = menuPage({ routeFromGame: true });
    page.document.body.dataset.view = 'game';
    page.api.openMenu({ returnFocusTo: page.nodes['bottom-menu'] });
    page.socialCasino.click();
    page.item(id).click();
    assert.equal(page.calls.includes('lobby:return'), false, 'the menu closes before game routing');
    page.flushClose();
    assert.equal(page.calls.includes('lobby:return'), false, 'routing owns game cleanup without resetting the lobby');
    assert.equal(page.document.body.dataset.view, 'lobby');
    assert.equal(page.calls.at(-1), `category:${id}`);
  }
});

test('Escape collapses an expanded desktop sidebar without also leaving the game', () => {
  const page = menuPage({ desktop: true, routeFromGame: true });
  page.document.body.dataset.view = 'game';
  assert.equal(page.document.body.dataset.sidebar, 'expanded');
  const event = page.nodes['site-sidebar'].emit('keydown', { key: 'Escape' });
  assert.equal(event.defaultPrevented, true);
  assert.equal(page.document.body.dataset.sidebar, 'collapsed');
  assert.equal(page.document.body.dataset.view, 'game');
  assert.equal(page.calls.includes('lobby:return'), false);
});

test('menu dismissal uses the logo if every remembered or menu control is hidden', () => {
  const page = menuPage();
  page.document.body.dataset.view = 'game';
  page.api.openMenu({ returnFocusTo: page.nodes['bottom-menu'] });
  page.nodes['bottom-menu'].visible = false;
  page.nodes['menu-toggle'].visible = false;
  page.nodes['mobile-nav-menu'].visible = false;
  page.api.closeMenu();
  page.flushClose();
  assert.equal(page.document.activeElement, page.nodes['site-logo']);
});


test('mobile menu leaves one persistent bottom navigation in place through open, close and deferred actions', () => {
  const page = menuPage();
  const nav = page.nodes['mobile-nav'];
  const opener = page.nodes['mobile-nav-menu'];
  opener.visible = true;
  page.nodes['menu-toggle'].visible = false;
  assert.equal(nav.parentElement, page.document.body);
  assert.equal(nav.nextSibling, page.nodes['site-menu']);

  page.api.openMenu({ returnFocusTo: opener });
  assert.equal(nav.parentElement, page.document.body);
  assert.equal(nav.children[0], opener, 'the same controls remain in the fixed application bar');
  assert.equal(nav.nextSibling, page.nodes['site-menu']);
  assert.equal(page.nodes['site-menu'].contains(nav), false, 'the menu must not acquire a separate bottom navigation');

  let actionRan = false;
  page.api.closeMenu(() => {
    assert.equal(page.nodes['site-menu'].open, false);
    assert.equal(nav.parentElement, page.document.body);
    actionRan = true;
  });
  assert.equal(nav.parentElement, page.document.body, 'the bottom bar never moves while the close action is pending');
  assert.equal(nav.nextSibling, page.nodes['site-menu'], 'the original document position is unchanged');
  assert.equal(actionRan, false);
  page.flushClose();
  assert.equal(actionRan, true);

  page.api.openMenu({ returnFocusTo: opener });
  assert.equal(nav.parentElement, page.document.body);
  page.api.closeMenu();
  page.flushClose();
  assert.equal(nav.parentElement, page.document.body);
  assert.equal(page.document.activeElement, opener);
});

test('mobile menu makes only the background inert and restores each prior state before destination actions', () => {
  const page = menuPage();
  page.nodes['game-view'].inert = true;
  page.nodes['mobile-nav-menu'].visible = true;
  page.api.openMenu({ returnFocusTo: page.nodes['mobile-nav-menu'] });
  for (const id of ['lobby-view', 'game-view', 'store-view', 'feature-view', 'game-details-view', 'site-sidebar']) {
    assert.equal(page.nodes[id].inert, true, id);
  }
  assert.equal(page.headerParent.inert, true);
  assert.equal(page.nodes['site-menu'].inert, false);
  assert.equal(page.nodes['mobile-nav'].inert, false);
  page.nodes['site-logo'].focus();
  assert.equal(page.document.activeElement, page.nodes['menu-buy'], 'the background cannot acquire focus');
  page.nodes['mobile-nav-profile'].focus();
  assert.equal(page.document.activeElement, page.nodes['mobile-nav-profile'], 'the fixed navigation remains interactive');

  let actionRan = false;
  page.api.closeMenu(() => {
    actionRan = true;
    assert.equal(page.nodes['lobby-view'].inert, false);
    assert.equal(page.headerParent.inert, false);
    assert.equal(page.nodes['game-view'].inert, true, 'previous inert states must not be erased');
  });
  assert.equal(page.nodes['lobby-view'].inert, false, 'release the shell before the native close handoff');
  assert.equal(actionRan, false);
  page.flushClose();
  assert.equal(actionRan, true);
});

test('mobile focus cycles through the menu and the permanent bottom bar and document Escape closes it', () => {
  const page = menuPage();
  const opener = page.nodes['mobile-nav-menu'];
  opener.visible = true;
  page.api.openMenu({ returnFocusTo: opener });
  assert.equal(page.document.activeElement, page.nodes['menu-buy']);
  assert.equal(page.keydown('Tab', { shiftKey: true }).defaultPrevented, true);
  assert.equal(page.document.activeElement, page.nodes['mobile-nav-profile']);
  assert.equal(page.keydown('Tab').defaultPrevented, true);
  assert.equal(page.document.activeElement, page.nodes['menu-buy']);

  page.nodes['mobile-nav-profile'].disabled = true;
  page.nodes['mobile-nav-redeem'].visible = false;
  page.keydown('Tab', { shiftKey: true });
  assert.equal(page.document.activeElement, page.nodes['mobile-nav-lobby'], 'skip hidden and disabled controls');
  assert.equal(page.keydown('Tab', { ctrlKey: true }).defaultPrevented, false, 'browser shortcuts stay available');
  assert.equal(page.keydown('Escape').defaultPrevented, true);
  assert.equal(page.nodes['site-menu'].open, false);
  page.flushClose();
  assert.equal(page.document.activeElement, opener);
  assert.equal(page.keydown('Tab').defaultPrevented, false, 'normal page focus resumes after dismissal');
});

test('switching to desktop releases mobile background inert state without moving the fixed bar', () => {
  const page = menuPage();
  page.api.openMenu();
  assert.equal(page.nodes['lobby-view'].inert, true);
  page.resize(true);
  assert.equal(page.nodes['lobby-view'].inert, false);
  assert.equal(page.headerParent.inert, false);
  assert.equal(page.nodes['mobile-nav'].parentElement, page.document.body);
  assert.equal(page.nodes['site-sidebar'].inert, false);
  assert.equal(page.nodes['site-menu'].open, false);
  page.flushClose();
  assert.equal(page.keydown('Tab').defaultPrevented, false);
});
