const { Worker } = require("bullmq");
const { sequelize } = require("../db");
const webhookQueue = require("../queue/webhookQueue");

console.log("🚀 Payment worker started");

new Worker(
  "payment-processing",
  async (job) => {
    const { paymentId } = job.data;

    console.log("⚙️ Processing payment:", paymentId);

    /* 1. Fetch payment */
    const [[payment]] = await sequelize.query(
      `
      SELECT *
      FROM payments
      WHERE id = :id
      `,
      {
        replacements: { id: paymentId }
      }
    );

    if (!payment) {
      console.error("❌ Payment not found:", paymentId);
      return;
    }

    /* 2. Simulate processing delay */
    const delay =
      process.env.TEST_MODE === "true"
        ? Number(process.env.TEST_PROCESSING_DELAY || 1000)
        : Math.floor(Math.random() * 5000) + 5000;

    await new Promise((res) => setTimeout(res, delay));

    /* 3. Decide success / failure */
    const success =
      process.env.TEST_MODE === "true"
        ? process.env.TEST_PAYMENT_SUCCESS !== "false"
        : payment.method === "upi"
        ? Math.random() < 0.9
        : Math.random() < 0.95;

    /* 4. Update payment status */
    await sequelize.query(
      `
      UPDATE payments
      SET status = :status,
          updated_at = NOW()
      WHERE id = :id
      `,
      {
        replacements: {
          id: paymentId,
          status: success ? "success" : "failed"
        }
      }
    );

    console.log(
      `✅ Payment ${paymentId} ${success ? "SUCCESS" : "FAILED"}`
    );

    /* 🔴 CRITICAL DEBUG (THIS WAS THE BUG) */
    console.log("📦 Enqueue webhook for merchant:", payment.merchant_id);

    /* 5. Enqueue webhook job WITH CORRECT merchantId */
    await webhookQueue.add("deliver-webhook", {
      merchantId: payment.merchant_id,
      event: success ? "payment.success" : "payment.failed",
      payload: {
        event: success ? "payment.success" : "payment.failed",
        timestamp: Math.floor(Date.now() / 1000),
        data: {
          payment: {
            id: payment.id,
            order_id: payment.order_id,
            amount: payment.amount,
            currency: payment.currency,
            method: payment.method,
            status: success ? "success" : "failed",
            created_at: payment.created_at
          }
        }
      }
    });

    console.log("📤 Webhook job queued:", success ? "payment.success" : "payment.failed");
  },
  {
    connection: {
      host: "redis",
      port: 6379
    }
  }
);
