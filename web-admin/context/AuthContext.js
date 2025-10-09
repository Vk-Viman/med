import { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../lib/firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';

const AuthContext = createContext(null);
export function AuthProvider({ children }){
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(()=>{
    const unsub = onAuthStateChanged(auth, (u)=>{ setUser(u); setLoading(false); });
    return ()=> unsub();
  },[]);
  const login = (email, password)=> signInWithEmailAndPassword(auth, email, password);
  const logout = ()=> signOut(auth);
  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}
export function useAuth(){ return useContext(AuthContext); }
