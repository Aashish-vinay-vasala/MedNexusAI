from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db import require_db

router = APIRouter(prefix="/api/v1/risk-scores", tags=["risk"])


class RiskScoreRow(BaseModel):
    patient_id: str
    dimension: str
    score: float


class RiskScoresSave(BaseModel):
    scores: list[RiskScoreRow]


@router.get("")
def list_risk_scores(patient_id: str | None = None):
    db = require_db()
    query = db.table("patient_risk_scores").select("*")
    if patient_id:
        query = query.eq("patient_id", patient_id)
    return query.execute().data


@router.put("")
def save_risk_scores(body: RiskScoresSave):
    """Persists a freshly backend-computed score set (POST /api/v1/risk/score)."""
    db = require_db()
    rows = [s.model_dump() for s in body.scores]
    if not rows:
        return []
    res = db.table("patient_risk_scores").upsert(rows, on_conflict="patient_id,dimension").execute()
    return res.data


@router.delete("/{score_id}", status_code=204)
def delete_risk_score(score_id: int):
    db = require_db()
    res = db.table("patient_risk_scores").delete().eq("id", score_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Risk score not found")
