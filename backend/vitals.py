def _news2_respiration_rate(rr: int) -> int:
    if rr <= 8 or rr >= 25:
        return 3
    if rr in (9, 10, 11) or rr in (21, 22, 23, 24):
        return 2 if rr in (21, 22, 23, 24) else 1
    return 0


def _news2_spo2(spo2: int) -> int:
    # Scale 1 (no hypercapnic risk) — the common case for this app's synthetic patients.
    # Supplemental oxygen is scored separately as its own NEWS2 sub-score.
    if spo2 <= 91:
        score = 3
    elif spo2 in (92, 93):
        score = 2
    elif spo2 in (94, 95):
        score = 1
    else:
        score = 0
    return score


def _news2_sbp(sbp: int) -> int:
    if sbp <= 90 or sbp >= 220:
        return 3
    if 91 <= sbp <= 100:
        return 2
    if 101 <= sbp <= 110:
        return 1
    return 0


def _news2_hr(hr: int) -> int:
    if hr <= 40 or hr >= 131:
        return 3
    if 111 <= hr <= 130:
        return 2
    if (41 <= hr <= 50) or (91 <= hr <= 110):
        return 1
    return 0


def _news2_temp(temp: float) -> int:
    if temp <= 35.0:
        return 3
    if temp >= 39.1:
        return 2
    if (35.1 <= temp <= 36.0) or (38.1 <= temp <= 39.0):
        return 1
    return 0


def compute_news2(hr: int, sbp: int, spo2: int, temp: float, rr: int, gcs: int, on_oxygen: bool) -> dict:
    """Royal College of Physicians NEWS2 early warning score."""
    sub_scores = {
        "respiration_rate": _news2_respiration_rate(rr),
        "spo2": _news2_spo2(spo2),
        "on_oxygen": 2 if on_oxygen else 0,
        "systolic_bp": _news2_sbp(sbp),
        "heart_rate": _news2_hr(hr),
        "consciousness": 0 if gcs >= 15 else 3,
        "temperature": _news2_temp(temp),
    }
    total = sum(sub_scores.values())
    any_single_3 = any(v == 3 for v in sub_scores.values())

    if total >= 7:
        risk_band = "high"
    elif total >= 5 or any_single_3:
        risk_band = "medium"
    elif total >= 1:
        risk_band = "low"
    else:
        risk_band = "none"

    return {"sub_scores": sub_scores, "total": total, "risk_band": risk_band}


def compute_qsofa(rr: int, sbp: int, altered_mentation: bool) -> dict:
    """Quick SOFA — 1 point each; score >= 2 flags high risk of poor sepsis outcome."""
    criteria = {
        "respiration_rate_ge_22": rr >= 22,
        "systolic_bp_le_100": sbp <= 100,
        "altered_mentation": altered_mentation,
    }
    score = sum(criteria.values())
    return {"criteria": criteria, "score": score, "high_risk": score >= 2}


def compute_sirs(temp: float, hr: int, rr: int, wbc: float | None = None) -> dict:
    """SIRS criteria — >= 2 positive suggests a systemic inflammatory response."""
    criteria = {
        "temp_abnormal": temp > 38.0 or temp < 36.0,
        "hr_gt_90": hr > 90,
        "rr_gt_20": rr > 20,
    }
    if wbc is not None:
        criteria["wbc_abnormal"] = wbc > 12.0 or wbc < 4.0
    score = sum(criteria.values())
    return {"criteria": criteria, "score": score, "positive": score >= 2}


def score_vitals(hr: int, sbp: int, spo2: int, temp: float, rr: int, gcs: int = 15,
                  on_oxygen: bool = False, wbc: float | None = None, altered_mentation: bool | None = None) -> dict:
    mentation = altered_mentation if altered_mentation is not None else gcs < 15
    return {
        "news2": compute_news2(hr, sbp, spo2, temp, rr, gcs, on_oxygen),
        "qsofa": compute_qsofa(rr, sbp, mentation),
        "sirs": compute_sirs(temp, hr, rr, wbc),
    }
