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
      <h1 className="text-xl font-bold mb-4">Badges</h1>
      <form onSubmit={save} className="mb-6 p-4 border rounded bg-white grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm mb-1">Emoji</label>
          <input className="w-full border rounded px-3 py-2" value={form.emoji} onChange={e=> setForm(f=> ({...f,emoji:e.target.value}))} placeholder="🏅" />
        </div>
        <div>
          <label className="block text-sm mb-1">Name</label>
          <input className="w-full border rounded px-3 py-2" value={form.name} onChange={e=> setForm(f=> ({...f,name:e.target.value}))} required />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm mb-1">Description</label>
          <textarea className="w-full border rounded px-3 py-2" value={form.description} onChange={e=> setForm(f=> ({...f,description:e.target.value}))} rows={3} />
        </div>
        <div className="flex gap-2 items-end">
          <button disabled={busy} className="px-4 py-2 bg-blue-600 text-white rounded">{form.id? 'Update' : 'Create'}</button>
          {form.id? <button type="button" className="px-3 py-2 bg-gray-200 rounded" onClick={resetForm}>Cancel</button> : null}
        </div>
      </form>
      <div className="space-y-2">
        {items.map(it=> (
          <div key={it.id} className="p-3 bg-white border rounded">
            <div className="font-semibold">{it.emoji? `${it.emoji} `:''}{it.name || it.id}</div>
            <div className="text-sm">{it.description || ''}</div>
            <div className="mt-2 flex gap-2">
              <button onClick={()=> edit(it)} className="px-3 py-1 bg-gray-200 rounded text-sm">Edit</button>
              <button onClick={()=> remove(it.id)} className="px-3 py-1 bg-red-600 text-white rounded text-sm">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </Protected>
  );
}
