// /api/analyze.js
// Gemini AI proxy — keeps the API key server-side, limits each visitor to 2 requests/hour.
// Set GEMINI_API_KEY in your Vercel Environment Variables.

const rateLimit = new Map(); // IP -> [timestamp, timestamp, ...]
const MAX_REQUESTS = 2;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

function cleanOldEntries(timestamps, now) {
  return timestamps.filter((t) => now - t < WINDOW_MS);
}

function getClientIP(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── Check API key is configured ──
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "AI analysis not configured",
      message: "GEMINI_API_KEY environment variable is not set. Add it in your Vercel project settings.",
    });
  }

  // ── Rate limiting ──
  const ip = getClientIP(req);
  const now = Date.now();

  let timestamps = rateLimit.get(ip) || [];
  timestamps = cleanOldEntries(timestamps, now);

  if (timestamps.length >= MAX_REQUESTS) {
    const oldestInWindow = Math.min(...timestamps);
    const resetIn = Math.ceil((oldestInWindow + WINDOW_MS - now) / 60000);
    return res.status(429).json({
      error: "Rate limit reached",
      message: `Limited to ${MAX_REQUESTS} AI reports per hour. Try again in ~${resetIn} minute${resetIn === 1 ? "" : "s"}.`,
      limit: MAX_REQUESTS,
      remaining: 0,
      resetMinutes: resetIn,
    });
  }

  // ── Parse request body ──
  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const prompt = body?.prompt;
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Missing 'prompt' field in request body" });
  }

  // ── Call Gemini ──
  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 1200,
          temperature: 0.7,
        },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Gemini returned ${response.status}`);
    }

    const data = await response.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("\n") ||
      "Analysis unavailable.";

    // ── Record successful request for rate limiting ──
    timestamps.push(now);
    rateLimit.set(ip, timestamps);

    // Periodically clean up old IPs (every ~50 requests)
    if (Math.random() < 0.02) {
      for (const [key, val] of rateLimit.entries()) {
        if (cleanOldEntries(val, now).length === 0) rateLimit.delete(key);
      }
    }

    return res.status(200).json({
      analysis: text,
      remaining: MAX_REQUESTS - timestamps.length,
      limit: MAX_REQUESTS,
    });
  } catch (error) {
    return res.status(502).json({
      error: "AI analysis failed",
      message: error.message,
    });
  }
}
