import assert from 'node:assert/strict';
import test from 'node:test';
import { IDBFactory } from 'fake-indexeddb';
import { openDemoAccount } from '../public/demo-account.js';
import { initWalletMenu } from '../public/wallet-menu.js';

async function menuPage({ selectCurrency = (account, code) => account.selectCurrency(code) } = {}) {
  const account = await openDemoAccount({ indexedDB: new IDBFactory(), scope: undefined });
  await account.register({ email: 'wallet-menu@example.test', password: 'WalletMenu37!', accepted: true });
  const ids = ['header-wallet-controls', 'wallet-currency-menu', 'coin-type-switch', 'currency-coin',
    'wallet-hide-balance', 'wallet-menu-status', 'wallet-tabs-status', 'header-avatar', 'header-buy-coins',
    ...['GC', 'SC'].flatMap(code => [
      `wallet-row-${code}`, `wallet-select-${code}`, `wallet-amount-${code}`,
      `wallet-tab-${code}`, `wallet-tab-amount-${code}`,
    ])];
  const nodes = Object.fromEntries(ids.map(id => [id, {
    hidden: id === 'wallet-currency-menu', attributes: {}, dataset: {}, listeners: {}, textContent: '',
    setAttribute(key, value) { this.attributes[key] = value; },
    removeAttribute(key) { delete this.attributes[key]; },
    addEventListener(key, callback) { this.listeners[key] = callback; },
    focus() { this.focused = true; },
    click() { return this.listeners.click?.(); },
  }]));
  nodes['header-wallet-controls'].contains = target => Object.values(nodes).includes(target);
  const events = {}, routes = [], stores = [];
  const menu = initWalletMenu({ account,
    document: { querySelector: selector => nodes[selector.slice(1)], addEventListener: (key, callback) => { events[key] = callback; } },
    router: { subscribe: callback => routes.push(callback) },
    selectCurrency: code => selectCurrency(account, code), openStore: () => stores.push('store'),
  });
  return { account, nodes, events, stores, menu, route: () => routes.forEach(callback => callback()) };
}

test('currency menu uses real balances, masks both currencies and preserves the ledger and other settings', async () => {
  const page = await menuPage();
  try {
    const { account, nodes, menu } = page;
    const ledger = account.getSnapshot().ledger;
    const balances = account.getSnapshot().wallet.balances;
    assert.equal(nodes['wallet-amount-GC'].textContent, '125,000');
    assert.equal(nodes['wallet-amount-SC'].textContent, '15.00');
    menu.toggle();
    await nodes['wallet-select-SC'].click();
    assert.equal(account.getSnapshot().wallet.currency, 'SC');
    assert.equal(nodes['wallet-select-SC'].attributes['aria-pressed'], 'true');
    assert.equal(nodes['wallet-currency-menu'].hidden, true);
    assert.equal(nodes['currency-coin'].src, 'assets/coins/sweeps-coin.svg');
    await account.saveSettings({ reducedMotion: true });
    menu.toggle();
    await nodes['wallet-hide-balance'].click();
    assert.equal(account.getMemberState().settings.hideBalance, true);
    assert.equal(account.getMemberState().settings.reducedMotion, true);
    assert.equal(nodes['wallet-amount-GC'].textContent, '••••••');
    assert.equal(nodes['wallet-amount-SC'].textContent, '••••••');
    assert.equal(nodes['coin-type-switch'].attributes['aria-label'], 'SC balance hidden. Choose currency');
    assert.doesNotMatch(nodes['wallet-select-SC'].attributes['aria-label'], /15\.00/);
    nodes['header-buy-coins'].click();
    assert.deepEqual(page.stores, ['store']);
    assert.equal(account.getSnapshot().wallet.currency, 'SC');
    assert.deepEqual(account.getSnapshot().wallet.balances, balances);
    assert.deepEqual(account.getSnapshot().ledger, ledger);
    assert.equal(nodes['wallet-currency-menu'].hidden, true);
  } finally { page.account.close(); }
});

test('currency segments show only the active balance and honor balance privacy', async () => {
  const page = await menuPage();
  try {
    const { account, nodes, menu } = page;
    const { wallet, ledger } = account.getSnapshot();
    assert.equal(nodes['wallet-tab-GC'].attributes['aria-pressed'], 'true');
    assert.equal(nodes['wallet-tab-SC'].attributes['aria-pressed'], 'false');
    assert.equal(nodes['wallet-tab-amount-GC'].textContent, '125,000');
    assert.equal(nodes['wallet-tab-amount-SC'].textContent, 'SC');
    assert.equal(nodes['wallet-tab-SC'].attributes['aria-label'], 'Sweeps Coins (SC)');
    await nodes['wallet-tab-SC'].click();
    assert.equal(account.getSnapshot().wallet.currency, 'SC');
    assert.equal(nodes['wallet-tab-SC'].attributes['aria-pressed'], 'true');
    assert.equal(nodes['wallet-tab-GC'].attributes['aria-pressed'], 'false');
    assert.equal(nodes['wallet-tab-amount-SC'].textContent, '15.00');
    assert.equal(nodes['wallet-tab-amount-GC'].textContent, 'GC');
    assert.equal(nodes['wallet-tab-GC'].attributes['aria-label'], 'Gold Coins (GC)');
    assert.equal(nodes['wallet-select-SC'].attributes['aria-pressed'], 'true');
    assert.equal(nodes['wallet-currency-menu'].hidden, true);
    assert.deepEqual(account.getSnapshot().wallet.balances, wallet.balances);
    assert.deepEqual(account.getSnapshot().ledger, ledger);

    await account.saveSettings({ hideBalance: true });
    assert.equal(nodes['wallet-tab-amount-SC'].textContent, '••••••');
    assert.equal(nodes['wallet-tab-amount-GC'].textContent, 'GC');
    assert.equal(nodes['wallet-tab-SC'].attributes['aria-label'], 'Sweeps Coins, balance hidden');

    menu.toggle();
    await nodes['wallet-select-GC'].click();
    assert.equal(nodes['wallet-tab-GC'].attributes['aria-pressed'], 'true');
    assert.equal(nodes['wallet-tab-SC'].attributes['aria-pressed'], 'false');
    assert.equal(nodes['wallet-tab-amount-GC'].textContent, '••••••');
    assert.equal(nodes['wallet-tab-amount-SC'].textContent, 'SC');
  } finally { page.account.close(); }
});

test('a failed currency segment change reports the error and retains the active currency', async () => {
  const page = await menuPage({ selectCurrency: () => false });
  try {
    const { account, nodes } = page;
    await nodes['wallet-tab-SC'].click();
    assert.match(nodes['wallet-tabs-status'].textContent, /unable to save/i);
    assert.equal(account.getSnapshot().wallet.currency, 'GC');
    assert.equal(nodes['wallet-tab-GC'].attributes['aria-pressed'], 'true');
    assert.equal(nodes['wallet-tab-SC'].attributes['aria-disabled'], 'false');
  } finally { page.account.close(); }
});

test('wallet menu supports keyboard entry, Escape, outside dismissal, routing and logout', async () => {
  const page = await menuPage();
  try {
    const { nodes, menu, events } = page;
    nodes['coin-type-switch'].listeners.keydown({ key: 'ArrowDown', preventDefault() {} });
    assert.equal(nodes['wallet-currency-menu'].hidden, false);
    assert.equal(nodes['wallet-select-GC'].focused, true);
    events.keydown({ key: 'Escape', preventDefault() {} });
    assert.equal(nodes['wallet-currency-menu'].hidden, true);
    assert.equal(nodes['coin-type-switch'].focused, true);
    menu.toggle();
    events.pointerdown({ target: nodes['wallet-hide-balance'] });
    assert.equal(nodes['wallet-currency-menu'].hidden, false);
    events.pointerdown({ target: {} });
    assert.equal(nodes['wallet-currency-menu'].hidden, true);
    menu.toggle();
    page.route();
    assert.equal(nodes['wallet-currency-menu'].hidden, true);
    menu.toggle();
    nodes['header-buy-coins'].click();
    assert.deepEqual(page.stores, ['store']);
    assert.equal(nodes['wallet-currency-menu'].hidden, true);
    menu.toggle();
    await page.account.logout();
    assert.equal(nodes['wallet-currency-menu'].hidden, true);
    menu.toggle();
    assert.equal(nodes['wallet-currency-menu'].hidden, true);
  } finally { page.account.close(); }
});
