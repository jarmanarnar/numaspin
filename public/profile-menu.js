import { formatRoute, parseRoute } from './routes.js';
import { createShelfIcon } from './shelf-icons.js';

export function initProfileMenu({ router, account, openFeature, notifications } = {}) {
  const trigger = document.querySelector('#header-profile');
  const panel = document.querySelector('#profile-menu');
  if (!trigger || !panel) return;

  for (const item of panel.querySelectorAll('[data-profile-icon]')) {
    const icon = createShelfIcon(item.dataset.profileIcon);
    icon.setAttribute('class', 'profile-menu__icon');
    item.prepend(icon);
  }

  const status = panel.querySelector('#profile-menu-status');
  const links = panel.querySelectorAll('a[href^="#/"]');
  let signingOut = false;

  function close(restoreFocus = false) {
    if (panel.hidden) return;
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus && !trigger.hidden) trigger.focus({ preventScroll: true });
  }

  function open() {
    if (!account.isSignedIn()) return;
    if (status && !signingOut) status.textContent = '';
    panel.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    trigger.focus({ preventScroll: true });
  }

  async function logout(button) {
    if (signingOut) return;
    signingOut = true;
    button.setAttribute('aria-disabled', 'true');
    if (status) status.textContent = '';
    try {
      const result = await account.logout();
      if (!result.ok) throw new Error(result.reason);
      const focused = document.activeElement;
      if (focused === document.body || focused === trigger || panel.contains(focused)) {
        document.querySelector('#guest-header-actions [data-auth-open="login"]')?.focus({ preventScroll: true });
      }
    } catch {
      if (status) status.textContent = 'Unable to log out. Please try again.';
    } finally {
      signingOut = false;
      button.removeAttribute('aria-disabled');
    }
  }

  const actions = {
    notifications() {
      close(true);
      notifications.open({ returnFocusTo: trigger });
    },
    redeem() {
      notifications.close({ restoreFocus: false });
      close(true);
      openFeature('redeem');
    },
    logout,
  };

  trigger.addEventListener('click', () => { if (panel.hidden) open(); else close(true); });
  trigger.addEventListener('keydown', event => {
    if (event.key !== 'ArrowDown' || !account.isSignedIn()) return;
    event.preventDefault();
    if (panel.hidden) open();
    panel.querySelector('a[href], button:not(:disabled)')?.focus({ preventScroll: true });
  });

  panel.addEventListener('click', event => {
    const button = event.target.closest('button[data-profile-action]');
    if (button && Object.hasOwn(actions, button.dataset.profileAction)) {
      actions[button.dataset.profileAction](button);
      return;
    }
    const link = event.target.closest('a[href^="#/"]');
    if (!link || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    close(true);
    router.navigate(parseRoute(link.hash));
  });

  function dismissOutside(event) {
    if (!trigger.contains(event.target) && !panel.contains(event.target)) close();
  }
  document.addEventListener('pointerdown', dismissOutside);
  document.addEventListener('focusin', dismissOutside);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || panel.hidden) return;
    event.preventDefault();
    event.stopPropagation();
    close(true);
  }, { capture: true });

  function syncRoute(route) {
    close();
    const hash = formatRoute(route);
    for (const link of links) {
      if (link.hash === hash) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  }
  account.subscribe(() => { if (!account.isSignedIn()) close(); });
  router.subscribe(syncRoute);
  syncRoute(router.getRoute());
}
