function generateOrderId() {
  return (
    "order_" +
    Math.random().toString(36).substring(2, 10) +
    Date.now().toString(36)
  );
}

function generatePaymentId() {
  return (
    "pay_" +
    Math.random().toString(36).substring(2, 10) +
    Date.now().toString(36)
  );
}

function generateRefundId() {
  return (
    "rfnd_" +
    Math.random().toString(36).substring(2, 10) +
    Date.now().toString(36)
  );
}

module.exports = {
  generateOrderId,
  generatePaymentId,
  generateRefundId
};
