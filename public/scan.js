/* Brevklar scan flow: language → camera capture → action → AI result. */

const FLAGS = { sv: '🇸🇪', en: '🇬🇧', ar: '🇸🇦', so: '🇸🇴', fa: '🇮🇷', uk: '🇺🇦' };
const STEPS = ['lang', 'capture', 'action', 'result'];

const state = {
  step: 'lang',
  imageDataUrl: null,
  stream: null,
};

/* ---------- helpers ---------- */
function esc(s) {
  return String(s == null ? '' : s).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]),
  );
}

function goStep(step) {
  state.step = step;
  STEPS.forEach((s) => {
    document.getElementById('step-' + s).classList.toggle('active', s === step);
  });
  const idx = STEPS.indexOf(step);
  document.querySelectorAll('.step-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === idx);
    dot.classList.toggle('done', i < idx);
  });
  // Stop the camera as soon as we leave the capture step.
  if (step !== 'capture') stopCamera();
}

/* ---------- step 1: language ---------- */
function buildLangGrid() {
  const grid = document.getElementById('lang-grid');
  grid.innerHTML = '';
  Object.keys(I18N).forEach((code) => {
    const tile = document.createElement('button');
    tile.className = 'lang-tile';
    tile.innerHTML = `<span class="lang-flag">${FLAGS[code] || '🌐'}</span>
      <span class="lang-tile-name">${esc(I18N[code]._name)}</span>`;
    tile.addEventListener('click', () => {
      setLang(code);
      document.getElementById('lang-picker').value = code;
      goStep('capture');
      startCamera();
    });
    grid.appendChild(tile);
  });
}

/* ---------- step 2: camera ---------- */
async function startCamera() {
  const video = document.getElementById('camera');
  const fallback = document.getElementById('capture-fallback');
  fallback.hidden = true;

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    fallback.hidden = false;
    return;
  }
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
    video.srcObject = state.stream;
    video.classList.add('live');
  } catch (e) {
    fallback.hidden = false;
    fallback.textContent = t('scan_error_camera');
  }
}

function stopCamera() {
  if (state.stream) {
    state.stream.getTracks().forEach((tr) => tr.stop());
    state.stream = null;
  }
  const video = document.getElementById('camera');
  video.classList.remove('live');
  video.srcObject = null;
}

function captureFromVideo() {
  const video = document.getElementById('camera');
  if (!video.videoWidth) return null;
  const canvas = document.getElementById('capture-canvas');
  // Cap the longest side so the base64 payload stays small.
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.8);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        const canvas = document.getElementById('capture-canvas');
        const maxSide = 1600;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function onCaptured(dataUrl) {
  if (!dataUrl) return;
  state.imageDataUrl = dataUrl;
  document.getElementById('preview-img').src = dataUrl;
  goStep('action');
}

/* ---------- step 3 → 4: analyze ---------- */
async function runScan(action) {
  goStep('result');
  document.getElementById('scan-loading').style.display = 'flex';
  document.getElementById('scan-output').hidden = true;
  document.getElementById('result-footer').hidden = true;

  try {
    const res = await fetch('/demo/scan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        imageBase64: state.imageDataUrl,
        language: getLang(),
        action,
      }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    renderScanResult(data);
  } catch (e) {
    document.getElementById('scan-output').innerHTML =
      `<div class="error-box">${esc(t('scan_error_api'))}</div>`;
    document.getElementById('scan-output').hidden = false;
  } finally {
    document.getElementById('scan-loading').style.display = 'none';
    document.getElementById('result-footer').hidden = false;
  }
}

function renderScanResult(data) {
  const out = document.getElementById('scan-output');
  if (data.type === 'translate' || data.type === 'explain') {
    const label = data.type === 'translate' ? t('scan_translation_label') : t('scan_explanation_label');
    out.innerHTML = `<div class="simple-result">
      <div class="simple-result-label">${esc(label)}</div>
      <div class="simple-result-text">${esc(data.result)}</div>
    </div>`;
  } else {
    out.innerHTML = renderAnalysis(data);
  }
  out.hidden = false;
  out.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* analyze rendering — mirrors app.js renderResult, scoped to scan output */
function riskBar(label, value) {
  const color = value >= 70 ? 'var(--red)' : value >= 35 ? 'var(--amber)' : 'var(--green)';
  return `<div class="risk-bar-row">
    <span>${esc(label)}</span>
    <span class="bar"><span style="width:${value}%;background:${color}"></span></span>
    <span>${value}</span>
  </div>`;
}

function renderAnalysis(data) {
  const r = data.risk;
  const c = data.classification;
  const tags = [];
  if (c.senderName) tags.push(`<span class="tag">${esc(t('res_sender'))}: ${esc(c.senderName)}</span>`);
  if (c.documentType) tags.push(`<span class="tag">${esc(t('res_type'))}: ${esc(c.documentType)}</span>`);

  const actionItems = (data.actionPlan || []).map((a) => a.step);
  const deadlinesHtml = (data.deadlines || []).filter((d) => d.dueDate || d.description).length
    ? `<div class="block"><h3>${esc(t('res_deadlines'))}</h3><ul class="deadline-list">${data.deadlines
        .map((d) => `<li><span>${esc(d.description)}</span><span class="deadline-date">${esc(d.dueDate || '—')}</span></li>`)
        .join('')}</ul></div>`
    : '';
  const confidencePct = Math.round((data.trust?.confidenceScore ?? 0) * 100);

  return `<div class="result">
    <div class="result-head">
      <div class="tags">${tags.join('')}</div>
      <span class="risk-pill risk-${esc(r.level)}">${esc(t('risk_' + r.level))} · ${r.score}/100</span>
    </div>
    <div class="block plain"><h3>${esc(t('res_summary'))}</h3><p>${esc(data.summary)}</p></div>
    <div class="block plain"><h3>${esc(t('res_plain'))}</h3><p>${esc(data.plainLanguage)}</p></div>
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
    ${
      (data.amounts || []).length
        ? `<div class="block"><h3>${esc(t('res_amounts'))}</h3><div class="chips">${data.amounts
            .map((a) => `<span class="chip">${esc(a)}</span>`)
            .join('')}</div></div>`
        : ''
    }
    ${
      (data.referenceNumbers || []).length
        ? `<div class="block"><h3>${esc(t('res_refs'))}</h3><div class="chips">${data.referenceNumbers
            .map((a) => `<span class="chip">${esc(a)}</span>`)
            .join('')}</div></div>`
        : ''
    }
    <div class="block">
      <h3>${esc(t('res_confidence'))}</h3>
      <div class="confidence-row">
        <span class="bar"><span style="width:${confidencePct}%;background:var(--brand)"></span></span>
        <strong>${confidencePct}%</strong>
      </div>
    </div>
  </div>`;
}

/* ---------- init ---------- */
function init() {
  const picker = document.getElementById('lang-picker');
  Object.keys(I18N).forEach((code) => {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = I18N[code]._name;
    picker.appendChild(opt);
  });
  picker.value = getLang();
  picker.addEventListener('change', (e) => {
    setLang(e.target.value);
    buildLangGrid();
  });

  buildLangGrid();

  document.getElementById('shutter-btn').addEventListener('click', () => {
    onCaptured(captureFromVideo());
  });
  document.getElementById('file-input').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) onCaptured(await fileToDataUrl(file));
  });
  document.getElementById('retake-btn').addEventListener('click', () => {
    goStep('capture');
    startCamera();
  });
  document.querySelectorAll('.action-card').forEach((card) => {
    card.addEventListener('click', () => runScan(card.getAttribute('data-action')));
  });
  document.getElementById('scan-again-btn').addEventListener('click', () => {
    state.imageDataUrl = null;
    goStep('capture');
    startCamera();
  });

  document.addEventListener('langchange', buildLangGrid);
  applyTranslations();
}

document.addEventListener('DOMContentLoaded', init);
window.addEventListener('pagehide', stopCamera);
