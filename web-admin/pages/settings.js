import Protected from '../components/Protected';
import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general'); // general, features, email, security
  const [settings, setSettings] = useState({
    // General
    appName: 'Meditation App',
    appDescription: 'Mental wellness platform',
    supportEmail: 'support@example.com',
    maintenanceMode: false,
    
    // Features
    enableCommunity: true,
    enableChallenges: true,
    enableBadges: true,
    enableMeditations: true,
    enableMoodTracker: true,
    enableNotifications: true,
    allowUserReports: true,
    autoModeration: false,
    
    // Email
    emailProvider: 'sendgrid',
    emailApiKey: '',
    fromEmail: 'noreply@example.com',
    fromName: 'Meditation App',
    
    // Security
    maxLoginAttempts: 5,
    sessionTimeout: 24,
    requireStrongPasswords: true,
    enableTwoFactor: false,
    allowedDomains: ''
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const docRef = doc(db, 'settings', 'app');
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        setSettings({ ...settings, ...docSnap.data() });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      await updateDoc(doc(db, 'settings', 'app'), {
        ...settings,
        updatedAt: serverTimestamp()
      });
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Error: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Protected>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading settings...</p>
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
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white text-2xl mr-4 shadow-lg">
            ⚙️
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
            <p className="text-gray-600">Configure app-wide settings</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Tabs */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2 space-y-1">
              {[
                { id: 'general', icon: '🏠', label: 'General' },
                { id: 'features', icon: '🎯', label: 'Features' },
                { id: 'email', icon: '📧', label: 'Email' },
                { id: 'security', icon: '🔐', label: 'Security' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-xl">{tab.icon}</span>
                  <span className="font-semibold">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="lg:col-span-3">
            <form onSubmit={saveSettings} className="space-y-6">
              {/* General Settings */}
              {activeTab === 'general' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">General Settings</h2>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">App Name</label>
                      <input
                        type="text"
                        value={settings.appName}
                        onChange={(e) => setSettings({ ...settings, appName: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                      <textarea
                        value={settings.appDescription}
                        onChange={(e) => setSettings({ ...settings, appDescription: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Support Email</label>
                      <input
                        type="email"
                        value={settings.supportEmail}
                        onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg">
                      <input
                        type="checkbox"
                        id="maintenanceMode"
                        checked={settings.maintenanceMode}
                        onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <label htmlFor="maintenanceMode" className="text-sm text-gray-700">
                        <strong>⚠️ Maintenance Mode</strong> - App will be unavailable to users
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Features */}
              {activeTab === 'features' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Feature Toggles</h2>
                  
                  <div className="space-y-3">
                    {[
                      { key: 'enableCommunity', label: '👥 Enable Community', color: 'blue' },
                      { key: 'enableChallenges', label: '🏆 Enable Challenges', color: 'purple' },
                      { key: 'enableBadges', label: '🏅 Enable Badges', color: 'yellow' },
                      { key: 'enableMeditations', label: '🧘 Enable Meditations', color: 'indigo' },
                      { key: 'enableMoodTracker', label: '😊 Enable Mood Tracker', color: 'pink' },
                      { key: 'enableNotifications', label: '🔔 Enable Notifications', color: 'green' },
                      { key: 'allowUserReports', label: '🚩 Allow User Reports', color: 'orange' },
                      { key: 'autoModeration', label: '🤖 Auto Moderation', color: 'red' }
                    ].map(feature => (
                      <div key={feature.key} className={`flex items-center gap-3 p-3 bg-${feature.color}-50 rounded-lg`}>
                        <input
                          type="checkbox"
                          id={feature.key}
                          checked={settings[feature.key]}
                          onChange={(e) => setSettings({ ...settings, [feature.key]: e.target.checked })}
                          className="w-4 h-4"
                        />
                        <label htmlFor={feature.key} className="text-sm text-gray-700">
                          {feature.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Email Settings */}
              {activeTab === 'email' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Email Configuration</h2>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Email Provider</label>
                      <select
                        value={settings.emailProvider}
                        onChange={(e) => setSettings({ ...settings, emailProvider: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      >
                        <option value="sendgrid">SendGrid</option>
                        <option value="mailgun">Mailgun</option>
                        <option value="ses">Amazon SES</option>
                        <option value="smtp">SMTP</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">API Key</label>
                      <input
                        type="password"
                        value={settings.emailApiKey}
                        onChange={(e) => setSettings({ ...settings, emailApiKey: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="••••••••••••"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">From Email</label>
                      <input
                        type="email"
                        value={settings.fromEmail}
                        onChange={(e) => setSettings({ ...settings, fromEmail: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">From Name</label>
                      <input
                        type="text"
                        value={settings.fromName}
                        onChange={(e) => setSettings({ ...settings, fromName: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Security Settings */}
              {activeTab === 'security' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Security Settings</h2>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Max Login Attempts
                      </label>
                      <input
                        type="number"
                        value={settings.maxLoginAttempts}
                        onChange={(e) => setSettings({ ...settings, maxLoginAttempts: parseInt(e.target.value) })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        min="3"
                        max="10"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Session Timeout (hours)
                      </label>
                      <input
                        type="number"
                        value={settings.sessionTimeout}
                        onChange={(e) => setSettings({ ...settings, sessionTimeout: parseInt(e.target.value) })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        min="1"
                        max="168"
                      />
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                      <input
                        type="checkbox"
                        id="requireStrongPasswords"
                        checked={settings.requireStrongPasswords}
                        onChange={(e) => setSettings({ ...settings, requireStrongPasswords: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <label htmlFor="requireStrongPasswords" className="text-sm text-gray-700">
                        Require strong passwords (8+ chars, uppercase, number, special)
                      </label>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                      <input
                        type="checkbox"
                        id="enableTwoFactor"
                        checked={settings.enableTwoFactor}
                        onChange={(e) => setSettings({ ...settings, enableTwoFactor: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <label htmlFor="enableTwoFactor" className="text-sm text-gray-700">
                        Enable two-factor authentication
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Allowed Email Domains (comma-separated, leave empty for all)
                      </label>
                      <input
                        type="text"
                        value={settings.allowedDomains}
                        onChange={(e) => setSettings({ ...settings, allowedDomains: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="example.com, company.com"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Save Button */}
              <button
                type="submit"
                disabled={saving}
                className="w-full px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-semibold rounded-lg hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </Protected>
  );
}
