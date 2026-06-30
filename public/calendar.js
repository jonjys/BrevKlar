/* Brevklar — Deadline calendar. Reads from localStorage key 'bk_deadlines'. */

const STORAGE_KEY = 'bk_deadlines';

const MONTH_SV = ['Januari','Februari','Mars','April','Maj','Juni',
                  'Juli','Augusti','September','Oktober','November','December'];

const WEEKDAY_BUFFER = {
  betala: 7, betalning: 7, restskatt: 7, skuld: 7, faktura: 7,
  inlämna: 14, ansök: 14, registrera: 14, anmäl: 14,
  svar: 5, komplettera: 5, kontakta: 5,
};

const RISK_COLOR = { low: '#22C55E', medium: '#F59E0B', high: '#EF4444', critical: '#EF4444' };

let viewYear, viewMonth;
let pendingDeleteId = null;

/* ---- Storage ---- */
function loadDeadlines() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

function saveDeadlines(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function deleteDeadline(id) {
  saveDeadlines(loadDeadlines().filter((d) => d.id !== id));
  render();
}

/* ---- Buffer logic ---- */
function bufferDays(description) {
  const lc = (description || '').toLowerCase();
  for (const [word, days] of Object.entries(WEEKDAY_BUFFER)) {
    if (lc.includes(word)) return days;
  }
  return 5;
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d)) return null;
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function formatDateSv(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d)) return dateStr;
  return `${d.getDate()} ${MONTH_SV[d.getMonth()]} ${d.getFullYear()}`;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(dateStr + 'T12:00:00');
  if (isNaN(due)) return null;
  return Math.round((due - today) / 86400000);
}

function urgencyLabel(days) {
  if (days === null) return null;
  const tFn = typeof t === 'function' ? t : (k) => k;
  if (days < 0) return { text: `${Math.abs(days)} ${tFn('cal_days_ago')}`, cls: 'urg-past' };
  if (days === 0) return { text: tFn('cal_urg_today'), cls: 'urg-today' };
  if (days <= 3) return { text: `${days} ${days > 1 ? tFn('cal_days_p') : tFn('cal_day_s')} ${tFn('cal_days_left')}`, cls: 'urg-critical' };
  if (days <= 7) return { text: `${days} ${tFn('cal_days_p')} ${tFn('cal_days_left')}`, cls: 'urg-high' };
  if (days <= 14) return { text: `${days} ${tFn('cal_days_p')} ${tFn('cal_days_left')}`, cls: 'urg-medium' };
  return { text: `${days} ${tFn('cal_days_p')} ${tFn('cal_days_left')}`, cls: 'urg-ok' };
}

function getMonthLabel(year, month) {
  if (typeof getLang === 'function') {
    const lang = getLang();
    const locale = lang === 'sv' ? 'sv-SE' : lang === 'en' ? 'en-US' : lang;
    try {
      return new Date(year, month, 1).toLocaleString(locale, { month: 'long', year: 'numeric' });
    } catch { /* fallback below */ }
  }
  return `${MONTH_SV[month]} ${year}`;
}

/* ---- Stats row ---- */
function renderStats(deadlines) {
  const stats = document.getElementById('cal-stats');
  if (!stats) return;

  const today = new Date(); today.setHours(0,0,0,0);
  const overdue = deadlines.filter((d) => {
    const diff = daysUntil(d.dueDate);
    return diff !== null && diff < 0;
  }).length;
  const thisWeek = deadlines.filter((d) => {
    const diff = daysUntil(d.dueDate);
    return diff !== null && diff >= 0 && diff <= 7;
  }).length;
  const thisMonth = deadlines.filter((d) => {
    const diff = daysUntil(d.dueDate);
    return diff !== null && diff >= 0 && diff <= 30;
  }).length;

  const tFn = typeof t === 'function' ? t : (k) => k;
  stats.innerHTML = `
    <div class="cal-stat ${overdue > 0 ? 'cal-stat-danger' : ''}">
      <span class="cal-stat-num">${overdue}</span>
      <span class="cal-stat-label">${tFn('cal_stat_overdue')}</span>
    </div>
    <div class="cal-stat ${thisWeek > 0 ? 'cal-stat-warn' : ''}">
      <span class="cal-stat-num">${thisWeek}</span>
      <span class="cal-stat-label">${tFn('cal_stat_week')}</span>
    </div>
    <div class="cal-stat">
      <span class="cal-stat-num">${thisMonth}</span>
      <span class="cal-stat-label">${tFn('cal_stat_month')}</span>
    </div>
    <div class="cal-stat">
      <span class="cal-stat-num">${deadlines.length}</span>
      <span class="cal-stat-label">${tFn('cal_stat_total')}</span>
    </div>
  `;
}

/* ---- Calendar grid ---- */
function renderCalendarGrid(deadlines) {
  const grid = document.getElementById('cal-grid');
  if (!grid) return;

  // remove all day cells (keep 7 weekday headers)
  while (grid.children.length > 7) grid.removeChild(grid.lastChild);

  const label = document.getElementById('cal-month-label');
  if (label) label.textContent = getMonthLabel(viewYear, viewMonth);

  // index deadlines and buffer dates by day string
  const byDay = {};
  deadlines.forEach((dl) => {
    if (!dl.dueDate) return;
    const key = dl.dueDate;
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push({ ...dl, isBuffer: false });

    const buf = addDays(dl.dueDate, bufferDays(dl.description));
    if (buf && buf !== key) {
      if (!byDay[buf]) byDay[buf] = [];
      byDay[buf].push({ ...dl, isBuffer: true });
    }
  });

  const firstDay = new Date(viewYear, viewMonth, 1);
  // Mon=0 offset: getDay() returns 0=Sun, so shift
  let startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayStr = new Date().toISOString().slice(0, 10);

  // padding cells
  for (let i = 0; i < startOffset; i++) {
    const cell = document.createElement('div');
    cell.className = 'cal-cell cal-cell-pad';
    grid.appendChild(cell);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const cell = document.createElement('div');
    cell.className = 'cal-cell';
    if (dateStr === todayStr) cell.classList.add('cal-cell-today');

    const dayItems = byDay[dateStr] || [];
    const hasDue = dayItems.some((x) => !x.isBuffer);
    const hasBuf = dayItems.some((x) => x.isBuffer);
    if (hasDue) cell.classList.add('has-due');
    if (hasBuf) cell.classList.add('has-buffer');

    cell.innerHTML = `<span class="cal-day-num">${day}</span>`;

    if (dayItems.length > 0) {
      const dots = document.createElement('div');
      dots.className = 'cal-dots';
      dayItems.slice(0, 3).forEach((item) => {
        const dot = document.createElement('span');
        dot.className = 'cal-dot' + (item.isBuffer ? ' cal-dot-buf' : '');
        dot.style.setProperty('--dc', RISK_COLOR[item.riskLevel] || '#3B82F6');
        dots.appendChild(dot);
      });
      cell.appendChild(dots);
    }

    if (dayItems.length > 0) {
      cell.style.cursor = 'pointer';
      cell.addEventListener('click', () => showDayModal(dateStr, dayItems));
    }

    grid.appendChild(cell);
  }
}

/* ---- Sidebar list ---- */
function renderList(deadlines) {
  const list = document.getElementById('cal-list');
  if (!list) return;

  const sorted = [...deadlines]
    .filter((d) => d.dueDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const tFn = typeof t === 'function' ? t : (k) => k;
  if (sorted.length === 0) {
    list.innerHTML = `<p class="cal-list-empty">${tFn('cal_list_empty')}</p>`;
    return;
  }

  list.innerHTML = sorted.map((dl) => {
    const days = daysUntil(dl.dueDate);
    const urg = urgencyLabel(days);
    const buf = addDays(dl.dueDate, bufferDays(dl.description));
    const bufLabel = buf ? formatDateSv(buf) : null;
    const riskColor = RISK_COLOR[dl.riskLevel] || '#3B82F6';

    return `
      <div class="cal-item" data-id="${escHtml(dl.id)}">
        <div class="cal-item-top">
          <div class="cal-item-dot" style="background:${riskColor}"></div>
          <div class="cal-item-body">
            <div class="cal-item-sender">${escHtml(dl.senderName || 'Okänd avsändare')}</div>
            <div class="cal-item-desc">${escHtml(dl.description || '')}</div>
          </div>
          <button class="cal-item-del" data-id="${escHtml(dl.id)}" title="Ta bort">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="cal-item-dates">
          <span class="cal-item-due">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            ${tFn('cal_due_label')} ${escHtml(formatDateSv(dl.dueDate))}
          </span>
          ${bufLabel && bufLabel !== formatDateSv(dl.dueDate) ? `
          <span class="cal-item-buf">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${tFn('cal_buf_label')} ${escHtml(bufLabel)}
          </span>` : ''}
        </div>
        ${urg ? `<span class="cal-urg ${urg.cls}">${escHtml(urg.text)}</span>` : ''}
      </div>
    `;
  }).join('');

  list.querySelectorAll('.cal-item-del').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showDeleteModal(btn.dataset.id);
    });
  });
}

/* ---- Day detail modal ---- */
function showDayModal(dateStr, items) {
  const modal = document.getElementById('day-modal');
  const title = document.getElementById('day-modal-title');
  const content = document.getElementById('day-modal-content');
  if (!modal || !title || !content) return;

  title.textContent = formatDateSv(dateStr);
  content.innerHTML = items.map((item) => `
    <div class="modal-day-item">
      <div class="modal-day-sender">${escHtml(item.senderName || 'Okänd')}</div>
      <div class="modal-day-desc">${escHtml(item.description || '')}</div>
      ${item.isBuffer
        ? `<span class="modal-day-badge buf-badge">⏰ ${typeof t === 'function' ? t('cal_buf_badge') : 'Buffertdatum — agera nu'}</span>`
        : `<span class="modal-day-badge due-badge">📅 ${typeof t === 'function' ? t('cal_due_badge') : 'Deadline'}</span>`
      }
    </div>
  `).join('');

  modal.hidden = false;
}

document.getElementById('day-modal-close')?.addEventListener('click', () => {
  document.getElementById('day-modal').hidden = true;
});
document.getElementById('day-modal')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.hidden = true;
});

/* ---- Delete modal ---- */
function showDeleteModal(id) {
  const dl = loadDeadlines().find((d) => d.id === id);
  if (!dl) return;
  pendingDeleteId = id;
  const desc = document.getElementById('modal-desc');
  if (desc) desc.textContent = `"${dl.description || 'Deadline'}" från ${dl.senderName || 'okänd'} — ${formatDateSv(dl.dueDate)}`;
  document.getElementById('modal-backdrop').hidden = false;
}

document.getElementById('modal-cancel')?.addEventListener('click', () => {
  document.getElementById('modal-backdrop').hidden = true;
  pendingDeleteId = null;
});
document.getElementById('modal-confirm')?.addEventListener('click', () => {
  if (pendingDeleteId) deleteDeadline(pendingDeleteId);
  document.getElementById('modal-backdrop').hidden = true;
  pendingDeleteId = null;
});
document.getElementById('modal-backdrop')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    e.currentTarget.hidden = true;
    pendingDeleteId = null;
  }
});

/* ---- Clear all ---- */
document.getElementById('cal-clear-btn')?.addEventListener('click', () => {
  if (loadDeadlines().length === 0) return;
  if (!confirm(typeof t === 'function' ? t('cal_clear_confirm') : 'Ta bort alla sparade deadlines?')) return;
  saveDeadlines([]);
  render();
});

/* ---- ICS export ---- */
function exportICS() {
  const deadlines = loadDeadlines();
  if (deadlines.length === 0) {
    alert(typeof t === 'function' ? t('cal_export_empty') : 'Inga deadlines att exportera.');
    return;
  }

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Brevklar//Deadline Calendar//SV',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  deadlines.forEach((dl) => {
    if (!dl.dueDate) return;
    const dtStamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
    const dtDate = dl.dueDate.replace(/-/g, '');
    const buf = addDays(dl.dueDate, bufferDays(dl.description));
    const bufDate = buf ? buf.replace(/-/g, '') : null;
    const summary = `${dl.senderName ? dl.senderName + ': ' : ''}${dl.description || 'Deadline'}`;
    const alarm = bufDate ? `\nBEGIN:VALARM\nTRIGGER;VALUE=DATE-TIME:${bufDate}T080000Z\nACTION:DISPLAY\nDESCRIPTION:Brevklar: ${summary} — agera idag\nEND:VALARM` : '';

    lines.push(
      'BEGIN:VEVENT',
      `UID:bk-${dl.id}@brevklar`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART;VALUE=DATE:${dtDate}`,
      `DTEND;VALUE=DATE:${dtDate}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:Sparat från Brevklar. Buffert: ${buf ? formatDateSv(buf) : '—'}`,
      `CATEGORIES:BREVKLAR,MYNDIGHET`,
      alarm,
      'END:VEVENT',
    );
  });

  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'brevklar-deadlines.ics';
  a.click();
  URL.revokeObjectURL(url);
}

document.getElementById('cal-export-btn')?.addEventListener('click', exportICS);

/* ---- Month navigation ---- */
document.getElementById('cal-prev')?.addEventListener('click', () => {
  viewMonth--;
  if (viewMonth < 0) { viewMonth = 11; viewYear--; }
  render();
});
document.getElementById('cal-next')?.addEventListener('click', () => {
  viewMonth++;
  if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  render();
});

/* ---- Main render ---- */
function render() {
  const deadlines = loadDeadlines();
  const isEmpty = deadlines.length === 0;

  document.getElementById('cal-empty').hidden = !isEmpty;
  document.getElementById('cal-layout')?.classList.toggle('hidden', isEmpty);
  // show layout even when empty so grid stays visible
  const layout = document.querySelector('.cal-layout');
  if (layout) layout.style.display = isEmpty ? 'none' : '';

  renderStats(deadlines);
  renderCalendarGrid(deadlines);
  renderList(deadlines);
}

/* ---- Util ---- */
function escHtml(s) {
  return String(s == null ? '' : s).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]),
  );
}

/* ---- Init ---- */
(function init() {
  const now = new Date();
  viewYear = now.getFullYear();
  viewMonth = now.getMonth();

  // lang picker
  if (typeof I18N !== 'undefined' && typeof getLang === 'function') {
    const picker = document.getElementById('lang-picker');
    if (picker) {
      Object.keys(I18N).forEach((code) => {
        const opt = document.createElement('option');
        opt.value = code;
        opt.textContent = I18N[code]._name;
        if (code === getLang()) opt.selected = true;
        picker.appendChild(opt);
      });
      picker.addEventListener('change', (e) => {
        if (typeof setLang === 'function') setLang(e.target.value);
      });
    }
  }

  render();

  // re-render dynamic content on language change
  document.addEventListener('langchange', () => render());

  // listen for storage changes from other tabs (e.g. scan page saving a new deadline)
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) render();
  });

  // apply static translations on load
  if (typeof applyTranslations === 'function') applyTranslations();
})();
