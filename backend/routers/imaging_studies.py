from datetime import date, timedelta

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db import require_db

router = APIRouter(prefix="/api/v1/imaging/studies", tags=["imaging_studies"])

STUDY_TYPES = ["Chest X-Ray", "CT Chest", "MRI Brain", "Abdominal CT", "Echocardiogram"]
MODALITIES = ["XR", "CT", "MR", "CT", "US"]
FINDINGS = [
    ("Bilateral opacification — possible consolidation", 91),
    ("No acute intracranial pathology", 98),
    ("Small pleural effusion — right base", 87),
    ("Cardiomegaly — LV enlargement noted", 93),
    ("Normal bowel gas pattern", 95),
]
DAY_OFFSETS = [0, 43, 139]  # matches the original relative spacing between the 3 seeded studies


def _seed_n(patient_id: str) -> int:
    digits = "".join(c for c in patient_id if c.isdigit())
    return int(digits[-1]) if digits else 0


def _seed_studies(patient_id: str) -> list[dict]:
    seed = _seed_n(patient_id)
    today = date.today()
    studies = []
    for i in range(3):
        idx = (seed + i) % len(STUDY_TYPES)
        finding, base_confidence = FINDINGS[idx]
        confidence = base_confidence + (seed % 5) - 2
        studies.append({
            "patient_id": patient_id,
            "study_type": STUDY_TYPES[idx],
            "modality": MODALITIES[idx],
            "study_date": (today - timedelta(days=DAY_OFFSETS[i])).isoformat(),
            "status": "Pending Review" if i == 0 else "Reviewed",
            "finding": finding,
            "confidence": confidence,
            "flagged": bool(base_confidence < 93 and i == 0),
        })
    return studies


class ImagingStudyCreate(BaseModel):
    patient_id: str
    study_type: str
    modality: str
    study_date: str
    status: str = "Pending Review"
    finding: str
    confidence: float
    flagged: bool = False


class ImagingStudyUpdate(BaseModel):
    study_type: str | None = None
    modality: str | None = None
    study_date: str | None = None
    status: str | None = None
    finding: str | None = None
    confidence: float | None = None
    flagged: bool | None = None


@router.get("")
def get_studies(patient_id: str):
    """Returns the patient's imaging study history, generating and persisting a seeded set
    server-side (same deterministic hash-of-id logic as before) if none exists yet."""
    db = require_db()
    existing = db.table("imaging_studies").select("*").eq("patient_id", patient_id).order("study_date", desc=True).execute().data
    if existing:
        return existing

    patient = db.table("patients").select("id").eq("id", patient_id).maybe_single().execute()
    patient_row = patient.data if patient else None
    if not patient_row:
        raise HTTPException(status_code=404, detail="Patient not found")

    seeded = _seed_studies(patient_id)
    res = db.table("imaging_studies").insert(seeded).execute()
    return sorted(res.data, key=lambda s: s["study_date"], reverse=True)


@router.post("", status_code=201)
def create_study(body: ImagingStudyCreate):
    db = require_db()
    res = db.table("imaging_studies").insert(body.model_dump()).execute()
    return res.data[0]


@router.get("/{study_id}")
def get_study(study_id: int):
    db = require_db()
    res = db.table("imaging_studies").select("*").eq("id", study_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Study not found")
    return res.data[0]


@router.put("/{study_id}")
def update_study(study_id: int, body: ImagingStudyUpdate):
    db = require_db()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = db.table("imaging_studies").update(updates).eq("id", study_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Study not found")
    return res.data[0]


@router.delete("/{study_id}", status_code=204)
def delete_study(study_id: int):
    db = require_db()
    res = db.table("imaging_studies").delete().eq("id", study_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Study not found")
