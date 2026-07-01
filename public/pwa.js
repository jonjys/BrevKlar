/* Brevklar PWA — service worker registration + install prompt */

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// Install prompt
let _deferredInstall = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  _deferredInstall = e;
  if (!localStorage.getItem('bk_install_dismissed')) {
    setTimeout(showInstallBanner, 12000);
  }
});

window.addEventListener('appinstalled', () => {
  document.getElementById('pwa-install-banner')?.remove();
  _deferredInstall = null;
});

function showInstallBanner() {
  if (document.getElementById('pwa-install-banner')) return;
  if (window.matchMedia('(display-mode: standalone)').matches) return;

  const banner = document.createElement('div');
  banner.id = 'pwa-install-banner';
  banner.className = 'pwa-install-banner';
  banner.innerHTML =
    '<span class="pwa-install-icon">📱</span>' +
    '<span class="pwa-install-text">Installera Brevklar som app</span>' +
    '<button class="btn btn-sm btn-primary pwa-install-btn" type="button">Installera</button>' +
    '<button class="pwa-install-dismiss" type="button" aria-label="Stäng">×</button>';

  banner.querySelector('.pwa-install-btn').addEventListener('click', async () => {
    if (!_deferredInstall) return;
    _deferredInstall.prompt();
    await _deferredInstall.userChoice;
    _deferredInstall = null;
    hideBanner(banner);
  });

  banner.querySelector('.pwa-install-dismiss').addEventListener('click', () => {
    localStorage.setItem('bk_install_dismissed', '1');
    hideBanner(banner);
  });

  document.body.appendChild(banner);
  requestAnimationFrame(() => requestAnimationFrame(() => banner.classList.add('visible')));
}

function hideBanner(banner) {
  banner.classList.remove('visible');
  setTimeout(() => banner.remove(), 320);
}
