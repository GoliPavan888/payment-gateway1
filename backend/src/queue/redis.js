const { Redis } = require("ioredis");

const redis = new Redis({
  host: "redis",        // 🔴 service name
  port: 6379,
  maxRetriesPerRequest: null
});

redis.on("connect", () => {
  console.log("✅ Redis connected (worker/API)");
});

redis.on("error", (err) => {
  console.error("❌ Redis error", err);
});

module.exports = redis;
