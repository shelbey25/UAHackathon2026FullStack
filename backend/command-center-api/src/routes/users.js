const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");

/**
 * GET /api/users/me?email=tony@avengers.com
 * Returns the user's profile data based on their email.
 */
router.get("/me", async (req, res, next) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: "email query param is required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/users/create
 * Create a new user in the database.
 * Body: { id, email, name, phone?, role? }
 *
 * - `id` should be the Clerk user ID (e.g. "user_2x...")
 * - `role` defaults to "VIEWER" if not provided
 *
 * Returns 201 with the new user, or 409 if email already exists.
 */
router.post("/create", async (req, res, next) => {
  try {
    const { id, email, name, phone, role } = req.body;

    if (!id || !email || !name) {
      return res.status(400).json({ error: "id, email, and name are required" });
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "User already exists", user: existing });
    }

    const validRoles = ["ADMIN", "VIEWER"];
    const userRole = validRoles.includes(role) ? role : "VIEWER";

    const user = await prisma.user.create({
      data: {
        id,
        email,
        name,
        phone: phone || "",
        role: userRole,
      },
    });

    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});


module.exports = router;
