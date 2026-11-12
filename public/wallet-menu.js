import { CURRENCIES, formatBalance } from './wallet-state.js';

export function initWalletMenu({ account, router, openStore, selectCurrency, document: doc = document } = {}) {
  const shell = doc.querySelector('#header-wallet-controls');
  const panel = doc.querySelector('#wallet-currency-menu');
  const trigger = doc.querySelector('#coin-type-switch');
  if (!shell || !panel || !trigger) return null;
  const coin = doc.querySelector('#currency-coin');
  const hide = doc.querySelector('#wallet-hide-balance');
  const feedback = doc.querySelector('#wallet-menu-status');
  const tabFeedback = doc.querySelector('#wallet-tabs-status');
  const segmentedWallet = doc.defaultView?.matchMedia('(min-width: 22.5rem)');
  const avatar = doc.querySelector('#header-avatar');
  const options = new Map(['GC', 'SC'].map(code => [code, {
    row: doc.querySelector(`#wallet-row-${code}`),
    button: doc.querySelector(`#wallet-select-${code}`),
    amount: doc.querySelector(`#wallet-amount-${code}`),
    tab: doc.querySelector(`#wallet-tab-${code}`),
    tabAmount: doc.querySelector(`#wallet-tab-amount-${code}`),
  }]));
  let busy = false;

  function close(focus = false) {
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (focus) trigger.focus({ preventScroll: true });
  }
  function render() {
    const { wallet } = account.getSnapshot();
    const member = account.getMemberState();
    const hidden = member.settings.hideBalance;
    const code = wallet.currency;
    trigger.setAttribute('role', 'button');
    trigger.removeAttribute('aria-checked');
    trigger.dataset.action = 'currencies';
    trigger.title = 'Choose currency';
    trigger.setAttribute('aria-label', hidden ? `${code} balance hidden. Choose currency`
      : `${code} balance: ${formatBalance(code, wallet.balances[code])}. Choose currency`);
    coin.src = code === 'GC' ? 'assets/coins/gold-coin.svg' : 'assets/coins/sweeps-coin.svg';
    hide.setAttribute('aria-checked', String(hidden));
    hide.disabled = busy;
    for (const [currency, option] of options) {
      const isActive = currency === code;
      const pressed = String(isActive);
      const amount = hidden ? '••••••' : formatBalance(currency, wallet.balances[currency]);
      const label = `${CURRENCIES[currency].name}, ${hidden ? 'balance hidden' : amount}`;
      option.row.dataset.active = pressed;
      option.button.setAttribute('aria-pressed', pressed);
      option.button.setAttribute('aria-label', label);
      option.amount.textContent = amount;
      option.button.disabled = busy;
      if (option.tab && option.tabAmount) {
        option.tab.setAttribute('aria-pressed', pressed);
        option.tab.setAttribute('aria-label', isActive ? label : `${CURRENCIES[currency].name} (${currency})`);
        option.tab.setAttribute('aria-disabled', String(busy));
        option.tabAmount.textContent = isActive ? amount : currency;
      }
    }
    if (avatar) avatar.textContent = member.profile.avatar || 'L';
    if (!account.isSignedIn()) close();
  }
  function toggle() {
    if (!account.isSignedIn()) return;
    const opening = panel.hidden;
    panel.hidden = !opening;
    trigger.setAttribute('aria-expanded', String(opening));
    feedback.textContent = '';
  }
  async function save(action, dismiss = false, status = feedback) {
    if (busy) return;
    busy = true;
    status.textContent = '';
    render();
    try {
      const result = await action();
      if (result === false || result?.ok === false) throw new Error('Save failed');
      if (dismiss) close(true);
    } catch { status.textContent = 'Unable to save. Please try again.'; }
    finally { busy = false; render(); }
  }
  for (const [code, option] of options) {
    option.button.addEventListener('click', () => save(() => selectCurrency(code), true));
    option.tab?.addEventListener('click', () => {
      if (!account.isSignedIn() || account.getSnapshot().wallet.currency === code) return;
      return save(() => selectCurrency(code), false, tabFeedback || feedback);
    });
  }
  segmentedWallet?.addEventListener('change', () => close());
  doc.querySelector('#header-buy-coins').addEventListener('click', () => { close(); openStore?.(); });
  hide.addEventListener('click', () => save(() => account.saveSettings({ hideBalance: !account.getMemberState().settings.hideBalance })));
  trigger.addEventListener('keydown', event => {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    if (panel.hidden) toggle();
    options.get(account.getSnapshot().wallet.currency).button.focus();
  });
  doc.addEventListener('pointerdown', event => { if (!panel.hidden && !shell.contains(event.target)) close(); });
  doc.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); close(true); }
  });
  account.subscribe(render);
  router?.subscribe(() => close());
  render();
  return { toggle, render, close };
}
