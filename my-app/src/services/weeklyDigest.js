import { auth, db } from '../../firebase/firebaseConfig';
import { collection, query, where, orderBy, getDocs, Timestamp, doc, getDoc } from 'firebase/firestore';
import { inboxAdd } from './inbox';

// Creates a weekly digest summary inbox entry if 7+ days since last digest_summary.
// Summary: total meditation minutes last calendar week (Mon-Sun) & streak delta.
export async function ensureWeeklyDigestSummary(){
  try {
    const uid = auth.currentUser?.uid; if(!uid) return false;
    const now = new Date();
    const day = now.getDay(); // 0 Sun .. 6 Sat
    // We'll treat Monday (1) as week start for summary; if today is Monday or user hasn't opened since new week, compute last week
    const weekStart = new Date(now); weekStart.setHours(0,0,0,0); // today midnight
    // Find Monday of current week
    const diffToMon = (day + 6) % 7; // days since Monday
    weekStart.setDate(weekStart.getDate() - diffToMon);
    // Last week range
    const lastWeekEnd = new Date(weekStart); lastWeekEnd.setMilliseconds(-1); // end of previous week
    const lastWeekStart = new Date(weekStart); lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    // Only proceed if it's Monday or user is beyond Monday (ensures a new week started)
    if(now < weekStart) return false;

    // Check last digest_summary entry timestamp
    const inboxRef = collection(db,'users',uid,'inbox');
    const digQ = query(inboxRef, where('type','==','digest_summary'), orderBy('createdAt','desc'));
    try {
      const digSnap = await getDocs(digQ);
      const last = digSnap.docs[0];
      if(last){
        const ct = last.data()?.createdAt?.toDate?.();
        if(ct){
          // If last summary is for this week already, skip
            if(ct >= weekStart) return false;
        }
      }
    } catch {}

    // Aggregate minutes from sessions for last week
    const sessRef = collection(db,'users',uid,'sessions');
    const qRef = query(sessRef, where('endedAt','>=', Timestamp.fromDate(lastWeekStart)), where('endedAt','<=', Timestamp.fromDate(lastWeekEnd)));
    const snap = await getDocs(qRef);
    let minutes = 0; snap.forEach(d=>{ const m = d.data()?.minutes || d.data()?.durationMinutes; if(Number.isFinite(m)) minutes += Number(m); });

    // Streak delta: compare streak doc now vs one week ago (approx via stored aggregate if available)
    let currentStreak = 0; let priorStreak = 0;
    try { const aggRef = doc(db,'users',uid,'stats','aggregate'); const aggSnap = await getDoc(aggRef); if(aggSnap.exists()) currentStreak = Number(aggSnap.data()?.streak||0); } catch {}
    // Est prior streak: if streak is continuous, subtract number of consecutive days in current week so far
    // Simplistic approach: count mood entries this week so far
    let daysThisWeek = 0; try {
      const moodsRef = collection(db,'users',uid,'moods');
      const moodsQ = query(moodsRef, where('createdAt','>=', Timestamp.fromDate(weekStart)));
      const msnap = await getDocs(moodsQ); const byDay = new Set(); msnap.forEach(d=>{ const ts = d.data()?.createdAt?.toDate?.(); if(ts){ byDay.add(ts.toISOString().slice(0,10)); } }); daysThisWeek = byDay.size; } catch {}
    priorStreak = Math.max(0, currentStreak - daysThisWeek);
    const streakDelta = currentStreak - priorStreak;

    const title = 'Weekly Summary';
    const body = `Last week: ${minutes} min • Streak change ${streakDelta>=0? '+':''}${streakDelta}`;
    await inboxAdd({ type:'digest_summary', title, body, data:{ route:'/wellnessReport', weekStart: lastWeekStart.toISOString().slice(0,10) } });
    return true;
  } catch { return false; }
}
