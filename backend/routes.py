import json
from datetime import datetime, timedelta
from collections import Counter
from flask import Blueprint, request, jsonify, current_app, render_template
from fuzzywuzzy import process
from backend.models import Notification, HealthLog, PatientMedicalProfile
from backend.extensions import db
from backend.utils import (
    generate_session_id, 
    analyze_sentiment, 
    detect_relevant_measurements, 
    check_urgent_safety_triggers,
    extract_inline_measurements
)
from backend.core.health_metrics import evaluate_health_metric_status
from backend.services.chat_response import build_structured_chat_response
from backend.services.symptom_assessment import SymptomAssessmentService
from backend.services.registry import get_services
from backend.reddis_metadata import save_session_metadata

api_bp = Blueprint('api', __name__)


PROFILE_FIELDS = {
    'patient_name', 'date_of_birth', 'gender', 'blood_group', 'height_cm', 'weight_kg',
    'allergies', 'operations', 'medical_history', 'conditions', 'medications',
    'family_history', 'disabilities', 'notes', 'emergency_contact_name',
    'emergency_contact_number', 'emergency_relationship'
}


@api_bp.route('/api/patient-profile', methods=['GET', 'PUT', 'PATCH'])
def patient_profile():
    """Manage the local workspace's single profile. No authentication is implemented."""
    profile = PatientMedicalProfile.query.get(1)
    if request.method == 'GET':
        return jsonify({'profile': profile.data if profile else {}, 'updated_at': profile.updated_at.isoformat() if profile and profile.updated_at else None})

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Please provide a valid profile object.'}), 400
    updates = {key: value for key, value in data.items() if key in PROFILE_FIELDS}
    if not updates:
        return jsonify({'error': 'No supported profile fields were provided.'}), 400
    for key in ('height_cm', 'weight_kg'):
        if key in updates and updates[key] not in (None, ''):
            try:
                value = float(updates[key])
                if not 0 < value <= (300 if key == 'height_cm' else 500):
                    raise ValueError()
                updates[key] = value
            except (TypeError, ValueError):
                return jsonify({'error': f'{"Height" if key == "height_cm" else "Weight"} must be a positive, valid measurement.'}), 400
    for key in ('allergies', 'operations', 'conditions', 'medications'):
        if key in updates and updates[key] not in (None, '') and not isinstance(updates[key], list):
            return jsonify({'error': f'{key.replace("_", " ").capitalize()} must be a list.'}), 400
    phone = updates.get('emergency_contact_number')
    if phone:
        import re
        if not re.fullmatch(r'\+?[0-9][0-9 ()-]{5,18}[0-9]', str(phone).strip()):
            return jsonify({'error': 'Enter a valid emergency contact number.'}), 400
        updates['emergency_contact_number'] = str(phone).strip()
    if profile is None:
        profile = PatientMedicalProfile(id=1, data={})
        db.session.add(profile)
    profile.data = {**(profile.data or {}), **updates}
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app.logger.exception('Patient profile save failed')
        return jsonify({'error': 'Unable to save the profile right now.'}), 500
    return jsonify({'profile': profile.data, 'updated_at': profile.updated_at.isoformat() if profile.updated_at else None})


@api_bp.route('/')
def home():
    return render_template('index.html')

@api_bp.route('/health')
def health_check():
    services = get_services(current_app._get_current_object())
    diseases = services.diseases
    return jsonify({
        'status': 'running',
        'disease_count': len(diseases),
        'category_count': len({d.get('category', '').strip().casefold() for d in diseases if d.get('category', '').strip()}),
        'features': ['enhanced_matching', 'chat_history', 'notifications', 'autocomplete', 'conditional_measurements']
    })

@api_bp.route('/api/session/start', methods=['POST'])
def start_session():
    try:
        data = request.get_json() or {}
        session_id = generate_session_id()
        chat_history = get_services(current_app._get_current_object()).chat_history
        session = chat_history.create_session(
            session_id, 
            data.get('user_id'),
            data.get('device_info', {})
        )
        save_session_metadata(session_id, 'active', 0, session.start_time.isoformat())
        return jsonify({'session_id': session_id, 'start_time': session.start_time.isoformat()})
    except Exception as e:
        current_app.logger.exception('Request processing failed')
        return jsonify({'error': 'Request failed'}), 500

@api_bp.route('/api/session/<session_id>/end', methods=['POST'])
def end_session(session_id):
    try:
        chat_history = get_services(current_app._get_current_object()).chat_history
        session = chat_history.repository.find_session(session_id)
        if session:
            chat_history.repository.end_session(session)
            save_session_metadata(
                session_id, 'ended', len(chat_history.get_session_history(session_id)),
                session.start_time.isoformat() if session.start_time else None
            )
            return jsonify({'message': 'Session ended'})
        return jsonify({'error': 'Session not found'}), 404
    except Exception as e:
        current_app.logger.exception('Request processing failed')
        return jsonify({'error': 'Request failed'}), 500

@api_bp.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json(silent=True)
        if data is None:
            return jsonify({'error': 'Invalid JSON request payload. Please provide a valid JSON object containing "symptoms".'}), 400

        symptoms_input = data.get('symptoms', '')
        session_id = data.get('session_id', generate_session_id())
        user_id = data.get('user_id', 1)
        
        services = get_services(current_app._get_current_object())
        chat_history = services.chat_history
        matcher = services.matcher
        
        session = chat_history.repository.find_session(session_id)
        if not session:
            session = chat_history.create_session(session_id, user_id)
            save_session_metadata(session_id, 'active', 0, session.start_time.isoformat())
        
        start_time = datetime.utcnow()
        assessment = SymptomAssessmentService().assess(symptoms_input, matcher)
        user_symptoms = list(assessment.report.positive)
        negated_symptoms = list(assessment.report.negated)
        
        if not user_symptoms:
            chat_history.add_message(session_id, str(symptoms_input), 'Please enter your symptoms to begin analysis.', 'question')
            save_session_metadata(session_id, 'active', len(chat_history.get_session_history(session_id)), session.start_time.isoformat())
            return jsonify({'matches': [], 'message': 'Please enter your symptoms to begin analysis.', 'session_id': session_id})
        
        needed_measurements = detect_relevant_measurements(user_symptoms)
        inline_m = extract_inline_measurements(symptoms_input) if isinstance(symptoms_input, str) else {}
        submitted_measurements = data.get('measurements') or {}
        if inline_m:
            submitted_measurements = {**inline_m, **submitted_measurements}
            
        skip_measurements = bool(data.get('skip_measurements'))
        urgent_flags = check_urgent_safety_triggers(user_symptoms)
        
        # Step 1: Check if measurements are relevant and user hasn't submitted or skipped them yet
        if needed_measurements and not submitted_measurements and not skip_measurements:
            return jsonify({
                'requested_measurements': needed_measurements,
                'user_symptoms': user_symptoms,
                'negated_symptoms': negated_symptoms,
                'session_id': session_id,
                'urgent_flags': urgent_flags,
                'message': 'To better understand your symptoms, please enter relevant health measurements if available.'
            })

            
        # Step 2: If measurements were submitted by the user, validate & save to HealthLog
        valid_measurements = {}
        measurement_logs = []
        if submitted_measurements and isinstance(submitted_measurements, dict):
            s_str = ", ".join(user_symptoms)
            
            # 1. Temperature
            if 'temperature' in submitted_measurements and submitted_measurements['temperature'] is not None:
                try:
                    val_t = float(submitted_measurements['temperature'])
                    # Auto-convert if entered in °F (> 70)
                    temp_c = round((val_t - 32) * 5/9, 1) if val_t > 70 else round(val_t, 1)
                    if 30.0 <= temp_c <= 45.0:
                        valid_measurements['temperature'] = temp_c
                        st_t = evaluate_health_metric_status('temperature', temp_c * 9/5 + 32)
                        log_t = HealthLog(
                            user_id=user_id or 1,
                            metric_type='temperature',
                            value_primary=temp_c,
                            unit='°C',
                            notes=f"Symptom check: {s_str}",
                            status=st_t,
                            timestamp=datetime.utcnow()
                        )
                        measurement_logs.append(log_t)
                except (ValueError, TypeError):
                    pass

            # 2. Blood Pressure
            if 'bp_sys' in submitted_measurements and submitted_measurements['bp_sys'] is not None:
                try:
                    val_sys = float(submitted_measurements['bp_sys'])
                    val_dia = float(submitted_measurements.get('bp_dia', 80)) if submitted_measurements.get('bp_dia') else 80.0
                    if 50.0 <= val_sys <= 250.0 and 30.0 <= val_dia <= 150.0:
                        valid_measurements['bp_sys'] = val_sys
                        valid_measurements['bp_dia'] = val_dia
                        st_bp = evaluate_health_metric_status('blood_pressure', val_sys, val_dia)
                        log_bp = HealthLog(
                            user_id=user_id or 1,
                            metric_type='blood_pressure',
                            value_primary=val_sys,
                            value_secondary=val_dia,
                            unit='mmHg',
                            notes=f"Symptom check: {s_str}",
                            status=st_bp,
                            timestamp=datetime.utcnow()
                        )
                        measurement_logs.append(log_bp)
                except (ValueError, TypeError):
                    pass

            # 3. Weight
            if 'weight' in submitted_measurements and submitted_measurements['weight'] is not None:
                try:
                    val_wt = float(submitted_measurements['weight'])
                    if 1.0 <= val_wt <= 300.0:
                        valid_measurements['weight'] = round(val_wt, 1)
                        log_wt = HealthLog(
                            user_id=user_id or 1,
                            metric_type='weight',
                            value_primary=round(val_wt, 1),
                            unit='kg',
                            notes=f"Symptom check: {s_str}",
                            status='Normal',
                            timestamp=datetime.utcnow()
                        )
                        measurement_logs.append(log_wt)
                except (ValueError, TypeError):
                    pass

            if measurement_logs:
                services.health_logs.add_many(measurement_logs)

        # Matching is orchestrated by a framework-independent service.
        final_matches = list(assessment.matches)

        top_match = final_matches[0]['disease'] if final_matches else None
        chat_history.log_search(
            session_id,
            ', '.join(user_symptoms),
            [m['disease'] for m in final_matches[:5]],
            top_match
        )
        
        structured_resp = build_structured_chat_response(
            user_symptoms, 
            final_matches, 
            user_measurements=valid_measurements if valid_measurements else None,
            urgent_flags=urgent_flags
        )
        sentiment = analyze_sentiment(str(symptoms_input))
        response_time = (datetime.utcnow() - start_time).total_seconds()
        
        chat_history.add_message(
            session_id,
            str(symptoms_input),
            json.dumps(structured_resp),
            'symptom',
            sentiment,
            response_time
        )
        save_session_metadata(session_id, 'active', len(chat_history.get_session_history(session_id)), session.start_time.isoformat())
        
        response = {
            'matches': final_matches,
            'structured_response': structured_resp,
            'user_symptoms': user_symptoms,
            'negated_symptoms': negated_symptoms,
            'total_matches': len(final_matches),
            'session_id': session_id,
            'analytics': {'sentiment': sentiment, 'response_time': response_time}
        }
        
        if not final_matches:
            response['message'] = 'No matching conditions found. Try different symptoms.'
        
        return jsonify(response)
    
    except Exception as e:
        current_app.logger.exception('Request processing failed')
        return jsonify({'error': 'Request failed', 'matches': []}), 500



@api_bp.route('/api/history/<session_id>', methods=['GET'])
def get_session_history(session_id):
    try:
        chat_history = get_services(current_app._get_current_object()).chat_history
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
        current_app.logger.exception('Request processing failed')
        return jsonify({'error': 'Request failed'}), 500

@api_bp.route('/api/history/user/<int:user_id>', methods=['GET'])
def get_user_history(user_id):
    try:
        chat_history = get_services(current_app._get_current_object()).chat_history
        limit = request.args.get('limit', 50, type=int)
        history = chat_history.get_user_history(user_id, limit)
        # Convert datetime objects to string representation
        for session in history:
            session['start_time'] = session['start_time'].isoformat()
            for msg in session['messages']:
                msg['time'] = msg['time'].isoformat()
        return jsonify({'history': history})
    except Exception as e:
        current_app.logger.exception('Request processing failed')
        return jsonify({'error': 'Request failed'}), 500

@api_bp.route('/api/analytics', methods=['GET'])
def get_analytics():
    try:
        chat_history = get_services(current_app._get_current_object()).chat_history
        days = request.args.get('days', 30, type=int)
        return jsonify(chat_history.get_analytics(days))
    except Exception as e:
        current_app.logger.exception('Request processing failed')
        return jsonify({'error': 'Request failed'}), 500

@api_bp.route('/api/notifications/medication-reminder', methods=['POST'])
def create_medication_reminder_route():
    try:
        data = request.get_json()
        notifications = get_services(current_app._get_current_object()).notifications
        reminders = notifications.create_medication_reminder(
            user_id=data.get('user_id'),
            med_name=data.get('medication_name'),
            dosage=data.get('dosage'),
            schedule_times=data.get('schedule_times', []),
            duration_days=data.get('duration_days', 30)
        )
        return jsonify({'reminders_created': len(reminders)})
    except Exception as e:
        current_app.logger.exception('Request processing failed')
        return jsonify({'error': 'Request failed'}), 500

@api_bp.route('/api/notifications/user/<int:user_id>', methods=['GET'])
def get_user_notifications(user_id):
    try:
        status = request.args.get('status')
        limit = request.args.get('limit', 50, type=int)
        
        notifications = get_services(current_app._get_current_object()).notification_records.list_for_user(
            user_id, status=status, limit=limit
        )
        
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
        current_app.logger.exception('Request processing failed')
        return jsonify({'error': 'Request failed'}), 500

@api_bp.route('/api/notifications/<int:notification_id>/read', methods=['POST'])
def mark_notification_read(notification_id):
    try:
        notification_repo = get_services(current_app._get_current_object()).notification_records
        notification = notification_repo.get(notification_id)
        if notification:
            notification.read = True
            notification_repo.save()
            return jsonify({'message': 'Notification marked as read'})
        return jsonify({'error': 'Notification not found'}), 404
    except Exception as e:
        current_app.logger.exception('Request processing failed')
        return jsonify({'error': 'Request failed'}), 500

@api_bp.route('/api/insights/personalized/<int:user_id>', methods=['GET'])
def get_personalized_insights(user_id):
    try:
        searches, profile = get_services(current_app._get_current_object()).chat_history.repository.get_personalized_data(user_id)
        
        diseases_searched = [s.top_match for s in searches if s.top_match]
        disease_counts = Counter(diseases_searched)
        
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
        current_app.logger.exception('Request processing failed')
        return jsonify({'error': 'Request failed'}), 500

@api_bp.route('/api/suggest', methods=['POST'])
def suggest():
    try:
        data = request.get_json() or {}
        partial = data.get('text', '').lower().strip()
        
        if len(partial) < 2:
            return jsonify({'suggestions': {'symptoms': [], 'diseases': []}})
        
        diseases = get_services(current_app._get_current_object()).diseases
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
        current_app.logger.exception('Request processing failed')
        return jsonify({'error': 'Request failed'}), 500


# ==========================================================================
# 🧠 Better Medical Knowledge Search API Routes
# ==========================================================================

@api_bp.route('/api/knowledge/search', methods=['POST'])
def search_medical_knowledge():
    try:
        data = request.get_json() or {}
        query = data.get('query', '').strip()
        category = data.get('category', '').strip().lower()
        limit = int(data.get('limit', 12))

        
        diseases = get_services(current_app._get_current_object()).diseases
        
        if not query and not category:
            return jsonify({'results': diseases[:limit], 'total': len(diseases)})
            
        filtered = diseases
        if category:
            filtered = [d for d in filtered if category in d.get('category', '').lower()]
            
        if not query:
            return jsonify({'results': filtered[:limit], 'total': len(filtered)})
            
        results = []
        query_lower = query.lower()
        
        for d in filtered:
            score = 0
            d_name = d['disease'].lower()
            symptoms = [s.lower() for s in d.get('symptoms', [])]
            causes = d.get('causes', '').lower()
            risk_factors = d.get('risk_factors', '').lower()
            
            if query_lower == d_name:
                score += 100
            elif query_lower in d_name:
                score += 75
            
            if any(query_lower in s for s in symptoms):
                score += 50
                
            if query_lower in causes:
                score += 30
                
            if query_lower in risk_factors:
                score += 20
                
            if score > 0:
                results.append((d, score))
                
        if len(results) < 3:
            all_names = {d['disease'].lower(): d for d in filtered}
            fuzzy_matches = process.extract(query_lower, list(all_names.keys()), limit=5)
            for fm in fuzzy_matches:
                if fm[1] > 60 and all_names[fm[0]] not in [r[0] for r in results]:
                    results.append((all_names[fm[0]], fm[1]))
                    
        results.sort(key=lambda x: x[1], reverse=True)
        final_list = [r[0] for r in results[:limit]]
        
        return jsonify({'results': final_list, 'total': len(final_list), 'query': query})
    except Exception as e:
        current_app.logger.exception('Request processing failed')
        return jsonify({'error': 'Request failed'}), 500


@api_bp.route('/api/knowledge/<disease_name>', methods=['GET'])
def get_disease_knowledge(disease_name):
    try:
        diseases = get_services(current_app._get_current_object()).diseases
        d_name_clean = disease_name.strip().lower()
        
        for d in diseases:
            if d['disease'].lower() == d_name_clean:
                return jsonify({'disease': d})
                
        all_names = {d['disease'].lower(): d for d in diseases}
        match = process.extractOne(d_name_clean, list(all_names.keys()))
        if match and match[1] > 70:
            return jsonify({'disease': all_names[match[0]]})
            
        return jsonify({'error': 'Disease not found'}), 404
    except Exception as e:
        current_app.logger.exception('Request processing failed')
        return jsonify({'error': 'Request failed'}), 500


# ==========================================================================
# 📊 Health Trend Tracking API Routes
# ==========================================================================

def generate_vitals_clinical_assessment(summary_data, single_log=None):
    statuses = []
    
    for metric, data in summary_data.items():
        if data.get('latest'):
            st = data['latest'].get('status', 'Normal')
            statuses.append(st)
            
    is_high = any('High' in s for s in statuses)
    is_elevated = any('Elevated' in s for s in statuses)
    is_low = any('Low' in s for s in statuses)
    
    if is_high:
        verdict_status = 'Attention Required'
        verdict_icon = 'fa-triangle-exclamation'
        verdict_class = 'status-high'
        verdict_title = 'Attention Required: Elevated Vital Readings Detected ⚠️'
        verdict_message = 'One or more of your recent vital readings are higher than standard target thresholds. Please rest quietly, stay hydrated, and consult your primary physician if readings remain high.'
    elif is_elevated or is_low:
        verdict_status = 'Mild Variation'
        verdict_icon = 'fa-circle-info'
        verdict_class = 'status-elevated'
        verdict_title = 'Mild Variation Detected: Generally Stable 👍'
        verdict_message = 'Your vitals show mild variation from baseline levels, but your overall condition is stable and manageable. Continue monitoring over the next 24 hours.'
    elif len(statuses) > 0:
        verdict_status = 'Good & Stable'
        verdict_icon = 'fa-circle-check'
        verdict_class = 'status-normal'
        verdict_title = 'Your Vitals Look Great! Condition is Normal & Good 👍'
        verdict_message = 'All your recorded health vitals (Body Temperature, Weight, Blood Pressure, and Blood Glucose) are in healthy, safe, and optimal target ranges. There is no cause for concern!'
    else:
        verdict_status = 'No Data Yet'
        verdict_icon = 'fa-heart-pulse'
        verdict_class = 'status-normal'
        verdict_title = 'Welcome to Health Trend Tracker 📊'
        verdict_message = 'Record your vital readings above (Temperature, Weight, Blood Pressure, Blood Glucose) to generate immediate clinical feedback and trend analysis.'

    single_feedback = None
    if single_log:
        mtype = single_log.get('metric_type', '').lower()
        val_pri = single_log.get('value_primary')
        val_sec = single_log.get('value_secondary')
        unit = single_log.get('unit', '')
        st = single_log.get('status', 'Normal')
        
        if mtype == 'temperature':
            if st == 'Normal':
                single_feedback = f"Body Temperature ({val_pri} {unit}) is in the ideal normal range (97.0-99.5°F). Your condition is good — nothing to worry about!"
            elif st == 'Elevated':
                single_feedback = f"Body Temperature ({val_pri} {unit}) indicates a low-grade fever. Rest, stay hydrated with fluids, and monitor symptoms."
            elif st == 'High':
                single_feedback = f"Body Temperature ({val_pri} {unit}) indicates a high fever! Rest, apply cool compresses, and consult a physician if fever persists."
            else:
                single_feedback = f"Body Temperature ({val_pri} {unit}) recorded successfully."
        elif mtype == 'blood_pressure':
            bp_str = f"{val_pri}/{val_sec}" if val_sec else f"{val_pri}"
            if st == 'Normal':
                single_feedback = f"Blood Pressure ({bp_str} {unit}) is optimal and healthy (<120/80 mmHg). Your condition is good & normal!"
            elif st == 'Elevated':
                single_feedback = f"Blood Pressure ({bp_str} {unit}) is slightly elevated. Rest quietly for 10 minutes and reduce dietary sodium."
            else:
                single_feedback = f"Blood Pressure ({bp_str} {unit}) is elevated ({st}). Rest, avoid stress, and consult your physician if readings stay high."
        elif mtype == 'blood_glucose':
            if st == 'Normal':
                single_feedback = f"Blood Glucose ({val_pri} {unit}) is in the normal fasting range (70-99 mg/dL). Excellent glycemic control!"
            elif st == 'Low':
                single_feedback = f"Blood Glucose ({val_pri} {unit}) is low (<70 mg/dL). Consume fast-acting carbohydrates (juice/fruit) and re-check in 15 mins."
            else:
                single_feedback = f"Blood Glucose ({val_pri} {unit}) is elevated ({st}). Stay hydrated, follow dietary guidelines, and monitor your levels."
        elif mtype == 'weight':
            single_feedback = f"Body Weight ({val_pri} {unit}) recorded successfully. Regular tracking helps monitor body composition trends over time!"

    return {
        'status': verdict_status,
        'icon': verdict_icon,
        'css_class': verdict_class,
        'title': verdict_title,
        'message': verdict_message,
        'single_feedback': single_feedback
    }


@api_bp.route('/api/health-trends/log', methods=['POST'])
def add_health_log():
    try:
        data = request.get_json() or {}
        user_id = data.get('user_id', 1)
        metric_type = data.get('metric_type', '').lower().strip()
        val_pri = float(data.get('value_primary', 0))
        val_sec = float(data['value_secondary']) if data.get('value_secondary') is not None and str(data.get('value_secondary')).strip() != '' else None
        unit = data.get('unit', '')
        notes = data.get('notes', '')
        
        if not metric_type or val_pri <= 0:

            return jsonify({'error': 'Invalid metric type or reading value'}), 400
            
        status = evaluate_health_metric_status(metric_type, val_pri, val_sec)
        
        log_entry = HealthLog(
            user_id=user_id,
            metric_type=metric_type,
            value_primary=val_pri,
            value_secondary=val_sec,
            unit=unit,
            notes=notes,
            status=status,
            timestamp=datetime.utcnow()
        )
        health_logs = get_services(current_app._get_current_object()).health_logs
        health_logs.add(log_entry)

        log_dict = {
            'id': log_entry.id,
            'metric_type': log_entry.metric_type,
            'value_primary': log_entry.value_primary,
            'value_secondary': log_entry.value_secondary,
            'unit': log_entry.unit,
            'status': log_entry.status,
            'notes': log_entry.notes,
            'timestamp': log_entry.timestamp.isoformat()
        }
        
        # Build summary data for assessment
        metrics = ['temperature', 'weight', 'blood_pressure', 'blood_glucose']
        summary_temp = {}
        for m in metrics:
            logs = health_logs.latest_for_user(user_id, m, limit=1)
            if logs:
                summary_temp[m] = {'latest': {'status': logs[0].status, 'val_pri': logs[0].value_primary}}
            else:
                summary_temp[m] = {'latest': None}
                
        assessment = generate_vitals_clinical_assessment(summary_temp, log_dict)
        
        return jsonify({
            'message': 'Health log recorded successfully',
            'log': log_dict,
            'assessment': assessment
        })
    except Exception as e:
        current_app.logger.exception('Request processing failed')
        return jsonify({'error': 'Request failed'}), 500


@api_bp.route('/api/health-trends/user/<int:user_id>', methods=['GET'])
def get_user_health_logs(user_id):
    try:
        metric_type = request.args.get('metric_type')
        limit = request.args.get('limit', 100, type=int)
        
        logs = get_services(current_app._get_current_object()).health_logs.list_for_user(
            user_id, metric_type.lower() if metric_type else None, limit
        )
        
        result = [{
            'id': l.id,
            'metric_type': l.metric_type,
            'value_primary': l.value_primary,
            'value_secondary': l.value_secondary,
            'unit': l.unit,
            'status': l.status,
            'notes': l.notes,
            'timestamp': l.timestamp.isoformat()
        } for l in logs]
        
        return jsonify({'logs': result, 'total': len(result)})
    except Exception as e:
        current_app.logger.exception('Request processing failed')
        return jsonify({'error': 'Request failed'}), 500


@api_bp.route('/api/health-trends/<int:log_id>', methods=['DELETE'])
def delete_health_log(log_id):
    try:
        health_logs = get_services(current_app._get_current_object()).health_logs
        log_entry = health_logs.get(log_id)
        if log_entry:
            health_logs.delete(log_entry)
            return jsonify({'message': 'Health log deleted'})
        return jsonify({'error': 'Log entry not found'}), 404
    except Exception as e:
        current_app.logger.exception('Request processing failed')
        return jsonify({'error': 'Request failed'}), 500


@api_bp.route('/api/health-trends/summary/<int:user_id>', methods=['GET'])
def get_health_trends_summary(user_id):
    try:
        metrics = ['temperature', 'weight', 'blood_pressure', 'blood_glucose']
        summary = {}
        
        for m in metrics:
            logs = get_services(current_app._get_current_object()).health_logs.list_for_user(user_id, m)
            if logs:
                latest = logs[0]
                prev = logs[1] if len(logs) > 1 else None
                
                delta = None
                if prev:
                    delta = round(latest.value_primary - prev.value_primary, 2)
                    
                history = [{
                    'id': l.id,
                    'value_primary': l.value_primary,
                    'value_secondary': l.value_secondary,
                    'status': l.status,
                    'time': l.timestamp.strftime('%b %d, %H:%M')
                } for l in reversed(logs[:10])]
                
                summary[m] = {
                    'latest': {
                        'id': latest.id,
                        'val_pri': latest.value_primary,
                        'val_sec': latest.value_secondary,
                        'unit': latest.unit,
                        'status': latest.status,
                        'notes': latest.notes,
                        'time': latest.timestamp.isoformat()
                    },
                    'delta': delta,
                    'count': len(logs),
                    'history': history
                }
            else:
                summary[m] = {'latest': None, 'count': 0, 'history': []}
                
        assessment = generate_vitals_clinical_assessment(summary)
        
        return jsonify({
            'summary': summary, 
            'assessment': assessment,
            'user_id': user_id
        })
    except Exception as e:
        current_app.logger.exception('Request processing failed')
        return jsonify({'error': 'Request failed'}), 500


# ==========================================================================
# ⏰ Medication Reminders & Due Notification API Routes
# ==========================================================================

@api_bp.route('/api/reminders/due', methods=['GET'])
def get_due_reminders():
    """
    Returns pending notifications whose scheduled time has arrived or passed.
    """
    try:
        user_id = request.args.get('user_id', 1, type=int)
        now = datetime.utcnow()
        
        # Check notifications due up to now (or within last 24h)
        notification_repo = get_services(current_app._get_current_object()).notification_records
        due_list = notification_repo.list_due(user_id, now)
        
        result = []
        for n in due_list:
            n.status = 'sent'
            n.sent_time = now
            result.append({
                'id': n.id,
                'title': n.title,
                'message': n.message,
                'type': n.type,
                'scheduled_time': n.scheduled_time.isoformat()
            })
            
        if due_list:
            notification_repo.save()
            
        return jsonify({'due_reminders': result, 'count': len(result)})
    except Exception as e:
        current_app.logger.exception('Request processing failed')
        return jsonify({'error': 'Request failed', 'due_reminders': []}), 500


@api_bp.route('/api/reminders/active', methods=['GET'])
def get_active_reminders():
    """
    Returns all pending future medication reminders for the user.
    """
    try:
        user_id = request.args.get('user_id', 1, type=int)
        pending = get_services(current_app._get_current_object()).notification_records.list_for_user(
            user_id, status='pending', ascending=True
        )
            
        result = [{
            'id': n.id,
            'title': n.title,
            'message': n.message,
            'type': n.type,
            'scheduled_time': n.scheduled_time.isoformat(),
            'time_formatted': n.scheduled_time.strftime('%H:%M')
        } for n in pending]
        
        return jsonify({'reminders': result, 'count': len(result)})
    except Exception as e:
        current_app.logger.exception('Request processing failed')
        return jsonify({'error': 'Request failed', 'reminders': []}), 500


@api_bp.route('/api/reminders/create', methods=['POST'])
def create_reminder():
    """
    Creates a new scheduled medication reminder.
    """
    try:
        data = request.get_json() or {}
        user_id = data.get('user_id', 1)
        med_name = data.get('med_name', 'Medication')
        dosage = data.get('dosage', '1 tablet')
        time_str = data.get('time', '09:00') # HH:MM
        duration_days = int(data.get('duration_days', 30))

        # Validate time format before splitting to avoid cryptic 500 errors
        parts = str(time_str).split(':')
        if len(parts) != 2 or not parts[0].isdigit() or not parts[1].isdigit():
            return jsonify({'error': 'Invalid time format. Expected HH:MM (e.g. "09:30").'}), 400
        hour, minute = int(parts[0]), int(parts[1])
        if not (0 <= hour <= 23 and 0 <= minute <= 59):
            return jsonify({'error': 'Invalid time value. Hour must be 0-23 and minute 0-59.'}), 400

        now = datetime.utcnow()
        
        reminders_created = []
        for day in range(min(duration_days, 30)):
            scheduled_date = now.replace(hour=hour, minute=minute, second=0, microsecond=0) + timedelta(days=day)
            if scheduled_date <= now:
                scheduled_date += timedelta(days=1)
                
            notif = Notification(
                user_id=user_id,
                type='medication',
                title=f"Medication Reminder: {med_name}",
                message=f"It is time to take your dose of {med_name} ({dosage}).",
                scheduled_time=scheduled_date,
                status='pending'
            )
            reminders_created.append(notif)
            
        get_services(current_app._get_current_object()).notification_records.add_many(reminders_created)
        return jsonify({'message': f'Scheduled {len(reminders_created)} medication reminders for {med_name}'})
    except Exception as e:
        current_app.logger.exception('Request processing failed')
        return jsonify({'error': 'Request failed'}), 500


@api_bp.route('/api/reminders/test', methods=['POST'])
def test_reminder_alert():
    """
    Creates an immediate test alert due right now.
    """
    try:
        data = request.get_json() or {}
        user_id = data.get('user_id', 1)
        now = datetime.utcnow()
        
        notif = Notification(
            user_id=user_id,
            type='medication',
            title="Medication Reminder Alert",
            message="It is time to take your dose of Amoxicillin (Test Dose) (500mg - 1 tablet).",
            scheduled_time=now,
            status='pending'
        )
        get_services(current_app._get_current_object()).notification_records.add_many([notif])
        return jsonify({'message': 'Test alert generated successfully', 'id': notif.id})
    except Exception as e:
        current_app.logger.exception('Request processing failed')
        return jsonify({'error': 'Request failed'}), 500



