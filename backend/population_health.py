from collections import Counter

AGE_BUCKETS = [(0, 18), (19, 35), (36, 50), (51, 65), (66, 80), (81, 200)]


def _age_bucket_label(age: int) -> str:
    for lo, hi in AGE_BUCKETS:
        if lo <= age <= hi:
            return f"{lo}-{hi}" if hi < 200 else "81+"
    return "unknown"


def compute_population_stats(patients: list[dict], diagnoses: list[dict], top_n: int = 8) -> dict:
    total = len(patients)
    risk_counts = Counter(p.get("risk", "unknown") for p in patients)
    risk_distribution = {
        risk: {"count": count, "pct": round(count / total * 100, 1) if total else 0}
        for risk, count in risk_counts.items()
    }

    age_counts = Counter(_age_bucket_label(p.get("age", 0)) for p in patients)
    age_distribution = [
        {"bucket": f"{lo}-{hi}" if hi < 200 else "81+", "count": age_counts.get(f"{lo}-{hi}" if hi < 200 else "81+", 0)}
        for lo, hi in AGE_BUCKETS
    ]

    ward_critical = Counter(p.get("ward", "Unknown") for p in patients if p.get("risk") in ("critical", "high"))

    condition_counts = Counter()
    for d in diagnoses:
        desc = d.get("description") or d.get("code")
        if desc:
            condition_counts[desc] += 1
    top_conditions = [{"condition": cond, "count": count} for cond, count in condition_counts.most_common(top_n)]

    avg_age = round(sum(p.get("age", 0) for p in patients) / total, 1) if total else 0

    return {
        "total_patients": total,
        "avg_age": avg_age,
        "risk_distribution": risk_distribution,
        "age_distribution": age_distribution,
        "ward_critical_counts": [{"ward": w, "count": c} for w, c in ward_critical.most_common()],
        "top_conditions": top_conditions,
    }
