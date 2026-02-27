from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json
import os

app = Flask(__name__)
CORS(app)

# Load disease data
with open("diseases.json") as f:
    diseases = json.load(f)

# 🔍 Match diseases by symptom overlap
def find_matches(user_symptoms):
    matches = []

    for disease in diseases:
        disease_symptoms = [s.lower() for s in disease["symptoms"]]

        match_count = 0
        for user_symptom in user_symptoms:
            if user_symptom in disease_symptoms:
                match_count += 1

        if match_count > 0:
            score = match_count / len(disease_symptoms)
            matches.append({
                "disease": disease["disease"],
                "match_score": round(score, 2),
                "severity": disease.get("severity", "unknown"),
                "category": disease.get("category", "unknown"),
                "medicine": disease.get("medicine", "N/A"),
                "advice": disease.get("advice", "N/A")
            })

    # Sort by highest match
    matches.sort(key=lambda x: x["match_score"], reverse=True)

    return matches[:3]  # top 3 diseases

@app.route("/")
def home():
    # Serve the HTML file when someone visits the root URL
    return send_from_directory('.', 'index.html')

@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json()

    user_symptoms = data.get("symptoms", [])

    if not user_symptoms:
        return jsonify({"matches": []})

    matches = find_matches(user_symptoms)

    return jsonify({"matches": matches})

if __name__ == "__main__":
    app.run(debug=True, port=5000)