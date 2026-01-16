const crypto = require("crypto");

function generateSignature(payloadString, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(payloadString)
    .digest("hex");
}

module.exports = { generateSignature };
