"""Chat application service: coordinates history use-cases and analytics."""
from datetime import datetime, timedelta
from collections import Counter
from backend.repositories.chat_repository import ChatRepository

class ChatHistoryManager:
    def __init__(self, repository=None):
        self.repository = repository or ChatRepository()

    def create_session(self, session_id, user_id=None, device_info=None):
        return self.repository.create_session(session_id, user_id, device_info)

    def add_message(self, session_id, user_msg, bot_msg, msg_type='symptom', sentiment=None, response_time=None):
        return self.repository.add_message(session_id, user_msg, bot_msg, msg_type, sentiment, response_time)

    def log_search(self, session_id, symptoms, matches, top_match):
        return self.repository.log_search(session_id, symptoms, matches, top_match)

    def get_session_history(self, session_id):
        return self.repository.get_session_messages(session_id)

    def get_user_history(self, user_id, limit=50):
        sessions = self.repository.get_recent_sessions(user_id, limit=10)
        history = []
        for session in sessions:
            messages = self.repository.get_session_messages_limited(session.session_id, limit)
            history.append({'session_id': session.session_id, 'start_time': session.start_time, 'messages': [{'user': m.user_message, 'bot': m.bot_response, 'time': m.timestamp, 'type': m.message_type} for m in messages]})
        return history

    def get_analytics(self, days=30):
        since = datetime.utcnow() - timedelta(days=days)
        total_sessions, total_messages, popular, inputs = self.repository.get_analytics_data(since)
        all_symptoms = [symptom.strip() for raw in inputs for symptom in raw.split(',') if symptom.strip()]
        symptom_counts = Counter(all_symptoms).most_common(10)
        return {'total_sessions': total_sessions, 'total_messages': total_messages, 'avg_messages_per_session': total_messages / total_sessions if total_sessions else 0, 'popular_searches': [{'disease': row[0], 'count': row[1]} for row in popular if row[0]], 'popular_symptoms': [{'symptom': row[0], 'count': row[1]} for row in symptom_counts], 'period_days': days}
