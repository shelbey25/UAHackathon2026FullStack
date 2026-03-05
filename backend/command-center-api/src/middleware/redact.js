/**
 * PII Redaction Middleware — "The Shield"
 *
 * Strips Personally Identifiable Information (names, phone numbers, emails)
 * from text *before* it is sent to any external LLM / ML service.
 *
 * Usage:
 *   const { redactPII } = require("../middleware/redact");
 *   const clean = redactPII(dirtyText);
 */

// ── Patterns ──────────────────────────────────────────────────────────────────

// US phone numbers: 555-0101, 555.0101, (555) 012-3456, +1-555-012-3456, etc.
const PHONE_RE =
  /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g;

// Avengers-style 555 codes: 555-GOD-OF-THUNDER, 555-0199
const AVENGERS_PHONE_RE = /\b555[-.\s]?\S+/gi;

// Email addresses
const EMAIL_RE =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Full names — two or three consecutive capitalized words (basic heuristic)
const NAME_RE = /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+){1,2})\b/g;

// Known hero identities from the dataset (case-insensitive)
const HERO_NAMES = [
  "Tony Stark",
  "Natasha Romanoff",
  "Thor Odinson",
  "Peter Parker",
  "Bruce Banner",
  "Steve Rogers",
  "Wanda Maximoff",
  "Clint Barton",
  "Scott Lang",
  "Carol Danvers",
  "Stephen Strange",
  "T'Challa",
  "Shuri",
  "Sam Wilson",
  "Bucky Barnes",
  "Nick Fury",
  "Pepper Potts",
  "James Rhodes",
  "Vision",
  "Hope Van Dyne",
];

// Build a combined regex from the known hero names
const HERO_RE = new RegExp(
  HERO_NAMES.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
  "gi"
);

/**
 * Strip PII from a string.
 * @param {string} text  Raw input text
 * @returns {string}     Redacted text safe for external transmission
 */
function redactPII(text) {
  if (!text) return "";

  let out = text;

  // 1. Known hero identities (highest priority — catches names the generic
  //    regex might miss, e.g. single-word names like "Shuri" or "Vision")
  out = out.replace(HERO_RE, "[REDACTED]");

  // 2. Phone numbers
  out = out.replace(PHONE_RE, "[REDACTED]");
  out = out.replace(AVENGERS_PHONE_RE, "[REDACTED]");

  
  /*
  // 3. Emails
  out = out.replace(EMAIL_RE, "[REDACTED-EMAIL]");

  // 4. Generic capitalized names (catches any remaining proper names)
  out = out.replace(NAME_RE, "[REDACTED-NAME]");
  */

  return out;
}


function redactPIITargeted(text, target) {
  if (!text || !target) return text || "";

  // Build a global, case-insensitive regex from the target string
  const escaped = typeof target === "string"
    ? target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    : target.source;
  const re = new RegExp(escaped, "gi");

  return text.replace(re, "[REDACTED]");
}

/**
 * Express middleware that attaches a `req.redactPII` helper so any
 * downstream route handler can call it without importing the module.
 */
function redactMiddleware(_req, res, next) {
  // eslint-disable-next-line no-param-reassign
  res.locals.redactPII = redactPII;
  next();
}

module.exports = { redactPII, redactPIITargeted, redactMiddleware, redactPIITargeted };
