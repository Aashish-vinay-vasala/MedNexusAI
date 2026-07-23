from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db import require_db

router = APIRouter(prefix="/api/v1/alerts", tags=["alerts"])


class AlertCreate(BaseModel):
    type: str
    patient: str
    patient_id: str | None = None
    detail: str
    time_ago: str
    severity: str
    color: str
    source: str
    category: str | None = None
    acknowledged: bool = False
    escalated: bool = False


class AlertPatch(BaseModel):
    acknowledged: bool | None = None
    escalated: bool | None = None


class AlertUpdate(BaseModel):
    type: str | None = None
    patient: str | None = None
    patient_id: str | None = None
    detail: str | None = None
    severity: str | None = None
    color: str | None = None
    source: str | None = None
    category: str | None = None


@router.get("")
def list_alerts():
    db = require_db()
    return db.table("clinical_alerts").select("*").order("created_at", desc=True).execute().data


@router.post("", status_code=201)
def create_alert(body: AlertCreate):
    db = require_db()
    res = db.table("clinical_alerts").insert(body.model_dump()).execute()
    alert = res.data[0]

    if body.patient_id:
        db.table("patient_events").insert({
            "patient_id": body.patient_id,
            "kind": "alert",
            "label": body.type,
            "detail": body.detail,
            "color": body.color,
            "source": body.source,
        }).execute()

    return alert


@router.patch("/{alert_id}")
def patch_alert(alert_id: int, body: AlertPatch):
    db = require_db()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = db.table("clinical_alerts").update(updates).eq("id", alert_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Alert not found")
    return res.data[0]


@router.put("/{alert_id}")
def update_alert(alert_id: int, body: AlertUpdate):
    db = require_db()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = db.table("clinical_alerts").update(updates).eq("id", alert_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Alert not found")
    return res.data[0]


@router.delete("/{alert_id}", status_code=204)
def delete_alert(alert_id: int):
    db = require_db()
    res = db.table("clinical_alerts").delete().eq("id", alert_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Alert not found")
