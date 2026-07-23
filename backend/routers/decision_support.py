"""Decision Support: drug-interaction checker (pairwise and multi-drug regimen), backed by
a persisted, device-scoped history table (decision_support_runs, schema_additions_7.sql)
with CRUD, PDF export, and stats for the module's charts. See decision_support.py for the
interaction-lookup logic and pdf_report.py for the PDF builders.
"""

import os
from typing import Literal

from fastapi import APIRouter, HTTPException, Response
from groq import Groq
from pydantic import BaseModel

import decision_support
import pdf_report
from db import require_db

router = APIRouter(prefix="/api/v1/decision-support", tags=["decision-support"])

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

TABLE = "decision_support_runs"
SUMMARY_COLUMNS = "id,mode,patient_id,patient_name,drugs,highest_severity,interaction_count,status,created_at"


class InteractionCheckRequest(BaseModel):
    drug_a: str
    drug_b: str


class RegimenCheckRequest(BaseModel):
    drugs: list[str]


class DecisionRunRequest(BaseModel):
    device_id: str
    mode: Literal["pairwise", "regimen"]
    drug_a: str | None = None
    drug_b: str | None = None
    drugs: list[str] | None = None
    patient_id: str | None = None
    patient_name: str | None = None


class ExportPdfRequest(BaseModel):
    device_id: str
    ids: list[int]


class DecisionRunUpdate(BaseModel):
    device_id: str
    patient_id: str | None = None
    patient_name: str | None = None


def _get_owned_record(db, record_id: int, device_id: str) -> dict:
    rows = (
        db.table(TABLE).select("*")
        .eq("id", record_id).eq("device_id", device_id).execute().data
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Record not found")
    return rows[0]


# ─── Stateless lookups (no persistence — used for live-typing feedback) ──────────

@router.post("/check")
def check(req: InteractionCheckRequest):
    db = require_db()
    return decision_support.check_interaction_enriched(req.drug_a, req.drug_b, groq_client, db)


@router.post("/check-regimen")
def check_regimen(req: RegimenCheckRequest):
    return {"interactions": decision_support.check_regimen(req.drugs)}


# ─── Persisted runs (history) ─────────────────────────────────────────────────

@router.post("/run", status_code=201)
def run_check(req: DecisionRunRequest):
    db = require_db()

    row: dict = {
        "device_id": req.device_id,
        "mode": req.mode,
        "patient_id": req.patient_id,
        "patient_name": req.patient_name,
    }

    try:
        if req.mode == "pairwise":
            if not req.drug_a or not req.drug_b:
                raise ValueError("drug_a and drug_b are required for a pairwise check")
            drugs = [req.drug_a, req.drug_b]
            result = decision_support.check_interaction_enriched(req.drug_a, req.drug_b, groq_client, db)
            interactions = [{"drug_a": req.drug_a, "drug_b": req.drug_b, **result}] if result["interacts"] else []
        else:
            if not req.drugs or len(req.drugs) < 2:
                raise ValueError("at least 2 drugs are required for a regimen check")
            drugs = req.drugs
            interactions = decision_support.check_regimen(req.drugs)

        row["drugs"] = drugs
        row["interactions"] = interactions
        row["highest_severity"] = decision_support.highest_severity(interactions)
        row["interaction_count"] = len(interactions)
        row["status"] = "success"
    except ValueError as exc:
        row["drugs"] = req.drugs or [d for d in (req.drug_a, req.drug_b) if d]
        row["interactions"] = []
        row["highest_severity"] = None
        row["interaction_count"] = 0
        row["status"] = "error"
        row["error_message"] = str(exc)

    saved = db.table(TABLE).insert(row).execute().data[0]
    return saved


@router.get("/history")
def list_history(
    device_id: str,
    mode: str | None = None,
    patient_id: str | None = None,
    limit: int = 50,
):
    db = require_db()
    q = db.table(TABLE).select(SUMMARY_COLUMNS).eq("device_id", device_id)
    if mode:
        q = q.eq("mode", mode)
    if patient_id:
        q = q.eq("patient_id", patient_id)
    rows = q.order("created_at", desc=True).limit(limit).execute().data
    return {"history": rows}


@router.get("/history/{record_id}")
def get_history_record(record_id: int, device_id: str):
    db = require_db()
    return _get_owned_record(db, record_id, device_id)


@router.patch("/history/{record_id}")
def update_history_record(record_id: int, body: DecisionRunUpdate):
    """Relabels a saved run's patient linkage (patient_id/patient_name). The computed
    drugs/interactions/severity are immutable results of the check itself, so only this
    denormalized metadata is editable — re-running the check creates a new history row."""
    db = require_db()
    _get_owned_record(db, record_id, body.device_id)
    updates = {k: v for k, v in (("patient_id", body.patient_id), ("patient_name", body.patient_name)) if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = db.table(TABLE).update(updates).eq("id", record_id).execute()
    return res.data[0]


@router.delete("/history/{record_id}")
def delete_history_record(record_id: int, device_id: str):
    db = require_db()
    _get_owned_record(db, record_id, device_id)
    db.table(TABLE).delete().eq("id", record_id).execute()
    return {"status": "deleted"}


@router.get("/stats")
def get_stats(device_id: str):
    db = require_db()
    rows = (
        db.table(TABLE).select("mode,status,highest_severity,drugs,created_at")
        .eq("device_id", device_id)
        .order("created_at", desc=True)
        .limit(500)
        .execute()
        .data
    )

    by_mode: dict[str, int] = {}
    by_day: dict[str, int] = {}
    severity_freq: dict[str, int] = {"critical": 0, "high": 0, "medium": 0, "none": 0}
    drug_freq: dict[str, int] = {}
    success_count = 0
    error_count = 0
    for r in rows:
        by_mode[r["mode"]] = by_mode.get(r["mode"], 0) + 1
        day = (r.get("created_at") or "")[:10]
        if day:
            by_day[day] = by_day.get(day, 0) + 1
        if r.get("status") == "success":
            success_count += 1
        else:
            error_count += 1
        severity_freq[r.get("highest_severity") or "none"] += 1
        for d in r.get("drugs") or []:
            drug_freq[d] = drug_freq.get(d, 0) + 1

    last_14_days = sorted(by_day.keys())[-14:]
    top_drugs = sorted(drug_freq.items(), key=lambda kv: kv[1], reverse=True)[:8]

    return {
        "by_mode": [{"mode": k, "count": v} for k, v in sorted(by_mode.items())],
        "by_day": [{"date": d, "count": by_day[d]} for d in last_14_days],
        "severity_freq": [{"severity": k, "count": v} for k, v in severity_freq.items()],
        "top_drugs": [{"drug": k, "count": v} for k, v in top_drugs],
        "success_count": success_count,
        "error_count": error_count,
    }


@router.get("/history/{record_id}/pdf")
def download_pdf(record_id: int, device_id: str):
    db = require_db()
    record = _get_owned_record(db, record_id, device_id)
    pdf_bytes = pdf_report.build_decision_support_pdf(record)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="decision-support-run-{record_id}.pdf"'},
    )


@router.post("/history/export-pdf")
def export_pdf(req: ExportPdfRequest):
    db = require_db()
    rows = (
        db.table(TABLE).select("*")
        .eq("device_id", req.device_id).in_("id", req.ids)
        .order("created_at", desc=True)
        .execute().data
    )
    if not rows:
        raise HTTPException(status_code=404, detail="No matching records found")

    stats = get_stats(req.device_id)
    pdf_bytes = pdf_report.build_decision_support_bundle_pdf(rows, stats)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="decision-support-history-export.pdf"'},
    )
