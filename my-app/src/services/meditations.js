import { db } from '../../firebase/firebaseConfig';
import { collection, doc, getDoc, getDocs, orderBy, query, limit as qlimit } from 'firebase/firestore';
import { safeSnapshot } from '../utils/safeSnapshot';

// Public/user-side accessor for meditation records by ID.
// Reads from admin_meditations but does not depend on admin-only service imports.
export async function getMeditationById(id){
  if(!id) return null;
  try {
    const s = await getDoc(doc(db, `admin_meditations/${id}`));
    return s.exists() ? { id: s.id, ...s.data() } : null;
  } catch {
    return null;
  }
}

// List meditations (user-side view of admin-managed content)
export async function listMeditations({ limit = 200 } = {}){
  try {
    const ref = collection(db, 'admin_meditations');
    let q = query(ref);
    try { q = query(ref, orderBy('createdAt', 'desc'), qlimit(limit)); } catch { /* fallback when field/index missing */ }
    const snap = await getDocs(q);
    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
    return rows;
  } catch { return []; }
}

// Subscribe to live updates so user list reflects admin changes immediately
export function subscribeMeditations(callback, { limit = 200 } = {}){
  try {
    const ref = collection(db, 'admin_meditations');
    let q = query(ref);
    try { q = query(ref, orderBy('createdAt', 'desc'), qlimit(limit)); } catch { /* ignore */ }
    const unsub = safeSnapshot(q, (snap)=>{
      const rows = [];
      snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
      try { callback(rows); } catch {}
    });
    return unsub;
  } catch { return () => {}; }
}
