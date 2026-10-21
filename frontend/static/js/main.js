/* ==========================================================================
   MedVitals AI - Client Logic & Interactivity
   ========================================================================== */

const state = {
    sessionId: null,
    userId: 1,
    reminderTimes: [],
    activeReminders: [],
    searchHistory: [],
    suggestDebounceTimer: null,
    language: localStorage.getItem('medvitals-language') || 'en',
    activeSection: 'chat'
};

// Initialize Application
document.addEventListener('DOMContentLoaded', init);

async function init() {
    initTheme();
    initSidebarState();
    setupEventListeners();
    const languagePicker = document.getElementById('languagePicker');
    if (languagePicker) { languagePicker.value = ['en','hi','bn','es'].includes(state.language) ? state.language : 'en'; applyLanguage(state.language); languagePicker.addEventListener('change', e => applyLanguage(e.target.value)); }
    await startSession();
    await checkConnection();
    updateDiseaseCount();
    await loadReminders();
    await loadSearchHistory();
    
    // Periodically update connection status
    setInterval(checkConnection, 45000);
    
    // Check permission status
    updateNotificationUI();
    
    // Start automatic checking of medication reminders (every 10 seconds)
    startReminderChecker();
}

// Event Listeners Setup
function setupEventListeners() {
    // Sidebar toggle buttons
    document.getElementById('toggleLeftSidebarBtn')?.addEventListener('click', toggleLeftSidebar);
    document.getElementById('toggleRightSidebarBtn')?.addEventListener('click', toggleRightSidebar);

    // Menu items
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', handleMenuClick);
    });
    
    // Chat action buttons
    document.getElementById('sendBtn').addEventListener('click', sendMessage);
    document.getElementById('userInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    
    // Suggest autocomplete list
    document.getElementById('userInput').addEventListener('input', handleSymptomInput);
    
    // Close suggestions list if clicked outside
    document.addEventListener('click', (e) => {
        const autoContainer = document.getElementById('autocompleteContainer');
        const userInput = document.getElementById('userInput');
        if (e.target !== autoContainer && e.target !== userInput) {
            autoContainer.style.display = 'none';
        }
    });

    // Panel actions
    document.getElementById('addReminderBtn').addEventListener('click', showAddReminderModal);
    document.getElementById('testReminderBtn')?.addEventListener('click', testReminderAlert);
    document.getElementById('viewHistoryBtn').addEventListener('click', viewHistory);
    document.getElementById('themeToggleBtn').addEventListener('click', toggleTheme);

    // Knowledge Search events
    document.getElementById('knowledgeSearchBtn')?.addEventListener('click', () => {
        const q = document.getElementById('knowledgeSearchInput').value.trim();
        loadMedicalKnowledge(q, state.activeCategory || '');
    });
    document.getElementById('knowledgeSearchInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const q = e.target.value.trim();
            loadMedicalKnowledge(q, state.activeCategory || '');
        }
    });
    document.querySelectorAll('#knowledgeCategoryPills .cat-pill').forEach(pill => {
        pill.addEventListener('click', (e) => {
            document.querySelectorAll('#knowledgeCategoryPills .cat-pill').forEach(p => p.classList.remove('active'));
            e.currentTarget.classList.add('active');
            state.activeCategory = e.currentTarget.dataset.category || '';
            const q = document.getElementById('knowledgeSearchInput').value.trim();
            loadMedicalKnowledge(q, state.activeCategory);
        });
    });

    // Health Trends Form events
    document.getElementById('metricTypeSelect')?.addEventListener('change', handleMetricTypeChange);
    document.getElementById('healthLogForm')?.addEventListener('submit', handleHealthLogSubmit);
    
    // Chart metric tab selector
    document.querySelectorAll('.chart-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
            e.currentTarget.classList.add('active');
            const metric = e.currentTarget.dataset.metric;
            state.activeChartMetric = metric;
            if (state.trendsSummary && state.trendsSummary[metric]) {
                renderTrendCanvasChart(metric, state.trendsSummary[metric].history || []);
            }
        });
    });
}

// Menu Click Router
function handleMenuClick(e) {
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    e.currentTarget.classList.add('active');
    
    const section = e.currentTarget.dataset.section;
    switchSection(section);
}

function switchSection(section) {
    state.activeSection = section;
    document.querySelectorAll('.app-section').forEach(sec => {
        sec.style.display = 'none';
    });
    
    const mainTitle = document.getElementById('mainTitle');
    const mainSubtitle = document.getElementById('mainSubtitle');
    
    if (section === 'chat') {
        document.getElementById('sectionChat').style.display = 'flex';
        if (mainTitle) mainTitle.textContent = 'MedVitals AI — Personal Health Assistant';
        if (mainSubtitle) mainSubtitle.textContent = 'Symptom guidance, a growing condition library, and personal vital tracking';
    } else if (section === 'knowledge') {
        document.getElementById('sectionKnowledge').style.display = 'block';
        if (mainTitle) mainTitle.textContent = '🧠 Medical Knowledge Base Search';
        if (mainSubtitle) mainSubtitle.textContent = 'Comprehensive Medical Database covering Symptoms, Causes, Risk Factors, Prevention, Treatment, and Care';
        loadMedicalKnowledge();
    } else if (section === 'trends') {
        document.getElementById('sectionTrends').style.display = 'block';
        if (mainTitle) mainTitle.textContent = '📊 Health Trend Tracker';
        if (mainSubtitle) mainSubtitle.textContent = 'Record and monitor Temperature, Weight, Blood Pressure, and Blood Glucose over time';
        loadHealthTrends();
    } else if (section === 'history') {
        document.getElementById('sectionChat').style.display = 'flex';
        viewHistory();
    } else if (section === 'reminders') {
        document.getElementById('sectionChat').style.display = 'flex';
        showAddReminderModal();
    } else if (section === 'safety') {
        document.getElementById('sectionSafety').style.display = 'block';
        if (mainTitle) mainTitle.textContent = i18n[state.language].safetyTitle;
        if (mainSubtitle) mainSubtitle.textContent = i18n[state.language].safetyEyebrow;
    } else if (section === 'analytics') {
        document.getElementById('sectionChat').style.display = 'flex';
        fetchAnalytics();
    }
}

// Quick Start Example Symptom Chip Helper
function sendExampleSymptom(text) {
    // Switch to chat tab if not active
    switchSection('chat');
    document.querySelectorAll('.sidebar-menu .menu-item').forEach(i => i.classList.remove('active'));
    document.querySelector('.sidebar-menu .menu-item[data-section="chat"]')?.classList.add('active');

    const input = document.getElementById('userInput');
    if (!input) return;
    input.value = text;
    sendMessage();
}

// Start Session API call
async function startSession() {
    try {
        const res = await fetch('/api/session/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: state.userId,
                device_info: { browser: navigator.userAgent }
            })
        });
        const data = await res.json();
        if (data.session_id) {
            state.sessionId = data.session_id;
            const sessIdEl = document.getElementById('sessionId');
            if (sessIdEl) sessIdEl.textContent = state.sessionId.slice(0, 14) + '...';
        }
    } catch (error) {
        console.error('Session initiation error:', error);
        const sessIdEl = document.getElementById('sessionId');
        if (sessIdEl) sessIdEl.textContent = 'Error';
    }
}

// Health Connection Checker
async function checkConnection() {
    const statusBadge = document.getElementById('connectionStatus');
    if (!statusBadge) return;
    try {
        const res = await fetch('/health');
        const data = await res.json();
        
        statusBadge.className = 'status-badge status-connected';
        statusBadge.innerHTML = `<i class="fa-solid fa-circle-check"></i> Connected (${data.disease_count} Conditions Loaded)`;
    } catch (error) {
        console.error('Server offline:', error);
        statusBadge.className = 'status-badge status-disconnected';
        statusBadge.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Server Disconnected';
    }
}

// Send Message Flow
async function sendMessage() {
    const input = document.getElementById('userInput');
    const message = input.value.trim();
    if (!message) return;
    
    // Hide autocomplete
    document.getElementById('autocompleteContainer').style.display = 'none';
    
    addMessage('user', message);
    input.value = '';
    
    const typingIndicator = showTypingIndicator();
    
    try {
        const res = await fetch('/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                symptoms: message,
                session_id: state.sessionId,
                user_id: state.userId
            })
        });
        
        const data = await res.json();
        typingIndicator.remove();
        
        if (data.error) {
            addMessage('bot', `Error processing request: ${data.error}`);
            return;
        }

        // Check if backend requested conditional health measurements
        if (data.requested_measurements && data.requested_measurements.length > 0) {
            window.lastSymptomsPayload = {
                symptoms: message,
                session_id: state.sessionId,
                user_id: state.userId
            };
            const formHtml = formatConditionalMeasurementsCard(data.requested_measurements, data.urgent_flags);
            addMessage('bot', formHtml);
            return;
        }
        
        if (data.matches && data.matches.length > 0) {
            const htmlResponse = formatMatchesResponse(data.matches, data.structured_response);
            addMessage('bot', htmlResponse);
            
            // Log top match in recent searches
            const topMatch = data.matches[0];
            updateSearchHistory(message, topMatch.disease);
        } else {
            addMessage('bot', `<p><i class="fa-solid fa-circle-question"></i> No matches found for your symptoms. Please try describing them differently, or contact a healthcare provider if you feel unwell.</p>`);
        }
    } catch (error) {
        typingIndicator.remove();
        console.error('Chat error:', error);
        addMessage('bot', `
            <div class="chat-error-card" style="background-color: var(--danger-light); border: 1px solid var(--danger); border-radius: var(--radius-md); padding: 14px; margin: 6px 0; color: var(--text-main);">
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px; color:var(--danger);">
                    <i class="fa-solid fa-triangle-exclamation" style="font-size:18px;"></i>
                    <strong style="font-size:14px;">Connection / Network Error</strong>
                </div>
                <p style="font-size:13px; margin-bottom:10px;">Unable to communicate with the MedVitals AI server (${error.message || 'Server disconnected'}). Please verify your connection and try again.</p>
                <button class="btn btn-sm btn-primary" onclick="document.getElementById('userInput').value='${message.replace(/'/g, "\\'")}'; sendMessage();"><i class="fa-solid fa-rotate-right"></i> Retry Message</button>
            </div>
        `);
    }
}

window.handleTempUnitToggle = function(unit) {
    const input = document.getElementById('condTemp');
    if (!input) return;
    if (unit === '°F') {
        input.placeholder = "e.g. 101.3 °F";
        input.min = "86";
        input.max = "113";
    } else {
        input.placeholder = "e.g. 38.5 °C";
        input.min = "30";
        input.max = "45";
    }
};

// Format Conditional Health Measurements Form Card
function formatConditionalMeasurementsCard(requestedMeasurements, urgentFlags) {
    let html = `<div class="conditional-measurements-card">`;
    
    if (urgentFlags && urgentFlags.length > 0) {
        html += `
            <div class="urgent-alert-banner">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <div>
                    <strong>⚠️ URGENT MEDICAL NOTICE</strong>
                    <p>Because you reported <em>${urgentFlags.join(', ')}</em>, this should not be ignored. If you are currently unconscious, confused, having severe breathing difficulty, chest pain, or worsening symptoms, seek emergency medical care (Call 911 / 112) immediately.</p>
                </div>
            </div>
        `;
    }

    html += `
        <div class="measurement-card-header">
            <h4><i class="fa-solid fa-notes-medical"></i> Additional Health Measurements Suggested</h4>
            <p>To better understand your symptoms, please enter relevant health measurements if available (optional):</p>
        </div>
        <form id="conditionalMeasurementsForm" onsubmit="submitConditionalMeasurements(event)">
    `;

    if (requestedMeasurements.includes('temperature')) {
        html += `
            <div class="measurement-form-row">
                <label for="condTemp">🌡️ Body Temperature:</label>
                <div class="temp-input-group" style="display:flex; gap:8px; align-items:center;">
                    <input type="number" step="0.1" min="30" max="45" id="condTemp" class="form-control-sm" placeholder="e.g. 38.5 °C" style="flex:1;">
                    <select id="condTempUnit" class="unit-select-sm" onchange="window.handleTempUnitToggle(this.value)" style="width:110px; padding:10px; border-radius:var(--radius-md); border:1px solid var(--border-color); background-color:var(--primary-bg); color:var(--text-main); font-weight:600; cursor:pointer;">
                        <option value="°C" selected>°C</option>
                        <option value="°F">°F</option>
                    </select>
                </div>
            </div>
        `;
    }

    if (requestedMeasurements.includes('blood_pressure')) {
        html += `
            <div class="measurement-form-row">
                <label>🩺 Blood Pressure (mmHg):</label>
                <div class="bp-inputs-row">
                    <input type="number" step="1" min="50" max="250" id="condBpSys" class="form-control-sm" placeholder="Systolic (110)">
                    <span class="slash">/</span>
                    <input type="number" step="1" min="30" max="150" id="condBpDia" class="form-control-sm" placeholder="Diastolic (70)">
                </div>
            </div>
        `;
    }

    if (requestedMeasurements.includes('weight')) {
        html += `
            <div class="measurement-form-row">
                <label for="condWeight">⚖️ Body Weight (kg):</label>
                <input type="number" step="0.1" min="1" max="300" id="condWeight" class="form-control-sm" placeholder="e.g. 64 kg">
            </div>
        `;
    }

    html += `
            <div class="measurement-actions-row">
                <button type="submit" class="btn btn-primary btn-sm"><i class="fa-solid fa-check"></i> Submit & Analyze</button>
                <button type="button" class="btn btn-outline btn-sm" onclick="submitConditionalMeasurements(event, true)"><i class="fa-solid fa-forward"></i> Skip for Now</button>
            </div>
        </form>
    </div>`;

    return html;
}

window.submitConditionalMeasurements = async function(e, skip = false) {
    if (e) e.preventDefault();
    
    if (!window.lastSymptomsPayload) return;
    
    const payload = { ...window.lastSymptomsPayload };
    
    if (skip) {
        payload.skip_measurements = true;
    } else {
        const measurements = {};
        const tempEl = document.getElementById('condTemp');
        const tempUnitEl = document.getElementById('condTempUnit');
        const bpSysEl = document.getElementById('condBpSys');
        const bpDiaEl = document.getElementById('condBpDia');
        const weightEl = document.getElementById('condWeight');
        
        if (tempEl && tempEl.value !== '') {
            let val = parseFloat(tempEl.value);
            const unit = tempUnitEl ? tempUnitEl.value : '°C';
            if (unit === '°F' || val > 70) {
                // Store converted °C for core vector evaluation, keep original unit flag
                measurements.temperature = Math.round(((val - 32) * 5 / 9) * 10) / 10;
                measurements.temp_unit = '°F';
                measurements.temp_original = val;
            } else {
                measurements.temperature = val;
                measurements.temp_unit = '°C';
            }
        }
        if (bpSysEl && bpSysEl.value !== '') measurements.bp_sys = parseFloat(bpSysEl.value);
        if (bpDiaEl && bpDiaEl.value !== '') measurements.bp_dia = parseFloat(bpDiaEl.value);
        if (weightEl && weightEl.value !== '') measurements.weight = parseFloat(weightEl.value);
        
        payload.measurements = measurements;
    }
    
    const cardEl = document.querySelector('.conditional-measurements-card');
    if (cardEl) {
        cardEl.innerHTML = `<div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i> Analyzing symptoms and health measurements...</div>`;
    }
    
    try {
        const res = await fetch('/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        
        if (cardEl && cardEl.parentElement) {
            if (data.matches && data.matches.length > 0) {
                const htmlResponse = formatMatchesResponse(data.matches, data.structured_response);
                cardEl.parentElement.innerHTML = htmlResponse;
                
                if (data.matches[0]) {
                    updateSearchHistory(payload.symptoms, data.matches[0].disease);
                }
                
                // Refresh Health Trends dashboard automatically!
                if (!skip && payload.measurements && Object.keys(payload.measurements).length > 0) {
                    if (typeof loadHealthTrends === 'function') {
                        loadHealthTrends();
                    }
                }
            } else {
                cardEl.parentElement.innerHTML = `<p><i class="fa-solid fa-circle-question"></i> No matching conditions found. Try describing symptoms differently.</p>`;
            }
        }
    } catch (err) {
        if (cardEl) {
            cardEl.innerHTML = `<p style="color: var(--danger);"><i class="fa-solid fa-triangle-exclamation"></i> Network error: ${err.message}</p>`;
        }
    }
};


// Format Matches in structured 5-section response format
function formatMatchesResponse(matches, structuredResp) {
    let html = `<div class="matches-response">`;
    
    // Recorded Vitals Banner (if measurements were entered/extracted)
    if (structuredResp && structuredResp.measurements_summary && structuredResp.measurements_summary.length > 0) {
        html += `<div class="response-section measurements-recorded-section">
            <h4 class="section-title"><i class="fa-solid fa-notes-medical"></i> <strong>Recorded Health Vitals & Status:</strong></h4>
            <div class="vitals-recorded-grid">`;
            
        structuredResp.measurements_summary.forEach(m => {
            html += `
                <div class="recorded-vital-chip">
                    <span class="vital-icon"><i class="fa-solid ${m.icon}"></i></span>
                    <div class="vital-details">
                        <span class="vital-name">${m.metric}</span>
                        <span class="vital-value"><strong>${m.value}</strong></span>
                    </div>
                    <span class="badge ${m.badge_class}">${m.status}</span>
                </div>
            `;
        });
        
        html += `</div></div>`;
    }
    
    // 1. Possible causes
    html += `<div class="response-section causes-section">
        <h4 class="section-title"><i class="fa-solid fa-virus-covid"></i> <strong>Possible Causes:</strong></h4>
        <div class="causes-list">`;

    
    matches.slice(0, 5).forEach((match) => {
        const severityClass = ['high', 'severe', 'moderate-to-severe'].some(s => match.severity.toLowerCase().includes(s)) 
            ? 'badge-severity-high' 
            : match.severity.toLowerCase().includes('moderate') 
            ? 'badge-severity-moderate' 
            : 'badge-severity-mild';
            
        html += `
            <div class="cause-chip clickable-chip" onclick="openDiseaseDetailModal('${encodeURIComponent(match.disease)}')" title="Click to view full medical details for ${match.disease}">
                <span class="cause-name"><strong>${match.disease}</strong> <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:10px; margin-left:4px; opacity:0.8;"></i></span>
                <span class="badge badge-match">${match.match_percentage}% match</span>
                <span class="badge ${severityClass}">${match.severity}</span>
            </div>
        `;
    });
    html += `</div></div>`;

    
    // 2. Why
    const whyText = structuredResp && structuredResp.why 
        ? structuredResp.why 
        : `Your reported symptoms overlap significantly with the diagnostic criteria for these conditions.`;
    html += `<div class="response-section why-section">
        <h4 class="section-title"><i class="fa-solid fa-circle-info"></i> <strong>Why:</strong></h4>
        <p>${whyText}</p>
    </div>`;
    
    // 3. What you can do
    let whatYouCanDoHtml = '';
    if (structuredResp && structuredResp.what_you_can_do_details) {
        const d = structuredResp.what_you_can_do_details;
        whatYouCanDoHtml = `<ul class="care-bullets-list" style="list-style:none; padding-left:0; margin-top:8px; display:flex; flex-direction:column; gap:6px;">
            <li style="font-size:13px; line-height:1.5;"><strong style="color:var(--text-main);">💊 Treatment & Medication:</strong> ${d.treatment}</li>
            <li style="font-size:13px; line-height:1.5;"><strong style="color:var(--text-main);">🛠️ Care Advice:</strong> ${d.advice}</li>
            <li style="font-size:13px; line-height:1.5;"><strong style="color:var(--text-main);">🛡️ Prevention:</strong> ${d.prevention}</li>
        </ul>`;
    } else {
        const whatYouCanDoText = structuredResp && structuredResp.what_you_can_do 
            ? structuredResp.what_you_can_do 
            : (matches[0] ? `Treatment: ${matches[0].treatment || matches[0].medicine || 'Rest & OTC care'}. Advice: ${matches[0].advice || 'Hydration'}` : 'Rest and stay hydrated.');
        whatYouCanDoHtml = `<p>${whatYouCanDoText}</p>`;
    }
    
    html += `<div class="response-section action-section">
        <h4 class="section-title"><i class="fa-solid fa-hand-holding-medical"></i> <strong>What you can do:</strong></h4>
        ${whatYouCanDoHtml}
    </div>`;
    
    // 4. Seek medical care if
    const seekCareText = structuredResp && structuredResp.seek_medical_care_if 
        ? structuredResp.seek_medical_care_if 
        : (matches[0] ? `Consult a ${matches[0].specialist || 'Primary Care Physician'} if symptoms persist beyond 3-5 days.` : 'Consult a physician if symptoms persist.');
    html += `<div class="response-section seek-care-section">
        <h4 class="section-title"><i class="fa-solid fa-user-doctor"></i> <strong>Seek medical care if:</strong></h4>
        <p>${seekCareText}</p>
    </div>`;
    
    // 5. Emergency warning
    const emergencyText = structuredResp && structuredResp.emergency_warning 
        ? structuredResp.emergency_warning 
        : `Call emergency services (911 / 112) immediately if you experience severe shortness of breath, sudden chest pain, loss of consciousness, or severe trauma.`;
    html += `<div class="response-section emergency-section">
        <h4 class="section-title"><i class="fa-solid fa-triangle-exclamation"></i> <strong>Emergency Warning:</strong></h4>
        <p>${emergencyText}</p>
    </div>`;

    // Detailed matches expander dropdown button
    html += `<details class="matched-details-expander">
        <summary><i class="fa-solid fa-list-check"></i> View Full 6-Pillar Diagnostic Cards (${matches.length} matches)</summary>
        <div class="detailed-cards-wrapper">`;
        
    matches.forEach((match) => {
        const severityClass = ['high', 'severe', 'moderate-to-severe'].some(s => match.severity.toLowerCase().includes(s)) 
            ? 'badge-severity-high' 
            : match.severity.toLowerCase().includes('moderate') 
            ? 'badge-severity-moderate' 
            : 'badge-severity-mild';
            
        const symptomsStr = Array.isArray(match.symptoms) ? match.symptoms.join(', ') : (match.symptoms || 'N/A');

        html += `
            <div class="disease-card">
                <div class="disease-card-header">
                    <span class="disease-name"><strong><i class="fa-solid fa-disease"></i> ${match.disease}</strong></span>
                    <div class="disease-badge-row">
                        <span class="badge ${severityClass}">${match.severity} severity</span>
                        <span class="badge badge-match">${match.match_percentage}% match</span>
                    </div>
                </div>
                <div class="disease-detail"><strong><i class="fa-solid fa-head-side-cough"></i> Symptoms:</strong> ${symptomsStr}</div>
                <div class="disease-detail"><strong><i class="fa-solid fa-dna"></i> Causes:</strong> ${match.causes || 'N/A'}</div>
                <div class="disease-detail"><strong><i class="fa-solid fa-triangle-exclamation"></i> Risk Factors:</strong> ${match.risk_factors || 'N/A'}</div>
                <div class="disease-detail"><strong><i class="fa-solid fa-capsules"></i> Treatment & Care:</strong> ${match.treatment || match.medicine || 'N/A'}</div>
                <div class="disease-detail"><strong><i class="fa-solid fa-user-doctor"></i> Recommended Specialist:</strong> ${match.specialist}</div>
                <div class="disease-detail"><strong><i class="fa-solid fa-shield-halved"></i> Prevention:</strong> ${match.prevention || match.prevention_tips || 'N/A'}</div>
                <div class="disease-detail"><strong><i class="fa-solid fa-hospital-user"></i> When to Seek Care:</strong> ${match.when_to_seek_care || 'N/A'}</div>
            </div>
        `;
    });
    
    html += `</div></details></div>`;
    return html;
}


// Add Chat bubble
function addMessage(type, content) {
    const messagesDiv = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';
    avatarDiv.innerHTML = type === 'user' ? '<i class="fa-solid fa-user"></i>' : '<i class="fa-solid fa-robot"></i>';
    
    const wrapperDiv = document.createElement('div');
    wrapperDiv.className = 'message-wrapper';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = content;
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    wrapperDiv.appendChild(contentDiv);
    wrapperDiv.appendChild(timeDiv);
    
    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(wrapperDiv);
    
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Show Typing Animation
function showTypingIndicator() {
    const messagesDiv = document.getElementById('chatMessages');
    const indicator = document.createElement('div');
    indicator.className = 'message bot-message';
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';
    avatarDiv.innerHTML = '<i class="fa-solid fa-robot"></i>';
    
    const wrapperDiv = document.createElement('div');
    wrapperDiv.className = 'message-wrapper';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = `
        <div class="typing-indicator">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
        </div>
    `;
    
    wrapperDiv.appendChild(contentDiv);
    indicator.appendChild(avatarDiv);
    indicator.appendChild(wrapperDiv);
    
    messagesDiv.appendChild(indicator);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    
    return indicator;
}

// Symptom Input Autocomplete suggest logic
function handleSymptomInput(e) {
    const value = e.target.value;
    
    // Clear existing timeout for debouncing
    clearTimeout(state.suggestDebounceTimer);
    
    if (value.trim().length < 2) {
        document.getElementById('autocompleteContainer').style.display = 'none';
        return;
    }
    
    // Debounce search by 200ms
    state.suggestDebounceTimer = setTimeout(async () => {
        try {
            // Get the last token (if comma separated)
            const tokens = value.split(',');
            const lastToken = tokens[tokens.length - 1].trim();
            
            if (lastToken.length < 2) {
                document.getElementById('autocompleteContainer').style.display = 'none';
                return;
            }
            
            const res = await fetch('/api/suggest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: lastToken })
            });
            const data = await res.json();
            
            if (data.error) return;
            
            renderSuggestions(data.suggestions, tokens);
        } catch (error) {
            console.error('Autocomplete retrieval error:', error);
        }
    }, 200);
}

// Render floating autocomplete box
function renderSuggestions(suggestions, tokens) {
    const container = document.getElementById('autocompleteContainer');
    
    const hasSymptoms = suggestions.symptoms && suggestions.symptoms.length > 0;
    const hasDiseases = suggestions.diseases && suggestions.diseases.length > 0;
    
    if (!hasSymptoms && !hasDiseases) {
        container.style.display = 'none';
        return;
    }
    
    let html = '';
    
    if (hasSymptoms) {
        html += `<div class="autocomplete-section-title">Matching Symptoms</div>`;
        suggestions.symptoms.forEach(symptom => {
            html += `
                <div class="autocomplete-item" data-type="symptom" data-value="${symptom}">
                    <i class="fa-solid fa-hand-holding-medical"></i>
                    <span>${symptom}</span>
                </div>
            `;
        });
    }
    
    if (hasDiseases) {
        html += `<div class="autocomplete-section-title">Matching Diseases</div>`;
        suggestions.diseases.forEach(disease => {
            html += `
                <div class="autocomplete-item" data-type="disease" data-value="${disease}">
                    <i class="fa-solid fa-virus"></i>
                    <span>${disease}</span>
                </div>
            `;
        });
    }
    
    container.innerHTML = html;
    container.style.display = 'block';
    
    // Attach event listeners to newly created items
    container.querySelectorAll('.autocomplete-item').forEach(item => {
        item.addEventListener('click', () => {
            const val = item.dataset.value;
            const type = item.dataset.type;
            
            const userInput = document.getElementById('userInput');
            
            if (type === 'symptom') {
                // Replace the last typed token with the selected symptom
                tokens[tokens.length - 1] = ' ' + val;
                userInput.value = tokens.join(',').trim() + ', ';
            } else {
                userInput.value = val;
            }
            
            userInput.focus();
            container.style.display = 'none';
        });
    });
}

// ==========================================================================
// Chat History Archives Modal
// ==========================================================================
async function viewHistory() {
    const modal = document.getElementById('historyModal');
    const content = document.getElementById('historyContent');
    
    modal.classList.add('active');
    content.innerHTML = `<div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading health records...</div>`;
    
    try {
        const res = await fetch(`/api/history/user/${state.userId}`);
        const data = await res.json();
        
        if (data.history && data.history.length > 0) {
            let html = '';
            data.history.forEach(session => {
                const dateStr = new Date(session.start_time).toLocaleString();
                html += `
                    <div class="history-item" onclick="loadSessionArchive('${session.session_id}')" style="margin-bottom: 12px;">
                        <div class="history-symptoms">
                            <i class="fa-solid fa-comments"></i> Session from ${dateStr}
                        </div>
                        <div class="history-meta">
                            <span class="history-date">${session.messages.length} message units</span>
                            <span class="badge-history-top">Review Archive</span>
                        </div>
                    </div>
                `;
            });
            content.innerHTML = html;
        } else {
            content.innerHTML = `
                <div class="no-data-placeholder">
                    <i class="fa-solid fa-box-open"></i>
                    <p>No health session history found. Start a conversation to log symptoms.</p>
                </div>
            `;
        }
    } catch (error) {
        content.innerHTML = `<p style="color: var(--danger); text-align: center;"><i class="fa-solid fa-circle-exclamation"></i> Failed to retrieve history: ${error.message}</p>`;
    }
}

// Load individual session details inside Modal
window.loadSessionArchive = async function(sessionId) {
    const content = document.getElementById('historyContent');
    content.innerHTML = `<div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading session details...</div>`;
    
    try {
        const res = await fetch(`/api/history/${sessionId}`);
        const data = await res.json();
        
        let html = `
            <div style="margin-bottom:20px;">
                <button class="btn btn-sm btn-outline" onclick="viewHistory()">
                    <i class="fa-solid fa-arrow-left"></i> Back to Sessions
                </button>
                <h3 style="margin-top:14px; font-family:'Outfit';">Session ${sessionId.slice(0, 18)}...</h3>
            </div>
            <div class="history-messages-scroller">
        `;
        
        data.messages.forEach(msg => {
            const timeStr = new Date(msg.time).toLocaleString();
            let displayBot = msg.bot;
            
            // Check if bot response was stringified JSON matches
            try {
                const parsed = JSON.parse(msg.bot);
                if (Array.isArray(parsed)) {
                    displayBot = `Matched primary suspect conditions: ${parsed.join(', ')}`;
                }
            } catch(e) {}
            
            html += `
                <div class="history-msg-item">
                    <div class="history-msg-time"><i class="fa-solid fa-calendar-day"></i> ${timeStr}</div>
                    <div class="history-msg-body">
                        <strong>You:</strong> ${msg.user}<br><br>
                        <strong>MedVitals AI:</strong> ${displayBot}
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
        content.innerHTML = html;
    } catch (error) {
        alert('Failed to load session details: ' + error.message);
        viewHistory();
    }
};

// ==========================================================================
// Medication Reminders Logic
// ==========================================================================
function showAddReminderModal() {
    state.reminderTimes = [];
    document.getElementById('timeList').innerHTML = '';
    document.getElementById('reminderModal').classList.add('active');
    updateNotificationUI();
}

window.addReminderTime = function() {
    const timeInput = document.getElementById('reminderTime');
    const time = timeInput.value;
    if (!time) return alert('Please pick a time first.');
    
    if (state.reminderTimes.includes(time)) {
        return alert('This time is already scheduled.');
    }
    
    state.reminderTimes.push(time);
    
    // Sort times sequentially
    state.reminderTimes.sort();
    
    renderTimeBadges();
    timeInput.value = '';
};

window.removeReminderTime = function(time) {
    state.reminderTimes = state.reminderTimes.filter(t => t !== time);
    renderTimeBadges();
};

function renderTimeBadges() {
    const list = document.getElementById('timeList');
    list.innerHTML = state.reminderTimes.map(t => 
        `<span class="time-tag-badge">${t} <span onclick="removeReminderTime('${t}')"><i class="fa-solid fa-xmark"></i></span></span>`
    ).join('');
}

// Request and Enable Browser Notifications
window.requestNotificationPermission = function() {
    if (!("Notification" in window)) {
        alert("This browser does not support desktop notifications.");
        return;
    }
    
    Notification.requestPermission().then(permission => {
        updateNotificationUI();
        if (permission === 'granted') {
            new Notification("🔔 Reminders Enabled", {
                body: "MedVitals AI will notify you when it's time to take your doses.",
                icon: "🩺"
            });
        }
    });
};

function updateNotificationUI() {
    const prompt = document.getElementById('notificationPrompt');
    if (!prompt) return;
    
    if (!("Notification" in window)) {
        prompt.style.display = 'none';
        return;
    }
    
    if (Notification.permission === 'granted') {
        prompt.innerHTML = `
            <div class="prompt-text" style="color: #065f46;">
                <i class="fa-solid fa-bell" style="color: var(--success)"></i>
                <span>Desktop notifications are active and ready.</span>
            </div>
        `;
    } else if (Notification.permission === 'denied') {
        prompt.innerHTML = `
            <div class="prompt-text" style="color: #991b1b;">
                <i class="fa-solid fa-triangle-exclamation" style="color: var(--danger)"></i>
                <span>Notifications are blocked. Please enable them in browser settings for alerts.</span>
            </div>
        `;
    } else {
        prompt.style.display = 'flex';
    }
}

// Save Reminder to local storage and backend API
async function saveReminder() {
    const medName = document.getElementById('medName').value.trim();
    const dosage = document.getElementById('dosage').value.trim();
    const duration = document.getElementById('duration').value;
    
    if (!medName || !dosage) {
        return alert('Please fill in the medication name and dosage.');
    }
    
    if (state.reminderTimes.length === 0) {
        return alert('Please add at least one schedule time.');
    }
    
    try {
        const newReminder = {
            id: Date.now(),
            medication_name: medName,
            dosage: dosage,
            schedule_times: [...state.reminderTimes],
            duration_days: parseInt(duration),
            created_at: new Date().toISOString()
        };
        
        // 1. Save to browser LocalStorage
        let localReminders = JSON.parse(localStorage.getItem('medicationReminders') || '[]');
        localReminders.push(newReminder);
        localStorage.setItem('medicationReminders', JSON.stringify(localReminders));
        
        // 2. Submit to backend API for background worker scheduling
        try {
            await fetch('/api/notifications/medication-reminder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: state.userId,
                    medication_name: medName,
                    dosage: dosage,
                    schedule_times: state.reminderTimes,
                    duration_days: parseInt(duration)
                })
            });
        } catch(apiError) {
            console.warn('Could not sync reminder with backend database. Will rely on local alert schedule.', apiError);
        }
        
        alert(`✅ Medication saved! You'll receive alert reminders for ${medName} at ${state.reminderTimes.join(', ')}.`);
        closeModal('reminderModal');
        
        // Reset form
        document.getElementById('medName').value = '';
        document.getElementById('dosage').value = '';
        document.getElementById('timeList').innerHTML = '';
        document.getElementById('duration').value = '30';
        state.reminderTimes = [];
        
        await loadReminders();
        
    } catch (error) {
        alert('Error saving medication reminder: ' + error.message);
    }
}

// Load reminders from LocalStorage
async function loadReminders() {
    try {
        const saved = JSON.parse(localStorage.getItem('medicationReminders') || '[]');
        state.activeReminders = saved;
        
        const container = document.getElementById('activeReminders');
        if (!container) return;
        
        if (state.activeReminders.length > 0) {
            let html = '';
            state.activeReminders.slice(0, 4).forEach(r => {
                html += `
                    <div class="reminder-card">
                        <div class="reminder-title">${r.medication_name}</div>
                        <div class="reminder-times-list">
                            <i class="fa-solid fa-clock"></i> <span>Times: ${r.schedule_times.join(', ')}</span>
                        </div>
                        <div class="reminder-dosage-info">${r.dosage} • ${r.duration_days} days</div>
                        <button class="delete-reminder-btn" onclick="deleteReminder(${r.id})" title="Delete Reminder">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                `;
            });
            
            if (state.activeReminders.length > 4) {
                html += `<p style="font-size:11px; text-align:center; color: var(--text-muted); margin-top:8px;">+${state.activeReminders.length - 4} more schedules active</p>`;
            }
            container.innerHTML = html;
        } else {
            container.innerHTML = `
                <div class="no-data-placeholder">
                    <i class="fa-solid fa-prescription-bottle-medical"></i>
                    <p>No active reminders</p>
                </div>
            `;
        }
    } catch (e) {
        console.error('Error loading reminders:', e);
    }
}

// Delete reminder
window.deleteReminder = function(reminderId) {
    if (confirm('Are you sure you want to delete this medication schedule?')) {
        let localReminders = JSON.parse(localStorage.getItem('medicationReminders') || '[]');
        localReminders = localReminders.filter(r => r.id !== reminderId);
        localStorage.setItem('medicationReminders', JSON.stringify(localReminders));
        loadReminders();
    }
};

// Play Web Audio API synthesized medical alert chime
function playReminderSound() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const now = ctx.currentTime;

        // Note 1: E5 (659.25 Hz)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(659.25, now);
        gain1.gain.setValueAtTime(0.3, now);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.3);

        // Note 2: A5 (880 Hz)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, now + 0.3);
        gain2.gain.setValueAtTime(0.4, now + 0.3);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.3);
        osc2.stop(now + 0.7);
    } catch (e) {
        console.warn('Audio context alert chime not supported or blocked:', e);
    }
}

// Trigger comprehensive audio sound, desktop notification, and in-chat banner
function triggerReminderAlert(medName, dosage) {
    playReminderSound();
    
    if ("Notification" in window && Notification.permission === 'granted') {
        new Notification(`💊 Medication Time: ${medName}`, {
            body: `Take ${dosage}. Don't skip your dose!`,
            icon: "🩺",
            requireInteraction: true
        });
    }

    addMessage('bot', `
        <div style="background-color: var(--primary-light); border: 2px solid var(--primary); padding: 16px; border-radius: var(--radius-md); text-align: center;">
            <h4 style="color: var(--primary-hover); font-size: 15px; margin-bottom: 6px;">
                <i class="fa-solid fa-bell-ring fa-bounce"></i> 💊 MEDICATION REMINDER ALERT
            </h4>
            <p style="font-size: 14px; font-weight: 600; color: var(--text-main);">It is time to take your dose of <strong>${medName}</strong> (${dosage}).</p>
            <p style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">Scheduled reminder active • Stay on track with your prescription.</p>
        </div>
    `);
}

function testReminderAlert() {
    triggerReminderAlert("Amoxicillin (Test Dose)", "500mg - 1 tablet");
}

// ==========================================================================
// ↔️ Collapsible Sidebar Controllers
// ==========================================================================
function toggleLeftSidebar() {
    const container = document.querySelector('.app-container');
    if (!container) return;
    container.classList.toggle('left-collapsed');
    const isCollapsed = container.classList.contains('left-collapsed');
    localStorage.setItem('medvitals_left_collapsed', isCollapsed ? 'true' : 'false');
}

function toggleRightSidebar() {
    const container = document.querySelector('.app-container');
    if (!container) return;
    container.classList.toggle('right-collapsed');
    const isCollapsed = container.classList.contains('right-collapsed');
    localStorage.setItem('medvitals_right_collapsed', isCollapsed ? 'true' : 'false');
}

function initSidebarState() {
    const container = document.querySelector('.app-container');
    if (!container) return;
    if (localStorage.getItem('medvitals_left_collapsed') === 'true') {
        container.classList.add('left-collapsed');
    }
    if (localStorage.getItem('medvitals_right_collapsed') === 'true') {
        container.classList.add('right-collapsed');
    }
}

// Start scanning medication reminders automatically every 10 seconds
function startReminderChecker() {
    checkActiveLocalReminders();
    setInterval(checkActiveLocalReminders, 10000);
}

// Automatically triggers audio sound, desktop notification, and in-chat alert at scheduled time mentioned
async function checkActiveLocalReminders() {
    const now = new Date();
    const curHour = now.getHours();
    const curMin = now.getMinutes();
    const curTimeStr = `${String(curHour).padStart(2, '0')}:${String(curMin).padStart(2, '0')}`;
    
    // 1. Check local reminders saved in browser
    if (state.activeReminders && state.activeReminders.length > 0) {
        state.activeReminders.forEach(reminder => {
            if (!reminder.schedule_times) return;
            reminder.schedule_times.forEach(scheduledTime => {
                const parts = scheduledTime.trim().split(':');
                if (parts.length === 2) {
                    const normTime = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
                    if (normTime === curTimeStr) {
                        const storageKey = `last_notified_${reminder.id}_${normTime}_${now.toDateString()}`;
                        const lastNotified = localStorage.getItem(storageKey);
                        
                        if (!lastNotified) {
                            triggerReminderAlert(reminder.medication_name, reminder.dosage);
                            localStorage.setItem(storageKey, 'true');
                        }
                    }
                }
            });
        });
    }

    // 2. Poll backend for due database notifications
    try {
        const res = await fetch(`/api/reminders/due?user_id=${state.userId || 1}`);
        const data = await res.json();
        if (data.due_reminders && data.due_reminders.length > 0) {
            data.due_reminders.forEach(r => {
                triggerReminderAlert(r.title || 'Medication Reminder', r.message || 'Time to take your scheduled dose.');
            });
            loadReminders();
        }
    } catch (err) {}
}


// ==========================================================================
// Recent Searches & History (Side panel)
// ==========================================================================
async function loadSearchHistory() {
    const saved = localStorage.getItem('searchHistory');
    if (saved) {
        state.searchHistory = JSON.parse(saved);
        updateSearchDisplay();
    }
}

function updateSearchHistory(symptoms, match) {
    state.searchHistory = state.searchHistory.filter(s => s.symptoms !== symptoms);
    state.searchHistory.unshift({
        symptoms,
        match,
        time: new Date().toISOString()
    });
    
    if (state.searchHistory.length > 5) {
        state.searchHistory.pop();
    }
    
    localStorage.setItem('searchHistory', JSON.stringify(state.searchHistory));
    updateSearchDisplay();
}

function updateSearchDisplay() {
    const container = document.getElementById('recentSearches');
    if (!container) return;
    
    if (state.searchHistory.length > 0) {
        let html = '';
        state.searchHistory.forEach(s => {
            const timeAgo = formatTimeAgo(new Date(s.time));
            html += `
                <div class="history-item" onclick="searchAgain('${s.symptoms}')">
                    <div class="history-symptoms">${s.symptoms}</div>
                    <div class="history-meta">
                        <span class="history-date">${timeAgo}</span>
                        ${s.match ? `<span class="badge-history-top">${s.match}</span>` : ''}
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    } else {
        container.innerHTML = `
            <div class="no-data-placeholder">
                <i class="fa-solid fa-magnifying-glass"></i>
                <p>No recent symptom checks</p>
            </div>
        `;
    }
}

window.searchAgain = function(symptoms) {
    const userInput = document.getElementById('userInput');
    userInput.value = symptoms;
    sendMessage();
};

function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) return interval + "y ago";
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) return interval + "mo ago";
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return interval + "d ago";
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return interval + "h ago";
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return interval + "m ago";
    return "just now";
}

// ==========================================================================
// Analytics Dashboard
// ==========================================================================
async function fetchAnalytics() {
    const typingIndicator = showTypingIndicator();
    try {
        const res = await fetch('/api/analytics?days=30');
        const data = await res.json();
        typingIndicator.remove();
        
        let message = `
            <div style="font-family:'Outfit';">
                <h3 style="margin-bottom:12px;"><i class="fa-solid fa-chart-pie"></i> Usage Analytics (Last 30 Days)</h3>
                <table style="width:100%; border-collapse:collapse; margin-bottom:16px; font-size:13px;">
                    <tr style="border-bottom:1px solid var(--border-color);"><td style="padding:8px 0; font-weight:600; color:var(--text-muted);">Total Sessions:</td><td style="padding:8px 0; text-align:right; font-weight:700;">${data.total_sessions}</td></tr>
                    <tr style="border-bottom:1px solid var(--border-color);"><td style="padding:8px 0; font-weight:600; color:var(--text-muted);">Total Message Units:</td><td style="padding:8px 0; text-align:right; font-weight:700;">${data.total_messages}</td></tr>
                    <tr style="border-bottom:1px solid var(--border-color);"><td style="padding:8px 0; font-weight:600; color:var(--text-muted);">Avg. Messages/Session:</td><td style="padding:8px 0; text-align:right; font-weight:700;">${data.avg_messages_per_session.toFixed(1)}</td></tr>
                </table>
        `;
        
        if (data.popular_searches && data.popular_searches.length > 0) {
            message += `<h4 style="font-size:13px; margin-bottom:8px;"><i class="fa-solid fa-fire"></i> Most Searched Conditions:</h4><ul style="padding-left:20px; font-size:13px; color:var(--text-muted); margin-bottom:12px;">`;
            data.popular_searches.slice(0, 5).forEach(s => {
                message += `<li style="margin-bottom:4px;"><strong>${s.disease}</strong>: checked ${s.count} times</li>`;
            });
            message += `</ul>`;
        }
        
        if (data.popular_symptoms && data.popular_symptoms.length > 0) {
            message += `<h4 style="font-size:13px; margin-bottom:8px;"><i class="fa-solid fa-tags"></i> Top Reported Symptoms:</h4><div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:6px;">`;
            data.popular_symptoms.slice(0, 6).forEach(s => {
                message += `<span class="badge badge-symptom-tag">${s.symptom} (${s.count})</span>`;
            });
            message += `</div>`;
        }
        
        message += `</div>`;
        addMessage('bot', message);
    } catch (error) {
        typingIndicator.remove();
        addMessage('bot', `<p style="color:var(--danger);"><i class="fa-solid fa-triangle-exclamation"></i> Failed to compile analytics: ${error.message}</p>`);
    }
}

// ==========================================================================
// Modal Controllers
// ==========================================================================
window.closeModal = function(modalId) {
    document.getElementById(modalId).classList.remove('active');
};

// ==========================================================================
// Theme Toggler Support
// ==========================================================================
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    const theme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
    setTheme(theme);
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    const toggleBtn = document.getElementById('themeToggleBtn');
    if (toggleBtn) {
        const icon = toggleBtn.querySelector('i');
        if (theme === 'dark') {
            icon.className = 'fa-solid fa-sun';
            toggleBtn.title = 'Switch to Light Theme';
        } else {
            icon.className = 'fa-solid fa-moon';
            toggleBtn.title = 'Switch to Dark Theme';
        }
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

// ==========================================================================
// 🧠 Medical Knowledge Base Search Module
// ==========================================================================

async function loadMedicalKnowledge(query = '', category = '') {
    const container = document.getElementById('knowledgeResults');
    if (!container) return;
    const meta = document.getElementById('knowledgeResultsMeta');
    
    container.innerHTML = `<div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i> Searching Medical Knowledge Base...</div>`;
    
    try {
        const res = await fetch('/api/knowledge/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: query, category: category, limit: 12 })
        });
        const data = await res.json();
        
        if (data.error) {
            container.innerHTML = `<div class="no-data-placeholder"><p style="color:var(--danger);">${data.error}</p></div>`;
            return;
        }
        
        const results = data.results || [];
        if (meta) meta.textContent = query || category ? `Showing ${results.length} of ${data.total || results.length} matching conditions${category ? ` in ${category}` : ''}.` : `Showing ${results.length} of ${data.total || results.length} conditions. Search or choose a category to narrow the list.`;
        if (results.length === 0) {
            container.innerHTML = `<div class="no-data-placeholder"><i class="fa-solid fa-folder-open"></i><p>No medical conditions found matching "${query}".</p></div>`;
            return;
        }
        
        let html = '';
        results.forEach(d => {
            const severity = (d.severity || 'unspecified').toLowerCase();
            const severityClass = ['high', 'severe', 'moderate-to-severe'].some(s => severity.includes(s)) 
                ? 'badge-severity-high' 
                : severity.includes('moderate') 
                ? 'badge-severity-moderate' 
                : 'badge-severity-mild';
                
            const symptomsStr = Array.isArray(d.symptoms) ? d.symptoms.join(', ') : (d.symptoms || 'N/A');
            
            html += `
                <div class="knowledge-card">
                    <div class="knowledge-card-header">
                        <div class="title-row">
                            <h3><i class="fa-solid fa-book-medical"></i> ${d.disease}</h3>
                            <span class="badge ${severityClass}">${d.severity || 'Unspecified'}</span>
                        </div>
                        <span class="cat-tag"><i class="fa-solid fa-tag"></i> ${d.category}</span>
                    </div>
                    <div class="knowledge-pillars">
                        <div class="pillar-box">
                            <strong><i class="fa-solid fa-head-side-cough"></i> Symptoms:</strong>
                            <p>${symptomsStr}</p>
                        </div>
                        <div class="pillar-box">
                            <strong><i class="fa-solid fa-dna"></i> Causes:</strong>
                            <p>${d.causes || 'N/A'}</p>
                        </div>
                        <div class="pillar-box">
                            <strong><i class="fa-solid fa-triangle-exclamation"></i> Risk Factors:</strong>
                            <p>${d.risk_factors || 'N/A'}</p>
                        </div>
                        <div class="pillar-box">
                            <strong><i class="fa-solid fa-shield-halved"></i> Prevention:</strong>
                            <p>${d.prevention || d.prevention_tips || 'N/A'}</p>
                        </div>
                        <div class="pillar-box">
                            <strong><i class="fa-solid fa-capsules"></i> General Treatment Information:</strong>
                            <p>${d.treatment || d.medicine || 'N/A'}</p>
                        </div>
                        <div class="pillar-box warning-pillar">
                            <strong><i class="fa-solid fa-user-doctor"></i> When to Seek Medical Care:</strong>
                            <p>${d.when_to_seek_care || 'N/A'}</p>
                        </div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = `<div class="no-data-placeholder"><p style="color:var(--danger);"><i class="fa-solid fa-triangle-exclamation"></i> Network error loading knowledge base: ${error.message}</p></div>`;
    }
}


// ==========================================================================
// 📊 Health Trend Tracking Module
// ==========================================================================

state.activeChartMetric = 'temperature';
state.trendsSummary = null;

function handleMetricTypeChange(e) {
    const val = e.target.value;
    const priLabel = document.getElementById('primaryLabel');
    const secGroup = document.getElementById('secondaryValGroup');
    const unitSelect = document.getElementById('unitSelect');
    const priInput = document.getElementById('valPrimaryInput');
    
    if (val === 'temperature') {
        priLabel.textContent = 'Temperature (°F)';
        priInput.placeholder = 'e.g. 98.6';
        secGroup.style.display = 'none';
        unitSelect.innerHTML = '<option value="°F">°F</option><option value="°C">°C</option>';
    } else if (val === 'weight') {
        priLabel.textContent = 'Weight (kg)';
        priInput.placeholder = 'e.g. 72.5';
        secGroup.style.display = 'none';
        unitSelect.innerHTML = '<option value="kg">kg</option><option value="lbs">lbs</option>';
    } else if (val === 'blood_pressure') {
        priLabel.textContent = 'Systolic (mmHg)';
        priInput.placeholder = 'e.g. 120';
        secGroup.style.display = 'block';
        unitSelect.innerHTML = '<option value="mmHg">mmHg</option>';
    } else if (val === 'blood_glucose') {
        priLabel.textContent = 'Blood Glucose (mg/dL)';
        priInput.placeholder = 'e.g. 95';
        secGroup.style.display = 'none';
        unitSelect.innerHTML = '<option value="mg/dL">mg/dL</option>';
    }
}

async function handleHealthLogSubmit(e) {
    e.preventDefault();
    const metricType = document.getElementById('metricTypeSelect').value;
    const priVal = parseFloat(document.getElementById('valPrimaryInput').value);
    const secInput = document.getElementById('valSecondaryInput').value;
    const secVal = secInput !== '' ? parseFloat(secInput) : null;
    const unit = document.getElementById('unitSelect').value;
    const notes = document.getElementById('notesInput').value.trim();
    
    if (isNaN(priVal) || priVal <= 0) {
        alert('Please enter a valid reading value.');
        return;
    }
    
    try {
        const res = await fetch('/api/health-trends/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: state.userId,
                metric_type: metricType,
                value_primary: priVal,
                value_secondary: secVal,
                unit: unit,
                notes: notes
            })
        });
        const data = await res.json();
        
        if (data.error) {
            alert(`Error saving reading: ${data.error}`);
            return;
        }
        
        // Display instant feedback toast with reassuring clinical evaluation
        if (data.assessment && data.assessment.single_feedback) {
            const feedbackBanner = document.getElementById('vitalLogFeedback');
            const feedbackText = document.getElementById('feedbackText');
            const feedbackIcon = document.getElementById('feedbackIcon');
            
            feedbackText.textContent = data.assessment.single_feedback;
            if (data.log && data.log.status === 'Normal') {
                feedbackIcon.className = 'fa-solid fa-circle-check';
                feedbackBanner.className = 'instant-feedback-banner feedback-good';
            } else {
                feedbackIcon.className = 'fa-solid fa-circle-info';
                feedbackBanner.className = 'instant-feedback-banner feedback-alert';
            }
            feedbackBanner.style.display = 'flex';
        }

        // Reset form inputs
        document.getElementById('valPrimaryInput').value = '';
        document.getElementById('valSecondaryInput').value = '';
        document.getElementById('notesInput').value = '';
        
        // Reload health trends summary
        await loadHealthTrends();
    } catch (error) {
        alert(`Failed to save vital reading: ${error.message}`);
    }
}

async function loadHealthTrends() {
    try {
        const resSum = await fetch(`/api/health-trends/summary/${state.userId}`);
        const dataSum = await resSum.json();
        
        if (dataSum.summary) {
            state.trendsSummary = dataSum.summary;
            updateMetricSummaryCards(dataSum.summary);
            
            const activeMetric = state.activeChartMetric || 'temperature';
            if (dataSum.summary[activeMetric]) {
                renderTrendCanvasChart(activeMetric, dataSum.summary[activeMetric].history || []);
            }
        }
        
        if (dataSum.assessment) {
            updateOverallAssessmentUI(dataSum.assessment);
        }

        // Load detailed table logs
        const resLogs = await fetch(`/api/health-trends/user/${state.userId}`);
        const dataLogs = await resLogs.json();
        
        if (dataLogs.logs) {
            renderHealthLogsTable(dataLogs.logs);
        }
    } catch (error) {
        console.error('Error loading health trends:', error);
    }
}

function updateOverallAssessmentUI(assessment) {
    const badge = document.getElementById('overallStatusBadge');
    const icon = document.getElementById('overallStatusIcon');
    const text = document.getElementById('overallStatusText');
    const title = document.getElementById('overallAssessmentTitle');
    const msg = document.getElementById('overallAssessmentMsg');
    const time = document.getElementById('overallAssessmentTime');
    
    if (badge) badge.className = `assessment-badge ${assessment.css_class}`;
    if (icon) icon.className = `fa-solid ${assessment.icon}`;
    if (text) text.textContent = `Overall Condition: ${assessment.status}`;
    if (title) title.textContent = assessment.title;
    if (msg) msg.textContent = assessment.message;
    if (time) time.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}


function updateMetricSummaryCards(summary) {
    // 1. Temperature
    const temp = summary.temperature;
    const valTemp = document.getElementById('valTemp');
    const statusTemp = document.getElementById('statusTemp');
    const timeTemp = document.getElementById('timeTemp');
    if (temp && temp.latest) {
        valTemp.textContent = temp.latest.val_pri;
        statusTemp.textContent = temp.latest.status;
        statusTemp.className = `status-tag status-${temp.latest.status.toLowerCase().replace(/\s+/g, '-')}`;
        timeTemp.textContent = new Date(temp.latest.time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    
    // 2. Weight
    const wt = summary.weight;
    const valWeight = document.getElementById('valWeight');
    const statusWeight = document.getElementById('statusWeight');
    const timeWeight = document.getElementById('timeWeight');
    if (wt && wt.latest) {
        valWeight.textContent = wt.latest.val_pri;
        statusWeight.textContent = wt.delta ? (wt.delta > 0 ? `+${wt.delta} kg` : `${wt.delta} kg`) : 'Normal';
        statusWeight.className = `status-tag status-normal`;
        timeWeight.textContent = new Date(wt.latest.time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    
    // 3. Blood Pressure
    const bp = summary.blood_pressure;
    const valBp = document.getElementById('valBp');
    const statusBp = document.getElementById('statusBp');
    const timeBp = document.getElementById('timeBp');
    if (bp && bp.latest) {
        valBp.textContent = `${bp.latest.val_pri}/${bp.latest.val_sec || '--'}`;
        statusBp.textContent = bp.latest.status;
        statusBp.className = `status-tag status-${bp.latest.status.toLowerCase().replace(/\s+/g, '-')}`;
        timeBp.textContent = new Date(bp.latest.time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    
    // 4. Glucose
    const gl = summary.blood_glucose;
    const valGlucose = document.getElementById('valGlucose');
    const statusGlucose = document.getElementById('statusGlucose');
    const timeGlucose = document.getElementById('timeGlucose');
    if (gl && gl.latest) {
        valGlucose.textContent = gl.latest.val_pri;
        statusGlucose.textContent = gl.latest.status;
        statusGlucose.className = `status-tag status-${gl.latest.status.toLowerCase().replace(/\s+/g, '-')}`;
        timeGlucose.textContent = new Date(gl.latest.time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
}

function renderHealthLogsTable(logs) {
    const tbody = document.getElementById('healthLogsTableBody');
    if (!tbody) return;
    
    if (logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center">No vital logs recorded yet. Use the form above to record your first reading.</td></tr>`;
        return;
    }
    
    let html = '';
    logs.forEach(l => {
        const metricNameMap = {
            'temperature': '🌡️ Temperature',
            'weight': '⚖️ Weight',
            'blood_pressure': '🩸 Blood Pressure',
            'blood_glucose': '🍬 Blood Glucose'
        };
        const mName = metricNameMap[l.metric_type] || l.metric_type;
        const readingStr = l.value_secondary ? `${l.value_primary} / ${l.value_secondary} ${l.unit}` : `${l.value_primary} ${l.unit}`;
        const dateStr = new Date(l.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const statusClass = `status-tag status-${(l.status || 'normal').toLowerCase().replace(/\s+/g, '-')}`;
        
        html += `
            <tr>
                <td>${dateStr}</td>
                <td><strong>${mName}</strong></td>
                <td><span class="reading-val">${readingStr}</span></td>
                <td><span class="${statusClass}">${l.status}</span></td>
                <td>${l.notes || '-'}</td>
                <td><button class="btn btn-sm btn-danger" onclick="deleteHealthLog(${l.id})"><i class="fa-solid fa-trash"></i></button></td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

window.deleteHealthLog = async function(logId) {
    if (!confirm('Are you sure you want to delete this vital reading?')) return;
    try {
        const res = await fetch(`/api/health-trends/${logId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.message) {
            await loadHealthTrends();
        }
    } catch (e) {
        alert('Failed to delete log.');
    }
};

// Canvas Line Chart Renderer
function renderTrendCanvasChart(metricType, history) {
    const canvas = document.getElementById('trendChartCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width || 600;
    canvas.height = rect.height || 200;
    
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    
    if (!history || history.length === 0) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`No historical data for ${metricType}. Log entries to generate trend graph.`, w / 2, h / 2);
        return;
    }
    
    const padding = { top: 30, right: 30, bottom: 40, left: 50 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;
    
    const values = history.map(d => d.value_primary);
    let minVal = Math.min(...values);
    let maxVal = Math.max(...values);
    
    if (minVal === maxVal) {
        minVal = minVal * 0.9;
        maxVal = maxVal * 1.1;
    }
    
    const valRange = maxVal - minVal || 1;
    
    // Draw background grid lines
    ctx.strokeStyle = document.documentElement.getAttribute('data-theme') === 'dark' ? '#334155' : '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
        const y = padding.top + (chartH / 4) * i;
        ctx.moveTo(padding.left, y);
        ctx.lineTo(w - padding.right, y);
        
        const gridVal = (maxVal - (valRange / 4) * i).toFixed(1);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(gridVal, padding.left - 8, y + 4);
    }
    ctx.stroke();
    
    // Plot points
    const points = history.map((item, idx) => {
        const x = padding.left + (chartW / (history.length - 1 || 1)) * idx;
        const y = padding.top + chartH - ((item.value_primary - minVal) / valRange) * chartH;
        return { x, y, item };
    });
    
    // Draw gradient area
    const gradient = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom);
    gradient.addColorStop(0, 'rgba(2, 132, 199, 0.35)');
    gradient.addColorStop(1, 'rgba(2, 132, 199, 0.0)');
    
    ctx.beginPath();
    ctx.moveTo(points[0].x, h - padding.bottom);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, h - padding.bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Draw connecting trend line
    ctx.beginPath();
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 3;
    points.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    
    // Draw data points & X-axis labels
    points.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#0284c7';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.fillStyle = document.documentElement.getAttribute('data-theme') === 'dark' ? '#f1f5f9' : '#1e293b';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.item.value_primary, p.x, p.y - 10);
        
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px Inter, sans-serif';
        ctx.fillText(p.item.time, p.x, h - padding.bottom + 20);
    });
}

// ==========================================================================
// 📖 Interactive Disease Details Modal Controller
// ==========================================================================

window.openDiseaseDetailModal = async function(encodedDiseaseName) {
    const diseaseName = decodeURIComponent(encodedDiseaseName);
    const modal = document.getElementById('diseaseDetailModal');
    const titleSpan = document.getElementById('detailModalTitle');
    const contentDiv = document.getElementById('diseaseDetailContent');
    
    if (!modal || !contentDiv) return;
    
    if (titleSpan) titleSpan.textContent = diseaseName;
    contentDiv.innerHTML = `<div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading full medical profile for ${diseaseName}...</div>`;
    modal.classList.add('active');
    
    try {
        const res = await fetch(`/api/knowledge/${encodeURIComponent(diseaseName)}`);
        const data = await res.json();
        
        if (data.error || !data.disease) {
            contentDiv.innerHTML = `<div class="no-data-placeholder"><p style="color:var(--danger);">Medical knowledge details not found for "${diseaseName}".</p></div>`;
            return;
        }
        
        const d = data.disease;
        const severityClass = ['high', 'severe', 'moderate-to-severe'].some(s => d.severity.toLowerCase().includes(s)) 
            ? 'badge-severity-high' 
            : d.severity.toLowerCase().includes('moderate') 
            ? 'badge-severity-moderate' 
            : 'badge-severity-mild';
            
        const symptomsStr = Array.isArray(d.symptoms) ? d.symptoms.join(', ') : (d.symptoms || 'N/A');

        contentDiv.innerHTML = `
            <div class="knowledge-card modal-knowledge-card">
                <div class="knowledge-card-header">
                    <div class="title-row" style="margin-bottom:6px;">
                        <h3 style="font-size:20px; font-weight:700; color:var(--primary);"><i class="fa-solid fa-disease"></i> ${d.disease}</h3>
                        <span class="badge ${severityClass}" style="font-size:12px; padding:4px 10px;">${d.severity} Severity</span>
                    </div>
                    <div class="meta-info-row" style="display:flex; flex-wrap:wrap; gap:16px; font-size:13px; color:var(--text-muted); background:var(--primary-bg); padding:10px 14px; border-radius:var(--radius-md); margin-top:6px;">
                        <span><i class="fa-solid fa-tag" style="color:var(--primary);"></i> <strong>Category:</strong> ${d.category}</span>
                        <span><i class="fa-solid fa-user-doctor" style="color:var(--primary);"></i> <strong>Specialist:</strong> ${d.specialist}</span>
                        <span><i class="fa-solid fa-users" style="color:var(--primary);"></i> <strong>Target Group:</strong> ${d.age_group || 'All ages'}</span>
                    </div>
                </div>
                <div class="knowledge-pillars" style="margin-top:14px; display:flex; flex-direction:column; gap:12px;">
                    <div class="pillar-box">
                        <strong><i class="fa-solid fa-head-side-cough"></i> 🩺 1. Symptoms:</strong>
                        <p>${symptomsStr}</p>
                    </div>
                    <div class="pillar-box">
                        <strong><i class="fa-solid fa-dna"></i> 🧬 2. Causes:</strong>
                        <p>${d.causes || 'N/A'}</p>
                    </div>
                    <div class="pillar-box">
                        <strong><i class="fa-solid fa-triangle-exclamation"></i> ⚠️ 3. Risk Factors:</strong>
                        <p>${d.risk_factors || 'N/A'}</p>
                    </div>
                    <div class="pillar-box">
                        <strong><i class="fa-solid fa-shield-halved"></i> 🛡️ 4. Prevention & Precautions:</strong>
                        <p>${d.prevention || d.prevention_tips || 'N/A'}</p>
                    </div>
                    <div class="pillar-box">
                        <strong><i class="fa-solid fa-capsules"></i> 💊 5. General Treatment Information & Medications:</strong>
                        <p>${d.treatment || d.medicine || 'N/A'}</p>
                    </div>
                    <div class="pillar-box warning-pillar">
                        <strong><i class="fa-solid fa-hospital-user"></i> 👨‍⚕️ 6. When to Seek Medical Care:</strong>
                        <p>${d.when_to_seek_care || 'N/A'}</p>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        contentDiv.innerHTML = `<div class="no-data-placeholder"><p style="color:var(--danger);"><i class="fa-solid fa-triangle-exclamation"></i> Network error: ${error.message}</p></div>`;
    }
};

// Global ESC key listener for modal closing
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
    }
});



async function updateDiseaseCount() {
    try {
        const response = await fetch('/health');
        const data = await response.json();
        if (data.disease_count) document.querySelectorAll('[data-disease-count]').forEach(el => el.textContent = `${data.disease_count}+`);
    } catch (_) { /* Keep the page usable when the count endpoint is unavailable. */ }
}


const i18n = {
 en: {language:'Language',safetyNav:'Health & Safety',safetySub:'Everyday wellness guidance',safetyEyebrow:'PRACTICAL, EVERYDAY GUIDANCE',safetyTitle:'Small habits that support your health',safetyIntro:'General guidance for adults. Your needs may differ based on age, pregnancy, disability, health conditions, medicines, and local recommendations.',foodTitle:'Food and hydration',foodText:'Choose a varied diet with vegetables, fruit, pulses and whole grains when available. Prefer safe drinking water. Needs vary; follow medical advice if you have a condition that affects food or fluids.',moveTitle:'Move regularly',moveText:'Build activity gradually in a way that feels safe for you. WHO’s adult guideline is 150–300 minutes of moderate aerobic activity weekly, or an equivalent amount of vigorous activity; some activity is better than none.',sleepTitle:'Sleep and mental wellbeing',sleepText:'Keep a regular sleep routine where possible and make time for rest and social connection. If distress is persistent or interferes with daily life, contact a qualified health professional.',preventTitle:'Prevent infection and injury',preventText:'Wash hands, follow food-safety practices, and ask a local health professional which vaccines and screening are recommended for you. Use seat belts and helmets; avoid tobacco and exposure to second-hand smoke.',medicineTitle:'Use medicines safely',medicineText:'Use medicines only as directed by a qualified professional or the official label. Check before combining medicines or supplements. Never share prescription medicines, and do not stop long-term treatment without advice.',careTitle:'Know when to get care',careText:'Arrange medical advice for new, persistent, worsening, or worrying symptoms. People with chronic conditions should follow their personalized care plan and routine check-ups.',emergencyTitle:'Get emergency help now',emergencyText:'Call your local emergency number for severe difficulty breathing, chest pressure or pain, fainting or unresponsiveness, severe bleeding, a seizure that will not stop, or sudden face drooping, arm weakness, or speech trouble. Do not wait for an online response.',safetyDisclaimer:'This guide is general information, not personal medical advice or a diagnosis. Follow local public-health advice and a qualified clinician’s recommendations. Vaccine, screening, diet, and activity guidance can vary by person and country.',sourcesTitle:'Trusted sources',chatTitle:'MedVitals AI — Personal Health Assistant',chatSub:'Symptom guidance, a growing condition library, and personal vital tracking',knowledgeTitle:'🧠 Medical Knowledge Base Search',knowledgeSub:'Comprehensive medical database: symptoms, prevention, treatment, and care',trendsTitle:'📊 Health Trend Tracker',trendsSub:'Record and monitor your health measurements over time',resultsEnglish:'Condition names, the disease library, and symptom-check results are currently available in English.'},
 hi: {language:'भाषा',safetyNav:'स्वास्थ्य और सुरक्षा',safetySub:'रोज़मर्रा के स्वास्थ्य सुझाव',safetyEyebrow:'व्यावहारिक रोज़मर्रा के सुझाव',safetyTitle:'स्वास्थ्य के लिए छोटी-छोटी अच्छी आदतें',safetyIntro:'वयस्कों के लिए सामान्य जानकारी। उम्र, गर्भावस्था, दिव्यांगता, बीमारी, दवाओं और स्थानीय सलाह के अनुसार आपकी ज़रूरतें अलग हो सकती हैं।',foodTitle:'भोजन और पानी',foodText:'जहाँ उपलब्ध हो, सब्ज़ियों, फलों, दालों और साबुत अनाज वाला विविध भोजन चुनें। सुरक्षित पीने का पानी लें। भोजन या तरल से जुड़ी बीमारी हो तो चिकित्सकीय सलाह मानें।',moveTitle:'नियमित रूप से सक्रिय रहें',moveText:'अपनी क्षमता के अनुसार धीरे-धीरे गतिविधि बढ़ाएँ। WHO वयस्कों के लिए सप्ताह में 150–300 मिनट मध्यम एरोबिक गतिविधि या इसके बराबर तेज़ गतिविधि की सलाह देता है। कुछ गतिविधि, बिल्कुल न करने से बेहतर है।',sleepTitle:'नींद और मानसिक स्वास्थ्य',sleepText:'जहाँ संभव हो, नियमित नींद का समय रखें और आराम तथा सामाजिक संपर्क के लिए समय निकालें। लगातार परेशानी हो या रोज़मर्रा के काम प्रभावित हों, तो योग्य स्वास्थ्यकर्मी से बात करें।',preventTitle:'संक्रमण और चोट से बचाव',preventText:'हाथ धोएँ, भोजन-सुरक्षा का ध्यान रखें और स्थानीय स्वास्थ्यकर्मी से अपने लिए उचित टीकों व जाँच के बारे में पूछें। सीट बेल्ट और हेलमेट पहनें; तंबाकू और परोक्ष धुएँ से बचें।',medicineTitle:'दवाओं का सुरक्षित उपयोग',medicineText:'दवा केवल योग्य स्वास्थ्यकर्मी के निर्देश या आधिकारिक लेबल के अनुसार लें। दवाएँ या सप्लीमेंट साथ लेने से पहले पूछें। प्रिस्क्रिप्शन दवा साझा न करें और सलाह के बिना नियमित उपचार बंद न करें।',careTitle:'कब चिकित्सा सहायता लें',careText:'नए, लगातार बने रहने वाले, बिगड़ते या चिंताजनक लक्षणों पर चिकित्सकीय सलाह लें। पुरानी बीमारी में अपनी व्यक्तिगत देखभाल योजना और नियमित जाँच का पालन करें।',emergencyTitle:'अभी आपातकालीन सहायता लें',emergencyText:'साँस लेने में गंभीर कठिनाई, सीने में दबाव या दर्द, बेहोशी या प्रतिक्रिया न देना, गंभीर रक्तस्राव, न रुकने वाला दौरा, या अचानक चेहरा टेढ़ा होना, बाँह में कमजोरी या बोलने में दिक्कत हो तो स्थानीय आपातकालीन नंबर पर कॉल करें। ऑनलाइन जवाब का इंतज़ार न करें।',safetyDisclaimer:'यह सामान्य जानकारी है, व्यक्तिगत चिकित्सकीय सलाह या निदान नहीं। स्थानीय सार्वजनिक स्वास्थ्य सलाह और योग्य चिकित्सक के निर्देश मानें। टीकों, जाँच, भोजन और गतिविधि की सलाह व्यक्ति और देश के अनुसार बदल सकती है।',sourcesTitle:'विश्वसनीय स्रोत',chatTitle:'MedVitals AI — व्यक्तिगत स्वास्थ्य सहायक',chatSub:'लक्षण मार्गदर्शन, स्वास्थ्य जानकारी और स्वास्थ्य मापों का रिकॉर्ड',knowledgeTitle:'🧠 स्वास्थ्य जानकारी खोजें',knowledgeSub:'लक्षण, बचाव, उपचार और देखभाल की जानकारी',trendsTitle:'📊 स्वास्थ्य मापों का रिकॉर्ड',trendsSub:'समय के साथ स्वास्थ्य माप दर्ज करें और देखें',resultsEnglish:'बीमारियों के नाम, रोग-संग्रह और लक्षण-जाँच के परिणाम अभी अंग्रेज़ी में उपलब्ध हैं।'},
 bn: {language:'ভাষা',safetyNav:'স্বাস্থ্য ও নিরাপত্তা',safetySub:'প্রতিদিনের সুস্থতার পরামর্শ',safetyEyebrow:'ব্যবহারিক দৈনন্দিন পরামর্শ',safetyTitle:'স্বাস্থ্যের জন্য ছোট ছোট ভালো অভ্যাস',safetyIntro:'প্রাপ্তবয়স্কদের জন্য সাধারণ তথ্য। বয়স, গর্ভাবস্থা, প্রতিবন্ধকতা, স্বাস্থ্যসমস্যা, ওষুধ এবং স্থানীয় পরামর্শ অনুযায়ী আপনার প্রয়োজন আলাদা হতে পারে।',foodTitle:'খাবার ও পানি',foodText:'সম্ভব হলে শাকসবজি, ফল, ডাল ও পূর্ণশস্যসহ বৈচিত্র্যময় খাবার খান। নিরাপদ পানীয় জল পান করুন। খাবার বা তরল-সম্পর্কিত সমস্যা থাকলে চিকিৎসকের পরামর্শ নিন।',moveTitle:'নিয়মিত চলাফেরা করুন',moveText:'নিজের জন্য নিরাপদ মনে হয় এমনভাবে ধীরে ধীরে শারীরিক কার্যকলাপ বাড়ান। WHO প্রাপ্তবয়স্কদের সপ্তাহে ১৫০–৩০০ মিনিট মাঝারি মাত্রার অ্যারোবিক কার্যকলাপ বা সমপরিমাণ তীব্র কার্যকলাপের পরামর্শ দেয়। কিছুটা কার্যকলাপও না করার চেয়ে ভালো।',sleepTitle:'ঘুম ও মানসিক সুস্থতা',sleepText:'সম্ভব হলে নিয়মিত ঘুমের সময় বজায় রাখুন এবং বিশ্রাম ও সামাজিক যোগাযোগের সময় রাখুন। মানসিক কষ্ট দীর্ঘস্থায়ী হলে বা দৈনন্দিন কাজে বাধা দিলে যোগ্য স্বাস্থ্যকর্মীর সঙ্গে কথা বলুন।',preventTitle:'সংক্রমণ ও আঘাত প্রতিরোধ',preventText:'হাত ধুয়ে নিন, খাবারের নিরাপত্তা মেনে চলুন এবং আপনার জন্য উপযুক্ত টিকা ও পরীক্ষার বিষয়ে স্থানীয় স্বাস্থ্যকর্মীর পরামর্শ নিন। সিট বেল্ট ও হেলমেট ব্যবহার করুন; তামাক ও পরোক্ষ ধোঁয়া এড়িয়ে চলুন।',medicineTitle:'ওষুধ নিরাপদে ব্যবহার করুন',medicineText:'যোগ্য স্বাস্থ্যকর্মীর নির্দেশ বা সরকারি লেবেল অনুযায়ী ওষুধ নিন। একাধিক ওষুধ বা সাপ্লিমেন্ট একসঙ্গে নেওয়ার আগে জেনে নিন। প্রেসক্রিপশনের ওষুধ ভাগ করবেন না এবং পরামর্শ ছাড়া দীর্ঘমেয়াদি চিকিৎসা বন্ধ করবেন না।',careTitle:'কখন চিকিৎসা নেবেন',careText:'নতুন, স্থায়ী, বাড়তে থাকা বা উদ্বেগজনক উপসর্গ হলে চিকিৎসকের পরামর্শ নিন। দীর্ঘস্থায়ী অসুস্থতা থাকলে ব্যক্তিগত পরিচর্যা পরিকল্পনা ও নিয়মিত পরীক্ষা মেনে চলুন।',emergencyTitle:'এখনই জরুরি সাহায্য নিন',emergencyText:'তীব্র শ্বাসকষ্ট, বুকে চাপ বা ব্যথা, অজ্ঞান হওয়া বা সাড়া না দেওয়া, গুরুতর রক্তপাত, না থামা খিঁচুনি, অথবা হঠাৎ মুখ বেঁকে যাওয়া, হাতে দুর্বলতা বা কথা বলতে সমস্যা হলে স্থানীয় জরুরি নম্বরে কল করুন। অনলাইন উত্তরের জন্য অপেক্ষা করবেন না।',safetyDisclaimer:'এটি সাধারণ তথ্য, ব্যক্তিগত চিকিৎসা-পরামর্শ বা রোগনির্ণয় নয়। স্থানীয় জনস্বাস্থ্য নির্দেশনা এবং যোগ্য চিকিৎসকের পরামর্শ মেনে চলুন। টিকা, পরীক্ষা, খাবার ও কার্যকলাপের পরামর্শ ব্যক্তি ও দেশভেদে আলাদা হতে পারে।',sourcesTitle:'বিশ্বস্ত সূত্র',chatTitle:'MedVitals AI — ব্যক্তিগত স্বাস্থ্য সহায়ক',chatSub:'উপসর্গ নির্দেশনা, স্বাস্থ্য তথ্য এবং স্বাস্থ্য পরিমাপের নথি',knowledgeTitle:'🧠 স্বাস্থ্য তথ্য খুঁজুন',knowledgeSub:'উপসর্গ, প্রতিরোধ, চিকিৎসা ও পরিচর্যার তথ্য',trendsTitle:'📊 স্বাস্থ্য পরিমাপের নথি',trendsSub:'সময়ের সঙ্গে স্বাস্থ্য পরিমাপ লিখুন ও দেখুন',resultsEnglish:'রোগের নাম, রোগ-তথ্যভান্ডার এবং উপসর্গ পরীক্ষার ফল এখন ইংরেজিতে পাওয়া যায়।'},
 es: {language:'Idioma',safetyNav:'Salud y seguridad',safetySub:'Consejos para el bienestar diario',safetyEyebrow:'CONSEJOS PRÁCTICOS PARA CADA DÍA',safetyTitle:'Pequeños hábitos que cuidan tu salud',safetyIntro:'Orientación general para adultos. Tus necesidades pueden variar según la edad, el embarazo, la discapacidad, las enfermedades, los medicamentos y las recomendaciones locales.',foodTitle:'Alimentación e hidratación',foodText:'Elige una alimentación variada con verduras, frutas, legumbres y cereales integrales cuando estén disponibles. Prefiere agua potable segura. Si una afección afecta tu alimentación o los líquidos, sigue el consejo médico.',moveTitle:'Muévete con regularidad',moveText:'Aumenta la actividad poco a poco y de forma segura para ti. La OMS recomienda a los adultos 150–300 minutos semanales de actividad aeróbica moderada, o una cantidad equivalente de actividad intensa; algo de actividad es mejor que ninguna.',sleepTitle:'Sueño y bienestar mental',sleepText:'Mantén horarios regulares de sueño cuando sea posible y reserva tiempo para descansar y relacionarte. Si el malestar persiste o afecta tu vida diaria, consulta a un profesional sanitario cualificado.',preventTitle:'Prevén infecciones y lesiones',preventText:'Lávate las manos, sigue prácticas de seguridad alimentaria y pregunta a un profesional local qué vacunas y controles se recomiendan para ti. Usa cinturón y casco; evita el tabaco y el humo ajeno.',medicineTitle:'Usa los medicamentos de forma segura',medicineText:'Usa medicamentos solo según las indicaciones de un profesional cualificado o la etiqueta oficial. Consulta antes de combinar medicamentos o suplementos. No compartas medicamentos recetados ni suspendas un tratamiento prolongado sin asesoramiento.',careTitle:'Cuándo buscar atención',careText:'Solicita consejo médico ante síntomas nuevos, persistentes, que empeoran o preocupantes. Si tienes una enfermedad crónica, sigue tu plan de atención personalizado y acude a los controles habituales.',emergencyTitle:'Busca ayuda de emergencia ahora',emergencyText:'Llama al número local de emergencias ante dificultad grave para respirar, presión o dolor en el pecho, desmayo o falta de respuesta, hemorragia grave, una convulsión que no cesa o aparición repentina de cara caída, debilidad en un brazo o dificultad para hablar. No esperes una respuesta en línea.',safetyDisclaimer:'Esta guía es información general, no un diagnóstico ni consejo médico personal. Sigue las recomendaciones locales de salud pública y las indicaciones de un profesional cualificado. Las recomendaciones sobre vacunas, controles, alimentación y actividad varían según la persona y el país.',sourcesTitle:'Fuentes fiables',chatTitle:'MedVitals AI — Asistente personal de salud',chatSub:'Orientación sobre síntomas, información de salud y seguimiento de medidas',knowledgeTitle:'🧠 Buscar información médica',knowledgeSub:'Información sobre síntomas, prevención, tratamiento y atención',trendsTitle:'📊 Seguimiento de salud',trendsSub:'Registra y consulta tus mediciones de salud a lo largo del tiempo',resultsEnglish:'Los nombres de enfermedades, la biblioteca y los resultados del análisis de síntomas están disponibles actualmente en inglés.'}
};

function applyLanguage(language) {
    if (!i18n[language]) language = 'en';
    state.language = language;
    localStorage.setItem('medvitals-language', language);
    document.documentElement.lang = language;
    const t = {...i18n[language], ...coreI18n[language]};
    document.querySelectorAll('[data-i18n]').forEach(el => { if (t[el.dataset.i18n]) el.textContent = t[el.dataset.i18n]; });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { if (t[el.dataset.i18nPlaceholder]) el.placeholder = t[el.dataset.i18nPlaceholder]; });
    const title = document.getElementById('mainTitle');
    const subtitle = document.getElementById('mainSubtitle');
    if (title && subtitle) {
        const keys = {chat:['chatTitle','chatSub'],knowledge:['knowledgeTitle','knowledgeSub'],trends:['trendsTitle','trendsSub'],safety:['safetyTitle','safetyEyebrow']};
        const pair = keys[state.activeSection] || keys.chat;
        title.textContent = t[pair[0]]; subtitle.textContent = t[pair[1]];
    }
}


const coreI18n = {
 en:{navChecker:'Symptom Checker',navCheckerSub:'Check symptoms',navLibrary:'Medical Knowledge',navTrends:'Health Trends',navTrendsSub:'Track vital metrics',navReminders:'Set Reminders',navHistory:'Chat History',navAnalytics:'Analytics',welcomeTitle:'Welcome to MedVitals AI!',welcomeText:'Your intelligent personal health assistant. How would you like to get started today?',sampleTitle:'Click an example symptom below to test instant analysis:',symptomPlaceholder:'Type symptoms (e.g. fever, headache, dry cough)...',libraryTitle:'Medical Knowledge Base'},
 hi:{navChecker:'लक्षण जाँच',navCheckerSub:'लक्षण देखें',navLibrary:'स्वास्थ्य जानकारी',navTrends:'स्वास्थ्य रुझान',navTrendsSub:'स्वास्थ्य माप देखें',navReminders:'अनुस्मारक',navHistory:'चैट इतिहास',navAnalytics:'विश्लेषण',welcomeTitle:'MedVitals AI में आपका स्वागत है!',welcomeText:'आपका स्वास्थ्य सहायक। आज आप कैसे शुरू करना चाहेंगे?',sampleTitle:'त्वरित जाँच के लिए नीचे दिया उदाहरण चुनें:',symptomPlaceholder:'लक्षण लिखें (जैसे बुखार, सिरदर्द, सूखी खाँसी)...',libraryTitle:'स्वास्थ्य जानकारी'},
 bn:{navChecker:'উপসর্গ পরীক্ষা',navCheckerSub:'উপসর্গ দেখুন',navLibrary:'স্বাস্থ্য তথ্য',navTrends:'স্বাস্থ্য প্রবণতা',navTrendsSub:'স্বাস্থ্য পরিমাপ দেখুন',navReminders:'অনুস্মারক',navHistory:'চ্যাট ইতিহাস',navAnalytics:'বিশ্লেষণ',welcomeTitle:'MedVitals AI-তে স্বাগতম!',welcomeText:'আপনার স্বাস্থ্য সহায়ক। আজ কীভাবে শুরু করবেন?',sampleTitle:'দ্রুত পরীক্ষা করতে নিচের একটি উদাহরণ বেছে নিন:',symptomPlaceholder:'উপসর্গ লিখুন (যেমন জ্বর, মাথাব্যথা, শুকনো কাশি)...',libraryTitle:'স্বাস্থ্য তথ্য'},
 es:{navChecker:'Revisar síntomas',navCheckerSub:'Consultar síntomas',navLibrary:'Información médica',navTrends:'Tendencias de salud',navTrendsSub:'Registrar mediciones',navReminders:'Recordatorios',navHistory:'Historial del chat',navAnalytics:'Estadísticas',welcomeTitle:'¡Te damos la bienvenida a MedVitals AI!',welcomeText:'Tu asistente personal de salud. ¿Cómo quieres empezar hoy?',sampleTitle:'Elige un ejemplo para probar un análisis rápido:',symptomPlaceholder:'Escribe síntomas (p. ej., fiebre, dolor de cabeza, tos seca)...',libraryTitle:'Información médica'}
};
