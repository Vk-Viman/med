import { db } from '../../firebase/firebaseConfig';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

const CONFIG_PATH = 'admin_config/app';
const DEFAULTS = {
  allowExports: true,
  allowRetention: true,
  allowBackfillTools: false,
  allowMeditations: true,
  allowPlans: true,
  allowCommunity: true,
};

export async function getAdminConfig(){
  const ref = doc(db, CONFIG_PATH);
  const snap = await getDoc(ref);
  if(!snap.exists()) return { ...DEFAULTS };
  const data = snap.data() || {};
  return { ...DEFAULTS, ...data };
}

export async function setAdminConfigPatch(patch){
  const ref = doc(db, CONFIG_PATH);
  // Merge with existing; create doc if missing
  await setDoc(ref, patch, { merge: true });
}

export function subscribeAdminConfig(cb){
  const ref = doc(db, CONFIG_PATH);
  return onSnapshot(ref, (snap)=>{
    const data = snap.exists()? { ...DEFAULTS, ...(snap.data()||{}) } : { ...DEFAULTS };
    try { cb(data); } catch {}
  }, ()=>{
    try { cb({ ...DEFAULTS }); } catch {}
  });
}
