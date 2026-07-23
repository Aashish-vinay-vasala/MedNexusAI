from loguru import logger

logger.disable("PyRuSH")

import medspacy
from medspacy.ner import TargetRule

_TARGET_TERMS: dict[str, list[str]] = {
    "CONDITION": ["COPD", "hypertension", "pneumonia", "heart failure", "diabetes", "sepsis", "stroke", "STEMI"],
    "MEDICATION": [
        "salbutamol", "amlodipine", "amoxicillin", "warfarin", "aspirin", "clopidogrel",
        "paracetamol", "furosemide", "metformin", "ramipril", "piperacillin-tazobactam", "noradrenaline",
    ],
    "PROCEDURE": ["CABG", "PCI", "CXR", "ECG", "echo", "nebuliser"],
    "SYMPTOM": ["dyspnoea", "chest pain", "fever", "cough", "pain", "hypotensive"],
    "VITAL": ["SpO₂", "HR", "BP", "troponin", "Temp", "RR"],
}


def _build_pipeline():
    nlp = medspacy.load(enable=["medspacy_pyrush", "medspacy_target_matcher", "medspacy_context"])
    target_matcher = nlp.get_pipe("medspacy_target_matcher")
    rules = [TargetRule(literal=term, category=label) for label, terms in _TARGET_TERMS.items() for term in terms]
    target_matcher.add(rules)
    return nlp


_nlp = _build_pipeline()


def analyze_note(note_text: str) -> list[dict]:
    doc = _nlp(note_text)
    entities = [
        {
            "text": ent.text,
            "type": ent.label_,
            "start": ent.start_char,
            "end": ent.end_char,
            "is_negated": bool(ent._.is_negated),
            "is_uncertain": bool(ent._.is_uncertain),
        }
        for ent in doc.ents
    ]
    entities.sort(key=lambda e: e["start"])
    return entities
