// Next.js API route: POST /api/ai/plan
// Securely proxies to OpenAI using server-side API key and returns a weekly plan

export default async function handler(req, res) {
  // Basic CORS for dev (mobile app hitting :3000)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    // Fallback deterministic plan so client UX still works without AI key in dev
    const fallback = buildFallbackPlan(req.body || {});
    return res.status(200).json({ plan: fallback, source: 'fallback' });
  }

  try {
    const payload = sanitizePayload(req.body || {});

    const system = `You are a helpful meditation coach. Generate a personalized weekly meditation plan.
Return STRICT JSON that matches this TypeScript type exactly:
{
  version: string; // e.g., "v1"
  rationale: string; // brief explanation for the plan
  week: Array<{
    day: 'Mon'|'Tue'|'Wed'|'Thu'|'Fri'|'Sat'|'Sun';
    totalMinutes: number; // total daily minutes
    blocks: Array<{ title: string; theme: string; minutes: number; type: 'guided'|'breath'|'music'|'silent' }>;
  }>;
}
Rules: 1) Keep total weekly minutes close to user's availability. 2) Cold start: use preferences & goals. 3) Ongoing tuning: reward streaks and gently adjust difficulty. 4) Vary themes across days. 5) Prefer 1-2 blocks per day.`;

    const user = `User context JSON:\n${JSON.stringify(payload)}`;

    // Use OpenAI Chat Completions JSON mode if available
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: payload.model || 'gpt-4o-mini',
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });

    const data = await r.json();
    if (!r.ok) throw new Error(data?.error?.message || `OpenAI error ${r.status}`);
    const raw = data?.choices?.[0]?.message?.content || '{}';
    let parsed;
    try { parsed = JSON.parse(raw); } catch {
      // If the model ignored JSON format, try to salvage JSON structure
      const m = raw.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : null;
    }
    if (!parsed?.week) throw new Error('AI returned unexpected format');

    return res.status(200).json({ plan: parsed, source: 'openai' });
  } catch (e) {
    const fallback = buildFallbackPlan(req.body || {});
    return res.status(200).json({ plan: fallback, source: 'fallback', error: String(e?.message || e) });
  }
}

function sanitizePayload(body) {
  const {
    profile = {},
    history = {},
    preferences = {},
    availability = {},
    model,
  } = body || {};
  return { profile, history, preferences, availability, model };
}

function buildFallbackPlan(input) {
  const mins = Number(input?.availability?.weeklyMinutes || 70) || 70; // default 10m/day
  const perDay = Math.max(5, Math.round(mins / 7));
  const themes = (input?.preferences?.themes && input.preferences.themes.length)
    ? input.preferences.themes
    : ['breath', 'calm', 'focus', 'gratitude', 'sleep', 'stress-relief', 'mindfulness'];
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const blocks = d => [{ title: 'Daily Practice', theme: pickTheme(themes, d), minutes: perDay, type: 'guided' }];
  return {
    version: 'v1-fallback',
    rationale: 'Fallback plan based on availability and generic themes.',
    week: days.map((day, i) => ({ day, totalMinutes: perDay, blocks: blocks(i) })),
  };
}

function pickTheme(themes, idx){
  return themes[idx % themes.length] || 'mindfulness';
}
