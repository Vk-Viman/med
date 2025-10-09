import Protected from '../components/Protected';
import { db } from '../lib/firebase';
import { collection, getDocs, limit, orderBy, query, startAfter } from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState } from 'react';

export default function Users(){
  const [items, setItems] = useState([]);
  const [qText, setQText] = useState('');
  const [order, setOrder] = useState('createdAt_desc');
  const [pageSize, setPageSize] = useState(25);
  const lastDocRef = useRef(null);
  const load = async(reset=false)=>{
    try{
      const [field, dir] = order.split('_');
      const base = [collection(db,'users')];
      if(field){ base.push(orderBy(field, dir==='desc'? 'desc':'asc')); }
      base.push(limit(pageSize));
      if(!reset && lastDocRef.current){ base.push(startAfter(lastDocRef.current)); }
      const qRef = query(...base);
      const snap = await getDocs(qRef);
      const rows = snap.docs.map(d=> ({ id:d.id, ...d.data() }));
      lastDocRef.current = snap.docs[snap.docs.length-1] || null;
      setItems(prev=> reset? rows : [...prev, ...rows]);
    }catch(e){ console.error(e); }
  };
  useEffect(()=>{ lastDocRef.current = null; setItems([]); load(true); }, [order, pageSize]);
  const filtered = useMemo(()=>{
    const t = qText.trim().toLowerCase(); if(!t) return items;
    return items.filter(u=> (u.displayName||'').toLowerCase().includes(t) || (u.email||'').toLowerCase().includes(t) || u.id.toLowerCase().includes(t));
  }, [items, qText]);
  return (
    <Protected>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">👥 Users</h1>
        <p className="text-gray-600">Browse and manage user accounts</p>
      </div>
      
      <div className="mb-6 bg-white p-5 rounded-xl shadow-md border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-2">🔍 Search Users</label>
            <input 
              placeholder="Search by name, email, or ID..." 
              className="input-field" 
              value={qText} 
              onChange={e=> setQText(e.target.value)} 
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Sort By</label>
            <select className="input-field" value={order} onChange={e=> setOrder(e.target.value)}>
              <option value="createdAt_desc">📅 Newest First</option>
              <option value="createdAt_asc">📅 Oldest First</option>
              <option value="displayName_asc">🔤 Name (A→Z)</option>
              <option value="displayName_desc">🔤 Name (Z→A)</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Page Size</label>
            <select className="input-field" value={pageSize} onChange={e=> setPageSize(Number(e.target.value))}>
              <option value="25">25 users</option>
              <option value="50">50 users</option>
              <option value="100">100 users</option>
            </select>
          </div>
        </div>
      </div>
      
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Showing <span className="font-bold text-gray-900">{filtered.length}</span> user{filtered.length !== 1 ? 's' : ''}
        </div>
        <button onClick={()=> load(false)} className="btn-secondary text-sm">
          ⬇️ Load More
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(it=> (
          <div key={it.id} className="bg-white border-2 border-gray-200 rounded-xl p-5 hover:shadow-lg transition-all">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                {(it.displayName || it.email || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 truncate">{it.displayName || 'Anonymous User'}</h3>
                <p className="text-sm text-gray-600 truncate">{it.email || 'No email'}</p>
              </div>
            </div>
            
            {it.userType && (
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                it.userType === 'admin' ? 'bg-red-100 text-red-800' :
                it.userType === 'moderator' ? 'bg-orange-100 text-orange-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {it.userType}
              </span>
            )}
            
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="text-xs text-gray-500 font-mono truncate" title={it.id}>
                ID: {it.id}
              </div>
              {it.createdAt && (
                <div className="text-xs text-gray-500 mt-1">
                  Joined: {new Date(it.createdAt?.toDate? it.createdAt.toDate() : it.createdAt).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {filtered.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border-2 border-gray-200">
          <div className="text-6xl mb-4">👤</div>
          <div className="text-xl font-bold text-gray-900 mb-2">No Users Found</div>
          <div className="text-gray-600">Try adjusting your search or filters</div>
        </div>
      )}
    </Protected>
  );
}
