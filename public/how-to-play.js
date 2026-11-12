const steps = [
  {
    mode: 'both', label: '',
    description: 'NUMA SPIN offers two ways to play: Gold Coins (GC) and Sweeps Coins (SC), each with its own balance.',
  },
  {
    mode: 'gc', label: 'GC MODE',
    description: 'Gold Coins (GC) are virtual coins for social play. GC packages are available in the Store. Gold Coins have no cash value and cannot be exchanged or transferred for real money.',
  },
  {
    mode: 'sc', label: 'SC MODE',
    description: 'Sweeps Coins (SC) are used for free play in SC mode and are not sold. They may be included as a complimentary gift with Gold Coin packages or offered through other free methods.',
  },
];

let controller;

export function initHowToPlay({ router, openHome } = {}) {
  if (controller) return controller;
  const dialog = document.querySelector('#how-to-play-dialog');
  const mode = document.querySelector('#how-to-play-mode');
  const art = document.querySelector('#how-to-play-art');
  const description = document.querySelector('#how-to-play-description');
  const previous = document.querySelector('#how-to-play-previous');
  const next = document.querySelector('#how-to-play-next');
  const finish = document.querySelector('#how-to-play-finish');
  const close = document.querySelector('#how-to-play-close');
  const status = document.querySelector('#how-to-play-step');
  if (![dialog, mode, art, description, previous, next, finish, close, status].every(Boolean)) return;
  let index = 0, opener = null, afterClose = null;

  function coin(currency, className) {
    const image = document.createElement('img');
    image.className = `how-to-play-coin ${className}`;
    image.src = `assets/coins/${currency === 'gc' ? 'gold' : 'sweeps'}-coin.svg`;
    image.alt = '';
    image.width = image.height = 96;
    return image;
  }

  function render() {
    const step = steps[index];
    dialog.dataset.step = step.mode;
    mode.textContent = step.label;
    description.textContent = step.description;
    previous.hidden = index === 0;
    next.hidden = index === steps.length - 1;
    finish.hidden = index !== steps.length - 1;
    status.textContent = `Step ${index + 1} of ${steps.length}${step.label ? `: ${step.label}` : ''}`;
    art.replaceChildren(...(step.mode === 'both'
      ? [coin('gc', 'how-to-play-coin--left'), coin('sc', 'how-to-play-coin--right')]
      : [coin(step.mode, 'how-to-play-coin--back-left'), coin(step.mode, 'how-to-play-coin--back-right'), coin(step.mode, 'how-to-play-coin--front')]));
  }

  function move(offset) {
    const focused = document.activeElement;
    index = Math.max(0, Math.min(steps.length - 1, index + offset));
    render();
    if (focused?.hidden) (finish.hidden ? next : finish).focus({ preventScroll: true });
  }

  previous.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  close.addEventListener('click', () => dialog.close());
  finish.addEventListener('click', () => { afterClose = openHome; dialog.close(); });
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    move(event.key === 'ArrowLeft' ? -1 : 1);
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right
      || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    const action = afterClose;
    afterClose = null;
    if (action) { action(); return; }
    [opener, document.querySelector('#mobile-nav-menu'), document.querySelector('.site-logo')]
      .find(element => element?.getClientRects().length && !element.closest('[inert]'))?.focus({ preventScroll: true });
  });
  router?.subscribe(() => { if (dialog.open) dialog.close(); });

  controller = {
    openHowToPlay({ returnFocusTo = document.activeElement } = {}) {
      if (dialog.open || document.querySelector('dialog[open]')) return;
      opener = returnFocusTo;
      afterClose = null;
      index = 0;
      render();
      dialog.showModal();
    },
  };
  return controller;
}
