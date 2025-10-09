import { useAuth } from '../context/AuthContext';
import Layout from './Layout';
import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function Protected({ children }){
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(null);

  useEffect(()=>{
    (async()=>{
      if(!user){ setIsAdmin(false); return; }
      try{
        // 1) Prefer custom claims if present
        const idTok = await user.getIdTokenResult?.();
        const claims = idTok?.claims || {};
        if (claims.admin === true || claims.moderator === true || claims.role === 'admin' || claims.role === 'moderator') {
          setIsAdmin(true);
          return;
        }
      }catch{/* fall through to userType doc check */}
      try{
        // 2) Fallback to user document's userType
        const uref = doc(db,'users', user.uid);
        const snap = await getDoc(uref);
        const role = (snap.data()?.userType||'').trim();
        setIsAdmin(role === 'admin' || role === 'moderator');
      }catch{ setIsAdmin(false); }
    })();
  },[user?.uid]);

  if(loading || isAdmin===null) return <div className="p-8">Loading…</div>;
  if(!user) return <div className="p-8">Please sign in from Firebase Auth to access admin. <a className="text-blue-600 underline" href="/login">Go to login</a></div>;
  if(!isAdmin) return <div className="p-8">Not authorized. Your account is not an admin.</div>;
  return <Layout>{children}</Layout>;
}
