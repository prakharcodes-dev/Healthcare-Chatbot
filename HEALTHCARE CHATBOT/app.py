from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json
import re

app = Flask(__name__)
CORS(app)

with open("diseases.json") as f:
    diseases = json.load(f)

def clean_symptoms(text):
    if not text:
        return []
    
    text = text.lower().strip()
    
    if ',' in text:
        symptoms = [s.strip() for s in text.split(',')]
    else:
        symptoms = text.split()
    
    cleaned = []
    filler_words = ['i have', 'i am feeling', 'i feel', 'suffering from', 'with', 'and', 'or', 'the', 'a', 'an']
    
    for s in symptoms:
        for word in filler_words:
            s = re.sub(r'\b' + word + r'\b', '', s)
        s = re.sub(r'[^\w\s-]', '', s)
        s = s.strip()
        if s and len(s) > 1:
            cleaned.append(s)
    
    return cleaned

def check_query_type(text):
    text = text.lower()
    
    doctor_words = ['doctor', 'specialist', 'consult', 'physician', 'which doctor', 'whom to consult', 'who treats']
    prevention_words = ['prevent', 'prevention', 'avoid', 'how to prevent', 'precaution', 'tips to prevent']
    medicine_words = ['medicine', 'treatment', 'cure', 'medication', 'drug', 'tablet', 'pill']
    advice_words = ['advice', 'suggest', 'recommend', 'what should i do', 'home remedy']
    
    for word in doctor_words:
        if word in text:
            return 'doctor'
    
    for word in prevention_words:
        if word in text:
            return 'prevention'
    
    for word in medicine_words:
        if word in text:
            return 'medicine'
    
    for word in advice_words:
        if word in text:
            return 'advice'
    
    return 'symptoms'

def find_disease_by_name(name):
    name = name.lower().strip()
    results = []
    
    for d in diseases:
        disease_name = d["disease"].lower()
        
        if name == disease_name:
            results.append({
                "disease": d["disease"],
                "match_score": 1.0,
                "severity": d.get("severity", "unknown"),
                "category": d.get("category", "unknown"),
                "medicine": d.get("medicine", "N/A"),
                "advice": d.get("advice", "N/A"),
                "prevention_tips": d.get("prevention_tips", "N/A"),
                "specialist": d.get("specialist", "N/A"),
                "symptoms": d.get("symptoms", [])
            })
        elif name in disease_name or disease_name in name:
            results.append({
                "disease": d["disease"],
                "match_score": 0.7,
                "severity": d.get("severity", "unknown"),
                "category": d.get("category", "unknown"),
                "medicine": d.get("medicine", "N/A"),
                "advice": d.get("advice", "N/A"),
                "prevention_tips": d.get("prevention_tips", "N/A"),
                "specialist": d.get("specialist", "N/A"),
                "symptoms": d.get("symptoms", [])
            })
    
    return results[:3]

def match_symptoms(user_symptoms):
    matches = []
    
    if not user_symptoms:
        return []
    
    for d in diseases:
        disease_symptoms = [s.lower() for s in d["symptoms"]]
        count = 0
        
        for user_s in user_symptoms:
            if user_s in disease_symptoms:
                count += 1
            else:
                for ds in disease_symptoms:
                    if user_s in ds or ds in user_s:
                        count += 0.5
                        break
        
        if count > 0:
            score = count / len(disease_symptoms)
            
            if len(disease_symptoms) <= 3:
                score = min(1.0, score + 0.1)
            
            matches.append({
                "disease": d["disease"],
                "match_score": round(score, 2),
                "severity": d.get("severity", "unknown"),
                "category": d.get("category", "unknown"),
                "medicine": d.get("medicine", "N/A"),
                "advice": d.get("advice", "N/A"),
                "prevention_tips": d.get("prevention_tips", "N/A"),
                "specialist": d.get("specialist", "N/A"),
                "symptoms_matched": count,
                "total_symptoms": len(disease_symptoms),
                "symptoms": d.get("symptoms", [])
            })
    
    matches.sort(key=lambda x: (x["match_score"], x["symptoms_matched"]), reverse=True)
    return matches[:5]

@app.route("/")
def home():
    return send_from_directory('.', 'index.html')

@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()
        symptoms_input = data.get("symptoms", [])
        
        if isinstance(symptoms_input, str):
            user_text = symptoms_input
            query_type = check_query_type(user_text)
            
            if query_type != 'symptoms':
                words_to_remove = ['what', 'which', 'who', 'how', 'tell me', 'about', 'for', 'is', 'are', 
                                  'can i', 'should i', 'do i need', 'to', 'the', 'a', 'an']
                clean_text = user_text.lower()
                for word in words_to_remove:
                    clean_text = re.sub(r'\b' + word + r'\b', '', clean_text)
                clean_text = re.sub(r'[?]', '', clean_text)
                
                disease_results = find_disease_by_name(clean_text)
                
                if disease_results:
                    return jsonify({
                        "matches": disease_results,
                        "user_symptoms": [user_text],
                        "total_matches": len(disease_results),
                        "query_type": query_type
                    })
            
            user_symptoms = clean_symptoms(user_text)
        else:
            user_symptoms = [s.strip().lower() for s in symptoms_input if s.strip()]
            query_type = 'symptoms'
        
        if not user_symptoms:
            return jsonify({
                "matches": [],
                "message": "Please tell me your symptoms or ask about a disease",
                "query_type": query_type
            })
        
        matches = match_symptoms(user_symptoms)
        
        response = {
            "matches": matches,
            "user_symptoms": user_symptoms,
            "total_matches": len(matches),
            "query_type": query_type
        }
        
        if not matches:
            response["message"] = "No matching diseases found. Try different symptoms."
        
        return jsonify(response)
    
    except Exception as e:
        return jsonify({"error": str(e), "matches": []}), 500

@app.route("/disease/<name>", methods=["GET"])
def get_disease(name):
    name = name.lower().strip()
    
    for d in diseases:
        if d["disease"].lower() == name:
            return jsonify({
                "disease": d["disease"],
                "symptoms": d.get("symptoms", []),
                "severity": d.get("severity", "unknown"),
                "category": d.get("category", "unknown"),
                "medicine": d.get("medicine", "N/A"),
                "advice": d.get("advice", "N/A"),
                "prevention_tips": d.get("prevention_tips", "N/A"),
                "specialist": d.get("specialist", "N/A")
            })
    
    return jsonify({"error": "Disease not found"}), 404

@app.route("/doctor-advice", methods=["POST"])
def doctor_info():
    data = request.get_json()
    disease_name = data.get("disease", "").lower().strip()
    
    for d in diseases:
        if d["disease"].lower() == disease_name:
            return jsonify({
                "disease": d["disease"],
                "specialist": d.get("specialist", "N/A"),
                "advice": d.get("advice", "N/A"),
                "severity": d.get("severity", "unknown")
            })
    
    return jsonify({"error": "Disease not found"}), 404

@app.route("/prevention-tips", methods=["POST"])
def prevention_info():
    data = request.get_json()
    disease_name = data.get("disease", "").lower().strip()
    
    for d in diseases:
        if d["disease"].lower() == disease_name:
            return jsonify({
                "disease": d["disease"],
                "prevention_tips": d.get("prevention_tips", "N/A"),
                "advice": d.get("advice", "N/A")
            })
    
    return jsonify({"error": "Disease not found"}), 404

@app.route("/suggest", methods=["POST"])
def suggest():
    data = request.get_json()
    partial = data.get("text", "").lower().strip()
    
    if len(partial) < 2:
        return jsonify({"suggestions": []})
    
    all_symptoms = set()
    for d in diseases:
        for symptom in d["symptoms"]:
            all_symptoms.add(symptom.lower())
    
    all_disease_names = [d["disease"].lower() for d in diseases]
    
    symptom_matches = [s for s in all_symptoms if partial in s][:3]
    disease_matches = [d for d in all_disease_names if partial in d][:2]
    
    return jsonify({
        "suggestions": {
            "symptoms": symptom_matches,
            "diseases": disease_matches
        }
    })

@app.route("/all-diseases", methods=["GET"])
def list_diseases():
    disease_list = []
    for d in diseases:
        disease_list.append({
            "name": d["disease"],
            "category": d.get("category", "unknown"),
            "severity": d.get("severity", "unknown")
        })
    
    return jsonify({"diseases": disease_list})

if __name__ == "__main__":
    print("=" * 50)
    print("Healthcare Chatbot Started!")
    print("=" * 50)
    print("Server running at: http://127.0.0.1:5000")
    print("\nWhat you can ask:")
    print("- fever, headache (symptoms)")
    print("- which doctor for diabetes?")
    print("- how to prevent malaria?")
    print("- tell me about asthma")
    print("=" * 50)
    app.run(debug=True, port=5000)