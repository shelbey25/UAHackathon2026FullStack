/**
 * Role Guard Middleware
 *
 * Restricts route access based on user role stored in the database.
 * Looks up the user by their email from the Clerk session.
 *
 * Usage:
 *   const { roleGuard, requireAdmin } = require("../middleware/roleGuard");
 *   router.post("/dangerous", requireAdmin, handler);
 *   router.get("/mixed", roleGuard("ADMIN", "VIEWER"), handler);
 */

const prisma = require("../prisma/client");

let clerkClientInstance;
try {
  const { clerkClient } = require("@clerk/express");
  clerkClientInstance = clerkClient;
} catch (_) {
  clerkClientInstance = null;
}

/**
 * Helper: get user email from the Clerk session.
 * Tries req.auth.sessionClaims first, falls back to fetching from Clerk API.
 */
async function getEmailFromAuth(req) {
  // Dev mode stub
  if (req.auth?.email) return req.auth.email;

  // Clerk session claims may include email
  const claims = req.auth?.sessionClaims;
  if (claims?.email) return claims.email;

  // Fallback: fetch user from Clerk API by userId
  if (clerkClientInstance && req.auth?.userId) {
    try {
      const clerkUser = await clerkClientInstance.users.getUser(req.auth.userId);
      return clerkUser.emailAddresses?.[0]?.emailAddress || null;
    } catch (_) {}
  }

  return null;
}

/**
 * Returns an Express middleware that allows only users whose DB role
 * is included in `allowedRoles`. Looks up user by email.
 *
 * @param  {...string} allowedRoles  e.g. "ADMIN", "VIEWER"
 */
function roleGuard(...allowedRoles) {
  return async (req, res, next) => {
    try {
      const email = await getEmailFromAuth(req);
      if (!email) {
        return res.status(401).json({ error: "Unauthenticated — no email found" });
      }

      const user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        return res.status(403).json({ error: "User not registered in system" });
      }

      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({
          error: `Forbidden — requires one of: ${allowedRoles.join(", ")}`,
        });
      }

      // Attach the full user record for convenience
      req.user = user;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Convenience middleware: only ADMIN users may proceed */
const requireAdmin = roleGuard("ADMIN");

module.exports = { roleGuard, requireAdmin };
