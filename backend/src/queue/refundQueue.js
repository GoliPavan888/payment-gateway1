const { Queue } = require("bullmq");

const refundQueue = new Queue("refund-processing", {
  connection: { host: "redis", port: 6379 }
});

module.exports = refundQueue;
