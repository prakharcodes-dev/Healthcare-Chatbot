import re
import os
import hashlib
from datetime import datetime

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
