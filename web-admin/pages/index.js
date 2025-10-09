import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

export default function Index(){
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(()=>{
    if(loading) return;
    router.replace(user ? '/dashboard' : '/login');
  }, [user, loading]);

  return (
    <div className="p-8">
      Redirecting…
      <div className="mt-2 text-sm">
        <a className="text-blue-600 underline" href="/dashboard">Go to dashboard</a>
        <span className="mx-2">•</span>
        <a className="text-blue-600 underline" href="/login">Login</a>
      </div>
    </div>
  );
}
