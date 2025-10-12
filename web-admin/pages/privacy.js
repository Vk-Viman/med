import Protected from '../components/Protected';
import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

export default function Privacy() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    dataRetentionDays: 365,
    allowDataExport: true,
    allowAccountDeletion: true,
    anonymizeDeletedData: true,
    collectAnalytics: true,
    shareWithThirdParties: false,
    gdprCompliant: true,
    ccpaCompliant: true,
    minAge: 13,
    requireEmailVerification: true,
    privacyPolicyUrl: '',
    termsOfServiceUrl: ''
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const docRef = doc(db, 'settings', 'privacy');
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
      await updateDoc(doc(db, 'settings', 'privacy'), {
        ...settings,
        updatedAt: serverTimestamp()
      });
      alert('Privacy settings saved successfully!');
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading privacy settings...</p>
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
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-white text-2xl mr-4 shadow-lg">
            🔒
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Privacy Settings</h1>
            <p className="text-gray-600">Configure data privacy and compliance</p>
          </div>
        </div>

        <form onSubmit={saveSettings} className="space-y-6">
          {/* Data Retention */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              🗄️ Data Retention
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Data Retention Period (days)
                </label>
                <input
                  type="number"
                  value={settings.dataRetentionDays}
                  onChange={(e) => setSettings({ ...settings, dataRetentionDays: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                  min="1"
                />
                <p className="text-xs text-gray-500 mt-1">How long to keep user data after account deletion</p>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  id="anonymizeDeletedData"
                  checked={settings.anonymizeDeletedData}
                  onChange={(e) => setSettings({ ...settings, anonymizeDeletedData: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="anonymizeDeletedData" className="text-sm text-gray-700">
                  Anonymize data instead of deletion (for analytics)
                </label>
              </div>
            </div>
          </div>

          {/* User Rights */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              👤 User Rights
            </h2>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                <input
                  type="checkbox"
                  id="allowDataExport"
                  checked={settings.allowDataExport}
                  onChange={(e) => setSettings({ ...settings, allowDataExport: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="allowDataExport" className="text-sm text-gray-700">
                  Allow users to export their data
                </label>
              </div>

              <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                <input
                  type="checkbox"
                  id="allowAccountDeletion"
                  checked={settings.allowAccountDeletion}
                  onChange={(e) => setSettings({ ...settings, allowAccountDeletion: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="allowAccountDeletion" className="text-sm text-gray-700">
                  Allow users to delete their accounts
                </label>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  id="requireEmailVerification"
                  checked={settings.requireEmailVerification}
                  onChange={(e) => setSettings({ ...settings, requireEmailVerification: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="requireEmailVerification" className="text-sm text-gray-700">
                  Require email verification for new accounts
                </label>
              </div>
            </div>
          </div>

          {/* Data Collection */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              📊 Data Collection
            </h2>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                <input
                  type="checkbox"
                  id="collectAnalytics"
                  checked={settings.collectAnalytics}
                  onChange={(e) => setSettings({ ...settings, collectAnalytics: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="collectAnalytics" className="text-sm text-gray-700">
                  Collect usage analytics
                </label>
              </div>

              <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
                <input
                  type="checkbox"
                  id="shareWithThirdParties"
                  checked={settings.shareWithThirdParties}
                  onChange={(e) => setSettings({ ...settings, shareWithThirdParties: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="shareWithThirdParties" className="text-sm text-gray-700">
                  Share data with third-party services (analytics, advertising)
                </label>
              </div>
            </div>
          </div>

          {/* Compliance */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              ⚖️ Compliance
            </h2>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                <input
                  type="checkbox"
                  id="gdprCompliant"
                  checked={settings.gdprCompliant}
                  onChange={(e) => setSettings({ ...settings, gdprCompliant: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="gdprCompliant" className="text-sm text-gray-700">
                  GDPR Compliant (European Union)
                </label>
              </div>

              <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                <input
                  type="checkbox"
                  id="ccpaCompliant"
                  checked={settings.ccpaCompliant}
                  onChange={(e) => setSettings({ ...settings, ccpaCompliant: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="ccpaCompliant" className="text-sm text-gray-700">
                  CCPA Compliant (California)
                </label>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Minimum Age Requirement
                </label>
                <input
                  type="number"
                  value={settings.minAge}
                  onChange={(e) => setSettings({ ...settings, minAge: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                  min="13"
                  max="18"
                />
              </div>
            </div>
          </div>

          {/* Legal Documents */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              📄 Legal Documents
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Privacy Policy URL
                </label>
                <input
                  type="url"
                  value={settings.privacyPolicyUrl}
                  onChange={(e) => setSettings({ ...settings, privacyPolicyUrl: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                  placeholder="https://yourapp.com/privacy"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Terms of Service URL
                </label>
                <input
                  type="url"
                  value={settings.termsOfServiceUrl}
                  onChange={(e) => setSettings({ ...settings, termsOfServiceUrl: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                  placeholder="https://yourapp.com/terms"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full px-6 py-3 bg-gradient-to-r from-gray-700 to-gray-800 text-white font-semibold rounded-lg hover:from-gray-800 hover:to-gray-900 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Privacy Settings'}
          </button>
        </form>
      </div>
    </Protected>
  );
}
