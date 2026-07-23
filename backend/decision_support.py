import itertools

import fda_interactions

# Symmetric pairwise drug-interaction reference (expanded from the interactions previously
# hardcoded client-side). Keys are frozensets of two normalized drug names so lookup direction
# doesn't matter.
_INTERACTIONS: dict[frozenset, dict] = {
    frozenset({"warfarin", "aspirin"}): {"severity": "critical", "effect": "Major bleeding risk — increased anticoagulant effect", "mechanism": "Additive antiplatelet/anticoagulant effect"},
    frozenset({"warfarin", "ibuprofen"}): {"severity": "high", "effect": "Increased bleeding risk — NSAID displacement", "mechanism": "Protein-binding displacement + antiplatelet effect"},
    frozenset({"warfarin", "naproxen"}): {"severity": "high", "effect": "Increased bleeding risk — NSAID displacement", "mechanism": "Protein-binding displacement + antiplatelet effect"},
    frozenset({"warfarin", "clopidogrel"}): {"severity": "high", "effect": "Dual antiplatelet + anticoagulant — haemorrhage risk", "mechanism": "Additive antithrombotic effect"},
    frozenset({"warfarin", "fluconazole"}): {"severity": "critical", "effect": "CYP2C9 inhibition — warfarin toxicity", "mechanism": "CYP2C9 inhibition"},
    frozenset({"warfarin", "amiodarone"}): {"severity": "critical", "effect": "CYP2C9 inhibition — warfarin levels elevated 30-50%", "mechanism": "CYP2C9 inhibition"},
    frozenset({"aspirin", "ibuprofen"}): {"severity": "medium", "effect": "Reduced cardioprotective effect of aspirin", "mechanism": "Competitive COX-1 binding"},
    frozenset({"aspirin", "methotrexate"}): {"severity": "high", "effect": "Reduced renal clearance of methotrexate", "mechanism": "Renal tubular competition"},
    frozenset({"metformin", "contrast dye"}): {"severity": "high", "effect": "Risk of contrast-induced nephropathy + lactic acidosis", "mechanism": "Renal impairment reduces metformin clearance"},
    frozenset({"metformin", "alcohol"}): {"severity": "medium", "effect": "Increased lactic acidosis risk", "mechanism": "Impaired lactate metabolism"},
    frozenset({"lisinopril", "potassium"}): {"severity": "high", "effect": "Hyperkalaemia risk — monitor electrolytes", "mechanism": "Reduced potassium excretion"},
    frozenset({"lisinopril", "spironolactone"}): {"severity": "high", "effect": "Hyperkalaemia risk — monitor electrolytes", "mechanism": "Additive potassium retention"},
    frozenset({"lisinopril", "ibuprofen"}): {"severity": "medium", "effect": "Reduced antihypertensive efficacy + renal impairment", "mechanism": "Prostaglandin inhibition"},
    frozenset({"amiodarone", "digoxin"}): {"severity": "high", "effect": "P-glycoprotein inhibition — digoxin toxicity", "mechanism": "P-glycoprotein inhibition"},
    frozenset({"amiodarone", "simvastatin"}): {"severity": "high", "effect": "CYP3A4 inhibition — myopathy risk", "mechanism": "CYP3A4 inhibition"},
    frozenset({"digoxin", "verapamil"}): {"severity": "critical", "effect": "Additive bradycardia + AV block", "mechanism": "Additive AV nodal suppression"},
    frozenset({"clopidogrel", "omeprazole"}): {"severity": "medium", "effect": "Reduced antiplatelet activation of clopidogrel", "mechanism": "CYP2C19 inhibition"},
    frozenset({"simvastatin", "clarithromycin"}): {"severity": "critical", "effect": "Rhabdomyolysis risk — statin levels markedly elevated", "mechanism": "CYP3A4 inhibition"},
    frozenset({"sildenafil", "nitroglycerin"}): {"severity": "critical", "effect": "Severe, potentially fatal hypotension", "mechanism": "Additive nitric-oxide/cGMP vasodilation"},
    frozenset({"ssri", "tramadol"}): {"severity": "high", "effect": "Serotonin syndrome risk", "mechanism": "Additive serotonergic activity"},
    frozenset({"ace inhibitor", "nsaid"}): {"severity": "medium", "effect": "Reduced antihypertensive efficacy + renal impairment", "mechanism": "Prostaglandin inhibition"},

    # MAOIs / serotonergic
    frozenset({"phenelzine", "ssri"}): {"severity": "critical", "effect": "Serotonin syndrome — potentially fatal", "mechanism": "Combined MAO inhibition + serotonin reuptake inhibition"},
    frozenset({"phenelzine", "pseudoephedrine"}): {"severity": "critical", "effect": "Hypertensive crisis", "mechanism": "MAO inhibition prevents breakdown of sympathomimetic amine"},
    frozenset({"phenelzine", "meperidine"}): {"severity": "critical", "effect": "Serotonin syndrome / severe hyperthermia — reports of fatal reactions", "mechanism": "MAO inhibition + opioid serotonergic activity"},
    frozenset({"linezolid", "ssri"}): {"severity": "critical", "effect": "Serotonin syndrome risk", "mechanism": "Linezolid has weak, non-selective MAO-inhibiting activity"},
    frozenset({"opioid", "benzodiazepine"}): {"severity": "critical", "effect": "Profound sedation, respiratory depression, and death", "mechanism": "Additive CNS and respiratory depression"},

    # Lithium
    frozenset({"lithium", "nsaid"}): {"severity": "high", "effect": "Reduced renal lithium clearance — toxicity risk", "mechanism": "Prostaglandin inhibition reduces renal lithium excretion"},
    frozenset({"lithium", "lisinopril"}): {"severity": "high", "effect": "Increased lithium levels — toxicity risk", "mechanism": "Reduced renal lithium clearance"},
    frozenset({"lithium", "spironolactone"}): {"severity": "high", "effect": "Increased lithium levels — toxicity risk", "mechanism": "Diuretic-induced sodium depletion increases lithium reabsorption"},

    # Antiepileptics
    frozenset({"phenytoin", "valproate"}): {"severity": "high", "effect": "Altered phenytoin levels (free fraction increased) — toxicity or seizure breakthrough", "mechanism": "Protein-binding displacement + enzyme inhibition"},
    frozenset({"carbamazepine", "warfarin"}): {"severity": "high", "effect": "Reduced anticoagulant effect — subtherapeutic INR", "mechanism": "CYP450 enzyme induction accelerates warfarin metabolism"},

    # Statins / CYP3A4
    frozenset({"atorvastatin", "clarithromycin"}): {"severity": "critical", "effect": "Rhabdomyolysis risk — statin levels markedly elevated", "mechanism": "CYP3A4 inhibition"},
    frozenset({"simvastatin", "ketoconazole"}): {"severity": "critical", "effect": "Rhabdomyolysis risk — statin levels markedly elevated", "mechanism": "CYP3A4 inhibition"},
    frozenset({"simvastatin", "gemfibrozil"}): {"severity": "high", "effect": "Rhabdomyolysis risk", "mechanism": "Inhibited glucuronidation of statin"},

    # Theophylline
    frozenset({"theophylline", "ciprofloxacin"}): {"severity": "high", "effect": "Theophylline toxicity — nausea, seizures, arrhythmia", "mechanism": "CYP1A2 inhibition"},
    frozenset({"theophylline", "carbamazepine"}): {"severity": "medium", "effect": "Reduced theophylline levels", "mechanism": "CYP450 enzyme induction"},

    # Fluoroquinolone / CYP1A2 interactions
    frozenset({"tizanidine", "ciprofloxacin"}): {"severity": "critical", "effect": "Severe hypotension and sedation", "mechanism": "CYP1A2 inhibition markedly increases tizanidine levels"},
    frozenset({"tizanidine", "fluvoxamine"}): {"severity": "critical", "effect": "Severe hypotension and sedation", "mechanism": "CYP1A2 inhibition markedly increases tizanidine levels"},

    # Beta-blockers / rate-limiting combinations
    frozenset({"metoprolol", "verapamil"}): {"severity": "high", "effect": "Bradycardia, AV block, hypotension", "mechanism": "Additive AV nodal and negative inotropic suppression"},
    frozenset({"metoprolol", "diltiazem"}): {"severity": "high", "effect": "Bradycardia, AV block, hypotension", "mechanism": "Additive AV nodal and negative inotropic suppression"},

    # ACE inhibitor / ARB / potassium
    frozenset({"lisinopril", "losartan"}): {"severity": "high", "effect": "Hyperkalaemia and renal impairment — dual RAAS blockade not recommended", "mechanism": "Additive reduction in aldosterone-mediated potassium excretion"},

    # PDE5 inhibitors / alpha blockers
    frozenset({"sildenafil", "doxazosin"}): {"severity": "high", "effect": "Symptomatic hypotension", "mechanism": "Additive alpha-adrenergic and nitric-oxide-mediated vasodilation"},

    # Methotrexate
    frozenset({"methotrexate", "trimethoprim"}): {"severity": "critical", "effect": "Bone marrow suppression / pancytopenia", "mechanism": "Additive dihydrofolate reductase inhibition"},
    frozenset({"methotrexate", "ibuprofen"}): {"severity": "high", "effect": "Reduced renal clearance of methotrexate — toxicity risk", "mechanism": "Renal tubular competition + reduced renal blood flow"},

    # Anticoagulants (DOACs) / rifampin
    frozenset({"warfarin", "rifampin"}): {"severity": "high", "effect": "Reduced anticoagulant effect — subtherapeutic INR", "mechanism": "CYP450 enzyme induction accelerates warfarin metabolism"},
    frozenset({"dabigatran", "verapamil"}): {"severity": "high", "effect": "Increased dabigatran levels — bleeding risk", "mechanism": "P-glycoprotein inhibition"},

    # QT prolongation
    frozenset({"amiodarone", "azithromycin"}): {"severity": "high", "effect": "QT prolongation — risk of torsades de pointes", "mechanism": "Additive cardiac repolarization delay"},
    frozenset({"amiodarone", "ciprofloxacin"}): {"severity": "high", "effect": "QT prolongation — risk of torsades de pointes", "mechanism": "Additive cardiac repolarization delay"},

    # Sulfonylureas
    frozenset({"glipizide", "fluconazole"}): {"severity": "medium", "effect": "Increased hypoglycaemia risk", "mechanism": "CYP2C9 inhibition increases sulfonylurea levels"},

    # Digoxin
    frozenset({"digoxin", "clarithromycin"}): {"severity": "high", "effect": "Digoxin toxicity", "mechanism": "P-glycoprotein inhibition + altered gut flora reduces digoxin degradation"},

    # Colchicine
    frozenset({"colchicine", "clarithromycin"}): {"severity": "critical", "effect": "Colchicine toxicity — reports of fatal cases", "mechanism": "Combined P-glycoprotein and CYP3A4 inhibition"},

    # Immunosuppressants
    frozenset({"cyclosporine", "fluconazole"}): {"severity": "high", "effect": "Increased cyclosporine levels — nephrotoxicity risk", "mechanism": "CYP3A4 inhibition"},
    frozenset({"tacrolimus", "fluconazole"}): {"severity": "high", "effect": "Increased tacrolimus levels — nephrotoxicity risk", "mechanism": "CYP3A4 inhibition"},
    frozenset({"allopurinol", "azathioprine"}): {"severity": "critical", "effect": "Severe bone marrow suppression", "mechanism": "Xanthine oxidase inhibition prevents azathioprine breakdown"},

    # Enzyme induction / contraceptive efficacy
    frozenset({"carbamazepine", "oral contraceptive"}): {"severity": "medium", "effect": "Reduced contraceptive efficacy", "mechanism": "CYP450 enzyme induction accelerates hormone metabolism"},
    frozenset({"rifampin", "oral contraceptive"}): {"severity": "medium", "effect": "Reduced contraceptive efficacy", "mechanism": "CYP450 enzyme induction accelerates hormone metabolism"},
}

COMMON_DRUGS = [
    "Warfarin", "Aspirin", "Metformin", "Lisinopril", "Amiodarone", "Digoxin", "Ibuprofen",
    "Clopidogrel", "Fluconazole", "Spironolactone", "Methotrexate", "Verapamil", "Contrast Dye",
    "Potassium", "Simvastatin", "Omeprazole", "Clarithromycin", "Sildenafil", "Nitroglycerin", "Naproxen",
]


def _normalize(name: str) -> str:
    return name.strip().lower()


def check_interaction(drug_a: str, drug_b: str) -> dict:
    """Curated-table-only lookup -- instant, no network calls. Used directly by
    check_regimen (a multi-drug scan checks many pairs, so it stays offline-only) and as
    the first, fastest tier of check_interaction_enriched below."""
    a, b = _normalize(drug_a), _normalize(drug_b)
    match = _INTERACTIONS.get(frozenset({a, b}))
    if match is None:
        return {"interacts": False, "severity": None, "effect": None, "mechanism": None, "source": "none"}
    return {"interacts": True, "source": "curated", **match}


def check_interaction_enriched(drug_a: str, drug_b: str, groq_client, db) -> dict:
    """Pairwise check with a live fallback for anything not in the curated table above:
    1) curated table (instant), 2) drug_interaction_ai_cache (instant, previously-computed),
    3) real FDA label text for each drug + Groq to read it and produce a verdict, cached
    for next time. Only used for the 2-drug pairwise checker -- check_regimen's O(n^2)
    combinations stay curated-only to avoid firing many FDA/Groq calls per scan."""
    curated = check_interaction(drug_a, drug_b)
    if curated["interacts"]:
        return curated

    a, b = _normalize(drug_a), _normalize(drug_b)
    cache_a, cache_b = sorted((a, b))

    cached = (
        db.table("drug_interaction_ai_cache").select("*")
        .eq("drug_a", cache_a).eq("drug_b", cache_b)
        .execute().data
    )
    if cached:
        row = cached[0]
        return {
            "interacts": row["interacts"], "severity": row["severity"],
            "effect": row["effect"], "mechanism": row["mechanism"], "source": row["source"],
        }

    text_a = fda_interactions.fetch_label_interaction_text(a)
    text_b = fda_interactions.fetch_label_interaction_text(b)

    if text_a is None and text_b is None:
        result = {"interacts": False, "severity": None, "effect": None, "mechanism": None, "source": "unverified"}
    else:
        result = fda_interactions.ai_analyze_interaction(groq_client, drug_a, drug_b, text_a, text_b)

    db.table("drug_interaction_ai_cache").insert({
        "drug_a": cache_a, "drug_b": cache_b,
        "interacts": result["interacts"], "severity": result["severity"],
        "effect": result["effect"], "mechanism": result["mechanism"], "source": result["source"],
    }).execute()

    return result


def check_regimen(drugs: list[str]) -> list[dict]:
    """Pairwise-check every combination in a medication list."""
    results = []
    for a, b in itertools.combinations(drugs, 2):
        result = check_interaction(a, b)
        if result["interacts"]:
            results.append({"drug_a": a, "drug_b": b, **result})
    return results


_SEVERITY_RANK = {"critical": 3, "high": 2, "medium": 1}


def highest_severity(interactions: list[dict]) -> str | None:
    """Most severe rating across a list of interaction dicts (each with a 'severity' key),
    or None if the list is empty / has no interacting pairs."""
    ranked = [i["severity"] for i in interactions if i.get("severity") in _SEVERITY_RANK]
    if not ranked:
        return None
    return max(ranked, key=lambda s: _SEVERITY_RANK[s])
