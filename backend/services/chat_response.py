"""Presentation-ready chat response shaping, independent of HTTP."""
from backend.core.health_metrics import evaluate_health_metric_status

def build_structured_chat_response(user_symptoms, final_matches, user_measurements=None, urgent_flags=None):
    measurements_summary = []
    if user_measurements:
        if 'temperature' in user_measurements:
            t_c = user_measurements['temperature']
            t_f = round(t_c * 9/5 + 32, 1)
            st_temp = evaluate_health_metric_status('temperature', t_f)
            measurements_summary.append({
                'metric': 'Body Temperature',
                'value': f"{t_c} °C ({t_f} °F)",
                'status': st_temp,
                'type': 'temperature',
                'icon': 'fa-temperature-high',
                'badge_class': 'badge-severity-high' if st_temp in ['High', 'Elevated'] else 'badge-severity-mild'
            })
        if 'bp_sys' in user_measurements:
            sys_v = user_measurements['bp_sys']
            dia_v = user_measurements.get('bp_dia', 80)
            st_bp = evaluate_health_metric_status('blood_pressure', sys_v, dia_v)
            measurements_summary.append({
                'metric': 'Blood Pressure',
                'value': f"{int(sys_v)}/{int(dia_v)} mmHg",
                'status': st_bp,
                'type': 'blood_pressure',
                'icon': 'fa-heart-pulse',
                'badge_class': 'badge-severity-high' if 'High' in st_bp else ('badge-severity-moderate' if 'Elevated' in st_bp else 'badge-severity-mild')
            })
        if 'weight' in user_measurements:
            wt_v = user_measurements['weight']
            measurements_summary.append({
                'metric': 'Body Weight',
                'value': f"{wt_v} kg",
                'status': 'Normal',
                'type': 'weight',
                'icon': 'fa-weight-scale',
                'badge_class': 'badge-match'
            })

    if not final_matches:
        return {
            'possible_causes': [],
            'why': f"No condition matches found in dataset for reported symptoms: {', '.join(user_symptoms)}.",
            'what_you_can_do': "Rest, stay hydrated, monitor your health closely, and consult a doctor if you feel unwell.",
            'seek_medical_care_if': "Symptoms persist, worsen over 24-48 hours, or new unexplained symptoms develop.",
            'emergency_warning': "If you experience severe shortness of breath, sudden chest pain, loss of consciousness, or severe trauma, call emergency services (911/112) immediately.",
            'measurements_summary': measurements_summary
        }
    
    top_3 = final_matches[:3]
    top_match = top_3[0]
    
    possible_causes = [m['disease'] for m in final_matches[:5]]
    symptoms_str = ", ".join(user_symptoms)
    
    why_text = f"Your reported symptoms ({symptoms_str}) overlap significantly with the diagnostic criteria for these conditions, especially {top_match['disease']} ({top_match['match_percentage']}% match)."
    
    # Append submitted health measurements if present
    if user_measurements:
        m_parts = []
        if 'temperature' in user_measurements:
            m_parts.append(f"Temperature: {user_measurements['temperature']} °C")
        if 'bp_sys' in user_measurements:
            bp_s = f"{user_measurements['bp_sys']}/{user_measurements.get('bp_dia', 80)}"
            m_parts.append(f"Blood Pressure: {bp_s} mmHg")
        if 'weight' in user_measurements:
            m_parts.append(f"Weight: {user_measurements['weight']} kg")
            
        if m_parts:
            why_text += f" Recorded Measurements: {', '.join(m_parts)}. Combining your symptoms and measurements suggests these possible health concerns."

    care_details = {
        'treatment': top_match.get('treatment') or top_match.get('medicine') or 'Symptomatic rest and fluid intake.',
        'advice': top_match.get('advice') or 'Rest, stay well-hydrated, and monitor your symptoms closely.',
        'prevention': top_match.get('prevention') or top_match.get('prevention_tips') or 'Follow clean hygiene practices and avoid known symptom triggers.',
        'specialist': top_match.get('specialist', 'Primary Care Physician')
    }

    care_items = []
    if top_match.get('treatment'):
        care_items.append(f"Treatment: {top_match['treatment']}")
    elif top_match.get('medicine'):
        care_items.append(f"Medications: {top_match['medicine']}")
    if top_match.get('advice'):
        care_items.append(f"Advice: {top_match['advice']}")
    if top_match.get('prevention'):
        care_items.append(f"Prevention: {top_match['prevention']}")
        
    what_you_can_do = " | ".join(care_items) if care_items else "Rest, maintain proper fluid intake, and seek medical consultation."
    
    spec = top_match.get('specialist', 'Primary Care Physician')
    seek_care = top_match.get('when_to_seek_care') or f"Consult a {spec} if symptoms persist beyond 3-5 days or progressively worsen."
    
    is_high = any('high' in m.get('severity', '').lower() or 'severe' in m.get('severity', '').lower() for m in top_3)
    if urgent_flags:
        emergency = f"⚠️ URGENT SAFETY ALERT: Because you reported {', '.join(urgent_flags)}, this requires prompt attention. If you are currently unconscious, confused, experiencing severe breathing difficulty, chest pain, or rapidly worsening symptoms, seek emergency medical care immediately (Call 911 / 112). This informational assistant is not a substitute for an emergency physician diagnosis."
    elif is_high:
        emergency = f"EMERGENCY WARNING: High-severity condition detected ({top_match['disease']}). Seek immediate emergency medical care (Call 911 / 112) if you experience severe shortness of breath, sudden chest pain, stiff neck with high fever, confusion, or severe bleeding."
    else:
        emergency = "EMERGENCY WARNING: Call emergency services (911 / 112) or visit the nearest emergency room immediately if you develop sudden chest pain, severe shortness of breath, loss of consciousness, or severe bleeding."
        
    return {
        'possible_causes': possible_causes,
        'why': why_text,
        'what_you_can_do': what_you_can_do,
        'what_you_can_do_details': care_details,
        'seek_medical_care_if': seek_care,
        'emergency_warning': emergency,
        'measurements_summary': measurements_summary
    }
