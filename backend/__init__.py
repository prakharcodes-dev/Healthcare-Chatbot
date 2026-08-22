import os
import json
from flask import Flask
from flask_cors import CORS
from backend.config import Config
from backend.extensions import db, scheduler
from backend.matcher import EnhancedDiseaseMatcher
from backend.history import ChatHistoryManager
from backend.notifications import NotificationManager

def load_diseases():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    disease_file = os.path.join(base_dir, "data", "diseases.json")
    fallback_file = os.path.join(base_dir, "diseases.json")
    
    if os.path.exists(disease_file):
        path_to_use = disease_file
    elif os.path.exists(fallback_file):
        path_to_use = fallback_file
    else:
        path_to_use = None
        
    raw_diseases = []
    if path_to_use:
        try:
            with open(path_to_use, 'r', encoding='utf-8') as f:
                raw_diseases = json.load(f)
        except Exception as e:
            print(f"Error loading disease file from {path_to_use}: {e}")
            
    if not raw_diseases:
        raw_diseases = [
            {
                "disease": "Common Cold",
                "symptoms": ["runny nose", "sneezing", "cough", "sore throat", "congestion"],
                "severity": "mild",
                "category": "Respiratory",
                "medicine": "Rest, fluids, OTC cold medications",
                "advice": "Rest, stay hydrated, use warm saline gargles.",
                "prevention_tips": "Wash hands frequently, avoid contact with sick individuals.",
                "specialist": "Primary Care Physician"
            }
        ]

    # Normalize each disease entry to guarantee 6 medical pillars:
    # Symptoms, Causes, Risk factors, Prevention, Treatment, When to seek medical care
    normalized = []
    for d in raw_diseases:
        cat = d.get('category', 'General Medical Condition')
        sev = d.get('severity', 'moderate').lower()
        spec = d.get('specialist', 'Primary Care Physician')
        symptoms_list = d.get('symptoms', [])
        symptoms_str = ", ".join(symptoms_list) if isinstance(symptoms_list, list) else str(symptoms_list)

        # 1. Causes
        causes = d.get('causes')
        if not causes:
            if 'bacterial' in cat.lower():
                causes = f"Bacterial pathogen infection affecting tissue or organ system. Pathogens disrupt cellular activity and trigger acute inflammatory cascades."
            elif 'viral' in cat.lower() or 'infection' in d.get('disease', '').lower():
                causes = f"Viral replication causing tissue inflammation, immune system response, and localized physiological dysfunction."
            elif 'autoimmune' in cat.lower():
                causes = f"Immune system dysregulation where healthy tissue is targeted by self-reactive autoantibodies or cytotoxic T cells."
            elif 'endocrine' in cat.lower() or 'hormone' in symptoms_str.lower():
                causes = f"Hormonal imbalance, glandular hyper/hyposecretion, or hormonal receptor insensitivity."
            elif 'cardiovascular' in cat.lower() or 'heart' in d.get('disease', '').lower():
                causes = f"Vascular dysfunction, arterial plaque buildup, structural cardiac changes, or hemodynamic strain."
            elif 'neurological' in cat.lower() or 'brain' in symptoms_str.lower():
                causes = f"Neuronal degeneration, neurotransmitter imbalance, or central/peripheral nerve pathway impairment."
            elif 'gastrointestinal' in cat.lower() or 'stomach' in symptoms_str.lower():
                causes = f"Gastrointestinal mucosal irritation, digestive enzyme alteration, motility disorder, or enteric flora disruption."
            elif 'dermatological' in cat.lower() or 'skin' in symptoms_str.lower():
                causes = f"Cutaneous inflammatory reaction, epidermal barrier breakdown, or dermal infection."
            else:
                causes = f"Multifactorial etiology involving physiological strain, biological dysregulation, or localized tissue response associated with {d.get('disease', 'the condition')}."

        # 2. Risk factors
        risk_factors = d.get('risk_factors')
        if not risk_factors:
            age_grp = d.get('age_group', 'all ages')
            risk_factors = f"Age considerations ({age_grp}), weakened immune response, pre-existing chronic conditions, environmental exposures, stress, and family history."

        # 3. Prevention
        prevention = d.get('prevention') or d.get('prevention_tips')
        if not prevention:
            prevention = f"Maintain overall good hygiene, follow healthy nutritional habits, schedule regular medical checkups, and avoid exposure to triggers."

        # 4. Treatment
        treatment = d.get('treatment')
        if not treatment:
            meds = d.get('medicine', 'Symptomatic treatment')
            adv = d.get('advice', 'Rest and adequate hydration')
            treatment = f"{meds}. General protocols: {adv}."

        # 5. When to seek medical care
        when_to_seek_care = d.get('when_to_seek_care')
        if not when_to_seek_care:
            if 'high' in sev or 'severe' in sev:
                when_to_seek_care = f"Seek medical care promptly if symptoms rapidly worsen, fever exceeds 102°F (38.9°C), severe pain occurs, or if you experience difficulty breathing. Consult a {spec}."
            else:
                when_to_seek_care = f"Seek medical care if symptoms persist beyond 5-7 days, gradually worsen, or interfere with daily activities. Consult a {spec}."

        d_norm = dict(d)
        d_norm['causes'] = causes
        d_norm['risk_factors'] = risk_factors
        d_norm['prevention'] = prevention
        d_norm['prevention_tips'] = prevention
        d_norm['treatment'] = treatment
        d_norm['when_to_seek_care'] = when_to_seek_care
        normalized.append(d_norm)

    return normalized


def create_app():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    template_dir = os.path.abspath(os.path.join(base_dir, 'frontend', 'templates'))
    static_dir = os.path.abspath(os.path.join(base_dir, 'frontend', 'static'))
    
    app = Flask(__name__, 
                template_folder=template_dir, 
                static_folder=static_dir, 
                static_url_path='/static')

    
    # Load configuration
    app.config.from_object(Config)
    
    # Enable CORS
    CORS(app, supports_credentials=True)
    
    # Initialize SQLAlchemy database
    db.init_app(app)
    
    # Initialize background scheduler
    if not scheduler.running:
        scheduler.start()
    
    # Load diseases and initialize services
    diseases = load_diseases()
    matcher = EnhancedDiseaseMatcher(diseases)
    chat_history = ChatHistoryManager()
    notifications = NotificationManager()
    
    # Save services in app configuration for route access
    app.config['DISEASES'] = diseases
    app.config['MATCHER'] = matcher
    app.config['CHAT_HISTORY'] = chat_history
    app.config['NOTIFICATIONS'] = notifications
    
    # Register API blueprint
    from backend.routes import api_bp
    app.register_blueprint(api_bp)
    
    # Create DB tables
    with app.app_context():
        db.create_all()
        
    return app
