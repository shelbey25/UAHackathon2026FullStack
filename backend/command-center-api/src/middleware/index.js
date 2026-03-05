/**
 * Middleware barrel — re-exports every middleware from one convenient import.
 *
 *   const { requireAuth, roleGuard, redactPII } = require("./middleware");
 */

const { requireAuth } = require("./auth");
const { redactPII, redactMiddleware } = require("./redact");

module.exports = {
  requireAuth,
  redactPII,
  redactMiddleware,
};
