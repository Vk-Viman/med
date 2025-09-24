import { db } from "../firebase/firebaseConfig";
import { doc, setDoc, getDoc, serverTimestamp, increment, collection, getCountFromServer } from "firebase/firestore";

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
