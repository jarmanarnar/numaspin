import { GAMES, PROVIDERS } from './catalog.js';
import { CATEGORIES, LEGACY_CATEGORIES, getGameCategoryIds, getGameReleaseDate } from './collections.js';
import { GAME_TYPES, getGameTypeId } from './game-types.js';
import { formatRoute } from './routes.js';
import { createShelfIcon } from './shelf-icons.js';
import { createGameArt } from './game-artwork-view.js';
import { GAME_ARTWORK } from './game-artwork.js';

const games = new Map(GAMES.map(game => [game.id, game]));
const providerNames = new Map(PROVIDERS.map(provider => [provider.id, provider.name]));
const categoryNames = new Map([...CATEGORIES, ...LEGACY_CATEGORIES].map(category => [category.id, category.title]));
let controller;

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function arrowIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'm15 4-8 8 8 8 1.4-1.4L9.8 12l6.6-6.6L15 4Z');
  svg.append(path);
  return svg;
}

export function initGameDetails({ router, member } = {}) {
  if (controller) return controller;
  const root = document.querySelector('#game-details-view');
  if (!router || !root) return;
  let currentGame = null;
  let favoriteButton = null;
  let favoriteLabel = null;

  function routeLink(text, route, className = 'game-details-link') {
    const link = node('a', className, text);
    link.href = formatRoute(route);
    link.addEventListener('click', event => {
      if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      router.navigate(route);
    });
    return link;
  }

  function syncFavorite() {
    if (!currentGame || !favoriteButton) return;
    const saved = member?.getState?.().favorites?.includes(currentGame.id) || false;
    favoriteButton.setAttribute('aria-pressed', String(saved));
    favoriteButton.setAttribute('aria-label', `${saved ? 'Remove' : 'Save'} ${currentGame.title} ${saved ? 'from' : 'to'} favorites`);
    favoriteLabel.textContent = saved ? 'Saved' : 'Favorite';
  }

  function favoriteControl(game) {
    favoriteButton = node('button', 'game-details-favorite');
    favoriteButton.type = 'button';
    favoriteLabel = node('span');
    favoriteButton.append(createShelfIcon('favorites'), favoriteLabel);
    favoriteButton.disabled = !member?.toggleFavorite;
    favoriteButton.addEventListener('click', () => {
      member?.toggleFavorite(game.id);
      syncFavorite();
    });
    return favoriteButton;
  }

  function createInformation(game, formatName) {
    const content = node('div', 'game-details-information');
    const attributes = node('dl', 'game-details-attributes');
    const addAttribute = (label, value) => {
      const row = node('div', 'game-details-attribute');
      const definition = node('dd');
      definition.append(typeof value === 'string' ? document.createTextNode(value) : value);
      row.append(node('dt', '', label), definition);
      attributes.append(row);
    };
    addAttribute('Provider', routeLink(providerNames.get(game.providerId) || game.providerName,
      { type: 'provider', providerId: game.providerId }));
    addAttribute('Game type', routeLink(formatName, { type: 'category', categoryId: getGameTypeId(game) }));
    const releaseDate = getGameReleaseDate(game);
    if (releaseDate) {
      const time = node('time', '', new Intl.DateTimeFormat('en', {
        year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
      }).format(new Date(`${releaseDate}T00:00:00Z`)));
      time.dateTime = releaseDate;
      addAttribute('Release date', time);
    }
    const categories = getGameCategoryIds(game).filter(id => !['all', getGameTypeId(game)].includes(id));
    if (categories.length) {
      const links = node('div', 'game-details-collections');
      for (const categoryId of categories) links.append(routeLink(categoryNames.get(categoryId) || categoryId,
        { type: 'category', categoryId }));
      addAttribute('Collections', links);
    }
    content.append(node('h3', '', 'Game attributes'), attributes);
    return content;
  }

  function detailsCard(game, formatName) {
    const descriptionType = { Slots: 'slot', 'Tap Games': 'tap', Scratchcards: 'scratchcard' }[formatName] || formatName.toLowerCase();
    const card = node('details', 'game-details-card');
    const summary = node('summary', 'game-details-summary');
    const chevron = arrowIcon();
    chevron.classList.add('game-details-chevron');
    summary.append(node('span', '', 'Game details'), chevron);
    const body = node('div', 'game-details-body');
    const tabs = node('div', 'game-details-tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Game details');
    const panels = [createInformation(game, formatName), node('div', 'game-details-description')];
    panels[1].append(node('h3', '', `About ${game.title}`),
      node('p', '', `${game.title} is a ${descriptionType} game by ${game.providerName}.`),
      node('p', '', 'Play the provider’s demo from this page. The demo has its own balance and does not use your Gold Coins or Sweeps Coins balance.'));
    const buttons = ['Information', 'Description'].map((label, index) => {
      const button = node('button', 'game-details-tab', label);
      button.type = 'button';
      button.id = `game-details-tab-${index}`;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', `game-details-panel-${index}`);
      button.setAttribute('aria-selected', String(index === 0));
      button.tabIndex = index === 0 ? 0 : -1;
      panels[index].id = `game-details-panel-${index}`;
      panels[index].setAttribute('role', 'tabpanel');
      panels[index].setAttribute('aria-labelledby', button.id);
      panels[index].tabIndex = 0;
      panels[index].hidden = index !== 0;
      return button;
    });
    function select(index, focus = false) {
      buttons.forEach((button, current) => {
        button.setAttribute('aria-selected', String(current === index));
        button.tabIndex = current === index ? 0 : -1;
        panels[current].hidden = current !== index;
      });
      if (focus) buttons[index].focus({ preventScroll: true });
    }
    buttons.forEach((button, index) => {
      button.addEventListener('click', () => select(index));
      button.addEventListener('keydown', event => {
        const next = event.key === 'ArrowRight' || event.key === 'ArrowLeft' ? (index + 1) % buttons.length
          : event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : null;
        if (next === null) return;
        event.preventDefault();
        select(next, true);
      });
    });
    tabs.append(...buttons);
    body.append(tabs, ...panels);
    card.append(summary, body);
    return card;
  }

  function relatedGames(game) {
    const related = GAMES.filter(candidate => candidate.providerId === game.providerId && candidate.id !== game.id).slice(0, 12);
    if (!related.length) return null;
    const shelf = node('section', 'game-details-related game-shelf');
    shelf.setAttribute('aria-labelledby', 'game-details-related-title');
    const header = node('div', 'game-shelf__header');
    const title = node('h2', 'game-shelf__title');
    title.id = 'game-details-related-title';
    title.append(routeLink(`More from ${game.providerName}`, { type: 'provider', providerId: game.providerId }, 'game-shelf__title-link'));
    header.append(title, routeLink('All', { type: 'provider', providerId: game.providerId }, 'game-details-all shelf-see-all'));
    const list = node('ul', 'game-track');
    list.setAttribute('aria-label', `More games by ${game.providerName}`);
    for (const candidate of related) {
      const card = node('li', 'game-card');
      const button = node('button', 'game-launch');
      button.type = 'button';
      button.dataset.game = candidate.id;
      button.setAttribute('aria-label', `View ${candidate.title} details`);
      const art = createGameArt(candidate);
      button.append(art, node('span', 'game-provider-badge', candidate.providerName));
      button.addEventListener('click', () => openDetails(candidate.id));
      card.append(button);
      list.append(card);
    }
    shelf.append(header, list);
    return shelf;
  }

  function openDetails(gameId, { from } = {}) {
    if (!games.has(gameId)) return;
    const route = router.getRoute();
    const origin = from || (route.type === 'game-details' ? route.from : formatRoute(route));
    router.navigate({ type: 'game-details', gameId, ...(origin ? { from: origin } : {}) });
  }

  function render(route, meta = {}) {
    const isDetails = route.type === 'game-details';
    root.hidden = !isDetails;
    currentGame = isDetails ? games.get(route.gameId) : null;
    if (!isDetails) return;
    if (!currentGame) {
      router.navigate({ type: 'home' }, { replace: true });
      return;
    }
    const game = currentGame;
    const formatName = GAME_TYPES.find(type => type.id === getGameTypeId(game))?.title || 'Slots';
    document.body.dataset.page = 'game-details';
    document.body.dataset.view = 'lobby';
    const categories = document.querySelector('#catalog-categories');
    if (categories) categories.dataset.activeMenu = '';
    document.title = `${game.title} · NUMA SPIN`;

    const back = node('button', 'game-details-back');
    back.type = 'button';
    back.setAttribute('aria-label', 'Back to lobby');
    back.append(arrowIcon(), node('span', '', 'Back'));
    back.addEventListener('click', () => router.navigate({ type: 'home' }));

    const hero = node('section', 'game-details-hero');
    hero.setAttribute('aria-labelledby', 'game-details-title');
    const art = node('div', 'game-details-art');
    art.setAttribute('aria-hidden', 'true');
    if (GAME_ARTWORK[game.id]) art.append(createGameArt(game, { eager: true }));
    const copy = node('div', 'game-details-copy');
    const byline = node('p', 'game-details-byline');
    byline.append(document.createTextNode('By '), routeLink(game.providerName, { type: 'provider', providerId: game.providerId }));
    const title = node('h1', '', game.title);
    title.id = 'game-details-title';
    title.tabIndex = -1;
    copy.append(byline, title, favoriteControl(game));
    const launch = node('div', 'game-details-launch');
    const play = node('button', 'game-details-play', 'Play');
    play.type = 'button';
    play.addEventListener('click', () => router.navigate({ type: 'game', gameId: game.id, from: formatRoute(router.getRoute()) }));
    launch.append(play);
    hero.append(art, copy, launch);
    root.replaceChildren(back, hero, detailsCard(game, formatName));
    const related = relatedGames(game);
    if (related) root.append(related);
    syncFavorite();
    if (meta.source === 'navigate' && meta.focus !== false) title.focus({ preventScroll: true });
  }

  member?.subscribe?.(syncFavorite);
  router.subscribe(render);
  render(router.getRoute());
  controller = { openDetails };
  return controller;
}
