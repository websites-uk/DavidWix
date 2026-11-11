export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const secret = process.env.FLW_SECRET_KEY;
  if (!secret) return res.status(503).json({ error: "Checkout is not configured yet." });
  const { email, items, currency = "USD" } = req.body || {};
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !Array.isArray(items) || !items.length || items.length > 2) {
    return res.status(400).json({ error: "Please provide a valid email and course selection." });
  }
  if (!["NGN", "USD", "EUR", "GBP", "AED"].includes(currency)) return res.status(400).json({ error: "Please choose NGN, USD, EUR, GBP or AED." });
  const prices = { frontend: 25, "3d": 35, bundle: 50 };
  const names = { frontend: "Front-End Web Development for Beginners", "3d": "3D Website Design & Client Acquisition", bundle: "Complete Learning Bundle" };
  if (items.includes("bundle") && items.length !== 1) return res.status(400).json({ error: "The bundle cannot be combined with individual courses." });
  if (new Set(items).size !== items.length || items.some(item => !Object.prototype.hasOwnProperty.call(prices, item))) {
    return res.status(400).json({ error: "Invalid course selection." });
  }
  const baseAmount = items.reduce((sum, item) => sum + prices[item], 0);
  let fxRate = 1;
  let amount = baseAmount;
  try {
    if (currency !== "USD") {
      const rateResponse = await fetch("https://open.er-api.com/v6/latest/USD");
      const rateData = await rateResponse.json();
      fxRate = Number(rateData?.rates?.[currency]);
      if (!rateResponse.ok || rateData?.result !== "success" || !Number.isFinite(fxRate) || fxRate <= 0) {
        return res.status(503).json({ error: "The selected currency conversion rate is temporarily unavailable. Please try again." });
      }
      amount = currency === "NGN" ? Math.round(baseAmount * fxRate) : Math.round(baseAmount * fxRate * 100) / 100;
    }
    const tx_ref = "DW-" + crypto.randomUUID();
    const response = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: { Authorization: "Bearer " + secret, "Content-Type": "application/json" },
      body: JSON.stringify({
        tx_ref, amount, currency,
        redirect_url: process.env.FLW_REDIRECT_URL || "https://davewebdeveloper.vercel.app/payment-success.html",
        customer: { email },
        customizations: { title: "David Wix Courses", description: items.map(item => names[item]).join(" + "), logo: "https://davewebdeveloper.vercel.app/davewebdeveloperlogo.png" },
        meta: { course_items: items, base_amount_usd: baseAmount, expected_amount: amount, currency, fx_rate: fxRate }
      })
    });
    const result = await response.json();
    if (!response.ok || result.status !== "success" || !result.data?.link) {
      return res.status(502).json({ error: "Flutterwave could not create checkout. Confirm that this currency and its payment methods are enabled on your account." });
    }
    return res.status(200).json({ checkout_url: result.data.link, tx_ref, amount, currency });
  } catch {
    return res.status(502).json({ error: "Payment provider or exchange-rate service is temporarily unavailable." });
  }
}