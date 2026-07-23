from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db import require_db

router = APIRouter(prefix="/api/v1/claims", tags=["claims"])


class ClaimCreate(BaseModel):
    patient_id: str
    icd10_codes: list[str] = []
    procedure_summary: str | None = None
    status: str = "draft"
    amount: float | None = None


class ClaimStatusUpdate(BaseModel):
    status: str


@router.get("")
def list_claims(patient_id: str | None = None):
    db = require_db()
    query = db.table("insurance_claims").select("*").order("created_at", desc=True)
    if patient_id:
        query = query.eq("patient_id", patient_id)
    return query.execute().data


@router.post("", status_code=201)
def create_claim(body: ClaimCreate):
    """Persists a claim already previewed via POST /api/v1/claims/generate."""
    db = require_db()
    res = db.table("insurance_claims").insert(body.model_dump()).execute()
    return res.data[0]


@router.patch("/{claim_id}")
def update_claim_status(claim_id: int, body: ClaimStatusUpdate):
    if body.status not in ("draft", "submitted", "paid", "denied"):
        raise HTTPException(status_code=400, detail="Invalid status")
    db = require_db()
    res = db.table("insurance_claims").update({"status": body.status}).eq("id", claim_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Claim not found")
    return res.data[0]
