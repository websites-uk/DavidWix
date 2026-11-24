import { put } from "@vercel/blob";
import { timingSafeEqual } from "node:crypto";
import { rateLimit } from "./_lib/rate-limit.js";

const FILES = new Set([
  "front-end-web-development-beginners.pdf",
  "3d-website-design-client-acquisition.pdf"
]);

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length > 0 && left.length === right.length && timingSafeEqual(left, right);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!rateLimit(req, res, { key: "course-upload", limit: 5, windowMs: 15 * 60 * 1000 })) return;
  if (!process.env.BLOB_READ_WRITE_TOKEN || !process.env.COURSE_UPLOAD_PASSWORD) {
    return res.status(503).json({ error: "Private upload is not configured." });
  }
  if (typeof process.env.COURSE_UPLOAD_PASSWORD !== "string" || process.env.COURSE_UPLOAD_PASSWORD.length < 20) {
    console.error("COURSE_UPLOAD_PASSWORD must contain at least 20 characters.");
    return res.status(503).json({ error: "Private upload security is not configured correctly." });
  }

  try {
    const { pathname, password, fileBase64 } = req.body || {};
    if (!FILES.has(pathname) || !safeEqual(password, process.env.COURSE_UPLOAD_PASSWORD)) {
      return res.status(401).json({ error: "Not authorized to upload this file." });
    }
    if (typeof fileBase64 !== "string" || fileBase64.length > 2_800_000) {
      return res.status(413).json({ error: "Invalid file or file is too large." });
    }
    const buffer = Buffer.from(fileBase64, "base64");
    if (!buffer.length || buffer.length > 2 * 1024 * 1024 ||
        buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
      return res.status(400).json({ error: "The selected file is not a valid PDF or exceeds 2 MB." });
    }

    const blob = await put(pathname, buffer, {
      access: "private",
      addRandomSuffix: false,
      contentType: "application/pdf",
      token: process.env.BLOB_READ_WRITE_TOKEN
    });
    return res.status(200).json({ success: true, pathname: blob.pathname });
  } catch (error) {
    console.error("Course upload error:", error?.message || "Unknown error");
    return res.status(500).json({ error: "Upload failed. Please try again." });
  }
}