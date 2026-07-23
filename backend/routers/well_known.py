"""
Discovery endpoints under /.well-known/ so external tools and AI agents can find out what
this service offers without prior configuration:
  - /.well-known/mcp/server-card.json   — describes the MCP tool server (mcp_server.py)
  - /.well-known/agent-skills/index.json — catalogue of invokable AI/clinical-logic capabilities
  - /.well-known/api-catalog             — RFC 9727 linkset pointing at the OpenAPI description

All three are built from the incoming request's base URL, so they stay correct across
localhost, Cloud Run, and any future custom domain without hardcoding a host.
"""

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter(tags=["discovery"])

MCP_TOOLS = [
    {
        "name": "analyze_clinical_note",
        "description": "Run clinical NLP (MedSpaCy) on a note: extracts CONDITION/MEDICATION/"
        "PROCEDURE/SYMPTOM/VITAL entities with negation and uncertainty detection.",
    },
    {
        "name": "compute_survival_analysis",
        "description": "Kaplan-Meier readmission-free survival curve + Cox proportional-hazards "
        "ratios for a patient cohort.",
    },
    {
        "name": "list_dicom_samples",
        "description": "List the sample DICOM studies (CT/MRI/Ultrasound) available for imaging analysis.",
    },
    {
        "name": "analyze_dicom_sample",
        "description": "Parse a sample DICOM study's metadata, compute pixel-level stats, and "
        "classify modality/anatomy with a MONAI DenseNet trained on MedNIST.",
    },
    {
        "name": "get_fhir_cohort_insights",
        "description": "Flatten a cohort's FHIR resources into condition/medication frequency counts.",
    },
    {
        "name": "compute_vitals_score",
        "description": "Compute NEWS2, qSOFA, and SIRS clinical early-warning scores from vital signs.",
    },
    {
        "name": "check_drug_interaction",
        "description": "Check whether two drugs have a known interaction, its severity, and mechanism.",
    },
    {
        "name": "search_icd10_codes",
        "description": "Search the offline WHO ICD-10 code hierarchy by free-text query.",
    },
    {
        "name": "optimize_doctor_assignment",
        "description": "Assign patients to doctors via least-loaded, ward-to-specialty-matched "
        "greedy assignment.",
    },
    {
        "name": "compute_bed_forecast",
        "description": "Forecast 7 days of bed usage/staffing from daily history via damped-trend "
        "exponential smoothing.",
    },
]

LLM_SKILLS = [
    {
        "id": "clinical-text-generation",
        "name": "Clinical Text Generation",
        "description": "Generate a note summary, lab report summary, or discharge letter from "
        "structured/free-text clinical input.",
        "surface": "http",
        "endpoint": "/api/v1/clinical-text/generate",
        "method": "POST",
        "category": "clinical-documentation",
    },
    {
        "id": "ambient-scribe",
        "name": "Ambient Scribe",
        "description": "Transcribe a clinical encounter audio recording (Whisper) and generate a "
        "structured SOAP note from the transcript.",
        "surface": "http",
        "endpoint": "/api/v1/assistant/scribe",
        "method": "POST",
        "category": "clinical-documentation",
    },
    {
        "id": "chat-assistant",
        "name": "MedNexusAI Assistant (Global Chat)",
        "description": "Multi-turn AI chat, persisted per device/session, optionally grounded in "
        "a specific patient's diagnoses/medications/vitals/alerts, with optional web-search "
        "grounding and file-attachment context.",
        "surface": "http",
        "endpoint": "/api/v1/assistant/chat",
        "method": "POST",
        "category": "clinical-decision-support",
    },
    {
        "id": "assistant-transcribe",
        "name": "Voice Input Transcription",
        "description": "Transcribe a short voice clip (Whisper) for the assistant's mic-to-text input.",
        "surface": "http",
        "endpoint": "/api/v1/assistant/transcribe",
        "method": "POST",
        "category": "clinical-documentation",
    },
    {
        "id": "assistant-analyze-image",
        "name": "Assistant Image Analysis",
        "description": "Describe/interpret an uploaded image via a Groq vision-capable model.",
        "surface": "http",
        "endpoint": "/api/v1/assistant/analyze-image",
        "method": "POST",
        "category": "medical-imaging",
    },
    {
        "id": "assistant-parse-document",
        "name": "Assistant Document Parsing",
        "description": "Extract text from an uploaded PDF/DOCX/XLSX so it can be folded into a chat answer.",
        "surface": "http",
        "endpoint": "/api/v1/assistant/parse-document",
        "method": "POST",
        "category": "clinical-documentation",
    },
    {
        "id": "assistant-web-search",
        "name": "Assistant Web Search",
        "description": "Search the web (Google Custom Search) and return grounded snippets/links/favicons.",
        "surface": "http",
        "endpoint": "/api/v1/assistant/web-search",
        "method": "POST",
        "category": "operations",
    },
    {
        "id": "assistant-summarize-page",
        "name": "Assistant Page Summary",
        "description": "Summarize the currently viewed dashboard page/module for a quick digest.",
        "surface": "http",
        "endpoint": "/api/v1/assistant/summarize-page",
        "method": "POST",
        "category": "operations",
    },
    {
        "id": "imaging-interpretation",
        "name": "Imaging Interpretation",
        "description": "Produce a plain-language clinical interpretation of a DICOM study's "
        "MONAI-classified modality/anatomy findings.",
        "surface": "http",
        "endpoint": "/api/v1/imaging/analyze",
        "method": "POST",
        "category": "medical-imaging",
    },
    {
        "id": "dashboard-summary",
        "name": "Dashboard Clinical Summary",
        "description": "Summarize current KPIs, active alerts, admissions, and bed forecast into "
        "a narrative operations digest.",
        "surface": "http",
        "endpoint": "/api/summarize",
        "method": "POST",
        "category": "operations",
    },
] + [
    {
        "id": tool["name"],
        "name": tool["name"].replace("_", " ").title(),
        "description": tool["description"],
        "surface": "mcp-tool",
        "endpoint": None,
        "method": None,
        "category": "clinical-logic",
    }
    for tool in MCP_TOOLS
]


@router.get("/.well-known/mcp/server-card.json")
def mcp_server_card(request: Request):
    base = str(request.base_url).rstrip("/")
    return JSONResponse(
        {
            "name": "MedNexusAI",
            "description": "Deterministic clinical-logic tools (NLP, survival analysis, DICOM "
            "imaging stats, FHIR cohort insights, vitals scoring, drug interactions, ICD-10 "
            "search, doctor assignment, bed forecasting) exposed to MCP clients.",
            "version": "1.0.0",
            "mcpVersion": "1.0",
            "homepage": base,
            "documentation": f"{base}/docs",
            "transport": {
                "type": "stdio",
                "note": "Launched locally by the MCP client (e.g. Claude Desktop); not currently "
                "served over HTTP/SSE at a network address. See backend/MCP.md for launch config.",
            },
            "auth": {"type": "none"},
            "capabilities": {"tools": True, "resources": False, "prompts": False, "streaming": False},
            "tools": MCP_TOOLS,
        }
    )


@router.get("/.well-known/agent-skills/index.json")
def agent_skills_index(request: Request):
    base = str(request.base_url).rstrip("/")
    return JSONResponse(
        {
            "name": "MedNexusAI",
            "description": "Catalogue of AI and clinical-logic capabilities an agent can invoke "
            "against the MedNexusAI backend, either over HTTP or via the MCP tool server.",
            "version": "1.0.0",
            "baseUrl": base,
            "skills": LLM_SKILLS,
        }
    )


@router.get("/.well-known/api-catalog")
def api_catalog(request: Request):
    base = str(request.base_url).rstrip("/")
    return JSONResponse(
        {
            "linkset": [
                {
                    "anchor": f"{base}/",
                    "service-desc": [
                        {"href": f"{base}/openapi.json", "type": "application/vnd.oai.openapi+json;version=3.0"}
                    ],
                    "service-doc": [{"href": f"{base}/docs", "type": "text/html"}],
                }
            ]
        },
        media_type="application/linkset+json",
    )
