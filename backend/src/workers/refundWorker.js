const { Worker } = require("bullmq");
const { sequelize } = require("../db");
const webhookQueue = require("../queue/webhookQueue");

console.log("💸 Refund worker started");

new Worker(
  "refund-processing",
  async (job) => {
    const { refundId } = job.data;
    console.log("⚙️ Processing refund:", refundId);

    /* 1. Fetch refund */
    const refunds = await sequelize.query(
      `
      SELECT r.*, p.amount AS payment_amount
      FROM refunds r
      JOIN payments p ON p.id = r.payment_id
      WHERE r.id = :id
      `,
      {
        replacements: { id: refundId },
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (!refunds.length) {
      console.error("❌ Refund not found:", refundId);
      return;
    }

    const refund = refunds[0];

    /* 2. Simulate processing delay */
    await new Promise((r) =>
      setTimeout(r, Math.floor(Math.random() * 2000) + 3000)
    );

    /* 3. Update refund status */
    await sequelize.query(
      `
      UPDATE refunds
      SET status = 'processed',
          processed_at = NOW()
      WHERE id = :id
      `,
      { replacements: { id: refundId } }
    );

    console.log("✅ Refund processed:", refundId);

    /* 4. Enqueue refund.processed webhook */
    await webhookQueue.add("deliver-webhook", {
      merchantId: refund.merchant_id,
      event: "refund.processed",
      payload: {
        event: "refund.processed",
        timestamp: Math.floor(Date.now() / 1000),
        data: {
          refund: {
            id: refund.id,
            payment_id: refund.payment_id,
            amount: refund.amount,
            status: "processed",
            created_at: refund.created_at,
            processed_at: new Date().toISOString()
          }
        }
      }
    });

    console.log("📤 Webhook job queued: refund.processed");
  },
  {
    connection: { host: "redis", port: 6379 }
  }
);
