const express = require("express");
const router = express.Router();

const authenticateMerchant = require("../middleware/auth");
const { sequelize } = require("../db");
const refundQueue = require("../queue/refundQueue");
const { generateRefundId } = require("../utils/idGenerator");

/* =========================
   CREATE REFUND (AUTH)
========================= */
router.post(
  "/payments/:paymentId/refunds",
  authenticateMerchant,
  async (req, res) => {
    try {
      const { paymentId } = req.params;
      const { amount, reason } = req.body;

      /* 1. Fetch payment */
      const payments = await sequelize.query(
        `
        SELECT *
        FROM payments
        WHERE id = :id AND merchant_id = :merchant_id
        `,
        {
          replacements: {
            id: paymentId,
            merchant_id: req.merchant.id
          },
          type: sequelize.QueryTypes.SELECT
        }
      );

      if (!payments.length) {
        return res.status(404).json({
          error: {
            code: "NOT_FOUND_ERROR",
            description: "Payment not found"
          }
        });
      }

      const payment = payments[0];

      if (payment.status !== "success") {
        return res.status(400).json({
          error: {
            code: "BAD_REQUEST_ERROR",
            description: "Payment not refundable"
          }
        });
      }

      /* 2. Calculate refunded amount */
      const refunds = await sequelize.query(
        `
        SELECT COALESCE(SUM(amount), 0) AS refunded
        FROM refunds
        WHERE payment_id = :payment_id
        `,
        {
          replacements: { payment_id: paymentId },
          type: sequelize.QueryTypes.SELECT
        }
      );

      const refundedAmount = Number(refunds[0].refunded || 0);

      if (amount > payment.amount - refundedAmount) {
        return res.status(400).json({
          error: {
            code: "BAD_REQUEST_ERROR",
            description: "Refund amount exceeds available amount"
          }
        });
      }

      /* 3. Create refund */
      const refundId = generateRefundId();

      await sequelize.query(
        `
        INSERT INTO refunds (
          id, payment_id, merchant_id, amount, reason, status
        )
        VALUES (
          :id, :payment_id, :merchant_id, :amount, :reason, 'pending'
        )
        `,
        {
          replacements: {
            id: refundId,
            payment_id: paymentId,
            merchant_id: req.merchant.id,
            amount,
            reason: reason || null
          }
        }
      );

      /* 4. Enqueue refund job */
      await refundQueue.add("process-refund", {
        refundId
      });

      /* 5. Respond */
      res.status(201).json({
        id: refundId,
        payment_id: paymentId,
        amount,
        reason,
        status: "pending",
        created_at: new Date().toISOString()
      });
    } catch (err) {
      console.error("Refund creation error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

/* =========================
   GET REFUND (AUTH)
   (ADDED — NO CHANGE TO ABOVE LOGIC)
========================= */
router.get("/:id", authenticateMerchant, async (req, res) => {
  try {
    const refundId = req.params.id;

    const refunds = await sequelize.query(
      `
      SELECT *
      FROM refunds
      WHERE id = :id
        AND merchant_id = :merchant_id
      `,
      {
        replacements: {
          id: refundId,
          merchant_id: req.merchant.id
        },
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (!refunds.length) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND_ERROR",
          description: "Refund not found"
        }
      });
    }

    return res.status(200).json(refunds[0]);
  } catch (err) {
    console.error("Get refund error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
});

module.exports = router;
