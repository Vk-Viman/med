import Protected from '../components/Protected';
import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, updateDoc, query, where, orderBy } from 'firebase/firestore';

export default function Mutes() {
  const [loading, setLoading] = useState(true);
  const [mutes, setMutes] = useState([]);

  useEffect(() => {
    loadMutes();
  }, []);

  const loadMutes = async () => {
    try {
      setLoading(true);
      
      const q = query(
        collection(db, 'users'),
        where('mutedUntil', '>', new Date()),
        orderBy('mutedUntil', 'desc')
      );

      const snapshot = await getDocs(q);
      const mutesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setMutes(mutesData);
    } catch (error) {
      console.error('Error loading mutes:', error);
      // If query fails due to index, load all users and filter
      try {
        const allUsers = await getDocs(collection(db, 'users'));
        const mutesData = allUsers.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(user => user.mutedUntil && user.mutedUntil.toDate() > new Date());
        setMutes(mutesData);
      } catch (err) {
        alert('Error loading mutes: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const unmute = async (userId) => {
    if (!confirm('Unmute this user?')) return;

    try {
      await updateDoc(doc(db, 'users', userId), {
        mutedUntil: null,
        muteReason: null
      });
      loadMutes();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  if (loading) {
    return (
      <Protected>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading muted users...</p>
          </div>
        </div>
      </Protected>
    );
  }

  return (
    <Protected>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white text-2xl mr-4 shadow-lg">
              🔇
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Muted Users</h1>
              <p className="text-gray-600">Manage temporarily muted accounts</p>
            </div>
          </div>

          <button
            onClick={loadMutes}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors shadow-sm"
          >
            Refresh
          </button>
        </div>

        {/* Stats Card */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-sm p-6 text-white mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-4xl font-bold mb-2">{mutes.length}</div>
              <div className="text-orange-100">Currently Muted Users</div>
            </div>
            <div className="text-5xl">🔇</div>
          </div>
        </div>

        {/* Mutes List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {mutes.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg mb-2">No muted users</p>
              <p className="text-sm">All users can currently post and interact</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {mutes.map(user => {
                const mutedUntil = user.mutedUntil?.toDate();
                const isExpired = mutedUntil && mutedUntil < new Date();
                const timeRemaining = mutedUntil ? Math.ceil((mutedUntil - new Date()) / (1000 * 60 * 60)) : 0;

                return (
                  <div key={user.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-lg flex-shrink-0">
                          {user.name?.[0] || 'U'}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-gray-900">{user.name || 'Anonymous'}</h3>
                            {isExpired && (
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                                Expired
                              </span>
                            )}
                          </div>

                          <p className="text-sm text-gray-600 mb-2">{user.email}</p>

                          {user.muteReason && (
                            <div className="mb-3 p-3 bg-orange-50 border border-orange-100 rounded-lg">
                              <p className="text-sm font-semibold text-gray-700 mb-1">Mute Reason:</p>
                              <p className="text-sm text-gray-600">{user.muteReason}</p>
                            </div>
                          )}

                          <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                            {mutedUntil && (
                              <>
                                <span className="flex items-center gap-1">
                                  <span className="font-semibold">Until:</span>
                                  {mutedUntil.toLocaleString()}
                                </span>
                                {!isExpired && timeRemaining > 0 && (
                                  <span className="flex items-center gap-1 text-orange-600 font-semibold">
                                    ⏰ {timeRemaining}h remaining
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => unmute(user.id)}
                        className="ml-4 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors font-semibold flex-shrink-0"
                      >
                        Unmute
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>ℹ️ Note:</strong> Muted users cannot create posts or comments but can still view content. 
            Mutes automatically expire after the specified duration.
          </p>
        </div>
      </div>
    </Protected>
  );
}
