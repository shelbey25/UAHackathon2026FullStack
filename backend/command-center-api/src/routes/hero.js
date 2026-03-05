const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");

const API_KEY = process.env.FORECAST_API_KEY;

// ── API-key guard ─────────────────────────────────────────────────────────────
function requireApiKey(req, res, next) {
  const key = req.headers["x-api-key"];
  if (!key || key !== API_KEY) {
    return res.status(401).json({ error: "Invalid or missing API key" });
  }
  next();
}

// ── Shared: free a hero and create a restock InventoryRecord ──────────────────
async function freeHeroAndRestock(hero) {
  const now = new Date();
  const hoursWorked = Math.max(
    0,
    (Math.min(now, hero.assignment_end_time) - hero.assignment_start_time) / (1000 * 60 * 60)
  );

  // Find the most recent inventory record for this sector + resource
  const latest = await prisma.inventoryRecord.findFirst({
    where: {
      sector_id: hero.active_location,
      resource_type: hero.active_resource,
    },
    orderBy: { timestamp: "desc" },
  });

  // Compute restock values
  const restockAmount = parseFloat((100 * hoursWorked).toFixed(2));
  const baseUsage = latest ? latest.usage_rate_hourly : 5;
  // +/- 15% variability on the previous usage rate
  const variability = 1 + (Math.random() * 0.3 - 0.15);
  const usage_rate_hourly = parseFloat((baseUsage * variability).toFixed(4));

  const newTimestamp = latest
    ? new Date(latest.timestamp.getTime() + hoursWorked * 60 * 60 * 1000)
    : now;

  const newStockLevel = parseFloat(
    ((latest ? latest.stock_level : 0) + restockAmount).toFixed(2)
  );

  // Create the restock inventory record
  const record = await prisma.inventoryRecord.create({
    data: {
      sector_id: hero.active_location,
      resource_type: hero.active_resource,
      timestamp: newTimestamp,
      stock_level: newStockLevel,
      usage_rate_hourly,
      snap_event_detected: false,
      restock_amount: restockAmount,
      restock_reason: `Help from ${hero.hero_name}`,
    },
  });

  // Mark hero as free
  await prisma.hero.update({
    where: { hero_name: hero.hero_name },
    data: {
      is_active: false,
      active_resource: "",
      active_location: "",
    },
  });

  return { hero_name: hero.hero_name, hoursWorked: parseFloat(hoursWorked.toFixed(2)), record };
}

/**
 * POST /api/hero/assign
 * Assign a hero to a resource at a location.
 *
 * Body: {
 *   hero_name: string,          — unique hero name (upserts if new)
 *   active_resource: string,    — resource being addressed
 *   active_location: string,    — location of the assignment
 *   duration_hours?: number     — how long the assignment lasts (default: 4)
 * }
 */
router.post("/assign", requireApiKey, async (req, res, next) => {
  try {
    const { hero_name, active_resource, active_location, duration_hours } = req.body;

    if (!hero_name || !active_resource || !active_location) {
      return res.status(400).json({
        error: "hero_name, active_resource, and active_location are required",
      });
    }

    const hours = Math.max(1, parseInt(duration_hours) || 4);
    const assignment_start_time = new Date();
    const assignment_end_time = new Date(Date.now() + hours * 60 * 60 * 1000);

    const hero = await prisma.hero.upsert({
      where: { hero_name },
      update: {
        is_active: true,
        active_resource,
        active_location,
        assignment_start_time,
        assignment_end_time,
      },
      create: {
        hero_name,
        is_active: true,
        active_resource,
        active_location,
        assignment_start_time,
        assignment_end_time,
      },
    });

    res.json({ hero, message: `${hero_name} assigned to ${active_resource} at ${active_location} for ${hours}h` });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/hero/unassign
 * Manually free a hero, creates a restock InventoryRecord for their work.
 * Body: { hero_name: string }
 */
router.post("/unassign", requireApiKey, async (req, res, next) => {
  try {
    const { hero_name } = req.body;
    if (!hero_name) return res.status(400).json({ error: "hero_name is required" });

    const hero = await prisma.hero.findUnique({ where: { hero_name } });
    if (!hero) return res.status(404).json({ error: "Hero not found" });
    if (!hero.is_active) return res.status(400).json({ error: `${hero_name} is not currently on assignment` });

    const result = await freeHeroAndRestock(hero);
    res.json({ message: `${hero_name} unassigned after ${result.hoursWorked}h`, ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/hero
 * List all heroes. Optional ?active=true to filter only active ones.
 */
router.get("/", async (req, res, next) => {
  try {
    const where = {};
    if (req.query.active === "true") where.is_active = true;
    if (req.query.active === "false") where.is_active = false;

    const heroes = await prisma.hero.findMany({ where, orderBy: { hero_name: "asc" } });
    res.json(heroes);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/hero/:hero_name
 * Get a single hero by name.
 */
router.get("/:hero_name", async (req, res, next) => {
  try {
    const hero = await prisma.hero.findUnique({ where: { hero_name: req.params.hero_name } });
    if (!hero) return res.status(404).json({ error: "Hero not found" });
    res.json(hero);
  } catch (err) {
    next(err);
  }
});

// ── Auto-release: free expired heroes every 60 seconds ────────────────────────
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

async function releaseExpiredHeroes() {
  try {
    // Fetch expired heroes individually so we can create restock records for each
    const expired = await prisma.hero.findMany({
      where: {
        is_active: true,
        assignment_end_time: { lte: new Date() },
      },
    });

    for (const hero of expired) {
      try {
        const result = await freeHeroAndRestock(hero);
        console.log(`🦸  Auto-released ${hero.hero_name} after ${result.hoursWorked}h — restocked ${result.record.restock_amount} ${hero.active_resource} at ${hero.active_location}`);
      } catch (err) {
        console.error(`Hero cleanup error for ${hero.hero_name}:`, err.message);
      }
    }
  } catch (err) {
    console.error("Hero cleanup query error:", err.message);
  }
}

// Run once on startup to catch anything that expired while the server was down,
// then repeat on interval.
releaseExpiredHeroes();
setInterval(releaseExpiredHeroes, CLEANUP_INTERVAL_MS);

module.exports = router;
