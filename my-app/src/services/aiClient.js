// AI Client — mobile-safe pattern
// Do NOT embed your OpenAI API key in this client or anywhere in the app bundle.
// Instead, expose a minimal server endpoint that proxies requests to OpenAI.
// This keeps your key private and lets you add rate limits, auth, and guardrails.

import Constants from 'expo-constants';

// Config: set your backend URL via app config or hardcode for dev
// Recommended: use extra.apiBase in app.json/app.config.js and read via expo-constants.
const API_BASE = Constants?.expoConfig?.extra?.apiBase || Constants?.manifest?.extra?.apiBase || 'http://10.0.2.2:3000';

/**
 * callAI
 * - path: backend route, e.g. "/ai/chat" or "/ai/embeddings"
 * - body: JSON payload (e.g., { messages: [...] })
 * The backend must attach the OpenAI key and forward request to OpenAI's API.
 */
export async function callAI(path, body, { signal } = {}){
  if(!path.startsWith('/')) path = `/${path}`;
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body||{}),
    signal,
  });
  if(!res.ok){
    const txt = await res.text().catch(()=> '');
    throw new Error(`AI request failed (${res.status}): ${txt}`);
  }
  return res.json();
}

/**
 * Example usage:
 *
 * import { callAI } from '../services/aiClient';
 * const reply = await callAI('/ai/chat', {
 *   model: 'gpt-4o-mini',
 *   messages: [
 *     { role: 'system', content: 'You are a helpful meditation coach.' },
 *     { role: 'user', content: 'Help me unwind in 5 minutes.' }
 *   ]
 * });
 * console.log(reply);
 */
