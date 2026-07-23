from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/reference", tags=["reference"])

DRUG_LIST = [
    "Amoxicillin 250mg", "Amoxicillin 500mg", "Metformin 500mg", "Metformin 850mg",
    "Ramipril 5mg", "Ramipril 10mg", "Warfarin 1mg", "Warfarin 3mg", "Warfarin 5mg",
    "Furosemide 20mg", "Furosemide 40mg", "Atorvastatin 10mg", "Atorvastatin 40mg",
    "Amlodipine 5mg", "Amlodipine 10mg", "Salbutamol 100mcg inhaler", "Prednisolone 5mg",
    "Omeprazole 20mg", "Paracetamol 500mg", "Ibuprofen 400mg", "Clopidogrel 75mg",
    "Aspirin 75mg", "Aspirin 300mg", "Lisinopril 5mg", "Bisoprolol 2.5mg",
    "Bisoprolol 5mg", "Spironolactone 25mg", "Digoxin 125mcg", "Enoxaparin 40mg",
    "Morphine 10mg", "Tramadol 50mg", "Piperacillin-Tazobactam 4.5g",
]
ROUTES = ["Oral", "Intravenous (IV)", "Intramuscular (IM)", "Subcutaneous (SC)", "Inhaled", "Sublingual", "Topical", "Rectal"]
FREQS = ["Once daily (OD)", "Twice daily (BD)", "Three times daily (TDS)", "Four times daily (QDS)", "Every 6 hours", "As required (PRN)", "Stat (single dose)"]
DURATIONS = ["3 days", "5 days", "7 days", "10 days", "14 days", "28 days", "3 months", "Ongoing"]


@router.get("/drug-formulary")
def get_drug_formulary():
    return {"drugs": DRUG_LIST, "routes": ROUTES, "frequencies": FREQS, "durations": DURATIONS}
