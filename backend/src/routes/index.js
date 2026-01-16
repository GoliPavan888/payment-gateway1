const ordersRoutes = require("./orders");
const paymentsRoutes = require("./payments");
const testRoutes = require("./test");

module.exports = (app) => {
  // Health check (no auth)
  app.use("/health", require("../health"));

  // Orders
  app.use("/api/v1/orders", ordersRoutes);

  // Payments
  app.use("/api/v1/payments", paymentsRoutes);
  app.use("/api/v1", require("./refunds"));

  // Test endpoints (REQUIRED FOR EVALUATION)
  app.use("/api/v1/test", testRoutes);
};
