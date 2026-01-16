const { Queue } = require("bullmq");

const paymentQueue = new Queue("payment-processing", {
  connection: {
    host: "redis",
    port: 6379
  }
});

module.exports = paymentQueue;
