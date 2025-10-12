import Protected from '../components/Protected';
import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, query, orderBy, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';

export default function Community() {
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [filter, setFilter] = useState('all'); // all, flagged, approved, hidden

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load posts
      let postsQuery = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
      
      if (filter === 'flagged') {
        postsQuery = query(
          collection(db, 'posts'),
          where('flagged', '==', true),
          orderBy('createdAt', 'desc')
        );
      } else if (filter === 'hidden') {
        postsQuery = query(
          collection(db, 'posts'),
          where('hidden', '==', true),
          orderBy('createdAt', 'desc')
        );
      }

      const postsSnapshot = await getDocs(postsQuery);
      const postsData = postsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Load challenges
      const challengesSnapshot = await getDocs(query(collection(db, 'challenges'), orderBy('createdAt', 'desc')));
      const challengesData = challengesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setPosts(postsData);
      setChallenges(challengesData);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Error loading data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const updatePost = async (postId, updates) => {
    try {
      await updateDoc(doc(db, 'posts', postId), updates);
      loadData();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const deletePost = async (postId) => {
    if (!confirm('Permanently delete this post?')) return;
    
    try {
      await deleteDoc(doc(db, 'posts', postId));
      loadData();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  if (loading) {
    return (
      <Protected>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading community data...</p>
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
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-2xl mr-4 shadow-lg">
              👥
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Community</h1>
              <p className="text-gray-600">Manage posts and challenges</p>
            </div>
          </div>

          <button
            onClick={loadData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            Refresh
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-sm p-6 text-white">
            <div className="text-3xl mb-2">📝</div>
            <div className="text-2xl font-bold">{posts.length}</div>
            <div className="text-blue-100 text-sm">Total Posts</div>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-sm p-6 text-white">
            <div className="text-3xl mb-2">🚩</div>
            <div className="text-2xl font-bold">{posts.filter(p => p.flagged).length}</div>
            <div className="text-orange-100 text-sm">Flagged Posts</div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-sm p-6 text-white">
            <div className="text-3xl mb-2">🏆</div>
            <div className="text-2xl font-bold">{challenges.length}</div>
            <div className="text-purple-100 text-sm">Active Challenges</div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-sm p-6 text-white">
            <div className="text-3xl mb-2">❤️</div>
            <div className="text-2xl font-bold">{posts.reduce((sum, p) => sum + (p.likesCount || 0), 0)}</div>
            <div className="text-green-100 text-sm">Total Likes</div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {['all', 'flagged', 'hidden'].map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                filter === tab
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Posts List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-bold text-gray-900">Posts</h2>
          </div>

          {posts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No posts found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {posts.map(post => (
                <div key={post.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                        {post.userName?.[0] || 'U'}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900">{post.userName || 'Anonymous'}</span>
                        {post.flagged && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                            🚩 Flagged
                          </span>
                        )}
                        {post.hidden && (
                          <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded-full font-medium">
                            👁️ Hidden
                          </span>
                        )}
                      </div>

                      <p className="text-gray-700 mb-2">{post.text}</p>

                      <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                        <span>❤️ {post.likesCount || 0}</span>
                        <span>💬 {post.repliesCount || 0}</span>
                        {post.createdAt?.toDate && (
                          <span>📅 {post.createdAt.toDate().toLocaleDateString()}</span>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {!post.hidden && (
                          <button
                            onClick={() => updatePost(post.id, { hidden: true })}
                            className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            Hide
                          </button>
                        )}
                        {post.hidden && (
                          <button
                            onClick={() => updatePost(post.id, { hidden: false })}
                            className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded-lg hover:bg-green-200 transition-colors"
                          >
                            Unhide
                          </button>
                        )}
                        {post.flagged && (
                          <button
                            onClick={() => updatePost(post.id, { flagged: false })}
                            className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-lg hover:bg-blue-200 transition-colors"
                          >
                            Clear Flag
                          </button>
                        )}
                        <button
                          onClick={() => deletePost(post.id)}
                          className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded-lg hover:bg-red-200 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Challenges Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-bold text-gray-900">Active Challenges</h2>
          </div>

          {challenges.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No challenges found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
              {challenges.map(challenge => (
                <div key={challenge.id} className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg border border-purple-100">
                  <div className="flex items-start justify-between mb-2">
                    <div className="text-2xl">{challenge.icon || '🏆'}</div>
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
                      {challenge.status || 'active'}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1">{challenge.title}</h3>
                  <p className="text-sm text-gray-600 mb-3">{challenge.description}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>👥 {challenge.participantCount || 0} participants</span>
                    {challenge.endDate?.toDate && (
                      <span>📅 Ends {challenge.endDate.toDate().toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Protected>
  );
}
