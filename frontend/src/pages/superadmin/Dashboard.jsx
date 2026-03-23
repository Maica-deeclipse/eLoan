import { useNavigate } from 'react-router-dom';

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1f2937', marginBottom: '1.5rem' }}>
        Super Administrator Dashboard
      </h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
        <div
          onClick={() => navigate('/superadmin/notifications')}
          style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', cursor: 'pointer', borderLeft: '4px solid #ef4444' }}
        >
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔒</div>
          <h3 style={{ margin: '0 0 0.25rem', color: '#1f2937' }}>Security Notifications</h3>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>View security alerts and system events</p>
        </div>
      </div>
    </div>
  );
}
