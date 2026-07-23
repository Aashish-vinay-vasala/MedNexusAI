import re

import simple_icd_10 as icd

from nlp import analyze_note

_LEAF_CODES: list[tuple[str, str]] = [
    (code, icd.get_description(code)) for code in icd.get_all_codes(with_dots=True) if icd.is_leaf(code)
]


def _tokenize(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", text.lower()))


def search_codes(query: str, limit: int = 10) -> list[dict]:
    query_tokens = _tokenize(query)
    if not query_tokens:
        return []
    query_lower = query.strip().lower()

    scored = []
    for code, description in _LEAF_CODES:
        desc_lower = description.lower()
        desc_tokens = _tokenize(description)
        overlap = len(query_tokens & desc_tokens)
        if overlap == 0 and query_lower not in desc_lower and query_lower not in code.lower():
            continue

        score = overlap / len(query_tokens)
        if desc_lower == query_lower:
            score += 2.0
        elif desc_lower.startswith(query_lower):
            score += 1.0
        elif query_lower in desc_lower:
            score += 0.3
        # Prefer shorter, more generic descriptions as a tiebreaker (e.g. "Sepsis, unspecified"
        # over a highly specific organism-level code) when relevance is otherwise equal.
        score -= 0.01 * len(desc_tokens)
        scored.append({"code": code, "description": description, "score": round(score, 3)})

    scored.sort(key=lambda r: r["score"], reverse=True)
    return scored[:limit]


def suggest_from_note(note_text: str) -> list[dict]:
    """Reuses the MedSpaCy pipeline's CONDITION entities to auto-suggest ICD-10 codes."""
    entities = [e for e in analyze_note(note_text) if e["type"] == "CONDITION" and not e["is_negated"]]
    suggestions = []
    seen_codes: set[str] = set()
    for ent in entities:
        matches = search_codes(ent["text"], limit=1)
        if not matches or matches[0]["code"] in seen_codes:
            continue
        seen_codes.add(matches[0]["code"])
        suggestions.append({"source_text": ent["text"], **matches[0]})
    return suggestions
