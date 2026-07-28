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
    document.getElementById('viewHistoryBtn').addEventListener('click', viewHistory);
    document.getElementById('themeToggleBtn').addEventListener('click', toggleTheme);
}

// Menu Click Router
function handleMenuClick(e) {
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    e.currentTarget.classList.add('active');
    
    const section = e.currentTarget.dataset.section;
    switch(section) {
        case 'history': viewHistory(); break;
        case 'reminders': showAddReminderModal(); break;
        case 'analytics': fetchAnalytics(); break;
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
            const htmlResponse = formatMatchesResponse(data.matches);
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

// Format Matches in structured card components
function formatMatchesResponse(matches) {
    let html = `<div class="matches-response">`;
    html += `<p class="match-header-text"><i class="fa-solid fa-list-check"></i> Found <strong>${matches.length} possible conditions</strong> based on your symptoms:</p>`;
    
    matches.forEach((match) => {
        // Map severity to appropriate color badge
        const severityClass = ['high', 'severe', 'moderate-to-severe'].some(s => match.severity.toLowerCase().includes(s)) 
            ? 'badge-severity-high' 
            : match.severity.toLowerCase().includes('moderate') 
            ? 'badge-severity-moderate' 
            : 'badge-severity-mild';
            
        html += `
            <div class="disease-card">
                <div class="disease-card-header">
                    <span class="disease-name">${match.disease}</span>
                    <div class="disease-badge-row">
                        <span class="badge ${severityClass}">${match.severity} severity</span>
                        <span class="badge badge-match">${match.match_percentage}% match</span>
                    </div>
                </div>
                
                <div class="disease-detail">
                    <strong><i class="fa-solid fa-stethoscope"></i> Recommended Specialist:</strong> ${match.specialist}
                </div>
                <div class="disease-detail">
                    <strong><i class="fa-solid fa-capsules"></i> Care & Medicines:</strong> ${match.medicine}
                </div>
                <div class="disease-detail">
                    <strong><i class="fa-solid fa-clipboard-question"></i> Health Advice:</strong> ${match.advice}
                </div>
                <div class="disease-detail">
                    <strong><i class="fa-solid fa-shield-halved"></i> Prevention:</strong> ${match.prevention_tips}
                </div>
            </div>
        `;
    });
    
    html += `<p style="font-size:12px; margin-top:8px; color: var(--text-muted);">Would you like advice on other symptoms or details about one of these conditions?</p>`;
    html += `</div>`;
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

// Start scanning local reminders
function startReminderChecker() {
    // Check every 30 seconds
    setInterval(checkActiveLocalReminders, 30000);
}

// Alert browser notification for schedule times matches
function checkActiveLocalReminders() {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"
    
    state.activeReminders.forEach(reminder => {
        reminder.schedule_times.forEach(scheduledTime => {
            if (scheduledTime === currentTime) {
                const storageKey = `last_notified_${reminder.id}_${scheduledTime}`;
                const lastNotified = localStorage.getItem(storageKey);
                const tenMinutesAgo = now.getTime() - (10 * 60 * 1000);
                
                // Ensure we don't alert multiple times within the same minute
                if (!lastNotified || parseInt(lastNotified) < tenMinutesAgo) {
                    if (Notification.permission === 'granted') {
                        new Notification(`💊 Medication Time: ${reminder.medication_name}`, {
                            body: `Take ${reminder.dosage}. Don't skip your dose.`,
                            icon: "🩺",
                            requireInteraction: true
                        });
                    }
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
