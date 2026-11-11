import crypto from "node:crypto";

const PRICES = { frontend: 25, "3d": 35, bundle: 50 };
const PATHS = {
  frontend: "front-end-web-development-beginners.pdf",
  "3d": "3d-website-design-client-acquisition.pdf"
};

export function normalizeItems(items) {
  if (!Array.isArray(items) || !items.length || items.length > 2) return null;
  if (items.includes("bundle")) return items.length === 1 ? ["bundle"] : null;
  if (new Set(items).size !== items.length || items.some(item => !Object.hasOwn(PRICES, item) || item === "bundle")) return null;
  return [...items].sort();
}

export function allowedCourses(items) {
  return items.includes("bundle") ? ["frontend", "3d"] : items;
}

export function expectedBaseAmount(items) {
  return items.includes("bundle") ? 50 : items.reduce((sum, item) => sum + PRICES[item], 0);
}

export async function verifyFlutterwaveTransaction(transactionId, email) {
  const secret = process.env.FLW_SECRET_KEY?.trim();
  if (!secret) throw new Error("Payment verification is not configured.");
  if (!/^\\d+$/.test(String(transactionId || ""))) throw new Error("Missing or invalid transaction ID.");
  if (typeof email !== "string" || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) throw new Error("Enter the email address used at checkout.");

  const response = await fetch("https://api.flutterwave.com/v3/transactions/" + encodeURIComponent(transactionId) + "/verify", {
    headers: { Authorization: "Bearer " + secret, Accept: "application/json" }
  });
  const result = await response.json().catch(() => ({}));
  const payment = result?.data;
  const meta = payment?.meta || {};
  const items = normalizeItems(meta.course_items);
  const baseAmount = items ? expectedBaseAmount(items) : NaN;
  const expectedAmount = Number(meta.expected_amount);
  const currency = meta.currency;
  const supportedCurrencies = ["NGN", "USD", "EUR", "GBP"];
  const sameEmail = String(payment?.customer?.email || "").trim().toLowerCase() === email.trim().toLowerCase();
  if (!response.ok || result.status !== "success" || payment?.status !== "successful" ||
      !sameEmail || typeof payment?.tx_ref !== "string" || !payment.tx_ref.startsWith("DW-") ||
      !items || !supportedCurrencies.includes(currency) || payment.currency !== currency ||
      Number(meta.base_amount_usd) !== baseAmount || !Number.isFinite(expectedAmount) || expectedAmount <= 0 ||
      Number(payment.amount) !== expectedAmount || Number(payment.charged_amount) < expectedAmount) {
    throw new Error("Payment could not be verified against this email and course order.");
  }
  if (currency === "USD" && expectedAmount !== baseAmount) {
    throw new Error("The verified payment amount does not match the course price.");
  }
  return { transactionId: String(transactionId), txRef: payment.tx_ref, email: email.trim().toLowerCase(), items, currency, amount: expectedAmount };
}

function sign(value) {
  return crypto.createHmac("sha256", process.env.FLW_SECRET_KEY).update(value).digest("base64url");
}

export function createDownloadToken(payment) {
  const payload = Buffer.from(JSON.stringify({
    transactionId: payment.transactionId,
    txRef: payment.txRef,
    email: payment.email,
    items: payment.items,
    exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
  })).toString("base64url");
  return payload + "." + sign(payload);
}

export function readDownloadToken(token) {
  if (typeof token !== "string" || token.length > 3000) throw new Error("Your download link is invalid. Please verify your payment again.");
  const parts = token.split(".");
  if (parts.length !== 2) throw new Error("Your download link is invalid. Please verify your payment again.");
  const expected = Buffer.from(sign(parts[0]));
  const actual = Buffer.from(parts[1]);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) throw new Error("Your download link is invalid. Please verify your payment again.");
  let payload;
  try { payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")); } catch { throw new Error("Your download link is invalid. Please verify your payment again."); }
  const items = normalizeItems(payload.items);
  if (!items || !Number.isInteger(payload.exp) || payload.exp < Math.floor(Date.now() / 1000) ||
      typeof payload.email !== "string" || typeof payload.transactionId !== "string" || typeof payload.txRef !== "string") {
    throw new Error("Your download link has expired. Please verify your payment again.");
  }
  return { ...payload, items };
}

export function getCourseFile(course) {
  if (!Object.hasOwn(PATHS, course)) return null;
  return PATHS[course];
}
