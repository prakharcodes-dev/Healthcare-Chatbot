"""Persistence adapter for chat sessions, messages, and disease searches."""
from datetime import datetime
from backend.extensions import db
from backend.models import ChatSession, ChatMessage, DiseaseSearch, UserHealthProfile

class ChatRepository:
    def _commit(self):
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
            raise

    def find_session(self, session_id):
        return ChatSession.query.filter_by(session_id=session_id).first()

    def create_session(self, session_id, user_id=None, device_info=None):
        row = ChatSession(session_id=session_id, user_id=user_id, device_info=device_info, start_time=datetime.utcnow())
        db.session.add(row)
        self._commit()
        return row

    def end_session(self, session):
        session.end_time = datetime.utcnow()
        self._commit()
        return session

    def add_message(self, session_id, user_msg, bot_msg, msg_type='symptom', sentiment=None, response_time=None):
        row = ChatMessage(session_id=session_id, user_message=user_msg, bot_response=bot_msg, message_type=msg_type, sentiment_score=sentiment, response_time=response_time, timestamp=datetime.utcnow())
        db.session.add(row)
        self._commit()
        return row

    def log_search(self, session_id, symptoms, matches, top_match):
        row = DiseaseSearch(session_id=session_id, symptoms_input=symptoms, matched_diseases=matches, top_match=top_match, search_time=datetime.utcnow())
        db.session.add(row)
        self._commit()
        return row

    def get_session_messages(self, session_id):
        return ChatMessage.query.filter_by(session_id=session_id).order_by(ChatMessage.timestamp).all()

    def get_recent_sessions(self, user_id, limit=10):
        return ChatSession.query.filter_by(user_id=user_id).order_by(ChatSession.start_time.desc()).limit(limit).all()

    def get_session_messages_limited(self, session_id, limit):
        return ChatMessage.query.filter_by(session_id=session_id).order_by(ChatMessage.timestamp).limit(limit).all()

    def get_analytics_data(self, since):
        total_sessions = ChatSession.query.filter(ChatSession.start_time >= since).count()
        total_messages = ChatMessage.query.filter(ChatMessage.timestamp >= since).count()
        popular = db.session.query(DiseaseSearch.top_match, db.func.count(DiseaseSearch.top_match).label('count')).filter(DiseaseSearch.search_time >= since).group_by(DiseaseSearch.top_match).order_by(db.desc('count')).limit(10).all()
        searches = DiseaseSearch.query.filter(DiseaseSearch.search_time >= since).all()
        return total_sessions, total_messages, popular, [s.symptoms_input for s in searches if s.symptoms_input]

    def get_personalized_data(self, user_id, limit=20):
        sessions = ChatSession.query.filter_by(user_id=user_id).all()
        session_ids = [row.session_id for row in sessions]
        searches = []
        if session_ids:
            searches = DiseaseSearch.query.filter(
                DiseaseSearch.session_id.in_(session_ids)
            ).order_by(DiseaseSearch.search_time.desc()).limit(limit).all()
        profile = UserHealthProfile.query.filter_by(user_id=user_id).first()
        return searches, profile
