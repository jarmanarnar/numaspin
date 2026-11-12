const SVG_NS = 'http://www.w3.org/2000/svg';

function shape(tag, attributes) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}

export function createShelfIcon(id) {
  const svg = shape('svg', {
    class: 'game-shelf__icon', 'aria-hidden': 'true', focusable: 'false',
    viewBox: '0 0 24 24', width: '24', height: '24', fill: 'currentColor',
  });
  const path = d => shape('path', { d, 'fill-rule': 'evenodd', 'clip-rule': 'evenodd' });
  switch (id) {
    case 'chevron-down':
      svg.append(path('m6 9 6 6 6-6-1.4-1.4-4.6 4.6-4.6-4.6L6 9Z'));
      break;
    case 'vip-club':
      svg.append(path('m2 5 5 4 5-6 5 6 5-4-3 14H5L2 5Zm3 16h14v2H5v-2Z'));
      break;
    case 'daily-bonus':
      svg.append(path('M11 7H4V5a3 3 0 0 1 5.5-1.7L12 6l2.5-2.7A3 3 0 0 1 20 5v2h-7v4h9V8H2v3h9V7ZM6 5a1 1 0 0 0 1 1h2.6L8 4.6A1 1 0 0 0 6 5Zm10-.4L14.4 6H17a1 1 0 1 0-1-1.4ZM3 13h8v9H5a2 2 0 0 1-2-2v-7Zm10 0h8v7a2 2 0 0 1-2 2h-6v-9Z'));
      break;
    case 'rank-system':
      svg.append(path('M12 2 3 6v6c0 5 5.3 8.8 9 10 3.7-1.2 9-5 9-10V6l-9-4Zm0 4 1.8 3.7 4.1.6-3 2.9.7 4.1-3.6-1.9-3.6 1.9.7-4.1-3-2.9 4.1-.6L12 6Z'));
      break;
    case 'free-money':
      svg.append(path('M4 3h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm8 3a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm1 2v1h2v2h-3v1h1a2 2 0 0 1 0 4v1h-2v-1H9v-2h3v-1h-1a2 2 0 0 1 0-4V8h2Z'));
      break;
    case 'tasks':
      svg.append(path('M9 2h6v3h4a2 2 0 0 1 2 2v14H3V7a2 2 0 0 1 2-2h4V2Zm2 2v3h2V4h-2ZM6 11v2h2v-2H6Zm4 0v2h8v-2h-8Zm-4 5v2h2v-2H6Zm4 0v2h8v-2h-8Z'));
      break;
    case 'invite-friends':
      svg.append(path('M9 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm9 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM2 19a7 7 0 0 1 14 0v2H2v-2Zm15 2v-2a8 8 0 0 0-2.6-5.9A6 6 0 0 1 23 18v3h-6Z'));
      break;
    case 'partners':
      svg.append(shape('path', { d: 'm2 9 4-4 4 1 3-1 5 1 4 4-5 7-4 3-5-2-6-5Zm8-3-3 4 2 2 4-3 5 6M2 9l-1 4 4 2m17-5 1 4-5 3m-8-2 4 4m-1-7 4 4', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.7', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
      break;
    case 'affiliate-program':
      svg.append(shape('circle', { cx: '12', cy: '6', r: '3' }), shape('circle', { cx: '4', cy: '10', r: '2.5' }), shape('circle', { cx: '20', cy: '10', r: '2.5' }),
        path('M6 18a6 6 0 0 1 12 0v3H6v-3ZM0 18a4 4 0 0 1 5-3.9A8 8 0 0 0 4 18v3H0v-3Zm20 3v-3a8 8 0 0 0-1-3.9A4 4 0 0 1 24 18v3h-4Z'));
      break;
    case 'profile':
      svg.append(path('M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm-6 12a6 6 0 0 1 12 0H6Z'));
      break;
    case 'history':
      svg.append(path('M12 2a10 10 0 1 1-9.5 13h2.2A8 8 0 1 0 6 6.7L9 10H1V2l3.5 3.3A10 10 0 0 1 12 2Zm-1 5h2v5.1l3.5 2.1-1 1.7-4.5-2.7V7Z'));
      break;
    case 'favorites':
      svg.append(path('M12 21C7 17 2 13.5 2 8a5.5 5.5 0 0 1 10-3.2A5.5 5.5 0 0 1 22 8c0 5.5-5 9-10 13Z'));
      break;
    case 'notifications':
      svg.append(path('M10 3a2 2 0 1 1 4 0 7 7 0 0 1 5 6v5l3 4H2l3-4V9a7 7 0 0 1 5-6Zm-1 17h6a3 3 0 0 1-6 0Z'));
      break;
    case 'how-to-play':
      svg.append(shape('circle', { cx: '12', cy: '12', r: '9', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }),
        shape('path', { d: 'M9.5 8a2.5 2.5 0 1 1 4 2c-1 .6-1.5 1.1-1.5 3', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round' }),
        shape('circle', { cx: '12', cy: '17', r: '1' }));
      break;
    case 'support':
      svg.append(path('M12 2a9 9 0 0 1 9 9v1a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2v1a3 3 0 0 1-3 3h-5v-3h5a1 1 0 0 0 1-1v-8a5 5 0 0 0-10 0v8H3a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2v-1a9 9 0 0 1 9-9Z'));
      break;
    case 'blog':
      svg.append(path('M5 2h14a2 2 0 0 1 2 2v18H5a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3Zm2 4v2h10V6H7Zm0 5v2h10v-2H7Zm0 5v2h7v-2H7Z'));
      break;
    case 'settings':
      svg.append(path('m9.2 2-.5 3-2.1 1.2L3.8 5 1 9.8l2.3 2.1v2.2L1 16.2 3.8 21l2.8-1.2L8.7 21l.5 3h5.6l.5-3 2.1-1.2 2.8 1.2 2.8-4.8-2.3-2.1v-2.2L23 9.8 20.2 5l-2.8 1.2L15.3 5l-.5-3H9.2ZM12 8a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z'));
      break;
    case 'logout':
      svg.append(path('M4 4h10v5h-2V6H6v12h6v-3h2v5H4z'), path('M16 7l5 5-5 5-1.4-1.4 2.6-2.6H9v-2h8.2l-2.6-2.6z'));
      break;
    case 'redeem':
      svg.append(path('M4 3h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm0 3v3h16V6H4Zm8 5-5 4h3v4h4v-4h3l-5-4Z'));
      break;
    case 'lobby':
    case 'all':
      svg.append(path('M12 2.5 2 10.8V13h2v6.8c0 .7.5 1.2 1.2 1.2H9v-6h6v6h3.8c.7 0 1.2-.5 1.2-1.2V13h2v-2.2L12 2.5Z'));
      break;
    case 'slots':
      svg.append(path('M4 3h16v3.6L10.1 21H4.7l9.7-13.8H8.2v2.3H4V3Z'));
      break;
    case 'table':
    case 'blackjack':
    case 'roulette':
    case 'baccarat':
    case 'poker':
      svg.append(path('M12 3c-2 4-8 7-8 11a4 4 0 0 0 7 2l-2 5h6l-2-5a4 4 0 0 0 7-2c0-4-6-7-8-11Z'));
      break;
    case 'scratchcards':
    case 'video-poker':
      svg.append(shape('rect', { x: '6', y: '3', width: '13', height: '17', rx: '2', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' }),
        shape('path', { d: 'M3 7v13a2 2 0 0 0 2 2h10', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' }),
        path('m12 7 4 5-4 5-4-5 4-5Z'));
      break;
    case 'instant-win':
    case 'tap':
      svg.append(path('M10 2a1.8 1.8 0 0 1 1.8 1.8v6.9l.5-.5a1.7 1.7 0 0 1 2.7.6 1.7 1.7 0 0 1 2.9.9 1.6 1.6 0 0 1 2.3 1.8l-1 4.1c-.7 2.6-2.2 4.4-5 4.4h-2.6c-1.8 0-3.1-.8-4.2-2.5l-3.8-6a1.8 1.8 0 0 1 2.8-2.2l1.8 1.9V3.8A1.8 1.8 0 0 1 10 2Z'));
      svg.append(path('M3.1 3.3 6 5.8 4.8 7.2 1.9 4.7l1.2-1.4ZM17.7 3.3l1.2 1.4L16 7.2l-1.2-1.4 2.9-2.5Z'));
      break;
    case 'popular':
      svg.append(path('M13.5 2c.9 1.5 1.6 3.6 1 6.5.9-.5 2-1.5 2.5-3.5.4 2.8 4 5.2 4 10 0 4.7-3.8 8-9 8-5.5 0-9-2.6-9-7 0-2.9 2.7-6.2 6-9-.2 1.9.1 3 1 4 2.4-2.5 4.2-4.5 3.5-9Zm-1.1 11c.6 2.1-1.4 3.2-1.9 4.4-.3.6-.1 2.6 1.7 2.6 1.9 0 2.8-1.3 2.6-2.7-.2-1.7-1.8-2.8-2.4-4.3Z'));
      break;
    case 'crash':
    case 'new-releases':
      svg.append(path('M14 3.1c2.1-.8 4.4-1.1 6.8-1l.1.1c.1 2.4-.2 4.7-1 6.8-1.1 3-3.2 5.5-6.3 7.3l-5.9-5.9C9.5 7.3 12 5.2 14 3.1ZM15 6.5a2 2 0 1 0 2.8 2.8A2 2 0 0 0 15 6.5ZM6.9 8.4 3.8 9 1 14l5.6-.8-1.2-1.3 1.5-3.5Zm8.7 8.7-.6 3.1L10 23l.8-5.6 1.3 1.2 3.5-1.5ZM5.8 15.4c-2 .4-3.7 2.1-3.8 6.6 4.5-.1 6.2-1.8 6.6-3.8l-2.8-2.8Z'));
      break;
    case 'picks':
      svg.append(path('m12 2.5 3 6 6.6 1-4.8 4.7 1.1 6.6-5.9-3.1-5.9 3.1 1.1-6.6L2.4 9.5l6.6-1 3-6Z'));
      break;
    case 'spooky':
      svg.append(path('M11 6V2.4c1.8.6 3.2.2 4.2-.9l1.1 1.4c-1 1.1-2 1.6-3.3 1.7V6h-2Z'));
      svg.append(path('M12 7C8.7 4.1 3.7 6.3 2.7 10.4c-1.4 5.7 2.3 11.1 7.1 10.1 1.1.8 3.3.8 4.4 0 4.8 1 8.5-4.4 7.1-10.1C20.3 6.3 15.3 4.1 12 7ZM6 10l4 2H6v-2Zm12 0v2h-4l4-2ZM6.5 14.5l2.5.8 1-.8 2 1.5 2-1.5 1 .8 2.5-.8L16 18H8l-1.5-3.5Z'));
      break;
    case 'megaways':
      svg.append(path('M13.5 2 4 14h6l-1 8L20 9h-6.3l-.2-7Z'));
      break;
    case 'jackpot':
      svg.append(path('M7 2h10v3h4v3c0 3-1.8 5-4.8 5.5-.7 1.3-1.8 2.2-3.2 2.5v3h4v3H7v-3h4v-3c-1.4-.3-2.5-1.2-3.2-2.5C4.8 13 3 11 3 8V5h4V2ZM5 7v1c0 1.7.8 2.8 2.1 3.3L7 7H5Zm12 0-.1 4.3C18.2 10.8 19 9.7 19 8V7h-2Z'));
      break;
    case 'fruit':
      svg.append(
        path('M15.2 3.1c-4.9 1.9-8 5.6-8.5 10.2l1.8.2c.4-3.6 2.7-6.6 6.1-8.3.2 2.8 1 5.8 2.2 8l1.6-.8c-1.3-2.5-2-5.5-1.9-8.6l-1.3-.7Z'),
        path('M15.5 3.1C11.5.7 8 2 6.5 5.8c4.4.9 7.5-.1 9-2.7Z'),
        shape('circle', { cx: '7', cy: '17', r: '4.5' }),
        shape('circle', { cx: '17', cy: '16', r: '4.5' }),
      );
      break;
    case 'adventure':
      svg.append(path('M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm5 5-7 3-3 7 7-3 3-7Z'));
      svg.append(path('m17 7-7 3 4 4 3-7Z'));
      break;
    case 'providers':
    default:
      for (const [x, y] of [[3, 3], [14, 3], [3, 14], [14, 14]]) {
        svg.append(shape('rect', { x, y, width: '7', height: '7', rx: '1.5' }));
      }
  }
  return svg;
}
