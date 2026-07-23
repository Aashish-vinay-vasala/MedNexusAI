"""Groq-based clinical text generation (note summary / lab report summary / discharge
letter). Pure logic, no FastAPI or DB import, so both routers/clinical_nlp_text.py and
mcp_server.py can call it directly -- mirrors nlp.py/vitals.py's bare-module convention.
"""

CLINICAL_TEXT_PROMPTS: dict[str, str] = {
    "note_summary": """You are a clinical AI assistant. Summarize the following free-text clinical note into a structured format with these sections in ALL CAPS: CHIEF COMPLAINT, HISTORY, EXAMINATION, ASSESSMENT, PLAN, KEY ALERTS. Keep each section concise (1-3 sentences). Do not add any text before the first section header.

CLINICAL NOTE:
{note_text}""",
    "report_summary": """You are a clinical AI assistant. Write a concise narrative summary (3-5 sentences) interpreting the following lab report for patient {name} (risk level: {risk}). Be direct and actionable for clinical staff.

LAB REPORT:
{lab_report}""",
    "discharge_letter": """You are a clinical AI assistant. Draft a discharge letter for patient {name} (ID: {patient_id}, ward: {ward}, risk level: {risk}). Include sections in ALL CAPS: DIAGNOSIS, HOSPITAL COURSE, DISCHARGE MEDICATIONS, FOLLOW-UP, PATIENT INSTRUCTIONS. Keep each section concise. Do not add any text before the first section header.""",
}

CHAT_MODEL = "llama-3.3-70b-versatile"


def generate(
    groq_client,
    mode: str,
    patient_id: str,
    name: str,
    risk: str,
    ward: str | None = None,
    note_text: str | None = None,
    lab_report: str | None = None,
) -> str:
    """Builds the mode-specific prompt and returns Groq's raw text content.

    Raises ValueError for an unknown mode, RuntimeError (wrapping the underlying Groq
    exception) if the API call fails.
    """
    template = CLINICAL_TEXT_PROMPTS.get(mode)
    if not template:
        raise ValueError(f"Unknown mode: {mode}")

    prompt = template.format(
        note_text=note_text or "",
        lab_report=lab_report or "",
        name=name,
        risk=risk,
        patient_id=patient_id,
        ward=ward or "N/A",
    )

    try:
        response = groq_client.chat.completions.create(
            model=CHAT_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=700,
            temperature=0.3,
        )
    except Exception as exc:
        raise RuntimeError(f"Groq request failed: {exc}") from exc

    return response.choices[0].message.content or ""
