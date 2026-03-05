const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");

/**
 * GET /api/inventory
 * Query params: sector, resource, days (default 60)
 */
router.get("/", async (req, res, next) => {
  try {
    const { sector, resource, days = 60 } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - Number(days));

    const where = { timestamp: { gte: since } };
    if (sector) where.sector_id = sector;
    if (resource) where.resource_type = resource;

    const records = await prisma.inventoryRecord.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: 10000,
    });

    res.json(records);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
