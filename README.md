🏥 Healthcare Chatbot
A medical assistant chatbot that analyzes symptoms and suggests possible medical conditions from a database of 150+ diseases. Built with Python Flask and a comprehensive medical knowledge base.

🚀 Features
Symptom Analysis: Detects symptoms from user input

Disease Matching: Compares against 150+ medical conditions

Intelligent Ranking: Shows top 5 matches with percentage scores

Category Filtering: Diseases organized by medical specialty

Emergency Detection: Alerts for critical symptoms

Web Interface: Clean chat UI with real-time responses

🏗️ Project Structure
Minimal File Structure:

healthcare-chatbot/
├── app.py              # Main Flask backend (single file)
├── index.html          # Frontend interface (single file)
└── README.md           # This file

What's Inside:
app.py - Complete Flask backend with:

150+ disease database with symptoms

Chat endpoint with symptom matching

Disease search API

Frontend serving

Auto-browser launch

index.html - Complete frontend with:

Chat interface with message history

Real-time API communication

Responsive design

Loading indicators

🛠️ Technologies
Backend: Python, Flask, Flask-CORS

Frontend: HTML5, CSS3, JavaScript (Vanilla)

Database: In-memory Python list (150+ diseases)

Deployment: Localhost with auto-browser launch

📊 Medical Database
150+ Diseases across 15+ medical categories

Autoimmune: Lupus, Rheumatoid Arthritis, etc.

Cancer: 20+ types with specific symptoms

Neurological: Parkinson's, Alzheimer's, MS

Cardiovascular: Hypertension, Heart conditions

Respiratory: Asthma, COPD, Pneumonia

And more...

Each disease includes:

Disease name and category

Detailed symptom list (10-15 symptoms each)

Severity rating (mild/moderate/high)

📡 API Endpoints
Endpoint	  Method    	Description
/	           GET       	Serves frontend interface
/chat   	  POST	     Main chat endpoint
/diseases    GET	     List all diseases
/health 	   GET       	System health check
