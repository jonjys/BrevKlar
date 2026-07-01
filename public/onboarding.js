/* Brevklar — first-visit onboarding overlay */

const OB_KEY = 'bk_onboarded_v2';

function showOnboarding() {
  if (localStorage.getItem(OB_KEY)) return;
  if (document.getElementById('onboarding-overlay')) return;

  const el = document.createElement('div');
  el.id = 'onboarding-overlay';
  el.className = 'onboarding-overlay';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Välkommen till Brevklar');
  el.innerHTML =
    '<div class="onboarding-panel">' +
    '  <button class="onboarding-close" type="button" aria-label="Stäng">×</button>' +
    '  <div class="onboarding-logo">' +
    '    <svg width="52" height="52" viewBox="0 0 32 32" fill="none">' +
    '      <rect width="32" height="32" rx="8" fill="#2563EB"/>' +
    '      <path d="M5 11l11 8 11-8" stroke="white" stroke-width="2.2" stroke-linecap="round"/>' +
    '      <rect x="5" y="11" width="22" height="13" rx="2" stroke="white" stroke-width="2.2"/>' +
    '    </svg>' +
    '  </div>' +
    '  <h2 class="onboarding-title">Välkommen till Brevklar</h2>' +
    '  <p class="onboarding-sub">Förstå dina myndighetsbrev på sekunder — på ditt eget språk.</p>' +
    '  <div class="onboarding-steps">' +
    '    <div class="onboarding-step">' +
    '      <span class="onboarding-step-icon">📷</span>' +
    '      <div class="onboarding-step-text">' +
    '        <strong>Skanna eller bifoga</strong>' +
    '        <span>Foto, PDF, länk eller klistra in text direkt</span>' +
    '      </div>' +
    '    </div>' +
    '    <div class="onboarding-step">' +
    '      <span class="onboarding-step-icon">🤖</span>' +
    '      <div class="onboarding-step-text">' +
    '        <strong>AI förklarar direkt</strong>' +
    '        <span>Sammanfattning, handlingsplan och riskbedömning</span>' +
    '      </div>' +
    '    </div>' +
    '    <div class="onboarding-step">' +
    '      <span class="onboarding-step-icon">📅</span>' +
    '      <div class="onboarding-step-text">' +
    '        <strong>Spåra dina deadlines</strong>' +
    '        <span>Kalender med påminnelser — missa aldrig en deadline</span>' +
    '      </div>' +
    '    </div>' +
    '  </div>' +
    '  <a href="/scan" class="btn btn-primary onboarding-cta">Kom igång — gratis →</a>' +
    '  <button class="onboarding-skip" type="button">Utforska först</button>' +
    '</div>';

  const close = () => {
    localStorage.setItem(OB_KEY, '1');
    el.classList.remove('visible');
    setTimeout(() => el.remove(), 400);
  };

  el.querySelector('.onboarding-close').addEventListener('click', close);
  el.querySelector('.onboarding-skip').addEventListener('click', close);
  el.addEventListener('click', (e) => { if (e.target === el) close(); });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });

  document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('visible')));
}

document.addEventListener('DOMContentLoaded', () => setTimeout(showOnboarding, 800));
