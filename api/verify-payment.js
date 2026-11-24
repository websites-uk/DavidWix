import { createDownloadToken, verifyFlutterwaveTransaction } from "./_lib/course-access.js";
import { rateLimit } from "./_lib/rate-limit.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!rateLimit(req, res, { key: "verify-payment", limit: 12, windowMs: 10 * 60 * 1000 })) return;
  try {
    const { transaction_id, email } = req.body || {};
    const payment = await verifyFlutterwaveTransaction(transaction_id, email);
    return res.status(200).json({
      paid: true,
      amount: payment.amount,
      currency: payment.currency,
      courses: payment.items.includes("bundle") ? ["frontend", "3d"] : payment.items,
      download_token: createDownloadToken(payment),
      message: "Payment verified. Your course downloads are ready."
    });
  } catch (error) {
    const message = error?.message || "Unable to verify payment right now.";
    console.warn("Payment verification rejected:", message);
    const notConfigured = /not configured/i.test(message);
    return res.status(notConfigured ? 503 : 400).json({
      paid: false,
      error: notConfigured ? "Payment verification is temporarily unavailable." : "Payment could not be verified. Check your details and try again."
    });
  }
}