import unittest

from backend.core.symptom_report import parse_symptom_report
from backend.services.symptom_assessment import SymptomAssessmentService


class FakeMatcher:
    def match_with_weights(self, symptoms, weights):
        return [{'disease': 'Example', 'match_score': 0.8, 'confidence': 0.8}]

    def vector_match(self, symptoms):
        return [{'disease': 'Other', 'match_score': 0.6, 'confidence': 0.6}]


class SymptomAssessmentTests(unittest.TestCase):
    def test_parser_separates_positive_and_negated_symptoms(self):
        report = parse_symptom_report('headace and nausea, no fever or cough')
        self.assertEqual(report.positive, ('headache', 'nausea'))
        self.assertEqual(report.negated, ('fever', 'cough'))

    def test_parser_handles_negation_after_a_contrast_clause(self):
        report = parse_symptom_report('I have headache but no fever')
        self.assertEqual(report.positive, ('headache',))
        self.assertEqual(report.negated, ('fever',))

    def test_assessment_skips_matcher_for_empty_positive_symptoms(self):
        assessment = SymptomAssessmentService().assess('no fever', FakeMatcher())
        self.assertEqual(assessment.matches, ())
        self.assertEqual(assessment.report.negated, ('fever',))

    def test_assessment_merges_and_sorts_matcher_results(self):
        assessment = SymptomAssessmentService().assess('headache', FakeMatcher())
        self.assertEqual([item['disease'] for item in assessment.matches], ['Example', 'Other'])


if __name__ == '__main__':
    unittest.main()
