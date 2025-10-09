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
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">🎯 Challenges</h1>
        <p className="text-gray-600">Create and manage meditation challenges</p>
      </div>
      <form onSubmit={save} className="mb-8 p-6 rounded-xl bg-white shadow-lg border-2 border-blue-100 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Title *</label>
          <input className="input-field" value={form.title} onChange={e=> setForm(f=> ({...f,title:e.target.value}))} placeholder="30-Day Meditation Challenge" required />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
          <textarea className="input-field" rows={3} value={form.description} onChange={e=> setForm(f=> ({...f,description:e.target.value}))} placeholder="Meditate daily for 30 days to unlock rewards..." />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Goal Minutes</label>
          <input type="number" className="input-field" value={form.goalMinutes} onChange={e=> setForm(f=> ({...f,goalMinutes:e.target.value}))} placeholder="300" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Start Date/Time</label>
          <input type="datetime-local" className="input-field" value={form.startAt} onChange={e=> setForm(f=> ({...f,startAt:e.target.value}))} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">End Date/Time</label>
          <input type="datetime-local" className="input-field" value={form.endAt} onChange={e=> setForm(f=> ({...f,endAt:e.target.value}))} />
        </div>
        <label className="inline-flex items-center gap-3 cursor-pointer p-3 bg-blue-50 rounded-lg border border-blue-200">
          <input type="checkbox" className="w-5 h-5 text-blue-600 rounded" checked={form.teamEnabled} onChange={e=> setForm(f=> ({...f,teamEnabled:e.target.checked}))} />
          <span className="font-semibold text-gray-700">Enable Team Mode</span>
        </label>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Reward Points</label>
          <input type="number" className="input-field" value={form.rewardPoints} onChange={e=> setForm(f=> ({...f,rewardPoints:e.target.value}))} placeholder="100" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Reward Badge ID</label>
          <input className="input-field" value={form.rewardBadge} onChange={e=> setForm(f=> ({...f,rewardBadge:e.target.value}))} placeholder="challenge_complete_30d" />
        </div>
        <div className="md:col-span-2 flex gap-3 items-end">
          <button disabled={busy} className="btn-primary">{form.id? '✏️ Update Challenge' : '✨ Create Challenge'}</button>
          {form.id? <button type="button" className="btn-secondary" onClick={resetForm}>Cancel</button> : null}
        </div>
      </form>
      <div className="space-y-4">
        {items.map(it=> (
          <div key={it.id} className="bg-white border-2 border-gray-200 rounded-xl p-5 hover:shadow-lg transition-all">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900 mb-2">{it.title || it.id}</h3>
                {it.description? <p className="text-gray-700 mb-3">{it.description}</p> : null}
              </div>
              {it.teamEnabled && (
                <span className="badge badge-info ml-3">👥 Team</span>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Goal</div>
                <div className="text-2xl font-bold text-blue-900">{it.goalMinutes || it.targetMinutes || '—'} <span className="text-sm">min</span></div>
              </div>
              <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                <div className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Points</div>
                <div className="text-2xl font-bold text-green-900">{(it.rewardPoints||0)} <span className="text-sm">pts</span></div>
              </div>
              {it.rewardBadge && (
                <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                  <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Badge</div>
                  <div className="text-sm font-bold text-amber-900">{it.rewardBadge}</div>
                </div>
              )}
            </div>
            
            <div className="text-sm text-gray-600 mb-3">
              <span className="font-semibold">📅 Duration:</span> {it.startAt? new Date(it.startAt?.toDate? it.startAt.toDate(): it.startAt).toLocaleDateString(): 'No start'} → {it.endAt? new Date(it.endAt?.toDate? it.endAt.toDate(): it.endAt).toLocaleDateString(): 'No end'}
            </div>
            
            <div className="flex gap-2">
              <button onClick={()=> edit(it)} className="btn-secondary text-sm">✏️ Edit</button>
              <button onClick={()=> remove(it.id)} className="btn-danger text-sm">🗑️ Delete</button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-center py-16 bg-white rounded-xl border-2 border-gray-200">
            <div className="text-6xl mb-4">🎯</div>
            <div className="text-xl font-bold text-gray-900 mb-2">No Challenges Yet</div>
            <div className="text-gray-600">Create your first challenge above</div>
          </div>
        )}
      </div>
    </Protected>
  );
}
