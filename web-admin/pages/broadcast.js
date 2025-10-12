import Protected from '../components/Protected';
import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

export default function Broadcast() {
  const [loading, setLoading] = useState(false);
  const [broadcasts, setBroadcasts] = useState([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetAudience, setTargetAudience] = useState('all'); // all, active, inactive
  const [priority, setPriority] = useState('normal'); // low, normal, high
  const [route, setRoute] = useState('');

  useEffect(() => {
    loadBroadcasts();
  }, []);

  const loadBroadcasts = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'broadcasts'));
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBroadcasts(data);
    } catch (error) {
      console.error('Error loading broadcasts:', error);
    }
  };

  const sendBroadcast = async (e) => {
    e.preventDefault();
    
    if (!title.trim() || !body.trim()) {
      alert('Please fill in title and body');
      return;
    }

    try {
      setLoading(true);
      
      await addDoc(collection(db, 'broadcasts'), {
        title: title.trim(),
        body: body.trim(),
        targetAudience,
        priority,
        route: route.trim() || null,
        status: 'pending',
        createdAt: serverTimestamp(),
        sentCount: 0,
      });

      alert('Broadcast queued successfully!');
      setTitle('');
      setBody('');
      setRoute('');
      loadBroadcasts();
    } catch (error) {
      console.error('Error sending broadcast:', error);
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteBroadcast = async (id) => {
    if (!confirm('Delete this broadcast?')) return;
    
    try {
      await deleteDoc(doc(db, 'broadcasts', id));
      loadBroadcasts();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  return (
    <Protected>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center mb-6">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white text-2xl mr-4 shadow-lg">
            📢
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Broadcast</h1>
            <p className="text-gray-600">Send notifications to users</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Send Broadcast Form */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Send New Broadcast</h2>
            
            <form onSubmit={sendBroadcast} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Notification title"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Message *
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Notification message"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">{body.length}/500 characters</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Target Audience
                </label>
                <select
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="all">All Users</option>
                  <option value="active">Active Users (30 days)</option>
                  <option value="inactive">Inactive Users</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Route (Optional)
                </label>
                <input
                  type="text"
                  value={route}
                  onChange={(e) => setRoute(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="/meditation, /achievements, etc."
                />
                <p className="text-xs text-gray-500 mt-1">Deep link route when notification is tapped</p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold rounded-lg hover:from-green-600 hover:to-green-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Sending...' : 'Send Broadcast'}
              </button>
            </form>
          </div>

          {/* Broadcast History */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Broadcast History</h2>
              <button
                onClick={loadBroadcasts}
                className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
              >
                Refresh
              </button>
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {broadcasts.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>No broadcasts yet</p>
                </div>
              ) : (
                broadcasts.map(broadcast => (
                  <div key={broadcast.id} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{broadcast.title}</h3>
                          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                            broadcast.status === 'sent' ? 'bg-green-100 text-green-700' :
                            broadcast.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {broadcast.status || 'pending'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{broadcast.body}</p>
                        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                          <span>👥 {broadcast.targetAudience || 'all'}</span>
                          <span>🔔 {broadcast.priority || 'normal'}</span>
                          <span>✉️ {broadcast.sentCount || 0} sent</span>
                          {broadcast.createdAt?.toDate && (
                            <span>📅 {broadcast.createdAt.toDate().toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteBroadcast(broadcast.id)}
                        className="ml-2 text-red-600 hover:text-red-700 p-1"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </Protected>
  );
}
