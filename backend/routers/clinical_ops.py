from fastapi import APIRouter
from pydantic import BaseModel

from db import require_db

router = APIRouter(prefix="/api/v1", tags=["clinical_ops"])


# ---------- Admissions (read-only history) ----------

@router.get("/admissions")
def list_admissions():
    db = require_db()
    return db.table("admissions_daily").select("*").order("date").limit(7).execute().data


# ---------- Resource forecast ----------

class ForecastRow(BaseModel):
    day_label: str
    bed_usage: int
    staffing: int


class ForecastSave(BaseModel):
    rows: list[ForecastRow]


@router.get("/forecast")
def list_forecast():
    db = require_db()
    return db.table("resource_forecast").select("*").order("id").limit(7).execute().data


@router.put("/forecast")
def save_forecast(body: ForecastSave):
    """Bulk-replaces the stored forecast with a freshly backend-computed set
    (POST /api/v1/forecast/beds) — mirrors the previous delete-all/insert-7 pattern."""
    db = require_db()
    db.table("resource_forecast").delete().gte("id", 0).execute()
    res = db.table("resource_forecast").insert([r.model_dump() for r in body.rows]).execute()
    return res.data


# ---------- Activity feed ----------

class ActivityCreate(BaseModel):
    icon_name: str
    color: str
    label: str
    detail: str
    time_ago: str


@router.get("/activity")
def list_activity():
    db = require_db()
    return db.table("activity_feed").select("*").order("created_at", desc=True).limit(10).execute().data


@router.post("/activity", status_code=201)
def create_activity(body: ActivityCreate):
    db = require_db()
    res = db.table("activity_feed").insert(body.model_dump()).execute()
    return res.data[0]


# ---------- Bed usage history (read-only) ----------

@router.get("/bed-usage")
def list_bed_usage():
    db = require_db()
    return db.table("bed_usage_daily").select("*").order("date").execute().data
