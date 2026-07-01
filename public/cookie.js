/* Brevklar — GDPR cookie consent banner */

const COOKIE_CONSENT_KEY = 'bk_cookies_v1';

function showCookieBanner() {
  const banner = document.getElementById('cookie-banner');
  if (banner) banner.hidden = false;
}

function dismissCookieBanner(choice) {
  localStorage.setItem(COOKIE_CONSENT_KEY, choice);
  const banner = document.getElementById('cookie-banner');
  if (banner) banner.hidden = true;
}

document.addEventListener('DOMContentLoaded', () => {
  if (!localStorage.getItem(COOKIE_CONSENT_KEY)) {
    setTimeout(showCookieBanner, 2500);
  }

  const acceptBtn = document.getElementById('cookie-accept');
  const declineBtn = document.getElementById('cookie-decline');
  if (acceptBtn) acceptBtn.addEventListener('click', () => dismissCookieBanner('accepted'));
  if (declineBtn) declineBtn.addEventListener('click', () => dismissCookieBanner('declined'));
});
