require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const { requireAuth, redactMiddleware } = require("./middleware");
const { requireAdmin } = require("./middleware/roleGuard");
const inventoryRoutes = require("./routes/inventory");
const reportsRoutes = require("./routes/reports");
const forecastRoutes = require("./routes/forecast");
const usersRoutes = require("./routes/users");
const forecastFrontEndRoutes = require("./routes/forecasting-front-end");
const heroRoutes = require("./routes/hero");
const jarvisRoutes = require("./routes/jarvis");
const simulateRoutes = require("./routes/simulate");

const app = express();
const PORT = process.env.PORT || 4000;

// ── Security headers ────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);

// ── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "2mb" }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok", ts: new Date() }));

// ── Forecast route (API-key auth, mounted before Clerk) ───────────────────────
app.use("/api/forecast", forecastRoutes);


app.use("/api/hero", heroRoutes);
app.use("/api/jarvis", jarvisRoutes);
app.use("/api/simulate", simulateRoutes);

// ── Users route (auth only, no admin required — new users must create themselves)
app.use("/api/users", requireAuth, usersRoutes);

// ── Auth + Admin + PII middleware for remaining /api routes ────────────────────
app.use("/api", requireAuth, requireAdmin, redactMiddleware);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/inventory", inventoryRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/forecasting-front-end", forecastFrontEndRoutes);

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

app.listen(PORT, () => console.log(`✅  API listening on http://localhost:${PORT}`));
