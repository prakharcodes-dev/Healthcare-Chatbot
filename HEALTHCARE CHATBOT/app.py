from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
import json
import re
import os
import webbrowser
import threading
import hashlib
import numpy as np
from apscheduler.schedulers.background import BackgroundScheduler
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fuzzywuzzy import fuzz, process
from collections import Counter

app = Flask(__name__, static_folder='static', static_url_path='/static')
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-key-change-in-production')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///healthcare_chatbot.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
CORS(app, supports_credentials=True)

db = SQLAlchemy(app)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    phone = db.Column(db.String(20))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    preferences = db.Column(db.JSON, default={})
    notifications_enabled = db.Column(db.Boolean, default=True)

class ChatSession(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    session_id = db.Column(db.String(100), unique=True, nullable=False)
    start_time = db.Column(db.DateTime, default=datetime.utcnow)
    end_time = db.Column(db.DateTime)
    device_info = db.Column(db.JSON)
    location = db.Column(db.String(200))

class ChatMessage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(100), db.ForeignKey('chat_session.session_id'))
    user_message = db.Column(db.Text, nullable=False)
    bot_response = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    message_type = db.Column(db.String(50))
    sentiment_score = db.Column(db.Float)
    response_time = db.Column(db.Float)

class DiseaseSearch(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(100), db.ForeignKey('chat_session.session_id'))
    symptoms_input = db.Column(db.Text)
    matched_diseases = db.Column(db.JSON)
    top_match = db.Column(db.String(200))
    search_time = db.Column(db.DateTime, default=datetime.utcnow)
    user_rating = db.Column(db.Integer)
    feedback = db.Column(db.Text)

class UserHealthProfile(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    age = db.Column(db.Integer)
    gender = db.Column(db.String(20))
    blood_group = db.Column(db.String(10))
    chronic_conditions = db.Column(db.JSON)
    allergies = db.Column(db.JSON)
    medications = db.Column(db.JSON)
    emergency_contact = db.Column(db.JSON)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    type = db.Column(db.String(50))
    title = db.Column(db.String(200))
    message = db.Column(db.Text)
    scheduled_time = db.Column(db.DateTime)
    sent_time = db.Column(db.DateTime)
    status = db.Column(db.String(20))
    read = db.Column(db.Boolean, default=False)

with app.app_context():
    db.create_all()

scheduler = BackgroundScheduler()
scheduler.start()

class EnhancedDiseaseMatcher:
    def __init__(self, diseases):
        self.diseases = diseases
        self.symptom_index = self._build_symptom_index()
        self.disease_vectors = self._build_disease_vectors()
    
    def _build_symptom_index(self):
        symptom_index = {}
        for idx, disease in enumerate(self.diseases):
            for symptom in disease['symptoms']:
                symptom_lower = symptom.lower()
                if symptom_lower not in symptom_index:
                    symptom_index[symptom_lower] = []
                symptom_index[symptom_lower].append({
                    'disease_idx': idx,
                    'disease': disease['disease']
                })
        return symptom_index
    
    def _build_disease_vectors(self):
        vectors = {}
        all_symptoms = set()
        for disease in self.diseases:
            for symptom in disease['symptoms']:
                all_symptoms.add(symptom.lower())
        
        all_symptoms = list(all_symptoms)
        symptom_to_idx = {s: i for i, s in enumerate(all_symptoms)}
        
        for disease in self.diseases:
            vector = [0] * len(all_symptoms)
            for symptom in disease['symptoms']:
                vector[symptom_to_idx[symptom.lower()]] = 1
            vectors[disease['disease']] = vector
        
        return vectors
    
    def _fuzzy_match(self, user_symptom, symptom_list, threshold=80):
        matches = []
        for symptom in symptom_list:
            score = fuzz.ratio(user_symptom.lower(), symptom.lower())
            if score >= threshold:
                matches.append((symptom, score))
        return sorted(matches, key=lambda x: x[1], reverse=True)
    
    def _cosine_similarity(self, v1, v2):
        dot = np.dot(v1, v2)
        norm1 = np.linalg.norm(v1)
        norm2 = np.linalg.norm(v2)
        return dot / (norm1 * norm2) if norm1 and norm2 else 0
    
    def match_with_weights(self, user_symptoms, symptom_weights=None):
        if symptom_weights is None:
            symptom_weights = {s: 1.0 for s in user_symptoms}
        
        matches = []
        
        for disease in self.diseases:
            score = 0
            matched_symptoms = []
            
            for user_symptom, weight in symptom_weights.items():
                best_score = 0
                
                if user_symptom.lower() in [s.lower() for s in disease['symptoms']]:
                    best_score = 1.0
                else:
                    fuzzy_matches = self._fuzzy_match(user_symptom, disease['symptoms'], 70)
                    if fuzzy_matches:
                        best_score = fuzzy_matches[0][1] / 100.0
                
                if best_score > 0:
                    matched_symptoms.append(user_symptom)
                    score += best_score * weight
            
            if matched_symptoms:
                max_possible = sum(symptom_weights.values())
                normalized_score = (score / max_possible) * 100 if max_possible > 0 else 0
                
                severity_bonus = {
                    'high': 1.2, 'moderate': 1.1, 'mild': 1.0
                }.get(disease.get('severity', 'mild'), 1.0)
                
                final_score = min(100, normalized_score * severity_bonus)
                
                coverage = len(matched_symptoms) / len(disease['symptoms']) if disease['symptoms'] else 0
                confidence = min(100, final_score * 0.6 + coverage * 40)
                
                matches.append({
                    'disease': disease['disease'],
                    'match_score': round(final_score, 2),
                    'match_percentage': round(final_score),
                    'confidence': round(confidence, 2),
                    'matched_symptoms': matched_symptoms,
                    'severity': disease.get('severity', 'unknown'),
                    'category': disease.get('category', 'unknown'),
                    'medicine': disease.get('medicine', 'N/A'),
                    'advice': disease.get('advice', 'N/A'),
                    'prevention_tips': disease.get('prevention_tips', 'N/A'),
                    'specialist': disease.get('specialist', 'N/A'),
                    'symptoms': disease.get('symptoms', [])
                })
        
        matches.sort(key=lambda x: (x['match_score'], x['confidence']), reverse=True)
        return matches[:10]
    
    def vector_match(self, user_symptoms):
        if not self.disease_vectors:
            return []
        
        all_symptoms = list(set([s for d in self.diseases for s in d['symptoms']]))
        symptom_to_idx = {s.lower(): i for i, s in enumerate(all_symptoms)}
        
        user_vector = [0] * len(all_symptoms)
        for symptom in user_symptoms:
            if symptom.lower() in symptom_to_idx:
                user_vector[symptom_to_idx[symptom.lower()]] = 1
        
        similarities = []
        for disease_name, disease_vector in self.disease_vectors.items():
            similarity = self._cosine_similarity(user_vector, disease_vector)
            if similarity > 0:
                disease = next(d for d in self.diseases if d['disease'] == disease_name)
                similarities.append({
                    'disease': disease_name,
                    'match_score': round(similarity * 100, 2),
                    'match_percentage': round(similarity * 100),
                    'severity': disease.get('severity', 'unknown'),
                    'category': disease.get('category', 'unknown'),
                    'medicine': disease.get('medicine', 'N/A'),
                    'advice': disease.get('advice', 'N/A'),
                    'prevention_tips': disease.get('prevention_tips', 'N/A'),
                    'specialist': disease.get('specialist', 'N/A'),
                    'symptoms': disease.get('symptoms', [])
                })
        
        return sorted(similarities, key=lambda x: x['match_score'], reverse=True)[:5]

class ChatHistoryManager:
    def __init__(self):
        self.active_sessions = {}
    
    def create_session(self, session_id, user_id=None, device_info=None):
        session = ChatSession(
            session_id=session_id,
            user_id=user_id,
            device_info=device_info,
            start_time=datetime.utcnow()
        )
        db.session.add(session)
        db.session.commit()
        self.active_sessions[session_id] = session
        return session
    
    def add_message(self, session_id, user_msg, bot_msg, msg_type='symptom', sentiment=None, response_time=None):
        message = ChatMessage(
            session_id=session_id,
            user_message=user_msg,
            bot_response=bot_msg,
            message_type=msg_type,
            sentiment_score=sentiment,
            response_time=response_time,
            timestamp=datetime.utcnow()
        )
        db.session.add(message)
        db.session.commit()
        return message
    
    def log_search(self, session_id, symptoms, matches, top_match):
        search = DiseaseSearch(
            session_id=session_id,
            symptoms_input=symptoms,
            matched_diseases=matches,
            top_match=top_match,
            search_time=datetime.utcnow()
        )
        db.session.add(search)
        db.session.commit()
        return search
    
    def get_session_history(self, session_id):
        return ChatMessage.query.filter_by(session_id=session_id)\
            .order_by(ChatMessage.timestamp).all()
    
    def get_user_history(self, user_id, limit=50):
        sessions = ChatSession.query.filter_by(user_id=user_id)\
            .order_by(ChatSession.start_time.desc()).limit(10).all()
        
        history = []
        for session in sessions:
            messages = ChatMessage.query.filter_by(session_id=session.session_id)\
                .order_by(ChatMessage.timestamp).limit(limit).all()
            history.append({
                'session_id': session.session_id,
                'start_time': session.start_time,
                'messages': [{
                    'user': m.user_message,
                    'bot': m.bot_response,
                    'time': m.timestamp,
                    'type': m.message_type
                } for m in messages]
            })
        
        return history
    
    def get_analytics(self, days=30):
        since = datetime.utcnow() - timedelta(days=days)
        
        total_sessions = ChatSession.query.filter(ChatSession.start_time >= since).count()
        total_messages = ChatMessage.query.filter(ChatMessage.timestamp >= since).count()
        
        popular_searches = db.session.query(
            DiseaseSearch.top_match, 
            db.func.count(DiseaseSearch.top_match).label('count')
        ).filter(
            DiseaseSearch.search_time >= since
        ).group_by(
            DiseaseSearch.top_match
        ).order_by(
            db.desc('count')
        ).limit(10).all()
        
        all_symptoms = []
        searches = DiseaseSearch.query.filter(DiseaseSearch.search_time >= since).all()
        for search in searches:
            if search.symptoms_input:
                symptoms = search.symptoms_input.split(',')
                all_symptoms.extend([s.strip() for s in symptoms])
        
        symptom_counts = Counter(all_symptoms).most_common(10)
        
        return {
            'total_sessions': total_sessions,
            'total_messages': total_messages,
            'avg_messages_per_session': total_messages / total_sessions if total_sessions > 0 else 0,
            'popular_searches': [{'disease': s[0], 'count': s[1]} for s in popular_searches if s[0]],
            'popular_symptoms': [{'symptom': s[0], 'count': s[1]} for s in symptom_counts],
            'period_days': days
        }

class NotificationManager:
    def __init__(self):
        self.email_enabled = os.getenv('EMAIL_ENABLED', 'False').lower() == 'true'
        self.email_settings = {
            'smtp_server': os.getenv('SMTP_SERVER', 'smtp.gmail.com'),
            'smtp_port': int(os.getenv('SMTP_PORT', '587')),
            'username': os.getenv('EMAIL_USERNAME', ''),
            'password': os.getenv('EMAIL_PASSWORD', ''),
            'from_email': os.getenv('FROM_EMAIL', 'noreply@healthcarebot.com')
        }
    
    def send_email(self, to_email, subject, body):
        if not self.email_enabled:
            return {'status': 'disabled'}
        
        try:
            msg = MIMEMultipart()
            msg['From'] = self.email_settings['from_email']
            msg['To'] = to_email
            msg['Subject'] = subject
            msg.attach(MIMEText(body, 'plain'))
            
            server = smtplib.SMTP(self.email_settings['smtp_server'], self.email_settings['smtp_port'])
            server.starttls()
            server.login(self.email_settings['username'], self.email_settings['password'])
            server.send_message(msg)
            server.quit()
            
            return {'status': 'success'}
        except Exception as e:
            return {'status': 'error', 'message': str(e)}
    
    def schedule_notification(self, user_id, notif_type, title, message, scheduled_time, method='email'):
        notification = Notification(
            user_id=user_id,
            type=method,
            title=title,
            message=message,
            scheduled_time=scheduled_time,
            status='pending'
        )
        db.session.add(notification)
        db.session.commit()
        
        scheduler.add_job(
            func=self._send_scheduled,
            trigger='date',
            run_date=scheduled_time,
            args=[notification.id],
            id=f"notif_{notification.id}"
        )
        
        return notification
    
    def _send_scheduled(self, notification_id):
        notification = Notification.query.get(notification_id)
        if not notification or notification.status != 'pending':
            return
        
        user = User.query.get(notification.user_id)
        if not user or not user.notifications_enabled:
            notification.status = 'skipped'
            db.session.commit()
            return
        
        result = None
        if notification.type == 'email':
            result = self.send_email(user.email, notification.title, notification.message)
        
        notification.sent_time = datetime.utcnow()
        notification.status = 'sent' if result and result['status'] == 'success' else 'failed'
        db.session.commit()
    
    def create_medication_reminder(self, user_id, med_name, dosage, schedule_times, duration_days):
        reminders = []
        start_date = datetime.utcnow()
        
        for day in range(duration_days):
            for time in schedule_times:
                scheduled = start_date + timedelta(days=day)
                hour, minute = map(int, time.split(':'))
                scheduled = scheduled.replace(hour=hour, minute=minute, second=0)
                
                if scheduled > datetime.utcnow():
                    reminder = self.schedule_notification(
                        user_id=user_id,
                        notif_type='medication',
                        title=f'Medication Reminder: {med_name}',
                        message=f'Time to take {med_name} - {dosage}',
                        scheduled_time=scheduled,
                        method='email'
                    )
                    reminders.append(reminder)
        
        return reminders
    
    def create_appointment_reminder(self, user_id, doctor_name, appointment_time, location, notes=''):
        reminder_24h = appointment_time - timedelta(hours=24)
        if reminder_24h > datetime.utcnow():
            self.schedule_notification(
                user_id=user_id,
                notif_type='appointment',
                title=f'Appointment Reminder: Dr. {doctor_name}',
                message=f'Appointment tomorrow at {appointment_time.strftime("%I:%M %p")}\nLocation: {location}\n{notes}',
                scheduled_time=reminder_24h,
                method='email'
            )
        
        reminder_1h = appointment_time - timedelta(hours=1)
        if reminder_1h > datetime.utcnow():
            self.schedule_notification(
                user_id=user_id,
                notif_type='appointment',
                title=f'Appointment in 1 Hour: Dr. {doctor_name}',
                message=f'Appointment at {appointment_time.strftime("%I:%M %p")}\nLocation: {location}',
                scheduled_time=reminder_1h,
                method='email'
            )
    
    def send_health_tip(self, user_id, category='general'):
        tips = {
            'general': [
                "Drink 8 glasses of water daily",
                "Get 7-8 hours of sleep",
                "Exercise 30 minutes daily",
                "Wash hands frequently",
                "Take screen breaks every hour"
            ],
            'seasonal': [
                "Get your flu shot",
                "Stay hydrated in summer",
                "Use sunscreen daily",
                "Wear mask during flu season"
            ],
            'chronic': [
                "Monitor blood pressure regularly",
                "Take medications on time",
                "Keep a symptoms diary",
                "Attend follow-up appointments"
            ]
        }
        
        tip = np.random.choice(tips.get(category, tips['general']))
        
        return self.schedule_notification(
            user_id=user_id,
            notif_type='health_tip',
            title='Daily Health Tip',
            message=tip,
            scheduled_time=datetime.utcnow() + timedelta(hours=9),
            method='email'
        )

def load_diseases():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    disease_file = os.path.join(script_dir, "diseases.json")
    
    default_data = [
        {
            "disease": "Common Cold",
            "symptoms": ["runny nose", "sneezing", "cough", "sore throat", "congestion"],
            "severity": "mild",
            "category": "respiratory",
            "medicine": "Rest, fluids, over-the-counter cold medicines",
            "advice": "Rest, stay hydrated, use saline nasal spray",
            "prevention_tips": "Wash hands frequently, avoid close contact with sick people",
            "specialist": "Primary Care Physician"
        },
        {
            "disease": "Influenza",
            "symptoms": ["fever", "cough", "headache", "body aches", "fatigue", "chills"],
            "severity": "moderate",
            "category": "respiratory",
            "medicine": "Antiviral medications, pain relievers",
            "advice": "Rest, stay hydrated, isolate to prevent spread",
            "prevention_tips": "Annual flu vaccination, hand hygiene, avoid crowded places",
            "specialist": "Primary Care Physician"
        },
        {
            "disease": "Strep Throat",
            "symptoms": ["sore throat", "fever", "swollen lymph nodes", "difficulty swallowing"],
            "severity": "moderate",
            "category": "infectious",
            "medicine": "Antibiotics, pain relievers",
            "advice": "Complete full course of antibiotics, rest",
            "prevention_tips": "Hand washing, avoid sharing utensils",
            "specialist": "Primary Care Physician"
        },
        {
            "disease": "Gastroenteritis",
            "symptoms": ["nausea", "vomiting", "diarrhea", "stomach pain", "fever"],
            "severity": "moderate",
            "category": "gastrointestinal",
            "medicine": "Anti-diarrheal medication, electrolyte solutions",
            "advice": "Stay hydrated, rest, eat bland foods",
            "prevention_tips": "Frequent hand washing, proper food handling",
            "specialist": "Gastroenterology"
        }
    ]
    
    try:
        if os.path.exists(disease_file):
            with open(disease_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        else:
            with open(disease_file, 'w', encoding='utf-8') as f:
                json.dump(default_data, f, indent=2)
            return default_data
    except Exception as e:
        print(f"Error loading diseases: {e}")
        return default_data

diseases = load_diseases()
matcher = EnhancedDiseaseMatcher(diseases)
chat_history = ChatHistoryManager()
notifications = NotificationManager()

def clean_symptoms(text):
    if not text:
        return []
    
    text = text.lower().strip()
    symptoms = [s.strip() for s in text.split(',')] if ',' in text else text.split()
    
    filler_words = ['i have', 'i am feeling', 'i feel', 'suffering from', 'with', 'and', 'or']
    cleaned = []
    
    for s in symptoms:
        for word in filler_words:
            s = re.sub(r'\b' + word + r'\b', '', s)
        s = re.sub(r'[^\w\s-]', '', s).strip()
        if s and len(s) > 1:
            cleaned.append(s)
    
    return cleaned

def generate_session_id():
    timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S%f')
    random_part = hashlib.md5(os.urandom(32)).hexdigest()[:8]
    return f"session_{timestamp}_{random_part}"

def analyze_sentiment(text):
    positive = ['good', 'great', 'better', 'fine', 'ok', 'happy', 'well']
    negative = ['bad', 'worse', 'pain', 'hurt', 'sick', 'terrible', 'worried', 'scared']
    
    text_lower = text.lower()
    pos_count = sum(1 for word in positive if word in text_lower)
    neg_count = sum(1 for word in negative if word in text_lower)
    
    total = pos_count + neg_count
    return 0.5 if total == 0 else pos_count / total

def ensure_index_html():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    index_path = os.path.join(script_dir, "index.html")
    
    if not os.path.exists(index_path):
        html_content = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Healthcare Symptom Checker</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        h1 { color: #333; margin-bottom: 20px; text-align: center; }
        .input-section { margin-bottom: 30px; }
        label { display: block; margin-bottom: 8px; color: #555; font-weight: 500; }
        input {
            width: 100%;
            padding: 12px;
            border: 2px solid #ddd;
            border-radius: 8px;
            font-size: 16px;
            margin-bottom: 15px;
        }
        input:focus { outline: none; border-color: #667eea; }
        button {
            background: #667eea;
            color: white;
            border: none;
            padding: 12px 30px;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
            width: 100%;
        }
        button:hover { background: #764ba2; }
        .results {
            margin-top: 30px;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 8px;
            background: #f9f9f9;
        }
        .disease-card {
            background: white;
            border: 1px solid #eee;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
        }
        .disease-name { font-size: 18px; font-weight: bold; color: #333; margin-bottom: 10px; }
        .match-score { color: #667eea; font-weight: 500; margin-bottom: 10px; }
        .specialist { color: #28a745; font-weight: 500; }
        .warning {
            background: #fff3cd;
            color: #856404;
            padding: 10px;
            border-radius: 5px;
            margin-bottom: 20px;
            text-align: center;
        }
        .progress-bar {
            width: 100%;
            height: 10px;
            background: #f0f0f0;
            border-radius: 5px;
            margin: 10px 0;
        }
        .progress-fill {
            height: 10px;
            background: linear-gradient(90deg, #667eea, #764ba2);
            border-radius: 5px;
            transition: width 0.3s;
        }
        .status {
            text-align: center;
            padding: 10px;
            color: #28a745;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🏥 Healthcare Symptom Checker</h1>
        <div class="status" id="status">✅ Server Connected</div>
        <div class="warning">⚠️ This is not a real diagnosis. Please see a doctor for proper medical advice!</div>
        
        <div class="input-section">
            <label for="symptoms">Enter your symptoms (separate with commas):</label>
            <input type="text" id="symptoms" placeholder="e.g., fever, cough, headache">
            <button onclick="checkSymptoms()">Check Symptoms</button>
        </div>
        
        <div id="results" class="results" style="display: none;">
            <h3>Results:</h3>
            <div id="results-content"></div>
        </div>
    </div>

    <script>
        async function checkSymptoms() {
            const symptoms = document.getElementById('symptoms').value;
            const resultsDiv = document.getElementById('results');
            const resultsContent = document.getElementById('results-content');
            
            if (!symptoms.trim()) {
                alert('Please enter your symptoms');
                return;
            }
            
            resultsDiv.style.display = 'block';
            resultsContent.innerHTML = '<p>Loading...</p>';
            
            try {
                const response = await fetch('/predict', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ symptoms: symptoms })
                });
                
                const data = await response.json();
                
                if (data.error) {
                    resultsContent.innerHTML = `<p class="error">Error: ${data.error}</p>`;
                    return;
                }
                
                if (data.matches?.length > 0) {
                    let html = `<p>Found ${data.matches.length} possible conditions:</p>`;
                    data.matches.forEach(match => {
                        html += `
                            <div class="disease-card">
                                <div class="disease-name">${match.disease}</div>
                                <div class="match-score">Match: ${match.match_percentage}% (Confidence: ${match.confidence || 0}%)</div>
                                <div class="progress-bar"><div class="progress-fill" style="width: ${match.match_percentage}%"></div></div>
                                <div>Symptoms: ${match.symptoms.join(', ')}</div>
                                <div class="specialist">👨‍⚕️ Doctor: ${match.specialist}</div>
                                <div>💊 Medicine: ${match.medicine}</div>
                                <div>📝 Advice: ${match.advice}</div>
                            </div>
                        `;
                    });
                    resultsContent.innerHTML = html;
                } else {
                    resultsContent.innerHTML = '<p>No matching diseases found. Try different symptoms.</p>';
                }
            } catch (error) {
                resultsContent.innerHTML = `<p class="error">Error connecting to server</p>`;
            }
        }

        fetch('/health')
            .then(res => res.json())
            .then(data => {
                document.getElementById('status').textContent = `✅ Server Connected - ${data.disease_count} diseases loaded`;
            })
            .catch(() => {
                document.getElementById('status').textContent = '❌ Server Connection Failed';
                document.getElementById('status').style.color = '#dc3545';
            });
    </script>
</body>
</html>"""
        
        with open(index_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
    
    return index_path

@app.route('/')
def home():
    return send_file(ensure_index_html())

@app.route('/health')
def health_check():
    return jsonify({
        'status': 'running',
        'disease_count': len(diseases),
        'features': ['enhanced_matching', 'chat_history', 'notifications']
    })

@app.route('/api/session/start', methods=['POST'])
def start_session():
    try:
        data = request.get_json() or {}
        session_id = generate_session_id()
        session = chat_history.create_session(
            session_id, 
            data.get('user_id'),
            data.get('device_info', {})
        )
        return jsonify({'session_id': session_id, 'start_time': session.start_time})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/session/<session_id>/end', methods=['POST'])
def end_session(session_id):
    try:
        session = ChatSession.query.filter_by(session_id=session_id).first()
        if session:
            session.end_time = datetime.utcnow()
            db.session.commit()
            return jsonify({'message': 'Session ended'})
        return jsonify({'error': 'Session not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()
        symptoms_input = data.get('symptoms', '')
        session_id = data.get('session_id', generate_session_id())
        user_id = data.get('user_id')
        
        session = ChatSession.query.filter_by(session_id=session_id).first()
        if not session:
            session = chat_history.create_session(session_id, user_id)
        
        start_time = datetime.utcnow()
        user_symptoms = clean_symptoms(symptoms_input) if isinstance(symptoms_input, str) else symptoms_input
        
        if not user_symptoms:
            chat_history.add_message(session_id, str(symptoms_input), 'Please tell me your symptoms', 'question')
            return jsonify({'matches': [], 'message': 'Please tell me your symptoms', 'session_id': session_id})
        
        symptom_weights = {}
        for i, symptom in enumerate(user_symptoms):
            symptom_weights[symptom] = max(0.5, 1.0 - (i * 0.1))
        
        matches = matcher.match_with_weights(user_symptoms, symptom_weights)
        vector_matches = matcher.vector_match(user_symptoms)
        
        all_diseases = {m['disease']: m for m in matches}
        for vm in vector_matches:
            if vm['disease'] not in all_diseases:
                all_diseases[vm['disease']] = vm
        
        final_matches = sorted(
            all_diseases.values(), 
            key=lambda x: (x['match_score'], x.get('confidence', 0)), 
            reverse=True
        )[:10]
        
        top_match = final_matches[0]['disease'] if final_matches else None
        chat_history.log_search(
            session_id,
            ', '.join(user_symptoms),
            [m['disease'] for m in final_matches[:5]],
            top_match
        )
        
        sentiment = analyze_sentiment(str(symptoms_input))
        response_time = (datetime.utcnow() - start_time).total_seconds()
        
        chat_history.add_message(
            session_id,
            str(symptoms_input),
            json.dumps([m['disease'] for m in final_matches[:3]]),
            'symptom',
            sentiment,
            response_time
        )
        
        response = {
            'matches': final_matches,
            'user_symptoms': user_symptoms,
            'total_matches': len(final_matches),
            'session_id': session_id,
            'analytics': {'sentiment': sentiment, 'response_time': response_time}
        }
        
        if not final_matches:
            response['message'] = 'No matching diseases found. Try different symptoms.'
        
        return jsonify(response)
    
    except Exception as e:
        return jsonify({'error': str(e), 'matches': []}), 500

@app.route('/api/history/<session_id>', methods=['GET'])
def get_session_history(session_id):
    try:
        messages = chat_history.get_session_history(session_id)
        history = [{
            'user': m.user_message,
            'bot': m.bot_response,
            'time': m.timestamp,
            'type': m.message_type,
            'sentiment': m.sentiment_score
        } for m in messages]
        
        return jsonify({'session_id': session_id, 'messages': history, 'total': len(history)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/history/user/<int:user_id>', methods=['GET'])
def get_user_history(user_id):
    try:
        limit = request.args.get('limit', 50, type=int)
        return jsonify({'history': chat_history.get_user_history(user_id, limit)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/analytics', methods=['GET'])
def get_analytics():
    try:
        days = request.args.get('days', 30, type=int)
        return jsonify(chat_history.get_analytics(days))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/notifications/medication-reminder', methods=['POST'])
def create_medication_reminder():
    try:
        data = request.get_json()
        reminders = notifications.create_medication_reminder(
            user_id=data.get('user_id'),
            med_name=data.get('medication_name'),
            dosage=data.get('dosage'),
            schedule_times=data.get('schedule_times', []),
            duration_days=data.get('duration_days', 30)
        )
        return jsonify({'reminders_created': len(reminders)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/notifications/user/<int:user_id>', methods=['GET'])
def get_user_notifications(user_id):
    try:
        status = request.args.get('status')
        limit = request.args.get('limit', 50, type=int)
        
        query = Notification.query.filter_by(user_id=user_id)
        if status:
            query = query.filter_by(status=status)
        
        notifications = query.order_by(Notification.scheduled_time.desc()).limit(limit).all()
        
        result = [{
            'id': n.id,
            'title': n.title,
            'message': n.message,
            'scheduled_time': n.scheduled_time,
            'status': n.status,
            'read': n.read
        } for n in notifications]
        
        return jsonify({'notifications': result})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/notifications/<int:notification_id>/read', methods=['POST'])
def mark_notification_read(notification_id):
    try:
        notification = Notification.query.get(notification_id)
        if notification:
            notification.read = True
            db.session.commit()
            return jsonify({'message': 'Notification marked as read'})
        return jsonify({'error': 'Notification not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/insights/personalized/<int:user_id>', methods=['GET'])
def get_personalized_insights(user_id):
    try:
        sessions = ChatSession.query.filter_by(user_id=user_id).all()
        session_ids = [s.session_id for s in sessions]
        
        searches = DiseaseSearch.query.filter(
            DiseaseSearch.session_id.in_(session_ids)
        ).order_by(DiseaseSearch.search_time.desc()).limit(20).all()
        
        diseases_searched = [s.top_match for s in searches if s.top_match]
        disease_counts = Counter(diseases_searched)
        
        profile = UserHealthProfile.query.filter_by(user_id=user_id).first()
        
        insights = {
            'most_searched': disease_counts.most_common(5),
            'recent_searches': [{
                'disease': s.top_match,
                'symptoms': s.symptoms_input,
                'time': s.search_time
            } for s in searches[:5]],
            'recommendations': []
        }
        
        if profile and profile.chronic_conditions:
            for condition in profile.chronic_conditions:
                insights['recommendations'].append({
                    'type': 'monitoring',
                    'message': f'Regular monitoring recommended for {condition}'
                })
        
        current_month = datetime.utcnow().month
        seasonal = {
            1: ['Influenza', 'Common Cold'], 2: ['Influenza', 'Common Cold'],
            3: ['Allergies'], 4: ['Allergies'], 5: ['Allergies'],
            10: ['Influenza'], 11: ['Influenza'], 12: ['Influenza', 'Common Cold']
        }
        
        if current_month in seasonal:
            insights['seasonal_alerts'] = seasonal[current_month]
        
        return jsonify(insights)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/suggest', methods=['POST'])
def suggest():
    try:
        data = request.get_json()
        partial = data.get('text', '').lower().strip()
        
        if len(partial) < 2:
            return jsonify({'suggestions': []})
        
        all_symptoms = set()
        all_diseases = []
        
        for d in diseases:
            for symptom in d['symptoms']:
                all_symptoms.add(symptom.lower())
            all_diseases.append(d['disease'].lower())
        
        symptom_matches = process.extract(partial, all_symptoms, limit=5)
        disease_matches = process.extract(partial, all_diseases, limit=3)
        
        return jsonify({
            'suggestions': {
                'symptoms': [m[0] for m in symptom_matches if m[1] > 60],
                'diseases': [m[0] for m in disease_matches if m[1] > 60]
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.errorhandler(404)
def not_found(error):
    if request.path.startswith('/api/'):
        return jsonify({'error': 'Endpoint not found'}), 404
    return send_file(ensure_index_html())

def open_browser():
    import time
    time.sleep(1.5)
    try:
        webbrowser.open_new('http://127.0.0.1:5000')
    except:
        pass

if __name__ == '__main__':
    print('=' * 60)
    print('🚀 Healthcare Chatbot Starting...')
    print('=' * 60)
    print(f'📁 Diseases: {len(diseases)}')
    print(f'📁 Database: healthcare_chatbot.db')
    print('\n🌐 Server: http://127.0.0.1:5000')
    print('✅ Press CTRL+C to stop\n')
    
    threading.Thread(target=open_browser, daemon=True).start()
    app.run(debug=True, host='127.0.0.1', port=5000)