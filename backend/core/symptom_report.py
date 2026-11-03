"""Parse symptom statements without interpreting similarity as diagnosis."""
from dataclasses import dataclass
from typing import Tuple
import re
from backend.utils import clean_symptoms

_NEGATION = re.compile(r"^(?:i\s+(?:do\s+not|don't)\s+have|i\s+have\s+no|not\s+experiencing|denies?|without|no)\s+", re.I)
_CONTRAST = re.compile(r"^(?:but|however|although)\s+", re.I)

@dataclass(frozen=True)
class SymptomReport:
    positive: Tuple[str, ...]
    negated: Tuple[str, ...]

def parse_symptom_report(text):
    """Return deduplicated positive and explicitly negated symptom phrases.

    This is intentionally conservative: it recognizes simple negation only and
    does not infer duration, severity, or diagnoses from free text.
    """
    if isinstance(text, (list, tuple)):
        text = ", ".join(item for item in text if isinstance(item, str))
    if not isinstance(text, str) or not text.strip():
        return SymptomReport((), ())

    positives, negatives = [], []
    # Contrast clauses often change polarity mid-sentence: "headache but no
    # fever" must not turn the denied fever into a positive symptom.
    for raw_part in re.split(r"[,;]+|\b(?:but|however|although)\b", text, flags=re.I):
        part = _CONTRAST.sub("", raw_part.strip())
        if not part:
            continue
        is_negative = bool(_NEGATION.match(part))
        phrase = _NEGATION.sub("", part, count=1).strip() if is_negative else part
        phrase = re.sub(r"^(?:i\s+am\s+feeling|i\s+feel|i\s+have|suffering\s+from)\s+", "", phrase, flags=re.I)
        # Handle simple coordinated lists: "no fever or cough" / "no fever and cough".
        phrases = re.split(r"\s+(?:and|or)\s+", phrase, flags=re.I)
        target = negatives if is_negative else positives
        for item in phrases:
            target.extend(clean_symptoms(item))

    def unique(items):
        result, seen = [], set()
        for item in items:
            key = re.sub(r"\s+", " ", item).strip().casefold()
            if key and key not in seen:
                seen.add(key)
                result.append(key)
        return tuple(result)

    return SymptomReport(unique(positives), unique(negatives))
