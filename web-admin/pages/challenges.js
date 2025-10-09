import Protected from '../components/Protected';
import { db } from '../lib/firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';

export default function Challenges(){
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ id:null, title:'', description:'', goalMinutes:'', startAt:'', endAt:'', teamEnabled:false, rewardPoints:'', rewardBadge:'' });
  const [busy, setBusy] = useState(false);
  useEffect(()=>{
    (async()=>{
      try{
        const snap = await getDocs(collection(db,'challenges'));
        setItems(snap.docs.map(d=> ({ id:d.id, ...d.data() })));
      }catch(e){ console.error(e); }
    })();
  },[]);
  const resetForm=()=> setForm({ id:null, title:'', description:'', goalMinutes:'', startAt:'', endAt:'', teamEnabled:false, rewardPoints:'', rewardBadge:'' });
  const refresh = async()=>{
    const snap = await getDocs(collection(db,'challenges'));
    setItems(snap.docs.map(d=> ({ id:d.id, ...d.data() })));
  };
  const save = async(e)=>{
    e.preventDefault(); setBusy(true);
    try{
      const payload = {
        title: form.title || 'Untitled',
        description: form.description || '',
        goalMinutes: form.goalMinutes? Number(form.goalMinutes) : null,
        startAt: form.startAt? new Date(form.startAt) : null,
        endAt: form.endAt? new Date(form.endAt) : null,
        teamEnabled: !!form.teamEnabled,
        rewardPoints: form.rewardPoints? Number(form.rewardPoints) : 0,
        rewardBadge: form.rewardBadge || '',
      };
      if(form.id){
        await updateDoc(doc(db,'challenges', form.id), { ...payload, updatedAt: serverTimestamp() });
      }else{
        await addDoc(collection(db,'challenges'), { ...payload, createdAt: serverTimestamp() });
      }
      await refresh(); resetForm();
    }catch(err){ console.error(err); } finally{ setBusy(false); }
  };
  const edit = (it)=>{
    setForm({
      id: it.id,
      title: it.title || '',
      description: it.description || '',
      goalMinutes: (it.goalMinutes || it.targetMinutes || '') + '',
      startAt: it.startAt?.toDate? new Date(it.startAt.toDate()).toISOString().slice(0,16) : (it.startAt? new Date(it.startAt).toISOString().slice(0,16): ''),
      endAt: it.endAt?.toDate? new Date(it.endAt.toDate()).toISOString().slice(0,16) : (it.endAt? new Date(it.endAt).toISOString().slice(0,16): ''),
      teamEnabled: !!it.teamEnabled,
      rewardPoints: (it.rewardPoints ?? '') + '',
      rewardBadge: it.rewardBadge || '',
    });
  };
  const remove = async(id)=>{
    if(!id) return;
    if(!window.confirm('Delete this challenge? This cannot be undone.')) return;
    setBusy(true);
    try{ await deleteDoc(doc(db,'challenges', id)); await refresh(); if(form.id===id) resetForm(); }
    catch(e){ console.error(e);} finally{ setBusy(false);} };
  return (
    <Protected>
      <h1 className="text-xl font-bold mb-4">Challenges</h1>
      <form onSubmit={save} className="mb-6 p-4 border rounded bg-white grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm mb-1">Title</label>
          <input className="w-full border rounded px-3 py-2" value={form.title} onChange={e=> setForm(f=> ({...f,title:e.target.value}))} required />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm mb-1">Description</label>
          <textarea className="w-full border rounded px-3 py-2" rows={3} value={form.description} onChange={e=> setForm(f=> ({...f,description:e.target.value}))} />
        </div>
        <div>
          <label className="block text-sm mb-1">Goal Minutes</label>
          <input type="number" className="w-full border rounded px-3 py-2" value={form.goalMinutes} onChange={e=> setForm(f=> ({...f,goalMinutes:e.target.value}))} />
        </div>
        <div>
          <label className="block text-sm mb-1">Start (local)</label>
          <input type="datetime-local" className="w-full border rounded px-3 py-2" value={form.startAt} onChange={e=> setForm(f=> ({...f,startAt:e.target.value}))} />
        </div>
        <div>
          <label className="block text-sm mb-1">End (local)</label>
          <input type="datetime-local" className="w-full border rounded px-3 py-2" value={form.endAt} onChange={e=> setForm(f=> ({...f,endAt:e.target.value}))} />
        </div>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={form.teamEnabled} onChange={e=> setForm(f=> ({...f,teamEnabled:e.target.checked}))} /> Team Enabled
        </label>
        <div>
          <label className="block text-sm mb-1">Reward Points</label>
          <input type="number" className="w-full border rounded px-3 py-2" value={form.rewardPoints} onChange={e=> setForm(f=> ({...f,rewardPoints:e.target.value}))} />
        </div>
        <div>
          <label className="block text-sm mb-1">Reward Badge ID</label>
          <input className="w-full border rounded px-3 py-2" value={form.rewardBadge} onChange={e=> setForm(f=> ({...f,rewardBadge:e.target.value}))} placeholder="(optional badge id)" />
        </div>
        <div className="flex gap-2 items-end">
          <button disabled={busy} className="px-4 py-2 bg-blue-600 text-white rounded">{form.id? 'Update' : 'Create'}</button>
          {form.id? <button type="button" className="px-3 py-2 bg-gray-200 rounded" onClick={resetForm}>Cancel</button> : null}
        </div>
      </form>
      <div className="space-y-2">
        {items.map(it=> (
          <div key={it.id} className="p-3 bg-white border rounded">
            <div className="font-semibold">{it.title || it.id}</div>
            <div className="text-sm">Goal: {it.goalMinutes || it.targetMinutes || '—'}m</div>
            {it.description? <div className="text-sm text-gray-700 mt-1">{it.description}</div> : null}
            <div className="text-xs text-gray-600">Reward: {(it.rewardPoints||0)} pts{it.rewardBadge? ` • Badge: ${it.rewardBadge}`: ''}</div>
            <div className="text-xs text-gray-600">{it.startAt? new Date(it.startAt?.toDate? it.startAt.toDate(): it.startAt).toLocaleString(): 'No start'} → {it.endAt? new Date(it.endAt?.toDate? it.endAt.toDate(): it.endAt).toLocaleString(): 'No end'}</div>
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
