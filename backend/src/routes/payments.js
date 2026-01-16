const express = require("express");
const router = express.Router();

const { sequelize } = require("../db");
const authenticateMerchant = require("../middleware/auth");
const { generatePaymentId } = require("../utils/idGenerator");
const { validateVPA } = require("../utils/validation");
const paymentQueue = require("../queue/paymentQueue");

/* =========================
   CREATE PAYMENT (AUTH)
========================= */
router.post("/", authenticateMerchant, async (req, res) => {
  try {
    const { order_id, method, vpa } = req.body;

    // 1. Fetch order
    const [orders] = await sequelize.query(
      `SELECT * FROM orders WHERE id = :order_id AND merchant_id = :merchant_id`,
      {
        replacements: {
          order_id,
          merchant_id: req.merchant.id
        }
      }
    );

    if (!orders.length) {
      return res.status(404).json({
        error: { code: "NOT_FOUND_ERROR", description: "Order not found" }
      });
    }

    // 2. Validate UPI
    if (method === "upi" && !validateVPA(vpa)) {
      return res.status(400).json({
        error: { code: "INVALID_VPA", description: "Invalid VPA" }
      });
    }

    const order = orders[0];
    const paymentId = generatePaymentId();

    // 3. Insert payment (PENDING)
    await sequelize.query(
      `
      INSERT INTO payments (
        id, order_id, merchant_id, amount, currency, method, status, vpa
      ) VALUES (
        :id, :order_id, :merchant_id, :amount, :currency, :method, 'pending', :vpa
      )
      `,
      {
        replacements: {
          id: paymentId,
          order_id,
          merchant_id: req.merchant.id,
          amount: order.amount,
          currency: order.currency,
          method,
          vpa: vpa || null
        }
      }
    );

    // 4. Enqueue async payment job
    await paymentQueue.add("process-payment", {
      paymentId
    });

    // 5. Return immediately
    res.status(201).json({
      id: paymentId,
      order_id,
      amount: order.amount,
      currency: order.currency,
      method,
      status: "pending",
      created_at: new Date().toISOString()
    });

  } catch (err) {
    console.error("Create payment error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

/* =========================
   GET PAYMENT (AUTH)
========================= */
router.get("/:id", authenticateMerchant, async (req, res) => {
  try {
    const [rows] = await sequelize.query(
      `
      SELECT *
      FROM payments
      WHERE id = :id AND merchant_id = :merchant_id
      `,
      {
        replacements: {
          id: req.params.id,
          merchant_id: req.merchant.id
        }
      }
    );

    if (!rows.length) {
      return res.status(404).json({
        error: { code: "NOT_FOUND_ERROR", description: "Payment not found" }
      });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Get payment error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

/* =========================
   PUBLIC CREATE PAYMENT (CHECKOUT)
========================= */
router.post("/public", async (req, res) => {
  try {
    const { order_id, method, vpa } = req.body;

    const [orders] = await sequelize.query(
      `SELECT * FROM orders WHERE id = :order_id`,
      { replacements: { order_id } }
    );

    if (!orders.length) {
      return res.status(404).json({
        error: { code: "NOT_FOUND_ERROR", description: "Order not found" }
      });
    }

    if (method === "upi" && !validateVPA(vpa)) {
      return res.status(400).json({
        error: { code: "INVALID_VPA", description: "Invalid VPA" }
      });
    }

    const order = orders[0];
    const paymentId = generatePaymentId();

    await sequelize.query(
      `
      INSERT INTO payments (
        id, order_id, merchant_id, amount, currency, method, status, vpa
      ) VALUES (
        :id, :order_id, :merchant_id, :amount, :currency, :method, 'pending', :vpa
      )
      `,
      {
        replacements: {
          id: paymentId,
          order_id,
          merchant_id: order.merchant_id,
          amount: order.amount,
          currency: order.currency,
          method,
          vpa: vpa || null
        }
      }
    );

    // Enqueue async job
    await paymentQueue.add("process-payment", {
      paymentId
    });

    res.status(201).json({
      id: paymentId,
      order_id,
      amount: order.amount,
      currency: order.currency,
      method,
      status: "pending",
      created_at: new Date().toISOString()
    });

  } catch (err) {
    console.error("Public payment error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

/* =========================
   PUBLIC PAYMENT STATUS
========================= */
router.get("/:id/public", async (req, res) => {
  const [rows] = await sequelize.query(
    `SELECT * FROM payments WHERE id = :id`,
    { replacements: { id: req.params.id } }
  );

  if (!rows.length) {
    return res.status(404).json({
      error: { code: "NOT_FOUND_ERROR", description: "Payment not found" }
    });
  }

  res.json(rows[0]);
});

/* =========================
   LIST PAYMENTS (AUTH)
========================= */
router.get("/", authenticateMerchant, async (req, res) => {
  try {
    const [rows] = await sequelize.query(
      `
      SELECT
        id,
        order_id,
        amount,
        currency,
        method,
        status,
        created_at
      FROM payments
      WHERE merchant_id = :merchant_id
      ORDER BY created_at DESC
      `,
      {
        replacements: {
          merchant_id: req.merchant.id
        }
      }
    );

    res.json({
      count: rows.length,
      items: rows
    });
  } catch (err) {
    console.error("List payments error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

module.exports = router;
