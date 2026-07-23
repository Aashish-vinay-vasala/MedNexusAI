TOTAL_BED_CAPACITY = 120


def recompute_kpi(patients: list[dict], alerts: list[dict], admissions: list[dict]) -> dict:
    total_active = len(patients)
    icu_patients = [p for p in patients if "icu" in p.get("ward", "").lower()]
    icu_critical = [p for p in icu_patients if p.get("risk") == "critical"]
    high_risk = [p for p in patients if p.get("risk") in ("critical", "high")]

    available_beds = max(0, TOTAL_BED_CAPACITY - total_active)
    bed_capacity_pct = round((total_active / TOTAL_BED_CAPACITY) * 100, 1) if TOTAL_BED_CAPACITY else 0

    pending_alerts = [a for a in alerts if not a.get("acknowledged")]
    alert_critical = [a for a in pending_alerts if a.get("severity") == "critical"]

    todays = next((a for a in admissions if a.get("day_label") == "Today"), None)
    todays_admissions = todays["admissions"] if todays else 0
    prior = [a["admissions"] for a in admissions if a.get("day_label") != "Today"]
    avg_prior = sum(prior) / len(prior) if prior else 0
    admissions_change_pct = round(((todays_admissions - avg_prior) / avg_prior) * 100, 1) if avg_prior else 0.0

    return {
        "total_active": total_active,
        "icu_patients": len(icu_patients),
        "icu_critical": len(icu_critical),
        "high_risk": len(high_risk),
        "available_beds": available_beds,
        "bed_capacity_pct": bed_capacity_pct,
        "pending_alerts": len(pending_alerts),
        "alert_critical": len(alert_critical),
        "todays_admissions": todays_admissions,
        "admissions_change_pct": admissions_change_pct,
    }
