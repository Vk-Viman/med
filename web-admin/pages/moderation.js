import Protected from '../components/Protected';
import { db } from '../lib/firebase';
import { collection, getDocs, orderBy, limit, query, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

export default function Moderation(){
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({}); // { [postId]: { toxicityScore, toxicityReason, hidden, flagged, reviewStatus, text } }
  const [statusFilter, setStatusFilter] = useState('all'); // all|open|resolved|dismissed
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  useEffect(()=>{
    (async()=>{
      try{
        const qRef = query(collection(db,'reports'), orderBy('createdAt','desc'), limit(100));
        const snap = await getDocs(qRef);
        const rows = snap.docs.map(d=> ({ id:d.id, ...d.data() }));
        setItems(rows);
        // fetch post metadata for unique postIds
        const ids = Array.from(new Set(rows.map(r=> r.postId).filter(Boolean)));
        const entries = await Promise.all(ids.map(async(id)=>{
          try{ const s = await getDoc(doc(db,'posts', id)); return [id, s.exists()? (s.data()||{}) : {}]; }catch{ return [id, {}]; }
        }));
        const m = {};
        entries.forEach(([id, data])=>{
          m[id] = {
            toxicityScore: Number(data?.toxicityScore||0),
            toxicityReason: data?.toxicityReason||'',
            hidden: !!data?.hidden,
            flagged: !!data?.flagged,
            reviewStatus: data?.reviewStatus||'',
            text: data?.text||''
          };
        });
        setMeta(m);
      }catch(e){ console.error(e); }
    })();
  },[]);

  const hidePost = async (r)=>{
    if(!r?.postId) return;
    try{ await updateDoc(doc(db,'posts', r.postId), { hidden: true }); await updateDoc(doc(db,'reports', r.id), { status: 'resolved' });
      setMeta(prev=> ({ ...prev, [r.postId]: { ...(prev[r.postId]||{}), hidden:true } }));
      setItems(prev=> prev.map(x=> x.id===r.id? { ...x, status:'resolved' } : x));
    }catch(e){ console.error('hidePost', e); }
  };
  const unhidePost = async (r)=>{
    if(!r?.postId) return;
    try{ await updateDoc(doc(db,'posts', r.postId), { hidden: false, reviewStatus:'approved' }); await updateDoc(doc(db,'reports', r.id), { status: 'resolved' });
      setMeta(prev=> ({ ...prev, [r.postId]: { ...(prev[r.postId]||{}), hidden:false, reviewStatus:'approved' } }));
      setItems(prev=> prev.map(x=> x.id===r.id? { ...x, status:'resolved' } : x));
    }catch(e){ console.error('unhidePost', e); }
  };
  const resolveReport = async (r)=>{
    try{ await updateDoc(doc(db,'reports', r.id), { status: 'resolved' }); setItems(prev=> prev.map(x=> x.id===r.id? { ...x, status:'resolved' } : x)); }catch(e){ console.error('resolveReport', e); }
  };
  return (
    <Protected>
      <h1 className="text-xl font-bold mb-4">Moderation Queue</h1>
      <div className="mb-3 flex items-center gap-3">
        <label className="text-sm">Status:
          <select value={statusFilter} onChange={e=> setStatusFilter(e.target.value)} className="ml-2 border rounded px-2 py-1 text-sm">
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </label>
        <label className="text-sm inline-flex items-center gap-2">
          <input type="checkbox" checked={flaggedOnly} onChange={e=> setFlaggedOnly(e.target.checked)} />
          Flagged/Toxic only
        </label>
      </div>
      <div className="space-y-2">
        {items
          .filter(it=> statusFilter==='all' || (String(it.status||'')===statusFilter))
          .filter(it=> !flaggedOnly || ((meta[it.postId]?.flagged) || (meta[it.postId]?.toxicityScore||0) >= 0.6))
          .map(it=> { const m = meta[it.postId]||{}; const consoleUrl = it.postId && PROJECT_ID ? `https://console.firebase.google.com/project/${PROJECT_ID}/firestore/data/~2Fposts~2F${it.postId}` : null; const createdAt = it?.createdAt?.toDate? it.createdAt.toDate() : (it?.createdAt || null); return (
          <div key={it.id} className="p-3 bg-white border rounded">
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold">Report {it.id}</div>
              {consoleUrl ? <a className="text-blue-600 underline text-sm" href={consoleUrl} target="_blank" rel="noreferrer">Open in Console</a> : null}
            </div>
            <div className="text-sm">postId: {it.postId}</div>
            <div className="text-sm">reason: {it.reason}</div>
            <div className="text-sm">status: {it.status} {createdAt? `• ${new Date(createdAt).toLocaleString()}`:''}</div>
            {it.postId ? (
              <div className="mt-2 text-sm text-gray-700">
                <div>Toxicity: {m.toxicityScore? (m.toxicityScore*100).toFixed(0) : '0'}% {m.toxicityReason? `• ${m.toxicityReason}` : ''}</div>
                <div>Hidden: {m.hidden? 'yes':'no'} {m.reviewStatus? `• ${m.reviewStatus}`:''}</div>
                {m.text? <div className="mt-1 italic text-gray-500">“{m.text.slice(0,180)}{m.text.length>180?'…':''}”</div> : null}
                <div className="mt-2 flex gap-2">
                  {!m.hidden ? (
                    <button onClick={()=> hidePost(it)} className="px-3 py-1 bg-orange-600 text-white rounded text-sm">Hide</button>
                  ) : (
                    <button onClick={()=> unhidePost(it)} className="px-3 py-1 bg-green-600 text-white rounded text-sm">Unhide</button>
                  )}
                  <button onClick={()=> resolveReport(it)} className="px-3 py-1 bg-gray-200 rounded text-sm">Resolve</button>
                </div>
              </div>
            ) : null}
          </div>
        ); })}
      </div>
    </Protected>
  );
}
