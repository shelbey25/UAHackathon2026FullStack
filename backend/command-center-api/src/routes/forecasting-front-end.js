const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");
const fetch = require("node-fetch");

router.get("/", async (req, res) => {
  const allResources = await prisma.resource.findMany({

  });
  res.json(allResources);
});

module.exports = router;
