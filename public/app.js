import { initGameView } from './game-view.js';
import { initCatalogView } from './catalog-view.js';
import { initWallet } from './wallet.js';
import { initCatalogToolbar } from './catalog-toolbar.js';
import { initSiteMenu } from './site-menu.js';
import { initHeroCarousel } from './hero-carousel.js';
import { initSiteSearch } from './site-search.js';
import { initMobileNav } from './mobile-nav.js';
import { initRouter } from './routes.js';
import { initStoreView } from './store-view.js';
import { initPhoneVerification } from './phone-verification.js';
import { initNotificationsDrawer } from './notifications-drawer.js';
import { initRewardsPopover } from './rewards-popover.js';
import { initFeatureView } from './feature-view.js';
import { initGameDetails } from './game-details-view.js';
import { initHowToPlay } from './how-to-play.js';
import { openDemoAccount } from './demo-account.js';
import { GAMES } from './catalog.js';
import { initAuthView } from './auth-view.js';

export async function initApplication() {
  const account = await openDemoAccount({ catalogIds: GAMES.map(game => game.id) });
  const auth = initAuthView({ account, router: initRouter() });
  const router = auth.router;
  const phone = initPhoneVerification({ router, account });
  const notifications = initNotificationsDrawer({ router, account, auth });
  initRewardsPopover({ router, account });
  const verifyPhone = () => auth.require(phone.open);
  initGameView({ router });
  const store = initStoreView({ router, account, auth, verifyPhone });
  const wallet = initWallet({ account, router, openStore: store.openStore });
  const features = initFeatureView({ router, wallet, account, auth, verifyPhone, openNotifications: notifications.open });
  const catalog = initCatalogView({ router, member: features.member });
  initCatalogToolbar();
  initGameDetails({ router, member: features.member });
  const search = initSiteSearch(catalog);
  document.querySelector('#header-search')?.addEventListener('click', search.openSearch);
  const help = initHowToPlay({ router, openHome: catalog.openHome });
  const menu = initSiteMenu({ ...catalog, ...search, ...features, ...help, openStore: store.openStore });
  initMobileNav({ ...catalog, ...search, ...features, ...menu });
  initHeroCarousel(catalog);

  document.querySelector('.site-logo')?.addEventListener('click', event => {
    event.preventDefault();
    catalog.openHome();
  });
  return { ...router, prepareLayout: () => wallet.refreshLayout() };
}
