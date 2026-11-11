export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const secret = process.env.FLW_SECRET_KEY;
  const transactionId = req.query.transaction_id;
  if (!secret) return res.status(503).json({ error: "Payment verification is not configured." });
  if (!transactionId || !/^\d+$/.test(String(transactionId))) return res.status(400).json({ error: "Missing transaction ID." });
  try {
    const response = await fetch("https://api.flutterwave.com/v3/transactions/" + encodeURIComponent(transactionId) + "/verify", {
      headers: { Authorization: "Bearer " + secret }
    });
    const result = await response.json();
    const payment = result?.data;
    const meta = payment?.meta || {};
    const currency = meta.currency;
    const expectedAmount = Number(meta.expected_amount);
    const items = meta.course_items;
    if (!response.ok || result.status !== "success" || payment?.status !== "successful" ||
        !["NGN", "USD"].includes(currency) || payment.currency !== currency ||
        !Number.isFinite(expectedAmount) || Number(payment.amount) !== expectedAmount ||
        !Array.isArray(items) || !items.length ||
        (currency === "USD" && ![25, 35, 50].includes(expectedAmount)) ||
        (currency === "NGN" && ![25, 35, 50].includes(Number(meta.base_amount_usd)))) {
      return res.status(400).json({ paid: false, error: "Payment could not be verified against the expected course order." });
    }
    if (Number(payment.charged_amount) < expectedAmount) {
      return res.status(400).json({ paid: false, error: "The verified payment amount does not match the course price." });
    }
    return res.status(200).json({ paid: true, amount: expectedAmount, currency, message: "Payment verified. Course delivery still needs to be connected." });
  } catch {
    return res.status(502).json({ paid: false, error: "Unable to verify payment right now." });
  }
}