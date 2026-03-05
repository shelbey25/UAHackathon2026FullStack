const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");
const fetch = require("node-fetch");
const { randomUUID } = require("crypto");

const API_KEY = process.env.FORECAST_API_KEY;
const JARVIS_WEBHOOK = "https://primary-production-405d5.up.railway.app/webhook/fc603698-f5be-41bf-be8b-1d5aa9cc8957";

// ── API-key guard ─────────────────────────────────────────────────────────────
function requireApiKey(req, res, next) {
  const key = req.headers["x-api-key"];
  if (!key || key !== API_KEY) {
    return res.status(401).json({ error: "Invalid or missing API key" });
  }
  next();
}

/**
 * POST /api/jarvis/sync
 *
 * Gathers all resource + location combos with depletion projections,
 * plus an anonymised hero roster, and POSTs it to the Jarvis webhook.
 *
 * Resource payload per combo:
 *   - location, resource, depletionRate
 *   - latestStockLevel (most recent InventoryRecord stock_level)
 *   - projectedDepletionDate (when stock hits 0 based on depletionRate)
 *
 * Hero payload per hero:
 *   - anonymousId (random UUID, not linkable to hero_name)
 *   - is_active, active_resource, active_location
 */
router.post("/sync", requireApiKey, async (req, res, next) => {
  try {
    // ── 1. Build resource projections ──────────────────────────────────────
    console.log("[jarvis] step 1 – fetching resources");
    const resources = await prisma.resource.findMany();
    console.log(`[jarvis] found ${resources.length} resources`);

    // Sequential queries to avoid exhausting the Prisma connection pool
    const resourceProjections = [];
    for (const r of resources) {
      const latest = await prisma.inventoryRecord.findFirst({
        where: {
          sector_id: r.location,
          resource_type: r.resource,
        },
        orderBy: { timestamp: "desc" },
      });

      const latestStockLevel = latest ? latest.stock_level : 0;
      const latestTimestamp = latest ? latest.timestamp : new Date();

      let projectedDepletionDate = null;
      if (r.depletionRate < 0 && latestStockLevel > 0) {
        const hoursUntilZero = latestStockLevel / Math.abs(r.depletionRate);
        projectedDepletionDate = new Date(
          latestTimestamp.getTime() + hoursUntilZero * 60 * 60 * 1000
        );
      }

      resourceProjections.push({
        location: r.location,
        resource: r.resource,
        depletionRate: r.depletionRate,
        latestStockLevel,
        latestTimestamp,
        projectedDepletionDate,
      });
    }
    console.log(`[jarvis] built ${resourceProjections.length} projections`);

    // ── 2. Build anonymised hero roster ────────────────────────────────────
    console.log("[jarvis] step 2 – fetching heroes");
    const heroes = await prisma.hero.findMany();

    // Keep a map so we can de-anonymise the webhook response
    const idToName = new Map();

    const anonymisedHeroes = heroes.map((h) => {
      const anonId = randomUUID();
      idToName.set(anonId, h.hero_name);
      return {
        anonymousId: anonId,
        is_active: h.is_active,
        active_resource: h.is_active ? h.active_resource : null,
        active_location: h.is_active ? h.active_location : null,
      };
    });

    // ── 3. POST to Jarvis webhook ─────────────────────────────────────────
    const payload = {
      timestamp: new Date().toISOString(),
      resources: resourceProjections,
      heroes: anonymisedHeroes,
    };

    console.log("[jarvis] step 3 – posting to webhook");
    let webhookBody = {};
    let webhookStatus = 0;
    let step = "fetch";
    try {
      const webhookRes = await fetch(JARVIS_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        redirect: "manual",
        timeout: 60000, // 60s timeout
      });
      webhookStatus = webhookRes.status;
      console.log(`[jarvis] webhook responded with status ${webhookStatus}`);
      step = "read-body";

      const rawText = await webhookRes.text();
      step = "parse-json";
      try {
        webhookBody = JSON.parse(rawText);
      } catch (_parseErr) {
        // Webhook didn't return valid JSON
        return res.json({
          sent: true,
          webhookStatus,
          webhookResponse: rawText,
          resourceCount: resourceProjections.length,
          heroCount: anonymisedHeroes.length,
        });
      }
    } catch (fetchErr) {
      // Webhook unreachable / timed out
      return res.json({
        sent: false,
        step,
        error: fetchErr.message,
        resourceCount: resourceProjections.length,
        heroCount: anonymisedHeroes.length,
      });
    }

    // ── 4. Replace anonymous IDs with real hero names in the response ─────
    step = "de-anonymise";
    let instructions = "";
    if (webhookBody && typeof webhookBody.instructions === "string") {
      instructions = webhookBody.instructions;
      for (const [anonId, heroName] of idToName) {
        instructions = instructions.replaceAll(anonId, heroName);
      }
    }

    res.json({
      sent: true,
      webhookStatus,
      instructions: instructions,
    });
  } catch (err) {
    console.error("jarvis/sync crash:", err);
    res.status(500).json({
      error: err.message,
      stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
    });
  }
});

module.exports = router;
