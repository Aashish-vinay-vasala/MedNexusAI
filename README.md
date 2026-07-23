# MedNexusAI

A 16-module healthcare AI platform covering interoperability, clinical NLP, medical imaging, risk
prediction, ICU monitoring, EHR, and hospital operations — built as a full-stack, free-tier-only
system with no hardcoded/mock data (everything is generated, stored, and served dynamically) and
no login (the homepage asks for a name, then enters the platform directly).

## Tech Stack

| Layer               | Technology                                                              |
|---------------------|---------------------------------------------------------------------------|
| Frontend            | React 19 + Vite + TypeScript + Tailwind CSS v4 (`@tailwindcss/vite`)      |
| Backend             | FastAPI (Python)                                                        |
| Primary DB          | Supabase (PostgreSQL, storage, realtime)                                |
| Realtime / Alerts   | Firebase Firestore + FCM                                                |
| Hosting             | Firebase Hosting                                                        |
| FHIR Server         | HAPI FHIR (self-hosted, Render free tier)                               |
| ML Models           | scikit-learn, XGBoost, LightGBM (local, no cloud cost)                  |
| NLP / Text AI       | Groq API (Llama 3.3 70B) — free tier                                    |
| Medical Imaging     | PyTorch + MONAI (CNN — ResNet/EfficientNet), pydicom, SimpleITK          |
| Survival Analysis   | lifelines, statsmodels                                                  |
| Analytics           | Google BigQuery (free tier)                                             |
| DICOM Storage       | Google Cloud Storage (free tier)                                        |
| Backend Deploy      | Google Cloud Run (free tier)                                            |
| Web Search (assistant) | Google Custom Search JSON API (free tier, 100 queries/day)           |
| Icons / Animation   | lucide-react, framer-motion                                             |
| Charts              | Recharts                                                                 |
| PDF Export          | jspdf (frontend), reportlab (backend)                                   |
| MCP                 | `mcp_server.py` exposes backend logic as MCP tools for Claude Desktop    |

Design system: clinical dark theme — Deep Navy (`#0A0F1E`) + Electric Blue (`#0EA5E9`) + Teal
(`#14B8A6`).

## Repository Layout

```
MedNexusAI/
├── frontend/                      React + Vite + TypeScript SPA
│   ├── src/
│   │   ├── pages/                 One page per module (see "Modules" below)
│   │   ├── components/
│   │   │   ├── home/               Landing page sections (Navbar, Hero, Stats, Capabilities, Tech, Footer)
│   │   │   ├── dashboard/          Sidebar nav, hub tabs, KPI mini-charts, alert modal
│   │   │   ├── assistant/          Floating global AI assistant widget (header, input bar, messages, toolbar)
│   │   │   ├── clinical-nlp-text/  Clinical NLP & Text Generation module UI
│   │   │   └── decision-support/   Decision Support module UI
│   │   ├── context/                PatientContext, AssistantContext (React context providers)
│   │   ├── hooks/                  useClinicalData, useDecisionSupportData, useAssistantChat,
│   │   │                           useVoiceRecorder, useSpeechSynthesis, usePolling, useDraggablePosition
│   │   ├── lib/                    backend.ts (API client), moduleTitles.ts (nav source of truth), severity.ts
│   │   ├── types/                  Shared TypeScript types (clinical.ts)
│   │   ├── App.tsx                 Router: "/", "/dashboard", "/dashboard/:moduleId"
│   │   └── main.tsx                Entry point
│   ├── public/                     Static assets (favicon, icons)
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig*.json
│   ├── eslint.config.js
│   ├── package.json
│   └── .env.local                  VITE_BACKEND_URL
│
├── backend/                        FastAPI application
│   ├── main.py                     App entrypoint — CORS, error middleware, router registration,
│   │                                Groq-backed summarize/imaging-interpretation endpoints
│   ├── mcp_server.py                Standalone MCP server exposing backend logic as MCP tools
│   ├── db.py                        Supabase client setup
│   ├── routers/                     One FastAPI router per resource/module
│   │   ├── patients.py, doctors.py, ehr.py, allergies.py
│   │   ├── vitals.py, lab_results.py, alerts.py
│   │   ├── clinical_ops.py, clinical_nlp_text.py, decision_support.py
│   │   ├── risk.py, imaging_studies.py, kpi.py
│   │   ├── claims.py, audit.py, reference.py
│   │   ├── fhir.py, hl7_fhir.py, well_known.py
│   │   └── assistant.py
│   ├── Domain logic modules (used by main.py + routers):
│   │   ├── survival.py              Survival analysis (lifelines)
│   │   ├── imaging.py               DICOM load/analyze (pydicom, SimpleITK, MONAI/PyTorch CNN)
│   │   ├── fhir_cohort.py            FHIR cohort insights
│   │   ├── vitals.py                 Early-warning vitals scoring (e.g. NEWS2-style)
│   │   ├── icd10.py                  ICD-10 search + note-based code suggestion
│   │   ├── prescription.py           Drug/dose/interaction validation
│   │   ├── assignment.py             Doctor↔patient assignment optimizer
│   │   ├── forecast.py               Bed usage / staffing forecast
│   │   ├── risk_score.py             Composite patient risk scoring
│   │   ├── kpi.py                    Dashboard KPI recomputation
│   │   ├── population_health.py      Population-level health statistics
│   │   ├── claims.py                 Insurance claim generation
│   │   ├── hl7_fhir.py                HL7 v2 → FHIR conversion
│   │   ├── hl7_samples.py             Sample HL7 message library
│   │   ├── decision_support.py        Clinical decision support logic
│   │   ├── clinical_text.py           Clinical NLP / text generation (Groq)
│   │   ├── fda_interactions.py        FDA drug interaction lookups
│   │   ├── pdf_report.py              PDF report generation (reportlab)
│   │   └── nlp.py                     Shared NLP utilities (medspacy)
│   ├── models/                       mednist_classifier.pt (trained PyTorch imaging model)
│   ├── scripts/
│   │   ├── train_mednist_classifier.py
│   │   └── schema_additions*.sql     Incremental Supabase schema migrations (1 → 9)
│   ├── requirements.txt
│   ├── .env.example                  GROQ_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
│   │                                  GOOGLE_CSE_API_KEY, GOOGLE_CSE_CX
│   └── MCP.md                        MCP server setup + tool reference
│
├── supabase/
│   ├── schema_v2.sql                 Core schema (vitals, doctors, doctor_assignments,
│   │                                  prescriptions, ehr_diagnoses, ehr_medications,
│   │                                  icd10_assignments, patient_risk_scores, bed_usage_daily)
│   └── seed.sql                      Base tables + seed data (patients, clinical_alerts,
│                                      admissions_daily, resource_forecast, activity_feed,
│                                      fhir_resources, patient_events, kpi_snapshot)
│
└── package-lock.json
```

## Modules (16)

Grouped as they appear in the dashboard sidebar (`frontend/src/lib/moduleTitles.ts` is the single
source of truth for this nav):

**Interoperability**
1. Interoperability Hub (FHIR/HL7 explorer)

**Clinical AI**
2. Patient Timeline
3. Clinical NLP & Text Generation
4. Decision Support
5. ICD-10 Auto Coding
6. AI Clinical Assistant

**Risk & Monitoring**
7. Risk & Readmission Hub
8. Medical Imaging AI
9. Patient Monitoring Hub (ICU/vitals/sepsis warning)

**Operations**
10. Resource Forecasting
11. Doctor Assignment
12. Population Health Analytics
13. Insurance Claims Generator

**Core**
14. Patient Management
15. Electronic Health Records
16. Medical Prescription
17. Audit & Compliance Log

*(Several hub pages — Interoperability, Risk & Readmission, Patient Monitoring, AI Clinical
Assistant — internally tab across multiple sub-features, e.g. `SepsisWarningPage`,
`ICUMonitoringPage`, `ReadmissionRiskPage`, `ChatAssistantPage`, `ScribePage`, `FHIRExplorerPage`,
`HL7FHIRPage` all live under `frontend/src/pages/`.)*

## Data Model (Supabase / PostgreSQL)

| Table                       | Defined in                          |
|------------------------------|--------------------------------------|
| `patients`, `clinical_alerts`, `admissions_daily`, `resource_forecast`, `activity_feed`, `fhir_resources`, `patient_events`, `kpi_snapshot` | `supabase/seed.sql` |
| `vitals`, `doctors`, `doctor_assignments`, `prescriptions`, `ehr_diagnoses`, `ehr_medications`, `icd10_assignments`, `patient_risk_scores`, `bed_usage_daily` | `supabase/schema_v2.sql` |
| `lab_results`, `insurance_claims`, `audit_log` | `backend/scripts/schema_additions.sql` |
| `patient_allergies` | `backend/scripts/schema_additions_2.sql` |
| `imaging_studies` | `backend/scripts/schema_additions_3.sql` |
| `chat_sessions`, `chat_messages` | `backend/scripts/schema_additions_4.sql` |
| `hl7_conversions` | `backend/scripts/schema_additions_5.sql` |
| `clinical_language_runs` | `backend/scripts/schema_additions_6.sql` |
| `decision_support_runs` | `backend/scripts/schema_additions_7.sql` |
| `drug_interaction_ai_cache` | `backend/scripts/schema_additions_8.sql` |
| `chat_sessions.patient_id` (added column, nullable FK → `patients`) | `backend/scripts/schema_additions_9.sql` |

Run `supabase/seed.sql` and `supabase/schema_v2.sql` first, then the `schema_additions*.sql`
files under `backend/scripts/` in numeric order.

## Backend API

FastAPI app (`backend/main.py`) mounts one router per resource under `backend/routers/`, plus a
handful of inline endpoints for Groq-backed generation and stateless compute:

- `GET  /health`
- `POST /api/summarize` — Groq-generated dashboard clinical summary
- `POST /api/v1/imaging/analyze` — Groq radiology interpretation
- `POST /api/v1/imaging/samples`, `/dicom-metadata` — DICOM sample listing/analysis
- `POST /api/v1/hl7/samples` — sample HL7 messages
- `POST /api/v1/fhir/cohort-insights`
- `POST /api/v1/vitals/score`
- `POST /api/v1/icd10/search`, `/suggest-from-note`
- `POST /api/v1/prescription/validate`
- `POST /api/v1/assignment/optimize`
- `POST /api/v1/forecast/beds`
- `POST /api/v1/risk/score`, `/survival`
- `POST /api/v1/kpi/recompute`
- `POST /api/v1/population/stats`
- `POST /api/v1/claims/generate`
- Router-mounted resources: `patients`, `alerts`, `ehr`, `clinical_ops`, `fhir`, `doctors`,
  `claims`, `audit`, `reference`, `allergies`, `kpi`, `vitals`, `risk`, `lab_results`,
  `imaging_studies`, `well_known`, `assistant`, `hl7_fhir`, `clinical_nlp_text`,
  `decision_support`

## MCP Server

`backend/mcp_server.py` exposes the same clinical logic as MCP tools for an MCP client (e.g.
Claude Desktop), as a **separate process** from the HTTP API — see `backend/MCP.md` for the full
tool list, per-module CRUD tools, and Claude Desktop registration steps.

```bash
python backend/mcp_server.py
```

## Getting Started

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
copy .env.example .env         # fill in GROQ_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_CSE_*
uvicorn main:app --reload
```

Runs on `http://localhost:8000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on Vite's default dev port; expects `VITE_BACKEND_URL=http://localhost:8000` in
`frontend/.env.local`.

### Build

```bash
cd frontend
npm run build      # tsc -b && vite build → frontend/dist
```

## Deployment

- **Frontend**: Firebase Hosting (chosen over Vercel due to library compatibility issues).
- **Backend**: Google Cloud Run (free tier).
- **Database**: Supabase (Postgres/storage/realtime).
- **Realtime/Alerts**: Firebase Firestore + FCM.
- **FHIR server**: HAPI FHIR, self-hosted on Render free tier.

All services are on free tiers by design; no paid GCP Healthcare API is used.
