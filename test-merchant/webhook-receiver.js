const express = require("express");
const crypto = require("crypto");

const app = express();
app.use(express.json());

const WEBHOOK_SECRET = "whsec_test_abc123";

/* =========================
   Verify HMAC Signature
========================= */
function verifySignature(payload, signature) {
  const expected = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");

  return expected === signature;
}

/* =========================
   Webhook Endpoint
========================= */
app.post("/webhook", (req, res) => {
  const signature = req.headers["x-webhook-signature"];
  const payloadString = JSON.stringify(req.body);

  if (!verifySignature(payloadString, signature)) {
    console.error("❌ Invalid webhook signature");
    return res.status(400).send("Invalid signature");
  }

  console.log("✅ Webhook verified");

  const event = req.body.event;
  console.log("Event:", event);

  /* ✅ SAFE PAYLOAD HANDLING */
  const payment = req.body?.data?.payment;
  const refund  = req.body?.data?.refund;

  if (payment) {
    console.log("Payment ID:", payment.id);
    console.log("Amount:", payment.amount);
    console.log("Status:", payment.status);
  }

  if (refund) {
    console.log("Refund ID:", refund.id);
    console.log("Refund Amount:", refund.amount);
    console.log("Refund Status:", refund.status);
  }

  res.status(200).json({ received: true });
});

app.listen(4000, () => {
  console.log("🧪 Test merchant webhook running on port 4000");
});
