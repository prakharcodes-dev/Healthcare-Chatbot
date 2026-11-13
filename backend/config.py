import os

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY')
    APP_ENV = os.getenv('APP_ENV', 'development').lower()
    BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    DATABASE_PATH = os.path.abspath(os.getenv('DATABASE_PATH') or os.path.join(BASE_DIR, 'instance', 'healthcare_chatbot.db'))
    SQLALCHEMY_DATABASE_URI = f"sqlite:///{DATABASE_PATH}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {'pool_pre_ping': True}
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    SESSION_COOKIE_SECURE = APP_ENV == 'production'
    CORS_ORIGINS = [origin.strip() for origin in os.getenv('CORS_ORIGINS', '').split(',') if origin.strip()]
