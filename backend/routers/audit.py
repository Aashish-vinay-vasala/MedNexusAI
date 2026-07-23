from fastapi import APIRouter
from pydantic import BaseModel

from db import require_db

router = APIRouter(prefix="/api/v1/audit-log", tags=["audit"])


class AuditEntryCreate(BaseModel):
    actor: str = "clinician"
    action: str
    resource_type: str
    resource_id: str | None = None
    patient_id: str | None = None
    detail: str | None = None


@router.get("")
def list_audit_log(limit: int = 100):
    db = require_db()
    return db.table("audit_log").select("*").order("created_at", desc=True).limit(limit).execute().data


@router.post("", status_code=201)
def create_audit_entry(body: AuditEntryCreate):
    """Audit trail — deliberately no PUT/DELETE, entries are immutable."""
    db = require_db()
    res = db.table("audit_log").insert(body.model_dump()).execute()
    return res.data[0]
