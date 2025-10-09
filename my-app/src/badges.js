import { db } from "../firebase/firebaseConfig";
import { doc, setDoc, getDoc, serverTimestamp, increment, collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { inboxAdd } from './services/inbox';

export async function updateUserStats(uid, { minutesDelta = 0 } = {}) {
  if (!uid) return;
  const ref = doc(db, "users", uid, "stats", "aggregate");
  await setDoc(
    ref,
    { totalMinutes: increment(minutesDelta), lastUpdated: serverTimestamp() },
    { merge: true }
  );
}

export async function awardBadge(uid, badgeId, name) {
  if (!uid) return false;
  const ref = doc(db, "users", uid, "badges", badgeId);
  const snap = await getDoc(ref);
  if (snap.exists()) return false; // already awarded
  await setDoc(ref, { name, awardedAt: serverTimestamp() });
  // Honor user preference for badge notifications
  try {
    const profSnap = await getDoc(doc(db,'users',uid));
    const profData = profSnap?.data?.()||{};
    if(profData.notifyBadges !== false){
      await inboxAdd({ uid, type:'badge', title:'Badge earned', body:name || badgeId, data:{ badgeId } });
    }
  } catch {}
  return true;
}

export async function evaluateAndAwardBadges(uid) {
  if (!uid) return [];
  const ref = doc(db, "users", uid, "stats", "aggregate");
  const snap = await getDoc(ref);
  const awarded = [];
  const totalMinutes = snap.exists() ? snap.data().totalMinutes || 0 : 0;

  if (totalMinutes >= 50) {
    if (await awardBadge(uid, "novice_50", "Calm Novice (50m)")) awarded.push("novice_50");
  }
  if (totalMinutes >= 100) {
    if (await awardBadge(uid, "adept_100", "Mindful Adept (100m)")) awarded.push("adept_100");
  }
  if (totalMinutes >= 300) {
    if (await awardBadge(uid, "marathon_300", "Marathon Meditator (300m)")) awarded.push("marathon_300");
  }
  return awarded;
}

export async function awardFirstPostIfNeeded(uid) {
  if (!uid) return false;
  // Count posts by this user (anonymous board is anon, so fallback: award on first post action regardless of author tracking)
  // To keep privacy, we just award when user posts, without storing UID on the post.
  return await awardBadge(uid, "first_post", "First Reflection");
}

// Streak-based achievements
export async function evaluateStreakBadges(uid, streak){
  if(!uid || !streak) return [];
  const newly = [];
  if(streak >= 3){ if(await awardBadge(uid, 'streak_3', '3-Day Streak')) newly.push('streak_3'); }
  if(streak >= 7){ if(await awardBadge(uid, 'streak_7', '7-Day Streak')) newly.push('streak_7'); }
  if(streak >= 14){ if(await awardBadge(uid, 'streak_14', '14-Day Streak')) newly.push('streak_14'); }
  return newly;
}

// List recent badges for display
export async function listUserBadges(uid, max=6){
  if(!uid) return [];
  try{
    const qRef = query(collection(db, 'users', uid, 'badges'), orderBy('awardedAt','desc'), limit(max));
    const snap = await getDocs(qRef);
    const out = [];
    snap.forEach(d=> out.push({ id:d.id, ...d.data() }));
    return out;
  } catch { return []; }
}

// List all badges (no hard limit). Use cautiously on very large sets.
export async function listAllUserBadges(uid){
  if(!uid) return [];
  try{
    const qRef = query(collection(db, 'users', uid, 'badges'), orderBy('awardedAt','desc'));
    const snap = await getDocs(qRef);
    const out = [];
    snap.forEach(d=> out.push({ id:d.id, ...d.data() }));
    return out;
  } catch { return []; }
}

// Centralized emoji map for badges
export function badgeEmoji(id){
  switch(id){
    case 'streak_3': return '🔥';
    case 'streak_7': return '⚡';
    case 'streak_14': return '🌟';
    case 'novice_50': return '🌱';
    case 'adept_100': return '🎯';
    case 'marathon_300': return '🏅';
    case 'first_post': return '🗒️';
    default: return '🏆';
  }
}
