"""Use-case orchestration for symptom matching, independent of Flask."""
from dataclasses import dataclass
from typing import Dict, Tuple
from backend.core.symptom_report import SymptomReport, parse_symptom_report

@dataclass(frozen=True)
class SymptomAssessment:
    report: SymptomReport
    matches: Tuple[Dict, ...]

class SymptomAssessmentService:
    def assess(self, raw_symptoms, matcher):
        report = parse_symptom_report(raw_symptoms)
        if not report.positive:
            return SymptomAssessment(report, ())

        weights = {symptom: max(0.5, 1.0 - (idx * 0.1)) for idx, symptom in enumerate(report.positive)}
        scored = matcher.match_with_weights(report.positive, weights)
        vector_scored = matcher.vector_match(report.positive)
        merged = {item['disease']: item for item in scored}
        for item in vector_scored:
            current = merged.get(item['disease'])
            if current is None or item.get('match_score', 0) > current.get('match_score', 0):
                merged[item['disease']] = item
        matches = sorted(merged.values(), key=lambda item: (item.get('match_score', 0), item.get('confidence', 0)), reverse=True)[:10]
        return SymptomAssessment(report, tuple(matches))
