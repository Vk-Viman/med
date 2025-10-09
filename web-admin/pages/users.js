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
      <h1 className="text-xl font-bold mb-4">Users</h1>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input placeholder="Search name/email/id" className="border rounded px-3 py-2" value={qText} onChange={e=> setQText(e.target.value)} />
        <label className="text-sm">Order by
          <select className="ml-2 border rounded px-2 py-1" value={order} onChange={e=> setOrder(e.target.value)}>
            <option value="createdAt_desc">Created (newest)</option>
            <option value="createdAt_asc">Created (oldest)</option>
            <option value="displayName_asc">Name (A→Z)</option>
            <option value="displayName_desc">Name (Z→A)</option>
          </select>
        </label>
        <label className="text-sm">Page size
          <select className="ml-2 border rounded px-2 py-1" value={pageSize} onChange={e=> setPageSize(Number(e.target.value))}>
            <option>25</option>
            <option>50</option>
            <option>100</option>
          </select>
        </label>
        <button onClick={()=> load(false)} className="px-3 py-2 bg-gray-200 rounded text-sm">Load more</button>
      </div>
      <div className="space-y-2">
        {filtered.map(it=> (
          <div key={it.id} className="p-3 bg-white border rounded">
            <div className="font-semibold">{it.displayName || it.id}</div>
            <div className="text-sm">{it.email || ''}</div>
          </div>
        ))}
      </div>
    </Protected>
  );
}
