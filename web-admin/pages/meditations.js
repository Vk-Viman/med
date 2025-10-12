import Protected from '../components/Protected';
import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';

export default function Meditations() {
  const [loading, setLoading] = useState(true);
  const [meditations, setMeditations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMeditation, setEditingMeditation] = useState(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [duration, setDuration] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [level, setLevel] = useState('beginner'); // beginner, intermediate, advanced

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load meditations
      const meditationsSnapshot = await getDocs(query(collection(db, 'meditations'), orderBy('createdAt', 'desc')));
      const meditationsData = meditationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Load categories
      const categoriesSnapshot = await getDocs(collection(db, 'meditationCategories'));
      const categoriesData = categoriesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setMeditations(meditationsData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Could not load meditations. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('');
    setDuration('');
    setAudioUrl('');
    setImageUrl('');
    setLevel('beginner');
    setEditingMeditation(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const openEditModal = (meditation) => {
    setTitle(meditation.title || '');
    setDescription(meditation.description || '');
    setCategory(meditation.category || '');
    setDuration(meditation.duration || '');
    setAudioUrl(meditation.audioUrl || '');
    setImageUrl(meditation.imageUrl || '');
    setLevel(meditation.level || 'beginner');
    setEditingMeditation(meditation);
    setShowAddModal(true);
  };

  const saveMeditation = async (e) => {
    e.preventDefault();

    // Validation
    if (!title.trim() || !category.trim()) {
      alert('Please fill in title and category');
      return;
    }

    // URL validation
    const urlPattern = /^https?:\/\/.+/;
    if (audioUrl.trim() && !urlPattern.test(audioUrl.trim())) {
      alert('Audio URL must be a valid HTTP/HTTPS URL');
      return;
    }
    if (imageUrl.trim() && !urlPattern.test(imageUrl.trim())) {
      alert('Image URL must be a valid HTTP/HTTPS URL');
      return;
    }

    // Duration validation
    const parsedDuration = parseInt(duration);
    if (duration && (isNaN(parsedDuration) || parsedDuration < 0)) {
      alert('Duration must be a positive number');
      return;
    }

    try {
      const data = {
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
        duration: parsedDuration || 0,
        audioUrl: audioUrl.trim(),
        imageUrl: imageUrl.trim(),
        level,
        updatedAt: serverTimestamp()
      };

      if (editingMeditation) {
        await updateDoc(doc(db, 'meditations', editingMeditation.id), data);
        alert('Meditation updated successfully!');
      } else {
        await addDoc(collection(db, 'meditations'), {
          ...data,
          createdAt: serverTimestamp(),
          playCount: 0,
          favoriteCount: 0
        });
        alert('Meditation added successfully!');
      }

      setShowAddModal(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving meditation:', error);
      alert('Could not save meditation. Please try again.');
    }
  };

  const deleteMeditation = async (id) => {
    if (!confirm('Delete this meditation?')) return;

    try {
      await deleteDoc(doc(db, 'meditations', id));
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading meditations...</p>
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
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white text-2xl mr-4 shadow-lg">
              🧘
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Meditations</h1>
              <p className="text-gray-600">Manage meditation content</p>
            </div>
          </div>

          <button
            onClick={openAddModal}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-semibold"
          >
            + Add Meditation
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-sm p-6 text-white">
            <div className="text-3xl mb-2">📚</div>
            <div className="text-2xl font-bold">{meditations.length}</div>
            <div className="text-indigo-100 text-sm">Total Meditations</div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-sm p-6 text-white">
            <div className="text-3xl mb-2">📁</div>
            <div className="text-2xl font-bold">{categories.length}</div>
            <div className="text-purple-100 text-sm">Categories</div>
          </div>

          <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl shadow-sm p-6 text-white">
            <div className="text-3xl mb-2">▶️</div>
            <div className="text-2xl font-bold">{meditations.reduce((sum, m) => sum + (m.playCount || 0), 0)}</div>
            <div className="text-pink-100 text-sm">Total Plays</div>
          </div>

          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-sm p-6 text-white">
            <div className="text-3xl mb-2">❤️</div>
            <div className="text-2xl font-bold">{meditations.reduce((sum, m) => sum + (m.favoriteCount || 0), 0)}</div>
            <div className="text-red-100 text-sm">Total Favorites</div>
          </div>
        </div>

        {/* Meditations List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-bold text-gray-900">All Meditations</h2>
          </div>

          {meditations.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">No meditations yet</p>
              <button
                onClick={openAddModal}
                className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Add Your First Meditation
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {meditations.map(meditation => (
                <div key={meditation.id} className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg border border-indigo-100 p-4">
                  {meditation.imageUrl && (
                    <img
                      src={meditation.imageUrl}
                      alt={meditation.title}
                      className="w-full h-32 object-cover rounded-lg mb-3"
                    />
                  )}

                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 mb-1">{meditation.title}</h3>
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full font-medium">
                        {meditation.category}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded">
                      {meditation.duration || 0} min
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{meditation.description}</p>

                  <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                    <span>▶️ {meditation.playCount || 0}</span>
                    <span>❤️ {meditation.favoriteCount || 0}</span>
                    <span className="capitalize">{meditation.level || 'beginner'}</span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(meditation)}
                      className="flex-1 px-3 py-2 bg-indigo-100 text-indigo-700 text-sm rounded-lg hover:bg-indigo-200 transition-colors font-semibold"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteMeditation(meditation.id)}
                      className="px-3 py-2 bg-red-100 text-red-700 text-sm rounded-lg hover:bg-red-200 transition-colors"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add/Edit Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingMeditation ? 'Edit Meditation' : 'Add New Meditation'}
                </h2>
              </div>

              <form onSubmit={saveMeditation} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Title *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Category *</label>
                    <input
                      type="text"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Sleep, Stress, Anxiety, etc."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Duration (minutes)</label>
                    <input
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      min="1"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Level</label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Audio URL</label>
                  <input
                    type="url"
                    value={audioUrl}
                    onChange={(e) => setAudioUrl(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Image URL</label>
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="https://..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold"
                  >
                    {editingMeditation ? 'Update' : 'Add'} Meditation
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      resetForm();
                    }}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Protected>
  );
}
