import OpenAI from "openai";

/**
 * IMPORTANT:
 * - لا تنشئ client على مستوى الملف وقت الـ import
 * - لأن Vercel/Next أثناء build قد يقيّم الموديول ويكسر إذا env ناقص
 */
export function getOpenAI() {
  const apiKey = (process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY missing");
  }
  return new OpenAI({ apiKey });
}
