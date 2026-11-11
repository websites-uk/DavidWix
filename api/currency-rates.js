export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/USD");
    const data = await response.json();
    const ngn = Number(data?.rates?.NGN);
    if (!response.ok || data?.result !== "success" || !Number.isFinite(ngn) || ngn <= 0) {
      return res.status(503).json({ error: "Exchange rate is temporarily unavailable." });
    }
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ base: "USD", rates: { USD: 1, NGN: ngn }, updated: data.time_last_update_utc || null });
  } catch {
    return res.status(502).json({ error: "Exchange-rate service is temporarily unavailable." });
  }
}