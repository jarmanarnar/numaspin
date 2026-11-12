import { STORE_PACKAGES, getStorePackage, formatPackagePrice } from './store-packages.js';

let controller;
function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function coin(code, size = 32) {
  const img = node('img', 'coin-art');
  Object.assign(img, { src: `assets/coins/${code === 'GC' ? 'gold' : 'sweeps'}-coin.svg`,
    alt: '', width: size, height: size });
  img.setAttribute('aria-hidden', 'true');
  return img;
}
function renderPackages(list, headingTag) {
  for (const packageInfo of STORE_PACKAGES) {
    const card = node('li', packageInfo.featured ? 'store-package store-package--featured' : 'store-package');
    card.dataset.packageId = packageInfo.id;
    if (packageInfo.badge) card.append(node('span', 'store-package__badge', packageInfo.badge));
    const heading = node(headingTag, 'store-package__amount');
    heading.append(coin('GC'), node('span', '', packageInfo.goldLabel), node('span', 'visually-hidden', 'Gold Coins'));
    const art = node('div', 'store-package__art');
    art.setAttribute('aria-hidden', 'true');
    if (!packageInfo.featured) {
      art.append(coin('GC', 64));
      if (packageInfo.sweepsCoins) art.append(coin('SC', 44));
    }
    const bonus = node('p', 'store-package__bonus');
    bonus.append(coin('SC', 20), node('strong', '', String(packageInfo.sweepsCoins)), node('span', '', 'FREE'), node('span', 'visually-hidden', 'Sweeps Coins'));
    const price = node('button', 'store-package__price', formatPackagePrice(packageInfo));
    price.type = 'button';
    price.dataset.package = packageInfo.id;
    price.setAttribute('aria-haspopup', 'dialog');
    price.setAttribute('aria-controls', 'phone-verification-dialog');
    price.setAttribute('aria-label', `Buy ${packageInfo.goldLabel} GC${packageInfo.sweepsCoins ? ` plus ${packageInfo.sweepsCoins} free SC` : ''} for ${formatPackagePrice(packageInfo)}`);
    card.append(heading, art, bonus, price);
    list.append(card);
  }
}

export function initStoreView({ router, account, auth, verifyPhone } = {}) {
  if (controller || !router || !account || !auth || !verifyPhone) return controller;
  const view = document.querySelector('#store-view');
  const pageList = document.querySelector('#store-packages');
  const storeDialog = document.querySelector('#store-dialog');
  const dialogList = document.querySelector('#store-dialog-packages');
  if (![view, pageList, storeDialog, dialogList].every(Boolean)) return;

  renderPackages(pageList, 'h2');
  renderPackages(dialogList, 'h3');

  function buyPackage(event) {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('[data-package]');
    if (button && getStorePackage(button.dataset.package)) verifyPhone();
  }
  pageList.addEventListener('click', buyPackage);
  dialogList.addEventListener('click', buyPackage);

  storeDialog.addEventListener('click', event => {
    if (event.target !== storeDialog) return;
    const rect = storeDialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) storeDialog.close();
  });

  const desktop = window.matchMedia('(min-width: 45rem)');
  const entryPoints = document.querySelectorAll('#header-buy-coins, #menu-buy, #wallet-add');
  function syncEntryPoints() {
    for (const button of entryPoints) {
      button.setAttribute('aria-controls', desktop.matches ? storeDialog.id : view.id);
      if (desktop.matches) button.setAttribute('aria-haspopup', 'dialog');
      else button.removeAttribute('aria-haspopup');
    }
  }
  desktop.addEventListener('change', syncEntryPoints);
  syncEntryPoints();

  function openStore() {
    if (!desktop.matches) return router.navigate({ type: 'store' });
    return auth.require(() => {
      if (!desktop.matches) return router.navigate({ type: 'store' });
      if (document.querySelector('dialog[open]')) return;
      storeDialog.showModal();
      storeDialog.scrollTop = 0;
    });
  }

  account.subscribe(() => { if (!account.isSignedIn()) storeDialog.close(); });

  function render(route, meta = {}) {
    storeDialog.close();
    view.hidden = route.type !== 'store';
    if (!view.hidden) {
      document.body.dataset.page = 'store';
      document.title = 'Store · NUMA SPIN';
      if (meta.source === 'navigate' && meta.focus !== false) view.querySelector('h1').focus({ preventScroll: true });
    }
  }
  router.subscribe(render);
  render(router.getRoute());
  controller = { openStore };
  return controller;
}
