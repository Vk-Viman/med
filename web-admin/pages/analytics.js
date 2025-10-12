import Protected from '../components/Protected';
import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, query, orderBy, limit, where, Timestamp } from 'firebase/firestore';

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeLast7Days: 0,
    activeLast30Days: 0,
    totalSessions: 0,
    totalMinutes: 0,
    totalPosts: 0,
    totalMoods: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      
      // Count users
      const usersSnap = await getDocs(collection(db, 'users'));
      const totalUsers = usersSnap.size;

      // Count active users (last 7 and 30 days)
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      let activeLast7Days = 0;
      let activeLast30Days = 0;
      let totalSessions = 0;
      let totalMinutes = 0;

      // Check each user's sessions
      for (const userDoc of usersSnap.docs) {
        const sessionsSnap = await getDocs(
          query(collection(db, `users/${userDoc.id}/sessions`), orderBy('endedAt', 'desc'), limit(50))
        );
        
        totalSessions += sessionsSnap.size;
        
        sessionsSnap.docs.forEach(doc => {
          const data = doc.data();
          const endedAt = data.endedAt?.toDate();
          
          if (data.durationSec) {
            totalMinutes += Math.round(data.durationSec / 60);
          }
          
          if (endedAt) {
            if (endedAt >= sevenDaysAgo) activeLast7Days++;
            if (endedAt >= thirtyDaysAgo) activeLast30Days++;
          }
        });
      }

      // Count posts
      const postsSnap = await getDocs(collection(db, 'posts'));
      const totalPosts = postsSnap.size;

      // Count mood entries (sample from a few users)
      let totalMoods = 0;
      let moodCount = 0;
      for (const userDoc of usersSnap.docs.slice(0, Math.min(20, usersSnap.docs.length))) {
        const moodsSnap = await getDocs(collection(db, `users/${userDoc.id}/moods`));
        totalMoods += moodsSnap.size;
        moodCount++;
      }
      // Extrapolate
      if (moodCount > 0) {
        totalMoods = Math.round((totalMoods / moodCount) * totalUsers);
      }

      // Get recent activity
      const recentPosts = await getDocs(
        query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(10))
      );
      
      const activity = recentPosts.docs.map(doc => ({
        id: doc.id,
        type: 'post',
        ...doc.data()
      }));

      setStats({
        totalUsers,
        activeLast7Days,
        activeLast30Days,
        totalSessions,
        totalMinutes,
        totalPosts,
        totalMoods,
      });
      
      setRecentActivity(activity);
    } catch (error) {
      console.error('Error loading analytics:', error);
      alert('Error loading analytics: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Protected>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading analytics...</p>
          </div>
        </div>
      </Protected>
    );
  }

  return (
    <Protected>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center mb-6">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-2xl mr-4 shadow-lg">
            📊
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
            <p className="text-gray-600">Platform insights and metrics</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
            <div className="text-blue-100 text-sm font-semibold mb-2">Total Users</div>
            <div className="text-4xl font-bold">{stats.totalUsers}</div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
            <div className="text-green-100 text-sm font-semibold mb-2">Active (7 Days)</div>
            <div className="text-4xl font-bold">{stats.activeLast7Days}</div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
            <div className="text-purple-100 text-sm font-semibold mb-2">Active (30 Days)</div>
            <div className="text-4xl font-bold">{stats.activeLast30Days}</div>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
            <div className="text-orange-100 text-sm font-semibold mb-2">Total Sessions</div>
            <div className="text-4xl font-bold">{stats.totalSessions}</div>
          </div>

          <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl p-6 text-white shadow-lg">
            <div className="text-pink-100 text-sm font-semibold mb-2">Total Minutes</div>
            <div className="text-4xl font-bold">{stats.totalMinutes}</div>
          </div>

          <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-6 text-white shadow-lg">
            <div className="text-indigo-100 text-sm font-semibold mb-2">Community Posts</div>
            <div className="text-4xl font-bold">{stats.totalPosts}</div>
          </div>

          <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-6 text-white shadow-lg">
            <div className="text-teal-100 text-sm font-semibold mb-2">Mood Entries</div>
            <div className="text-4xl font-bold">{stats.totalMoods}</div>
          </div>

          <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl p-6 text-white shadow-lg">
            <div className="text-cyan-100 text-sm font-semibold mb-2">Avg Minutes/User</div>
            <div className="text-4xl font-bold">
              {stats.totalUsers > 0 ? Math.round(stats.totalMinutes / stats.totalUsers) : 0}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Recent Activity</h2>
            <button
              onClick={loadAnalytics}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Refresh
            </button>
          </div>

          <div className="space-y-3">
            {recentActivity.map(item => (
              <div key={item.id} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">💬</span>
                      <span className="text-sm font-semibold text-gray-700">Community Post</span>
                    </div>
                    <p className="text-gray-800">{item.text || 'No content'}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>👤 {item.anonId || 'anonymous'}</span>
                      <span>👍 {item.likes || 0} likes</span>
                      <span>💬 {item.replyCount || 0} replies</span>
                      {item.createdAt?.toDate && (
                        <span>📅 {item.createdAt.toDate().toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {recentActivity.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg">No recent activity</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Protected>
  );
}
