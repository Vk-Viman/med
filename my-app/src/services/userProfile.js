import { auth, db } from '../../firebase/firebaseConfig';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';

// Collection path: users/{uid}/profile (single document) OR users/{uid} root doc.
// We'll use a root doc users/{uid} so mood subcollections already nest under same.
// Document shape:
// {
//   email: string,
//   displayName: string|null,
//   avatarB64?: string|null,            // small base64 avatar (data:image/...;base64,...)
//   themeMode?: 'light' | 'dark',       // preferred theme
//   wipeRequested?: boolean,            // server/admin sets true to request local secure wipe
//   createdAt: Timestamp,
//   updatedAt: Timestamp,
//   biometricEnabled: boolean,
//   localOnlyLast: boolean,
//   stats: { moodEntryCount?: number }
// }

const userDocRef = (uid)=> doc(db, `users/${uid}`);

export async function ensureUserProfile(extra = {}){
  const uid = auth.currentUser?.uid; if(!uid) return null;
  const ref = userDocRef(uid);
  const snap = await getDoc(ref);
  if(!snap.exists()){
    const email = auth.currentUser.email || null;
    const base = {
      email,
      displayName: null,
  biometricEnabled: true,
  avatarB64: null,
  themeMode: 'light',
  wipeRequested: false,
      localOnlyLast: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...extra
    };
    await setDoc(ref, base, { merge: true });
    return { id: uid, ...base };
  }
  return { id: uid, ...snap.data() };
}

export async function getUserProfile(){
  const uid = auth.currentUser?.uid; if(!uid) return null;
  const snap = await getDoc(userDocRef(uid));
  return snap.exists()? { id: uid, ...snap.data() }: null;
}

export async function updateUserProfile(patch){
  const uid = auth.currentUser?.uid; if(!uid) throw new Error('Not logged in');
  await updateDoc(userDocRef(uid), { ...patch, updatedAt: serverTimestamp() });
}

export async function deleteUserProfile(){
  const uid = auth.currentUser?.uid; if(!uid) return;
  try { await deleteDoc(userDocRef(uid)); } catch {}
}

export async function flagWipeRequested(val=true){
  const uid = auth.currentUser?.uid; if(!uid) return;
  await updateDoc(userDocRef(uid), { wipeRequested: val, updatedAt: serverTimestamp() });
}
