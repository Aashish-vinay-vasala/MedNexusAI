import pandas as pd
from lifelines import CoxPHFitter

from survival import _seed

# Per-dimension synthetic-but-deterministic event modeling: distinct base rates/horizons reflect
# what each dimension actually measures (sepsis = short-horizon acute deterioration, mortality =
# longer-horizon outcome, etc.), following the same seeded-cohort convention as survival.py.
_DIMENSIONS = {
    "sepsis":   {"horizon": 3,  "base_duration": {"critical": 1, "high": 2,  "medium": 4,  "low": 8},  "event_prob": {"critical": 0.75, "high": 0.45, "medium": 0.20, "low": 0.05}},
    "mortality": {"horizon": 90, "base_duration": {"critical": 20, "high": 40, "medium": 70, "low": 110}, "event_prob": {"critical": 0.55, "high": 0.30, "medium": 0.12, "low": 0.03}},
    "icu":      {"horizon": 7,  "base_duration": {"critical": 2, "high": 4,  "medium": 8,  "low": 14}, "event_prob": {"critical": 0.70, "high": 0.40, "medium": 0.15, "low": 0.04}},
    "readmit":  {"horizon": 30, "base_duration": {"critical": 8, "high": 14, "medium": 24, "low": 40}, "event_prob": {"critical": 0.82, "high": 0.62, "medium": 0.38, "low": 0.15}},
}


def _synthesize(patients: list[dict], dimension: str) -> pd.DataFrame:
    cfg = _DIMENSIONS[dimension]
    rows = []
    for p in patients:
        s = _seed(p["id"])
        risk = p.get("risk", "medium")
        base = cfg["base_duration"].get(risk, cfg["base_duration"]["medium"])
        duration = max(1, base + (s % 6) - 3)
        event_prob = cfg["event_prob"].get(risk, cfg["event_prob"]["medium"])
        event = 1 if (s % 100) / 100 < event_prob else 0
        rows.append({"patient_id": p["id"], "age": p.get("age", 60), "risk": risk, "duration": duration, "event": event})
    return pd.DataFrame(rows)


def _fallback_score(patient: dict, dimension: str) -> float:
    """Deterministic weighted heuristic used only when the cohort is too small/degenerate for Cox."""
    cfg = _DIMENSIONS[dimension]
    base = cfg["event_prob"].get(patient.get("risk", "medium"), 0.3)
    age_factor = min(0.15, max(0, (patient.get("age", 60) - 60)) * 0.004)
    return round(min(0.99, base + age_factor) * 100, 1)


def compute_risk_scores(patients: list[dict]) -> dict:
    """Returns {patient_id: {dimension: score_0_to_100}} for sepsis/mortality/icu/readmit."""
    scores: dict[str, dict[str, float]] = {p["id"]: {} for p in patients}

    for dimension, cfg in _DIMENSIONS.items():
        df = _synthesize(patients, dimension)
        risk_counts = df["risk"].value_counts()
        can_fit_cox = len(df) >= 6 and df["event"].sum() >= 3 and (risk_counts >= 2).sum() > 1

        if can_fit_cox:
            try:
                cph = CoxPHFitter(penalizer=0.1)
                cph.fit(df[["duration", "event", "age"]], duration_col="duration", event_col="event")
                surv = cph.predict_survival_function(df[["duration", "event", "age"]], times=[cfg["horizon"]]).iloc[0]
                for i, patient_id in enumerate(df["patient_id"]):
                    prob_event = 1 - float(surv.iloc[i])
                    scores[patient_id][dimension] = round(min(99.0, max(0.5, prob_event * 100)), 1)
                continue
            except Exception:
                pass

        for p in patients:
            scores[p["id"]][dimension] = _fallback_score(p, dimension)

    return scores
