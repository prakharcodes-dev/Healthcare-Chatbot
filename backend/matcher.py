import numpy as np
from fuzzywuzzy import fuzz

class EnhancedDiseaseMatcher:
    def __init__(self, diseases):
        self.diseases = diseases
        self.symptom_index = self._build_symptom_index()
        self.disease_vectors = self._build_disease_vectors()
    
    def _build_symptom_index(self):
        symptom_index = {}
        for idx, disease in enumerate(self.diseases):
            for symptom in disease['symptoms']:
                symptom_lower = symptom.lower()
                if symptom_lower not in symptom_index:
                    symptom_index[symptom_lower] = []
                symptom_index[symptom_lower].append({
                    'disease_idx': idx,
                    'disease': disease['disease']
                })
        return symptom_index
    
    def _build_disease_vectors(self):
        vectors = {}
        all_symptoms = set()
        for disease in self.diseases:
            for symptom in disease['symptoms']:
                all_symptoms.add(symptom.lower())
        
        all_symptoms = list(all_symptoms)
        symptom_to_idx = {s: i for i, s in enumerate(all_symptoms)}
        
        for disease in self.diseases:
            vector = [0] * len(all_symptoms)
            for symptom in disease['symptoms']:
                vector[symptom_to_idx[symptom.lower()]] = 1
            vectors[disease['disease']] = vector
        
        return vectors
    
    def _fuzzy_match(self, user_symptom, symptom_list, threshold=70):
        matches = []
        user_lower = user_symptom.lower()
        for symptom in symptom_list:
            sym_lower = symptom.lower()
            score = fuzz.ratio(user_lower, sym_lower)
            partial_score = fuzz.partial_ratio(user_lower, sym_lower)
            token_set_score = fuzz.token_set_ratio(user_lower, sym_lower)
            
            # Check individual word matches for typos (e.g., "pian" matching "abdominal pain")
            word_scores = [fuzz.ratio(user_lower, word) for word in sym_lower.split()]
            max_word_score = max(word_scores) if word_scores else 0
            
            best_symptom_score = max(score, int(partial_score * 0.9), token_set_score, max_word_score)
            
            if best_symptom_score >= threshold:
                matches.append((symptom, best_symptom_score))
        return sorted(matches, key=lambda x: x[1], reverse=True)
    
    def _cosine_similarity(self, v1, v2):
        dot = np.dot(v1, v2)
        norm1 = np.linalg.norm(v1)
        norm2 = np.linalg.norm(v2)
        return dot / (norm1 * norm2) if norm1 and norm2 else 0
    
    def match_with_weights(self, user_symptoms, symptom_weights=None):
        if symptom_weights is None:
            symptom_weights = {s: 1.0 for s in user_symptoms}
        
        matches = []
        
        for disease in self.diseases:
            score = 0
            matched_symptoms = []
            
            for user_symptom, weight in symptom_weights.items():
                best_score = 0
                
                if user_symptom.lower() in [s.lower() for s in disease['symptoms']]:
                    best_score = 1.0
                else:
                    fuzzy_matches = self._fuzzy_match(user_symptom, disease['symptoms'], 70)
                    if fuzzy_matches:
                        best_score = fuzzy_matches[0][1] / 100.0
                
                if best_score > 0:
                    matched_symptoms.append(user_symptom)
                    score += best_score * weight
            
            if matched_symptoms:
                max_possible = sum(symptom_weights.values())
                normalized_score = (score / max_possible) * 100 if max_possible > 0 else 0
                
                severity_bonus = {
                    'high': 1.2, 'moderate': 1.1, 'mild': 1.0
                }.get(disease.get('severity', 'mild'), 1.0)
                
                final_score = min(100, normalized_score * severity_bonus)
                
                coverage = len(matched_symptoms) / len(disease['symptoms']) if disease['symptoms'] else 0
                confidence = min(100, final_score * 0.6 + coverage * 40)
                
                matches.append({
                    'disease': disease['disease'],
                    'match_score': round(final_score, 2),
                    'match_percentage': round(final_score),
                    'confidence': round(confidence, 2),
                    'matched_symptoms': matched_symptoms,
                    'severity': disease.get('severity', 'unknown'),
                    'category': disease.get('category', 'unknown'),
                    'medicine': disease.get('medicine', 'N/A'),
                    'advice': disease.get('advice', 'N/A'),
                    'prevention_tips': disease.get('prevention_tips', 'N/A'),
                    'specialist': disease.get('specialist', 'N/A'),
                    'symptoms': disease.get('symptoms', []),
                    'causes': disease.get('causes', 'N/A'),
                    'risk_factors': disease.get('risk_factors', 'N/A'),
                    'prevention': disease.get('prevention', disease.get('prevention_tips', 'N/A')),
                    'treatment': disease.get('treatment', f"{disease.get('medicine', 'N/A')}. {disease.get('advice', '')}"),
                    'when_to_seek_care': disease.get('when_to_seek_care', 'N/A')
                })
        
        matches.sort(key=lambda x: (x['match_score'], x['confidence']), reverse=True)
        return matches[:10]
    
    def vector_match(self, user_symptoms):
        if not self.disease_vectors:
            return []
        
        all_symptoms = list(set([s for d in self.diseases for s in d['symptoms']]))
        symptom_to_idx = {s.lower(): i for i, s in enumerate(all_symptoms)}
        
        user_vector = [0] * len(all_symptoms)
        for symptom in user_symptoms:
            if symptom.lower() in symptom_to_idx:
                user_vector[symptom_to_idx[symptom.lower()]] = 1
        
        similarities = []
        for disease_name, disease_vector in self.disease_vectors.items():
            similarity = self._cosine_similarity(user_vector, disease_vector)
            if similarity > 0:
                disease = next(d for d in self.diseases if d['disease'] == disease_name)
                similarities.append({
                    'disease': disease_name,
                    'match_score': round(similarity * 100, 2),
                    'match_percentage': round(similarity * 100),
                    'severity': disease.get('severity', 'unknown'),
                    'category': disease.get('category', 'unknown'),
                    'medicine': disease.get('medicine', 'N/A'),
                    'advice': disease.get('advice', 'N/A'),
                    'prevention_tips': disease.get('prevention_tips', 'N/A'),
                    'specialist': disease.get('specialist', 'N/A'),
                    'symptoms': disease.get('symptoms', []),
                    'causes': disease.get('causes', 'N/A'),
                    'risk_factors': disease.get('risk_factors', 'N/A'),
                    'prevention': disease.get('prevention', disease.get('prevention_tips', 'N/A')),
                    'treatment': disease.get('treatment', f"{disease.get('medicine', 'N/A')}. {disease.get('advice', '')}"),
                    'when_to_seek_care': disease.get('when_to_seek_care', 'N/A')
                })

        
        return sorted(similarities, key=lambda x: x['match_score'], reverse=True)[:5]
