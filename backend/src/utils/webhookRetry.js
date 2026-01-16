function getRetryDelay(attempt) {
  const isTest = process.env.WEBHOOK_RETRY_INTERVALS_TEST === "true";

  const prod = [0, 60, 300, 1800, 7200]; // seconds
  const test = [0, 5, 10, 15, 20];       // seconds

  const delays = isTest ? test : prod;
  return delays[Math.min(attempt, delays.length - 1)] * 1000;
}

module.exports = { getRetryDelay };
