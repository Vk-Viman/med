import Protected from '../components/Protected';
import { db } from '../lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';

export default function Badges(){
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ id:null, emoji:'', name:'', description:'' });
  const [busy, setBusy] = useState(false);
  useEffect(()=>{
    (async()=>{
      try{
        const snap = await getDocs(collection(db,'admin_badges'));
        setItems(snap.docs.map(d=> ({ id:d.id, ...d.data() })));
      }catch(e){ console.error(e); }
    })();
  },[]);
  const refresh = async()=>{ const snap = await getDocs(collection(db,'admin_badges')); setItems(snap.docs.map(d=> ({ id:d.id, ...d.data() }))); };
  const resetForm = ()=> setForm({ id:null, emoji:'', name:'', description:'' });
  const save = async(e)=>{
    e.preventDefault(); setBusy(true);
    try{
      const payload = { emoji: form.emoji || '', name: form.name || 'Untitled', description: form.description || '' };
      if(form.id){ await updateDoc(doc(db,'admin_badges', form.id), { ...payload, updatedAt: serverTimestamp() }); }
      else { await addDoc(collection(db,'admin_badges'), { ...payload, createdAt: serverTimestamp() }); }
      await refresh(); resetForm();
    }catch(err){ console.error(err); } finally{ setBusy(false); }
  };
  const edit = (it)=> setForm({ id: it.id, emoji: it.emoji || '', name: it.name || '', description: it.description || '' });
  const remove = async(id)=>{
    if(!id) return;
    if(!window.confirm('Delete this badge? This cannot be undone.')) return;
    setBusy(true);
    try{ await deleteDoc(doc(db,'admin_badges', id)); await refresh(); if(form.id===id) resetForm(); }
    catch(e){ console.error(e);} finally{ setBusy(false);} };
  return (
    <Protected>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">🏆 Badges</h1>
        <p className="text-gray-600">Create and manage achievement badges</p>
      </div>
      
      <form onSubmit={save} className="mb-8 p-6 rounded-xl bg-white shadow-lg border-2 border-amber-100 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Emoji Icon</label>
          <input className="input-field text-3xl text-center" value={form.emoji} onChange={e=> setForm(f=> ({...f,emoji:e.target.value}))} placeholder="🏅" />
          <p className="text-xs text-gray-500 mt-1">Pick an emoji to represent this badge</p>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Badge Name *</label>
          <input className="input-field" value={form.name} onChange={e=> setForm(f=> ({...f,name:e.target.value}))} placeholder="First Meditation" required />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
          <textarea className="input-field" value={form.description} onChange={e=> setForm(f=> ({...f,description:e.target.value}))} rows={3} placeholder="Complete your first meditation session" />
        </div>
        <div className="md:col-span-2 flex gap-3">
          <button disabled={busy} className="btn-primary">{form.id? '✏️ Update Badge' : '✨ Create Badge'}</button>
          {form.id? <button type="button" className="btn-secondary" onClick={resetForm}>Cancel</button> : null}
        </div>
      </form>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(it=> (
          <div key={it.id} className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-xl p-5 hover:shadow-xl transition-all transform hover:scale-105">
            <div className="text-center mb-3">
              <div className="text-6xl mb-2">{it.emoji || '🏅'}</div>
              <h3 className="text-lg font-bold text-gray-900">{it.name || it.id}</h3>
            </div>
            {it.description && (
              <p className="text-sm text-gray-700 text-center mb-4 min-h-[3rem]">{it.description}</p>
            )}
            <div className="flex gap-2 justify-center">
              <button onClick={()=> edit(it)} className="btn-secondary text-xs py-1">✏️ Edit</button>
              <button onClick={()=> remove(it.id)} className="bg-red-500 hover:bg-red-600 text-white font-semibold py-1 px-3 rounded-lg text-xs transition-colors">🗑️ Delete</button>
            </div>
          </div>
        ))}
      </div>
      
      {items.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border-2 border-gray-200">
          <div className="text-6xl mb-4">🏆</div>
          <div className="text-xl font-bold text-gray-900 mb-2">No Badges Yet</div>
          <div className="text-gray-600">Create your first achievement badge above</div>
        </div>
      )}
    </Protected>
  );
}
