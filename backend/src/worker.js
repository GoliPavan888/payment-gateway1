
/* ===============================
   GLOBAL ERROR HANDLERS (CRITICAL)
=============================== */
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ UNHANDLED REJECTION:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("❌ UNCAUGHT EXCEPTION:", err);
});

/* ===============================
   IMPORT WORKERS
=============================== */
require("./workers/webhookWorker");
require("./workers/refundWorker");

const { Worker } = require("bullmq");
const { sequelize } = require("./db");
const webhookQueue = require("./queue/webhookQueue");

console.log("🚀 Worker service started");

/* ===============================
   PAYMENT PROCESSING WORKER
=============================== */
new Worker(
  "payment-processing",
  async (job) => {
    const { paymentId } = job.data;
    console.log("⚙️ Processing payment:", paymentId);

    const [rows] = await sequelize.query(
      `SELECT * FROM payments WHERE id = :id`,
      { replacements: { id: paymentId } }
    );

    const payment = rows[0];
    if (!payment) {
      console.error("❌ Payment not found:", paymentId);
      return;
    }

    await new Promise((r) =>
      setTimeout(
        r,
        process.env.TEST_MODE === "true"
          ? Number(process.env.TEST_PROCESSING_DELAY || 1000)
          : Math.floor(Math.random() * 5000) + 5000
      )
    );

    const success =
      process.env.TEST_MODE === "true"
        ? process.env.TEST_PAYMENT_SUCCESS !== "false"
        : payment.method === "upi"
        ? Math.random() < 0.9
        : Math.random() < 0.95;

    const status = success ? "success" : "failed";

    await sequelize.query(
      `UPDATE payments SET status = :status, updated_at = NOW() WHERE id = :id`,
      { replacements: { id: paymentId, status } }
    );

    console.log(`✅ Payment ${paymentId} ${status.toUpperCase()}`);

    const event = success ? "payment.success" : "payment.failed";

    console.log("📦 Enqueue webhook for merchant:", payment.merchant_id);

    await webhookQueue.add("deliver-webhook", {
      merchantId: payment.merchant_id,
      event,
      payload: {
        event,
        timestamp: Math.floor(Date.now() / 1000),
        data: {
          payment: {
            id: payment.id,
            order_id: payment.order_id,
            amount: payment.amount,
            currency: payment.currency,
            method: payment.method,
            vpa: payment.vpa,
            status,
            created_at: payment.created_at
          }
        }
      }
    });

    console.log(`📤 Webhook job queued: ${event}`);
  },
  {
    connection: { host: "redis", port: 6379 }
  }
);

/* ===============================
   KEEP PROCESS ALIVE (IMPORTANT)
=============================== */
setInterval(() => {
  // keeps Node event loop alive
}, 10000);
