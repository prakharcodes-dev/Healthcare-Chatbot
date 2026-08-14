# 🏥 MedVitals AI - Smart Healthcare Chatbot & Assistant

MedVitals AI is an advanced, responsive healthcare chatbot designed to help users identify potential medical conditions based on their symptoms. The application features a comprehensive disease database of **650+ medical conditions**, intelligent typo-tolerant symptom search, explicit title-labeled condition results, a dynamic Dark/Light theme system, and an audio-visual medication reminder system.

---

## ✨ Features

- **🔍 Typo-Tolerant Symptom Search Engine**: 
  - Supports natural language symptom inputs (e.g., *"I have a severe headache, nausea, and high fever"*) or list-based inputs.
  - Automatically understands and corrects user typos (e.g., typing `pian` $\rightarrow$ `pain`, `blede` $\rightarrow$ `bleed`/`bleeding`, `pqain` $\rightarrow$ `pain`, `headace` $\rightarrow$ `headache`, `nausia` $\rightarrow$ `nausea`).
  - Uses token-level Levenshtein distance matching and weighted cosine similarity to match misspellings against multi-word symptoms.
- **📋 Explicit Titled Disease Results**:
  - Each match explicitly displays labeled headers:
    - 🩺 **Disease Name:** Condition title
    - 🤒 **Symptoms:** List of associated medical symptoms
    - ⚠️ **Caution / Severity:** Severity level & health advice
    - 💊 **Treatment & Care:** Recommended medications & care protocols
    - 👨‍⚕️ **Recommended Specialist:** Medical specialist to consult
    - 🛡️ **Prevention:** Precautionary measures & prevention tips
- **🌙 Seamless Dark & Light Themes**:
  - Full theme toggle supporting Dark Mode and Light Mode with high-contrast, accessible typography and card styling.
- **⏰ Active Medication Reminders**:
  - Schedule dose alerts with specific times, dosage strengths, and durations.
  - Features real-time 10-second background scanning, Web Audio API synthesized alert chime sounds, browser desktop notifications, and a 1-click **Test Alert** button.
- **⚡ Autocomplete Suggestions**:
  - Displays instant autocomplete suggestions as you type, inserting comma-separated tokens smoothly.
- **📚 650+ Medical Condition Database**:
  - Expanded to **654 diseases** across 25+ clinical categories (Cardiovascular, Neurological, Respiratory, Gastrointestinal, Infectious, Pediatric, Rare Diseases, Autoimmune, and Dermatological).
- **📊 Usage Analytics & Chat History**:
  - Visual usage analytics and searchable chat archives saved locally in SQLite and browser LocalStorage.

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
│   ├── matcher.py            # Token-level fuzzy symptom matcher & vector engine
│   ├── models.py             # Database schemas (User, Sessions, Notifications)
│   ├── notifications.py      # Job schedulers & notification triggers
│   └── utils.py              # Symptom sanitizers, typo correction map & sentiment analyzers
├── data/                     # Data storage
│   └── diseases.json         # Complete database of 650+ conditions
├── frontend/                 # Client-side interface
│   ├── static/
│   │   ├── css/
│   │   │   └── style.css     # Design system with Dark/Light mode theme CSS variables
│   │   └── js/
│   │       └── main.js       # Autocomplete, Web Audio API chime, reminder scanner, API clients
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
- The backend loads **654 disease** records from `data/diseases.json`.
- The SQLite database tables are created automatically if they do not exist.
- A background scheduler and reminder engine are initialized.
- Your default web browser will automatically open to `http://127.0.0.1:5000`.

---

## ⚠️ Important Disclaimers

### 🩺 Medical Disclaimer
This chatbot is for **informational and educational purposes only**. It does not constitute medical advice, professional diagnosis, or treatment recommendations. Always consult a qualified medical professional (such as a physician or specialist) before starting any drug regimen or if you are feeling unwell.

### 🚨 Emergency Protocol
In case of a medical emergency, call your local emergency services (e.g., 911 or 112) immediately.

### 🔒 Privacy Note
All conversation logs, medication reminders, and health session files are kept entirely local in the SQLite database (`instance/healthcare_chatbot.db`) and your browser's local storage. No health profile data is transmitted externally.

