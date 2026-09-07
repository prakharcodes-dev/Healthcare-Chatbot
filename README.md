# 🏥 MedVitals AI - Smart Healthcare Chatbot & Assistant

> 🌐 **Live Demo URL:** [https://healthcare-chatbot-1-ynxb.onrender.com]

MedVitals AI is an advanced, responsive healthcare chatbot designed to help users identify potential medical conditions based on their symptoms, explore comprehensive medical knowledge, and track vital health trends over time. The application features a database of **650+ medical conditions**, intelligent typo-tolerant symptom search, structured 5-section chat responses, interactive 6-pillar disease detail modals, health trend tracking with clinical feedback, and an audio-visual medication reminder system.

---

## ✨ Key Features

### 🧠 1. Better Medical Knowledge Search & Interactive Disease Modals
- **6-Pillar Medical Knowledge Engine**: Every condition in the 650+ disease database covers 6 comprehensive medical pillars:
  1. 🩺 **Symptoms:** Complete list of associated medical symptoms
  2. 🧬 **Causes:** Underlying biological, pathogen, genetic, or environmental etiologies
  3. ⚠️ **Risk Factors:** Predisposing factors (age, family history, lifestyle, immune status)
  4. 🛡️ **Prevention & Precautions:** Precautionary guidelines & preventive measures
  5. 💊 **General Treatment Information:** Medications & recommended care protocols
  6. 👨‍⚕️ **When to Seek Medical Care:** Clinical thresholds for consulting a physician or specialist
- **Dedicated Medical Knowledge Base Tab**: Interactive search box and category filtering (Respiratory, Cardiovascular, Bacterial, Viral, Endocrine, Neurological, Gastrointestinal, Dermatological, Autoimmune).
- **1-Click Interactive Disease Details Modal**: Clicking on any condition chip (e.g. *Dengue Hemorrhagic Fever*, *Aplastic Anemia*, *Dengue Fever*, etc.) opens a modal displaying its complete 6-pillar medical profile. Supports closing via `×` button, "Close" button, backdrop click, or the `ESC` key.

### 📊 2. Health Trend Tracking & Reassuring Clinical Assessment
- **Vital Metric Logging**: Record key health metrics over time:
  - 🌡️ **Body Temperature** (°F / °C)
  - ⚖️ **Body Weight** (kg / lbs)
  - 🩸 **Blood Pressure** (Systolic & Diastolic in mmHg)
  - 🍬 **Blood Glucose** (mg/dL)
- **Reassuring Overall Condition Assessment Banner**: Automatically evaluates all recorded vitals and displays an overall health verdict banner:
  > 🟢 **Your Vitals Look Great! Condition is Normal & Good 👍**
  > *All your recorded health vitals are in healthy, safe, and optimal target ranges. There is no cause for concern!*
- **Instant Vital Reading Feedback Toast**: Right after saving a reading, provides immediate clinical feedback (e.g., *"Body Temperature (98.6 °F) is in the ideal normal range (97.0–99.5°F). Your condition is good — nothing to worry about!"*).
- **Interactive Canvas Trend Visualization**: Smooth HTML5 Canvas line graphs for metric trends, color-coded status badges (`Normal`, `Elevated`, `High`, `Low`), and complete log history table with entry deletion.

### 🌡️ 3. Conditional Health Measurements & Safety Layer
- **Symptom-Driven Measurement Detection**: Automatically determines whether health measurements are relevant based on reported symptoms:
  - *Fever / Chills / Feeling hot* $\rightarrow$ Requests **Body Temperature** (°C)
  - *Fainting / Dizziness / Lightheadedness / Vertigo* $\rightarrow$ Requests **Blood Pressure** (Systolic / Diastolic mmHg)
  - *Weight concerns / Obesity / Weight loss* $\rightarrow$ Requests **Body Weight** (kg)
  - *Unrelated symptoms (e.g. stuffy nose, rash)* $\rightarrow$ Does NOT ask for unnecessary measurements.
- **Interactive Inline Measurement Card**: Allows users to enter relevant vitals or click "Skip for Now".
- **Automatic Health Trends Integration**: Submitted measurements are automatically validated, stored in the database (`HealthLog`), and displayed in the **Health Trends** view and Canvas graphs.
- **Combined Health Analysis**: Diagnostic matching combines symptoms, entered measurements, and health history into clear **Possible Health Concerns** without claiming confirmed diagnoses.
- **Urgent Safety Red-Flag Alert**: Immediate safety warning banner for high-risk symptoms (fainting, chest pain, severe breathing difficulty, loss of consciousness) recommending urgent emergency care.

### 📝 4. Structured Chat Responses
Instead of plain text outputs, every symptom check response is formatted into 5 distinct, readable sections:
1. 🔍 **Possible Causes:** Candidate conditions with match percentages and severity badges
2. 💡 **Why:** Explanation of why symptoms overlap with the diagnostic criteria, including recorded vitals
3. 🛠️ **What You Can Do:** Actionable general treatment, medication options, and self-care steps
4. 👨‍⚕️ **Seek Medical Care If:** Clear guidance on when to consult a specialist or primary physician
5. 🚨 **Emergency Warning:** High-priority alert banner detailing red-flag emergency symptoms and emergency hotline guidance (911 / 112)

### 🔍 5. Typo-Tolerant Symptom Search & Autocomplete
- Supports natural language symptom inputs (*"I have a severe headache, nausea, and high fever"*) or comma-separated lists.
- Automatically corrects typos (e.g. `pian` $\rightarrow$ `pain`, `blede` $\rightarrow$ `bleed`, `nausia` $\rightarrow$ `nausea`) using token-level Levenshtein distance and weighted vector cosine similarity.
- Autocomplete suggestion box offering real-time symptom and disease suggestions as you type.

### ⏰ 6. Active Medication Reminders & Themes
- **Active Reminders**: Schedule dosage alerts with times, strengths, and durations. Includes real-time 10-second background scanning, Web Audio API chime sounds, desktop notifications, and a 1-click **Test Alert** button.
- **Dark & Light Themes**: High-contrast, accessible design system supporting dark mode and light mode.


---

## 📁 Project Architecture

The application is built cleanly using modular Flask and MVC best practices:

```
HEALTHCARE CHATBOT/
├── backend/                  # Flask backend package
│   ├── __init__.py           # App factory, service init & 6-pillar disease normalizer
│   ├── config.py             # App configurations & database bindings
│   ├── extensions.py         # SQLAlchemy & Background Scheduler shares
│   ├── history.py            # Chat session loggers & analytics managers
│   ├── matcher.py            # Token-level fuzzy symptom matcher & vector engine
│   ├── models.py             # Database schemas (User, Sessions, HealthLog, Notifications)
│   ├── notifications.py      # Job schedulers & notification triggers
│   └── utils.py              # Symptom sanitizers, typo correction map & sentiment analyzers
├── data/                     # Data storage
│   └── diseases.json         # Comprehensive database of 650+ conditions
├── frontend/                 # Client-side interface
│   ├── static/
│   │   ├── css/
│   │   │   └── style.css     # Design system, 6-pillar cards & health trends CSS
│   │   └── js/
│   │       └── main.js       # Chat response renderer, Knowledge base search, Health Trends Canvas chart
│   └── templates/
│       └── index.html        # HTML structure with chat, knowledge, trends & modal views
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
Install all required Python libraries:
```bash
pip install -r requirements.txt
```

### 3. Run the Server
Start the Flask development server:
```bash
python run.py
```
Upon startup:
- The backend loads **654 disease** records from `data/diseases.json` and normalizes all 6 medical pillars.
- The SQLite database tables (including `HealthLog`) are created automatically if they do not exist.
- A background scheduler and reminder engine are initialized.
- Your default web browser automatically opens to `http://127.0.0.1:5000`.

---

## ⚠️ Important Disclaimers

### 🩺 Medical Disclaimer
This chatbot is for **informational and educational purposes only**. It does not constitute medical advice, professional diagnosis, or treatment recommendations. Always consult a qualified medical professional before starting any drug regimen or if you are feeling unwell.

### 🚨 Emergency Protocol
In case of a medical emergency, call your local emergency services (e.g., 911 or 112) immediately.

### 🔒 Privacy Note
All conversation logs, medication reminders, and health vital log files are kept entirely local in your SQLite database (`instance/healthcare_chatbot.db`) and browser local storage. No health profile data is transmitted externally.
