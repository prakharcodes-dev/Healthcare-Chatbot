import os

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-key-change-in-production')
    # Resolve the database to the root folder's instance directory
    BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    SQLALCHEMY_DATABASE_URI = f"sqlite:///{os.path.join(BASE_DIR, 'instance', 'healthcare_chatbot.db')}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
