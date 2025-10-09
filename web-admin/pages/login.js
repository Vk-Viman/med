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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🧘</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Calm Space Admin</h1>
          <p className="text-gray-600">Sign in to manage your meditation app</p>
        </div>
        
        <form onSubmit={onSubmit} className="bg-white p-8 rounded-2xl shadow-xl border-2 border-blue-100 space-y-5">
          <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
          
          {error? (
            <div className="bg-red-50 border-2 border-red-200 text-red-800 text-sm p-3 rounded-lg">
              ⚠️ {error}
            </div>
          ) : null}
          
          <label className="block">
            <div className="text-sm font-semibold text-gray-700 mb-2">Email Address</div>
            <input 
              className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all" 
              type="email" 
              placeholder="admin@example.com"
              value={email} 
              onChange={e=> setEmail(e.target.value)} 
              required 
            />
          </label>
          
          <label className="block">
            <div className="text-sm font-semibold text-gray-700 mb-2">Password</div>
            <input 
              className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all" 
              type="password"
              placeholder="••••••••" 
              value={password} 
              onChange={e=> setPassword(e.target.value)} 
              required 
            />
          </label>
          
          <button 
            disabled={busy} 
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {busy? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Signing in...
              </span>
            ) : 'Sign in'}
          </button>
        </form>
        
        <div className="text-center mt-6 text-sm text-gray-600">
          Protected admin area • Calm Space 2025
        </div>
      </div>
    </div>
  );
}
