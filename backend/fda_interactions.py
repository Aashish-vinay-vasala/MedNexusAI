"""Live drug-interaction fallback for pairs not in decision_support.py's curated table:
fetches each drug's real FDA-approved label (openFDA, free/no-key) and has Groq read the
label's own "Drug Interactions" section to produce a structured verdict, instead of
guessing from general knowledge. Pure logic, no FastAPI/DB import (mirrors clinical_text.py)
-- the caller (routers/decision_support.py, mcp_server.py) owns the groq_client and the
drug_interaction_ai_cache read/write.
"""

import json

import httpx

FDA_LABEL_URL = "https://api.fda.gov/drug/label.json"
CHAT_MODEL = "llama-3.3-70b-versatile"

_ANALYSIS_PROMPT = """You are a clinical pharmacology assistant. Decide whether {drug_a} and {drug_b} have a clinically significant drug-drug interaction, using ONLY the FDA label excerpts below. Do not use outside knowledge -- if the excerpts don't clearly describe an interaction between these two specific drugs (or {drug_b}'s drug class), answer that there is no interaction.

FDA LABEL — DRUG INTERACTIONS SECTION FOR {drug_a_upper}:
{text_a}

FDA LABEL — DRUG INTERACTIONS SECTION FOR {drug_b_upper}:
{text_b}

Respond with ONLY a JSON object, no other text, in exactly this shape:
{{"interacts": true or false, "severity": "critical" or "high" or "medium" or null, "effect": "short clinical effect description or null", "mechanism": "short mechanism description or null"}}

Use "critical" only for life-threatening interactions (e.g. severe bleeding, fatal arrhythmia, serotonin syndrome). Use "high" for interactions requiring active monitoring/dose changes. Use "medium" for interactions worth noting but lower risk. If interacts is false, severity/effect/mechanism must all be null."""


def fetch_label_interaction_text(drug_name: str) -> str | None:
    """Fetches a drug's FDA label and returns its "Drug Interactions" section text, or
    None if openFDA has no label for this name (404) or the label omits that section."""
    try:
        resp = httpx.get(
            FDA_LABEL_URL,
            params={
                "search": f'openfda.generic_name:"{drug_name}" OR openfda.brand_name:"{drug_name}"',
                "limit": 1,
            },
            timeout=10,
        )
    except httpx.HTTPError:
        return None

    if resp.status_code != 200:
        return None

    results = resp.json().get("results") or []
    if not results:
        return None

    sections = results[0].get("drug_interactions") or []
    text = " ".join(sections).strip()
    return text[:4000] if text else None


def ai_analyze_interaction(groq_client, drug_a: str, drug_b: str, text_a: str | None, text_b: str | None) -> dict:
    """Asks Groq to read each drug's real FDA label interaction text and produce a
    structured verdict. Returns the same shape as decision_support.check_interaction,
    plus a 'source' key. Falls back to a no-interaction / 'unverified' verdict on any
    parsing or API failure so a transient issue never fabricates a result."""
    prompt = _ANALYSIS_PROMPT.format(
        drug_a=drug_a, drug_b=drug_b,
        drug_a_upper=drug_a.upper(), drug_b_upper=drug_b.upper(),
        text_a=text_a or "(no FDA label interactions section available)",
        text_b=text_b or "(no FDA label interactions section available)",
    )

    try:
        response = groq_client.chat.completions.create(
            model=CHAT_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0,
            response_format={"type": "json_object"},
        )
        parsed = json.loads(response.choices[0].message.content or "{}")
        interacts = bool(parsed.get("interacts"))
        return {
            "interacts": interacts,
            "severity": parsed.get("severity") if interacts else None,
            "effect": parsed.get("effect") if interacts else None,
            "mechanism": parsed.get("mechanism") if interacts else None,
            "source": "fda_ai",
        }
    except Exception:
        return {"interacts": False, "severity": None, "effect": None, "mechanism": None, "source": "unverified"}
