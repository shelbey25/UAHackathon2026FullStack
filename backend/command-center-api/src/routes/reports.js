const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");
const fetch = require("node-fetch");
const { redactPII, redactPIITargeted } = require("../middleware/redact");

const { randomUUID } = require("crypto");

const ML_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

/**
 * GET /api/reports?page=1&limit=20&priority=HIGH&cleared=false
 *
 * Paginated report listing.
 * Query params:
 *   page     - page number, 1-based (default: 1)
 *   limit    - items per page, max 100 (default: 20)
 *   priority - filter by priority: AVENGERS_LEVEL_THREAT | HIGH | ROUTINE
 *   cleared  - filter by processed cleared status: true | false
 *
 * Response: { data, meta: { page, limit, total, totalPages, hasNext, hasPrev } }
 */
router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    // Build optional filters
    const where = {};
    if (req.query.priority) {
      where.priority = req.query.priority;
    }
    if (req.query.cleared !== undefined) {
      const cleared = req.query.cleared === "true";
      where.ProcessedReport = cleared ? { cleared: true } : { OR: [{ is: null }, { cleared: false }] };
    }

    const [reports, total] = await Promise.all([
      prisma.rawReport.findMany({
        where,
        orderBy: { receivedAt: "desc" },
        skip,
        take: limit,
        include: { ProcessedReport: true },
      }),
      prisma.rawReport.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      data: reports,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/reports/upload
 * Upload a new field report from the frontend.
 * Body: { rawText: string, priority?: "AVENGERS_LEVEL_THREAT" | "HIGH" | "ROUTINE" }
 * Backend auto-fills secure_contact (phone) and heroAlias (name) from the
 * authenticated user's profile in the DB.
 */
router.post("/upload", async (req, res, next) => {
  try {
    const { rawText, priority, email } = req.body;

    if (!rawText || !rawText.trim()) {
      return res.status(400).json({ error: "rawText is required" });
    }

    if (!email) {
      return res.status(400).json({ error: "email is required" });
    }

    // Validate priority if provided
    const validPriorities = ["AVENGERS_LEVEL_THREAT", "HIGH", "ROUTINE"];
    const reportPriority = validPriorities.includes(priority) ? priority : "ROUTINE";

    let heroAlias = null;
    let secure_contact = null;

    if (email) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (user) {
        heroAlias = user.name || null;
        secure_contact = user.phone || null;
      }
    }

    // Generate a unique report_id
    const report_id = `RPT-${randomUUID().slice(0, 8).toUpperCase()}`;

    const report = await prisma.rawReport.create({
      data: {
        report_id,
        rawText,
        priority: reportPriority,
        heroAlias,
        secure_contact,
        receivedAt: new Date(),
      },
    });

    // --- Auto-process the report after upload ---
    const redactedText = redactPIITargeted(
      redactPIITargeted(redactPII(report.rawText), report.heroAlias),
      report.secure_contact
    );

    let mlResult = { resource_name: "", location: "", status: "" };
    try {
      const mlRes = await fetch(
        `https://primary-production-405d5.up.railway.app/webhook/dae8f665-69ea-4cd7-919f-969c3f16dfcf`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: redactedText }),
        }
      );
      if (mlRes.ok) {
        const raw = await mlRes.json();
        mlResult = {
          resource_name: raw.resource_name || "",
          location: raw.location || "",
          status: raw.status || "",
        };
      }
    } catch (mlErr) {
      console.warn("ML service unavailable, storing partial result:", mlErr.message);
    }

    const summary = await prisma.processedReport.upsert({
      where: { reportId: report.id },
      update: {
        redactedText,
        resource_name: mlResult.resource_name || "Unknown",
        location: mlResult.location || "Unknown",
        resource_level: mlResult.status || "Unknown",
        priority: report.priority,
        timestamp: report.receivedAt,
      },
      create: {
        reportId: report.id,
        redactedText,
        resource_name: mlResult.resource_name || "Unknown",
        location: mlResult.location || "Unknown",
        resource_level: mlResult.status || "Unknown",
        priority: report.priority,
        timestamp: report.receivedAt,
      },
    });

    res.status(201).json({ report, summary, mlResult });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/reports/:id/process
 * Redact PII, send to ML service for extraction + forecast, store summary.
 */
router.post("/:report_id/process", async (req, res, next) => {
  try {
    const { report_id } = req.params;
    const report = await prisma.rawReport.findUnique({ where: { report_id } });
    if (!report) return res.status(404).json({ error: "Report not found" });

    // --- Step 1: Redact PII locally before touching external services -----------
    const redactedText = redactPIITargeted(redactPIITargeted(redactPII(report.rawText), report.heroAlias), report.secure_contact);

    // --- Step 2: Send to ML service for entity extraction + forecast -----------
    let mlResult = { resource_name: "", location: "", status: "" };
    try {
      const mlRes = await fetch(`https://primary-production-405d5.up.railway.app/webhook/dae8f665-69ea-4cd7-919f-969c3f16dfcf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: redactedText }),
      });
      if (mlRes.ok) {
        const raw = await mlRes.json();
        
        mlResult = {
          resource_name: raw.resource_name || "",
          location: raw.location || "",
          status: raw.status || "",
        }
        //mlResult = validateMLResult(raw);   // sanitise LLM/ML output
      }
    } catch (mlErr) {
      console.warn("ML service unavailable, storing partial result:", mlErr.message);
    }

    // --- Step 3: Try forecast if resource found --------------------------------
    /*if (mlResult.resource) {
      try {
        const fcRes = await fetch(`${ML_URL}/forecast`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: redactedText, resource: mlResult.resource, sector: report.sector }),
        });
        if (fcRes.ok) {
          const fc = await fcRes.json();
          mlResult.depletion_date = fc.depletion_date;
          mlResult.risk_score = fc.risk_score;
        }
      } catch (_) {}
    }*/

    // --- Step 4: Upsert processed report ----------------------------------------
    const summary = await prisma.processedReport.upsert({
      where: { reportId: report.id },
      update: {
        redactedText,
        resource_name: mlResult.resource_name || "Unknown",
        location: mlResult.location || "Unknown",
        resource_level: mlResult.status || "Unknown",
        priority: report.priority,
        timestamp: report.receivedAt
      },
      create: {
        reportId: report.id,
        redactedText,
        resource_name: mlResult.resource_name || "Unknown",
        location: mlResult.location || "Unknown",
        resource_level: mlResult.status || "Unknown",
        priority: report.priority,
        timestamp: report.receivedAt
      },
    });

    res.json({ report, summary, mlResult });
  } catch (err) {
    next(err);
  }
});


router.post("/:report_id/archive", async (req, res, next) => {
  try {
    const { report_id } = req.params;

    const report = await prisma.rawReport.findUnique({ where: { report_id } });
    if (!report) return res.status(404).json({ error: "Report not found" });

    await prisma.processedReport.update({
      where: { reportId: report.id },
      data: { cleared: true },
    });

    res.json({ report_id, cleared: true });
  } catch (err) {
    next(err);
  }
});


module.exports = router;
