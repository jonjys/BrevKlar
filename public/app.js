/* Brevklar frontend-logik: språkval, demo-analys och rendering av resultatet. */

let lastResult = null; // sparas så vi kan rerendra vid språkbyte

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

function renderResult(data) {
  if (!data) return;
  const r = data.risk;
  const c = data.classification;

  const tags = [];
  if (c.senderName) tags.push(`<span class="tag">${esc(t('res_sender'))}: ${esc(c.senderName)}</span>`);
  if (c.documentType) tags.push(`<span class="tag">${esc(t('res_type'))}: ${esc(c.documentType)}</span>`);

  const actionItems = (data.actionPlan || []).map((a) => a.step);

  const deadlinesHtml = (data.deadlines || []).filter((d) => d.dueDate || d.description).length
    ? `<div class="block"><h3>${esc(t('res_deadlines'))}</h3><ul class="deadline-list">${data.deadlines
        .map(
          (d) =>
            `<li><span>${esc(d.description)}</span><span class="deadline-date">${esc(d.dueDate || '—')}</span></li>`,
        )
        .join('')}</ul></div>`
    : '';

  const confidencePct = Math.round((data.trust?.confidenceScore ?? 0) * 100);

  const html = `
    <div class="result-head">
      <div class="tags">${tags.join('')}</div>
      <span class="risk-pill risk-${esc(r.level)}">${esc(t('risk_' + r.level))} · ${r.score}/100</span>
    </div>

    <div class="block plain">
      <h3>${esc(t('res_summary'))}</h3>
      <p>${esc(data.summary)}</p>
    </div>

    <div class="block plain">
      <h3>${esc(t('res_plain'))}</h3>
      <p>${esc(data.plainLanguage)}</p>
    </div>

    ${
      actionItems.length
        ? `<div class="block"><h3>${esc(t('res_action'))}</h3><ul class="action-list">${actionItems
            .map((s) => `<li>${esc(s)}</li>`)
            .join('')}</ul></div>`
        : ''
    }

    ${deadlinesHtml}

    <div class="block">
      <h3>${esc(t('res_risk'))}</h3>
      <div class="risk-bars">
        ${riskBar(t('res_risk_legal'), r.breakdown.legal)}
        ${riskBar(t('res_risk_financial'), r.breakdown.financial)}
        ${riskBar(t('res_risk_deadline'), r.breakdown.deadline)}
      </div>
      ${r.needsHumanReview ? `<div class="review-flag">⚠️ ${esc(t('res_review'))}</div>` : ''}
    </div>

    ${
      data.consequences
        ? `<div class="block"><h3>${esc(t('res_consequences'))}</h3><p>${esc(data.consequences)}</p></div>`
        : ''
    }

    ${listBlock('res_steps', data.recommendedSteps, 'steps-list')}

    ${chipsBlock('res_amounts', data.amounts)}
    ${chipsBlock('res_refs', data.referenceNumbers)}

    <div class="block">
      <h3>${esc(t('res_confidence'))}</h3>
      <div class="confidence-row">
        <span class="bar" style="flex:1"><span style="width:${confidencePct}%;background:var(--brand)"></span></span>
        <strong>${confidencePct}%</strong>
      </div>
      ${
        (data.trust?.uncertainties || []).length
          ? `<ul class="steps-list" style="margin-top:12px">${data.trust.uncertainties
              .map((u) => `<li>${esc(u)}</li>`)
              .join('')}</ul>`
          : ''
      }
    </div>
  `;

  const box = document.getElementById('result');
  box.innerHTML = html;
  box.hidden = false;
}

async function analyze() {
  const input = document.getElementById('letter-input');
  const btn = document.getElementById('analyze-btn');
  const errorBox = document.getElementById('error-box');
  const outputLang = document.getElementById('output-lang').value;
  const text = input.value.trim();

  errorBox.hidden = true;
  document.getElementById('result').hidden = true;

  if (text.length < 20) {
    errorBox.textContent = t('demo_too_short');
    errorBox.hidden = false;
    return;
  }

  btn.disabled = true;
  const originalLabel = btn.textContent;
  btn.innerHTML = `<span class="spinner"></span>${esc(t('demo_analyzing'))}`;

  try {
    const res = await fetch('/demo/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, language: outputLang }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    lastResult = await res.json();
    renderResult(lastResult);
    document.getElementById('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    errorBox.textContent = t('demo_error');
    errorBox.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
}

function init() {
  // Språkväljare i navbaren (UI-språk) – styr även standard för förklaringsspråket.
  const picker = document.getElementById('lang-picker');
  buildLangOptions(picker, getLang());
  picker.addEventListener('change', (e) => {
    setLang(e.target.value);
    document.getElementById('output-lang').value = e.target.value;
  });

  // Separat väljare för vilket språk AI:n förklarar på.
  const outputLang = document.getElementById('output-lang');
  buildLangOptions(outputLang, getLang());

  document.getElementById('analyze-btn').addEventListener('click', analyze);
  document.getElementById('example-btn').addEventListener('click', () => {
    document.getElementById('letter-input').value = EXAMPLE_LETTER;
  });

  // Rerendra resultatet om UI-språket byts efter en analys.
  document.addEventListener('langchange', () => {
    if (lastResult) renderResult(lastResult);
  });

  applyTranslations();
}

document.addEventListener('DOMContentLoaded', init);
