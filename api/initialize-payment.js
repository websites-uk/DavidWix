export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const secret = process.env.FLW_SECRET_KEY;
  if (!secret) return res.status(503).json({ error: "Checkout is not configured yet." });
  const { email, items } = req.body || {};
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !Array.isArray(items) || !items.length || items.length > 2) {
    return res.status(400).json({ error: "Please provide a valid email and course selection." });
  }
  const prices = { frontend: 25, "3d": 35, bundle: 50 };
  const names = { frontend: "Front-End Web Development for Beginners", "3d": "3D Website Design & Client Acquisition", bundle: "Complete Learning Bundle" };
  if (items.includes("bundle") && items.length !== 1) return res.status(400).json({ error: "The bundle cannot be combined with individual courses." });
  if (new Set(items).size !== items.length || items.some(item => !Object.prototype.hasOwnProperty.call(prices, item))) {
    return res.status(400).json({ error: "Invalid course selection." });
  }
  const amount = items.reduce((sum, item) => sum + prices[item], 0);
  const tx_ref = "DW-" + crypto.randomUUID();
  try {
    const response = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: { Authorization: "Bearer " + secret, "Content-Type": "application/json" },
      body: JSON.stringify({
        tx_ref, amount, currency: "USD", payment_options: "card",
        redirect_url: process.env.FLW_REDIRECT_URL || "https://davewebdeveloper.vercel.app/payment-success.html",
        customer: { email },
        customizations: { title: "David Wix Courses", description: items.map(item => names[item]).join(" + "), logo: "https://davewebdeveloper.vercel.app/davewebdeveloperlogo.png" },
        meta: { course_items: items }
      })
    });
    const result = await response.json();
    if (!response.ok || result.status !== "success" || !result.data?.link) {
      return res.status(502).json({ error: "Flutterwave could not create checkout. Check your account's USD payment settings." });
    }
    return res.status(200).json({ checkout_url: result.data.link, tx_ref });
  } catch {
    return res.status(502).json({ error: "Payment provider is temporarily unavailable." });
  }
}