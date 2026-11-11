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
    if (!response.ok || result.status !== "success" || result.data?.status !== "successful" || result.data?.currency !== "USD") {
      return res.status(400).json({ paid: false, error: "Payment could not be verified." });
    }
    const amount = Number(result.data.amount);
    if (![25, 35, 50].includes(amount) || Number(result.data.charged_amount) < amount) {
      return res.status(400).json({ paid: false, error: "The verified payment amount does not match a course price." });
    }
    return res.status(200).json({ paid: true, amount, currency: "USD", message: "Payment verified. Course delivery still needs to be connected." });
  } catch {
    return res.status(502).json({ paid: false, error: "Unable to verify payment right now." });
  }
}