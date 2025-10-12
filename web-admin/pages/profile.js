import Protected from '../components/Protected';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';

export default function Profile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    role: 'admin',
    avatar: '',
    notificationPreferences: {
      emailOnNewUser: true,
      emailOnFlaggedPost: true,
      emailOnNewReport: true,
      emailOnSystemAlert: true
    }
  });

  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const docRef = doc(db, 'admins', user.uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        setProfile({ ...profile, ...docSnap.data(), email: user.email });
      } else {
        setProfile({ ...profile, email: user.email });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      await updateDoc(doc(db, 'admins', user.uid), {
        name: profile.name,
        avatar: profile.avatar,
        notificationPreferences: profile.notificationPreferences,
        updatedAt: serverTimestamp()
      });
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Error: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    try {
      const auth = getAuth();
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      
      alert('Password changed successfully!');
      setShowPasswordChange(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Error changing password:', error);
      if (error.code === 'auth/wrong-password') {
        alert('Current password is incorrect');
      } else {
        alert('Error: ' + error.message);
      }
    }
  };

  if (loading) {
    return (
      <Protected>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading profile...</p>
          </div>
        </div>
      </Protected>
    );
  }

  return (
    <Protected>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center mb-6">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white text-2xl mr-4 shadow-lg">
            👤
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
            <p className="text-gray-600">Manage your admin account</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-4xl mx-auto mb-4">
                {profile.name?.[0]?.toUpperCase() || 'A'}
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">{profile.name || 'Admin'}</h3>
              <p className="text-sm text-gray-600 mb-2">{profile.email}</p>
              <span className="inline-block px-3 py-1 bg-purple-100 text-purple-700 text-xs rounded-full font-semibold">
                {profile.role?.toUpperCase() || 'ADMIN'}
              </span>
            </div>
          </div>

          {/* Forms */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile Information */}
            <form onSubmit={saveProfile} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Profile Information</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Name</label>
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={profile.email}
                    disabled
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Avatar URL</label>
                  <input
                    type="url"
                    value={profile.avatar}
                    onChange={(e) => setProfile({ ...profile, avatar: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="https://..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>

            {/* Password Change */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Password</h2>
              
              {!showPasswordChange ? (
                <button
                  onClick={() => setShowPasswordChange(true)}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-semibold"
                >
                  Change Password
                </button>
              ) : (
                <form onSubmit={changePassword} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Current Password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      minLength={6}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      minLength={6}
                      required
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      className="flex-1 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold"
                    >
                      Update Password
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPasswordChange(false);
                        setCurrentPassword('');
                        setNewPassword('');
                        setConfirmPassword('');
                      }}
                      className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Notification Preferences */}
            <form onSubmit={saveProfile} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Notification Preferences</h2>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="emailOnNewUser"
                    checked={profile.notificationPreferences.emailOnNewUser}
                    onChange={(e) => setProfile({
                      ...profile,
                      notificationPreferences: { ...profile.notificationPreferences, emailOnNewUser: e.target.checked }
                    })}
                    className="w-4 h-4"
                  />
                  <label htmlFor="emailOnNewUser" className="text-sm text-gray-700">
                    Email me when new users sign up
                  </label>
                </div>

                <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="emailOnFlaggedPost"
                    checked={profile.notificationPreferences.emailOnFlaggedPost}
                    onChange={(e) => setProfile({
                      ...profile,
                      notificationPreferences: { ...profile.notificationPreferences, emailOnFlaggedPost: e.target.checked }
                    })}
                    className="w-4 h-4"
                  />
                  <label htmlFor="emailOnFlaggedPost" className="text-sm text-gray-700">
                    Email me when posts are flagged
                  </label>
                </div>

                <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="emailOnNewReport"
                    checked={profile.notificationPreferences.emailOnNewReport}
                    onChange={(e) => setProfile({
                      ...profile,
                      notificationPreferences: { ...profile.notificationPreferences, emailOnNewReport: e.target.checked }
                    })}
                    className="w-4 h-4"
                  />
                  <label htmlFor="emailOnNewReport" className="text-sm text-gray-700">
                    Email me on new reports
                  </label>
                </div>

                <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="emailOnSystemAlert"
                    checked={profile.notificationPreferences.emailOnSystemAlert}
                    onChange={(e) => setProfile({
                      ...profile,
                      notificationPreferences: { ...profile.notificationPreferences, emailOnSystemAlert: e.target.checked }
                    })}
                    className="w-4 h-4"
                  />
                  <label htmlFor="emailOnSystemAlert" className="text-sm text-gray-700">
                    Email me on system alerts
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full mt-4 px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Preferences'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </Protected>
  );
}
