import hashlib

import pandas as pd
from lifelines import CoxPHFitter, KaplanMeierFitter

RISK_BASE_DURATION_DAYS = {"critical": 8, "high": 14, "medium": 24, "low": 40}
RISK_EVENT_PROB = {"critical": 0.82, "high": 0.62, "medium": 0.38, "low": 0.15}


def _seed(patient_id: str) -> int:
    return int(hashlib.sha256(patient_id.encode()).hexdigest(), 16) % 1000


def _synthesize_cohort(patients: list[dict]) -> pd.DataFrame:
    rows = []
    for p in patients:
        s = _seed(p["id"])
        risk = p.get("risk", "medium")
        base = RISK_BASE_DURATION_DAYS.get(risk, 24)
        duration = max(1, base + (s % 20) - 10)
        event_prob = RISK_EVENT_PROB.get(risk, 0.38)
        event = 1 if (s % 100) / 100 < event_prob else 0
        rows.append({"patient_id": p["id"], "age": p.get("age", 60), "risk": risk, "duration": duration, "event": event})
    return pd.DataFrame(rows)


def compute_survival(patients: list[dict]) -> dict:
    df = _synthesize_cohort(patients)

    kmf = KaplanMeierFitter()
    kmf.fit(df["duration"], event_observed=df["event"])
    km_curve = [
        {"time": float(t), "survival_prob": round(float(s), 4)}
        for t, s in zip(kmf.survival_function_.index, kmf.survival_function_["KM_estimate"])
    ]
    median = kmf.median_survival_time_
    median_survival_days = None if median != median or median == float("inf") else round(float(median), 1)

    hazard_ratios: dict[str, float] = {}
    # Cox regression is unstable (near-perfect separation -> runaway coefficients) on small/imbalanced
    # cohorts, so require enough events and enough patients per risk group before trusting it.
    risk_counts = df["risk"].value_counts()
    if len(df) >= 6 and df["event"].sum() >= 3 and (risk_counts >= 2).sum() > 1:
        cox_df = df[["duration", "event", "age"]].copy()
        cox_df["risk_high"] = (df["risk"] == "high").astype(int)
        cox_df["risk_critical"] = (df["risk"] == "critical").astype(int)
        try:
            cph = CoxPHFitter(penalizer=0.1)
            cph.fit(cox_df, duration_col="duration", event_col="event")
            ratios = {k: round(float(v), 3) for k, v in cph.hazard_ratios_.items()}
            if all(0.001 < v < 1000 for v in ratios.values()):
                hazard_ratios = ratios
        except Exception:
            hazard_ratios = {}

    return {"km_curve": km_curve, "median_survival_days": median_survival_days, "hazard_ratios": hazard_ratios}
