const { Worker } = require("bullmq");
const axios = require("axios");
const { sequelize } = require("../db");
const { generateSignature } = require("../utils/webhookSignature");

/* ===============================
   GLOBAL ERROR HANDLERS (CRITICAL)
=============================== */
process.on("unhandledRejection", (reason) => {
  console.error("❌ WEBHOOK UNHANDLED REJECTION:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("❌ WEBHOOK UNCAUGHT EXCEPTION:", err);
});

console.log("🚀 Webhook worker started");

new Worker(
  "webhook-delivery",
  async (job) => {
    console.log("🔔 Webhook job received:", job.id, job.data.event);

    try {
      const { merchantId, event, payload } = job.data;

      /* 1. Fetch merchant SAFELY */
      const merchants = await sequelize.query(
        `
        SELECT webhook_url, webhook_secret
        FROM merchants
        WHERE id = :id
        `,
        {
          replacements: { id: merchantId },
          type: sequelize.QueryTypes.SELECT
        }
      );

      console.log("🧾 Merchant query result:", merchants);

      if (!merchants.length) {
        console.error("❌ Merchant not found:", merchantId);
        return;
      }

      const merchant = merchants[0];

      if (!merchant.webhook_url) {
        console.error("❌ Webhook URL is NULL");
        return;
      }

      console.log("🌐 Sending webhook to:", merchant.webhook_url);

      /* 2. Prepare payload */
      const payloadString = JSON.stringify(payload);
      const signature = generateSignature(
        payloadString,
        merchant.webhook_secret
      );

      /* 3. Send webhook */
      const response = await axios.post(
        merchant.webhook_url,
        payloadString,
        {
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Signature": signature
          },
          timeout: 5000
        }
      );

      console.log(
        `✅ Webhook delivered: ${event} HTTP ${response.status}`
      );

    } catch (err) {
      console.error("❌ WEBHOOK DELIVERY FAILED");
      console.error("Message:", err.message);
      console.error("Code:", err.code);
      console.error("Response:", err.response?.data);
    }
  },
  {
    connection: { host: "redis", port: 6379 }
  }
);

/* ===============================
   KEEP PROCESS ALIVE
=============================== */
setInterval(() => {}, 10000);