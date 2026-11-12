// Local prototype content. Rewards use the local demo ledger; vendor wagers,
// purchases, referrals and VIP eligibility are not connected to these pages.
export const DEMO_TASKS = Object.freeze([
  Object.freeze({ id: 'complete-profile', title: 'Make it yours', description: 'Choose your display name in Profile.', amount: 500, target: 'profile', action: 'Edit profile' }),
  Object.freeze({ id: 'first-game', title: 'Try your first game', description: 'Open a game from the casino lobby.', amount: 500, target: 'popular', action: 'Browse games' }),
  Object.freeze({ id: 'daily-check-in', title: 'Your daily check-in', description: 'Collect your first Daily Bonus.', amount: 250, target: 'daily-bonus', action: 'Daily Bonus' }),
]);

export const DEMO_RANKS = Object.freeze([
  Object.freeze({ name: 'Starter', games: 0 }),
  Object.freeze({ name: 'Explorer', games: 3 }),
  Object.freeze({ name: 'Regular', games: 10 }),
  Object.freeze({ name: 'Insider', games: 25 }),
  Object.freeze({ name: 'Legend', games: 50 }),
]);

const amount = value => new Intl.NumberFormat('en-US').format(value);
const gameCount = state => new Set(Array.isArray(state.discoveredGameIds) ? state.discoveredGameIds
  : (state.history || []).filter(item => item.type === 'game' && item.gameId).map(item => item.gameId)).size;

export function getDemoRank(state) {
  const games = gameCount(state);
  const index = DEMO_RANKS.findLastIndex(rank => games >= rank.games);
  const current = DEMO_RANKS[Math.max(0, index)];
  const next = DEMO_RANKS[index + 1] || null;
  const progress = next ? Math.min(1, (games - current.games) / (next.games - current.games)) : 1;
  return { current, next, games, progress };
}

export function taskComplete(id, state) {
  if (id === 'complete-profile') return Boolean(state.profile?.displayName?.trim() && state.profile.displayName.trim() !== 'Loop Player');
  if (id === 'first-game') return gameCount(state) > 0 || (state.history || []).some(item => item.type === 'game');
  if (id === 'daily-check-in') return (state.daily?.totalClaims || 0) > 0;
  return false;
}

function tools(ctx) {
  const n = ctx.node;
  const stack = (...children) => {
    const el = n('div', 'feature-stack');
    el.append(...children.filter(Boolean));
    return el;
  };
  const grid = (...children) => {
    const el = n('div', 'feature-grid');
    el.append(...children.filter(Boolean));
    return el;
  };
  const card = (title, description, iconId, ...children) => {
    const el = n('section', 'feature-card');
    if (iconId) {
      const icon = n('span', 'feature-card__icon');
      icon.append(ctx.icon(iconId));
      el.append(icon);
    }
    el.append(n('h2', '', title));
    if (description) el.append(n('p', 'feature-muted', description));
    el.append(...children.filter(Boolean));
    return el;
  };
  const button = (label, action, disabled = false) => {
    const el = n('button', 'feature-button', label);
    el.type = 'button';
    el.disabled = disabled;
    el.addEventListener('click', action);
    return el;
  };
  const note = text => n('p', 'feature-muted', text);
  const stats = values => {
    const list = n('dl', 'feature-stats');
    for (const [label, value] of values) {
      const item = n('div', 'feature-stat');
      item.append(n('dt', 'feature-muted', label), n('dd', '', String(value)));
      list.append(item);
    }
    return list;
  };
  const progress = (value, label) => {
    const el = n('progress', 'feature-progress');
    el.max = 1;
    el.value = value;
    el.setAttribute('aria-label', label);
    return el;
  };
  const details = (label, text) => {
    const el = n('details', 'feature-details');
    el.append(n('summary', '', label), note(text));
    return el;
  };
  return { n, stack, grid, card, button, note, stats, progress, details };
}

function dailyBonus(ctx, t) {
  const daily = ctx.dailyStatus();
  const days = t.n('ol', 'feature-grid feature-grid--days');
  for (let day = 1; day <= 7; day++) {
    const el = t.n('li', 'feature-card feature-day');
    const collected = daily.available ? day < daily.nextDay : day <= daily.streak;
    const current = daily.available && day === daily.nextDay;
    if (current) el.setAttribute('aria-current', 'step');
    el.dataset.status = collected ? 'collected' : current ? 'available' : 'upcoming';
    el.append(t.n('span', 'feature-kicker', `Day ${day}`), t.n('strong', '', `${amount(day * 1000)} GC`),
      t.n('small', 'feature-muted', collected ? 'Collected' : current ? 'Ready' : 'Upcoming'));
    days.append(el);
  }
  const claim = t.button(daily.available ? `Collect ${amount(daily.amount)} GC` : 'Collected today', async () => {
    claim.disabled = true;
    claim.textContent = 'Collecting…';
    try {
      const result = await ctx.claimDaily();
      ctx.notify(result.ok ? `${amount(result.amount)} demo GC added to your balance.` : result.reason || 'Your bonus has already been collected today.');
    } finally {
      claim.disabled = !ctx.dailyStatus().available;
      claim.textContent = claim.disabled ? 'Collected today' : `Collect ${amount(daily.amount)} GC`;
    }
  }, !daily.available);
  const time = daily.nextAt ? new Date(daily.nextAt).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : 'tomorrow';
  return t.stack(
    t.card('A little luck, every day', 'Check in on consecutive days to grow your Gold Coins bonus.', 'daily-bonus',
      t.stats([['Current streak', `${daily.streak || 0} ${daily.streak === 1 ? 'day' : 'days'}`], ['Today’s reward', `${amount(daily.amount)} GC`]]), claim,
      t.note(daily.available ? 'Available now. This is a local demo reward.' : `Your next bonus is available ${time}.`)),
    days,
    t.details('About your streak', 'Collect once per calendar day in this device’s local time. Consecutive claims advance from Day 1 to Day 7; after Day 7, a new cycle begins. Missing a day starts a new cycle at Day 1.'),
    t.details('Where the coins go', 'Claimed Gold Coins update the header balance and your local reward history. Provider games keep their own independent demo balances.'),
    ctx.link('history', 'View reward history'),
  );
}

function vipClub(ctx, t) {
  return t.stack(
    t.card('A more personal experience', 'A first look at the NUMA SPIN VIP Club. Membership rules and rewards are still being designed.', 'vip-club',
      t.n('span', 'feature-kicker', 'Program preview'), ctx.link('rank-system', 'View your demo rank')),
    t.n('h2', 'feature-section-title', 'Member benefits'),
    t.grid(
      t.card('Personal service', 'A dedicated place for member support and requests.', 'support', ctx.link('support', 'Support center')),
      t.card('Birthday surprises', 'A reward concept to celebrate member milestones.', 'daily-bonus', t.note('Preview · not active')),
      t.card('CoinBack rewards', 'Track future CoinBack eligibility and rewards.', 'coinback', ctx.link('coinback', 'View CoinBack')),
    ),
    t.details('How will VIP membership work?', 'This page defines the proposed structure. Qualification, benefit amounts and availability have not been configured. Your demo rank currently reflects only the different games you have opened locally.'),
    t.details('Already a VIP elsewhere?', 'A VIP transfer flow could be added here later. This prototype does not collect evidence, accept applications or grant a real VIP status.'),
  );
}

function rankSystem(ctx, t) {
  const rank = getDemoRank(ctx.state());
  const list = t.n('ol', 'feature-grid feature-grid--3');
  for (const level of DEMO_RANKS) {
    const el = t.card(level.name, `${level.games} different games opened`, 'rank-system',
      t.n('span', 'feature-kicker', level === rank.current ? 'Current rank' : rank.games >= level.games ? 'Reached' : 'Upcoming'));
    const item = t.n('li', 'feature-list-item');
    if (level === rank.current) item.setAttribute('aria-current', 'step');
    item.append(el);
    list.append(item);
  }
  return t.stack(
    t.card(rank.current.name, 'Your local activity rank', 'rank-system',
      t.stats([['Different games opened', rank.games], ['Next rank', rank.next?.name || 'Top demo rank']]),
      t.progress(rank.progress, rank.next ? `Progress to ${rank.next.name}` : 'Top demo rank reached'),
      t.note(rank.next ? `Open ${Math.max(0, rank.next.games - rank.games)} more different games to reach ${rank.next.name}.` : 'You have explored all the current demo ranks.'),
      ctx.link('popular', 'Explore games')),
    list,
    ctx.link('vip-club', 'Explore VIP Club'),
  );
}

function freeMoney(ctx, t) {
  const state = ctx.state();
  const claimed = new Set(state.taskClaims || []);
  const cards = DEMO_TASKS.map(task => {
    const complete = taskComplete(task.id, state);
    const collected = claimed.has(task.id);
    const collect = t.button('Collect reward', async () => {
      collect.disabled = true;
      collect.textContent = 'Collecting…';
      try {
        const result = await ctx.claimTask(task.id);
        ctx.notify(result.ok ? `${amount(result.amount)} demo GC added to your balance.` : result.reason || 'This reward is not available.');
      } finally {
        collect.disabled = ctx.state().taskClaims.includes(task.id);
        collect.textContent = collect.disabled ? 'Collected' : 'Collect reward';
      }
    });
    return t.card(task.title, task.description, 'tasks',
      t.n('strong', '', `${amount(task.amount)} GC`),
      t.n('p', 'feature-kicker', collected ? 'Collected' : complete ? 'Ready to collect' : 'In progress'),
      t.progress(complete ? 1 : 0, `${task.title} progress`),
      collected ? t.note('Added to your local demo balance.') : complete
        ? collect : ctx.link(task.target, task.action));
  });
  return t.stack(
    t.card('Small tasks. A little extra luck.', 'Explore the prototype and collect local demo Gold Coins along the way.', 'free-money',
      t.stats([['Tasks', DEMO_TASKS.length], ['Collected', claimed.size]])),
    t.grid(...cards),
    t.details('Reward conditions', 'Each mission reward can be collected once in this browser. These are local demo coins with no cash value; no social account, purchase or external message is required.'),
    ctx.link('history', 'View reward history'),
  );
}

function inviteFriends(ctx, t) {
  const name = ctx.state().profile?.displayName || 'Loop Player';
  const code = `LOOP-${name.replace(/[^a-z0-9]/gi, '').slice(0, 12).toUpperCase() || 'PLAYER'}`;
  const url = `${window.location.origin}${window.location.pathname}#/invite-friends?ref=${encodeURIComponent(code)}`;
  const field = t.n('input', 'feature-input');
  field.type = 'text';
  field.value = url;
  field.readOnly = true;
  field.setAttribute('aria-label', 'Invitation link preview');
  const copy = t.button('Copy invitation link', async () => {
    const ok = await ctx.copy(url);
    if (ok !== false) ctx.notify('Invitation link copied. Referral tracking is not connected yet.');
  });
  return t.stack(
    t.card('Better with friends', 'A place to invite friends and see your future referral rewards.', 'invite-friends',
      t.n('p', 'feature-kicker', 'Invitation preview'), field, copy,
      t.note('This link opens the local prototype. It does not register invitations or promise a reward.')),
    t.stats([['Your code', code], ['Tracked invitations', 'Not connected'], ['Referral rewards', 'Not active']]),
    t.grid(
      t.card('1. Share your link', 'Copy your invitation link when the referral program is ready.', 'invite-friends'),
      t.card('2. Welcome your friends', 'A future referral flow will connect a new account to an invitation.', 'profile'),
      t.card('3. Track your rewards', 'Eligible referrals and reward status will appear here.', 'history'),
    ),
    ctx.link('partners', 'Partner programs'),
  );
}

function coinback(ctx, t) {
  return t.stack(
    t.card('Your CoinBack', 'A dedicated home for CoinBack rewards and their collection status.', 'coinback',
      t.stats([['Available to collect', '0 GC'], ['Collected', '0 GC']]),
      t.note('Program preview · CoinBack rules and eligibility are not connected.')),
    t.card('No CoinBack rewards yet', 'When the program is configured, eligible rewards and their conditions will appear here.', null,
      ctx.link('free-money', 'Explore other rewards')),
    t.details('How CoinBack will work', 'This area will display the reward calculation, qualifying activity and collection window. No percentage or return is promised, and provider game outcomes are not available to this prototype.'),
    ctx.link('history', 'View history'),
  );
}

function partners(ctx, t) {
  return t.stack(
    t.card('Grow the community', 'Two ways to introduce people to the platform.', 'partners'),
    t.grid(
      t.card('Invite Friends', 'A personal invitation code for sharing with your friends.', 'invite-friends', ctx.link('invite-friends', 'Your invitation link')),
      t.card('Affiliate Program', 'A separate area for creators, publishers and partner collaborations.', 'affiliate-program', ctx.link('affiliate-program', 'Explore the program')),
    ),
  );
}

function affiliateProgram(ctx, t) {
  return t.stack(
    t.card('Built for future partners', 'A workspace for creators and publishers to follow their partnerships.', 'affiliate-program',
      t.n('p', 'feature-kicker', 'Program preview')),
    t.stats([['Program status', 'Not active'], ['Tracking', 'Not connected'], ['Commission terms', 'To be defined']]),
    t.grid(
      t.card('Partner profile', 'A future application will capture your audience, channels and contact preferences.', 'profile'),
      t.card('Campaign tools', 'Approved creative assets and campaign links will live here.', 'partners'),
      t.card('Partner reporting', 'A dedicated reporting area will show verified activity and payment status.', 'history'),
    ),
    t.details('How do I apply?', 'Applications are not open in this prototype. No personal information is sent or saved to an external partner service.'),
    ctx.link('support', 'Open support center'), ctx.link('partners', 'Back to partner programs'),
  );
}

export function renderRewardsPage(pageId, ctx) {
  const t = tools(ctx);
  switch (pageId) {
    case 'daily-bonus': return dailyBonus(ctx, t);
    case 'vip-club': return vipClub(ctx, t);
    case 'rank-system': return rankSystem(ctx, t);
    case 'free-money': return freeMoney(ctx, t);
    case 'invite-friends': return inviteFriends(ctx, t);
    case 'coinback': return coinback(ctx, t);
    case 'partners': return partners(ctx, t);
    case 'affiliate-program': return affiliateProgram(ctx, t);
    default: return null;
  }
}
