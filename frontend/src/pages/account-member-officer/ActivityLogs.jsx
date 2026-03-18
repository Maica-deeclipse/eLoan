import { useState, useEffect } from 'react';
import amoService from '../../services/amo.service';

const ACTION_TYPE_COLORS = {
  LOGIN: { bg: '#dbeafe', color: '#1e40af' },
  LOGOUT: { bg: '#f3f4f6', color: '#6b7280' },
  REGISTRATION_APPROVED: { bg: '#d1fae5', color: '#065f46' },
  REGISTRATION_REJECTED: { bg: '#fee2e2', color: '#991b1b' },
  SUSPICIOUS_ACTIVITY: { bg: '#fee2e2', color: '#991b1b' },
  VERIFICATION_FAILED: { bg: '#fef3c7', color: '#92400e' },
  VERIFICATION_SUCCESS: { bg: '#d1fae5', color: '#065f46' },
};

export default function ActivityLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = async (q = '') => {
    setLoading(true);
    const data = await amoService.getActivityLogs(q);
    setLogs(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    load(search);
  };

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1f2937', marginBottom: '0.25rem' }}>Activity Logs</h1>
      <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>Audit trail of all system actions</p>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by user or action..."
          style={{ flex: 1, padding: '0.625rem 1rem', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
        />
        <button type="submit" style={{ background: '#1f2937', color: '#fff', border: 'none', padding: '0.625rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Search</button>
      </form>

      <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['Timestamp', 'User', 'Action', 'Type', 'Result'].map(h => (
                <th key={h} style={{ padding: '0.875rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Loading...</td></tr>}
            {!loading && logs.length === 0 && <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>No logs found.</td></tr>}
            {logs.map((log, i) => {
              const typeStyle = ACTION_TYPE_COLORS[log.action_type] || { bg: '#f3f4f6', color: '#374151' };
              return (
                <tr key={log.id} style={{ borderTop: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.8rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', fontWeight: 500, color: '#1f2937' }}>
                    {log.user || 'System'}
                  </td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.8rem', color: '#4b5563', maxWidth: '280px' }}>
                    {log.action}
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <span style={{
                      background: typeStyle.bg, color: typeStyle.color,
                      padding: '0.2rem 0.65rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600,
                    }}>{log.action_type?.replace(/_/g, ' ')}</span>
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <span style={{
                      background: log.success ? '#d1fae5' : '#fee2e2',
                      color: log.success ? '#065f46' : '#991b1b',
                      padding: '0.2rem 0.65rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600,
                    }}>{log.success ? 'Success' : 'Failed'}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}