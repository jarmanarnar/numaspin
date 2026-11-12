import { createAuthRouter, requiresAccount } from './auth-routing.js';

export function initAuthView({ account, router } = {}) {
  const dialog = document.querySelector('#auth-dialog');
  const form = document.querySelector('#auth-form');
  const email = document.querySelector('#auth-email');
  const password = document.querySelector('#auth-password');
  password.setAttribute('aria-label', 'Password');
  const accepted = document.querySelector('#auth-accepted');
  const submit = document.querySelector('#auth-submit');
  const feedback = document.querySelector('#auth-feedback');
  const registerFields = document.querySelector('#auth-register-fields');
  const forgot = document.querySelector('#auth-forgot');
  const recovery = document.querySelector('#auth-recovery');
  const resumeButton = document.querySelector('#auth-resume-demo');
  const socialButtons = [...document.querySelectorAll('[data-auth-social]')];
  const toggle = document.querySelector('#auth-password-toggle');
  const tabs = ['login', 'register'].map(id => document.querySelector(`#auth-tab-${id}`));
  let mode = 'login', pending = null, opener = null, completed = false, busy = false;
  let signedIn = account.isSignedIn();

  function message(text = '', error = false) {
    feedback.textContent = text;
    feedback.dataset.error = String(error);
  }
  function syncDemoAccess() {
    const saved = account.getSnapshot();
    const available = saved.isTest === true && Boolean(saved.identity);
    for (const button of socialButtons) {
      button.disabled = busy;
      button.setAttribute('aria-disabled', String(button.disabled));
    }
    resumeButton.hidden = !available;
    resumeButton.disabled = busy;
  }
  function setBusy(value) {
    busy = value;
    submit.disabled = busy;
    tabs.forEach(tab => { tab.disabled = busy; });
    syncDemoAccess();
  }
  async function resumeDemo() {
    if (busy) return;
    setBusy(true);
    resumeButton.textContent = 'Opening account…';
    message();
    try {
      const result = await account.resumeDemo();
      if (result.ok) finish();
      else {
        if (!dialog.open) open('register'); else select('register');
        message(result.reason, true);
      }
    } catch {
      if (!dialog.open) open('login'); else select('login');
      message('Your saved account could not be opened. Please try again.', true);
    } finally {
      setBusy(false);
      resumeButton.textContent = 'Enter saved account';
    }
  }
  function select(next, focus = false) {
    mode = next;
    form.hidden = false;
    recovery.hidden = true;
    registerFields.hidden = mode !== 'register';
    accepted.required = mode === 'register';
    forgot.hidden = mode === 'register';
    password.autocomplete = mode === 'register' ? 'new-password' : 'current-password';
    password.type = 'password';
    password.value = '';
    toggle.setAttribute('aria-pressed', 'false');
    toggle.setAttribute('aria-label', 'Show password');
    submit.textContent = mode === 'register' ? 'Register' : 'Login';
    document.querySelector('#auth-title').textContent = mode === 'register' ? 'Register with NUMA SPIN' : 'Login to NUMA SPIN';
    document.querySelector('#auth-panel').setAttribute('aria-labelledby', `auth-tab-${mode}`);
    tabs.forEach((tab, index) => {
      const active = ['login', 'register'][index] === mode;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    message();
    if (focus) tabs[mode === 'login' ? 0 : 1].focus({ preventScroll: true });
  }
  function open(next = 'login', action = null) {
    if (account.isSignedIn()) { action?.(); return; }
    if (!dialog.open) {
      opener = document.activeElement;
      completed = false;
      pending = action;
      for (const other of document.querySelectorAll('dialog[open]')) other.close();
      select(next);
      dialog.showModal();
      document.body.dataset.authDialog = 'open';
    } else { if (action) pending = action; select(next, true); }
  }
  const guardedRouter = createAuthRouter(router, account, route => open('login', () => router.navigate(route)));
  function finish() {
    const action = dialog.open ? pending : null;
    pending = null;
    completed = true;
    if (dialog.open) dialog.close();
    action?.();
  }
  function dismiss() {
    // Clear intent synchronously; background tabs may receive their close event later.
    pending = null;
    completed = false;
    dialog.close();
  }
  function sync() {
    const next = account.isSignedIn();
    document.body.dataset.auth = next ? 'member' : 'guest';
    document.querySelector('#guest-header-actions').hidden = next;
    document.querySelector('#guest-welcome').hidden = next || router.getRoute().type !== 'home';
    document.querySelector('#coin-wallet').hidden = !next;
    document.querySelector('#coin-type-switch').hidden = !next;
    document.querySelector('#header-profile').hidden = !next;
    document.querySelector('#header-wallet-controls').hidden = !next;
    document.querySelector('#header-member-actions').hidden = !next;
    const profileLabel = document.querySelector('#mobile-nav-profile .mobile-nav__label');
    if (profileLabel) profileLabel.textContent = next ? 'Profile' : 'Login';
    if (next && !signedIn) queueMicrotask(finish);
    if (!next && signedIn) {
      pending = null;
      if (requiresAccount(router.getRoute())) router.navigate({ type: 'home' }, { replace: true });
    }
    signedIn = next;
    syncDemoAccess();
  }
  account.subscribe(sync);
  router.subscribe(sync);
  sync();
  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-auth-open], [data-auth-social]');
    if (!button) return;
    if (['Google', 'Facebook'].includes(button.dataset.authSocial)) {
      if (!button.disabled) void resumeDemo();
    } else open(button.dataset.authOpen);
  });
  document.querySelector('#auth-close').addEventListener('click', dismiss);
  dialog.addEventListener('cancel', () => { pending = null; completed = false; });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dismiss();
  });
  dialog.addEventListener('close', () => {
    delete document.body.dataset.authDialog;
    pending = null;
    form.reset();
    password.type = 'password';
    message();
    if (!completed && opener?.isConnected) opener.focus({ preventScroll: true });
  });
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => { if (!busy) select(['login', 'register'][index]); });
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || busy) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - index;
      select(['login', 'register'][next]);
      tabs[next].focus();
    });
  });
  toggle.addEventListener('click', () => {
    const visible = password.type === 'password';
    password.type = visible ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(visible));
    toggle.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
  });
  document.querySelector('#auth-terms-toggle').addEventListener('click', event => {
    const terms = document.querySelector('#auth-terms');
    terms.hidden = !terms.hidden;
    event.currentTarget.setAttribute('aria-expanded', String(!terms.hidden));
  });
  forgot.addEventListener('click', () => { form.hidden = true; recovery.hidden = false; });
  resumeButton.addEventListener('click', () => { void resumeDemo(); });
  document.querySelector('#auth-recovery-back').addEventListener('click', () => select('login', true));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !form.reportValidity()) return;
    setBusy(true);
    const submittedMode = mode;
    submit.textContent = mode === 'register' ? 'Creating account…' : 'Logging in…';
    message();
    try {
      const result = mode === 'register'
        ? await account.register({ email: email.value, password: password.value, accepted: accepted.checked })
        : await account.login({ email: email.value, password: password.value });
      if (!result.ok && dialog.open) message(result.reason, true);
      else if (result.ok) finish();
    } catch { if (dialog.open) message('Your account could not be saved. Please try again.', true); }
    finally {
      setBusy(false);
      submit.textContent = submittedMode === 'register' ? 'Register' : 'Login';
    }
  });
  return { router: guardedRouter, open,
    require(action) { if (account.isSignedIn()) return action(); open('login', action); return false; },
  };
}
