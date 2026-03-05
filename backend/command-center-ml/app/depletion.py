"""
Depletion forecasting via linear regression — trained on-the-fly from
inventory data sent over HTTP by the Express API.

Splits data into time-based segments at snap events or restocks,
computes a linear regression slope for each segment, and returns the
average slope across all segments.

POST /depletion
Body: { sector, resource, records: [ {timestamp, stock_level, snap_event_detected, restock_amount}, ... ] }

Returns: sector, resource, slope
"""
import logging
from datetime import datetime

import numpy as np

logger = logging.getLogger(__name__)


def train_and_predict(
    records: list[dict],
    sector: str,
    resource: str,
) -> dict:
    """
    Split inventory records into segments at snap events or restocks,
    compute a linear regression slope for each segment, and return
    the average slope.
    """
    if len(records) < 5:
        return {"sector": sector, "resource": resource, "slope": None, "error": "Not enough data (need >= 5 records)"}


    print(records)

    # Parse and sort by time
    parsed = []
    for r in records:
        ts = datetime.fromisoformat(r["timestamp"].replace("Z", "+00:00"))
        parsed.append({
            "ts": ts,
            "stock_level": float(r["stock_level"]),
            "snap": bool(r.get("snap_event_detected", False)),
            "restock": float(r.get("restock_amount", 0)),
        })
    parsed.sort(key=lambda x: x["ts"])

    # Split into segments at snap transitions or restocks.
    # When snap_event_detected goes from false→true, drop that first true
    # datapoint (the anomaly) and start a new segment. Consecutive true
    # records after the first are kept normally.
    segments: list[list[dict]] = [[]]
    prev_snap = False
    for rec in parsed:
        if rec["restock"] > 0:
            # Restock → start a new segment, include the record
            segments.append([])
            segments[-1].append(rec)
            prev_snap = rec["snap"]
            continue

        if rec["snap"] and not prev_snap:
            # false→true transition: drop this datapoint, start new segment
            segments.append([])
            prev_snap = True
            continue

        segments[-1].append(rec)
        prev_snap = rec["snap"]

    # Compute slope for each segment with enough data (>= 3 points)
    slopes = []
    weights = []
    for seg in segments:
        if len(seg) < 3:
            continue
        t0 = seg[0]["ts"]
        xs = np.array([(r["ts"] - t0).total_seconds() / 3600 for r in seg])
        ys = np.array([r["stock_level"] for r in seg])

        A = np.vstack([xs, np.ones(len(xs))]).T
        try:
            result = np.linalg.lstsq(A, ys, rcond=None)
            slope = float(result[0][0])
            slopes.append(slope)
            weights.append(len(seg))
        except Exception:
            continue

    print(f"Computed slopes for {len(slopes)} segments")
    print(f"Slopes: {slopes}")
    print(f"Weights (segment lengths): {weights}")

    if not slopes:
        return {"sector": sector, "resource": resource, "slope": None, "error": "No valid segments for regression"}

    # Weighted average: longer segments contribute more
    total_weight = sum(weights)
    weighted_slope = sum(s * w for s, w in zip(slopes, weights)) / total_weight

    return {
        "sector": sector,
        "resource": resource,
        "slope": round(weighted_slope, 6),
    }
