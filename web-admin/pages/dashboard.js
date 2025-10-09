import Protected from '../components/Protected';
import Link from 'next/link';
import { db } from '../lib/firebase';
import { collection, getCountFromServer, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { useEffect, useState } from 'react';

export default function Dashboard(){
  const [counts, setCounts] = useState({ reportsOpen: 0, challenges: 0, badges: 0 });
  const [recentBadges, setRecentBadges] = useState([]);
  const [openReports, setOpenReports] = useState([]);
  useEffect(()=>{
    (async()=>{
      try{
        // Counts (best-effort using aggregation)
        try { const r = await getCountFromServer(query(collection(db,'reports'), where('status','==','open'))); setCounts(c=> ({...c, reportsOpen: r.data().count||0 })); } catch{}
        try { const c = await getCountFromServer(collection(db,'challenges')); setCounts(x=> ({...x, challenges: c.data().count||0 })); } catch{}
        try { const b = await getCountFromServer(collection(db,'admin_badges')); setCounts(x=> ({...x, badges: b.data().count||0 })); } catch{}
        // Recent badges
        try {
          const s = await getDocs(query(collection(db,'admin_badges'), orderBy('createdAt','desc'), limit(5)));
          setRecentBadges(s.docs.map(d=> ({ id:d.id, ...(d.data()||{}) })));
        } catch{}
        // Open reports preview
        try {
          const r = await getDocs(query(collection(db,'reports'), where('status','==','open'), orderBy('createdAt','desc'), limit(5)));
          setOpenReports(r.docs.map(d=> ({ id:d.id, ...(d.data()||{}) })));
        } catch{}
      }catch(e){ console.error(e); }
    })();
  },[]);
  return (
    <Protected>
      <h1 className="text-xl font-bold mb-4">Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Link href="/moderation" className="block p-4 bg-white border rounded">
          <div className="text-sm text-gray-500">Open Reports</div>
          <div className="text-3xl font-bold">{counts.reportsOpen}</div>
        </Link>
        <Link href="/challenges" className="block p-4 bg-white border rounded">
          <div className="text-sm text-gray-500">Challenges</div>
          <div className="text-3xl font-bold">{counts.challenges}</div>
        </Link>
        <Link href="/badges" className="block p-4 bg-white border rounded">
          <div className="text-sm text-gray-500">Badges</div>
          <div className="text-3xl font-bold">{counts.badges}</div>
        </Link>
      </div>
      <div>
        <h2 className="font-semibold mb-2">Recent Badges</h2>
        <div className="space-y-2">
          {recentBadges.map(b=> (
            <div key={b.id} className="p-3 bg-white border rounded">
              <div className="font-semibold">{b.emoji? `${b.emoji} `:''}{b.name||b.id}</div>
              <div className="text-sm text-gray-600">{b.description||''}</div>
            </div>
          ))}
          {recentBadges.length===0? <div className="text-sm text-gray-500">No badges yet.</div> : null}
        </div>
      </div>
      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Open Reports</h2>
          <Link href="/moderation" className="text-sm text-blue-600 underline">View all</Link>
        </div>
        <div className="space-y-2">
          {openReports.map(r=> (
            <div key={r.id} className="p-3 bg-white border rounded">
              <div className="text-sm">{r.reason || 'reported'} • {r.createdAt?.toDate? new Date(r.createdAt.toDate()).toLocaleString(): ''}</div>
              <div className="text-xs text-gray-600">postId: {r.postId}</div>
            </div>
          ))}
          {openReports.length===0? <div className="text-sm text-gray-500">No open reports.</div> : null}
        </div>
      </div>
    </Protected>
  );
}
