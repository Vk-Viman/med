import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login(){
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e)=>{
    e.preventDefault(); setError(''); setBusy(true);
    try{ await login(email, password); window.location.href='/dashboard'; }catch(err){ setError(err?.message||'Login failed'); } finally{ setBusy(false); }
  };
  if(user){ if(typeof window!=='undefined'){ window.location.href='/dashboard'; } return null; }
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <form onSubmit={onSubmit} className="bg-white p-6 rounded border w-full max-w-sm space-y-3">
        <h1 className="text-xl font-bold">Admin Login</h1>
        {error? <div className="text-red-600 text-sm">{error}</div> : null}
        <label className="block text-sm">
          <div className="mb-1">Email</div>
          <input className="w-full border rounded px-3 py-2" type="email" value={email} onChange={e=> setEmail(e.target.value)} required />
        </label>
        <label className="block text-sm">
          <div className="mb-1">Password</div>
          <input className="w-full border rounded px-3 py-2" type="password" value={password} onChange={e=> setPassword(e.target.value)} required />
        </label>
        <button disabled={busy} className="w-full bg-blue-600 text-white py-2 rounded">{busy? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
