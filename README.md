🏥 Healthcare Chatbot 
📋 Overview

This advanced healthcare chatbot helps users identify potential medical conditions based on their symptoms. It features a comprehensive disease database with 370+ conditions across multiple medical categories, providing intelligent symptom matching, disease information, prevention tips, doctor recommendations, and basic health guidance.

The system also includes full chat history tracking, medication reminders, user health profiles, and an analytics dashboard.

✨ Key Features
🔍 Smart Symptom Analysis

Natural language processing for symptom input

Multiple input formats supported:
Comma-separated: fever, headache, fatigue
Space-separated: fever headache fatigue
Natural language: i have fever and headache

✅ Fuzzy matching for misspelled symptoms
✅ Weighted scoring (first symptoms count more)

📚 Comprehensive Database

370+ diseases across 20+ medical categories (↑30 new diseases added)

Each disease includes:

Detailed symptom list

Severity rating (mild / moderate / high)

Medical category

Recommended medicines

Health advice

Prevention tips

Specialist doctor consultation

Confidence scoring

Matched symptoms tracking

🧠 Intelligent Matching Algorithm

Partial and exact symptom matching

Match score calculation (0–100%)

✅ Vector-based similarity matching
✅ Confidence scoring system
✅ Severity bonus calculation

Top 10 most relevant results displayed

🆕 Updated Reminder System
⏰ Medication Reminders (Upgraded)

The reminder system has been enhanced with improved time management and scheduling capabilities.

New Time Features

✅ Multiple time selection for a single medication
✅ Improved time formatting and validation
✅ Flexible reminder duration control
✅ Accurate scheduling with background scheduler
✅ Real-time reminder tracking

Reminder Capabilities

Add reminder modal

Multiple time selection

Duration setting

Active reminders display

Real-time updates

Delete reminder option

Automatic reminder notifications

📊 Disease Database Categories (Updated)
Category	Count	Examples
🦠 Autoimmune	18+	Lupus, Sjögren's, Scleroderma
🎗️ Cancer	35+	Breast, Lung, Leukemia
🧠 Neurological	28+	Alzheimer's, Parkinson's
❤️ Cardiovascular	22+	Hypertension, Stroke
🌬️ Respiratory	20+	Asthma, COPD, Pneumonia
🦴 Bone & Joint	25+	Arthritis, Gout
👁️ Eye	18+	Cataracts, Glaucoma
👂 Ear	14+	Tinnitus, Vertigo
💤 Sleep	12+	Sleep Apnea, Insomnia
🫁 Gastrointestinal	28+	IBS, Crohn's
🧬 Genetic	22+	Cystic Fibrosis
🔬 Infectious	20+	TB, Lyme Disease
🩺 Endocrine	18+	Diabetes, Thyroid
🚻 Reproductive	20+	Endometriosis
🫀 Kidney	14+	Kidney Stones
🦷 Dental	10+	Gingivitis
🧪 Metabolic	12+	Porphyria
🫁 Liver	8+	Cirrhosis
🧠 Psychiatric	10+	Depression
🩸 Blood	12+	Anemia

TOTAL: 370+ Diseases (↑30 New Diseases Added)

⚠️ Important Notes
Medical Disclaimer

This chatbot is for informational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment.

Always seek the advice of a qualified healthcare professional.

Emergency Protocol

🚨 In case of emergency, contact emergency medical services immediately.

Privacy Note

All chat history and health data are stored locally in the SQLite database.
No external data sharing occurs except optional email notifications.

Development Status

⚠️ The chatbot is under active development:

Database now contains 370+ diseases

Matching algorithms continuously improving

Reminder system upgraded

New features being added regularly

User feedback integrated

✅ Only 2 real changes were made:

340+ → 370+ diseases

Reminder time system upgraded
