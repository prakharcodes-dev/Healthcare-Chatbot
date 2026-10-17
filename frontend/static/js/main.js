(() => {
  'use strict';

  const USER_ID = 1;
  let sessionId = null;
  let currentSection = 'chat';
  let acController = null;
  let chartCache = {};
  let chartDirty = {};
  let activeMetric = 'temperature';
  let chartCtx = null;
  let chartData = {};
  let pendingMeasurements = null;
  let pendingSymptoms = null;
  let reminderPollTimer = null;
  let freqChoice = 'daily';

  const $ = (id) => document.getElementById(id);
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

  const METRIC_META = {
    temperature:    { label: 'Temperature',    unit: '°F',  ph1: 'e.g. 98.6', ph2: null,        unit2: null,   units: ['°F','°C'], valId: 'valTemp',    stId: 'stTemp',    tsId: 'tsTemp'    },
    weight:         { label: 'Weight',         unit: 'kg',  ph1: 'e.g. 72',   ph2: null,        unit2: null,   units: ['kg','lb'],  valId: 'valWeight',  stId: 'stWeight',  tsId: 'tsWeight'  },
    blood_pressure: { label: 'Blood Pressure', unit: 'mmHg',ph1: 'Systolic',  ph2: 'Diastolic', unit2: 'mmHg', units: ['mmHg'],     valId: 'valBp',      stId: 'stBp',      tsId: 'tsBp'      },
    blood_glucose:  { label: 'Blood Glucose',  unit: 'mg/dL',ph1:'e.g. 95',  ph2: null,        unit2: null,   units: ['mg/dL'],    valId: 'valGlucose', stId: 'stGlucose', tsId: 'tsGlucose' }
  };

  function fmt(ts) {
    const d = new Date(ts);
    return d.toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function fmtShort(ts) {
    const d = new Date(ts);
    return d.toLocaleString('en-IN', { month: 'short', day: 'numeric' });
  }
  function timeNow() {
    return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }
  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  async function api(url, opts = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      ...opts
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  function toast(msg, type = 'info', title = '') {
    const icons = { ok: 'fa-circle-check', warn: 'fa-triangle-exclamation', err: 'fa-circle-xmark', info: 'fa-circle-info' };
    const wrap = $('toastArea');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<i class="toast-icon fa-solid ${icons[type] || icons.info}"></i>
      <div class="toast-body">${title ? `<div class="toast-title">${esc(title)}</div>` : ''}<div class="toast-msg">${esc(msg)}</div></div>`;
    wrap.appendChild(t);
    setTimeout(() => { t.classList.add('dismiss'); setTimeout(() => t.remove(), 240); }, 4000);
  }

  function showSection(name) {
    currentSection = name;
    const titles = { chat: 'Symptom Checker', knowledge: 'Medical Knowledge', trends: 'Health Trends', reminders: 'Medication Reminders' };
    if ($('pageTitle')) $('pageTitle').textContent = titles[name] || name;

    qsa('.view').forEach(v => v.classList.remove('active'));
    const el = $(`section${name.charAt(0).toUpperCase() + name.slice(1)}`);
    if (el) el.classList.add('active');

    qsa('.sb-item[data-section]').forEach(b => b.classList.toggle('active', b.dataset.section === name));
    qsa('.bn-item[data-section]').forEach(b => b.classList.toggle('active', b.dataset.section === name));

    if (name === 'knowledge') initKnowledge();
    if (name === 'trends') initTrends();
    if (name === 'reminders') loadReminders();
  }

  function toggleSidebar(open) {
    const sb = $('sidebar');
    const bd = $('sidebarBackdrop');
    if (open === undefined) open = !sb.classList.contains('open');
    sb.classList.toggle('open', open);
    bd.classList.toggle('show', open);
  }

  function openModal(id) {
    const m = $(id);
    m.classList.add('open');
    document.body.style.overflow = 'hidden';
    const first = m.querySelector('button,input,select,textarea,a[href]');
    if (first) first.focus();
    const onKey = (e) => { if (e.key === 'Escape') { closeModal(id); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);
  }
  function closeModal(id) {
    $(id).classList.remove('open');
    document.body.style.overflow = '';
  }

  /* ─── CHAT ──────────────────────────────────────── */
  async function startSession() {
    try {
      const data = await api('/api/session/start', { method: 'POST', body: JSON.stringify({ user_id: USER_ID }) });
      sessionId = data.session_id;
      const badge = $('sessionBadge');
      if (badge) badge.textContent = `Session ${sessionId.slice(0, 8)}`;
    } catch (_) {
      sessionId = 'local-' + Date.now();
    }
  }

  function appendMsg(role, content, isHtml = false) {
    const welcome = $('chatWelcome');
    if (welcome) welcome.remove();

    const feed = $('chatFeed');
    const row = document.createElement('div');
    row.className = `msg-row ${role}`;

    const icon = role === 'user' ? 'fa-user' : 'fa-stethoscope';
    const avCls = role === 'user' ? 'user-av' : 'ai-av';
    row.innerHTML = `
      <div class="msg-avatar ${avCls}" aria-hidden="true"><i class="fa-solid ${icon}"></i></div>
      <div>
        <div class="msg-bubble">${isHtml ? content : esc(content)}</div>
        <div class="msg-time">${timeNow()}</div>
      </div>`;
    feed.appendChild(row);
    row.scrollIntoView({ behavior: 'smooth', block: 'end' });
    return row;
  }

  function showTyping() {
    const feed = $('chatFeed');
    const row = document.createElement('div');
    row.className = 'msg-row ai';
    row.id = 'typingRow';
    row.innerHTML = `
      <div class="msg-avatar ai-av" aria-hidden="true"><i class="fa-solid fa-stethoscope"></i></div>
      <div><div class="msg-bubble"><div class="typing-bubble">
        <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
      </div></div></div>`;
    feed.appendChild(row);
    row.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }
  function removeTyping() {
    const t = $('typingRow');
    if (t) t.remove();
  }

  function buildStructuredHtml(sr) {
    const causes = sr.possible_causes || [];
    const meas = sr.measurements_summary || [];
    let html = '';

    if (causes.length) {
      html += `<div class="sr-section"><div class="sr-label">Possible conditions</div>
        <div class="sr-causes">${causes.map(c => `<span class="cause-pill">${esc(c)}</span>`).join('')}</div></div>`;
    }
    if (meas.length) {
      html += `<div class="sr-section"><div class="sr-label">Your readings</div>`;
      meas.forEach(m => {
        const stLow = (m.status || '').toLowerCase();
        const stCls = stLow.includes('high') || stLow.includes('elevated') ? 'high' : stLow.includes('low') ? 'low' : 'normal';
        html += `<div class="sr-measurement"><span>${esc(m.metric)}: <strong>${esc(m.value)}</strong></span>
          <span class="ms-status ${stCls}">${esc(m.status)}</span></div>`;
      });
      html += `</div>`;
    }
    if (sr.why) html += `<div class="sr-section"><div class="sr-label">Analysis</div><p>${esc(sr.why)}</p></div>`;
    if (sr.what_you_can_do) html += `<div class="sr-section"><div class="sr-label">Recommendations</div><p>${esc(sr.what_you_can_do)}</p></div>`;
    if (sr.seek_medical_care_if) html += `<div class="sr-section"><div class="sr-label">Seek care if</div><p>${esc(sr.seek_medical_care_if)}</p></div>`;
    if (sr.emergency_warning) {
      const isUrgent = sr.emergency_warning.includes('URGENT');
      html += `<div class="sr-section"><div class="sr-label" style="color:var(--err-tx)">Emergency guidance</div>
        <p style="color:var(--err-tx);font-weight:${isUrgent ? '700' : '400'}">${esc(sr.emergency_warning)}</p></div>`;
    }
    return html;
  }

  function buildMeasCard(needed, symptoms) {
    const fields = {
      temperature: `<div class="meas-field"><label>Temperature (°C or °F)</label><input type="number" step="any" placeholder="e.g. 98.6" id="mf_temp"></div>`,
      blood_pressure: `
        <div class="meas-field"><label>Systolic BP (mmHg)</label><input type="number" placeholder="e.g. 120" id="mf_bps"></div>
        <div class="meas-field"><label>Diastolic BP (mmHg)</label><input type="number" placeholder="e.g. 80" id="mf_bpd"></div>`,
      weight: `<div class="meas-field"><label>Weight (kg)</label><input type="number" step="any" placeholder="e.g. 70" id="mf_wt"></div>`
    };
    let html = `<div class="meas-card"><div class="meas-title"><i class="fa-solid fa-ruler-horizontal"></i> Health Measurements Requested</div>
      <p style="font-size:.82rem;color:var(--tx2);margin-bottom:10px">Providing these helps improve the analysis. You can skip if unavailable.</p>
      <div class="meas-grid">`;
    (needed || []).forEach(m => { if (fields[m]) html += fields[m]; });
    html += `</div><div class="meas-actions">
      <button class="btn btn-primary btn-sm" id="submitMeasBtn"><i class="fa-solid fa-check"></i> Submit</button>
      <button class="btn btn-ghost btn-sm" id="skipMeasBtn">Skip</button>
    </div></div>`;
    return html;
  }

  async function sendSymptoms(text, measurements, skip) {
    const payload = { symptoms: text, session_id: sessionId, user_id: USER_ID };
    if (measurements) payload.measurements = measurements;
    if (skip) payload.skip_measurements = true;

    showTyping();
    $('sendBtn').disabled = true;
    try {
      const data = await api('/predict', { method: 'POST', body: JSON.stringify(payload) });
      removeTyping();

      if (data.requested_measurements) {
        pendingMeasurements = data.requested_measurements;
        pendingSymptoms = text;
        const row = appendMsg('ai', buildMeasCard(data.requested_measurements, text), true);
        const submitBtn = row.querySelector('#submitMeasBtn');
        const skipBtn   = row.querySelector('#skipMeasBtn');
        if (submitBtn) submitBtn.addEventListener('click', () => collectAndSubmitMeasurements(text));
        if (skipBtn)   skipBtn.addEventListener('click', () => { pendingMeasurements = null; sendSymptoms(text, null, true); });
        return;
      }

      const sr = data.structured_response || {};
      const html = buildStructuredHtml(sr);
      appendMsg('ai', html || 'Analysis complete. Please consult a healthcare professional for guidance.', true);
    } catch (e) {
      removeTyping();
      appendMsg('ai', `I encountered an error: ${e.message}. Please try again.`);
    } finally {
      $('sendBtn').disabled = false;
    }
  }

  function collectAndSubmitMeasurements(originalText) {
    const meas = {};
    const tempEl = $('mf_temp'), bpsEl = $('mf_bps'), bpdEl = $('mf_bpd'), wtEl = $('mf_wt');
    if (tempEl && tempEl.value) meas.temperature = parseFloat(tempEl.value);
    if (bpsEl && bpsEl.value) { meas.bp_sys = parseFloat(bpsEl.value); if (bpdEl && bpdEl.value) meas.bp_dia = parseFloat(bpdEl.value); }
    if (wtEl && wtEl.value) meas.weight = parseFloat(wtEl.value);
    sendSymptoms(originalText, Object.keys(meas).length ? meas : null, !Object.keys(meas).length);
  }

  function initChat() {
    const input = $('chatInput');
    const sendBtn = $('sendBtn');

    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 140) + 'px';
      triggerAutocomplete(input.value);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
      if (e.key === 'Escape') closeAc();
      if (e.key === 'ArrowDown') { e.preventDefault(); focusAcItem(0); }
    });

    sendBtn.addEventListener('click', doSend);

    qsa('.sug-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        input.value = btn.dataset.text;
        input.dispatchEvent(new Event('input'));
        doSend();
      });
    });
  }

  function doSend() {
    const input = $('chatInput');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    input.style.height = 'auto';
    closeAc();
    appendMsg('user', text);
    sendSymptoms(text, null, false);
  }

  /* Autocomplete */
  let acTimer = null;
  function triggerAutocomplete(val) {
    clearTimeout(acTimer);
    if (val.trim().length < 2) { closeAc(); return; }
    acTimer = setTimeout(() => fetchAc(val.trim()), 280);
  }
  async function fetchAc(text) {
    if (acController) acController.abort();
    acController = new AbortController();
    try {
      const data = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: acController.signal
      }).then(r => r.json());

      const sugs = data.suggestions || {};
      const items = [
        ...(sugs.symptoms || []).map(s => ({ label: s, type: 'symptom' })),
        ...(sugs.diseases || []).map(d => ({ label: d, type: 'condition' }))
      ];
      renderAc(items);
    } catch (_) {}
  }
  function renderAc(items) {
    const dd = $('acDropdown');
    if (!items.length) { closeAc(); return; }
    dd.innerHTML = items.slice(0, 8).map((it, i) =>
      `<div class="ac-item" tabindex="-1" data-idx="${i}" role="option">
        <i class="fa-solid ${it.type === 'symptom' ? 'fa-circle-dot' : 'fa-book-medical'}" style="color:var(--brand)"></i>
        ${esc(it.label)}<span class="ac-type">${esc(it.type)}</span>
      </div>`
    ).join('');
    dd.classList.add('open');
    dd.querySelectorAll('.ac-item').forEach(el => {
      el.addEventListener('click', () => {
        $('chatInput').value = el.firstElementChild.nextSibling.textContent.trim();
        closeAc();
        $('chatInput').focus();
      });
    });
  }
  function closeAc() { $('acDropdown').classList.remove('open'); }
  function focusAcItem(idx) {
    const items = qsa('.ac-item', $('acDropdown'));
    if (items[idx]) items[idx].focus();
  }

  /* History modal */
  async function openHistory() {
    openModal('historyModal');
    const body = $('historyModalBody');
    body.innerHTML = '<div class="loading-state"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading…</div>';
    try {
      const data = await api(`/api/history/user/${USER_ID}?limit=20`);
      const sessions = data.history || [];
      if (!sessions.length) { body.innerHTML = '<p style="color:var(--tx3);text-align:center;padding:32px">No chat history yet.</p>'; return; }
      body.innerHTML = sessions.map(s =>
        (s.messages || []).map(m => `<div class="hist-item">
          <div class="hist-ts">${esc(m.time ? new Date(m.time).toLocaleString() : '')}</div>
          <div class="hist-user">${esc(m.user || '')}</div>
          <div class="hist-bot">${esc(typeof m.bot === 'string' ? m.bot.slice(0, 120) : '')}</div>
        </div>`).join('')
      ).join('');
    } catch (_) {
      body.innerHTML = '<p style="color:var(--err-tx);text-align:center;padding:32px">Could not load history.</p>';
    }
  }

  /* ─── KNOWLEDGE ─────────────────────────────────── */
  let kbLoaded = false;
  let kbDiseases = [];
  let kbActiveCategory = '';
  let kbSearchTimer = null;

  async function initKnowledge() {
    if (kbLoaded) return;
    kbLoaded = true;
    showKbSkeletons(6);
    try {
      const data = await api('/api/knowledge/search', { method: 'POST', body: JSON.stringify({ limit: 60 }) });
      kbDiseases = data.results || [];
      const count = $('kbDiseaseCount');
      if (count) count.textContent = data.total || kbDiseases.length;
      const welcome = $('diseaseCountWelcome');
      if (welcome) welcome.textContent = data.total || kbDiseases.length;
      buildCategories();
      renderKb(kbDiseases);
    } catch (_) {
      $('kbGrid').innerHTML = '<p style="color:var(--err-tx);padding:16px">Could not load medical knowledge base.</p>';
    }
    $('kbSearch').addEventListener('input', () => {
      clearTimeout(kbSearchTimer);
      kbSearchTimer = setTimeout(searchKb, 280);
    });
  }

  function showKbSkeletons(n) {
    $('kbGrid').innerHTML = `<div class="kb-skeleton-grid">${Array(n).fill(`<div class="skel skel-card"></div>`).join('')}</div>`;
  }

  function buildCategories() {
    const cats = [...new Set(kbDiseases.map(d => d.category || 'General').filter(Boolean))].sort();
    const bar = $('catBar');
    bar.innerHTML = `<button class="cat-pill active" data-cat="">All</button>` +
      cats.slice(0, 12).map(c => `<button class="cat-pill" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
    bar.addEventListener('click', e => {
      const pill = e.target.closest('.cat-pill');
      if (!pill) return;
      qsa('.cat-pill', bar).forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      kbActiveCategory = pill.dataset.cat;
      searchKb();
    });
  }

  async function searchKb() {
    const q = ($('kbSearch').value || '').trim();
    showKbSkeletons(6);
    try {
      const body = { limit: 60 };
      if (q) body.query = q;
      if (kbActiveCategory) body.category = kbActiveCategory;
      const data = await api('/api/knowledge/search', { method: 'POST', body: JSON.stringify(body) });
      renderKb(data.results || []);
    } catch (_) {
      $('kbGrid').innerHTML = '<p style="color:var(--err-tx);padding:16px">Search failed. Please try again.</p>';
    }
  }

  function renderKb(list) {
    const grid = $('kbGrid');
    if (!list.length) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--tx3)">
        <i class="fa-solid fa-magnifying-glass" style="font-size:2rem;margin-bottom:12px"></i>
        <p>No conditions found. Try a different search.</p></div>`;
      return;
    }
    grid.innerHTML = list.map(d => {
      const syms = (d.symptoms || []).slice(0, 4);
      return `<div class="kb-card" data-name="${esc(d.disease)}" tabindex="0" role="button" aria-label="View details for ${esc(d.disease)}">
        <div class="kb-card-head">
          <div class="kb-card-name">${esc(d.disease)}</div>
          ${d.category ? `<span class="kb-card-cat">${esc(d.category)}</span>` : ''}
        </div>
        <div class="kb-card-syms">${syms.map(s => `<span class="sym-tag">${esc(s)}</span>`).join('')}${d.symptoms && d.symptoms.length > 4 ? `<span class="sym-tag">+${d.symptoms.length - 4} more</span>` : ''}</div>
        <div class="kb-card-footer">
          <span>${d.severity ? 'Severity: ' + esc(d.severity) : ''}</span>
          <span class="kb-card-action"><i class="fa-solid fa-arrow-right"></i> Details</span>
        </div>
      </div>`;
    }).join('');
    grid.querySelectorAll('.kb-card').forEach(card => {
      const open = () => openDiseaseDetail(card.dataset.name);
      card.addEventListener('click', open);
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
  }

  async function openDiseaseDetail(name) {
    openModal('detailModal');
    $('detailModalTitle').textContent = name;
    const body = $('detailModalBody');
    body.innerHTML = '<div class="loading-state"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading…</div>';
    try {
      const data = await api(`/api/knowledge/${encodeURIComponent(name)}`);
      const d = data.disease || {};
      const syms = (d.symptoms || []).map(s => `<span class="dd-sym">${esc(s)}</span>`).join('');
      body.innerHTML = `
        <div class="dd-header">
          <h3 class="dd-title">${esc(d.disease || name)}</h3>
          <div class="dd-meta">
            ${d.category ? `<span class="dd-badge">${esc(d.category)}</span>` : ''}
            ${d.severity ? `<span class="dd-badge">${esc(d.severity)}</span>` : ''}
            ${d.specialist ? `<span class="dd-badge">See: ${esc(d.specialist)}</span>` : ''}
          </div>
        </div>
        ${syms ? `<div class="dd-section"><h4>Symptoms</h4><div class="dd-syms">${syms}</div></div>` : ''}
        ${d.causes ? `<div class="dd-section"><h4>Causes</h4><p>${esc(d.causes)}</p></div>` : ''}
        ${d.risk_factors ? `<div class="dd-section"><h4>Risk Factors</h4><p>${esc(d.risk_factors)}</p></div>` : ''}
        ${d.treatment || d.medicine ? `<div class="dd-section"><h4>Treatment</h4><p>${esc(d.treatment || d.medicine)}</p></div>` : ''}
        ${d.prevention || d.prevention_tips ? `<div class="dd-section"><h4>Prevention</h4><p>${esc(d.prevention || d.prevention_tips)}</p></div>` : ''}
        ${d.when_to_seek_care ? `<div class="dd-section"><h4>When to Seek Care</h4><p>${esc(d.when_to_seek_care)}</p></div>` : ''}`;
    } catch (_) {
      body.innerHTML = '<p style="color:var(--err-tx);text-align:center;padding:32px">Could not load details.</p>';
    }
  }

  /* ─── HEALTH TRENDS ─────────────────────────────── */
  async function initTrends() {
    await loadTrendsSummary();
    await loadReadingHistory();
    setupLogForm();
    setupMetricTabs();
  }

  function invalidateChartCache() {
    chartCache = {};
    chartDirty = {};
    if (currentSection === 'trends') {
      loadTrendsSummary();
      loadReadingHistory();
      renderChart(activeMetric);
    }
  }

  async function loadTrendsSummary() {
    try {
      const data = await api(`/api/health-trends/summary/${USER_ID}`);
      const s = data.summary || {};
      const a = data.assessment || {};

      Object.entries(METRIC_META).forEach(([k, m]) => {
        const entry = s[k];
        const valEl = $(m.valId), stEl = $(m.stId), tsEl = $(m.tsId);
        if (!valEl) return;
        if (entry && entry.latest) {
          const l = entry.latest;
          valEl.textContent = k === 'blood_pressure'
            ? `${l.val_pri}/${l.val_sec || '—'} ${l.unit || 'mmHg'}`
            : `${l.val_pri} ${l.unit || m.unit}`;
          if (stEl) {
            const stClass = statusCss(l.status);
            stEl.textContent = l.status;
            stEl.className = `vc-status ${stClass}`;
          }
          if (tsEl) tsEl.textContent = fmtShort(l.time);
        } else {
          valEl.textContent = '—';
          if (stEl) { stEl.textContent = 'No data'; stEl.className = 'vc-status'; }
          if (tsEl) tsEl.textContent = '';
        }
      });

      const badge = $('acBadge'), title = $('acTitle'), msg = $('acMsg');
      if (a.title) {
        const t = title; if (t) t.textContent = a.title;
        const m = msg; if (m) m.textContent = a.message;
        const st = (a.status || '').toLowerCase();
        badge.className = 'ac-badge' + (st.includes('good') || st.includes('stable') ? ' good' : st.includes('attention') ? ' err' : ' warn');
        badge.querySelector('i').className = `fa-solid ${a.icon || 'fa-circle-info'}`;
        badge.querySelector('span').textContent = a.status || '';
      }
    } catch (_) {}
  }

  function statusCss(s) {
    if (!s) return '';
    const sl = s.toLowerCase();
    if (sl.includes('high') || sl.includes('elevated') || sl.includes('stage')) return 'Elevated';
    if (sl.includes('low')) return 'Low';
    return 'Normal';
  }

  function badgeClass(s) {
    const c = statusCss(s);
    if (c === 'Elevated') return 'badge-err';
    if (c === 'Low') return 'badge-warn';
    return 'badge-ok';
  }

  async function loadReadingHistory() {
    const tbody = $('historyBody');
    try {
      const data = await api(`/api/health-trends/user/${USER_ID}?limit=50`);
      const logs = data.logs || [];
      if (!logs.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No readings logged yet.</td></tr>';
        return;
      }
      tbody.innerHTML = logs.map(l => {
        const val = l.metric_type === 'blood_pressure' && l.value_secondary
          ? `${l.value_primary}/${l.value_secondary} ${l.unit}`
          : `${l.value_primary} ${l.unit}`;
        const stCls = statusCss(l.status);
        const badgeCls = badgeClass(l.status);
        return `<tr>
          <td>${esc(fmt(l.timestamp))}</td>
          <td>${esc(l.metric_type.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()))}</td>
          <td><strong>${esc(val)}</strong></td>
          <td><span class="badge ${badgeCls}">${esc(l.status || 'Normal')}</span></td>
          <td style="color:var(--tx3)">${esc(l.notes || '—')}</td>
          <td>
            <button class="btn btn-ghost btn-sm del-reading" data-id="${l.id}" aria-label="Delete reading">
              <i class="fa-solid fa-trash-can" style="color:var(--err-tx)"></i>
            </button>
          </td>
        </tr>`;
      }).join('');
      tbody.querySelectorAll('.del-reading').forEach(btn => {
        btn.addEventListener('click', () => deleteReading(btn.dataset.id));
      });
    } catch (_) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-row" style="color:var(--err-tx)">Could not load readings.</td></tr>';
    }
  }

  async function deleteReading(id) {
    if (!confirm('Delete this reading?')) return;
    try {
      await api(`/api/health-trends/${id}`, { method: 'DELETE' });
      toast('Reading deleted.', 'ok');
      invalidateChartCache();
    } catch (_) {
      toast('Could not delete reading.', 'err');
    }
  }

  function setupLogForm() {
    const metricSel = $('logMetric');
    const val2Group = $('val2Group');
    const unitSel = $('logUnit');
    const primaryLbl = $('primaryLbl');

    function updateFields() {
      const m = metricSel.value;
      const meta = METRIC_META[m];
      $('logVal1').placeholder = meta.ph1;
      primaryLbl.textContent = meta.label + (meta.units ? ` (${meta.units[0]})` : '');
      val2Group.style.display = meta.ph2 ? '' : 'none';
      unitSel.innerHTML = (meta.units || [meta.unit]).map(u => `<option value="${esc(u)}">${esc(u)}</option>`).join('');
    }
    metricSel.addEventListener('change', updateFields);
    updateFields();

    $('logForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const metric = metricSel.value;
      const v1 = parseFloat($('logVal1').value);
      const v2 = $('logVal2').value ? parseFloat($('logVal2').value) : null;
      const unit = unitSel.value;
      const notes = $('logNotes').value.trim();

      if (isNaN(v1) || v1 <= 0) { toast('Enter a valid reading value.', 'warn'); return; }

      const fb = $('logFeedback');
      fb.style.display = 'none';

      try {
        const data = await api('/api/health-trends/log', {
          method: 'POST',
          body: JSON.stringify({ user_id: USER_ID, metric_type: metric, value_primary: v1, value_secondary: v2, unit, notes })
        });
        const asmt = data.assessment || {};
        fb.style.display = 'flex';
        fb.className = 'log-feedback';
        $('logFbIcon').className = 'fa-solid fa-circle-check';
        $('logFbText').textContent = asmt.single_feedback || data.message || 'Reading logged.';
        $('logVal1').value = '';
        $('logVal2').value = '';
        $('logNotes').value = '';
        toast('Reading saved successfully.', 'ok');
        invalidateChartCache();
      } catch (_) {
        fb.style.display = 'flex';
        fb.className = 'log-feedback err';
        $('logFbIcon').className = 'fa-solid fa-circle-xmark';
        $('logFbText').textContent = 'Could not save reading. Please try again.';
      }
    });
  }

  function setupMetricTabs() {
    $('metricTabs').addEventListener('click', e => {
      const tab = e.target.closest('.mt-tab');
      if (!tab) return;
      qsa('.mt-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeMetric = tab.dataset.metric;
      renderChart(activeMetric);
    });
    renderChart(activeMetric);
  }

  async function getChartData(metric) {
    if (chartCache[metric] && !chartDirty[metric]) return chartCache[metric];
    const data = await api(`/api/health-trends/user/${USER_ID}?metric_type=${metric}&limit=20`);
    const logs = (data.logs || []).slice().reverse();
    chartCache[metric] = logs;
    return logs;
  }

  async function renderChart(metric) {
    const canvas = $('trendCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const wrap = canvas.parentElement;
    canvas.width = wrap.offsetWidth || 400;
    canvas.height = 210;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let logs = [];
    try { logs = await getChartData(metric); } catch (_) {}

    if (!logs.length) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No data yet — log a reading to see the chart.', canvas.width / 2, canvas.height / 2);
      return;
    }

    const meta = METRIC_META[metric];
    const vals = logs.map(l => l.value_primary);
    const min = Math.min(...vals), max = Math.max(...vals);
    const range = max - min || 1;
    const padX = 48, padY = 24, padB = 36;
    const w = canvas.width - padX * 2;
    const h = canvas.height - padY - padB;

    const isDark = document.documentElement.dataset.theme === 'dark';
    const lineColor = '#0f766e';
    const fillColor = isDark ? 'rgba(15,118,110,.15)' : 'rgba(15,118,110,.08)';
    const gridColor = isDark ? '#334155' : '#e2e8f0';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    ctx.strokeStyle = gridColor; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padY + (h / 4) * i;
      ctx.beginPath(); ctx.moveTo(padX, y); ctx.lineTo(padX + w, y); ctx.stroke();
      const val = max - (range / 4) * i;
      ctx.fillStyle = textColor; ctx.font = '11px Inter,sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(val.toFixed(1), padX - 6, y + 4);
    }

    const pts = logs.map((l, i) => ({
      x: padX + (w / Math.max(logs.length - 1, 1)) * i,
      y: padY + h - ((l.value_primary - min) / range) * h,
      log: l
    }));

    ctx.beginPath();
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length - 1].x, padY + h);
    ctx.lineTo(pts[0].x, padY + h);
    ctx.closePath();
    ctx.fillStyle = fillColor; ctx.fill();

    ctx.beginPath(); ctx.strokeStyle = lineColor; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();

    pts.forEach(p => {
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = lineColor; ctx.strokeStyle = isDark ? '#1e293b' : '#fff'; ctx.lineWidth = 2;
      ctx.fill(); ctx.stroke();
    });

    logs.forEach((l, i) => {
      const x = padX + (w / Math.max(logs.length - 1, 1)) * i;
      ctx.fillStyle = textColor; ctx.font = '10px Inter,sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(l.time ? l.time.slice(0, 6) : '', x, padY + h + 16);
    });

    const tip = $('chartTip');
    canvas.onmousemove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      let closest = null, minDist = Infinity;
      pts.forEach(p => { const d = Math.abs(p.x - mx); if (d < minDist) { minDist = d; closest = p; } });
      if (closest && minDist < 28) {
        tip.classList.add('visible');
        tip.textContent = `${closest.log.value_primary} ${meta.unit}${closest.log.value_secondary ? '/' + closest.log.value_secondary : ''} · ${closest.log.status || 'Normal'} · ${closest.log.time || ''}`;
        let tx = closest.x + rect.left - wrap.getBoundingClientRect().left + 8;
        const tw = tip.offsetWidth;
        if (tx + tw > wrap.offsetWidth) tx = closest.x - tw - 8;
        tip.style.left = tx + 'px';
        tip.style.top = (closest.y - 36) + 'px';
      } else {
        tip.classList.remove('visible');
      }
    };
    canvas.onmouseleave = () => tip.classList.remove('visible');
  }

  /* ─── REMINDERS ─────────────────────────────────── */
  async function loadReminders() {
    const list = $('remindersList');
    list.innerHTML = '';
    try {
      const data = await api(`/api/reminders/active?user_id=${USER_ID}`);
      const reminders = data.reminders || [];
      if (!reminders.length) {
        list.innerHTML = `<div class="empty-reminders">
          <i class="fa-solid fa-bell-slash"></i>
          <p>No active reminders. Add one to get started.</p>
        </div>`;
        return;
      }
      list.innerHTML = reminders.map(r => `
        <div class="reminder-card" data-id="${r.id}">
          <div class="rem-icon"><i class="fa-solid fa-pills"></i></div>
          <div class="rem-body">
            <div class="rem-name">${esc(r.title || r.med_name || 'Medication')}</div>
            <div class="rem-meta">
              <i class="fa-regular fa-clock"></i> ${esc(r.time_formatted || '')} &nbsp;·&nbsp;
              ${esc(r.message || '')}
            </div>
          </div>
        </div>`).join('');
    } catch (_) {
      list.innerHTML = '<p style="color:var(--err-tx);padding:16px">Could not load reminders.</p>';
    }
  }

  async function createReminder(payload) {
    await api('/api/reminders/create', { method: 'POST', body: JSON.stringify(payload) });
  }

  function initReminderModal() {
    const freqWrap = $('freqPills');
    const dayGroup = $('dayPickerGroup');

    freqWrap.addEventListener('click', e => {
      const pill = e.target.closest('.fpill');
      if (!pill) return;
      qsa('.fpill', freqWrap).forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      freqChoice = pill.dataset.freq;
      dayGroup.style.display = freqChoice === 'custom' ? '' : 'none';
    });

    $('dayPills').addEventListener('click', e => {
      const pill = e.target.closest('.dpill');
      if (pill) pill.classList.toggle('active');
    });

    $('addReminderForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = $('remMedName').value.trim();
      const dosage = $('remDosage').value.trim();
      const time = $('remTime').value;
      const days = parseInt($('remDays').value) || 30;

      if (!name || !time) { toast('Enter medication name and time.', 'warn'); return; }

      try {
        await createReminder({ user_id: USER_ID, med_name: name, dosage, time, duration_days: days });
        toast(`Reminder set for ${name}.`, 'ok', 'Reminder Scheduled');
        closeModal('addReminderModal');
        $('addReminderForm').reset();
        qsa('.fpill').forEach((p, i) => p.classList.toggle('active', i === 0));
        loadReminders();
      } catch (_) {
        toast('Could not schedule reminder.', 'err');
      }
    });
  }

  async function pollDueReminders() {
    try {
      const data = await api(`/api/reminders/due?user_id=${USER_ID}`);
      const due = data.due_reminders || [];
      due.forEach(r => toast(r.message || r.title, 'info', r.title || 'Medication Reminder'));
    } catch (_) {}
  }

  /* ─── THEME ─────────────────────────────────────── */
  function applyTheme(dark) {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const icon = dark ? 'fa-sun' : 'fa-moon';
    const label = dark ? 'Light Mode' : 'Dark Mode';
    if ($('themeIcon')) $('themeIcon').className = `fa-solid ${icon}`;
    if ($('themeLabel')) $('themeLabel').textContent = label;
    if ($('mobileThemeIcon')) $('mobileThemeIcon').className = `fa-solid ${icon}`;
    localStorage.setItem('theme', dark ? 'dark' : 'light');
    if (currentSection === 'trends') renderChart(activeMetric);
  }

  /* ─── BOOT ──────────────────────────────────────── */
  function boot() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme === 'dark');

    qsa('.sb-item[data-section]').forEach(btn => {
      btn.addEventListener('click', () => {
        showSection(btn.dataset.section);
        if (window.innerWidth <= 768) toggleSidebar(false);
      });
    });
    qsa('.bn-item[data-section]').forEach(btn => {
      btn.addEventListener('click', () => showSection(btn.dataset.section));
    });

    $('menuBtn').addEventListener('click', () => toggleSidebar());
    $('sidebarBackdrop').addEventListener('click', () => toggleSidebar(false));

    $('themeToggleBtn').addEventListener('click', () => applyTheme(document.documentElement.dataset.theme !== 'dark'));
    $('themeToggleMobile').addEventListener('click', () => applyTheme(document.documentElement.dataset.theme !== 'dark'));

    $('historyBtn').addEventListener('click', openHistory);
    $('closeHistoryModal').addEventListener('click', () => closeModal('historyModal'));
    $('closeDetailModal').addEventListener('click', () => closeModal('detailModal'));
    $('closeAddReminderModal').addEventListener('click', () => closeModal('addReminderModal'));
    $('openAddReminderBtn').addEventListener('click', () => openModal('addReminderModal'));

    qsa('.modal').forEach(m => {
      m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); });
    });

    if ('Notification' in window && Notification.permission === 'default') {
      $('notifBar').style.display = 'flex';
    }
    $('enableNotifsBtn') && $('enableNotifsBtn').addEventListener('click', () => {
      Notification.requestPermission().then(p => {
        if (p === 'granted') { $('notifBar').style.display = 'none'; toast('Notifications enabled.', 'ok'); }
      });
    });

    initChat();
    initReminderModal();
    startSession();
    showSection('chat');

    reminderPollTimer = setInterval(pollDueReminders, 60000);

    api('/health').then(d => {
      const count = d.disease_count;
      const el = $('diseaseCountWelcome');
      if (el && count) el.textContent = count + '+';
    }).catch(() => {});

    window.addEventListener('resize', () => {
      if (currentSection === 'trends') renderChart(activeMetric);
    });
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', boot)
    : boot();
})();
