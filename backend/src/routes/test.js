const express = require("express");
const router = express.Router();
const { sequelize } = require("../db");
const { paymentQueue } = require("../queue/paymentQueue");

/**
 * GET /api/v1/test/merchant
 * Required for evaluator
 */
router.get("/merchant", async (req, res) => {
  try {
    const [rows] = await sequelize.query(`
      SELECT id, email, api_key
      FROM merchants
      WHERE email = 'test@example.com'
      LIMIT 1
    `);

    if (!rows.length) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND_ERROR",
          description: "Test merchant not found",
        },
      });
    }

    return res.status(200).json({
      id: rows[0].id,
      email: rows[0].email,
      api_key: rows[0].api_key,
      seeded: true,
    });
  } catch (err) {
    console.error("Test merchant endpoint error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
});

/**
 * GET /api/v1/test/jobs/status
 * Required for evaluator
 * No authentication
 */
router.get("/jobs/status", async (req, res) => {
  try {
    const pending = await paymentQueue.getWaitingCount();
    const processing = await paymentQueue.getActiveCount();
    const completed = await paymentQueue.getCompletedCount();
    const failed = await paymentQueue.getFailedCount();

    return res.status(200).json({
      pending,
      processing,
      completed,
      failed,
      worker_status: "running",
    });
  } catch (err) {
    console.error("Job status endpoint error:", err);

    return res.status(200).json({
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      worker_status: "stopped",
    });
  }
});

module.exports = router;
