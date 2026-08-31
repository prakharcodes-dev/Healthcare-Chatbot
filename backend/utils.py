import re
import os
import hashlib
from datetime import datetime

TYPO_MAP = {
    'pian': 'pain',
    'pqain': 'pain',
    'paain': 'pain',
    'pinn': 'pain',
    'blede': 'bleed',
    'bleding': 'bleeding',
    'headace': 'headache',
    'headachee': 'headache',
    'nausia': 'nausea',
    'vomting': 'vomiting',
    'fevr': 'fever',
    'coug': 'cough',
    'coughingg': 'cough',
    'diziness': 'dizziness',
    'fatguing': 'fatigue',
    'chils': 'chills',
    'sweling': 'swelling',
    'stomachach': 'stomach ache',
}

def clean_symptoms(text):
    if not text:
        return []
    
    text = text.lower().strip()
    
    # Replace common known typo words
    for typo, correction in TYPO_MAP.items():
        text = re.sub(r'\b' + typo + r'\b', correction, text)
        
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

def detect_relevant_measurements(user_symptoms):
    """
    Analyzes extracted user symptoms and returns a list of relevant measurement types to request:
    ['temperature', 'blood_pressure', 'weight'].
    Returns empty list if no measurements are relevant.
    """
    s_text = " ".join([s.lower() for s in user_symptoms]) if isinstance(user_symptoms, list) else str(user_symptoms).lower()
    needed = []
    
    # Temperature triggers: fever, chills, hot, shivering, cold sweat, feverish, pyrexia, high temp
    temp_keywords = ['fever', 'chill', 'hot', 'shiver', 'cold sweat', 'feverish', 'pyrexia', 'temperature', 'warm']
    if any(k in s_text for k in temp_keywords):
        needed.append('temperature')
        
    # Blood pressure triggers: fainting, fainted, dizziness, dizzy, lightheaded, vertigo, pass out, passed out, syncope, bp, weakness, weak
    bp_keywords = ['faint', 'dizz', 'lighthead', 'vertigo', 'pass out', 'passed out', 'syncope', 'bp', 'pressure', 'weak']
    if any(k in s_text for k in bp_keywords):
        needed.append('blood_pressure')
        
    # Weight triggers: weight loss, weight gain, obesity, obese, underweight, anorexia, bariatric, slimming
    weight_keywords = ['weight', 'obese', 'obesity', 'skinny', 'underweight', 'slimming', 'anorexia']
    if any(k in s_text for k in weight_keywords):
        needed.append('weight')
        
    return needed

def check_urgent_safety_triggers(user_symptoms):
    """
    Identifies high-risk / emergency red-flag symptoms.
    """
    s_text = " ".join([s.lower() for s in user_symptoms]) if isinstance(user_symptoms, list) else str(user_symptoms).lower()
    urgent_keywords = [
        'faint', 'fainted', 'unconscious', 'loss of consciousness', 'pass out', 'passed out',
        'chest pain', 'severe breathing', 'difficulty breathing', 'shortness of breath',
        'severe bleeding', 'hemorrhage', 'confusion', 'seizure', 'convulsion'
    ]
    matched = [kw for kw in urgent_keywords if kw in s_text]
    return matched

def extract_inline_measurements(text):
    """
    Extracts temperature (°C or °F) or blood pressure (systolic/diastolic) directly from raw prompt text string using regex patterns.
    """
    if not text or not isinstance(text, str):
        return {}
        
    measurements = {}
    
    # Temperature regex e.g., 38.5 C, 101 F, 39C, temp 38.5, temperature 101.5
    temp_match = re.search(r'(\d{2,3}(?:\.\d)?)\s*(?:°?\s*([cCfF])\b|degrees?)', text, re.IGNORECASE)
    if temp_match:
        val = float(temp_match.group(1))
        unit = temp_match.group(2).upper() if temp_match.group(2) else ('F' if val > 50 else 'C')
        temp_c = round((val - 32) * 5/9, 1) if unit == 'F' or val > 70 else round(val, 1)
        if 30.0 <= temp_c <= 45.0:
            measurements['temperature'] = temp_c
            
    # Blood pressure regex e.g., 120/80, 110 / 70, BP 130/85
    bp_match = re.search(r'(\d{2,3})\s*[\/\\]\s*(\d{2,3})', text)
    if bp_match:
        sys_v = float(bp_match.group(1))
        dia_v = float(bp_match.group(2))
        if 50.0 <= sys_v <= 250.0 and 30.0 <= dia_v <= 150.0:
            measurements['bp_sys'] = sys_v
            measurements['bp_dia'] = dia_v
            
    # Weight regex e.g. 64kg, 64 kg, weight 75
    weight_match = re.search(r'(?:weight|wt)?\s*(\d{2,3}(?:\.\d)?)\s*(?:kg|kilos|kilograms)\b', text, re.IGNORECASE)
    if weight_match:
        wt_v = float(weight_match.group(1))
        if 1.0 <= wt_v <= 300.0:
            measurements['weight'] = wt_v
            
    return measurements



