let initialized = false;

export function initMobileNav({ openMenu, closeMenu, openHome, openStore, openFeature } = {}) {
  if (initialized) return;
  const nav = document.querySelector('#mobile-nav');
  const categories = document.querySelector('#catalog-categories');
  const dialogs = {
    menu: document.querySelector('#site-menu'),
  };
  const buttons = new Map(['menu', 'store', 'lobby', 'redeem', 'profile']
    .map(action => [action, document.querySelector(`#mobile-nav-${action}`)]));
  if (![nav, categories, ...Object.values(dialogs), ...buttons.values()].every(Boolean)) return;
  initialized = true;

  const desktopMedia = window.matchMedia('(width > 1024px)');

  function sync() {
    const selected = dialogs.menu.open ? 'menu'
      : document.body.dataset.view === 'game' || document.body.dataset.page === 'game-details' ? null
        : ['redeem', 'profile'].includes(categories.dataset.activeMenu) ? categories.dataset.activeMenu
        : document.body.dataset.page === 'store' || categories.dataset.activeMenu === 'store' ? 'store'
        : ['feature', 'search', 'providers'].includes(document.body.dataset.page)
          || ['search', 'providers'].includes(categories.dataset.activeMenu) ? 'menu' : 'lobby';
    for (const [action, button] of buttons) {
      const active = action === selected;
      button.dataset.active = String(active);
      if (active && action !== 'menu') button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
      if (dialogs[action]) button.setAttribute('aria-expanded', String(dialogs[action].open));
    }
  }

  function performAction(action, button) {
    switch (action) {
      case 'menu':
        openMenu?.({ returnFocusTo: button });
        break;
      case 'lobby':
        openHome?.();
        break;
      case 'store':
        openStore?.();
        break;
      case 'redeem':
      case 'profile':
        openFeature?.(action);
        break;
    }
    sync();
  }

  function activate(action, button) {
    if (desktopMedia.matches || document.querySelector('dialog[open]:not(#site-menu)')) return;
    if (dialogs.menu.open) {
      if (!closeMenu) return;
      if (action === 'menu') closeMenu();
      else closeMenu(() => performAction(action, button));
      sync();
      return;
    }
    performAction(action, button);
  }

  for (const [action, button] of buttons) button.addEventListener('click', () => activate(action, button));

  const observer = new MutationObserver(sync);
  observer.observe(categories, { attributes: true, attributeFilter: ['data-active-menu'] });
  observer.observe(document.body, { attributes: true, attributeFilter: ['data-view', 'data-page'] });
  for (const dialog of Object.values(dialogs)) {
    observer.observe(dialog, { attributes: true, attributeFilter: ['open'] });
  }
  desktopMedia.addEventListener('change', sync);
  nav.hidden = false;
  document.body.dataset.mobileNav = 'true';
  sync();
}
