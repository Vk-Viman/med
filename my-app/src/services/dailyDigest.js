import { auth, db } from '../../firebase/firebaseConfig';
import { collection, query, where, orderBy, getDocs, Timestamp, doc, getDoc } from 'firebase/firestore';
import { inboxAdd } from './inbox';

// Creates a daily digest summary (previous day) if not already created today.
export async function ensureDailyDigestSummary(){
  try {
    const uid = auth.currentUser?.uid; if(!uid) return false;
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
    const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate()-1);
    const yesterdayEnd = new Date(todayStart); yesterdayEnd.setMilliseconds(-1);

    // Check last daily digest
    const inboxRef = collection(db,'users',uid,'inbox');
    const digQ = query(inboxRef, where('type','==','daily_digest'), orderBy('createdAt','desc'));
    try {
      const digSnap = await getDocs(digQ);
      const last = digSnap.docs[0];
      if(last){
        const ct = last.data()?.createdAt?.toDate?.();
        if(ct && ct >= todayStart) return false; // already have today's
      }
    } catch {}

    // Aggregate yesterday's session minutes
    const sessRef = collection(db,'users',uid,'sessions');
    const qRef = query(sessRef, where('endedAt','>=', Timestamp.fromDate(yesterdayStart)), where('endedAt','<=', Timestamp.fromDate(yesterdayEnd)));
    const snap = await getDocs(qRef);
    let minutes = 0; snap.forEach(d=>{ const m = d.data()?.minutes || d.data()?.durationMinutes; if(Number.isFinite(m)) minutes += Number(m); });

    // Current streak (approx)
    let currentStreak = 0; try { const aggRef = doc(db,'users',uid,'stats','aggregate'); const aggSnap = await getDoc(aggRef); if(aggSnap.exists()) currentStreak = Number(aggSnap.data()?.streak||0); } catch {}

    const title = 'Daily Summary';
    const body = `Yesterday: ${minutes} min • Streak ${currentStreak}d`;
    // Preference gate: dailyDigestEnabled (future toggle; default off if undefined)
    try {
      const profSnap = await getDoc(doc(db,'users',uid));
      const profData = profSnap?.data?.()||{};
      if(profData.dailyDigestEnabled === false) return false;
    } catch {}
    await inboxAdd({ type:'daily_digest', title, body, data:{ route:'/wellnessReport', day: yesterdayStart.toISOString().slice(0,10) } });
    return true;
  } catch { return false; }
}
