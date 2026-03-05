const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");

const API_KEY = process.env.FORECAST_API_KEY;

// ── Constants matching generate_dataset.py ────────────────────────────────────
const SNAP_DATE = new Date("2026-02-17T00:00:00Z");

const LOCATIONS = [
  "Avengers Compound",
  "New Asgard",
  "Sokovia",
  "Sanctum Sanctorum",
  "Wakanda",
];

const RESOURCES = [
  "Arc Reactor Cores",
  "Clean Water (L)",
  "Medical Kits",
  "Pym Particles",
  "Vibranium (kg)",
];

// Base depletion rate ranges (units / hour)
const BASE_DEPLETION = {
  "Arc Reactor Cores": [0.8, 2.5],
  "Clean Water (L)":   [3.0, 8.0],
  "Medical Kits":      [1.0, 3.5],
  "Pym Particles":     [0.5, 2.0],
  "Vibranium (kg)":    [2.0, 6.0],
};

// Restock configuration
const RESTOCK_CHANCE = 0.012;                    // slightly higher than seed (more active world)
const RESTOCK_AMOUNT_RANGE = [80, 400];
const RESTOCK_REASONS = [
  "Scheduled resupply",
  "Emergency shipment from SHIELD",
  "Stark Industries delivery",
  "Wakandan aid package",
  "Interdimensional transfer",
  "Asgardian supply drop",
  "Pym Tech microdrop",
];

// Emergency restock — never let stock reach zero
const EMERGENCY_THRESHOLD_FRAC = 0.08;
const EMERGENCY_RESTOCK_FRAC = [0.15, 0.35];
const EMERGENCY_REASONS = [
  "Emergency SHIELD airdrop",
  "Priority resupply — critical levels",
  "Stark emergency reserve deployed",
  "Wakandan emergency relief",
  "Sorcerer Supreme emergency portal",
  "Asgardian bifrost emergency delivery",
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function randBetween(lo, hi) {
  return lo + Math.random() * (hi - lo);
}

function gaussRandom(mean, stdDev) {
  // Box-Muller transform
  const u1 = Math.random();
  const u2 = Math.random();
  return mean + stdDev * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ── API-key guard ─────────────────────────────────────────────────────────────
function requireApiKey(req, res, next) {
  const key = req.headers["x-api-key"];
  if (!key || key !== API_KEY) {
    return res.status(401).json({ error: "Invalid or missing API key" });
  }
  next();
}

/**
 * POST /api/simulate/tick
 *
 * Generates one new InventoryRecord per location × resource combo (25 total),
 * continuing the trend from the most recent record for each combo.
 *
 * Designed to be called once per hour by n8n (or manually).
 */
router.post("/tick", requireApiKey, async (req, res, next) => {
  try {
    const now = new Date();
    // Round to the nearest hour for clean timestamps
    const tickTime = new Date(now);
    tickTime.setMinutes(0, 0, 0);

    const isSnap = tickTime >= SNAP_DATE;
    const created = [];

    for (const sector of LOCATIONS) {
      for (const resource of RESOURCES) {
        // Get the most recent record for this combo
        const latest = await prisma.inventoryRecord.findFirst({
          where: { sector_id: sector, resource_type: resource },
          orderBy: { timestamp: "desc" },
        });

        // If no prior record exists, skip (dataset must be seeded first)
        if (!latest) continue;

        const currentStock = latest.stock_level;

        // ── Compute usage rate ────────────────────────────────────────────
        const [depLo, depHi] = BASE_DEPLETION[resource];
        const baseRate = randBetween(depLo, depHi);
        // Add Gaussian noise for natural fluctuation
        let usage = Math.max(0.5, gaussRandom(baseRate, baseRate * 0.4));
        usage = Math.round(usage * 100) / 100;

        // Snap multiplier — elevated consumption post-snap
        if (isSnap) {
          usage = Math.round(usage * randBetween(2.0, 4.0) * 100) / 100;
        }

        // ── Random scheduled restock ──────────────────────────────────────
        let restockAmount = 0;
        let restockReason = "";
        if (Math.random() < RESTOCK_CHANCE) {
          let amt = randBetween(...RESTOCK_AMOUNT_RANGE);
          // Wakanda gets 10× deliveries
          if (sector === "Wakanda") {
            amt *= 10;
          }
          restockAmount = Math.round(amt * 100) / 100;
          restockReason = RESTOCK_REASONS[Math.floor(Math.random() * RESTOCK_REASONS.length)];
        }

        // ── Compute new stock level ───────────────────────────────────────
        let newStock = Math.max(0, currentStock + restockAmount - usage);

        // ── Emergency restock — never hit zero ────────────────────────────
        // Use the first record's stock as the "initial" baseline
        const firstRecord = await prisma.inventoryRecord.findFirst({
          where: { sector_id: sector, resource_type: resource },
          orderBy: { timestamp: "asc" },
        });
        const initialStock = firstRecord ? firstRecord.stock_level : currentStock;
        const threshold = initialStock * EMERGENCY_THRESHOLD_FRAC;

        if (newStock < threshold) {
          const targetFrac = randBetween(...EMERGENCY_RESTOCK_FRAC);
          let emergencyAmt = Math.round((initialStock * targetFrac - newStock) * 100) / 100;
          if (sector === "Wakanda") {
            emergencyAmt = Math.round(emergencyAmt * 10 * 100) / 100;
          }
          if (emergencyAmt > 0) {
            newStock += emergencyAmt;
            restockAmount += emergencyAmt;
            restockReason = EMERGENCY_REASONS[Math.floor(Math.random() * EMERGENCY_REASONS.length)];
          }
        }

        newStock = Math.round(newStock * 10000) / 10000;

        // ── Create the record ─────────────────────────────────────────────
        const record = await prisma.inventoryRecord.create({
          data: {
            sector_id: sector,
            resource_type: resource,
            timestamp: tickTime,
            stock_level: newStock,
            usage_rate_hourly: usage,
            snap_event_detected: isSnap,
            restock_amount: Math.round(restockAmount * 100) / 100,
            restock_reason: restockReason,
          },
        });

        created.push({
          sector_id: sector,
          resource_type: resource,
          stock_level: newStock,
          usage_rate_hourly: usage,
          snap_event_detected: isSnap,
          restock_amount: Math.round(restockAmount * 100) / 100,
        });
      }
    }

    res.json({
      success: true,
      tickTime: tickTime.toISOString(),
      recordsCreated: created.length,
      records: created,
    });
  } catch (err) {
    console.error("simulate/tick error:", err);
    next(err);
  }
});

module.exports = router;
