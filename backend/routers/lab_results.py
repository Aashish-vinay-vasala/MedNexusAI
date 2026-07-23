from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db import require_db

router = APIRouter(prefix="/api/v1/lab-results", tags=["lab_results"])

LAB_MARKERS = {
    "CBC": [
        {"marker": "WBC", "unit": "10^9/L", "ref_low": 4.0, "ref_high": 11.0, "normal": 7.0},
        {"marker": "Hemoglobin", "unit": "g/dL", "ref_low": 12.0, "ref_high": 16.0, "normal": 14.0},
        {"marker": "Platelets", "unit": "10^9/L", "ref_low": 150, "ref_high": 400, "normal": 275},
    ],
    "BMP": [
        {"marker": "Creatinine", "unit": "mg/dL", "ref_low": 0.6, "ref_high": 1.2, "normal": 0.9},
        {"marker": "Sodium", "unit": "mmol/L", "ref_low": 135, "ref_high": 145, "normal": 140},
        {"marker": "Potassium", "unit": "mmol/L", "ref_low": 3.5, "ref_high": 5.0, "normal": 4.2},
        {"marker": "Glucose", "unit": "mg/dL", "ref_low": 70, "ref_high": 100, "normal": 90},
    ],
    "LFT": [
        {"marker": "ALT", "unit": "U/L", "ref_low": 7, "ref_high": 56, "normal": 25},
        {"marker": "AST", "unit": "U/L", "ref_low": 8, "ref_high": 48, "normal": 22},
        {"marker": "Bilirubin", "unit": "mg/dL", "ref_low": 0.1, "ref_high": 1.2, "normal": 0.6},
    ],
}

LAB_RISK_DEVIATION = {"critical": 0.55, "high": 0.32, "medium": 0.14, "low": 0.0}


def _seed_n(patient_id: str) -> int:
    digits = "".join(c for c in patient_id if c.isdigit())
    return int(digits) if digits else 0


def _seed_lab_results(patient: dict) -> list[dict]:
    """Deterministic seeded lab history, same convention as vitals — worsening trend for higher-risk patients."""
    seed = _seed_n(patient["id"])
    deviation = LAB_RISK_DEVIATION.get(patient.get("risk", "medium"), 0.14)
    now = datetime.now(timezone.utc)
    results: list[dict] = []

    for panel_idx, (panel, markers) in enumerate(LAB_MARKERS.items()):
        for marker_idx, definition in enumerate(markers):
            drift = (seed + panel_idx * 7 + marker_idx * 3) % 5
            direction = 1 if marker_idx % 2 == 0 else -1
            for t in range(3, -1, -1):
                trend_factor = deviation * (1 - t * 0.22) + drift * 0.01
                value = definition["normal"] * (1 + direction * trend_factor)
                results.append({
                    "patient_id": patient["id"],
                    "panel": panel,
                    "marker": definition["marker"],
                    "value": round(value, 2),
                    "unit": definition["unit"],
                    "ref_low": definition["ref_low"],
                    "ref_high": definition["ref_high"],
                    "recorded_at": (now - timedelta(days=t)).isoformat(),
                })
    return results


class LabResultCreate(BaseModel):
    patient_id: str
    panel: str
    marker: str
    value: float
    unit: str
    ref_low: float | None = None
    ref_high: float | None = None


class LabResultUpdate(BaseModel):
    panel: str | None = None
    marker: str | None = None
    value: float | None = None
    unit: str | None = None
    ref_low: float | None = None
    ref_high: float | None = None


@router.get("")
def get_lab_results(patient_id: str):
    """Returns the patient's lab history, generating and persisting a seeded set server-side if none exists yet."""
    db = require_db()
    existing = (
        db.table("lab_results").select("*").eq("patient_id", patient_id)
        .order("recorded_at").execute().data
    )
    if existing:
        return existing

    patient_res = db.table("patients").select("*").eq("id", patient_id).maybe_single().execute()
    patient = patient_res.data if patient_res else None
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    seeded = _seed_lab_results(patient)
    res = db.table("lab_results").insert(seeded).execute()
    return res.data


@router.post("", status_code=201)
def create_lab_result(body: LabResultCreate):
    db = require_db()
    res = db.table("lab_results").insert(body.model_dump()).execute()
    return res.data[0]


@router.put("/{result_id}")
def update_lab_result(result_id: int, body: LabResultUpdate):
    db = require_db()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = db.table("lab_results").update(updates).eq("id", result_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Lab result not found")
    return res.data[0]


@router.delete("/{result_id}", status_code=204)
def delete_lab_result(result_id: int):
    db = require_db()
    res = db.table("lab_results").delete().eq("id", result_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Lab result not found")
