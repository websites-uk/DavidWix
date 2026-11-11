import { get } from "@vercel/blob";
import { Readable } from "node:stream";
import { getCourseFile, readDownloadToken, verifyFlutterwaveTransaction } from "./_lib/course-access.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(503).json({ error: "Private course storage is not configured." });
    const course = String(req.query.course || "");
    const pathname = getCourseFile(course);
    if (!pathname) return res.status(400).json({ error: "Unknown course." });
    const token = readDownloadToken(req.query.token);
    if (!(token.items.includes("bundle") || token.items.includes(course))) return res.status(403).json({ error: "This purchase does not include that course." });
    const payment = await verifyFlutterwaveTransaction(token.transactionId, token.email);
    if (payment.txRef !== token.txRef || JSON.stringify(payment.items) !== JSON.stringify(token.items)) return res.status(403).json({ error: "The purchase details could not be confirmed." });
    const result = await get(pathname, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
    if (!result?.stream) return res.status(404).json({ error: "Course file not found in private storage." });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="' + pathname + '"');
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return Readable.fromWeb(result.stream).pipe(res);
  } catch (error) {
    console.error("Course download denied:", error?.message || "Unknown server error");
    return res.status(403).json({ error: error?.message || "Unable to release this course file." });
  }
}