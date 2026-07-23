_RISK_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}

# Ward keyword -> preferred specialty. Falls back to Internal Medicine when nothing matches.
_WARD_SPECIALTY_HINTS: list[tuple[str, str]] = [
    ("icu", "Critical Care"),
    ("cardiac", "Cardiology"),
    ("cardio", "Cardiology"),
    ("respiratory", "Respiratory"),
    ("surg", "General Surgery"),
    ("renal", "Nephrology"),
    ("dialysis", "Nephrology"),
]


def _preferred_specialty(ward: str) -> str | None:
    ward_lower = ward.lower()
    for keyword, specialty in _WARD_SPECIALTY_HINTS:
        if keyword in ward_lower:
            return specialty
    return None


def assign_patients(patients: list[dict], doctors: list[dict], existing_loads: dict[int, int] | None = None) -> list[dict]:
    """Greedy least-loaded assignment with ward-to-specialty matching, respecting each
    doctor's max_patients capacity. Returns [{patient_id, doctor_id}]."""
    loads = dict(existing_loads or {})
    for d in doctors:
        loads.setdefault(d["id"], 0)

    ordered_patients = sorted(patients, key=lambda p: _RISK_ORDER.get(p.get("risk", "medium"), 2))
    assignments = []

    for patient in ordered_patients:
        preferred = _preferred_specialty(patient.get("ward", ""))
        candidates = [d for d in doctors if loads[d["id"]] < d["max_patients"]]
        if not candidates:
            continue

        matching = [d for d in candidates if preferred and d["specialty"] == preferred]
        pool = matching if matching else candidates
        chosen = min(pool, key=lambda d: loads[d["id"]])

        loads[chosen["id"]] += 1
        assignments.append({"patient_id": patient["id"], "doctor_id": chosen["id"]})

    return assignments
