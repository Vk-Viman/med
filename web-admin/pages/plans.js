import Protected from '../components/Protected';
import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';

export default function Plans() {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [features, setFeatures] = useState('');
  const [isPopular, setIsPopular] = useState(false);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const snapshot = await getDocs(query(collection(db, 'subscriptionPlans'), orderBy('price', 'asc')));
      const plansData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPlans(plansData);
    } catch (error) {
      console.error('Error loading plans:', error);
      alert('Could not load subscription plans. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setPrice('');
    setDuration('');
    setFeatures('');
    setIsPopular(false);
    setEditingPlan(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const openEditModal = (plan) => {
    setName(plan.name || '');
    setDescription(plan.description || '');
    setPrice(plan.price || '');
    setDuration(plan.duration || '');
    setFeatures(plan.features?.join('\n') || '');
    setIsPopular(plan.isPopular || false);
    setEditingPlan(plan);
    setShowAddModal(true);
  };

  const savePlan = async (e) => {
    e.preventDefault();

    // Basic validation
    if (!name.trim()) {
      alert('Please enter a plan name');
      return;
    }

    // Price validation
    const parsedPrice = parseFloat(price);
    if (price && (isNaN(parsedPrice) || parsedPrice < 0)) {
      alert('Price must be a positive number');
      return;
    }

    // Duration validation
    const parsedDuration = parseInt(duration);
    if (duration && (isNaN(parsedDuration) || parsedDuration < 1)) {
      alert('Duration must be at least 1 day');
      return;
    }

    try {
      const data = {
        name: name.trim(),
        description: description.trim(),
        price: parsedPrice || 0,
        duration: parsedDuration || 30,
        features: features.split('\n').filter(f => f.trim()),
        isPopular,
        updatedAt: serverTimestamp()
      };

      if (editingPlan) {
        await updateDoc(doc(db, 'subscriptionPlans', editingPlan.id), data);
        alert('Plan updated successfully!');
      } else {
        await addDoc(collection(db, 'subscriptionPlans'), {
          ...data,
          createdAt: serverTimestamp(),
          subscriberCount: 0
        });
        alert('Plan added successfully!');
      }

      setShowAddModal(false);
      resetForm();
      loadPlans();
    } catch (error) {
      console.error('Error saving plan:', error);
      alert('Could not save plan. Please try again.');
    }
  };

  const deletePlan = async (id) => {
    if (!confirm('Delete this plan?')) return;

    try {
      await deleteDoc(doc(db, 'subscriptionPlans', id));
      loadPlans();
    } catch (error) {
      alert('Could not delete plan. Please try again.');
    }
  };

  if (loading) {
    return (
      <Protected>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading plans...</p>
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
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white text-2xl mr-4 shadow-lg">
              💎
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Subscription Plans</h1>
              <p className="text-gray-600">Manage pricing and features</p>
            </div>
          </div>

          <button
            onClick={openAddModal}
            className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors shadow-sm font-semibold"
          >
            + Add Plan
          </button>
        </div>

        {/* Stats Card */}
        <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl shadow-sm p-6 text-white mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-4xl font-bold mb-2">{plans.length}</div>
              <div className="text-teal-100">Active Plans</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">{plans.reduce((sum, p) => sum + (p.subscriberCount || 0), 0)}</div>
              <div className="text-teal-100">Total Subscribers</div>
            </div>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-500">
              <p className="text-lg mb-4">No plans yet</p>
              <button
                onClick={openAddModal}
                className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
              >
                Create Your First Plan
              </button>
            </div>
          ) : (
            plans.map(plan => (
              <div
                key={plan.id}
                className={`relative bg-white rounded-xl shadow-sm border-2 p-6 transition-all hover:shadow-lg ${
                  plan.isPopular ? 'border-teal-500' : 'border-gray-200'
                }`}
              >
                {plan.isPopular && (
                  <div className="absolute top-0 right-0 -mt-3 -mr-3">
                    <span className="px-3 py-1 bg-gradient-to-r from-teal-500 to-teal-600 text-white text-xs rounded-full font-bold shadow-md">
                      ⭐ POPULAR
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <p className="text-gray-600 text-sm mb-4">{plan.description}</p>
                  <div className="flex items-baseline justify-center">
                    <span className="text-4xl font-bold text-teal-600">${plan.price || 0}</span>
                    <span className="text-gray-500 ml-2">/ {plan.duration || 30} days</span>
                  </div>
                </div>

                {plan.features && plan.features.length > 0 && (
                  <div className="mb-6">
                    <div className="space-y-2">
                      {plan.features.map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <span className="text-teal-500 mt-1">✓</span>
                          <span className="text-sm text-gray-700">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-center text-sm text-gray-500 mb-4">
                  👥 {plan.subscriberCount || 0} subscribers
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => openEditModal(plan)}
                    className="flex-1 px-4 py-2 bg-teal-100 text-teal-700 rounded-lg hover:bg-teal-200 transition-colors font-semibold"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deletePlan(plan.id)}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add/Edit Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingPlan ? 'Edit Plan' : 'Add New Plan'}
                </h2>
              </div>

              <form onSubmit={savePlan} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Plan Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Basic, Pro, Premium, etc."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Short description"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Price ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      placeholder="9.99"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Duration (days)</label>
                    <input
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      placeholder="30"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Features (one per line)
                  </label>
                  <textarea
                    value={features}
                    onChange={(e) => setFeatures(e.target.value)}
                    rows={6}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Unlimited meditation sessions&#10;Ad-free experience&#10;Offline downloads&#10;Priority support"
                  />
                </div>

                <div className="flex items-center gap-3 p-4 bg-teal-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="isPopular"
                    checked={isPopular}
                    onChange={(e) => setIsPopular(e.target.checked)}
                    className="w-4 h-4 text-teal-600"
                  />
                  <label htmlFor="isPopular" className="text-sm font-semibold text-gray-700">
                    ⭐ Mark as popular plan
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-semibold"
                  >
                    {editingPlan ? 'Update' : 'Add'} Plan
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
