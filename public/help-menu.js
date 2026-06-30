/* Brevklar — Snabbmeny (kugghjul): sök + genvägar till alla funktioner */

const HELP_ITEMS = [
  { icon: '📷', title: 'Skanna eller fotografera ett brev', desc: 'Använd kameran för att läsa av ett fysiskt brev', href: '/scan', tags: ['kamera', 'foto', 'fotografera', 'scan', 'skanna', 'photo', 'camera'] },
  { icon: '📄', title: 'Ladda upp PDF eller bild', desc: 'PDF, JPEG eller skärmbild från din enhet', href: '/scan', tags: ['pdf', 'ladda upp', 'upload', 'fil', 'bild', 'file'] },
  { icon: '🔗', title: 'Bifoga länk till myndighetssida', desc: 'Klistra in URL från FK, SKV, KFM och fler', href: '/scan', tags: ['länk', 'url', 'bifoga', 'webbsida', 'link', 'attach'] },
  { icon: '📝', title: 'Klistra in text från brevet', desc: 'Kopiera och klistra in texten direkt', href: '/scan', tags: ['text', 'klistra', 'paste', 'klistra in'] },
  { icon: '🔍', title: 'Full analys av dokument', desc: 'Handlingsplan, deadlines och riskbedömning', href: '/scan', tags: ['analys', 'analysera', 'dokument', 'fullständig', 'analyze'] },
  { icon: '💰', title: 'Hitta ett bättre avtal', desc: 'Jämför priser och spara pengar', href: '/scan', tags: ['avtal', 'spara', 'pengar', 'bättre', 'jämför', 'deal', 'save'] },
  { icon: '🌐', title: 'Översätt ett brev', desc: 'Få hela brevet förklarat på ditt språk', href: '/scan', tags: ['översätt', 'translate', 'språk', 'language'] },
  { icon: '❓', title: 'Förklara vad ett brev betyder', desc: 'Enkel förklaring utan krångligt myndighetsspråk', href: '/scan', tags: ['förklara', 'explain', 'betyder', 'mean'] },
  { icon: '📅', title: 'Mina deadlines', desc: 'Kalender med alla viktiga datum från dina brev', href: '/calendar', tags: ['deadline', 'kalender', 'datum', 'calendar', 'mina'] },
  { icon: '📥', title: 'Exportera deadlines (ICS)', desc: 'Ladda ner till Google Kalender eller Outlook', href: '/calendar', tags: ['exportera', 'ics', 'google', 'outlook', 'export'] },
  { icon: '🏛️', title: 'Försäkringskassan', desc: 'Sjukpenning, föräldrapenning, a-kassa', href: '/scan?url=' + encodeURIComponent('https://www.forsakringskassan.se/'), tags: ['försäkringskassan', 'fk', 'sjukpenning', 'föräldrapenning'] },
  { icon: '🏛️', title: 'Skatteverket', desc: 'Deklaration, restskatt, moms', href: '/scan?url=' + encodeURIComponent('https://www.skatteverket.se/'), tags: ['skatteverket', 'skv', 'skatt', 'deklaration', 'restskatt', 'tax'] },
  { icon: '🏛️', title: 'Kronofogden', desc: 'Betalningskrav, skulder, utmätning', href: '/scan?url=' + encodeURIComponent('https://www.kronofogden.se/'), tags: ['kronofogden', 'kfm', 'skuld', 'krav', 'utmätning', 'debt'] },
  { icon: '🏛️', title: 'Migrationsverket', desc: 'Uppehållstillstånd, asyl, medborgarskap', href: '/scan?url=' + encodeURIComponent('https://www.migrationsverket.se/'), tags: ['migrationsverket', 'migration', 'uppehållstillstånd', 'asyl'] },
  { icon: '🏛️', title: 'Arbetsförmedlingen', desc: 'A-kassa, jobbannonser, aktivitetsrapport', href: '/scan?url=' + encodeURIComponent('https://arbetsformedlingen.se/'), tags: ['arbetsförmedlingen', 'af', 'a-kassa', 'jobb', 'job'] },
  { icon: '🏛️', title: 'CSN', desc: 'Studielån, bidrag, återbetalning', href: '/scan?url=' + encodeURIComponent('https://www.csn.se/'), tags: ['csn', 'studielån', 'lån', 'bidrag', 'studerande', 'loan'] },
  { icon: '🏠', title: 'Till startsidan', desc: 'Tillbaka till Brevklars startsida', href: '/', tags: ['hem', 'start', 'home', 'startsida'] },
  { icon: '⭐', title: 'Hur funkar Brevklar?', desc: 'Tre steg från brev till klarhet', href: '/#how', tags: ['hur', 'funkar', 'hjälp', 'guide', 'how'] },
  { icon: '🎯', title: 'Prova demo', desc: 'Testa direkt med ett exempelbrev', href: '/#demo', tags: ['demo', 'prova', 'exempel', 'test', 'try'] },
];

(function setupHelpMenu() {
  let activeIdx = 0;
  let filteredItems = HELP_ITEMS;

  function escHtmlMenu(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function highlightMatch(text, q) {
    if (!q) return escHtmlMenu(text);
    const idx = text.toLowerCase().indexOf(q);
    if (idx === -1) return escHtmlMenu(text);
    return (
      escHtmlMenu(text.slice(0, idx)) +
      '<mark>' + escHtmlMenu(text.slice(idx, idx + q.length)) + '</mark>' +
      escHtmlMenu(text.slice(idx + q.length))
    );
  }

  function injectButton() {
    if (document.getElementById('help-menu-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'help-menu-btn';
    btn.type = 'button';
    btn.className = 'help-menu-btn';
    btn.setAttribute('aria-label', 'Snabbmeny — sök hjälp');
    btn.innerHTML =
      '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="12" cy="12" r="3"/>' +
      '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>' +
      '</svg>';
    btn.addEventListener('click', openMenu);

    // Prefer a .nav-actions container (index/calendar). Fall back to the
    // scan page's flat header by inserting before the lang picker.
    const navActions = document.querySelector('.nav-actions');
    if (navActions) {
      const langPicker = navActions.querySelector('.lang-picker');
      navActions.insertBefore(btn, langPicker || navActions.firstChild);
      return;
    }
    const scanTop = document.querySelector('.scan-top');
    if (scanTop) {
      const langPicker = scanTop.querySelector('.lang-picker');
      scanTop.insertBefore(btn, langPicker || scanTop.firstChild);
    }
  }

  function injectOverlay() {
    if (document.getElementById('help-menu-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'help-menu-overlay';
    overlay.className = 'help-overlay';
    overlay.setAttribute('hidden', '');
    overlay.innerHTML =
      '<div class="help-panel" role="dialog" aria-modal="true" aria-label="Snabbmeny">' +
      '  <div class="help-search-wrap">' +
      '    <svg class="help-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
      '    <input type="text" id="help-search-input" class="help-search-input" placeholder="Sök vad du vill ha hjälp med..." autocomplete="off" />' +
      '    <kbd class="help-esc-key">Esc</kbd>' +
      '  </div>' +
      '  <div class="help-results" id="help-results"></div>' +
      '  <div class="help-footer"><span>↑↓ navigera</span><span>↵ öppna</span><span>Esc stäng</span></div>' +
      '</div>';
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeMenu();
    });

    const input = overlay.querySelector('#help-search-input');
    input.addEventListener('input', () => renderResults(input.value));
    input.addEventListener('keydown', handleKeydown);
  }

  function renderResults(query) {
    const resultsEl = document.getElementById('help-results');
    if (!resultsEl) return;

    const q = (query || '').toLowerCase().trim();
    filteredItems = q
      ? HELP_ITEMS.filter(
          (item) =>
            item.title.toLowerCase().includes(q) ||
            item.desc.toLowerCase().includes(q) ||
            (item.tags || []).some((tag) => tag.includes(q))
        )
      : HELP_ITEMS;

    activeIdx = 0;

    if (!filteredItems.length) {
      resultsEl.innerHTML = '<div class="help-empty">Inget hittades — försök med ett annat sökord</div>';
      return;
    }

    resultsEl.innerHTML = filteredItems
      .map(
        (item, i) =>
          '<a href="' + escHtmlMenu(item.href) + '" class="help-item' + (i === 0 ? ' help-item-active' : '') + '" data-idx="' + i + '">' +
          '  <span class="help-item-icon">' + item.icon + '</span>' +
          '  <span class="help-item-body">' +
          '    <span class="help-item-title">' + highlightMatch(item.title, q) + '</span>' +
          '    <span class="help-item-desc">' + escHtmlMenu(item.desc) + '</span>' +
          '  </span>' +
          '  <svg class="help-item-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>' +
          '</a>'
      )
      .join('');

    resultsEl.querySelectorAll('.help-item').forEach((el) => {
      el.addEventListener('mouseenter', () => {
        activeIdx = Number(el.dataset.idx);
        updateActiveItem();
      });
    });
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') {
      closeMenu();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIdx = Math.min(activeIdx + 1, filteredItems.length - 1);
      updateActiveItem();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIdx = Math.max(activeIdx - 1, 0);
      updateActiveItem();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const active = document.querySelector('.help-item.help-item-active');
      if (active) {
        const href = active.getAttribute('href');
        closeMenu();
        window.location.href = href;
      }
    }
  }

  function updateActiveItem() {
    document.querySelectorAll('.help-item').forEach((el, i) => {
      el.classList.toggle('help-item-active', i === activeIdx);
      if (i === activeIdx) el.scrollIntoView({ block: 'nearest' });
    });
  }

  function openMenu() {
    const overlay = document.getElementById('help-menu-overlay');
    if (!overlay) return;
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    renderResults('');
    const input = document.getElementById('help-search-input');
    if (input) {
      input.value = '';
      setTimeout(() => input.focus(), 30);
    }
    document.addEventListener('keydown', globalKeydown);
    document.getElementById('help-menu-btn')?.classList.add('active');
  }

  function closeMenu() {
    const overlay = document.getElementById('help-menu-overlay');
    if (overlay) overlay.hidden = true;
    document.body.style.overflow = '';
    document.removeEventListener('keydown', globalKeydown);
    document.getElementById('help-menu-btn')?.classList.remove('active');
  }

  function globalKeydown(e) {
    if (e.key === 'Escape') closeMenu();
  }

  // Cmd/Ctrl+K opens the menu from anywhere
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      const overlay = document.getElementById('help-menu-overlay');
      if (overlay && !overlay.hidden) closeMenu();
      else openMenu();
    }
  });

  function init() {
    injectButton();
    injectOverlay();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
