import json
import os

from fastapi import APIRouter, HTTPException, Response
from groq import Groq
from pydantic import BaseModel

import pdf_report
from db import require_db

router = APIRouter(prefix="/api/v1", tags=["fhir"])

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
CHAT_MODEL = "llama-3.3-70b-versatile"


# ---------- FHIR resources ----------

class FHIRResourceUpsert(BaseModel):
    patient_id: str
    resource_type: str
    resource_json: dict
    version_id: str = "1"


@router.get("/fhir/resources")
def list_fhir_resources(patient_id: str | None = None):
    db = require_db()
    query = db.table("fhir_resources").select("*")
    if patient_id:
        query = query.eq("patient_id", patient_id)
    return query.execute().data


@router.post("/fhir/resources", status_code=201)
def upsert_fhir_resource(body: FHIRResourceUpsert):
    db = require_db()
    res = db.table("fhir_resources").upsert(
        body.model_dump(), on_conflict="patient_id,resource_type",
    ).execute()
    return res.data[0]


@router.get("/fhir/resources/stats")
def get_fhir_resource_stats():
    """System-wide resource-type distribution, for the FHIR Explorer's overview chart."""
    db = require_db()
    rows = db.table("fhir_resources").select("resource_type").execute().data
    by_type: dict[str, int] = {}
    for r in rows:
        rt = r.get("resource_type") or "Unknown"
        by_type[rt] = by_type.get(rt, 0) + 1
    return {"by_type": [{"type": k, "count": v} for k, v in sorted(by_type.items())], "total": len(rows)}


@router.delete("/fhir/resources/{patient_id}/{resource_type}", status_code=204)
def delete_fhir_resource(patient_id: str, resource_type: str):
    db = require_db()
    res = db.table("fhir_resources").delete().eq("patient_id", patient_id).eq("resource_type", resource_type).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Resource not found")


class PatientReportRequest(BaseModel):
    patient_name: str | None = None
    description: str | None = None


@router.post("/fhir/resources/{patient_id}/pdf")
def download_patient_fhir_pdf(patient_id: str, body: PatientReportRequest):
    db = require_db()
    resources = db.table("fhir_resources").select("*").eq("patient_id", patient_id).execute().data
    if not resources:
        raise HTTPException(status_code=404, detail="No FHIR resources found for this patient")
    pdf_bytes = pdf_report.build_patient_fhir_report_pdf(patient_id, body.patient_name, resources, body.description)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="fhir-report-{patient_id}.pdf"'},
    )


@router.post("/fhir/resources/{patient_id}/describe")
def describe_patient_fhir(patient_id: str):
    if not os.getenv("GROQ_API_KEY"):
        raise HTTPException(status_code=503, detail="GROQ_API_KEY not configured")

    db = require_db()
    resources = (
        db.table("fhir_resources").select("resource_type,resource_json")
        .eq("patient_id", patient_id).execute().data
    )
    if not resources:
        raise HTTPException(status_code=404, detail="No FHIR resources found for this patient")

    prompt = f"""You are MedNexusAI Assistant. Summarize this patient's FHIR R4 resource set in plain language for a clinician glancing at their chart, in 3-5 concise sentences. Mention key conditions, medications, and encounters. Do not restate raw JSON.

FHIR RESOURCES:
{json.dumps(resources, indent=2)}"""

    try:
        response = groq_client.chat.completions.create(
            model=CHAT_MODEL, messages=[{"role": "user", "content": prompt}], max_tokens=400, temperature=0.3,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Groq request failed: {exc}")

    return {"description": response.choices[0].message.content or ""}


# ---------- Patient events (timeline) ----------

class PatientEventCreate(BaseModel):
    patient_id: str
    kind: str
    label: str
    detail: str
    color: str = "#8B5CF6"
    source: str = "System"


@router.get("/patients/{patient_id}/events")
def list_patient_events(patient_id: str):
    db = require_db()
    return (
        db.table("patient_events")
        .select("*")
        .eq("patient_id", patient_id)
        .order("occurred_at", desc=True)
        .execute()
        .data
    )


@router.post("/patient-events", status_code=201)
def create_patient_event(body: PatientEventCreate):
    db = require_db()
    res = db.table("patient_events").insert(body.model_dump()).execute()
    return res.data[0]
