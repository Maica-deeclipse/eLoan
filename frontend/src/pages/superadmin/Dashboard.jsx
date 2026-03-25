import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import superadminService from '../../services/superadmin.service';

const S = {
  heading: { fontSize: '1.5rem', fontWeight: 700, color: '#1f2937', marginBottom: '0.25rem' },
  sub: { fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.5rem' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' },
  card: (accent) => ({
    background: '#fff',
    borderRadius: '12px',
    padding: '1.25rem 1.5rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    borderLeft: `4px solid ${accent}`,
    cursor: 'pointer',
    transition: 'box-shadow 0.2s',
  }),
  cardLabel: { fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' },
  cardValue: { fontSize: '2rem', fontWeight: 700, color: '#1f2937', lineHeight: 1 },
  cardSub: { fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.35rem' },
  sectionTitle: { fontSize: '1rem', fontWeight: 600, color: '#374151', margin: '1.5rem 0 0.75rem' },
  quickGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' },
  quickCard: (color) => ({
    background: '#fff',
    borderRadius: '10px',
    padding: '1.25rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    transition: 'box-shadow 0.2s',
  }),
  quickIcon: (bg) => ({
    width: 44,
    height: 44,
    borderRadius: '10px',
    background: bg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: '1.2rem',
  }),
};

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    superadminService.getStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
        <div style={{ width: 36, height: 36, border: '3px solid #e5e7eb', borderTop: '3px solid #02327a', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  const statCards = stats ? [
    { label: 'Total Staff', value: stats.staff.total, sub: `${stats.staff.pending_approvals} pending approval`, accent: '#02327a', path: '/superadmin/staff' },
    { label: 'Pending Approvals', value: stats.staff.pending_approvals, sub: 'Staff awaiting review', accent: '#f59e0b', path: '/superadmin/staff?status=pending' },
    { label: 'Active Members', value: stats.members.active, sub: `${stats.members.total} total`, accent: '#10b981', path: '/superadmin/members' },
    { label: 'Open Violations', value: stats.violations.open, sub: `${stats.violations.total} total`, accent: '#ef4444', path: '/superadmin/violations' },
    { label: 'Disciplinary Actions', value: stats.disciplinary.total, sub: `${stats.disciplinary.terminations} terminations`, accent: '#8b5cf6', path: '/superadmin/disciplinary' },
    { label: 'Loan Applications', value: stats.loans.total, sub: `${stats.loans.pending} pending`, accent: '#3b82f6', path: null },
  ] : [];

  const quickLinks = [
    { label: 'Approve Staff', sub: `${stats?.staff.pending_approvals || 0} pending`, icon: '✅', bg: '#dbeafe', path: '/superadmin/staff?status=pending' },
    { label: 'Log Violation', sub: 'Record a new violation', icon: '⚠️', bg: '#fef3c7', path: '/superadmin/violations' },
    { label: 'Member Overview', sub: 'View all members', icon: '👥', bg: '#d1fae5', path: '/superadmin/members' },
    { label: 'Disciplinary Actions', sub: 'Manage disciplinary records', icon: '⚖️', bg: '#ede9fe', path: '/superadmin/disciplinary' },
    { label: 'Notifications', sub: 'Security alerts', icon: '🔔', bg: '#fee2e2', path: '/superadmin/notifications' },
  ];

  return (
    <div>
      <h1 style={S.heading}>Dashboard</h1>
      <p style={S.sub}>Overview of eLoan system activity</p>

      <div style={S.grid}>
        {statCards.map((c) => (
          <div
            key={c.label}
            style={S.card(c.accent)}
            onClick={() => c.path && navigate(c.path)}
            onMouseEnter={e => c.path && (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)')}
          >
            <div style={S.cardLabel}>{c.label}</div>
            <div style={S.cardValue}>{c.value}</div>
            <div style={S.cardSub}>{c.sub}</div>
          </div>
        ))}
      </div>

      <div style={S.sectionTitle}>Quick Actions</div>
      <div style={S.quickGrid}>
        {quickLinks.map((q) => (
          <div
            key={q.label}
            style={S.quickCard(q.bg)}
            onClick={() => navigate(q.path)}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)')}
          >
            <div style={S.quickIcon(q.bg)}>{q.icon}</div>
            <div>
              <div style={{ fontWeight: 600, color: '#1f2937', fontSize: '0.9rem' }}>{q.label}</div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{q.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
