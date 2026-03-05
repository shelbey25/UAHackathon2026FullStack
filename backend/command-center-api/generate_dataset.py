"""
Generate a synthetic Avengers supply-chain CSV dataset.

Goals:
  - Same format as v2: timestamp,sector_id,resource_type,stock_level,
    usage_rate_hourly,snap_event_detected,restock_amount,restock_reason
  - 25 combos (5 locations × 5 resources), hourly granularity
  - Ends on 2026-02-28T23:00:00  (~400 hours → starts ~Feb 12)
  - Cumulative downward trend with visible fluctuations (like original dataset)
  - Scattered snap events (false→true transitions only, kept sparse)
  - Occasional restocks that bump stock back up
"""

import csv
import random
import math
from datetime import datetime, timedelta

random.seed(42)

# ── Configuration ──────────────────────────────────────────────────────────────
NUM_HOURS = 400  # number of hourly data points per combo
END_DATE = datetime(2026, 2, 28, 23, 0, 0)
START_DATE = END_DATE - timedelta(hours=NUM_HOURS - 1)

LOCATIONS = [
    "Avengers Compound",
    "New Asgard",
    "Sokovia",
    "Sanctum Sanctorum",
    "Wakanda",
]

RESOURCES = [
    "Arc Reactor Cores",
    "Clean Water (L)",
    "Medical Kits",
    "Pym Particles",
    "Vibranium (kg)",
]

# Starting stock ranges per resource type (some start higher than others)
INITIAL_STOCK = {
    "Arc Reactor Cores": (600, 1200),
    "Clean Water (L)":   (2000, 5000),
    "Medical Kits":      (400, 1000),
    "Pym Particles":     (300, 1200),
    "Vibranium (kg)":    (3000, 8000),
}

# Base depletion rate range per hour (units consumed per hour on average)
BASE_DEPLETION = {
    "Arc Reactor Cores": (0.8, 2.5),
    "Clean Water (L)":   (3.0, 8.0),
    "Medical Kits":      (1.0, 3.5),
    "Pym Particles":     (0.5, 2.0),
    "Vibranium (kg)":    (2.0, 6.0),
}

# Restock configuration
RESTOCK_CHANCE = 0.008          # ~0.8% per hour per combo → ~3.2 restocks per combo over 400h
RESTOCK_AMOUNT_RANGE = (80, 400)
RESTOCK_REASONS = [
    "Scheduled resupply",
    "Emergency shipment from SHIELD",
    "Stark Industries delivery",
    "Wakandan aid package",
    "Interdimensional transfer",
    "Asgardian supply drop",
    "Pym Tech microdrop",
]

# Emergency restock — prevents stock from EVER reaching zero
# When stock drops below this fraction of its initial value, trigger a top-up
EMERGENCY_THRESHOLD_FRAC = 0.08   # 8% of initial stock
EMERGENCY_RESTOCK_FRAC = (0.15, 0.35)  # top-up to 15-35% of initial stock

# 40% of combos are "well-supplied" — they get 3× the emergency restocks
# so their stock stays comfortably above critical for much longer
WELL_SUPPLIED_CHANCE = 0.40
WELL_SUPPLIED_THRESHOLD_FRAC = 0.20   # trigger restock at 20% instead of 8%
WELL_SUPPLIED_RESTOCK_FRAC = (0.45, 0.70)  # top-up to 45-70% of initial (3× normal)

EMERGENCY_REASONS = [
    "Emergency SHIELD airdrop",
    "Priority resupply — critical levels",
    "Stark emergency reserve deployed",
    "Wakandan emergency relief",
    "Sorcerer Supreme emergency portal",
    "Asgardian bifrost emergency delivery",
]

# Snap event configuration
# The Snap happens on Feb 17 at midnight — every record from that point on is snap=True
SNAP_DATE = datetime(2026, 2, 17, 0, 0, 0)


def generate_combo(location: str, resource: str) -> list[dict]:
    """Generate 400 hourly records for one location+resource combo."""
    rows = []

    # Initial stock
    lo, hi = INITIAL_STOCK[resource]
    stock = random.uniform(lo, hi)
    initial_stock = stock  # remember for emergency threshold calculations

    # Decide upfront if this combo is well-supplied (40%) — gets bigger restocks
    is_well_supplied = random.random() < WELL_SUPPLIED_CHANCE

    # Base depletion profile — use a sine-wave modulated trend for variety
    dep_lo, dep_hi = BASE_DEPLETION[resource]
    base_rate = random.uniform(dep_lo, dep_hi)

    # Noise amplitude — controls how "jagged" the line looks
    noise_amp = base_rate * random.uniform(0.6, 1.2)

    # Sine modulation — creates visible waves in the depletion
    sine_period = random.uniform(40, 120)  # hours
    sine_amp = base_rate * random.uniform(0.3, 0.8)
    sine_phase = random.uniform(0, 2 * math.pi)

    # Snap: everything on or after Feb 17 00:00 is a snap event
    # No per-combo random waves anymore

    # Plan restocks
    restock_hours = {}
    for h in range(NUM_HOURS):
        if random.random() < RESTOCK_CHANCE and h > 20:
            amount = random.uniform(*RESTOCK_AMOUNT_RANGE)
            reason = random.choice(RESTOCK_REASONS)
            restock_hours[h] = (round(amount, 2), reason)

    snapped = False  # track whether we've already halved stock for the snap

    for h in range(NUM_HOURS):
        ts = START_DATE + timedelta(hours=h)

        # Compute this hour's usage rate with noise + sine modulation
        sine_val = sine_amp * math.sin(2 * math.pi * h / sine_period + sine_phase)
        noise = random.gauss(0, noise_amp * 0.5)
        usage = max(0.5, base_rate + sine_val + noise)
        usage = round(usage, 2)

        # Snap is true for everything on or after SNAP_DATE
        is_snap = ts >= SNAP_DATE

        # The moment the snap hits, instantly halve all stock (once)
        if is_snap and not snapped:
            stock = stock / 2.0
            snapped = True

        if is_snap:
            usage = round(usage * random.uniform(2.0, 4.0), 2)

        # Apply restock before depletion this hour
        restock_amount = 0.0
        restock_reason = ""
        if h in restock_hours:
            amt, reason = restock_hours[h]
            # Wakanda gets 10× all scheduled deliveries
            if location == "Wakanda":
                amt = round(amt * 10, 2)
            restock_amount = amt
            restock_reason = reason
            stock += restock_amount

        # Deplete
        stock = max(0, stock - usage)

        # Emergency restock: NEVER let stock reach zero
        # Well-supplied combos get bigger, earlier restocks (3× normal)
        if is_well_supplied:
            threshold = initial_stock * WELL_SUPPLIED_THRESHOLD_FRAC
            restock_frac_range = WELL_SUPPLIED_RESTOCK_FRAC
        else:
            threshold = initial_stock * EMERGENCY_THRESHOLD_FRAC
            restock_frac_range = EMERGENCY_RESTOCK_FRAC

        if stock < threshold:
            target_frac = random.uniform(*restock_frac_range)
            emergency_amount = round(initial_stock * target_frac - stock, 2)
            # Wakanda gets 10× emergency restocks too
            if location == "Wakanda":
                emergency_amount = round(emergency_amount * 10, 2)
            if emergency_amount > 0:
                stock += emergency_amount
                restock_amount += emergency_amount
                restock_reason = random.choice(EMERGENCY_REASONS)

        rows.append({
            "timestamp": ts.strftime("%Y-%m-%dT%H:%M:%S"),
            "sector_id": location,
            "resource_type": resource,
            "stock_level": round(stock, 4),
            "usage_rate_hourly": usage,
            "snap_event_detected": is_snap,
            "restock_amount": round(restock_amount, 2),
            "restock_reason": restock_reason,
        })

    return rows


def main():
    all_rows = []
    for location in LOCATIONS:
        for resource in RESOURCES:
            all_rows.extend(generate_combo(location, resource))

    # Sort by timestamp, then location, then resource (like v2)
    all_rows.sort(key=lambda r: (r["timestamp"], r["sector_id"], r["resource_type"]))

    outfile = "avengers_supply_chain_final.csv"
    with open(outfile, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "timestamp", "sector_id", "resource_type", "stock_level",
            "usage_rate_hourly", "snap_event_detected", "restock_amount",
            "restock_reason",
        ])
        writer.writeheader()
        writer.writerows(all_rows)

    print(f"✅ Generated {len(all_rows)} rows → {outfile}")
    print(f"   Date range: {all_rows[0]['timestamp']} → {all_rows[-1]['timestamp']}")
    print(f"   Combos: {len(LOCATIONS)} locations × {len(RESOURCES)} resources = {len(LOCATIONS)*len(RESOURCES)}")

    # Stats
    snaps = sum(1 for r in all_rows if r["snap_event_detected"])
    restocks = sum(1 for r in all_rows if r["restock_amount"] > 0)
    print(f"   Snap events: {snaps}")
    print(f"   Restocks: {restocks}")


if __name__ == "__main__":
    main()
