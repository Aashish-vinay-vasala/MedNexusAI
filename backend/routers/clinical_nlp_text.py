"""Merged Clinical NLP Pipeline + Clinical Text Generation endpoint: MedSpaCy entity
extraction and Groq-based note/report/discharge-letter generation, backed by a single
persisted, device-scoped history table (clinical_language_runs, schema_additions_6.sql)
with full CRUD, versioned re-runs, PDF export, and stats for the module's charts. See
clinical_text.py for the Groq prompt/generation logic and pdf_report.py for the PDF
builders.
"""

import os
from typing import Literal

from fastapi import APIRouter, HTTPException, Response
from groq import Groq
from pydantic import BaseModel

import clinical_text
import nlp
import pdf_report
from db import require_db

router = APIRouter(prefix="/api/v1/clinical", tags=["clinical-nlp-text"])

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

TABLE = "clinical_language_runs"
SUMMARY_COLUMNS = "id,mode,patient_id,patient_name,status,version,root_id,created_at"


class ClinicalRunRequest(BaseModel):
    device_id: str
    mode: Literal["nlp_analyze", "note_summary", "report_summary", "discharge_letter"]
    patient_id: str | None = None
    patient_name: str | None = None
    risk: str | None = None
    ward: str | None = None
    note_text: str | None = None
    lab_report: str | None = None
    input_meta: dict | None = None
    parent_id: int | None = None


class ExportPdfRequest(BaseModel):
    device_id: str
    ids: list[int]


def _get_owned_record(db, record_id: int, device_id: str) -> dict:
    rows = (
        db.table(TABLE).select("*")
        .eq("id", record_id).eq("device_id", device_id).execute().data
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Record not found")
    return rows[0]


@router.post("/run", status_code=201)
def run_clinical(req: ClinicalRunRequest):
    db = require_db()

    parent = None
    if req.parent_id is not None:
        parent = _get_owned_record(db, req.parent_id, req.device_id)

    row: dict = {
        "device_id": req.device_id,
        "mode": req.mode,
        "patient_id": req.patient_id,
        "patient_name": req.patient_name,
        "risk": req.risk,
        "ward": req.ward,
        "input_meta": req.input_meta,
        "parent_id": parent["id"] if parent else None,
        "version": (parent["version"] + 1) if parent else 1,
    }
    if parent:
        row["root_id"] = parent["root_id"]

    if req.mode == "nlp_analyze":
        row["input_text"] = req.note_text
        try:
            row["output_entities"] = nlp.analyze_note(req.note_text or "")
            row["status"] = "success"
        except Exception as exc:
            row["status"] = "error"
            row["error_message"] = str(exc)
    else:
        row["input_text"] = req.note_text if req.mode == "note_summary" else req.lab_report
        if not os.getenv("GROQ_API_KEY"):
            row["status"] = "error"
            row["error_message"] = "GROQ_API_KEY not configured"
        else:
            try:
                row["output_text"] = clinical_text.generate(
                    groq_client, req.mode,
                    patient_id=req.patient_id or "N/A", name=req.patient_name or "Unknown",
                    risk=req.risk or "medium", ward=req.ward,
                    note_text=req.note_text, lab_report=req.lab_report,
                )
                row["status"] = "success"
            except Exception as exc:
                row["status"] = "error"
                row["error_message"] = str(exc)

    saved = db.table(TABLE).insert(row).execute().data[0]

    if not parent:
        db.table(TABLE).update({"root_id": saved["id"]}).eq("id", saved["id"]).execute()
        saved["root_id"] = saved["id"]

    return saved


@router.get("/history")
def list_history(
    device_id: str,
    mode: str | None = None,
    patient_id: str | None = None,
    latest_only: bool = True,
    limit: int = 50,
):
    db = require_db()
    q = db.table(TABLE).select(SUMMARY_COLUMNS).eq("device_id", device_id)
    if mode:
        q = q.eq("mode", mode)
    if patient_id:
        q = q.eq("patient_id", patient_id)
    rows = q.order("created_at", desc=True).limit(500 if latest_only else limit).execute().data

    if latest_only:
        latest_by_root: dict[int, dict] = {}
        for r in rows:
            existing = latest_by_root.get(r["root_id"])
            if existing is None or r["version"] > existing["version"]:
                latest_by_root[r["root_id"]] = r
        rows = sorted(latest_by_root.values(), key=lambda r: r["created_at"], reverse=True)[:limit]

    return {"history": rows}


@router.get("/history/{record_id}")
def get_history_record(record_id: int, device_id: str):
    db = require_db()
    return _get_owned_record(db, record_id, device_id)


@router.get("/history/{record_id}/versions")
def get_history_versions(record_id: int, device_id: str):
    db = require_db()
    record = _get_owned_record(db, record_id, device_id)
    rows = (
        db.table(TABLE).select(SUMMARY_COLUMNS)
        .eq("device_id", device_id).eq("root_id", record["root_id"])
        .order("version", desc=False)
        .execute().data
    )
    return {"versions": rows}


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
        db.table(TABLE).select("mode,status,created_at,output_entities")
        .eq("device_id", device_id)
        .order("created_at", desc=True)
        .limit(500)
        .execute()
        .data
    )

    by_mode: dict[str, int] = {}
    by_day: dict[str, int] = {}
    entity_type_freq: dict[str, int] = {}
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
        for ent in r.get("output_entities") or []:
            t = ent.get("type") or "UNKNOWN"
            entity_type_freq[t] = entity_type_freq.get(t, 0) + 1

    last_14_days = sorted(by_day.keys())[-14:]
    return {
        "by_mode": [{"mode": k, "count": v} for k, v in sorted(by_mode.items())],
        "by_day": [{"date": d, "count": by_day[d]} for d in last_14_days],
        "entity_type_freq": [{"type": k, "count": v} for k, v in sorted(entity_type_freq.items())],
        "success_count": success_count,
        "error_count": error_count,
    }


@router.get("/history/{record_id}/pdf")
def download_pdf(record_id: int, device_id: str):
    db = require_db()
    record = _get_owned_record(db, record_id, device_id)
    pdf_bytes = pdf_report.build_clinical_run_pdf(record)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="clinical-run-{record_id}.pdf"'},
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
    pdf_bytes = pdf_report.build_clinical_bundle_pdf(rows, stats)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="clinical-history-export.pdf"'},
    )
