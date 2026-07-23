import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db import require_db

router = APIRouter(prefix="/api/v1/patients", tags=["patients"])

# Commas/parens are structural delimiters in PostgREST's `or=(...)` filter syntax;
# left unescaped in a search term (e.g. "Whitfield, James") they crash the query
# with a PGRST100 parse error, so strip them before building the filter string.
_UNSAFE_OR_FILTER_CHARS = re.compile(r"[,()]")


class PatientCreate(BaseModel):
    id: str
    name: str
    ward: str
    risk: str
    age: int
    status: str


class PatientUpdate(BaseModel):
    name: str | None = None
    ward: str | None = None
    risk: str | None = None
    age: int | None = None
    status: str | None = None


@router.get("")
def list_patients(q: str | None = None, limit: int | None = None):
    db = require_db()
    query = db.table("patients").select("*").order("created_at", desc=True)
    if q:
        safe_q = _UNSAFE_OR_FILTER_CHARS.sub(" ", q).strip()
        if safe_q:
            query = query.or_(f"id.ilike.%{safe_q}%,name.ilike.%{safe_q}%")
    if limit:
        query = query.limit(limit)
    return query.execute().data


@router.post("", status_code=201)
def create_patient(body: PatientCreate):
    db = require_db()
    existing = db.table("patients").select("id").eq("id", body.id).execute().data
    if existing:
        raise HTTPException(status_code=409, detail=f"Patient {body.id} already exists")
    res = db.table("patients").insert(body.model_dump()).execute()
    return res.data[0]


@router.put("/{patient_id}")
def update_patient(patient_id: str, body: PatientUpdate):
    db = require_db()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = db.table("patients").update(updates).eq("id", patient_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Patient not found")
    return res.data[0]


@router.delete("/{patient_id}", status_code=204)
def delete_patient(patient_id: str):
    db = require_db()
    res = db.table("patients").delete().eq("id", patient_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Patient not found")
