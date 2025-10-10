import { db } from '../../firebase/firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { safeSnapshot } from '../utils/safeSnapshot';

const CONFIG_PATH = 'admin_config/app';
const DEFAULTS = {
  allowExports: true,
  allowRetention: true,
  allowBackfillTools: false,
  allowMeditations: true,
  allowPlans: true,
  allowCommunity: true,
  // Community limits & terms
  communityMaxLength: 300,
  communityAllowLinks: false,
  postCooldownMs: 15000,
  replyCooldownMs: 10000,
  termsShort: 'Be kind and respectful. No hate speech, harassment, or sharing personal info. Avoid links and spam. Content may be auto-hidden and reviewed.',
  termsCategories: ['Respect', 'Safety', 'No spam', 'No links'],
  termsFullUrl: '',
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
  return safeSnapshot(ref, (snap)=>{
    const data = snap.exists()? { ...DEFAULTS, ...(snap.data()||{}) } : { ...DEFAULTS };
    try { cb(data); } catch {}
  }, ()=>{
    try { cb({ ...DEFAULTS }); } catch {}
  });
}
