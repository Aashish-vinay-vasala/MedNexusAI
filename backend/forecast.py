import numpy as np
from statsmodels.tsa.holtwinters import ExponentialSmoothing

DAY_LABELS = ["D+1", "D+2", "D+3", "D+4", "D+5", "D+6", "D+7"]


def _forecast_series(values: list[float], horizon: int = 7) -> list[float]:
    series = np.array(values, dtype=float)
    # Weekly seasonality would need several full cycles of history to estimate reliably;
    # with the ~2 weeks of history this app has, a damped trend is the honest choice —
    # true seasonal decomposition here would overfit noise as "seasonality".
    if len(series) >= 4:
        model = ExponentialSmoothing(series, trend="add", damped_trend=True, initialization_method="estimated")
    else:
        # Not enough history for a real fit — hold the last value flat.
        return [round(float(series[-1]), 1)] * horizon

    fit = model.fit()
    forecast = fit.forecast(horizon)
    return [round(max(0.0, float(v)), 1) for v in forecast]


def compute_forecast(history: list[dict], horizon: int = 7) -> dict:
    """history: [{date, bed_usage, staffing}], ordered oldest-first."""
    bed_usage = [h["bed_usage"] for h in history]
    staffing = [h["staffing"] for h in history]

    bed_forecast = _forecast_series(bed_usage, horizon)
    staffing_forecast = _forecast_series(staffing, horizon)

    rows = [
        {"day_label": DAY_LABELS[i] if i < len(DAY_LABELS) else f"D+{i + 1}", "bed_usage": min(100, round(bed_forecast[i])), "staffing": min(100, round(staffing_forecast[i]))}
        for i in range(horizon)
    ]
    return {"forecast": rows}
