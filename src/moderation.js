// Simple moderation utility with optional Google Perspective API integration.

const PERSPECTIVE_API_KEY = process.env.PERSPECTIVE_API_KEY || undefined;

export async function ensurePostIsSafe(text) {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, reason: "Empty post" };

  // Lightweight local heuristic as fallback
  const banned = ["hate", "kill", "suicide", "terror", "racist", "sexist"];
  const lower = trimmed.toLowerCase();
  if (banned.some(w => lower.includes(w))) {
    return { ok: false, reason: "Contains disallowed terms" };
  }

  // If Perspective API key is configured, evaluate toxicity
  if (PERSPECTIVE_API_KEY) {
    try {
      const resp = await fetch(
        `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${PERSPECTIVE_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            comment: { text: trimmed },
            languages: ["en"],
            requestedAttributes: { TOXICITY: {} },
          }),
        }
      );
      const data = await resp.json();
      const score = data?.attributeScores?.TOXICITY?.summaryScore?.value ?? 0;
      if (score >= 0.8) return { ok: false, reason: "Post flagged as toxic" };
      return { ok: true, flagged: score >= 0.6 };
    } catch (e) {
      // Network error: continue with local heuristic
      return { ok: true, flagged: false };
    }
  }
  return { ok: true, flagged: false };
}
