import json
from datetime import datetime
from collections import Counter
from flask import Blueprint, request, jsonify, current_app, render_template
from fuzzywuzzy import process
from backend.models import ChatSession, ChatMessage, DiseaseSearch, UserHealthProfile, Notification
from backend.utils import clean_symptoms, generate_session_id, analyze_sentiment
from backend.extensions import db

api_bp = Blueprint('api', __name__)

@api_bp.route('/')
def home():
    return render_template('index.html')

@api_bp.route('/health')
def health_check():
    diseases = current_app.config.get('DISEASES', [])
    return jsonify({
        'status': 'running',
        'disease_count': len(diseases),
        'features': ['enhanced_matching', 'chat_history', 'notifications', 'autocomplete']
    })

@api_bp.route('/api/session/start', methods=['POST'])
def start_session():
    try:
        data = request.get_json() or {}
        session_id = generate_session_id()
        chat_history = current_app.config['CHAT_HISTORY']
        session = chat_history.create_session(
            session_id, 
            data.get('user_id'),
            data.get('device_info', {})
        )
        return jsonify({'session_id': session_id, 'start_time': session.start_time.isoformat()})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api_bp.route('/api/session/<session_id>/end', methods=['POST'])
def end_session(session_id):
    try:
        session = ChatSession.query.filter_by(session_id=session_id).first()
        if session:
            session.end_time = datetime.utcnow()
            db.session.commit()
            return jsonify({'message': 'Session ended'})
        return jsonify({'error': 'Session not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api_bp.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()
        symptoms_input = data.get('symptoms', '')
        session_id = data.get('session_id', generate_session_id())
        user_id = data.get('user_id')
        
        chat_history = current_app.config['CHAT_HISTORY']
        matcher = current_app.config['MATCHER']
        
        session = ChatSession.query.filter_by(session_id=session_id).first()
        if not session:
            session = chat_history.create_session(session_id, user_id)
        
        start_time = datetime.utcnow()
        user_symptoms = clean_symptoms(symptoms_input) if isinstance(symptoms_input, str) else symptoms_input
        
        if not user_symptoms:
            chat_history.add_message(session_id, str(symptoms_input), 'Please tell me your symptoms', 'question')
            return jsonify({'matches': [], 'message': 'Please tell me your symptoms', 'session_id': session_id})
        
        symptom_weights = {}
        for i, symptom in enumerate(user_symptoms):
            symptom_weights[symptom] = max(0.5, 1.0 - (i * 0.1))
        
        matches = matcher.match_with_weights(user_symptoms, symptom_weights)
        vector_matches = matcher.vector_match(user_symptoms)
        
        all_diseases = {m['disease']: m for m in matches}
        for vm in vector_matches:
            if vm['disease'] not in all_diseases:
                all_diseases[vm['disease']] = vm
        
        final_matches = sorted(
            all_diseases.values(), 
            key=lambda x: (x['match_score'], x.get('confidence', 0)), 
            reverse=True
        )[:10]
        
        top_match = final_matches[0]['disease'] if final_matches else None
        chat_history.log_search(
            session_id,
            ', '.join(user_symptoms),
            [m['disease'] for m in final_matches[:5]],
            top_match
        )
        
        sentiment = analyze_sentiment(str(symptoms_input))
        response_time = (datetime.utcnow() - start_time).total_seconds()
        
        chat_history.add_message(
            session_id,
            str(symptoms_input),
            json.dumps([m['disease'] for m in final_matches[:3]]),
            'symptom',
            sentiment,
            response_time
        )
        
        response = {
            'matches': final_matches,
            'user_symptoms': user_symptoms,
            'total_matches': len(final_matches),
            'session_id': session_id,
            'analytics': {'sentiment': sentiment, 'response_time': response_time}
        }
        
        if not final_matches:
            response['message'] = 'No matching diseases found. Try different symptoms.'
        
        return jsonify(response)
    
    except Exception as e:
        return jsonify({'error': str(e), 'matches': []}), 500

@api_bp.route('/api/history/<session_id>', methods=['GET'])
def get_session_history(session_id):
    try:
        chat_history = current_app.config['CHAT_HISTORY']
        messages = chat_history.get_session_history(session_id)
        history = [{
            'user': m.user_message,
            'bot': m.bot_response,
            'time': m.timestamp.isoformat(),
            'type': m.message_type,
            'sentiment': m.sentiment_score
        } for m in messages]
        
        return jsonify({'session_id': session_id, 'messages': history, 'total': len(history)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api_bp.route('/api/history/user/<int:user_id>', methods=['GET'])
def get_user_history(user_id):
    try:
        chat_history = current_app.config['CHAT_HISTORY']
        limit = request.args.get('limit', 50, type=int)
        history = chat_history.get_user_history(user_id, limit)
        # Convert datetime objects to string representation
        for session in history:
            session['start_time'] = session['start_time'].isoformat()
            for msg in session['messages']:
                msg['time'] = msg['time'].isoformat()
        return jsonify({'history': history})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api_bp.route('/api/analytics', methods=['GET'])
def get_analytics():
    try:
        chat_history = current_app.config['CHAT_HISTORY']
        days = request.args.get('days', 30, type=int)
        return jsonify(chat_history.get_analytics(days))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api_bp.route('/api/notifications/medication-reminder', methods=['POST'])
def create_medication_reminder_route():
    try:
        data = request.get_json()
        notifications = current_app.config['NOTIFICATIONS']
        reminders = notifications.create_medication_reminder(
            user_id=data.get('user_id'),
            med_name=data.get('medication_name'),
            dosage=data.get('dosage'),
            schedule_times=data.get('schedule_times', []),
            duration_days=data.get('duration_days', 30)
        )
        return jsonify({'reminders_created': len(reminders)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api_bp.route('/api/notifications/user/<int:user_id>', methods=['GET'])
def get_user_notifications(user_id):
    try:
        status = request.args.get('status')
        limit = request.args.get('limit', 50, type=int)
        
        query = Notification.query.filter_by(user_id=user_id)
        if status:
            query = query.filter_by(status=status)
        
        notifications = query.order_by(Notification.scheduled_time.desc()).limit(limit).all()
        
        result = [{
            'id': n.id,
            'title': n.title,
            'message': n.message,
            'scheduled_time': n.scheduled_time.isoformat(),
            'status': n.status,
            'read': n.read
        } for n in notifications]
        
        return jsonify({'notifications': result})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api_bp.route('/api/notifications/<int:notification_id>/read', methods=['POST'])
def mark_notification_read(notification_id):
    try:
        notification = Notification.query.get(notification_id)
        if notification:
            notification.read = True
            db.session.commit()
            return jsonify({'message': 'Notification marked as read'})
        return jsonify({'error': 'Notification not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api_bp.route('/api/insights/personalized/<int:user_id>', methods=['GET'])
def get_personalized_insights(user_id):
    try:
        sessions = ChatSession.query.filter_by(user_id=user_id).all()
        session_ids = [s.session_id for s in sessions]
        
        searches = DiseaseSearch.query.filter(
            DiseaseSearch.session_id.in_(session_ids)
        ).order_by(DiseaseSearch.search_time.desc()).limit(20).all()
        
        diseases_searched = [s.top_match for s in searches if s.top_match]
        disease_counts = Counter(diseases_searched)
        
        profile = UserHealthProfile.query.filter_by(user_id=user_id).first()
        
        insights = {
            'most_searched': disease_counts.most_common(5),
            'recent_searches': [{
                'disease': s.top_match,
                'symptoms': s.symptoms_input,
                'time': s.search_time.isoformat()
            } for s in searches[:5]],
            'recommendations': []
        }
        
        if profile and profile.chronic_conditions:
            for condition in profile.chronic_conditions:
                insights['recommendations'].append({
                    'type': 'monitoring',
                    'message': f'Regular monitoring recommended for {condition}'
                })
        
        current_month = datetime.utcnow().month
        seasonal = {
            1: ['Influenza', 'Common Cold'], 2: ['Influenza', 'Common Cold'],
            3: ['Allergies'], 4: ['Allergies'], 5: ['Allergies'],
            10: ['Influenza'], 11: ['Influenza'], 12: ['Influenza', 'Common Cold']
        }
        
        if current_month in seasonal:
            insights['seasonal_alerts'] = seasonal[current_month]
        
        return jsonify(insights)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api_bp.route('/api/suggest', methods=['POST'])
def suggest():
    try:
        data = request.get_json() or {}
        partial = data.get('text', '').lower().strip()
        
        if len(partial) < 2:
            return jsonify({'suggestions': {'symptoms': [], 'diseases': []}})
        
        diseases = current_app.config.get('DISEASES', [])
        all_symptoms = set()
        all_diseases = []
        
        for d in diseases:
            for symptom in d['symptoms']:
                all_symptoms.add(symptom.lower())
            all_diseases.append(d['disease'].lower())
        
        symptom_matches = process.extract(partial, all_symptoms, limit=5)
        disease_matches = process.extract(partial, all_diseases, limit=3)
        
        return jsonify({
            'suggestions': {
                'symptoms': [m[0] for m in symptom_matches if m[1] > 60],
                'diseases': [m[0] for m in disease_matches if m[1] > 60]
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
