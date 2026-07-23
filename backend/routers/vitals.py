from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db import require_db

router = APIRouter(prefix="/api/v1/vitals", tags=["vitals"])


class VitalsCreate(BaseModel):
    patient_id: str
    hr: int
    sbp: int
    dbp: int
    spo2: int
    temp: float
    rr: int
    gcs: int = 15
    on_oxygen: bool = False
    source: str = "Simulated Monitor"


class VitalsUpdate(BaseModel):
    hr: int | None = None
    sbp: int | None = None
    dbp: int | None = None
    spo2: int | None = None
    temp: float | None = None
    rr: int | None = None
    gcs: int | None = None
    on_oxygen: bool | None = None
    source: str | None = None


def _seed_n(patient_id: str) -> int:
    digits = "".join(c for c in patient_id if c.isdigit())
    return int(digits) if digits else 0


def _seed_vitals(patient: dict) -> dict:
    """Deterministic seeded vitals, same convention as the rest of the app's synthetic-but-stored data."""
    seed = _seed_n(patient["id"])
    bands = {
        "critical": {"hr": 118 + seed % 10, "sbp": 82 + seed % 8, "dbp": 50 + seed % 6, "spo2": 86 + seed % 3, "temp": 39.1, "rr": 30 + seed % 4, "gcs": 13, "on_oxygen": True},
        "high":     {"hr": 104 + seed % 8, "sbp": 148 + seed % 8, "dbp": 92 + seed % 5, "spo2": 92 + seed % 3, "temp": 38.4, "rr": 22 + seed % 3, "gcs": 15, "on_oxygen": False},
        "medium":   {"hr": 88 + seed % 6, "sbp": 138 + seed % 6, "dbp": 86 + seed % 4, "spo2": 94 + seed % 2, "temp": 38.1, "rr": 18 + seed % 2, "gcs": 15, "on_oxygen": False},
        "low":      {"hr": 76 + seed % 5, "sbp": 128 + seed % 5, "dbp": 82 + seed % 4, "spo2": 97, "temp": 36.8, "rr": 14 + seed % 2, "gcs": 15, "on_oxygen": False},
    }
    band = bands.get(patient.get("risk", "medium"), bands["medium"])
    return {"patient_id": patient["id"], "source": "Simulated Monitor", **band}


@router.get("")
def get_latest_vitals(patient_id: str):
    """Returns the patient's latest stored vitals, generating and persisting one server-side if none exists yet."""
    db = require_db()
    res = (
        db.table("vitals").select("*").eq("patient_id", patient_id)
        .order("recorded_at", desc=True).limit(1).maybe_single().execute()
    )
    existing = res.data if res else None
    if existing:
        return existing

    patient_res = db.table("patients").select("*").eq("id", patient_id).maybe_single().execute()
    patient = patient_res.data if patient_res else None
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    seeded = _seed_vitals(patient)
    res = db.table("vitals").insert(seeded).execute()
    return res.data[0]


@router.post("", status_code=201)
def create_vitals(body: VitalsCreate):
    db = require_db()
    res = db.table("vitals").insert(body.model_dump()).execute()
    return res.data[0]


@router.get("/history")
def list_vitals_history(patient_id: str, limit: int = 100):
    db = require_db()
    rows = (
        db.table("vitals").select("*").eq("patient_id", patient_id)
        .order("recorded_at", desc=True).limit(limit).execute().data
    )
    return {"history": rows}


@router.put("/{vitals_id}")
def update_vitals(vitals_id: int, body: VitalsUpdate):
    db = require_db()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = db.table("vitals").update(updates).eq("id", vitals_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Vitals record not found")
    return res.data[0]


@router.delete("/{vitals_id}", status_code=204)
def delete_vitals(vitals_id: int):
    db = require_db()
    res = db.table("vitals").delete().eq("id", vitals_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Vitals record not found")
