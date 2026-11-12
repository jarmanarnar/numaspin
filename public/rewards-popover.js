import { dailyStatus } from './member-state.js';
import { DEMO_TASKS, taskComplete } from './rewards-pages.js';

const coins = new Intl.NumberFormat('en-US');

export function initRewardsPopover({ router, account }) {
  const trigger = document.querySelector('#header-rewards');
  const panel = document.querySelector('#rewards-popover');
  if (!trigger || !panel) return;

  const badge = trigger.querySelector('#header-rewards-count');
  const supportsPopover = typeof panel.showPopover === 'function';
  const dailyLabel = panel.querySelector('#rewards-daily-status');
  const missions = panel.querySelector('#rewards-missions');
  const missionLabels = DEMO_TASKS.map(task => {
    const row = document.createElement('li');
    row.className = 'reward-preview';
    const placeholder = document.createElement('span');
    placeholder.className = 'reward-preview__placeholder';
    placeholder.setAttribute('aria-hidden', 'true');
    const copy = document.createElement('div');
    copy.className = 'reward-preview__copy';
    const title = document.createElement('strong');
    title.textContent = task.title;
    const status = document.createElement('span');
    status.className = 'reward-preview__status';
    copy.append(title, status);
    row.append(placeholder, copy);
    missions.append(row);
    return { task, status };
  });

  let midnightTimer;
  const isOpen = () => supportsPopover && panel.matches(':popover-open');
  function close() {
    if (isOpen()) panel.hidePopover();
  }
  function position() {
    const anchor = trigger.getBoundingClientRect();
    if (!anchor.width || !anchor.height) return false;
    panel.style.setProperty('--rewards-popover-top', `${anchor.bottom + 8}px`);
    panel.style.setProperty('--rewards-popover-right', `${Math.max(8, document.documentElement.clientWidth - anchor.right)}px`);
    return true;
  }

  function renderBadge(count) {
    if (!badge) return;
    badge.hidden = count === 0;
    badge.textContent = count ? String(count) : '';
    trigger.setAttribute('aria-label', count ? `Rewards, ${count} available` : 'Rewards');
  }

  function render() {
    clearTimeout(midnightTimer);
    if (!account.isSignedIn()) {
      renderBadge(0);
      close();
      return;
    }
    const state = account.getMemberState();
    const daily = dailyStatus(state);
    let available = Number(daily.available);
    dailyLabel.textContent = `${coins.format(daily.amount)} GC · ${daily.available ? 'Ready to collect' : 'Collected today'}`;
    for (const { task, status } of missionLabels) {
      const collected = state.taskClaims.includes(task.id);
      const ready = !collected && taskComplete(task.id, state);
      if (ready) available += 1;
      const label = collected ? 'Collected' : ready ? 'Ready to collect' : 'In progress';
      status.textContent = `${coins.format(task.amount)} GC · ${label}`;
    }
    renderBadge(available);
    midnightTimer = setTimeout(render, Math.max(1, Date.parse(daily.nextAt) - Date.now()));
  }

  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  account.subscribe(render);
  render();
  if (!supportsPopover) {
    trigger.addEventListener('click', () => router.navigate({ type: 'feature', pageId: 'daily-bonus' }));
    return;
  }

  panel.addEventListener('beforetoggle', event => {
    if (event.newState === 'closed') return;
    if (!account.isSignedIn() || document.querySelector('dialog[open]') || !position()) {
      event.preventDefault();
      return;
    }
    render();
    panel.scrollTop = 0;
  });
  panel.addEventListener('click', event => {
    const link = event.target.closest?.('[data-rewards-page]');
    if (!link || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    close();
    router.navigate({ type: 'feature', pageId: link.dataset.rewardsPage });
  });
  window.addEventListener('resize', () => { if (isOpen() && !position()) close(); });
  router.subscribe(close);
}
