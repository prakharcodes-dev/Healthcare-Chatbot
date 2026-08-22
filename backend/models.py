from datetime import datetime
from backend.extensions import db

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    phone = db.Column(db.String(20))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    preferences = db.Column(db.JSON, default=dict)
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

class HealthLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, default=1)
    metric_type = db.Column(db.String(50), nullable=False) # temperature, weight, blood_pressure, blood_glucose
    value_primary = db.Column(db.Float, nullable=False)
    value_secondary = db.Column(db.Float, nullable=True) # Systolic/Diastolic for BP
    unit = db.Column(db.String(20), nullable=False)
    notes = db.Column(db.String(250), nullable=True)
    status = db.Column(db.String(50), nullable=True) # Normal, Elevated, High, Low
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

