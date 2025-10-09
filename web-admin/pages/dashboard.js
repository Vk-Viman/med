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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
        <p className="text-gray-600">Monitor and manage your meditation app</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Link href="/moderation" className="block bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200 rounded-xl p-6 hover:shadow-lg transition-all duration-200 hover:scale-105">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-red-700 uppercase tracking-wide">Open Reports</div>
            <span className="text-3xl">⚠️</span>
          </div>
          <div className="text-4xl font-bold text-red-900 mb-1">{counts.reportsOpen}</div>
          <div className="text-sm text-red-700">Needs attention</div>
        </Link>
        
        <Link href="/challenges" className="block bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-6 hover:shadow-lg transition-all duration-200 hover:scale-105">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-blue-700 uppercase tracking-wide">Challenges</div>
            <span className="text-3xl">🎯</span>
          </div>
          <div className="text-4xl font-bold text-blue-900 mb-1">{counts.challenges}</div>
          <div className="text-sm text-blue-700">Active programs</div>
        </Link>
        
        <Link href="/badges" className="block bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-amber-200 rounded-xl p-6 hover:shadow-lg transition-all duration-200 hover:scale-105">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-amber-700 uppercase tracking-wide">Badges</div>
            <span className="text-3xl">🏆</span>
          </div>
          <div className="text-4xl font-bold text-amber-900 mb-1">{counts.badges}</div>
          <div className="text-sm text-amber-700">Achievement types</div>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
          <div className="flex items-center mb-4">
            <span className="text-2xl mr-3">✨</span>
            <h2 className="text-xl font-bold text-gray-900">Recent Badges</h2>
          </div>
          <div className="space-y-3">
            {recentBadges.map(b=> (
              <div key={b.id} className="p-4 bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                <div className="font-bold text-gray-900 text-lg mb-1">
                  {b.emoji? <span className="mr-2">{b.emoji}</span> : null}
                  {b.name||b.id}
                </div>
                <div className="text-sm text-gray-600">{b.description||'No description'}</div>
              </div>
            ))}
            {recentBadges.length===0? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">🏅</div>
                <div className="text-sm">No badges created yet</div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <span className="text-2xl mr-3">🚨</span>
              <h2 className="text-xl font-bold text-gray-900">Open Reports</h2>
            </div>
            <Link href="/moderation" className="text-sm text-blue-600 hover:text-blue-800 font-semibold hover:underline">
              View all →
            </Link>
          </div>
          <div className="space-y-3">
            {openReports.map(r=> (
              <div key={r.id} className="p-4 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
                <div className="text-sm font-semibold text-red-900 mb-1">
                  {r.reason || 'Reported content'}
                </div>
                <div className="text-xs text-red-700">
                  {r.createdAt?.toDate? new Date(r.createdAt.toDate()).toLocaleString(): 'Date unknown'}
                </div>
                <div className="text-xs text-gray-600 mt-1">Post: {r.postId}</div>
              </div>
            ))}
            {openReports.length===0? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">✅</div>
                <div className="text-sm">All clear! No open reports</div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </Protected>
  );
}
