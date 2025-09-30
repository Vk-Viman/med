import { auth, db } from '../../firebase/firebaseConfig';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { callAI } from './aiClient';

// Build user context: profile basics, recent history, preferences, availability
export async function buildUserContext() {
  const uid = auth.currentUser?.uid;
  const profile = uid ? await fetchProfile(uid) : {};
  const history = uid ? await fetchRecentSessions(uid) : {};
  const preferences = await fetchPreferences(uid);
  const availability = deriveAvailability(preferences);
  return { profile, history, preferences, availability };
}

export async function recommendWeeklyPlan({ signal, forceRefresh = false } = {}) {
  const ctx = await buildUserContext();
  try {
    const res = await callAI('/api/ai/plan', { ...ctx, forceRefresh }, { signal, timeoutMs: forceRefresh ? 8000 : 3000 });
    if (res?.plan) {
      const plan = res.plan;
      if (res.source && typeof plan === 'object') plan._source = res.source;
      if (res.error && typeof plan === 'object') plan._error = String(res.error);
      return plan;
    }
  } catch {}
  // Client-side fallback so mobile works without backend configured
  const local = buildFallbackPlan(ctx, { forceRefresh });
  if (local && typeof local === 'object') local._source = 'local';
  return local;
}

// Compute total completed minutes for today (local time)
export async function getCompletedMinutesToday(uidParam){
  try {
    const uid = uidParam || auth.currentUser?.uid;
    if (!uid) return 0;
    const start = new Date();
    start.setHours(0,0,0,0);
    const qRef = query(
      collection(db, `users/${uid}/sessions`),
      where('endedAt', '>=', start),
      orderBy('endedAt', 'desc'),
      limit(100)
    );
    const snap = await getDocs(qRef);
    let total = 0;
    snap.forEach(d => {
      const s = d.data();
      if (s?.durationSec) total += Math.round((s.durationSec||0)/60);
    });
    return total;
  } catch { return 0; }
}

// Utilities
async function fetchProfile(uid){
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? { displayName: snap.data().displayName || '', streak: Number(snap.data().streak)||0 } : {};
  } catch { return {}; }
}

async function fetchRecentSessions(uid){
  try {
    const qRef = query(collection(db, `users/${uid}/sessions`), orderBy('endedAt','desc'), limit(50));
    const snap = await getDocs(qRef);
    const items = [];
    snap.forEach(d=> items.push({ id:d.id, ...d.data() }));
    const totalMinutes7 = items
      .filter(s => s.durationSec)
      .slice(0, 7)
      .reduce((a,b)=> a + Math.round((b.durationSec||0)/60), 0);
    return { recentCount: items.length, totalMinutes7 };
  } catch { return {}; }
}

async function fetchPreferences(uid){
  try {
    // Use questionnaireV2 doc created in plan-setup
    if(!uid) return {};
    const snap = await getDoc(doc(db, 'users', uid));
    const data = snap.exists() ? snap.data() : {};
    const q = data?.questionnaireV2 || {};
    return {
      goals: q.goals || [],
      themes: q.preferences || [],
      times: q.times || [],
      experience: q.level || 'beginner',
    };
  } catch { return {}; }
}

function deriveAvailability(pref){
  // Very simple: estimate weekly minutes from chosen times (if any) or default 70
  const dailyCount = Array.isArray(pref?.times) ? pref.times.length : 1;
  const dailyMins = 10; // default 10m per logged time
  return { weeklyMinutes: Math.max(50, dailyCount * dailyMins * 7) };
}

export function mergeCompletionIntoPlan(plan, completedMinutesToday){
  if(!plan?.week) return plan;
  const d = new Date();
  const idx = [0,1,2,3,4,5,6][d.getDay()===0?6:d.getDay()-1]; // convert Sun=0 to 6
  const day = plan.week[idx];
  if(!day) return plan;
  const remaining = Math.max(0, (day.totalMinutes||0) - (completedMinutesToday||0));
  return { ...plan, week: plan.week.map((w,i)=> i===idx ? { ...w, remainingMinutes: remaining } : w) };
}

// Local fallback: mirrors server fallback logic
export function buildFallbackPlan(input, { forceRefresh = false } = {}){
  const mins = Number(input?.availability?.weeklyMinutes || 70) || 70;
  const perDay = Math.max(5, Math.round(mins / 7));
  const themesBase = (input?.preferences?.themes && input.preferences.themes.length)
    ? input.preferences.themes
    : ['breath', 'calm', 'focus', 'gratitude', 'sleep', 'stress-relief', 'mindfulness'];
  const offset = forceRefresh ? Math.floor(Math.random() * themesBase.length) : 0;
  const themes = themesBase.map((_, i) => themesBase[(i + offset) % themesBase.length]);
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const deltaPattern = forceRefresh ? [0,1,0,-1,0,1,0] : [0,0,0,0,0,0,0];
  const blocks = d => [{ title: 'Daily Practice', theme: themes[d % themes.length] || 'mindfulness', minutes: Math.max(5, perDay + deltaPattern[d % deltaPattern.length]), type: 'guided' }];
  return {
    version: 'v1-local',
    rationale: forceRefresh ? 'Refreshed local fallback plan with slight variation.' : 'Local fallback plan based on availability and preferences.',
    _source: 'local',
    week: days.map((day, i) => { const m = Math.max(5, perDay + deltaPattern[i % deltaPattern.length]); return ({ day, totalMinutes: m, blocks: blocks(i) }); }),
  };
}
