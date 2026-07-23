"""HL7 v2 -> FHIR R4 conversion endpoint plus persisted, device-scoped conversion history:
on-demand PDF report generation, on-demand AI result descriptions, and activity stats for the
HL7 -> FHIR Converter page's charts. See hl7_fhir.py for the conversion logic and pdf_report.py
for the PDF builder.
"""

import json
import os

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Response
from groq import Groq

import hl7_fhir
import pdf_report
from db import require_db

router = APIRouter(prefix="/api/v1/hl7", tags=["hl7"])

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
CHAT_MODEL = "llama-3.3-70b-versatile"

MAX_HL7_BYTES = 2 * 1024 * 1024


def _get_owned_record(db, record_id: int, device_id: str) -> dict:
    rows = (
        db.table("hl7_conversions").select("*")
        .eq("id", record_id).eq("device_id", device_id).execute().data
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Record not found")
    return rows[0]


@router.post("/convert", status_code=201)
async def convert_hl7(
    file: UploadFile | None = File(None),
    hl7_text: str | None = Form(None),
    device_id: str = Form(...),
):
    row: dict = {"device_id": device_id, "source": "paste", "filename": None, "file_size": None}

    if file is not None:
        raw = await file.read()
        if len(raw) > MAX_HL7_BYTES:
            raise HTTPException(status_code=413, detail="File too large (max 2MB)")
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError:
            raise HTTPException(status_code=400, detail="File is not valid UTF-8 text")
        row["source"] = "upload"
        row["filename"] = file.filename
        row["file_size"] = len(raw)
    elif hl7_text and hl7_text.strip():
        text = hl7_text
    else:
        raise HTTPException(status_code=400, detail="Provide either a file or hl7_text")

    row["hl7_input"] = text

    try:
        row["message_type"] = hl7_fhir.parse_message_type(text)
        row["fhir_output"] = hl7_fhir.convert(text)
        row["status"] = "success"
    except ValueError as exc:
        row["status"] = "error"
        row["error_message"] = str(exc)

    db = require_db()
    saved = db.table("hl7_conversions").insert(row).execute().data[0]
    return saved


@router.get("/history")
def list_history(device_id: str, limit: int = 50):
    db = require_db()
    rows = (
        db.table("hl7_conversions")
        .select("id,source,filename,message_type,status,created_at")
        .eq("device_id", device_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
        .data
    )
    return {"history": rows}


@router.get("/history/{record_id}")
def get_history_record(record_id: int, device_id: str):
    db = require_db()
    return _get_owned_record(db, record_id, device_id)


@router.delete("/history/{record_id}")
def delete_history_record(record_id: int, device_id: str):
    db = require_db()
    _get_owned_record(db, record_id, device_id)
    db.table("hl7_conversions").delete().eq("id", record_id).execute()
    return {"status": "deleted"}


@router.post("/history/{record_id}/describe")
def describe_record(record_id: int, device_id: str):
    if not os.getenv("GROQ_API_KEY"):
        raise HTTPException(status_code=503, detail="GROQ_API_KEY not configured")

    db = require_db()
    record = _get_owned_record(db, record_id, device_id)
    if record.get("status") != "success" or not record.get("fhir_output"):
        raise HTTPException(status_code=422, detail="No FHIR output to describe -- this conversion failed")

    prompt = f"""You are MedNexusAI Assistant. Describe the clinical meaning of the following FHIR R4 bundle in plain language for a clinician, in 3-5 concise sentences. Mention the patient, encounter/order details, and anything notable. Do not restate raw JSON.

MESSAGE TYPE: {record.get('message_type')}

FHIR BUNDLE:
{json.dumps(record['fhir_output'], indent=2)}"""

    try:
        response = groq_client.chat.completions.create(
            model=CHAT_MODEL, messages=[{"role": "user", "content": prompt}], max_tokens=400, temperature=0.3,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Groq request failed: {exc}")

    description = response.choices[0].message.content or ""
    db.table("hl7_conversions").update({"description": description}).eq("id", record_id).execute()
    return {"description": description}


@router.get("/history/{record_id}/pdf")
def download_pdf(record_id: int, device_id: str):
    db = require_db()
    record = _get_owned_record(db, record_id, device_id)
    pdf_bytes = pdf_report.build_conversion_pdf(record)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="hl7-fhir-conversion-{record_id}.pdf"'},
    )


@router.get("/stats")
def get_stats(device_id: str):
    db = require_db()
    rows = (
        db.table("hl7_conversions")
        .select("message_type,status,created_at")
        .eq("device_id", device_id)
        .order("created_at", desc=True)
        .limit(500)
        .execute()
        .data
    )

    by_type: dict[str, int] = {}
    by_day: dict[str, int] = {}
    success_count = 0
    error_count = 0
    for r in rows:
        mt = r.get("message_type") or "Unknown"
        by_type[mt] = by_type.get(mt, 0) + 1
        day = (r.get("created_at") or "")[:10]
        if day:
            by_day[day] = by_day.get(day, 0) + 1
        if r.get("status") == "success":
            success_count += 1
        else:
            error_count += 1

    last_14_days = sorted(by_day.keys())[-14:]
    return {
        "by_type": [{"type": k, "count": v} for k, v in sorted(by_type.items())],
        "by_day": [{"date": d, "count": by_day[d]} for d in last_14_days],
        "success_count": success_count,
        "error_count": error_count,
    }
