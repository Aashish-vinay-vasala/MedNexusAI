# MedNexusAI MCP Server

`mcp_server.py` exposes the same clinical logic used by the FastAPI backend (`main.py`) as MCP
tools, so an MCP client (e.g. Claude Desktop) can query/act on it directly. It's a **separate
process** from `uvicorn main:app` — running it does not start or replace the HTTP API the
frontend uses.

## Run standalone

```bash
python backend/mcp_server.py
```

It communicates over stdio and is meant to be launched by an MCP client, not run persistently
in a terminal.

## Register with Claude Desktop

Add an entry to `claude_desktop_config.json`
(Windows: `%APPDATA%\Claude\claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "mednexus": {
      "command": "C:\\Users\\<you>\\AppData\\Local\\Programs\\Python\\Python314\\python.exe",
      "args": ["K:\\Projects\\MedNexusAI\\backend\\mcp_server.py"]
    }
  }
}
```

Use the **absolute** path to your Python interpreter (find it with `where python`) — Claude
Desktop launches servers with a minimal `PATH`, so a bare `python`/`python3` command often fails
to resolve. Restart Claude Desktop after editing the config.

## Available tools

`analyze_clinical_note`, `compute_survival_analysis`, `list_dicom_samples`,
`analyze_dicom_sample`, `get_fhir_cohort_insights`, `get_patient_fhir_resources`,
`upsert_patient_fhir_resource`, `delete_patient_fhir_resource`, `compute_vitals_score`,
`check_drug_interaction`, `check_medication_regimen`, `optimize_doctor_assignment`,
`compute_bed_forecast`, `convert_hl7_to_fhir`, `generate_clinical_text`,
`list_clinical_history`, `get_clinical_record`, `delete_clinical_record`
— see `mcp_server.py` for each tool's parameters.

### Full CRUD tools (persisted, per module)

Every module below has create/list/get/update/delete tools backed by the same Supabase
tables the web app reads and writes, so an MCP client can manage records directly:

- **Decision Support** (`decision_support_runs`): `save_decision_support_run`,
  `list_decision_support_history`, `get_decision_support_record`,
  `update_decision_support_record` (relabels patient linkage only — the computed
  drugs/interactions are immutable), `delete_decision_support_record`.
- **ICD-10 Auto Coding** (`icd10_assignments`): `search_icd10_codes` (stateless lookup),
  `create_icd10_assignment`, `list_icd10_assignments`, `get_icd10_assignment`,
  `update_icd10_assignment`, `delete_icd10_assignment`.
- **AI Clinical Assistant** (`chat_sessions` / `chat_messages`): `list_chat_sessions`,
  `get_chat_session_messages`, `update_chat_session_title`, `delete_chat_session`
  (sessions are created implicitly by the assistant chat flow in the web app).
- **Risk & Readmission** (`patient_risk_scores`): `list_risk_scores`,
  `save_risk_score` (upsert on patient_id+dimension), `delete_risk_score`.
- **Medical Imaging AI** (`imaging_studies`): `list_imaging_studies`,
  `create_imaging_study`, `update_imaging_study`, `delete_imaging_study`.
- **Patient Monitoring** (`vitals`, `lab_results`): `list_vitals_history`,
  `create_vitals_reading`, `update_vitals_reading`, `delete_vitals_reading`,
  `list_lab_results`, `create_lab_result`, `update_lab_result`, `delete_lab_result`.

## Scope note

This server only exposes MedNexusAI's own tools (server direction). It does not consume any
external MCP servers — that's a separate, not-yet-scoped effort pending a concrete target server.
