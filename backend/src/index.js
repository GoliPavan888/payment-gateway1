const express = require("express");
const cors = require("cors");

const { initDB } = require("./db");
const seedMerchant = require("./seed");

const app = express();

app.use(cors());
app.use(express.json());

/* ===============================
   REGISTER ROUTES (ORDER MATTERS)
================================ */
require("./routes")(app);

/* ===============================
   START SERVER
================================ */
const PORT = process.env.PORT || 8000;

async function start() {
  try {
    await initDB();
    await seedMerchant();

    app.listen(PORT, () => {
      console.log(`✅ Payment Gateway API running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
}

start();
