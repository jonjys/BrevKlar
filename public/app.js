/* Brevklar — landing page: agency guide, demo (text + URL), hero URL, footer */

let lastResult = null;
let activeDemoTab = 'text';

/* ---- utility ---- */
function buildLangOptions(select, selected) {
  select.innerHTML = '';
  Object.keys(I18N).forEach((code) => {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = I18N[code]._name;
    if (code === selected) opt.selected = true;
    select.appendChild(opt);
  });
}

function esc(s) {
  return String(s == null ? '' : s).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]),
  );
}

function riskBar(label, value) {
  const color = value >= 70 ? 'var(--red)' : value >= 35 ? 'var(--amber)' : 'var(--green)';
  return `<div class="risk-bar-row">
    <span>${esc(label)}</span>
    <span class="bar"><span style="width:${value}%;background:${color}"></span></span>
    <span>${value}</span>
  </div>`;
}

function listBlock(titleKey, items, cls) {
  if (!items || items.length === 0) return '';
  const lis = items.map((i) => `<li>${esc(i)}</li>`).join('');
  return `<div class="block"><h3>${esc(t(titleKey))}</h3><ul class="${cls}">${lis}</ul></div>`;
}

function chipsBlock(titleKey, items) {
  if (!items || items.length === 0) return '';
  const chips = items.map((i) => `<span class="chip">${esc(i)}</span>`).join('');
  return `<div class="block"><h3>${esc(t(titleKey))}</h3><div class="chips">${chips}</div></div>`;
}

/* ---- agency guide ---- */
const AGENCY_CATEGORIES = {
  bidrag: ['forsakringskassan', 'arbetsformedlingen', 'csn', 'socialstyrelsen'],
  skatt:  ['skatteverket', 'bolagsverket', 'transportstyrelsen'],
  skuld:  ['kronofogden'],
  utbildning: ['csn', 'pensionsmyndigheten'],
};

function buildAgencyGrid() {
  const grid = document.getElementById('agency-grid');
  const filterBar = document.getElementById('agency-filter');
  if (!grid || typeof AGENCIES === 'undefined') return;

  function render(filter) {
    const list = filter === 'all'
      ? AGENCIES
      : AGENCIES.filter((a) => (AGENCY_CATEGORIES[filter] || []).includes(a.id));

    grid.innerHTML = list.map((a) => `
      <div class="agency-card">
        <div class="agency-card-header">
          <div class="agency-abbr" style="background:${esc(a.color)}1A;border-color:${esc(a.color)}55;color:${esc(a.color)}">${esc(a.abbr)}</div>
          <a href="${esc(a.url)}" target="_blank" rel="noopener" class="agency-ext-link" title="${esc(a.name)}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
        </div>
        <h3 class="agency-name">${esc(a.name)}</h3>
        <p class="agency-desc">${esc(a.desc)}</p>
        <div class="agency-topics">${a.topics.slice(0, 4).map((tp) => `<span class="topic-chip">${esc(tp)}</span>`).join('')}</div>
        <div class="agency-cta">
          <button class="btn btn-sm btn-outline agency-scan-btn" data-url="${esc(a.quickUrl)}">${esc(t('agency_cta'))}</button>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.agency-scan-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        window.location.href = '/scan?url=' + encodeURIComponent(btn.dataset.url);
      });
    });
  }

  render('all');

  if (filterBar) {
    filterBar.querySelectorAll('.agency-filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        filterBar.querySelectorAll('.agency-filter-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        render(btn.dataset.filter);
      });
    });
  }
}

function buildAgencyLogos() {
  const row = document.getElementById('agency-logos-row');
  if (!row || typeof AGENCIES === 'undefined') return;
  row.innerHTML = AGENCIES.slice(0, 7).map((a) =>
    `<div class="agency-logo-chip" style="--c:${esc(a.color)}">${esc(a.abbr)}</div>`
  ).join('');
}

function buildFooterLinks() {
  const c = document.getElementById('footer-agency-links');
  if (!c || typeof AGENCIES === 'undefined') return;
  c.innerHTML = AGENCIES.map((a) =>
    `<a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.name)}</a>`
  ).join('');
}

function buildDemoUrlChips() {
  const c = document.getElementById('demo-url-chips');
  if (!c || typeof AGENCIES === 'undefined') return;
  AGENCIES.slice(0, 5).forEach((a) => {
    const btn = document.createElement('button');
    btn.className = 'url-chip';
    btn.textContent = a.abbr;
    btn.title = a.name;
    btn.dataset.url = a.quickUrl;
    btn.addEventListener('click', () => {
      const input = document.getElementById('demo-url-input');
      if (input) input.value = a.quickUrl;
    });
    c.appendChild(btn);
  });
}

/* ---- demo tabs ---- */
function setDemoTab(tab) {
  activeDemoTab = tab;
  document.querySelectorAll('.demo-tab').forEach((el) =>
    el.classList.toggle('active', el.dataset.dtab === tab)
  );
  document.querySelectorAll('.demo-panel').forEach((el) =>
    el.classList.toggle('active', el.id === 'dpanel-' + tab)
  );
}

/* ---- deadline persistence ---- */
function saveDeadlinesFromResult(data) {
  if (!data || !Array.isArray(data.deadlines) || data.deadlines.length === 0) return;
  const c = data.classification || {};
  try {
    const existing = JSON.parse(localStorage.getItem('bk_deadlines') || '[]');
    const now = new Date().toISOString();
    data.deadlines.forEach((dl) => {
      if (!dl.dueDate && !dl.description) return;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      existing.push({
        id,
        description: dl.description || '',
        dueDate: dl.dueDate || null,
        senderName: c.senderName || '',
        documentType: c.documentType || '',
        riskLevel: data.risk?.level || 'low',
        savedAt: now,
      });
    });
    localStorage.setItem('bk_deadlines', JSON.stringify(existing));
  } catch { /* ignore storage errors */ }
}

/* ---- result rendering ---- */
function renderResult(data) {
  if (!data) return;
  const r = data.risk;
  const c = data.classification;
  if (!r || !c) return;

  saveDeadlinesFromResult(data);

  const tags = [];
  if (c.senderName) tags.push(`<span class="tag">${esc(t('res_sender'))}: ${esc(c.senderName)}</span>`);
  if (c.documentType) tags.push(`<span class="tag">${esc(t('res_type'))}: ${esc(c.documentType)}</span>`);

  const actionItems = (data.actionPlan || []).map((a) => a.step);

  const validDeadlines = (data.deadlines || []).filter((d) => d.dueDate || d.description);
  const deadlinesHtml = validDeadlines.length
    ? `<div class="block"><h3>${esc(t('res_deadlines'))}</h3><ul class="deadline-list">${validDeadlines
        .map((d) => `<li><span>${esc(d.description)}</span><span class="deadline-date">${esc(d.dueDate || '—')}</span></li>`)
        .join('')}</ul><a href="/calendar" class="cal-link-btn">Visa i kalender →</a></div>`
    : '';

  const confidencePct = Math.round((data.trust?.confidenceScore ?? 0) * 100);

  const html = `
    <div class="result-head">
      <div class="tags">${tags.join('')}</div>
      <span class="risk-pill risk-${esc(r.level)}">${esc(t('risk_' + r.level))} · ${r.score}/100</span>
    </div>
    <div class="block plain"><h3>${esc(t('res_summary'))}</h3><p>${esc(data.summary)}</p></div>
    <div class="block plain"><h3>${esc(t('res_plain'))}</h3><p>${esc(data.plainLanguage)}</p></div>
    ${actionItems.length ? `<div class="block"><h3>${esc(t('res_action'))}</h3><ul class="action-list">${actionItems.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>` : ''}
    ${deadlinesHtml}
    <div class="block">
      <h3>${esc(t('res_risk'))}</h3>
      <div class="risk-bars">
        ${riskBar(t('res_risk_legal'), r.breakdown.legal)}
        ${riskBar(t('res_risk_financial'), r.breakdown.financial)}
        ${riskBar(t('res_risk_deadline'), r.breakdown.deadline)}
      </div>
      ${r.needsHumanReview ? `<div class="review-flag">⚠ ${esc(t('res_review'))}</div>` : ''}
    </div>
    ${data.consequences ? `<div class="block"><h3>${esc(t('res_consequences'))}</h3><p>${esc(data.consequences)}</p></div>` : ''}
    ${listBlock('res_steps', data.recommendedSteps, 'steps-list')}
    ${chipsBlock('res_amounts', data.amounts)}
    ${chipsBlock('res_refs', data.referenceNumbers)}
    <div class="block">
      <h3>${esc(t('res_confidence'))}</h3>
      <div class="confidence-row">
        <span class="bar" style="flex:1"><span style="width:${confidencePct}%;background:var(--brand)"></span></span>
        <strong>${confidencePct}%</strong>
      </div>
      ${(data.trust?.uncertainties || []).length ? `<ul class="steps-list" style="margin-top:12px">${data.trust.uncertainties.map((u) => `<li>${esc(u)}</li>`).join('')}</ul>` : ''}
    </div>
  `;

  const box = document.getElementById('result');
  box.innerHTML = html;
  box.hidden = false;
}

/* ---- analyze (text or URL) ---- */
async function analyze() {
  const btn = document.getElementById('analyze-btn');
  const errorBox = document.getElementById('error-box');
  const outputLang = document.getElementById('output-lang').value;

  errorBox.hidden = true;
  document.getElementById('result').hidden = true;

  btn.disabled = true;
  const originalLabel = btn.textContent;
  btn.innerHTML = `<span class="spinner"></span>${esc(t('demo_analyzing'))}`;

  try {
    let data;

    if (activeDemoTab === 'url') {
      const url = document.getElementById('demo-url-input').value.trim();
      if (!url.startsWith('http')) {
        errorBox.textContent = 'Ange en giltig URL som börjar med http:// eller https://';
        errorBox.hidden = false;
        return;
      }
      const res = await fetch('/demo/fetch-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url, language: outputLang, action: 'analyze' }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      data = await res.json();
    } else {
      const text = document.getElementById('letter-input').value.trim();
      if (text.length < 20) {
        errorBox.textContent = t('demo_too_short');
        errorBox.hidden = false;
        return;
      }
      const res = await fetch('/demo/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, language: outputLang }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      data = await res.json();
    }

    lastResult = data;
    renderResult(data);
    document.getElementById('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch {
    errorBox.textContent = t('demo_error');
    errorBox.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
}

/* ---- hero URL quick-input ---- */
function initHeroUrl() {
  const input = document.getElementById('hero-url-input');
  const btn = document.getElementById('hero-url-btn');
  if (!input || !btn) return;

  const go = () => {
    const url = input.value.trim();
    if (!url.startsWith('http')) return;
    window.location.href = '/scan?url=' + encodeURIComponent(url);
  };

  btn.addEventListener('click', go);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
}

/* ---- init ---- */
function init() {
  const picker = document.getElementById('lang-picker');
  buildLangOptions(picker, getLang());
  picker.addEventListener('change', (e) => {
    setLang(e.target.value);
    const ol = document.getElementById('output-lang');
    if (ol) ol.value = e.target.value;
  });

  const outputLang = document.getElementById('output-lang');
  if (outputLang) buildLangOptions(outputLang, getLang());

  if (typeof AGENCIES !== 'undefined') {
    buildAgencyGrid();
    buildAgencyLogos();
    buildFooterLinks();
    buildDemoUrlChips();
  }

  document.querySelectorAll('.demo-tab').forEach((tab) => {
    tab.addEventListener('click', () => setDemoTab(tab.dataset.dtab));
  });

  const analyzeBtn = document.getElementById('analyze-btn');
  if (analyzeBtn) analyzeBtn.addEventListener('click', analyze);

  const exampleBtn = document.getElementById('example-btn');
  if (exampleBtn) exampleBtn.addEventListener('click', () => {
    setDemoTab('text');
    document.getElementById('letter-input').value = EXAMPLE_LETTER;
  });

  initHeroUrl();

  document.addEventListener('langchange', () => {
    if (lastResult) renderResult(lastResult);
    // re-render agency grid so CTA button text updates
    if (typeof AGENCIES !== 'undefined') buildAgencyGrid();
  });

  applyTranslations();
}

document.addEventListener('DOMContentLoaded', init);
