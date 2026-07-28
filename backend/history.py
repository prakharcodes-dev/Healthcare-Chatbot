from datetime import datetime, timedelta
from collections import Counter
from backend.extensions import db
from backend.models import ChatSession, ChatMessage, DiseaseSearch

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
