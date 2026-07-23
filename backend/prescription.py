from decision_support import check_interaction

# Bundled dosing reference: max safe daily dose (mg), and caution flags. Deliberately a small,
# illustrative reference table (not a substitute for a real formulary), consistent with the
# scope of decision_support.py's interaction table.
_DOSING_RULES: dict[str, dict] = {
    "warfarin": {"max_daily_mg": 10, "elderly_caution": True, "renal_adjust": False},
    "aspirin": {"max_daily_mg": 4000, "elderly_caution": True, "renal_adjust": False},
    "metformin": {"max_daily_mg": 2550, "elderly_caution": True, "renal_adjust": True},
    "lisinopril": {"max_daily_mg": 40, "elderly_caution": True, "renal_adjust": True},
    "amiodarone": {"max_daily_mg": 400, "elderly_caution": True, "renal_adjust": False},
    "digoxin": {"max_daily_mg": 0.375, "elderly_caution": True, "renal_adjust": True},
    "ibuprofen": {"max_daily_mg": 3200, "elderly_caution": True, "renal_adjust": True},
    "amoxicillin": {"max_daily_mg": 3000, "elderly_caution": False, "renal_adjust": True},
    "paracetamol": {"max_daily_mg": 4000, "elderly_caution": False, "renal_adjust": False},
    "furosemide": {"max_daily_mg": 600, "elderly_caution": True, "renal_adjust": True},
}


def _extract_daily_mg(dose: str, frequency: str) -> float | None:
    """Best-effort parse of a dose like '500mg' + frequency like 'BD'/'TDS'/'once daily'."""
    import re

    match = re.search(r"([\d.]+)\s*mg", dose, re.IGNORECASE)
    if not match:
        return None
    per_dose = float(match.group(1))
    freq = frequency.strip().lower()
    times_per_day = {"od": 1, "once daily": 1, "bd": 2, "twice daily": 2, "tds": 3, "three times daily": 3, "qds": 4, "four times daily": 4}.get(freq, 1)
    return per_dose * times_per_day


def validate_prescription(drug: str, dose: str, route: str, frequency: str, patient_meds: list[str], patient_age: int) -> dict:
    warnings: list[dict] = []
    drug_key = drug.strip().lower()

    for existing in patient_meds:
        result = check_interaction(drug, existing)
        if result["interacts"]:
            warnings.append({"severity": result["severity"], "message": f"{drug} + {existing}: {result['effect']}"})

    rules = _DOSING_RULES.get(drug_key)
    if rules:
        daily_mg = _extract_daily_mg(dose, frequency)
        if daily_mg is not None and daily_mg > rules["max_daily_mg"]:
            warnings.append({"severity": "high", "message": f"Prescribed daily dose ({daily_mg}mg) exceeds the typical maximum ({rules['max_daily_mg']}mg/day)"})
        if rules["elderly_caution"] and patient_age >= 75:
            warnings.append({"severity": "medium", "message": f"{drug} requires caution in elderly patients (age {patient_age}) — consider dose reduction"})
        if rules["renal_adjust"]:
            warnings.append({"severity": "medium", "message": f"{drug} requires renal-function-based dose adjustment — confirm eGFR before dispensing"})

    severity_rank = {"critical": 3, "high": 2, "medium": 1}
    overall_severity = max((severity_rank.get(w["severity"], 0) for w in warnings), default=0)
    overall = {3: "critical", 2: "high", 1: "medium", 0: "none"}[overall_severity]

    return {"warnings": warnings, "severity": overall}
