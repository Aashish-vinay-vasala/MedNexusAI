from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db import require_db

router = APIRouter(prefix="/api/v1", tags=["doctors"])


class DoctorCreate(BaseModel):
    name: str
    specialty: str
    status: str = "Available"
    max_patients: int = 8
    color: str = "#0EA5E9"


class DoctorUpdate(BaseModel):
    name: str | None = None
    specialty: str | None = None
    status: str | None = None
    max_patients: int | None = None
    color: str | None = None


@router.get("/doctors")
def list_doctors():
    db = require_db()
    return db.table("doctors").select("*").order("id").execute().data


@router.post("/doctors", status_code=201)
def create_doctor(body: DoctorCreate):
    db = require_db()
    res = db.table("doctors").insert(body.model_dump()).execute()
    return res.data[0]


@router.put("/doctors/{doctor_id}")
def update_doctor(doctor_id: int, body: DoctorUpdate):
    db = require_db()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = db.table("doctors").update(updates).eq("id", doctor_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return res.data[0]


@router.delete("/doctors/{doctor_id}", status_code=204)
def delete_doctor(doctor_id: int):
    db = require_db()
    res = db.table("doctors").delete().eq("id", doctor_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Doctor not found")


# ---------- Doctor assignments ----------

class AssignmentRow(BaseModel):
    patient_id: str
    doctor_id: int


class AssignmentsSave(BaseModel):
    assignments: list[AssignmentRow]


@router.get("/doctor-assignments")
def list_doctor_assignments():
    db = require_db()
    return db.table("doctor_assignments").select("*").execute().data


@router.put("/doctor-assignments")
def save_doctor_assignments(body: AssignmentsSave):
    db = require_db()
    rows = [a.model_dump() for a in body.assignments]
    if not rows:
        return []
    res = db.table("doctor_assignments").upsert(rows, on_conflict="patient_id").execute()
    return res.data
