import { handleUpload } from "@vercel/blob/client";
import { timingSafeEqual } from "node:crypto";

const FILES = new Set([
  "front-end-web-development-beginners.pdf",
  "3d-website-design-client-acquisition.pdf"
]);

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && timingSafeEqual(left, right);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.BLOB_READ_WRITE_TOKEN || !process.env.COURSE_UPLOAD_PASSWORD) {
    return res.status(503).json({ error: "Private upload is not configured." });
  }

  try {
    const body = req.body || {};
    const pathname = typeof body.pathname === "string" ? body.pathname : "";
    const clientPayload = typeof body.payload === "string" ? JSON.parse(body.payload) : {};
    if (!FILES.has(pathname) || !safeEqual(clientPayload.password, process.env.COURSE_UPLOAD_PASSWORD)) {
      return res.status(401).json({ error: "Not authorized to upload this file." });
    }

    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (requestedPath) => {
        if (!FILES.has(requestedPath)) throw new Error("This course file is not allowed.");
        return {
          access: "private",
          addRandomSuffix: false,
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: 8 * 1024 * 1024,
          tokenPayload: JSON.stringify({ courseFile: requestedPath })
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const data = JSON.parse(tokenPayload || "{}");
        if (!FILES.has(data.courseFile) || blob.pathname !== data.courseFile || blob.contentType !== "application/pdf") {
          throw new Error("Uploaded course file failed validation.");
        }
        console.info("Private course PDF uploaded:", blob.pathname);
      }
    });
    return res.status(200).json(jsonResponse);
  } catch (error) {
    console.error("Course upload error:", error?.message || "Unknown error");
    return res.status(400).json({ error: "Upload could not be completed. Check the selected PDF and try again." });
  }
}
