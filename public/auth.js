/* Brevklar — auth modal: login / register, connects to /auth endpoints */

function openAuthModal(plan) {
  const modal = document.getElementById('auth-modal');
  if (!modal) return;
  if (plan === 'pro') {
    const title = modal.querySelector('.auth-modal-title');
    if (title) title.textContent = 'Skapa Pro-konto';
    const regTab = modal.querySelector('[data-atab="register"]');
    if (regTab) regTab.click();
  }
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  const firstInput = modal.querySelector('.auth-input');
  if (firstInput) setTimeout(() => firstInput.focus(), 60);
}

function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = '';
  const err = document.getElementById('auth-error');
  if (err) err.hidden = true;
}

async function handleLogin() {
  const email = document.getElementById('auth-email-login').value.trim();
  const pass  = document.getElementById('auth-pass-login').value;
  const err   = document.getElementById('auth-error');
  err.hidden  = true;

  if (!email || !pass) {
    err.textContent = 'Fyll i e-post och lösenord.';
    err.hidden = false;
    return;
  }

  const btn = document.getElementById('auth-login-btn');
  btn.disabled = true;
  btn.textContent = 'Loggar in…';

  try {
    const res = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: pass }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Inloggning misslyckades');
    if (data.token) localStorage.setItem('bk_token', data.token);
    const label = data.user?.email || data.user?.displayName || null;
    if (label) localStorage.setItem('bk_user_label', label);
    closeAuthModal();
    updateAuthUI(true, label);
  } catch (e) {
    err.textContent = e.message;
    err.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Logga in →';
  }
}

async function handleRegister() {
  const email = document.getElementById('auth-email-reg').value.trim();
  const pass  = document.getElementById('auth-pass-reg').value;
  const err   = document.getElementById('auth-error');
  err.hidden  = true;

  if (!email || pass.length < 8) {
    err.textContent = 'Ange e-post och ett lösenord med minst 8 tecken.';
    err.hidden = false;
    return;
  }

  const btn = document.getElementById('auth-register-btn');
  btn.disabled = true;
  btn.textContent = 'Skapar konto…';

  try {
    const res = await fetch('/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: pass }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Registrering misslyckades');
    if (data.token) localStorage.setItem('bk_token', data.token);
    const label = data.user?.email || data.user?.displayName || email;
    if (label) localStorage.setItem('bk_user_label', label);
    closeAuthModal();
    updateAuthUI(true, label);
  } catch (e) {
    err.textContent = e.message;
    err.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Skapa konto gratis →';
  }
}

function updateAuthUI(loggedIn, email) {
  const btn = document.getElementById('nav-login-btn');
  if (!btn) return;
  if (loggedIn) {
    btn.textContent = email ? email.split('@')[0] : 'Mitt konto';
    btn.onclick = () => {
      if (confirm('Vill du logga ut?')) {
        localStorage.removeItem('bk_token');
        localStorage.removeItem('bk_user_label');
        updateAuthUI(false);
      }
    };
  } else {
    btn.textContent = 'Logga in';
    btn.onclick = () => openAuthModal();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.auth-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.auth-panel').forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');
      const panel = document.getElementById('auth-panel-' + tab.dataset.atab);
      if (panel) panel.classList.add('active');
      const err = document.getElementById('auth-error');
      if (err) err.hidden = true;
    });
  });

  const closeBtn = document.getElementById('auth-modal-close');
  if (closeBtn) closeBtn.addEventListener('click', closeAuthModal);

  const backdrop = document.getElementById('auth-modal');
  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeAuthModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAuthModal();
  });

  const loginBtn = document.getElementById('auth-login-btn');
  if (loginBtn) loginBtn.addEventListener('click', handleLogin);

  const registerBtn = document.getElementById('auth-register-btn');
  if (registerBtn) registerBtn.addEventListener('click', handleRegister);

  document.querySelectorAll('.auth-input').forEach((input) => {
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const panel = input.closest('.auth-panel');
      if (panel) panel.querySelector('.auth-submit-btn')?.click();
    });
  });

  const navBtn = document.getElementById('nav-login-btn');
  if (navBtn) navBtn.addEventListener('click', () => openAuthModal());

  const token = localStorage.getItem('bk_token');
  const savedLabel = localStorage.getItem('bk_user_label');
  if (token) updateAuthUI(true, savedLabel);
});
