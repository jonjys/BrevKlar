/* Brevklar document intelligence: camera / upload / URL / paste-text → action → result. */

const STEPS = ['input', 'action', 'result'];

const state = {
  step: 'input',
  inputMode: 'camera',
  inputData: null,
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
  if (step !== 'input' || state.inputMode !== 'camera') stopCamera();
}

/* ---------- input mode tabs ---------- */
function setInputMode(mode) {
  state.inputMode = mode;
  document.querySelectorAll('.input-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.mode === mode);
  });
  document.querySelectorAll('.input-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === 'panel-' + mode);
  });
  if (mode === 'camera') {
    startCamera();
  } else {
    stopCamera();
  }
}

/* ---------- camera ---------- */
async function startCamera() {
  const video = document.getElementById('camera');
  const fallback = document.getElementById('capture-fallback');
  if (fallback) fallback.hidden = true;

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (fallback) fallback.hidden = false;
    return;
  }
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
    video.srcObject = state.stream;
    video.classList.add('live');
  } catch {
    if (fallback) { fallback.hidden = false; fallback.textContent = t('scan_error_camera'); }
  }
}

function stopCamera() {
  if (state.stream) {
    state.stream.getTracks().forEach((tr) => tr.stop());
    state.stream = null;
  }
  const video = document.getElementById('camera');
  if (video) { video.classList.remove('live'); video.srcObject = null; }
}

function captureFromVideo() {
  const video = document.getElementById('camera');
  if (!video || !video.videoWidth) return null;
  const canvas = document.getElementById('capture-canvas');
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.8);
}

/* ---------- file helpers ---------- */
function compressImageFile(file) {
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

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function fileToInputData(file) {
  if (file.type === 'application/pdf') {
    const dataUrl = await readFileAsDataUrl(file);
    return { type: 'file', fileBase64: dataUrl };
  }
  const compressed = await compressImageFile(file);
  return { type: 'file', fileBase64: compressed };
}

/* ---------- input ready → show action step ---------- */
function onInputReady(data) {
  if (!data) return;
  state.inputData = data;

  const img = document.getElementById('preview-img');
  const textBadge = document.getElementById('preview-text-badge');

  if (data.type === 'file' && data.fileBase64.startsWith('data:image')) {
    img.src = data.fileBase64;
    img.hidden = false;
    textBadge.hidden = true;
  } else {
    img.hidden = true;
    textBadge.hidden = false;
    const charsEl = document.getElementById('preview-text-chars');
    if (charsEl) {
      if (data.type === 'url') {
        try { charsEl.textContent = new URL(data.url).hostname; }
        catch { charsEl.textContent = 'URL'; }
      } else if (data.type === 'text') {
        charsEl.textContent = `${data.textContent.length} tecken`;
      } else {
        charsEl.textContent = 'PDF';
      }
    }
  }

  goStep('action');
}

/* ---------- drop zone ---------- */
function setupDropZone() {
  const zone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const uploadBtn = document.getElementById('upload-btn');

  uploadBtn.addEventListener('click', () => fileInput.click());
  zone.addEventListener('click', (e) => {
    if (e.target === zone || e.target.closest('.drop-zone-icon, .drop-zone-title, .drop-zone-sub')) {
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      try {
        const data = await fileToInputData(file);
        onInputReady(data);
      } catch { /* ignore */ }
      fileInput.value = '';
    }
  });

  zone.addEventListener('dragenter', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', (e) => {
    if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over');
  });
  zone.addEventListener('drop', async (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) {
      try {
        const data = await fileToInputData(file);
        onInputReady(data);
      } catch { /* ignore */ }
    }
  });
}

/* ---------- clipboard paste ---------- */
function setupPasteCapture() {
  document.addEventListener('paste', async (e) => {
    if (state.step !== 'input') return;
    if (state.inputMode === 'text') return;

    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          setInputMode('upload');
          try {
            const data = await fileToInputData(file);
            onInputReady(data);
          } catch { /* ignore */ }
          break;
        }
      }
    }
  });
}

/* ---------- URL panel ---------- */
function setupUrlPanel() {
  const urlInput = document.getElementById('url-input');
  const goBtn = document.getElementById('url-go-btn');
  const chipsContainer = document.getElementById('url-agency-chips');

  if (!urlInput || !goBtn) return;

  if (typeof AGENCIES !== 'undefined' && chipsContainer) {
    AGENCIES.slice(0, 5).forEach((agency) => {
      const btn = document.createElement('button');
      btn.className = 'url-chip';
      btn.textContent = agency.abbr;
      btn.title = agency.name;
      btn.addEventListener('click', () => {
        urlInput.value = agency.quickUrl;
        goBtn.disabled = false;
      });
      chipsContainer.appendChild(btn);
    });
  }

  urlInput.addEventListener('input', () => {
    goBtn.disabled = !urlInput.value.trim().startsWith('http');
  });

  goBtn.addEventListener('click', () => {
    const url = urlInput.value.trim();
    if (!url.startsWith('http')) return;
    onInputReady({ type: 'url', url });
  });

  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !goBtn.disabled) goBtn.click();
  });
}

function checkUrlParam() {
  const params = new URLSearchParams(location.search);
  const url = params.get('url');
  if (!url) return;
  setInputMode('url');
  const urlInput = document.getElementById('url-input');
  const goBtn = document.getElementById('url-go-btn');
  if (urlInput) urlInput.value = url;
  if (goBtn) goBtn.disabled = false;
}

/* ---------- text input ---------- */
function setupTextInput() {
  const textarea = document.getElementById('text-input');
  const goBtn = document.getElementById('text-go-btn');
  const charCount = document.getElementById('char-count');
  const MAX = 12000;

  textarea.addEventListener('input', () => {
    const len = textarea.value.length;
    charCount.textContent = `${len.toLocaleString()} / ${MAX.toLocaleString()}`;
    charCount.classList.toggle('over', len > MAX);
    goBtn.disabled = len < 10 || len > MAX;
  });

  goBtn.addEventListener('click', () => {
    const text = textarea.value.trim();
    if (text.length < 10) return;
    onInputReady({ type: 'text', textContent: text });
  });
}

/* ---------- API call ---------- */
async function runScan(action) {
  goStep('result');
  document.getElementById('scan-loading').style.display = 'flex';
  document.getElementById('scan-output').hidden = true;
  document.getElementById('result-footer').hidden = true;

  let endpoint, body;

  if (state.inputData.type === 'url') {
    endpoint = '/demo/fetch-url';
    body = { url: state.inputData.url, language: getLang(), action };
  } else {
    endpoint = '/demo/scan';
    body = { language: getLang(), action };
    if (state.inputData.type === 'file') {
      body.fileBase64 = state.inputData.fileBase64;
    } else {
      body.textContent = state.inputData.textContent;
    }
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    saveScanDeadlines(data);
    if (typeof tryScheduleNotificationsAfterAnalysis === 'function') {
      tryScheduleNotificationsAfterAnalysis(data);
    }
    renderScanResult(data);
  } catch {
    document.getElementById('scan-output').innerHTML =
      `<div class="error-box">${esc(t('scan_error_api'))}</div>`;
    document.getElementById('scan-output').hidden = false;
  } finally {
    document.getElementById('scan-loading').style.display = 'none';
    document.getElementById('result-footer').hidden = false;
  }
}

/* ---------- deadline persistence ---------- */
function saveScanDeadlines(data) {
  if (!data || !Array.isArray(data.deadlines) || data.deadlines.length === 0) return;
  const c = data.classification || {};
  try {
    const existing = JSON.parse(localStorage.getItem('bk_deadlines') || '[]');
    const now = new Date().toISOString();
    data.deadlines.forEach((dl) => {
      if (!dl.dueDate && !dl.description) return;
      existing.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        description: dl.description || '',
        dueDate: dl.dueDate || null,
        senderName: c.senderName || '',
        documentType: c.documentType || '',
        riskLevel: data.risk?.level || 'low',
        savedAt: now,
      });
    });
    localStorage.setItem('bk_deadlines', JSON.stringify(existing));
  } catch { /* ignore */ }
}

/* ---------- share ---------- */
function shareResult(summary) {
  const text = `📩 Analyserat av Brevklar:\n\n${summary}\n\nbrevklar.se`;
  if (navigator.share && navigator.canShare && navigator.canShare({ text })) {
    navigator.share({ title: 'Brevklar analys', text }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Kopierat till urklipp ✓');
    }).catch(() => {});
  }
}

function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'bk-toast';
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('visible')));
  setTimeout(() => {
    t.classList.remove('visible');
    setTimeout(() => t.remove(), 400);
  }, 2200);
}

/* ---------- result renderers ---------- */
function renderScanResult(data) {
  const out = document.getElementById('scan-output');

  if (data.type === 'translate' || data.type === 'explain') {
    const label = data.type === 'translate' ? t('scan_translation_label') : t('scan_explanation_label');
    out.innerHTML = `<div class="simple-result anim-block">
      <div class="simple-result-label">${esc(label)}</div>
      <div class="simple-result-text">${esc(data.result)}</div>
    </div>`;
  } else if (data.type === 'deal') {
    out.innerHTML = renderDeal(data);
  } else {
    out.innerHTML = renderAnalysis(data);
  }

  out.hidden = false;

  // Animate risk/confidence bars from 0 → target
  requestAnimationFrame(() => {
    setTimeout(() => {
      out.querySelectorAll('.bar-fill[data-w]').forEach((el) => {
        el.style.width = el.dataset.w + '%';
      });
    }, 300);
  });

  out.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderDeal(data) {
  const d = data.dealResult || {};
  const confPct = Math.round((d.confidence || 0) * 100);

  const altRows = (d.alternatives || []).map((a) => `
    <div class="deal-alt">
      <div>
        <div class="deal-alt-name">${esc(a.name)}</div>
        <div class="deal-alt-note">${esc(a.note)}</div>
      </div>
      <div class="deal-alt-cost">${esc(a.cost)}</div>
    </div>`).join('');

  const stepRows = (d.actionSteps || []).map((step, i) => `
    <div class="deal-step">
      <span class="deal-step-num">${i + 1}</span>
      <span>${esc(step)}</span>
    </div>`).join('');

  const currentCostBlock = d.currentCost ? `
    <div class="deal-block anim-block" style="--d:80ms">
      <h3>${esc(t('deal_current_label'))}</h3>
      <div class="deal-current-cost">${esc(d.currentCost)}</div>
      ${d.contractType ? `<div class="deal-contract-type">${esc(d.contractType)}</div>` : ''}
    </div>` : '';

  const altBlock = altRows ? `
    <div class="deal-block anim-block" style="--d:160ms">
      <h3>${esc(t('deal_alternatives_label'))}</h3>
      <div class="deal-alternatives">${altRows}</div>
    </div>` : '';

  const stepsBlock = stepRows ? `
    <div class="deal-block anim-block" style="--d:240ms">
      <h3>${esc(t('deal_steps_label'))}</h3>
      <div class="deal-steps">${stepRows}</div>
    </div>` : '';

  const negotiateBlock = d.negotiationTip ? `
    <div class="deal-block anim-block" style="--d:320ms">
      <h3>${esc(t('deal_negotiate_label'))}</h3>
      <p class="deal-negotiate">${esc(d.negotiationTip)}</p>
    </div>` : '';

  return `<div class="deal-result">
    <div class="deal-hero anim-block" style="--d:0ms">
      ${d.provider ? `<div class="deal-provider">${esc(d.provider)}</div>` : ''}
      ${d.service ? `<div class="deal-service">${esc(d.service)}</div>` : ''}
      ${d.potentialSaving ? `<div class="deal-saving-badge">⬇ ${esc(d.potentialSaving)}</div>` : ''}
      <div class="deal-verdict">${esc(d.verdict)}</div>
    </div>
    ${currentCostBlock}
    ${altBlock}
    ${stepsBlock}
    ${negotiateBlock}
    <div class="deal-block anim-block" style="--d:400ms">
      <h3>${esc(t('deal_confidence_label'))}</h3>
      <div class="deal-confidence-row">
        <span class="bar"><span class="bar-fill" data-w="${confPct}" style="background:var(--brand-hi)"></span></span>
        <strong>${confPct}%</strong>
      </div>
    </div>
  </div>`;
}

function riskBar(label, value) {
  const color = value >= 70 ? 'var(--red)' : value >= 35 ? 'var(--amber)' : 'var(--green)';
  return `<div class="risk-bar-row">
    <span>${esc(label)}</span>
    <span class="bar"><span class="bar-fill" data-w="${value}" style="background:${color}"></span></span>
    <span>${value}</span>
  </div>`;
}

function renderAnalysis(data) {
  const r = data.risk;
  const c = data.classification;
  const tags = [];
  if (c && c.senderName) tags.push(`<span class="tag">${esc(t('res_sender'))}: ${esc(c.senderName)}</span>`);
  if (c && c.documentType) tags.push(`<span class="tag">${esc(t('res_type'))}: ${esc(c.documentType)}</span>`);

  const actionItems = (data.actionPlan || []).map((a) => a.step);
  const validDl = (data.deadlines || []).filter((d) => d.dueDate || d.description);
  const deadlinesHtml = validDl.length
    ? `<div class="block anim-block" style="--d:320ms"><h3>${esc(t('res_deadlines'))}</h3><ul class="deadline-list">${validDl
        .map((d) => `<li><span>${esc(d.description)}</span><span class="deadline-date">${esc(d.dueDate || '—')}</span></li>`)
        .join('')}</ul><a href="/calendar" class="cal-link-btn">Visa i kalender →</a></div>`
    : '';
  const confidencePct = Math.round((data.trust?.confidenceScore ?? 0) * 100);

  // Priority card for high-risk documents
  const priorityCard = r && r.score >= 65
    ? `<div class="priority-card priority-${esc(r.level)} anim-block" style="--d:0ms">
        <span class="priority-icon">${r.score >= 80 ? '🚨' : '⚡'}</span>
        <div>
          <div class="priority-label">${r.score >= 80 ? 'Kräver omedelbar åtgärd' : 'Kräver din uppmärksamhet'}</div>
          <div class="priority-sub">Riskpoäng ${r.score}/100 ${validDl.length ? `· Deadline: ${validDl[0].dueDate || '—'}` : ''}</div>
        </div>
      </div>`
    : '';

  const shareIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>';
  const escapedSummary = (data.summary || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');

  return `<div class="result">
    <div class="result-head anim-block" style="--d:${priorityCard ? 80 : 0}ms">
      <div class="tags">${tags.join('')}</div>
      <div class="result-head-right">
        ${r ? `<span class="risk-pill risk-${esc(r.level)}">${esc(t('risk_' + r.level))} · ${r.score}/100</span>` : ''}
        <button class="btn-share" type="button" onclick="shareResult('${escapedSummary}')" title="Dela analys">${shareIcon}</button>
      </div>
    </div>
    ${priorityCard}
    <div class="block plain anim-block" style="--d:${priorityCard ? 160 : 80}ms"><h3>${esc(t('res_summary'))}</h3><p>${esc(data.summary)}</p></div>
    <div class="block plain anim-block" style="--d:${priorityCard ? 240 : 160}ms"><h3>${esc(t('res_plain'))}</h3><p>${esc(data.plainLanguage)}</p></div>
    ${actionItems.length ? `<div class="block anim-block" style="--d:${priorityCard ? 320 : 240}ms"><h3>${esc(t('res_action'))}</h3><ul class="action-list">${actionItems.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>` : ''}
    ${deadlinesHtml}
    ${r ? `<div class="block anim-block" style="--d:400ms">
      <h3>${esc(t('res_risk'))}</h3>
      <div class="risk-bars">
        ${riskBar(t('res_risk_legal'), r.breakdown.legal)}
        ${riskBar(t('res_risk_financial'), r.breakdown.financial)}
        ${riskBar(t('res_risk_deadline'), r.breakdown.deadline)}
      </div>
      ${r.needsHumanReview ? `<div class="review-flag">⚠ ${esc(t('res_review'))}</div>` : ''}
    </div>` : ''}
    ${data.consequences ? `<div class="block anim-block" style="--d:480ms"><h3>${esc(t('res_consequences'))}</h3><p>${esc(data.consequences)}</p></div>` : ''}
    ${(data.amounts || []).length ? `<div class="block anim-block" style="--d:560ms"><h3>${esc(t('res_amounts'))}</h3><div class="chips">${data.amounts.map((a) => `<span class="chip">${esc(a)}</span>`).join('')}</div></div>` : ''}
    ${(data.referenceNumbers || []).length ? `<div class="block anim-block" style="--d:640ms"><h3>${esc(t('res_refs'))}</h3><div class="chips">${data.referenceNumbers.map((a) => `<span class="chip">${esc(a)}</span>`).join('')}</div></div>` : ''}
    <div class="block anim-block" style="--d:720ms">
      <h3>${esc(t('res_confidence'))}</h3>
      <div class="confidence-row">
        <span class="bar" style="flex:1"><span class="bar-fill" data-w="${confidencePct}" style="background:var(--brand)"></span></span>
        <strong>${confidencePct}%</strong>
      </div>
    </div>
  </div>`;
}

/* ---------- init ---------- */
function initLangPicker() {
  const picker = document.getElementById('lang-picker');
  Object.keys(I18N).forEach((code) => {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = I18N[code]._name;
    picker.appendChild(opt);
  });
  picker.value = getLang();
  picker.addEventListener('change', (e) => setLang(e.target.value));
}

function init() {
  initLangPicker();
  applyTranslations();

  document.querySelectorAll('.input-tab').forEach((tab) => {
    tab.addEventListener('click', () => setInputMode(tab.dataset.mode));
  });

  document.getElementById('shutter-btn').addEventListener('click', () => {
    const dataUrl = captureFromVideo();
    if (dataUrl) onInputReady({ type: 'file', fileBase64: dataUrl });
  });

  setupDropZone();
  setupPasteCapture();
  setupUrlPanel();
  setupTextInput();
  checkUrlParam();

  document.getElementById('retake-btn').addEventListener('click', () => {
    state.inputData = null;
    goStep('input');
    if (state.inputMode === 'camera') startCamera();
  });

  document.querySelectorAll('.action-card').forEach((card) => {
    card.addEventListener('click', () => runScan(card.getAttribute('data-action')));
  });

  document.getElementById('scan-again-btn').addEventListener('click', () => {
    state.inputData = null;
    goStep('input');
    if (state.inputMode === 'camera') startCamera();
  });

  document.addEventListener('langchange', applyTranslations);

  startCamera();
}

document.addEventListener('DOMContentLoaded', init);
window.addEventListener('pagehide', stopCamera);
