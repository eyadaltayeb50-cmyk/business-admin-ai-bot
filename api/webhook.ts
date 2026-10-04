import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleUpdate } from "../src/handlers.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  try {
    await handleUpdate(req.body);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error instanceof Error ? error.message : error);
    return res.status(200).json({ ok: true });
  }
}