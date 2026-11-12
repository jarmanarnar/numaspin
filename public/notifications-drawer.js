import { dailyStatus } from './member-state.js';
import { formatRoute } from './routes.js';
import { createShelfIcon } from './shelf-icons.js';

const dailyBonusRoute = { type: 'feature', pageId: 'daily-bonus' };
const platformNotices = [
  { id: 'platform:new-releases', title: 'Explore New Releases', detail: 'See the latest additions to the demo catalog.',
    action: 'Browse games', route: { type: 'category', categoryId: 'new-releases' }, icon: 'new-releases' },
  { id: 'platform:daily-bonus', title: 'Daily Bonus', detail: 'Check today’s demo reward and your seven-day streak.',
    action: 'View Daily Bonus', route: dailyBonusRoute, art: 'gift' },
  { id: 'platform:providers', title: 'Browse Game Providers', detail: 'Find games from your favorite studios.',
    action: 'View providers', route: { type: 'providers' }, icon: 'providers' },
];
const artwork = { gift: 'assets/rewards-gift.svg', coin: 'assets/coins/gold-coin.svg' };
const coins = new Intl.NumberFormat('en-US');
const dateLabel = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });
const timeLabel = new Intl.DateTimeFormat('en-US', { timeStyle: 'short' });

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function localDateKey(date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()].map(part => String(part).padStart(2, '0')).join('-');
}

export function initNotificationsDrawer({ router, account, auth }) {
  const drawer = document.querySelector('#notifications-drawer');
  const modal = document.querySelector('#notifications-drawer-modal');
  const trigger = document.querySelector('#header-notifications');
  const title = drawer.querySelector('#notifications-title');
  const body = drawer.querySelector('.notifications-drawer__body');
  const tabs = [...drawer.querySelectorAll('[role="tab"]')];
  const [personalPanel, platformPanel] = body.querySelectorAll('[role="tabpanel"]');
  const readAll = drawer.querySelector('.notifications-drawer__read-all');
  const status = drawer.querySelector('[role="status"]');
  const desktop = window.matchMedia('(width > 1024px)');
  let selected = 0;
  let unreadIds = [];
  let renderKey = '';
  let saving = false;
  let opener;
  let midnightTimer;

  function selectTab(index) {
    selected = index;
    tabs.forEach((tab, position) => {
      tab.setAttribute('aria-selected', String(index === position));
      tab.tabIndex = index === position ? 0 : -1;
    });
    personalPanel.hidden = index !== 0;
    platformPanel.hidden = index !== 1;
    body.scrollTop = 0;
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(index));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - index;
      selectTab(next);
      tabs[next].focus();
    });
  });

  function card(notice) {
    const article = node('article', 'notification-card');
    article.dataset.noticeId = notice.id;
    const media = node('div', 'notification-card__media');
    media.dataset.art = notice.art || 'icon';
    media.setAttribute('aria-hidden', 'true');
    if (notice.art) {
      const image = node('img');
      image.src = artwork[notice.art];
      image.alt = '';
      media.append(image);
    } else media.append(createShelfIcon(notice.icon));

    const copy = node('div', 'notification-card__copy');
    const header = node('header', 'notification-card__header');
    header.append(node('h4', '', notice.title));
    copy.append(header, node('p', 'notification-card__description', notice.detail));
    if (notice.route) {
      const link = node('a', 'notification-card__action', notice.action);
      link.href = formatRoute(notice.route);
      link.addEventListener('click', event => {
        if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        close({ restoreFocus: false });
        router.navigate(notice.route);
      });
      copy.append(link);
    }
    if (notice.at && Number.isFinite(Date.parse(notice.at))) {
      const meta = node('div', 'notification-card__meta');
      const time = node('time', '', timeLabel.format(new Date(notice.at)));
      time.dateTime = notice.at;
      meta.append(time);
      article.append(meta);
    }
    article.append(media, copy);
    return article;
  }

  function groups(notices) {
    const sections = new Map();
    for (const notice of notices) {
      const date = new Date(notice.day || notice.at);
      const label = Number.isFinite(date.getTime()) ? dateLabel.format(date) : 'System updates';
      if (!sections.has(label)) {
        const group = node('section', 'notifications-drawer__group');
        group.append(node('h3', 'notifications-drawer__date', label));
        sections.set(label, group);
      }
      sections.get(label).append(card(notice));
    }
    return [...sections.values()];
  }

  function personalNotices(state, daily, now) {
    const notices = state.history.filter(item => item.type === 'reward').slice(-30).reverse()
      .map(({ id, title, at, detail }) => ({ id: `personal:${id}`, title, at, detail, art: 'coin' }));
    if (daily.available) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      notices.unshift({ id: `personal:daily-bonus-${localDateKey(day)}`, day: day.toISOString(), title: 'Daily Bonus Available',
        detail: `Collect ${coins.format(daily.amount)} GC for today’s check-in.`, action: 'View Daily Bonus', route: dailyBonusRoute, art: 'gift' });
    }
    return notices;
  }

  function emptyPersonal() {
    const empty = node('div', 'notifications-drawer__empty');
    empty.append(node('h3', '', 'No personal notifications yet.'), node('p', '', 'Your available Daily Bonus and collected rewards will appear here.'));
    return empty;
  }

  function syncReadAll() {
    const disabled = saving || !unreadIds.length;
    if (disabled && document.activeElement === readAll) tabs[selected].focus({ preventScroll: true });
    readAll.disabled = disabled;
  }

  function render() {
    clearTimeout(midnightTimer);
    const now = new Date();
    const state = account.getMemberState();
    const daily = dailyStatus(state, now);
    const personal = personalNotices(state, daily, now);
    const key = JSON.stringify(personal);
    if (renderKey !== key) {
      renderKey = key;
      personalPanel.replaceChildren(...(personal.length ? groups(personal) : [emptyPersonal()]));
    }

    const read = new Set(account.getNotificationReadIds());
    unreadIds = [...personal, ...platformNotices].map(notice => notice.id).filter(id => !read.has(id));
    for (const article of body.querySelectorAll('[data-notice-id]')) {
      article.dataset.unread = String(!read.has(article.dataset.noticeId));
    }
    syncReadAll();
    midnightTimer = setTimeout(render, Math.max(1, Date.parse(daily.nextAt) - Date.now()));
  }

  readAll.addEventListener('click', async () => {
    if (saving || !unreadIds.length) return;
    saving = true;
    syncReadAll();
    status.textContent = '';
    try {
      const result = await account.markNotificationsRead(unreadIds);
      status.textContent = result.ok ? 'Notifications marked as read.' : 'Unable to mark notifications as read.';
    } catch {
      status.textContent = 'Unable to mark notifications as read.';
    } finally {
      saving = false;
      if (!drawer.hidden) render();
      syncReadAll();
    }
  });

  function returnFocus(preferred) {
    [preferred, trigger, document.querySelector('#mobile-nav-menu'), document.querySelector('.site-logo')]
      .find(element => element?.getClientRects().length && element !== document.body && !element.closest('[inert]'))
      ?.focus({ preventScroll: true });
  }

  function close({ restoreFocus = true } = {}) {
    if (drawer.hidden) return;
    clearTimeout(midnightTimer);
    if (modal.open) modal.close();
    drawer.hidden = true;
    delete document.body.dataset.notificationsOpen;
    trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) returnFocus(opener);
    opener = null;
  }

  function applyLayout() {
    const focusedInside = drawer.contains(document.activeElement);
    const previousOpener = opener;
    close({ restoreFocus: false });
    if (desktop.matches) {
      modal.before(drawer);
      trigger.removeAttribute('aria-haspopup');
    } else {
      modal.append(drawer);
      trigger.setAttribute('aria-haspopup', 'dialog');
    }
    if (focusedInside) returnFocus(previousOpener);
  }

  function open({ returnFocusTo } = {}) {
    return auth.require(() => {
      if (!drawer.hidden) {
        if (returnFocusTo) opener = returnFocusTo;
        title.focus({ preventScroll: true });
        return;
      }
      if (document.querySelector('dialog[open]')) return;
      opener = returnFocusTo || document.activeElement;
      status.textContent = '';
      render();
      body.scrollTop = 0;
      drawer.hidden = false;
      if (!desktop.matches) modal.showModal();
      document.body.dataset.notificationsOpen = 'true';
      trigger.setAttribute('aria-expanded', 'true');
      title.focus({ preventScroll: true });
    });
  }

  drawer.querySelector('.notifications-drawer__close').addEventListener('click', () => close());
  modal.addEventListener('cancel', event => {
    event.preventDefault();
    close();
  });
  modal.addEventListener('close', () => {
    if (!modal.open && modal.contains(drawer)) close();
  });
  modal.addEventListener('click', event => {
    if (event.target !== modal) return;
    const bounds = modal.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.defaultPrevented || drawer.hidden || !desktop.matches) return;
    if (document.querySelector('#profile-menu:not([hidden]), dialog[open]')) return;
    const rewards = document.querySelector('#rewards-popover');
    if (typeof rewards?.showPopover === 'function' && rewards.matches(':popover-open')) return;
    event.preventDefault();
    close();
  });
  trigger.addEventListener('click', () => {
    if (drawer.hidden) open({ returnFocusTo: trigger });
    else close();
  });
  desktop.addEventListener('change', applyLayout);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !drawer.hidden) render();
  });
  router.subscribe(() => close({ restoreFocus: false }));
  account.subscribe(() => {
    if (!account.isSignedIn()) {
      close({ restoreFocus: false });
      selectTab(0);
      renderKey = '';
      personalPanel.replaceChildren();
    } else if (!drawer.hidden) render();
  });

  platformPanel.replaceChildren(...groups(platformNotices));
  selectTab(0);
  trigger.setAttribute('aria-expanded', 'false');
  applyLayout();
  return { open, close };
}
