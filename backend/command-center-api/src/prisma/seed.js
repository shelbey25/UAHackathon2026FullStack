const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const fetch = require("node-fetch");
const { redactPII, redactPIITargeted } = require("../middleware/redact");

const prisma = new PrismaClient();

async function seedInventory() {
  const csvPath = path.join(__dirname, "../../avengers_supply_chain_final.csv");
  if (!fs.existsSync(csvPath)) {
    console.warn("⚠️  CSV not found at", csvPath, "— skipping inventory seed");
    return;
  }

  const stream = fs.createReadStream(csvPath);
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  const rows = [];
  let header = null;

  for await (const line of rl) {
    if (!header) { header = line.split(","); continue; }
    const [timestamp, sector_id, resource_type, stock_level, usage_rate_hourly, snap_event_detected, restock_amount, restock_reason ] = line.split(",");
    if (!timestamp) continue;
    rows.push({
      sector_id: sector_id.trim(),
      resource_type: resource_type.trim(),
      timestamp: new Date(timestamp.trim()),
      stock_level: parseFloat(stock_level),
      usage_rate_hourly: parseFloat(usage_rate_hourly),
      snap_event_detected: snap_event_detected.trim().toLowerCase() === "true",
      restock_amount: parseFloat(restock_amount),
      restock_reason: restock_reason.trim(),
    });
  }

  // ── Data cleaning: deduplicate by (sector_id, resource_type, timestamp) ──
  // When multiple rows share the same key, average stock_level and usage_rate_hourly.
  const grouped = new Map();
  for (const row of rows) {
    const key = `${row.sector_id}||${row.resource_type}||${row.timestamp.toISOString()}`;
    if (!grouped.has(key)) {
      grouped.set(key, { ...row, _count: 1 });
    } else {
      const existing = grouped.get(key);
      existing.stock_level += row.stock_level;
      existing.usage_rate_hourly += row.usage_rate_hourly;
      existing.restock_amount += row.restock_amount;
      existing.restock_reason = [existing.restock_reason, row.restock_reason].filter(Boolean).join(", ");
      // If any row in the group detected a snap event, keep it flagged
      existing.snap_event_detected = existing.snap_event_detected || row.snap_event_detected;
      existing._count += 1;
    }
  }

  const cleanedRows = [];
  for (const entry of grouped.values()) {
    const { _count, ...row } = entry;
    row.stock_level = parseFloat((row.stock_level / _count).toFixed(4));
    row.usage_rate_hourly = parseFloat((row.usage_rate_hourly / _count).toFixed(4));
    row.restock_amount = parseFloat((row.restock_amount / _count).toFixed(4));
    cleanedRows.push(row);
  }

  console.log(`🧹  Cleaned ${rows.length} raw rows → ${cleanedRows.length} deduplicated records`);
  console.log(`📥  Seeding ${cleanedRows.length} inventory records…`);
  // Batch insert for performance
  const BATCH = 500;
  for (let i = 0; i < cleanedRows.length; i += BATCH) {
    await prisma.inventoryRecord.createMany({ data: cleanedRows.slice(i, i + BATCH), skipDuplicates: true });
    process.stdout.write(`\r  ${Math.min(i + BATCH, cleanedRows.length)} / ${cleanedRows.length}`);
  }

  console.log("\n✅  Inventory records seeded");
}

// Map JSON priority strings → Prisma Priority enum values
const PRIORITY_MAP = {
  "Avengers Level Threat": "AVENGERS_LEVEL_THREAT",
  "High":                  "HIGH",
  "Routine":               "ROUTINE",
};

async function seedReports() {
  const jsonPath = path.join(__dirname, "../../field_intel_reports.json");
  if (!fs.existsSync(jsonPath)) {
    console.warn("⚠️  JSON not found at", jsonPath, "— skipping reports seed");
    return;
  }

  const raw = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  console.log(`📥  Seeding ${raw.length} field reports + processed reports…`);

  for (const r of raw) {
    const priority = PRIORITY_MAP[r.priority] || "ROUTINE";
    const heroAlias = r.metadata?.hero_alias || null;
    const secure_contact = r.metadata?.secure_contact || null;
    const receivedAt = new Date(r.timestamp);

    // Upsert raw report
    const report = await prisma.rawReport.upsert({
      where: { report_id: r.report_id },
      update: {},
      create: {
        report_id:  r.report_id,
        receivedAt,
        rawText:    r.raw_text,
        priority,
        heroAlias,
        secure_contact,
      },
    });

    // --- Auto-process (mirrors /upload logic) ---
    const redactedText = redactPIITargeted(
      redactPIITargeted(redactPII(report.rawText), heroAlias),
      secure_contact
    );

    let mlResult = { resource_name: "", location: "", status: "" };
    try {
      const mlRes = await fetch(
        "https://primary-production-405d5.up.railway.app/webhook/dae8f665-69ea-4cd7-919f-969c3f16dfcf",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: redactedText }),
        }
      );
      if (mlRes.ok) {
        const parsed = await mlRes.json();
        mlResult = {
          resource_name: parsed.resource_name || "",
          location: parsed.location || "",
          status: parsed.status || "",
        };
      }
    } catch (mlErr) {
      console.warn(`  ⚠️  ML unavailable for ${r.report_id}: ${mlErr.message}`);
    }

    // Upsert processed report
    await prisma.processedReport.upsert({
      where: { reportId: report.id },
      update: {
        redactedText,
        resource_name:  mlResult.resource_name || "Unknown",
        location:       mlResult.location || "Unknown",
        resource_level: mlResult.status || "Unknown",
        priority,
        timestamp:      receivedAt,
      },
      create: {
        reportId:       report.id,
        redactedText,
        resource_name:  mlResult.resource_name || "Unknown",
        location:       mlResult.location || "Unknown",
        resource_level: mlResult.status || "Unknown",
        priority,
        timestamp:      receivedAt,
      },
    });

    process.stdout.write(`\r  ${r.report_id} processed`);
  }
  console.log("\n✅  Field reports + processed reports seeded");
}

async function seedUsers() {
  const jsonPath = path.join(__dirname, "../../user.json");
  if (!fs.existsSync(jsonPath)) {
    console.warn("⚠️  user.json not found at", jsonPath, "— skipping user seed");
    return;
  }

  const users = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  console.log(`📥  Seeding ${users.length} users…`);

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, phone: u.phone, role: u.role },
      create: {
        id: u.id,
        email: u.email,
        phone: u.phone || "",
        name: u.name,
        role: u.role || "VIEWER",
      },
    });
  }
  console.log("✅  Users seeded");
}

async function seedResources() {
  // Get all unique (sector_id, resource_type) combos from inventory
  const combos = await prisma.inventoryRecord.findMany({
    distinct: ["sector_id", "resource_type"],
    select: { sector_id: true, resource_type: true },
  });

  console.log(`📥  Seeding ${combos.length} resources…`);

  for (const c of combos) {
    await prisma.resource.upsert({
      where: {
        location_resource: {
          location: c.sector_id,
          resource: c.resource_type,
        },
      },
      update: {},
      create: {
        location: c.sector_id,
        resource: c.resource_type,
      },
    });
  }
  console.log("✅  Resources seeded");
}

async function seedHeroes() {
  const heroNames = [
    "Tony Stark",
    "Natasha Romanoff",
    "Thor Odinson",
    "Peter Parker",
    "Bruce Banner",
    "Steve Rogers",
  ];

  console.log(`📥  Seeding ${heroNames.length} heroes…`);

  for (const hero_name of heroNames) {
    await prisma.hero.upsert({
      where: { hero_name },
      update: {},
      create: { hero_name },
    });
  }
  console.log("✅  Heroes seeded");
}

async function main() {
  await seedUsers();
  await seedInventory();
  await seedResources();
  await seedHeroes();
  await seedReports();
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
