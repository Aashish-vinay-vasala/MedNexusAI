from fastapi import FastAPI, HTTPException, Request, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from groq import Groq
import os
from dotenv import load_dotenv
from datetime import datetime

import survival
import imaging
import fhir_cohort
import vitals
import icd10
import prescription
import assignment
import forecast
import risk_score
import kpi
import population_health
import claims
import hl7_samples

from routers import (
    patients, alerts, ehr, clinical_ops, fhir as fhir_router, doctors,
    claims as claims_router, audit, reference, allergies, imaging_studies, well_known, assistant,
    hl7_fhir as hl7_fhir_router, clinical_nlp_text as clinical_nlp_text_router,
    decision_support as decision_support_router,
)
from routers import kpi as kpi_router
from routers import vitals as vitals_router
from routers import risk as risk_router
from routers import lab_results as lab_results_router

load_dotenv()

app = FastAPI(title="MedNexusAI Backend")


@app.middleware("http")
async def catch_unhandled_exceptions(request: Request, call_next):
    """@app.exception_handler(Exception) gets hoisted into Starlette's ServerErrorMiddleware,
    which sits OUTSIDE CORSMiddleware — its responses never get CORS headers, so the browser
    misreports a real 500 as a CORS failure. Starlette's add_middleware() prepends, so this
    must be registered BEFORE app.add_middleware(CORSMiddleware, ...) below to end up wrapped
    INSIDE it — that way a response built in the except branch still passes back out through
    CORSMiddleware and keeps the actual error visible to the frontend instead of masking it."""
    try:
        return await call_next(request)
    except Exception as exc:
        return JSONResponse(status_code=500, content={"detail": f"Internal server error: {exc}"})


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

for r in (
    patients.router, alerts.router, ehr.router, clinical_ops.router, fhir_router.router,
    doctors.router, claims_router.router, audit.router, reference.router, allergies.router,
    kpi_router.router, vitals_router.router, risk_router.router, lab_results_router.router,
    imaging_studies.router, well_known.router, assistant.router, hl7_fhir_router.router,
    clinical_nlp_text_router.router, decision_support_router.router,
):
    app.include_router(r)


class SummarizeRequest(BaseModel):
    kpi: dict
    alerts: list[dict]
    admissions: list[dict]
    forecast: list[dict]


class ImagingAnalyzeRequest(BaseModel):
    patient_id: str
    study_type: str
    finding: str
    confidence: float
    risk: str


class SurvivalPatient(BaseModel):
    id: str
    age: int
    risk: str


class SurvivalRequest(BaseModel):
    patients: list[SurvivalPatient]


class FHIRResourceItem(BaseModel):
    resource_type: str
    resource_json: dict


class FHIRCohortRequest(BaseModel):
    resources: list[FHIRResourceItem]


class VitalsScoreRequest(BaseModel):
    hr: int
    sbp: int
    spo2: int
    temp: float
    rr: int
    gcs: int = 15
    on_oxygen: bool = False
    wbc: float | None = None
    altered_mentation: bool | None = None


class ICD10SearchRequest(BaseModel):
    query: str
    limit: int = 10


class ICD10SuggestRequest(BaseModel):
    note_text: str


class PrescriptionValidateRequest(BaseModel):
    drug: str
    dose: str
    route: str
    frequency: str
    patient_meds: list[str] = []
    patient_age: int


class AssignmentDoctor(BaseModel):
    id: int
    specialty: str
    max_patients: int


class AssignmentPatient(BaseModel):
    id: str
    risk: str
    ward: str


class AssignmentOptimizeRequest(BaseModel):
    patients: list[AssignmentPatient]
    doctors: list[AssignmentDoctor]
    existing_loads: dict[int, int] = {}


class BedHistoryRecord(BaseModel):
    date: str
    bed_usage: int
    staffing: int


class ForecastRequest(BaseModel):
    history: list[BedHistoryRecord]


class RiskScoreRequest(BaseModel):
    patients: list[SurvivalPatient]


class KPIRecomputeRequest(BaseModel):
    patients: list[dict]
    alerts: list[dict]
    admissions: list[dict]


class PopulationStatsRequest(BaseModel):
    patients: list[dict]
    diagnoses: list[dict]


class ClaimGenerateRequest(BaseModel):
    patient: dict
    diagnoses: list[dict]
    procedure_summary: str | None = None


@app.get("/health")
def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


@app.post("/api/summarize")
async def summarize(req: SummarizeRequest):
    if not os.getenv("GROQ_API_KEY"):
        raise HTTPException(status_code=503, detail="GROQ_API_KEY not configured")

    critical_alerts = [a for a in req.alerts if a.get("severity") == "critical" and not a.get("acknowledged")]
    unacked = [a for a in req.alerts if not a.get("acknowledged") and not a.get("escalated")]
    escalated = [a for a in req.alerts if a.get("escalated")]
    peak_forecast = max(req.forecast, key=lambda x: x.get("bed_usage", 0)) if req.forecast else {}

    prompt = f"""You are a clinical AI assistant for MedNexusAI. Generate a concise structured clinical summary based on the following real-time hospital dashboard data.

TODAY'S DATE: {datetime.utcnow().strftime("%B %d, %Y")}

KPI SNAPSHOT:
- Total Active Patients: {req.kpi.get("total_active", "N/A")} (+{req.kpi.get("total_active_change", 0)} today)
- ICU Patients: {req.kpi.get("icu_patients", "N/A")} ({req.kpi.get("icu_critical", 0)} critical)
- High-Risk Patients: {req.kpi.get("high_risk", "N/A")} (↑{req.kpi.get("high_risk_change", 0)} since yesterday)
- Available Beds: {req.kpi.get("available_beds", "N/A")} ({req.kpi.get("bed_capacity_pct", 0)}% capacity)
- Pending Alerts: {req.kpi.get("pending_alerts", "N/A")} ({req.kpi.get("alert_critical", 0)} critical)
- Today's Admissions: {req.kpi.get("todays_admissions", "N/A")} (↑{req.kpi.get("admissions_change_pct", 0)}% vs avg)

CRITICAL UNACKNOWLEDGED ALERTS ({len(critical_alerts)}):
{chr(10).join(f"• [{a.get('type')}] {a.get('patient')} — {a.get('detail')} (source: {a.get('source')})" for a in critical_alerts[:5])}

TOTAL ALERTS: {len(req.alerts)} total | {len(unacked)} unacknowledged | {len(escalated)} escalated

ADMISSION TRENDS (last 7 days):
{chr(10).join(f"• {r.get('day_label')}: {r.get('admissions')} admitted, {r.get('discharges')} discharged, {r.get('readmissions')} readmissions" for r in req.admissions)}

RESOURCE FORECAST:
{chr(10).join(f"• {r.get('day_label')}: Bed usage {r.get('bed_usage')}%, Staffing {r.get('staffing')}%" for r in req.forecast)}
Peak day: {peak_forecast.get('day_label', 'N/A')} at {peak_forecast.get('bed_usage', 0)}% bed utilization

Generate a structured clinical summary with exactly these sections in ALL CAPS followed by their content:
PATIENT STATUS
CRITICAL ALERTS
ADMISSION TRENDS
RESOURCE FORECAST
RECOMMENDATIONS

Keep each section concise (2-4 sentences). Use • for bullet points under CRITICAL ALERTS. Be direct and actionable for clinical staff. Do not add any text before the first section header."""

    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=900,
        temperature=0.3,
    )

    summary = response.choices[0].message.content or ""
    return {"summary": summary}


@app.post("/api/v1/imaging/analyze")
async def imaging_analyze(req: ImagingAnalyzeRequest):
    if not os.getenv("GROQ_API_KEY"):
        raise HTTPException(status_code=503, detail="GROQ_API_KEY not configured")

    prompt = f"""You are a radiology AI assistant. A {req.study_type} study for patient {req.patient_id} (risk level: {req.risk}) has an automated finding of "{req.finding}" with {req.confidence * 100:.0f}% confidence. Write a concise clinical interpretation (3-5 sentences) a radiologist could review, including any recommended next steps. Be direct and clinically appropriate."""

    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=500,
            temperature=0.3,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Groq request failed: {exc}")

    interpretation = response.choices[0].message.content or ""
    return {"interpretation": interpretation}


@app.post("/api/v1/risk/survival")
async def risk_survival(req: SurvivalRequest):
    return survival.compute_survival([p.model_dump() for p in req.patients])


@app.get("/api/v1/imaging/samples")
async def imaging_samples():
    return {"samples": imaging.list_samples()}


@app.get("/api/v1/hl7/samples")
async def hl7_samples_endpoint():
    return {"samples": hl7_samples.list_samples()}


@app.post("/api/v1/imaging/dicom-metadata")
async def imaging_dicom_metadata(sample_id: str | None = Form(None), file: UploadFile | None = File(None)):
    if file is not None:
        ds = imaging.load_uploaded(await file.read())
    elif sample_id:
        try:
            ds = imaging.load_sample(sample_id)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
    else:
        raise HTTPException(status_code=400, detail="Provide either sample_id or file")

    try:
        return imaging.analyze_dicom(ds)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Failed to analyze DICOM: {exc}")


@app.post("/api/v1/fhir/cohort-insights")
async def fhir_cohort_insights(req: FHIRCohortRequest):
    return fhir_cohort.cohort_insights([r.model_dump() for r in req.resources])


@app.post("/api/v1/vitals/score")
async def vitals_score(req: VitalsScoreRequest):
    return vitals.score_vitals(
        hr=req.hr, sbp=req.sbp, spo2=req.spo2, temp=req.temp, rr=req.rr, gcs=req.gcs,
        on_oxygen=req.on_oxygen, wbc=req.wbc, altered_mentation=req.altered_mentation,
    )


@app.post("/api/v1/icd10/search")
async def icd10_search(req: ICD10SearchRequest):
    return {"results": icd10.search_codes(req.query, req.limit)}


@app.post("/api/v1/icd10/suggest-from-note")
async def icd10_suggest(req: ICD10SuggestRequest):
    return {"suggestions": icd10.suggest_from_note(req.note_text)}


@app.post("/api/v1/prescription/validate")
async def prescription_validate(req: PrescriptionValidateRequest):
    return prescription.validate_prescription(
        req.drug, req.dose, req.route, req.frequency, req.patient_meds, req.patient_age,
    )


@app.post("/api/v1/assignment/optimize")
async def assignment_optimize(req: AssignmentOptimizeRequest):
    return {"assignments": assignment.assign_patients(
        [p.model_dump() for p in req.patients], [d.model_dump() for d in req.doctors], req.existing_loads,
    )}


@app.post("/api/v1/forecast/beds")
async def forecast_beds(req: ForecastRequest):
    return forecast.compute_forecast([h.model_dump() for h in req.history])


@app.post("/api/v1/risk/score")
async def risk_score_endpoint(req: RiskScoreRequest):
    return risk_score.compute_risk_scores([p.model_dump() for p in req.patients])


@app.post("/api/v1/kpi/recompute")
async def kpi_recompute(req: KPIRecomputeRequest):
    return kpi.recompute_kpi(req.patients, req.alerts, req.admissions)


@app.post("/api/v1/population/stats")
async def population_stats(req: PopulationStatsRequest):
    return population_health.compute_population_stats(req.patients, req.diagnoses)


@app.post("/api/v1/claims/generate")
async def claims_generate(req: ClaimGenerateRequest):
    return claims.build_claim(req.patient, req.diagnoses, req.procedure_summary)
