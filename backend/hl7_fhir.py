"""HL7 v2 -> FHIR R4 conversion logic, used by routers/hl7_fhir.py (persisted, device-scoped
history) and exposed statelessly as an MCP tool in mcp_server.py.

Ported from the original client-side hl7ToFhir() (frontend/src/pages/HL7FHIRPage.tsx), but the
message type is detected here from MSH-9 instead of being supplied by the UI from a fixed sample
list -- that's what makes this work on arbitrary uploaded messages, not just the three canned
demo samples.
"""

from datetime import datetime, timezone


def _segment(lines: list[str], tag: str) -> list[str]:
    for line in lines:
        if line.startswith(tag):
            return line.split("|")
    return []


def _field(segment: list[str], index: int) -> str:
    return segment[index] if len(segment) > index else ""


def _drop_none(d: dict) -> dict:
    return {k: v for k, v in d.items() if v is not None}


def _hl7_datetime(value: str) -> str | None:
    if not value or len(value) < 14:
        return None
    return f"{value[0:4]}-{value[4:6]}-{value[6:8]}T{value[8:10]}:{value[10:12]}:{value[12:14]}Z"


def _hl7_date(value: str) -> str | None:
    if not value or len(value) < 8:
        return None
    return f"{value[0:4]}-{value[4:6]}-{value[6:8]}"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def parse_message_type(hl7_text: str) -> str:
    """Reads MSH-9 (message type, e.g. 'ADT^A01') from the message's MSH segment."""
    lines = hl7_text.strip().splitlines()
    msh = _segment(lines, "MSH")
    if not msh:
        raise ValueError("No MSH segment found -- not a valid HL7 v2 message")
    message_type = _field(msh, 8)
    if not message_type:
        raise ValueError("MSH segment is missing a message type (MSH-9)")
    return message_type


def convert(hl7_text: str) -> dict:
    """Converts an HL7 v2 message into a FHIR R4 transaction Bundle.

    ADT^A01 (admit) / ADT^A03 (discharge) messages produce a Patient + Encounter bundle;
    everything else (e.g. ORM^O01 lab orders) produces a ServiceRequest bundle.
    """
    if not hl7_text.strip():
        raise ValueError("Empty HL7 message")

    message_type = parse_message_type(hl7_text)
    lines = hl7_text.strip().splitlines()
    pid = _segment(lines, "PID")
    pv1 = _segment(lines, "PV1")
    msh = _segment(lines, "MSH")

    name_parts = _field(pid, 5).split("^")
    patient_id = _field(pid, 3).split("^")[0] or "UNKNOWN"
    dob = _field(pid, 7)
    gender = "female" if _field(pid, 8).lower() == "f" else "male"
    ward = _field(pv1, 3).split("^")[0]
    msg_time = _field(msh, 6)  # MSH-7: date/time of message

    if message_type.startswith("ADT^A01") or message_type.startswith("ADT^A03"):
        is_admit = "A01" in message_type
        patient_resource = _drop_none({
            "resourceType": "Patient",
            "id": patient_id,
            "identifier": [{"system": "urn:oid:HOSP", "value": patient_id}],
            "name": [{"family": name_parts[0] if name_parts else "", "given": [name_parts[1] if len(name_parts) > 1 else ""]}],
            "gender": gender,
            "birthDate": _hl7_date(dob),
        })
        encounter_resource = {
            "resourceType": "Encounter",
            "id": f"enc-{patient_id}",
            "status": "in-progress" if is_admit else "finished",
            "class": {
                "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                "code": "IMP" if is_admit else "AMB",
            },
            "subject": {"reference": f"Patient/{patient_id}"},
            "location": [{"location": {"display": ward}}] if ward else [],
        }
        return {
            "resourceType": "Bundle",
            "id": f"bundle-{patient_id.lower()}",
            "type": "transaction",
            "timestamp": _hl7_datetime(msg_time) or _now_iso(),
            "entry": [
                {"resource": patient_resource, "request": {"method": "PUT", "url": f"Patient/{patient_id}"}},
                {"resource": encounter_resource, "request": {"method": "PUT", "url": f"Encounter/enc-{patient_id}"}},
            ],
        }

    return {
        "resourceType": "Bundle",
        "id": f"bundle-order-{patient_id.lower()}",
        "type": "transaction",
        "timestamp": _now_iso(),
        "entry": [
            {
                "resource": {
                    "resourceType": "ServiceRequest",
                    "id": f"sr-{patient_id}",
                    "status": "active",
                    "intent": "order",
                    "subject": {"reference": f"Patient/{patient_id}"},
                    "code": {"coding": [{"system": "http://loinc.org", "code": "58410-2", "display": "Complete blood count panel"}]},
                },
                "request": {"method": "POST", "url": "ServiceRequest"},
            }
        ],
    }
