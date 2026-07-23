from fastapi import APIRouter
from pydantic import BaseModel
from datetime import datetime, timezone

from db import require_db

router = APIRouter(prefix="/api/v1/kpi", tags=["kpi"])


class KPISave(BaseModel):
    total_active: int
    icu_patients: int
    icu_critical: int
    high_risk: int
    available_beds: int
    bed_capacity_pct: float
    pending_alerts: int
    alert_critical: int
    todays_admissions: int
    admissions_change_pct: float


@router.get("")
def get_kpi():
    db = require_db()
    res = db.table("kpi_snapshot").select("*").eq("id", 1).single().execute()
    return res.data


@router.put("")
def save_kpi(body: KPISave):
    """Persists a freshly backend-computed KPI set (POST /api/v1/kpi/recompute), deriving
    real day-over-day deltas from whatever was previously stored."""
    db = require_db()
    prev_res = db.table("kpi_snapshot").select("*").eq("id", 1).maybe_single().execute()
    prev = prev_res.data if prev_res else None

    row = {
        "id": 1,
        **body.model_dump(),
        "total_active_change": (body.total_active - prev["total_active"]) if prev else 0,
        "high_risk_change": (body.high_risk - prev["high_risk"]) if prev else 0,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    res = db.table("kpi_snapshot").upsert(row, on_conflict="id").execute()
    return res.data[0]
