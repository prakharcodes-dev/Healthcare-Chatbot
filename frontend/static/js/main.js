/* ==========================================================================
   MedVitals AI - Client Logic & Interactivity
   ========================================================================== */

const state = {
    sessionId: null,
    userId: 1,
    reminderTimes: [],
    activeReminders: [],
    searchHistory: [],
    suggestDebounceTimer: null
};

// Initialize Application
document.addEventListener('DOMContentLoaded', init);

async function init() {
    initTheme();
    setupEventListeners();
    await startSession();
    await checkConnection();
    await loadReminders();
    await loadSearchHistory();
    
    // Periodically update connection status
    setInterval(checkConnection, 45000);
    
    // Check permission status
    updateNotificationUI();
    
    // Start local checking of medication reminders (every minute)
    startReminderChecker();
}

// Event Listeners Setup
function setupEventListeners() {
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
    document.querySelectorAll('.app-section').forEach(sec => {
        sec.style.display = 'none';
    });
    
    const mainTitle = document.getElementById('mainTitle');
    const mainSubtitle = document.getElementById('mainSubtitle');
    
    if (section === 'chat') {
        document.getElementById('sectionChat').style.display = 'flex';
        if (mainTitle) mainTitle.textContent = 'Symptom Analysis Hub';
        if (mainSubtitle) mainSubtitle.textContent = 'Powered by Enhanced Disease Matching Algorithms';
    } else if (section === 'knowledge') {
        document.getElementById('sectionKnowledge').style.display = 'block';
        if (mainTitle) mainTitle.textContent = '🧠 Medical Knowledge Base Search';
        if (mainSubtitle) mainSubtitle.textContent = 'Comprehensive Medical Database covering Symptoms, Causes, Risk Factors, Prevention, Treatment, and When to Seek Care';
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
    } else if (section === 'analytics') {
        document.getElementById('sectionChat').style.display = 'flex';
        fetchAnalytics();
    }
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
            // Display truncated version
            document.getElementById('sessionId').textContent = state.sessionId.slice(0, 14) + '...';
        }
    } catch (error) {
        console.error('Session initiation error:', error);
        document.getElementById('sessionId').textContent = 'Error';
    }
}

// Health Connection Checker
async function checkConnection() {
    const statusBadge = document.getElementById('connectionStatus');
    try {
        const res = await fetch('/health');
        const data = await res.json();
        
        statusBadge.className = 'status-badge status-connected';
        statusBadge.innerHTML = `<i class="fa-solid fa-circle-check"></i> Connected - ${data.disease_count} diseases`;
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
        addMessage('bot', `<p style="color: var(--danger);"><i class="fa-solid fa-triangle-exclamation"></i> Network error: ${error.message}</p>`);
    }
}

// Format Matches in structured 5-section response format
function formatMatchesResponse(matches, structuredResp) {
    let html = `<div class="matches-response">`;
    
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
    const whatYouCanDoText = structuredResp && structuredResp.what_you_can_do 
        ? structuredResp.what_you_can_do 
        : (matches[0] ? `Treatment: ${matches[0].treatment || matches[0].medicine || 'Rest & OTC care'}. Advice: ${matches[0].advice || 'Hydration'}` : 'Rest and stay hydrated.');
    html += `<div class="response-section action-section">
        <h4 class="section-title"><i class="fa-solid fa-hand-holding-medical"></i> <strong>What you can do:</strong></h4>
        <p>${whatYouCanDoText}</p>
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
        : `Call emergency services (911/112) immediately if you experience severe shortness of breath, sudden chest pain, loss of consciousness, or severe trauma.`;
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

// Start scanning local reminders every 10 seconds
function startReminderChecker() {
    setInterval(checkActiveLocalReminders, 10000);
}

// Alert browser notification and sound chime for scheduled time matches
function checkActiveLocalReminders() {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"
    
    state.activeReminders.forEach(reminder => {
        if (!reminder.schedule_times) return;
        reminder.schedule_times.forEach(scheduledTime => {
            if (scheduledTime === currentTime) {
                const storageKey = `last_notified_${reminder.id}_${scheduledTime}`;
                const lastNotified = localStorage.getItem(storageKey);
                const tenMinutesAgo = now.getTime() - (10 * 60 * 1000);
                
                // Ensure we don't alert multiple times within the same minute
                if (!lastNotified || parseInt(lastNotified) < tenMinutesAgo) {
                    triggerReminderAlert(reminder.medication_name, reminder.dosage);
                    localStorage.setItem(storageKey, now.getTime().toString());
                }
            }
        });
    });
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
                message += `<span class="badge" style="background-color:#f1f5f9; color:var(--text-main); border:1px solid var(--border-color);">${s.symptom} (${s.count})</span>`;
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
        if (results.length === 0) {
            container.innerHTML = `<div class="no-data-placeholder"><i class="fa-solid fa-folder-open"></i><p>No medical conditions found matching "${query}".</p></div>`;
            return;
        }
        
        let html = '';
        results.forEach(d => {
            const severityClass = ['high', 'severe', 'moderate-to-severe'].some(s => d.severity.toLowerCase().includes(s)) 
                ? 'badge-severity-high' 
                : d.severity.toLowerCase().includes('moderate') 
                ? 'badge-severity-moderate' 
                : 'badge-severity-mild';
                
            const symptomsStr = Array.isArray(d.symptoms) ? d.symptoms.join(', ') : (d.symptoms || 'N/A');
            
            html += `
                <div class="knowledge-card">
                    <div class="knowledge-card-header">
                        <div class="title-row">
                            <h3><i class="fa-solid fa-book-medical"></i> ${d.disease}</h3>
                            <span class="badge ${severityClass}">${d.severity}</span>
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


