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
    # Primary path: data/diseases.json
    disease_file = os.path.join(base_dir, "data", "diseases.json")
    # Fallback path: diseases.json at root
    fallback_file = os.path.join(base_dir, "diseases.json")
    
    if os.path.exists(disease_file):
        path_to_use = disease_file
    elif os.path.exists(fallback_file):
        path_to_use = fallback_file
    else:
        path_to_use = None
        
    if path_to_use:
        try:
            with open(path_to_use, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading disease file from {path_to_use}: {e}")
            
    # Default fallback data if no file is present
    return [
        {
            "disease": "Common Cold",
            "symptoms": ["runny nose", "sneezing", "cough", "sore throat", "congestion"],
            "severity": "mild",
            "category": "respiratory",
            "medicine": "Rest, fluids, cold medications",
            "advice": "Rest and stay hydrated",
            "prevention_tips": "Wash hands frequently",
            "specialist": "Primary Care Physician"
        }
    ]

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
