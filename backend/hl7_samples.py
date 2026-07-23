SAMPLES = [
    {
        "label": "ADT^A01 — Admit",
        "type": "ADT^A01",
        "message": (
            "MSH|^~\\&|HIS|HOSP|FHIR_GW|HOSP|20260426120000||ADT^A01|MSG001|P|2.5\n"
            "EVN|A01|20260426120000\n"
            "PID|1||P7821^^^HOSP^MR||Nakamura^Emily^||19880315|F|||12 Oak Lane^^London^^E1 6RF||0207-555-0182|||S||||||\n"
            "PV1|1|I|WARD6^6A^BED2^HOSP||||D03^Yamamoto^Sato|||MED|||||||D03^Yamamoto^Sato|INP||||||||||||||||||HOSP|||||20260426120000"
        ),
    },
    {
        "label": "ADT^A03 — Discharge",
        "type": "ADT^A03",
        "message": (
            "MSH|^~\\&|HIS|HOSP|FHIR_GW|HOSP|20260426140000||ADT^A03|MSG002|P|2.5\n"
            "EVN|A03|20260426140000\n"
            "PID|1||P3309^^^HOSP^MR||Santos^Maria^||19720811|F|||45 Elm St^^Manchester^^M4 5AB||0161-555-0234\n"
            "PV1|1|O|WARD4^4B^BED7^HOSP|||||||||||||MED||||||||||||||||||HOSP|||||||20260426080000|20260426140000"
        ),
    },
    {
        "label": "ORM^O01 — Lab Order",
        "type": "ORM^O01",
        "message": (
            "MSH|^~\\&|HIS|HOSP|LAB|HOSP|20260426130000||ORM^O01|MSG003|P|2.5\n"
            "PID|1||P4821^^^HOSP^MR||Whitfield^James^||19590312|M|||8 Maple Ave^^Birmingham^^B1 3TW\n"
            "ORC|NW|ORD-4821-001||||||20260426130000|||D01^Morgan^Anna\n"
            "OBR|1|ORD-4821-001||CBC^Complete Blood Count^LN|||20260426130000||||||||||||||||F"
        ),
    },
]


def list_samples() -> list[dict]:
    return SAMPLES
