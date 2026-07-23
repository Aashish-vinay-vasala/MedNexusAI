import hashlib

BASE_FEE = 180.0
PER_CODE_FEE = 95.0


def _deterministic_code_rate(code: str) -> float:
    """Stable per-code rate derived from the code itself, standing in for a real payer fee schedule."""
    digest = hashlib.sha1(code.encode()).hexdigest()
    return PER_CODE_FEE + (int(digest[:4], 16) % 400)


def build_claim(patient: dict, diagnoses: list[dict], procedure_summary: str | None) -> dict:
    codes = [d.get("code") for d in diagnoses if d.get("code")]
    line_items = [
        {"code": code, "description": next((d.get("description") for d in diagnoses if d.get("code") == code), ""), "amount": round(_deterministic_code_rate(code), 2)}
        for code in codes
    ]
    total = round(BASE_FEE + sum(item["amount"] for item in line_items), 2)

    return {
        "patient_id": patient.get("id"),
        "patient_name": patient.get("name"),
        "ward": patient.get("ward"),
        "icd10_codes": codes,
        "line_items": line_items,
        "base_fee": BASE_FEE,
        "procedure_summary": procedure_summary or "General inpatient care and evaluation",
        "amount": total,
    }
