/**
 * Authentication Middleware — Clerk Integration
 *
 * Verifies the incoming request carries a valid Clerk session.
 * In development (CLERK_PUBLISHABLE_KEY not set) this can optionally
 * fall through so you can work without auth during local development.
 *
 * Usage (in index.js):
 *   const { requireAuth } = require("./middleware/auth");
 *   app.use("/api", requireAuth);        // protect all /api routes
 *   // — or per-route —
 *   router.post("/process", requireAuth, handler);
 */

const CLERK_ENABLED = !!process.env.CLERK_SECRET_KEY;

let clerkAuth;
if (CLERK_ENABLED) {
  try {
    const { clerkMiddleware, requireAuth: clerkRequireAuth } = require("@clerk/express");
    // clerkMiddleware() initializes Clerk on each request,
    // requireAuth() rejects unauthenticated requests.
    clerkAuth = { clerkMiddleware: clerkMiddleware(), requireAuth: clerkRequireAuth() };
  } catch (err) {
    console.warn(
      "⚠️  @clerk/express not installed — auth middleware disabled. " +
        "Run: npm i @clerk/express"
    );
    clerkAuth = null;
  }
}

/**
 * Express middleware: rejects unauthenticated requests when Clerk is
 * configured; passes through otherwise (dev mode).
 */
function requireAuth(req, res, next) {
  if (clerkAuth) {
    // Run clerkMiddleware first to parse the session, then requireAuth to enforce it
    return clerkAuth.clerkMiddleware(req, res, (err) => {
      if (err) return next(err);
      return clerkAuth.requireAuth(req, res, next);
    });
  }

  // Dev mode — attach a stub user so downstream code can always read req.auth
  req.auth = req.auth || { userId: "dev-user", role: "ADMIN" };
  console.debug("🔓  Auth bypassed (Clerk not configured)");
  next();
}

module.exports = { requireAuth };
