"""
AI assistant endpoints: multi-turn chat (patient-optional, history-aware, persisted to
Supabase), voice transcription, image analysis, document parsing, web search, page
summarization, and session history — backing the global floating AI Assistant widget
(frontend/src/components/assistant/) and the patient-scoped Chat Assistant page.
"""

import base64
import io
import os
from datetime import datetime, timezone
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from groq import Groq
from pydantic import BaseModel

from db import require_db

router = APIRouter(prefix="/api/v1/assistant", tags=["assistant"])

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

CHAT_MODEL = "llama-3.3-70b-versatile"
# Groq's vision-model lineup changes fairly often — reconfirm this id against
# console.groq.com/docs/vision if image analysis starts failing.
VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"

MAX_EXTRACTED_CHARS = 6000
MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_DOCUMENT_BYTES = 15 * 1024 * 1024


class AssistantChatRequest(BaseModel):
    question: str
    device_id: str
    session_id: int | None = None
    patient_id: str | None = None
    patient_name: str | None = None
    context: dict = {}
    web_search: bool = False
    attachments: list[dict] = []  # [{kind: 'image'|'audio'|'document', label: str, extracted_text: str}]


class SummarizePageRequest(BaseModel):
    page: str
    data: dict


class SessionUpdate(BaseModel):
    device_id: str
    title: str


def _truncate(text: str, limit: int = MAX_EXTRACTED_CHARS) -> str:
    return text if len(text) <= limit else text[: limit] + "\n...[truncated]"


def search_google_cse(query: str, num: int = 5) -> list[dict]:
    api_key = os.getenv("GOOGLE_CSE_API_KEY")
    cx = os.getenv("GOOGLE_CSE_CX")
    if not api_key or not cx:
        raise HTTPException(
            status_code=503,
            detail="Web search not configured (GOOGLE_CSE_API_KEY / GOOGLE_CSE_CX missing)",
        )
    try:
        resp = httpx.get(
            "https://www.googleapis.com/customsearch/v1",
            params={"key": api_key, "cx": cx, "q": query, "num": num},
            timeout=10,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Web search request failed: {exc}")
    if resp.status_code == 429:
        raise HTTPException(status_code=429, detail="Web search quota exceeded — try again tomorrow or disable web search")
    if resp.is_error:
        raise HTTPException(status_code=502, detail=f"Web search failed: {resp.text[:200]}")
    results = []
    for it in resp.json().get("items", []):
        link = it.get("link", "")
        host = urlparse(link).hostname or ""
        results.append({
            "title": it.get("title"),
            "url": link,
            "snippet": it.get("snippet"),
            "favicon": f"https://www.google.com/s2/favicons?domain={host}",
        })
    return results


def _get_or_create_session(db, device_id: str, session_id: int | None, first_question: str,
                            page_context: str | None, patient_id: str | None) -> int:
    if session_id is not None:
        existing = (
            db.table("chat_sessions").select("id").eq("id", session_id).eq("device_id", device_id).execute().data
        )
        if existing:
            db.table("chat_sessions").update({"updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", session_id).execute()
            return session_id
    title = (first_question[:60] + "…") if len(first_question) > 60 else first_question
    base_row = {"device_id": device_id, "title": title, "page_context": page_context}
    try:
        row = db.table("chat_sessions").insert({**base_row, "patient_id": patient_id}).execute().data[0]
    except Exception as exc:
        # The chat_sessions.patient_id column is added by schema_additions_9.sql — tolerate it
        # not existing yet so the core chat flow keeps working on a DB that hasn't been migrated.
        if "patient_id" not in str(exc):
            raise
        row = db.table("chat_sessions").insert(base_row).execute().data[0]
    return row["id"]


def _save_message(db, session_id: int, role: str, content: str, sources: list[dict] | None = None):
    db.table("chat_messages").insert({
        "session_id": session_id, "role": role, "content": content, "sources": sources,
    }).execute()


@router.post("/chat")
async def assistant_chat(req: AssistantChatRequest):
    if not os.getenv("GROQ_API_KEY"):
        raise HTTPException(status_code=503, detail="GROQ_API_KEY not configured")

    db = require_db()
    page_context = req.context.get("page") if isinstance(req.context, dict) else None
    session_id = _get_or_create_session(db, req.device_id, req.session_id, req.question, page_context, req.patient_id)

    history_rows = (
        db.table("chat_messages").select("role,content").eq("session_id", session_id)
        .order("created_at").limit(20).execute().data
    )

    sources: list[dict] = []
    search_block = ""
    if req.web_search:
        sources = search_google_cse(req.question)
        if sources:
            search_block = "\n\nSEARCH RESULTS (use to ground your answer, cite by title where relevant):\n" + "\n".join(
                f"• {s['title']} — {s['snippet']} ({s['url']})" for s in sources
            )

    attachments_block = ""
    if req.attachments:
        attachments_block = "\n\nATTACHMENTS:\n" + "\n".join(
            f"[{a.get('kind')}] {a.get('label', '')}: {_truncate(a.get('extracted_text', ''))}" for a in req.attachments
        )

    if req.patient_id:
        diagnoses = req.context.get("diagnoses", [])
        medications = req.context.get("medications", [])
        vitals_ctx = req.context.get("vitals")
        alerts = req.context.get("alerts", [])
        patient_block = f"""
PATIENT: {req.patient_name} ({req.patient_id})

DIAGNOSES:
{chr(10).join(f"• {d.get('code', '')} — {d.get('description', '')}" for d in diagnoses) or "None recorded"}

MEDICATIONS:
{chr(10).join(f"• {m.get('name', '')} {m.get('dose', '')} — {m.get('frequency', '')} {m.get('route', '')}" for m in medications) or "None recorded"}

LATEST VITALS:
{vitals_ctx if vitals_ctx else "No vitals recorded"}

RECENT ALERTS:
{chr(10).join(f"• [{a.get('severity', '')}] {a.get('type', '')} — {a.get('detail', '')}" for a in alerts) or "None"}
"""
        system_prompt = (
            "You are MedNexusAI Assistant, a clinical AI assistant answering questions about a "
            "specific patient. Only use the PATIENT context below — if the answer isn't in it, say "
            "so plainly rather than guessing." + patient_block
        )
    else:
        system_prompt = (
            "You are MedNexusAI Assistant, a general-purpose clinical AI assistant embedded in a "
            "hospital management platform. Answer clearly and concisely. If the user's question "
            "needs specific patient data you don't have, say so rather than guessing."
        )

    system_prompt += search_block + attachments_block

    messages = [{"role": "system", "content": system_prompt}]
    for m in history_rows:
        if m["role"] in ("user", "assistant"):
            messages.append({"role": m["role"], "content": m["content"]})
    messages.append({"role": "user", "content": req.question})

    try:
        response = groq_client.chat.completions.create(
            model=CHAT_MODEL, messages=messages, max_tokens=600, temperature=0.3,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Groq request failed: {exc}")

    answer = response.choices[0].message.content or ""

    _save_message(db, session_id, "user", req.question)
    _save_message(db, session_id, "assistant", answer, sources or None)

    return {"answer": answer, "session_id": session_id, "sources": sources}


@router.post("/scribe")
async def assistant_scribe(file: UploadFile | None = File(None), transcript_text: str | None = Form(None)):
    if not os.getenv("GROQ_API_KEY"):
        raise HTTPException(status_code=503, detail="GROQ_API_KEY not configured")

    if file is not None:
        try:
            transcription = groq_client.audio.transcriptions.create(
                file=(file.filename or "audio.webm", await file.read()),
                model="whisper-large-v3",
            )
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Transcription failed: {exc}")
        transcript = transcription.text
    elif transcript_text and transcript_text.strip():
        transcript = transcript_text.strip()
    else:
        raise HTTPException(status_code=400, detail="Provide either an audio file or transcript_text")

    prompt = f"""You are a clinical AI scribe. Convert the following raw dictation/transcript into a structured clinical note with these sections in ALL CAPS: SUBJECTIVE, OBJECTIVE, ASSESSMENT, PLAN. Keep each section concise (2-4 sentences). Do not add any text before the first section header.

TRANSCRIPT:
{transcript}"""

    try:
        response = groq_client.chat.completions.create(
            model=CHAT_MODEL, messages=[{"role": "user", "content": prompt}], max_tokens=700, temperature=0.3,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Groq request failed: {exc}")

    soap_note = response.choices[0].message.content or ""
    return {"transcript": transcript, "soap_note": soap_note}


@router.post("/transcribe")
async def assistant_transcribe(file: UploadFile = File(...)):
    """STT-only variant of /scribe for the widget's voice-input mic button — no SOAP note."""
    if not os.getenv("GROQ_API_KEY"):
        raise HTTPException(status_code=503, detail="GROQ_API_KEY not configured")
    try:
        transcription = groq_client.audio.transcriptions.create(
            file=(file.filename or "audio.webm", await file.read()),
            model="whisper-large-v3",
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Transcription failed: {exc}")
    return {"transcript": transcription.text}


@router.post("/analyze-image")
async def analyze_image(file: UploadFile = File(...), question: str | None = Form(None)):
    if not os.getenv("GROQ_API_KEY"):
        raise HTTPException(status_code=503, detail="GROQ_API_KEY not configured")
    raw = await file.read()
    if len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image too large (max 10MB)")

    b64 = base64.b64encode(raw).decode("utf-8")
    mime = file.content_type or "image/jpeg"
    prompt_text = question or "Describe this image and note anything clinically relevant."

    try:
        response = groq_client.chat.completions.create(
            model=VISION_MODEL,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt_text},
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
                ],
            }],
            max_tokens=500,
            temperature=0.3,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Image analysis failed: {exc}")

    return {"description": response.choices[0].message.content or ""}


@router.post("/parse-document")
async def parse_document(file: UploadFile = File(...)):
    raw = await file.read()
    if len(raw) > MAX_DOCUMENT_BYTES:
        raise HTTPException(status_code=413, detail="Document too large (max 15MB)")
    name = (file.filename or "").lower()

    try:
        if name.endswith(".pdf"):
            import pdfplumber
            with pdfplumber.open(io.BytesIO(raw)) as pdf:
                text = "\n".join((page.extract_text() or "") for page in pdf.pages)
        elif name.endswith(".docx"):
            import docx
            document = docx.Document(io.BytesIO(raw))
            text = "\n".join(p.text for p in document.paragraphs)
        elif name.endswith(".xlsx") or name.endswith(".xls"):
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(raw), data_only=True)
            lines = []
            for ws in wb.worksheets:
                lines.append(f"Sheet: {ws.title}")
                for row in ws.iter_rows(max_row=200, values_only=True):
                    if any(c is not None for c in row):
                        lines.append(", ".join(str(c) for c in row if c is not None))
            text = "\n".join(lines)
        else:
            raise HTTPException(status_code=400, detail="Unsupported document type — use PDF, DOCX, XLS, or XLSX")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Failed to parse document: {exc}")

    return {"extracted_text": _truncate(text.strip())}


@router.post("/web-search")
async def web_search(query: str = Form(...)):
    return {"results": search_google_cse(query)}


@router.post("/summarize-page")
async def summarize_page(req: SummarizePageRequest):
    if not os.getenv("GROQ_API_KEY"):
        raise HTTPException(status_code=503, detail="GROQ_API_KEY not configured")

    prompt = f"""You are MedNexusAI Assistant. Summarize the current "{req.page}" page for a clinician glancing at it, using the structured data below. Be concise (4-6 sentences or bullet points), and call out anything that needs attention.

PAGE DATA:
{req.data}"""

    try:
        response = groq_client.chat.completions.create(
            model=CHAT_MODEL, messages=[{"role": "user", "content": prompt}], max_tokens=600, temperature=0.3,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Groq request failed: {exc}")

    return {"summary": response.choices[0].message.content or ""}


@router.get("/sessions")
async def list_sessions(device_id: str, patient_id: str | None = None):
    db = require_db()
    try:
        q = db.table("chat_sessions").select("id,title,page_context,patient_id,updated_at").eq("device_id", device_id)
        if patient_id:
            q = q.eq("patient_id", patient_id)
        rows = q.order("updated_at", desc=True).limit(50).execute().data
    except Exception as exc:
        # Same pre-migration tolerance as _get_or_create_session — patient_id filtering is
        # simply unavailable (returns every session) until schema_additions_9.sql has run.
        if "patient_id" not in str(exc):
            raise
        rows = (
            db.table("chat_sessions").select("id,title,page_context,updated_at")
            .eq("device_id", device_id).order("updated_at", desc=True).limit(50).execute().data
        )
        for r in rows:
            r["patient_id"] = None
    return {"sessions": rows}


@router.get("/sessions/{session_id}/messages")
async def get_session_messages(session_id: int, device_id: str):
    db = require_db()
    owned = db.table("chat_sessions").select("id").eq("id", session_id).eq("device_id", device_id).execute().data
    if not owned:
        raise HTTPException(status_code=404, detail="Session not found")
    rows = (
        db.table("chat_messages").select("role,content,sources,created_at")
        .eq("session_id", session_id).order("created_at").execute().data
    )
    return {"messages": rows}


@router.put("/sessions/{session_id}")
async def rename_session(session_id: int, body: SessionUpdate):
    db = require_db()
    owned = db.table("chat_sessions").select("id").eq("id", session_id).eq("device_id", body.device_id).execute().data
    if not owned:
        raise HTTPException(status_code=404, detail="Session not found")
    res = db.table("chat_sessions").update({"title": body.title}).eq("id", session_id).execute()
    return res.data[0]


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: int, device_id: str):
    db = require_db()
    owned = db.table("chat_sessions").select("id").eq("id", session_id).eq("device_id", device_id).execute().data
    if not owned:
        raise HTTPException(status_code=404, detail="Session not found")
    db.table("chat_sessions").delete().eq("id", session_id).execute()
    return {"status": "deleted"}
