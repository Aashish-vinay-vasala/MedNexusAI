from collections import Counter

from fhir_pyrate import Pirate
from fhir_pyrate.util.fhirobj import FHIRObj

_pirate = Pirate(base_url="http://localhost", auth=None, disable_multiprocessing_build=True)


def _top_counts(df, column: str, limit: int = 10) -> list[dict]:
    if column not in df.columns:
        return []
    counts = Counter(v for v in df[column].dropna().tolist() if v)
    return [{"name": name, "count": count} for name, count in counts.most_common(limit)]


def cohort_insights(resources: list[dict]) -> dict:
    bundle = FHIRObj(resourceType="Bundle", type="collection", entry=[{"resource": r["resource_json"]} for r in resources])
    result = _pirate.bundles_to_dataframe(bundles=[bundle])
    if isinstance(result, dict):
        dataframes = result
    elif not result.empty:
        # bundles_to_dataframe collapses to a single DataFrame when the bundle only contains one resource type.
        dataframes = {result["resourceType"].iloc[0]: result}
    else:
        dataframes = {}

    condition_counts = _top_counts(dataframes["Condition"], "code_coding_0_display") if "Condition" in dataframes else []
    medication_counts = (
        _top_counts(dataframes["MedicationRequest"], "medicationCodeableConcept_coding_0_display")
        if "MedicationRequest" in dataframes
        else []
    )

    return {"condition_counts": condition_counts, "medication_counts": medication_counts}
