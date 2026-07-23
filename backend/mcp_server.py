"""
MedNexusAI MCP server — exposes the backend's clinical logic (already used by the FastAPI
HTTP API in main.py) as MCP tools for MCP clients such as Claude Desktop.

This is a separate entrypoint from `main.py` / uvicorn — run it directly:
    python backend/mcp_server.py
It communicates over stdio, the standard transport for a locally-launched MCP server.
See backend/MCP.md for how to register it with an MCP client.
"""

import os

from mcp.server.fastmcp import FastMCP
from groq import Groq

from db import require_db
import nlp
import survival
import imaging
import fhir_cohort
import vitals
import decision_support
import icd10
import assignment
import forecast
import hl7_fhir
import clinical_text

mcp = FastMCP("MedNexusAI")


@mcp.tool()
def analyze_clinical_note(note_text: str) -> dict:
    """Run clinical NLP (MedSpaCy) on a note: extracts CONDITION/MEDICATION/PROCEDURE/SYMPTOM/VITAL
    entities with negation and uncertainty detection."""
    return {"entities": nlp.analyze_note(note_text)}


@mcp.tool()
def compute_survival_analysis(patients: list[dict]) -> dict:
    """Kaplan-Meier readmission-free survival curve + Cox proportional-hazards ratios for a
    patient cohort. Each patient needs id, age, risk ('critical'|'high'|'medium'|'low')."""
    return survival.compute_survival(patients)


@mcp.tool()
def list_dicom_samples() -> dict:
    """List the sample DICOM studies (CT/MRI/Ultrasound) available for imaging analysis."""
    return {"samples": imaging.list_samples()}


@mcp.tool()
def analyze_dicom_sample(sample_id: str) -> dict:
    """Parse a sample DICOM study's metadata (Pydicom), compute pixel-level stats (SimpleITK),
    and classify modality/anatomy with a MONAI DenseNet trained on MedNIST."""
    ds = imaging.load_sample(sample_id)
    return imaging.analyze_dicom(ds)


@mcp.tool()
def get_fhir_cohort_insights(resources: list[dict]) -> dict:
    """Flatten a cohort's FHIR resources (FHIR-PyRate) into condition/medication frequency counts.
    Each resource needs resource_type and resource_json."""
    return fhir_cohort.cohort_insights(resources)


@mcp.tool()
def get_patient_fhir_resources(patient_id: str) -> dict:
    """Fetch a patient's stored FHIR R4 resources (Patient, Condition, MedicationRequest,
    Observation, Encounter, ...) from the database, as saved by the FHIR Explorer page."""
    db = require_db()
    rows = db.table("fhir_resources").select("*").eq("patient_id", patient_id).execute().data
    return {"resources": rows}


@mcp.tool()
def upsert_patient_fhir_resource(patient_id: str, resource_type: str, resource_json: dict, version_id: str = "1") -> dict:
    """Create or overwrite a patient's stored FHIR resource of a given type (one resource per
    patient_id + resource_type -- an existing one is replaced, matching the FHIR Explorer's
    Save behavior)."""
    db = require_db()
    row = {"patient_id": patient_id, "resource_type": resource_type, "resource_json": resource_json, "version_id": version_id}
    res = db.table("fhir_resources").upsert(row, on_conflict="patient_id,resource_type").execute()
    return res.data[0]


@mcp.tool()
def delete_patient_fhir_resource(patient_id: str, resource_type: str) -> dict:
    """Delete a patient's stored FHIR resource of a given type."""
    db = require_db()
    res = db.table("fhir_resources").delete().eq("patient_id", patient_id).eq("resource_type", resource_type).execute()
    return {"deleted": len(res.data)}


@mcp.tool()
def compute_vitals_score(hr: int, sbp: int, spo2: int, temp: float, rr: int, gcs: int = 15,
                          on_oxygen: bool = False, wbc: float | None = None) -> dict:
    """Compute NEWS2, qSOFA, and SIRS clinical early-warning scores from a set of vital signs."""
    return vitals.score_vitals(hr=hr, sbp=sbp, spo2=spo2, temp=temp, rr=rr, gcs=gcs, on_oxygen=on_oxygen, wbc=wbc)


@mcp.tool()
def check_drug_interaction(drug_a: str, drug_b: str) -> dict:
    """Check whether two drugs have a known interaction, its severity, and mechanism.
    Checks a curated reference table first, then a cache of previously-computed verdicts,
    then falls back to reading each drug's real FDA label via Groq for pairs neither
    covers (cached afterward). Does not persist to history (use save_decision_support_run
    to save)."""
    db = require_db()
    groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    return decision_support.check_interaction_enriched(drug_a, drug_b, groq_client, db)


@mcp.tool()
def check_medication_regimen(drugs: list[str]) -> dict:
    """Pairwise-check every combination of drugs in a medication list and return all
    interacting pairs found. Pure lookup -- does not persist to history."""
    return {"interactions": decision_support.check_regimen(drugs)}


@mcp.tool()
def save_decision_support_run(device_id: str, mode: str, drugs: list[str],
                               patient_id: str | None = None, patient_name: str | None = None) -> dict:
    """Run a drug-interaction check (mode 'pairwise' needs exactly 2 drugs, 'regimen' needs
    2+) and persist it to history (device-scoped), matching the web app's Decision Support
    page. Returns the saved record including computed interactions and highest severity."""
    db = require_db()
    if mode == "pairwise":
        if len(drugs) != 2:
            raise ValueError("pairwise mode requires exactly 2 drugs")
        result = decision_support.check_interaction(drugs[0], drugs[1])
        interactions = [{"drug_a": drugs[0], "drug_b": drugs[1], **result}] if result["interacts"] else []
    else:
        if len(drugs) < 2:
            raise ValueError("regimen mode requires at least 2 drugs")
        interactions = decision_support.check_regimen(drugs)

    row = {
        "device_id": device_id, "mode": mode, "patient_id": patient_id, "patient_name": patient_name,
        "drugs": drugs, "interactions": interactions,
        "highest_severity": decision_support.highest_severity(interactions),
        "interaction_count": len(interactions), "status": "success",
    }
    return db.table("decision_support_runs").insert(row).execute().data[0]


@mcp.tool()
def list_decision_support_history(device_id: str, mode: str | None = None, patient_id: str | None = None, limit: int = 50) -> dict:
    """List saved drug-interaction check runs (device-scoped)."""
    db = require_db()
    q = db.table("decision_support_runs").select(
        "id,mode,patient_id,patient_name,drugs,highest_severity,interaction_count,status,created_at"
    ).eq("device_id", device_id)
    if mode:
        q = q.eq("mode", mode)
    if patient_id:
        q = q.eq("patient_id", patient_id)
    rows = q.order("created_at", desc=True).limit(limit).execute().data
    return {"history": rows}


@mcp.tool()
def get_decision_support_record(record_id: int, device_id: str) -> dict:
    """Fetch one full saved drug-interaction check run, including its interactions list."""
    db = require_db()
    rows = db.table("decision_support_runs").select("*").eq("id", record_id).eq("device_id", device_id).execute().data
    return rows[0] if rows else {"error": "not found"}


@mcp.tool()
def update_decision_support_record(record_id: int, device_id: str, patient_id: str | None = None,
                                    patient_name: str | None = None) -> dict:
    """Relabel a saved drug-interaction check run's patient linkage. The computed drugs/
    interactions/severity are immutable results of the check itself, so only patient_id/
    patient_name are editable -- re-running the check creates a new history row."""
    db = require_db()
    owned = db.table("decision_support_runs").select("id").eq("id", record_id).eq("device_id", device_id).execute().data
    if not owned:
        return {"error": "not found"}
    updates = {k: v for k, v in (("patient_id", patient_id), ("patient_name", patient_name)) if v is not None}
    if not updates:
        return {"error": "no fields to update"}
    return db.table("decision_support_runs").update(updates).eq("id", record_id).execute().data[0]


@mcp.tool()
def delete_decision_support_record(record_id: int, device_id: str) -> dict:
    """Delete one saved drug-interaction check run."""
    db = require_db()
    res = db.table("decision_support_runs").delete().eq("id", record_id).eq("device_id", device_id).execute()
    return {"deleted": len(res.data)}


@mcp.tool()
def search_icd10_codes(query: str, limit: int = 10) -> dict:
    """Search the offline WHO ICD-10 code hierarchy by free-text query (e.g. condition name)."""
    return {"results": icd10.search_codes(query, limit)}


@mcp.tool()
def create_icd10_assignment(patient_id: str, code: str, description: str, confidence: float | None = None) -> dict:
    """Assign an ICD-10 code to a patient's record (persisted, e.g. from a coder's review of
    search_icd10_codes results)."""
    db = require_db()
    row = {"patient_id": patient_id, "code": code, "description": description, "confidence": confidence}
    return db.table("icd10_assignments").insert(row).execute().data[0]


@mcp.tool()
def list_icd10_assignments(patient_id: str | None = None) -> dict:
    """List a patient's persisted ICD-10 code assignments (or all assignments if patient_id omitted)."""
    db = require_db()
    query = db.table("icd10_assignments").select("*").order("assigned_at", desc=True)
    if patient_id:
        query = query.eq("patient_id", patient_id)
    return {"assignments": query.execute().data}


@mcp.tool()
def get_icd10_assignment(assignment_id: int) -> dict:
    """Fetch one persisted ICD-10 code assignment by id."""
    db = require_db()
    rows = db.table("icd10_assignments").select("*").eq("id", assignment_id).execute().data
    return rows[0] if rows else {"error": "not found"}


@mcp.tool()
def update_icd10_assignment(assignment_id: int, code: str | None = None, description: str | None = None,
                             confidence: float | None = None) -> dict:
    """Update an existing ICD-10 code assignment's code, description, and/or confidence."""
    db = require_db()
    updates = {k: v for k, v in (("code", code), ("description", description), ("confidence", confidence)) if v is not None}
    if not updates:
        return {"error": "no fields to update"}
    res = db.table("icd10_assignments").update(updates).eq("id", assignment_id).execute()
    return res.data[0] if res.data else {"error": "not found"}


@mcp.tool()
def delete_icd10_assignment(assignment_id: int) -> dict:
    """Delete a patient's ICD-10 code assignment."""
    db = require_db()
    res = db.table("icd10_assignments").delete().eq("id", assignment_id).execute()
    return {"deleted": len(res.data)}


@mcp.tool()
def optimize_doctor_assignment(patients: list[dict], doctors: list[dict]) -> dict:
    """Assign patients to doctors via least-loaded, ward-to-specialty-matched greedy assignment,
    respecting each doctor's max_patients capacity."""
    return {"assignments": assignment.assign_patients(patients, doctors)}


@mcp.tool()
def compute_bed_forecast(history: list[dict]) -> dict:
    """Forecast 7 days of bed usage/staffing from daily history using damped-trend exponential
    smoothing. Each history entry needs date, bed_usage, staffing."""
    return forecast.compute_forecast(history)


@mcp.tool()
def convert_hl7_to_fhir(hl7_message: str) -> dict:
    """Convert an HL7 v2 message (ADT^A01/A03 admit-discharge or ORM^O01 lab order) into a FHIR
    R4 transaction Bundle. Message type is auto-detected from the MSH-9 field."""
    return hl7_fhir.convert(hl7_message)


@mcp.tool()
def generate_clinical_text(mode: str, patient_id: str, name: str, risk: str,
                            ward: str | None = None, note_text: str | None = None,
                            lab_report: str | None = None) -> dict:
    """Generate clinical text (Groq/llama-3.3-70b) for mode 'note_summary' | 'report_summary' |
    'discharge_letter'. Pure generation -- does not persist to history (use the run_* history
    tools, or the web app's History tab, to save a record)."""
    groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    content = clinical_text.generate(groq_client, mode, patient_id, name, risk, ward, note_text, lab_report)
    return {"content": content}


@mcp.tool()
def list_clinical_history(device_id: str, mode: str | None = None, patient_id: str | None = None, limit: int = 50) -> dict:
    """List saved clinical NLP/text-generation runs (device-scoped), latest version per record."""
    db = require_db()
    q = db.table("clinical_language_runs").select(
        "id,mode,patient_id,patient_name,status,version,root_id,created_at"
    ).eq("device_id", device_id)
    if mode:
        q = q.eq("mode", mode)
    if patient_id:
        q = q.eq("patient_id", patient_id)
    rows = q.order("created_at", desc=True).limit(limit).execute().data
    return {"history": rows}


@mcp.tool()
def get_clinical_record(record_id: int, device_id: str) -> dict:
    """Fetch one full clinical NLP/text-generation run record, including its input and output."""
    db = require_db()
    rows = db.table("clinical_language_runs").select("*").eq("id", record_id).eq("device_id", device_id).execute().data
    return rows[0] if rows else {"error": "not found"}


@mcp.tool()
def delete_clinical_record(record_id: int, device_id: str) -> dict:
    """Delete one saved clinical NLP/text-generation run record."""
    db = require_db()
    res = db.table("clinical_language_runs").delete().eq("id", record_id).eq("device_id", device_id).execute()
    return {"deleted": len(res.data)}


@mcp.tool()
def list_chat_sessions(device_id: str, patient_id: str | None = None) -> dict:
    """List a device's saved AI Clinical Assistant chat sessions, most recently updated first.
    Pass patient_id to scope to conversations about a specific patient."""
    db = require_db()
    try:
        q = db.table("chat_sessions").select("id,title,page_context,patient_id,updated_at").eq("device_id", device_id)
        if patient_id:
            q = q.eq("patient_id", patient_id)
        rows = q.order("updated_at", desc=True).limit(50).execute().data
    except Exception as exc:
        # patient_id column arrives via schema_additions_9.sql — tolerate it not existing yet.
        if "patient_id" not in str(exc):
            raise
        rows = (
            db.table("chat_sessions").select("id,title,page_context,updated_at")
            .eq("device_id", device_id).order("updated_at", desc=True).limit(50).execute().data
        )
        for r in rows:
            r["patient_id"] = None
    return {"sessions": rows}


@mcp.tool()
def get_chat_session_messages(session_id: int, device_id: str) -> dict:
    """Fetch the full message history of one AI Clinical Assistant chat session."""
    db = require_db()
    owned = db.table("chat_sessions").select("id").eq("id", session_id).eq("device_id", device_id).execute().data
    if not owned:
        return {"error": "not found"}
    rows = (
        db.table("chat_messages").select("role,content,sources,created_at")
        .eq("session_id", session_id).order("created_at").execute().data
    )
    return {"messages": rows}


@mcp.tool()
def update_chat_session_title(session_id: int, device_id: str, title: str) -> dict:
    """Rename a saved AI Clinical Assistant chat session."""
    db = require_db()
    owned = db.table("chat_sessions").select("id").eq("id", session_id).eq("device_id", device_id).execute().data
    if not owned:
        return {"error": "not found"}
    return db.table("chat_sessions").update({"title": title}).eq("id", session_id).execute().data[0]


@mcp.tool()
def delete_chat_session(session_id: int, device_id: str) -> dict:
    """Delete a saved AI Clinical Assistant chat session and its messages."""
    db = require_db()
    owned = db.table("chat_sessions").select("id").eq("id", session_id).eq("device_id", device_id).execute().data
    if not owned:
        return {"error": "not found"}
    db.table("chat_sessions").delete().eq("id", session_id).execute()
    return {"status": "deleted"}


@mcp.tool()
def list_risk_scores(patient_id: str | None = None) -> dict:
    """List persisted patient risk scores (dimensions: sepsis, mortality, icu, readmit)."""
    db = require_db()
    query = db.table("patient_risk_scores").select("*")
    if patient_id:
        query = query.eq("patient_id", patient_id)
    return {"scores": query.execute().data}


@mcp.tool()
def save_risk_score(patient_id: str, dimension: str, score: float) -> dict:
    """Create or update (upsert on patient_id+dimension) one patient's risk score for a
    dimension ('sepsis' | 'mortality' | 'icu' | 'readmit')."""
    db = require_db()
    row = {"patient_id": patient_id, "dimension": dimension, "score": score}
    return db.table("patient_risk_scores").upsert(row, on_conflict="patient_id,dimension").execute().data[0]


@mcp.tool()
def delete_risk_score(score_id: int) -> dict:
    """Delete one persisted patient risk score row by id."""
    db = require_db()
    res = db.table("patient_risk_scores").delete().eq("id", score_id).execute()
    return {"deleted": len(res.data)}


@mcp.tool()
def list_imaging_studies(patient_id: str) -> dict:
    """List a patient's persisted imaging studies (Medical Imaging AI module)."""
    db = require_db()
    rows = db.table("imaging_studies").select("*").eq("patient_id", patient_id).order("study_date", desc=True).execute().data
    return {"studies": rows}


@mcp.tool()
def create_imaging_study(patient_id: str, study_type: str, modality: str, study_date: str,
                          finding: str, confidence: float, status: str = "Pending Review",
                          flagged: bool = False) -> dict:
    """Create a persisted imaging study record for a patient."""
    db = require_db()
    row = {
        "patient_id": patient_id, "study_type": study_type, "modality": modality,
        "study_date": study_date, "status": status, "finding": finding,
        "confidence": confidence, "flagged": flagged,
    }
    return db.table("imaging_studies").insert(row).execute().data[0]


@mcp.tool()
def update_imaging_study(study_id: int, status: str | None = None, finding: str | None = None,
                          confidence: float | None = None, flagged: bool | None = None) -> dict:
    """Update an imaging study's review status, finding, confidence, and/or flagged state."""
    db = require_db()
    updates = {k: v for k, v in (("status", status), ("finding", finding), ("confidence", confidence), ("flagged", flagged)) if v is not None}
    if not updates:
        return {"error": "no fields to update"}
    res = db.table("imaging_studies").update(updates).eq("id", study_id).execute()
    return res.data[0] if res.data else {"error": "not found"}


@mcp.tool()
def delete_imaging_study(study_id: int) -> dict:
    """Delete a persisted imaging study record."""
    db = require_db()
    res = db.table("imaging_studies").delete().eq("id", study_id).execute()
    return {"deleted": len(res.data)}


@mcp.tool()
def list_vitals_history(patient_id: str, limit: int = 100) -> dict:
    """List a patient's persisted vitals readings (Patient Monitoring module), latest first."""
    db = require_db()
    rows = (
        db.table("vitals").select("*").eq("patient_id", patient_id)
        .order("recorded_at", desc=True).limit(limit).execute().data
    )
    return {"history": rows}


@mcp.tool()
def create_vitals_reading(patient_id: str, hr: int, sbp: int, dbp: int, spo2: int, temp: float,
                           rr: int, gcs: int = 15, on_oxygen: bool = False, source: str = "Simulated Monitor") -> dict:
    """Record a new vitals reading for a patient."""
    db = require_db()
    row = {
        "patient_id": patient_id, "hr": hr, "sbp": sbp, "dbp": dbp, "spo2": spo2,
        "temp": temp, "rr": rr, "gcs": gcs, "on_oxygen": on_oxygen, "source": source,
    }
    return db.table("vitals").insert(row).execute().data[0]


@mcp.tool()
def update_vitals_reading(vitals_id: int, hr: int | None = None, sbp: int | None = None, dbp: int | None = None,
                           spo2: int | None = None, temp: float | None = None, rr: int | None = None,
                           gcs: int | None = None, on_oxygen: bool | None = None) -> dict:
    """Correct a previously recorded vitals reading."""
    db = require_db()
    fields = {"hr": hr, "sbp": sbp, "dbp": dbp, "spo2": spo2, "temp": temp, "rr": rr, "gcs": gcs, "on_oxygen": on_oxygen}
    updates = {k: v for k, v in fields.items() if v is not None}
    if not updates:
        return {"error": "no fields to update"}
    res = db.table("vitals").update(updates).eq("id", vitals_id).execute()
    return res.data[0] if res.data else {"error": "not found"}


@mcp.tool()
def delete_vitals_reading(vitals_id: int) -> dict:
    """Delete a persisted vitals reading."""
    db = require_db()
    res = db.table("vitals").delete().eq("id", vitals_id).execute()
    return {"deleted": len(res.data)}


@mcp.tool()
def list_lab_results(patient_id: str) -> dict:
    """List a patient's persisted lab results (Patient Monitoring module)."""
    db = require_db()
    rows = db.table("lab_results").select("*").eq("patient_id", patient_id).order("recorded_at").execute().data
    return {"results": rows}


@mcp.tool()
def create_lab_result(patient_id: str, panel: str, marker: str, value: float, unit: str,
                       ref_low: float | None = None, ref_high: float | None = None) -> dict:
    """Record a new lab result for a patient (panel e.g. 'CBC'|'BMP'|'LFT')."""
    db = require_db()
    row = {
        "patient_id": patient_id, "panel": panel, "marker": marker, "value": value,
        "unit": unit, "ref_low": ref_low, "ref_high": ref_high,
    }
    return db.table("lab_results").insert(row).execute().data[0]


@mcp.tool()
def update_lab_result(result_id: int, value: float | None = None, unit: str | None = None,
                       ref_low: float | None = None, ref_high: float | None = None) -> dict:
    """Correct a previously recorded lab result."""
    db = require_db()
    updates = {k: v for k, v in (("value", value), ("unit", unit), ("ref_low", ref_low), ("ref_high", ref_high)) if v is not None}
    if not updates:
        return {"error": "no fields to update"}
    res = db.table("lab_results").update(updates).eq("id", result_id).execute()
    return res.data[0] if res.data else {"error": "not found"}


@mcp.tool()
def delete_lab_result(result_id: int) -> dict:
    """Delete a persisted lab result."""
    db = require_db()
    res = db.table("lab_results").delete().eq("id", result_id).execute()
    return {"deleted": len(res.data)}


if __name__ == "__main__":
    mcp.run()
