import { FEATURE_PAGES, isFeaturePage } from './feature-pages.js';
import { dailyStatus, createMemberState } from './member-state.js';
import { renderRewardsPage } from './rewards-pages.js';
import { renderAccountPage } from './account-pages.js';
import { createShelfIcon } from './shelf-icons.js';
import { GAMES } from './catalog.js';
import { formatRoute } from './routes.js';

function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
export function initFeatureView({ router, wallet, account, auth, verifyPhone, openNotifications } = {}) {
  const root = document.querySelector('#feature-view');
  const content = document.querySelector('#feature-content');
  const header = document.querySelector('#feature-header');
  const back = document.querySelector('#feature-back');
  const title = document.querySelector('#feature-title');
  const notice = document.querySelector('#feature-status');
  if (!router || !root || !content || !title || !header || !back) return;
  const readState = () => account.isSignedIn() ? account.getMemberState() : createMemberState();
  let state = readState();
  let currentPage = null;
  const memberListeners = new Set();
  const games = new Map(GAMES.map(game => [game.id, game]));

  function applyPreferences() {
    document.body.dataset.reduceMotion = String(state.settings.reducedMotion);
    document.body.dataset.hideBalance = String(state.settings.hideBalance);
    wallet?.setPreferences(state.settings);
    document.dispatchEvent(new CustomEvent('loop:preferences-change'));
  }
  const notify = text => { notice.textContent = text; };
  function renderContent() {
    content.replaceChildren(renderRewardsPage(currentPage, ctx) || renderAccountPage(currentPage, ctx)
      || node('p', 'feature-muted', 'This page is unavailable.'));
  }
  async function save(action) {
    try { return await action(); }
    catch {
      const reason = 'Your changes could not be saved. Please try again.';
      notify(reason);
      return { ok: false, amount: 0, reason };
    }
  }
  const ctx = {
    node, icon: createShelfIcon, router, games: GAMES, state: () => state, ui: { historyFilter: 'all' },
    dailyStatus: () => dailyStatus(state), notify, verifyPhone,
    claimDaily: () => save(() => account.claimDaily()),
    claimTask: id => save(() => account.claimTask(id)),
    link(pageId, text, className = 'feature-button') {
      const a = node('a', className, text);
      const route = isFeaturePage(pageId) ? { type: 'feature', pageId }
        : pageId === 'favorites' ? { type: 'favorites' }
        : pageId === 'store' ? { type: 'store' } : pageId === 'providers' ? { type: 'providers' }
          : pageId === 'all' || pageId === 'home' ? { type: 'home' } : { type: 'category', categoryId: pageId };
      a.href = formatRoute(route);
      a.addEventListener('click', event => {
        if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault(); router.navigate(route);
      });
      return a;
    },
    async saveProfile(profile) {
      const result = await save(() => account.saveProfile(profile));
      if (!result.ok) notify(result.reason);
      else if (currentPage === 'profile') renderContent();
      return result.ok;
    },
    async saveSettings(settings) {
      return (await save(() => account.saveSettings(settings))).ok;
    },
    async toggleFavorite(id) {
      if (!games.has(id)) return;
      if (!account.isSignedIn()) return auth?.require(() => ctx.toggleFavorite(id));
      const exists = state.favorites.includes(id);
      const result = await save(() => account.toggleFavorite(id));
      if (result.ok) notify(exists ? 'Removed from favorites.' : 'Saved to favorites.');
    },
    logout: () => save(() => account.logout()),
    openGame(id) {
      if (games.has(id)) router.navigate({ type: 'game-details', gameId: id, from: formatRoute(router.getRoute()) });
    },
    async copy(text) {
      try { await navigator.clipboard.writeText(text); return true; }
      catch { notify('Select and copy the link from the field.'); return false; }
    },
  };

  function render(route, meta = {}) {
    const isFeature = route.type === 'feature' && isFeaturePage(route.pageId);
    root.hidden = !isFeature;
    currentPage = isFeature ? route.pageId : null;
    if (route.type === 'game' && games.has(route.gameId)) {
      if (account.isSignedIn()) void save(() => account.recordGameVisit(games.get(route.gameId)));
    }
    if (!isFeature) return;
    const page = FEATURE_PAGES[currentPage];
    header.className = page.showHeader ? 'feature-header' : 'feature-header visually-hidden';
    back.hidden = !page.showHeader || !page.showBack;
    document.body.dataset.page = 'feature';
    document.querySelector('#catalog-categories').dataset.activeMenu = currentPage;
    title.textContent = page.title;
    document.title = `${page.title} · NUMA SPIN`;
    notice.textContent = '';
    void save(() => account.recordPageVisit(currentPage));
    renderContent();
    if (meta.source === 'navigate' && meta.focus !== false) title.focus({ preventScroll: true });
  }
  back.addEventListener('click', () => router.navigate({ type: 'home' }));
  account.subscribe(() => {
    const next = readState();
    if (JSON.stringify(next) === JSON.stringify(state)) return;
    const preferencesChanged = JSON.stringify(next.settings) !== JSON.stringify(state.settings);
    state = next;
    if (preferencesChanged) applyPreferences();
    // An update in another tab must not erase an unfinished form.
    const editing = content.contains?.(document.activeElement) && document.activeElement?.matches('input, textarea, select');
    if (currentPage && !editing) renderContent();
    for (const listener of memberListeners) listener();
  });
  router.subscribe(render);
  applyPreferences();
  render(router.getRoute());
  // Re-evaluate daily availability when a sleeping tab becomes active, without timers.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && ['daily-bonus', 'free-money'].includes(currentPage)) renderContent();
  });
  return {
    openFeature(pageId) {
      if (pageId === 'redeem' && verifyPhone) return verifyPhone();
      if (pageId === 'notifications' && openNotifications) return openNotifications();
      if (isFeaturePage(pageId)) router.navigate({ type: 'feature', pageId });
    },
    member: {
      getState: () => structuredClone(state),
      getDailyStatus: now => dailyStatus(state, now),
      isSignedIn: () => account.isSignedIn(),
      toggleFavorite: id => ctx.toggleFavorite(id),
      subscribe(listener) {
        memberListeners.add(listener);
        return () => memberListeners.delete(listener);
      },
    },
  };
}
