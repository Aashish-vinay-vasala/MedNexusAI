"""Renders a saved HL7 -> FHIR conversion record (see routers/hl7_fhir.py, table
hl7_conversions) into a downloadable PDF report -- generated on demand from the DB row rather
than stored as a binary, since nothing else in this codebase uses Supabase Storage yet."""

import io
import json

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Preformatted

_STYLES = getSampleStyleSheet()
_TITLE = ParagraphStyle("ReportTitle", parent=_STYLES["Title"], fontSize=18, spaceAfter=4)
_HEADING = ParagraphStyle("ReportHeading", parent=_STYLES["Heading2"], fontSize=12, spaceBefore=14, spaceAfter=6)
_BODY = ParagraphStyle("ReportBody", parent=_STYLES["BodyText"], fontSize=10, leading=14)
_MONO = ParagraphStyle("ReportMono", parent=_STYLES["Code"], fontSize=8, leading=10)


def build_conversion_pdf(record: dict) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        topMargin=20 * mm, bottomMargin=18 * mm, leftMargin=18 * mm, rightMargin=18 * mm,
    )

    story = [
        Paragraph("HL7 &rarr; FHIR Conversion Report", _TITLE),
        Paragraph("MedNexusAI Interoperability Module", _BODY),
        Spacer(1, 10),
    ]

    status = (record.get("status") or "").upper()
    status_color = colors.HexColor("#22C55E") if record.get("status") == "success" else colors.HexColor("#EF4444")
    meta_rows = [
        ["Record ID", str(record.get("id", ""))],
        ["Source", f"{record.get('source', '')}" + (f" ({record.get('filename')})" if record.get("filename") else "")],
        ["Message Type", record.get("message_type") or "—"],
        ["Status", status],
        ["Created At", str(record.get("created_at", ""))],
    ]
    meta_table = Table(meta_rows, colWidths=[110, 360])
    meta_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#6B7280")),
        ("TEXTCOLOR", (1, 3), (1, 3), status_color),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
    ]))
    story.append(meta_table)

    if record.get("status") == "error" and record.get("error_message"):
        story.append(Paragraph("Error", _HEADING))
        story.append(Paragraph(record["error_message"], _BODY))

    if record.get("description"):
        story.append(Paragraph("AI-Generated Description", _HEADING))
        for line in str(record["description"]).splitlines():
            story.append(Paragraph(line or "&nbsp;", _BODY))

    story.append(Paragraph("HL7 v2 Input", _HEADING))
    story.append(Preformatted(record.get("hl7_input") or "", _MONO))

    if record.get("fhir_output"):
        story.append(Paragraph("FHIR R4 Output", _HEADING))
        pretty = json.dumps(record["fhir_output"], indent=2)
        story.append(Preformatted(pretty, _MONO))

    doc.build(story)
    return buffer.getvalue()


_MODE_LABELS = {
    "nlp_analyze": "NLP Entity Analysis",
    "note_summary": "Clinical Note Summary",
    "report_summary": "Lab Report Summary",
    "discharge_letter": "Discharge Letter",
}


def _clinical_run_story(record: dict) -> list:
    """Flowables for one clinical_language_runs row -- shared by the single-record PDF
    and each record's section in the bundled export PDF."""
    story = []

    status = (record.get("status") or "").upper()
    status_color = colors.HexColor("#22C55E") if record.get("status") == "success" else colors.HexColor("#EF4444")
    meta_rows = [
        ["Record ID", str(record.get("id", ""))],
        ["Mode", _MODE_LABELS.get(record.get("mode"), record.get("mode") or "—")],
        ["Patient", f"{record.get('patient_name') or '—'} ({record.get('patient_id') or 'N/A'})"],
        ["Status", status],
        ["Version", str(record.get("version", 1))],
        ["Created At", str(record.get("created_at", ""))],
    ]
    meta_table = Table(meta_rows, colWidths=[110, 360])
    meta_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#6B7280")),
        ("TEXTCOLOR", (1, 3), (1, 3), status_color),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
    ]))
    story.append(meta_table)

    if record.get("status") == "error" and record.get("error_message"):
        story.append(Paragraph("Error", _HEADING))
        story.append(Paragraph(record["error_message"], _BODY))

    if record.get("input_text"):
        story.append(Paragraph("Input", _HEADING))
        story.append(Preformatted(record["input_text"], _MONO))

    if record.get("mode") == "nlp_analyze" and record.get("output_entities"):
        story.append(Paragraph("Extracted Entities", _HEADING))
        rows = [["Text", "Type", "Negated", "Uncertain"]] + [
            [e.get("text", ""), e.get("type", ""), "Yes" if e.get("is_negated") else "", "Yes" if e.get("is_uncertain") else ""]
            for e in record["output_entities"]
        ]
        entity_table = Table(rows, colWidths=[200, 110, 80, 80])
        entity_table.setStyle(TableStyle([
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#6B7280")),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("LINEBELOW", (0, 0), (-1, -1), 0.4, colors.HexColor("#E5E7EB")),
        ]))
        story.append(entity_table)
    elif record.get("output_text"):
        story.append(Paragraph("Generated Text", _HEADING))
        for line in str(record["output_text"]).splitlines():
            story.append(Paragraph(line or "&nbsp;", _BODY))

    return story


def build_clinical_run_pdf(record: dict) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        topMargin=20 * mm, bottomMargin=18 * mm, leftMargin=18 * mm, rightMargin=18 * mm,
    )

    story = [
        Paragraph("Clinical NLP &amp; Text Generation Report", _TITLE),
        Paragraph("MedNexusAI Clinical AI Module", _BODY),
        Spacer(1, 10),
    ]
    story.extend(_clinical_run_story(record))

    doc.build(story)
    return buffer.getvalue()


def build_clinical_bundle_pdf(records: list[dict], stats: dict) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        topMargin=20 * mm, bottomMargin=18 * mm, leftMargin=18 * mm, rightMargin=18 * mm,
    )

    story = [
        Paragraph("Clinical NLP &amp; Text Generation — History Export", _TITLE),
        Paragraph(f"MedNexusAI Clinical AI Module &middot; {len(records)} record(s)", _BODY),
        Spacer(1, 10),
        Paragraph("Summary", _HEADING),
    ]

    summary_rows = [["Mode", "Count"]] + [[_MODE_LABELS.get(m["mode"], m["mode"]), str(m["count"])] for m in stats.get("by_mode", [])]
    summary_rows.append(["Success", str(stats.get("success_count", 0))])
    summary_rows.append(["Error", str(stats.get("error_count", 0))])
    summary_table = Table(summary_rows, colWidths=[200, 100])
    summary_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#6B7280")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, colors.HexColor("#E5E7EB")),
    ]))
    story.append(summary_table)

    for record in records:
        story.append(Paragraph(f"Record #{record.get('id')} — {_MODE_LABELS.get(record.get('mode'), record.get('mode'))}", _HEADING))
        story.extend(_clinical_run_story(record))
        story.append(Spacer(1, 14))

    doc.build(story)
    return buffer.getvalue()


_SEVERITY_COLORS = {
    "critical": colors.HexColor("#EF4444"),
    "high": colors.HexColor("#F59E0B"),
    "medium": colors.HexColor("#0EA5E9"),
}


def _decision_support_story(record: dict) -> list:
    """Flowables for one decision_support_runs row -- shared by the single-record PDF and
    each record's section in the bundled export PDF."""
    story = []

    severity = record.get("highest_severity")
    severity_color = _SEVERITY_COLORS.get(severity, colors.HexColor("#22C55E"))
    meta_rows = [
        ["Record ID", str(record.get("id", ""))],
        ["Mode", "Regimen (multi-drug)" if record.get("mode") == "regimen" else "Pairwise"],
        ["Patient", f"{record.get('patient_name') or '—'} ({record.get('patient_id') or 'N/A'})"],
        ["Drugs Checked", ", ".join(record.get("drugs") or [])],
        ["Interactions Found", str(record.get("interaction_count", 0))],
        ["Highest Severity", (severity or "None").upper()],
        ["Created At", str(record.get("created_at", ""))],
    ]
    meta_table = Table(meta_rows, colWidths=[110, 360])
    meta_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#6B7280")),
        ("TEXTCOLOR", (1, 5), (1, 5), severity_color),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
    ]))
    story.append(meta_table)

    if record.get("status") == "error" and record.get("error_message"):
        story.append(Paragraph("Error", _HEADING))
        story.append(Paragraph(record["error_message"], _BODY))

    interactions = record.get("interactions") or []
    if interactions:
        story.append(Paragraph("Interactions", _HEADING))
        rows = [["Drug A", "Drug B", "Severity", "Effect"]] + [
            [i.get("drug_a", ""), i.get("drug_b", ""), (i.get("severity") or "").upper(), i.get("effect") or ""]
            for i in interactions
        ]
        interaction_table = Table(rows, colWidths=[80, 80, 55, 255])
        interaction_table.setStyle(TableStyle([
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#6B7280")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("LINEBELOW", (0, 0), (-1, -1), 0.4, colors.HexColor("#E5E7EB")),
        ]))
        story.append(interaction_table)
    else:
        story.append(Paragraph("No known interaction found among the checked drugs.", _BODY))

    return story


def build_decision_support_pdf(record: dict) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        topMargin=20 * mm, bottomMargin=18 * mm, leftMargin=18 * mm, rightMargin=18 * mm,
    )

    story = [
        Paragraph("Decision Support — Drug Interaction Report", _TITLE),
        Paragraph("MedNexusAI Clinical Decision Support Module", _BODY),
        Spacer(1, 10),
    ]
    story.extend(_decision_support_story(record))

    doc.build(story)
    return buffer.getvalue()


def build_decision_support_bundle_pdf(records: list[dict], stats: dict) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        topMargin=20 * mm, bottomMargin=18 * mm, leftMargin=18 * mm, rightMargin=18 * mm,
    )

    story = [
        Paragraph("Decision Support — History Export", _TITLE),
        Paragraph(f"MedNexusAI Clinical Decision Support Module &middot; {len(records)} record(s)", _BODY),
        Spacer(1, 10),
        Paragraph("Summary", _HEADING),
    ]

    summary_rows = [["Severity", "Count"]] + [[s["severity"].capitalize(), str(s["count"])] for s in stats.get("severity_freq", [])]
    summary_rows.append(["Success", str(stats.get("success_count", 0))])
    summary_rows.append(["Error", str(stats.get("error_count", 0))])
    summary_table = Table(summary_rows, colWidths=[200, 100])
    summary_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#6B7280")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, colors.HexColor("#E5E7EB")),
    ]))
    story.append(summary_table)

    for record in records:
        story.append(Paragraph(f"Record #{record.get('id')} — {', '.join(record.get('drugs') or [])}", _HEADING))
        story.extend(_decision_support_story(record))
        story.append(Spacer(1, 14))

    doc.build(story)
    return buffer.getvalue()


def build_patient_fhir_report_pdf(patient_id: str, patient_name: str | None, resources: list[dict], description: str | None) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        topMargin=20 * mm, bottomMargin=18 * mm, leftMargin=18 * mm, rightMargin=18 * mm,
    )

    story = [
        Paragraph("Patient FHIR R4 Report", _TITLE),
        Paragraph("MedNexusAI Interoperability Module", _BODY),
        Spacer(1, 10),
    ]

    meta_rows = [
        ["Patient ID", patient_id],
        ["Patient Name", patient_name or "—"],
        ["Resource Count", str(len(resources))],
    ]
    meta_table = Table(meta_rows, colWidths=[110, 360])
    meta_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#6B7280")),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
    ]))
    story.append(meta_table)

    if description:
        story.append(Paragraph("AI-Generated Description", _HEADING))
        for line in description.splitlines():
            story.append(Paragraph(line or "&nbsp;", _BODY))

    for res in resources:
        story.append(Paragraph(res.get("resource_type") or "Resource", _HEADING))
        pretty = json.dumps(res.get("resource_json"), indent=2)
        story.append(Preformatted(pretty, _MONO))

    doc.build(story)
    return buffer.getvalue()
