# 🏥 MedVitals AI - Smart Healthcare Chatbot & Assistant

MedVitals AI is an advanced, responsive healthcare chatbot designed to help users identify potential medical conditions based on their symptoms. The application features a comprehensive disease database of **550 conditions**, fuzzy matching for misspelled symptoms, an autocomplete suggestion panel, and a scheduling system for medication reminders.

---

## ✨ Features

- **🔍 Intelligent Symptom Checker**: 
  - Supports natural language symptom inputs (e.g., *"I have a severe headache, nausea, and high fever"*) or list-based inputs.
  - Custom fuzzy matching algorithm to identify misspelled symptoms.
  - Weighted matching where early symptoms are prioritized, combined with vector-based cosine similarity.
- **⚡ Autocomplete suggestions**:
  - Displays instant autocomplete suggestions as you type. Clicking suggestions appends symptoms dynamically using comma-separated tokens.
- **⏰ Medication Reminders**:
  - Set drug alerts with specific schedules, dosage quantities, and durations.
  - Features real-time browser desktop notifications for active schedules.
- **📊 Usage Analytics**:
  - Visual metrics for session tracking, message counters, most searched diseases, and top reported symptoms.
- **📚 Massive Database**:
  - Expanded to **550 diseases** across 20+ clinical categories (Viral, Bacterial, Parasitic, Fungal, Psychiatric, Autoimmune, and Dermatological).
- **📋 Personalized Insights**:
  - Tailored health recommendations based on user history and seasonal disease alerts.

---

## 📁 Project Architecture

The application is structured cleanly using modular MVC best practices:

```
HEALTHCARE CHATBOT/
├── backend/                  # Flask backend package
│   ├── __init__.py           # App factory & service initializations
│   ├── config.py             # App configurations & database path bindings
│   ├── extensions.py         # SQLAlchemy & Background Scheduler shares
│   ├── history.py            # Chat session loggers & usage analytics managers
│   ├── matcher.py            # Cosine similarity & weighted fuzzy symptom matching
│   ├── models.py             # Database schemas (User, Sessions, Notifications)
│   ├── notifications.py      # Job schedulers & notification triggers
│   └── utils.py              # Symptom sanitizers & sentiment analyzers
├── data/                     # Data storage
│   └── diseases.json         # Alphabetized database of 550 conditions
├── frontend/                 # Client-side interface
│   ├── static/
│   │   ├── css/
│   │   │   └── style.css     # Design system (custom teal & indigo theme)
│   │   └── js/
│   │       └── main.js       # Autocomplete, reminder scan, and API clients
│   └── templates/
│       └── index.html        # Clean, modular HTML structure
├── instance/                 # Local data directory
│   └── healthcare_chatbot.db # SQLite database
├── run.py                    # Server entrypoint
├── requirements.txt          # Python dependencies
└── README.md                 # Project documentation
```

---

## 🚀 Installation & Running

### 1. Prerequisites
Make sure you have **Python 3.8+** installed.

### 2. Install Dependencies
Install all required libraries using pip:
```bash
pip install -r requirements.txt
```

### 3. Run the Server
Start the Flask development server:
```bash
python run.py
```
Upon startup:
- The backend loads the **550 disease** records from `data/diseases.json`.
- The SQLite database tables are created automatically if they do not exist.
- A background scheduler is initialized.
- Your default web browser will automatically open to `http://127.0.0.1:5000`.

---

## ⚠️ Important Disclaimers

### 🩺 Medical Disclaimer
This chatbot is for **informational and educational purposes only**. It does not constitute medical advice, professional diagnosis, or treatment recommendations. Always consult a qualified medical professional (such as a physician or specialist) before starting any drug regimen or if you are feeling unwell.

### 🚨 Emergency Protocol
In case of a medical emergency, call your local emergency services (e.g., 911 or 112) immediately.

### 🔒 Privacy Note
All conversation logs, medication reminders, and health session files are kept entirely local in the SQLite database (`instance/healthcare_chatbot.db`) and your browser's local storage. No health profile data is transmitted externally.
