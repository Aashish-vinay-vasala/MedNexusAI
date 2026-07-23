from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db import require_db

router = APIRouter(prefix="/api/v1", tags=["ehr"])


# ---------- Diagnoses ----------

class DiagnosisCreate(BaseModel):
    patient_id: str
    code: str
    description: str


class DiagnosisUpdate(BaseModel):
    code: str | None = None
    description: str | None = None


@router.get("/ehr/diagnoses")
def list_diagnoses(patient_id: str | None = None):
    db = require_db()
    query = db.table("ehr_diagnoses").select("*").order("recorded_at", desc=True)
    if patient_id:
        query = query.eq("patient_id", patient_id)
    return query.execute().data


@router.post("/ehr/diagnoses", status_code=201)
def create_diagnosis(body: DiagnosisCreate):
    db = require_db()
    res = db.table("ehr_diagnoses").insert(body.model_dump()).execute()
    return res.data[0]


@router.put("/ehr/diagnoses/{diagnosis_id}")
def update_diagnosis(diagnosis_id: int, body: DiagnosisUpdate):
    db = require_db()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = db.table("ehr_diagnoses").update(updates).eq("id", diagnosis_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Diagnosis not found")
    return res.data[0]


@router.delete("/ehr/diagnoses/{diagnosis_id}", status_code=204)
def delete_diagnosis(diagnosis_id: int):
    db = require_db()
    res = db.table("ehr_diagnoses").delete().eq("id", diagnosis_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Diagnosis not found")


@router.get("/diagnoses")
def list_all_diagnoses():
    db = require_db()
    rows = db.table("ehr_diagnoses").select("code, description").execute().data
    seen = {}
    for r in rows:
        seen[r["code"]] = r
    return list(seen.values())


# ---------- Medications ----------

class MedicationCreate(BaseModel):
    patient_id: str
    name: str
    dose: str
    route: str
    frequency: str
    active: bool = True


class MedicationUpdate(BaseModel):
    name: str | None = None
    dose: str | None = None
    route: str | None = None
    frequency: str | None = None
    active: bool | None = None


@router.get("/ehr/medications")
def list_medications(patient_id: str | None = None):
    db = require_db()
    query = db.table("ehr_medications").select("*").order("recorded_at", desc=True)
    if patient_id:
        query = query.eq("patient_id", patient_id)
    return query.execute().data


@router.post("/ehr/medications", status_code=201)
def create_medication(body: MedicationCreate):
    db = require_db()
    res = db.table("ehr_medications").insert(body.model_dump()).execute()
    return res.data[0]


@router.put("/ehr/medications/{medication_id}")
def update_medication(medication_id: int, body: MedicationUpdate):
    db = require_db()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = db.table("ehr_medications").update(updates).eq("id", medication_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Medication not found")
    return res.data[0]


@router.delete("/ehr/medications/{medication_id}", status_code=204)
def delete_medication(medication_id: int):
    db = require_db()
    res = db.table("ehr_medications").delete().eq("id", medication_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Medication not found")


# ---------- ICD-10 assignments ----------

class ICD10AssignmentCreate(BaseModel):
    patient_id: str
    code: str
    description: str
    confidence: float | None = None


class ICD10AssignmentUpdate(BaseModel):
    code: str | None = None
    description: str | None = None
    confidence: float | None = None


@router.get("/ehr/icd10-assignments")
def list_icd10_assignments(patient_id: str | None = None):
    db = require_db()
    query = db.table("icd10_assignments").select("*").order("assigned_at", desc=True)
    if patient_id:
        query = query.eq("patient_id", patient_id)
    return query.execute().data


@router.post("/ehr/icd10-assignments", status_code=201)
def create_icd10_assignment(body: ICD10AssignmentCreate):
    db = require_db()
    res = db.table("icd10_assignments").insert(body.model_dump()).execute()
    return res.data[0]


@router.get("/ehr/icd10-assignments/{assignment_id}")
def get_icd10_assignment(assignment_id: int):
    db = require_db()
    res = db.table("icd10_assignments").select("*").eq("id", assignment_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return res.data[0]


@router.put("/ehr/icd10-assignments/{assignment_id}")
def update_icd10_assignment(assignment_id: int, body: ICD10AssignmentUpdate):
    db = require_db()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = db.table("icd10_assignments").update(updates).eq("id", assignment_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return res.data[0]


@router.delete("/ehr/icd10-assignments/{assignment_id}", status_code=204)
def delete_icd10_assignment(assignment_id: int):
    db = require_db()
    res = db.table("icd10_assignments").delete().eq("id", assignment_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Assignment not found")


# ---------- Prescriptions ----------

class PrescriptionCreate(BaseModel):
    patient_id: str
    drug: str
    dose: str
    route: str
    frequency: str
    duration: str
    prescriber: str
    warnings: list[dict] = []


@router.get("/prescriptions")
def list_prescriptions(patient_id: str | None = None):
    db = require_db()
    query = db.table("prescriptions").select("*").order("issued_at", desc=True)
    if patient_id:
        query = query.eq("patient_id", patient_id)
    return query.execute().data


@router.post("/prescriptions", status_code=201)
def create_prescription(body: PrescriptionCreate):
    db = require_db()
    res = db.table("prescriptions").insert(body.model_dump()).execute()
    return res.data[0]


@router.delete("/prescriptions/{prescription_id}", status_code=204)
def delete_prescription(prescription_id: int):
    db = require_db()
    res = db.table("prescriptions").delete().eq("id", prescription_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Prescription not found")
