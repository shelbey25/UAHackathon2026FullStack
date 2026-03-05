const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");
const fetch = require("node-fetch");

const ML_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";
const API_KEY = process.env.FORECAST_API_KEY;

// ── API-key guard ─────────────────────────────────────────────────────────────
function requireApiKey(req, res, next) {
  const key = req.headers["x-api-key"];
  if (!key || key !== API_KEY) {
    return res.status(401).json({ error: "Invalid or missing API key" });
  }
  next();
}

/**
 * POST /api/forecast
 * Headers: x-api-key: <your key>
 * Body: { "sector": "Wakanda", "resource": "Arc Reactor Cores" }
 *
 * 1. Pulls all inventory records for the given sector + resource from the DB.
 * 2. Sends them to the Python ML service POST /depletion for segmented regression.
 * 3. Upserts the Resource table with the returned slope.
 * 4. Returns { sector, resource, slope }.
 */
router.post("/", requireApiKey, async (req, res, next) => {
  try {
    const { sector, resource } = req.body;
    if (!sector || !resource) {
      return res.status(400).json({ error: "sector and resource are required in the request body" });
    }

    // Pull inventory data from DB
    const records = await prisma.inventoryRecord.findMany({
      where: { sector_id: sector, resource_type: resource },
      orderBy: { timestamp: "desc" },
      take: 20,
    });

    if (records.length < 5) {
      return res.status(422).json({ error: "Not enough data to forecast (need >= 5 records)" });
    }

    console.log("Records count:", records.length);

    // Send to Python ML service for segmented regression
    const mlPayload = {
      sector,
      resource,
      records: records.map((r) => ({
        timestamp: r.timestamp.toISOString(),
        stock_level: r.stock_level,
        snap_event_detected: r.snap_event_detected,
        restock_amount: r.restock_amount,
      })),
    };

    const mlRes = await fetch(`${ML_URL}/depletion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mlPayload),
    });

    if (!mlRes.ok) {
      const err = await mlRes.json().catch(() => ({}));
      return res.status(mlRes.status).json({
        error: err.detail || "ML service forecast failed",
      });
    }

    const forecast = await mlRes.json();

    await prisma.resource.upsert({
      where: {
        location_resource: {
          location: forecast.sector,
          resource: forecast.resource,
        },
      },
      update: {
        depletionRate: forecast.slope,
        lastUpdated: new Date(),
      },
      create: {
        location: forecast.sector,
        resource: forecast.resource,
        depletionRate: forecast.slope,
        lastUpdated: new Date(),
      },
    });

    res.json(forecast);
  } catch (err) {
    next(err);
  }
});

router.get("/get-all-resources-tracked", requireApiKey, async (req, res) => {
  const allResources = await prisma.resource.findMany({
    select: {
      location: true,
      resource: true,
    },
  });
  res.json(allResources);
});

module.exports = router;
