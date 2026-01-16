const { Queue } = require("bullmq");

const webhookQueue = new Queue("webhook-delivery", {
  connection: {
    host: "redis",
    port: 6379
  }
});

module.exports = webhookQueue;
