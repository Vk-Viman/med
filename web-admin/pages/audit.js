import Protected from '../components/Protected';
import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, query, orderBy, limit, where, doc, updateDoc } from 'firebase/firestore';

export default function Audit() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('all'); // all, admin, moderation, user

  useEffect(() => {
    loadAuditLogs();
  }, [filter]);

  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      
      let q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(100));
      
      if (filter !== 'all') {
        q = query(
          collection(db, 'audit_logs'),
          where('category', '==', filter),
          orderBy('timestamp', 'desc'),
          limit(100)
        );
      }

      const snapshot = await getDocs(q);
      const logsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setLogs(logsData);
    } catch (error) {
      console.error('Error loading audit logs:', error);
      alert('Error loading logs: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (action) => {
    if (action.includes('delete') || action.includes('remove')) return '🗑️';
    if (action.includes('ban') || action.includes('mute')) return '🚫';
    if (action.includes('approve') || action.includes('resolve')) return '✅';
    if (action.includes('create') || action.includes('add')) return '➕';
    if (action.includes('update') || action.includes('edit')) return '✏️';
    if (action.includes('login')) return '🔐';
    return '📝';
  };

  const getColor = (action) => {
    if (action.includes('delete') || action.includes('ban')) return 'text-red-600 bg-red-50 border-red-200';
    if (action.includes('approve') || action.includes('resolve')) return 'text-green-600 bg-green-50 border-green-200';
    if (action.includes('create')) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (action.includes('update')) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-gray-600 bg-gray-50 border-gray-200';
  };

  if (loading) {
    return (
      <Protected>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading audit logs...</p>
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
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white text-2xl mr-4 shadow-lg">
              📋
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
              <p className="text-gray-600">System activity and changes</p>
            </div>
          </div>

          <button
            onClick={loadAuditLogs}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
          >
            Refresh
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {['all', 'admin', 'moderation', 'user'].map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                filter === tab
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Logs List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {logs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">No audit logs found</p>
              <p className="text-sm mt-2">Activity will appear here as actions are performed</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {logs.map(log => (
                <div key={log.id} className={`p-4 hover:bg-gray-50 transition-colors border-l-4 ${getColor(log.action || '')}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <span className="text-2xl">{getIcon(log.action || '')}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900">{log.action || 'Unknown Action'}</span>
                          {log.category && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full font-medium">
                              {log.category}
                            </span>
                          )}
                        </div>
                        
                        {log.details && (
                          <p className="text-sm text-gray-600 mb-2">{log.details}</p>
                        )}
                        
                        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                          {log.adminId && (
                            <span className="flex items-center gap-1">
                              <span className="font-medium">Admin:</span>
                              {log.adminId}
                            </span>
                          )}
                          {log.targetId && (
                            <span className="flex items-center gap-1">
                              <span className="font-medium">Target:</span>
                              {log.targetId}
                            </span>
                          )}
                          {log.timestamp?.toDate && (
                            <span className="flex items-center gap-1">
                              📅 {log.timestamp.toDate().toLocaleString()}
                            </span>
                          )}
                        </div>

                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <details className="mt-2">
                            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                              View metadata
                            </summary>
                            <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {logs.length > 0 && (
            <div className="p-4 bg-gray-50 text-center text-sm text-gray-600">
              Showing {logs.length} most recent logs
            </div>
          )}
        </div>
      </div>
    </Protected>
  );
}
