from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db import require_db

router = APIRouter(prefix="/api/v1/patients/{patient_id}/allergies", tags=["allergies"])

ALLERGY_SETS = [
    [("Penicillin", "Anaphylaxis", "severe"), ("NSAIDs", "GI Intolerance", "moderate")],
    [("Codeine", "Nausea / Vomiting", "moderate")],
    [("Sulfonamides", "Rash", "moderate"), ("Latex", "Contact Dermatitis", "mild")],
    [("NKDA", "No Known Drug Allergies", "none")],
]


def _seed_n(patient_id: str) -> int:
    return sum(int(c) for c in patient_id if c.isdigit())


class AllergyCreate(BaseModel):
    allergen: str
    reaction: str
    severity: str = "moderate"


@router.get("")
def get_allergies(patient_id: str):
    """Returns the patient's allergy list, generating and persisting a deterministic seeded set
    server-side (same hash-of-id logic as before) if none exists yet."""
    db = require_db()
    existing = db.table("patient_allergies").select("*").eq("patient_id", patient_id).execute().data
    if existing:
        return existing

    patient_res = db.table("patients").select("id").eq("id", patient_id).maybe_single().execute()
    patient = patient_res.data if patient_res else None
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    chosen_set = ALLERGY_SETS[_seed_n(patient_id) % len(ALLERGY_SETS)]
    seeded = [
        {"patient_id": patient_id, "allergen": allergen, "reaction": reaction, "severity": severity}
        for allergen, reaction, severity in chosen_set
    ]
    res = db.table("patient_allergies").insert(seeded).execute()
    return res.data


@router.post("", status_code=201)
def add_allergy(patient_id: str, body: AllergyCreate):
    db = require_db()
    res = db.table("patient_allergies").insert({"patient_id": patient_id, **body.model_dump()}).execute()
    return res.data[0]


@router.delete("/{allergy_id}", status_code=204)
def delete_allergy(patient_id: str, allergy_id: int):
    db = require_db()
    res = db.table("patient_allergies").delete().eq("id", allergy_id).eq("patient_id", patient_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Allergy not found")
