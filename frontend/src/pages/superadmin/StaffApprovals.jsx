import { useState, useEffect, useCallback } from 'react';
import superadminService from '../../services/superadmin.service';

const TABS = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

const STATUS_STYLE = {
  pending:  { background: '#fef3c7', color: '#92400e' },
  approved: { background: '#d1fae5', color: '#065f46' },
  rejected: { background: '#fee2e2', color: '#991b1b' },
};

const USER_STATUS_STYLE = {
  active:    { background: '#dbeafe', color: '#1e40af' },
  suspended: { background: '#fee2e2', color: '#991b1b' },
};

export default function StaffApprovals() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [actionLoading, setActionLoading] = useState(null);
  const [rejectModal, setRejectModal] = useState(null); // { userId, name }
  const [rejectReason, setRejectReason] = useState('');
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = activeTab ? { account_status: activeTab } : {};
      const data = await superadminService.getStaff(params);
      setStaff(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const doAction = async (userId, action, extra = {}) => {
    setActionLoading(`${userId}-${action}`);
    try {
      const res = await superadminService.staffAction(userId, action, extra);
      showToast(res.message);
      load();
    } catch (e) {
      showToast(e.response?.data?.error || 'Action failed.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectSubmit = () => {
    if (!rejectReason.trim()) return;
    doAction(rejectModal.userId, 'reject', { reason: rejectReason });
    setRejectModal(null);
    setRejectReason('');
  };

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '1rem', right: '1rem', zIndex: 9999,
          background: toast.type === 'error' ? '#fee2e2' : '#d1fae5',
          color: toast.type === 'error' ? '#991b1b' : '#065f46',
          padding: '0.75rem 1.25rem', borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', fontWeight: 500,
        }}>
          {toast.msg}
        </div>
      )}

      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1f2937', marginBottom: '0.25rem' }}>Staff Management</h1>
      <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.5rem' }}>Review and manage staff account requests</p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: activeTab === t.key ? 600 : 400,
              color: activeTab === t.key ? '#02327a' : '#6b7280',
              borderBottom: activeTab === t.key ? '2px solid #02327a' : '2px solid transparent',
              fontSize: '0.875rem',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>Loading...</div>
      ) : staff.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>No staff found.</div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Name', 'Role', 'Employee ID', 'Account Status', 'Status', 'Joined', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <div style={{ fontWeight: 600, color: '#1f2937' }}>{s.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{s.email}</div>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', color: '#374151' }}>{s.role}</td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', color: '#374151' }}>{s.employee_id || '—'}</td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <span style={{ ...STATUS_STYLE[s.account_status], padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                      {s.account_status}
                    </span>
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <span style={{ ...(USER_STATUS_STYLE[s.status] || {}), padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                      {s.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.8rem', color: '#6b7280' }}>
                    {new Date(s.date_joined).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {s.account_status === 'pending' && (
                        <>
                          <ActionBtn
                            label="Approve"
                            color="#10b981"
                            loading={actionLoading === `${s.id}-approve`}
                            onClick={() => doAction(s.id, 'approve')}
                          />
                          <ActionBtn
                            label="Reject"
                            color="#ef4444"
                            loading={actionLoading === `${s.id}-reject`}
                            onClick={() => setRejectModal({ userId: s.id, name: s.name })}
                          />
                        </>
                      )}
                      {s.account_status === 'approved' && s.status === 'active' && (
                        <ActionBtn
                          label="Suspend"
                          color="#f59e0b"
                          loading={actionLoading === `${s.id}-suspend`}
                          onClick={() => doAction(s.id, 'suspend')}
                        />
                      )}
                      {(s.status === 'suspended' || s.account_status === 'rejected') && (
                        <ActionBtn
                          label="Reactivate"
                          color="#02327a"
                          loading={actionLoading === `${s.id}-reactivate`}
                          onClick={() => doAction(s.id, 'reactivate')}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', width: '400px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 0.5rem', color: '#1f2937' }}>Reject Account</h3>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 1rem' }}>Rejecting <strong>{rejectModal.name}</strong>. Please provide a reason.</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
              rows={3}
              style={{ width: '100%', padding: '0.6rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', resize: 'vertical', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={() => { setRejectModal(null); setRejectReason(''); }} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '0.875rem' }}>Cancel</button>
              <button onClick={handleRejectSubmit} style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: '6px', background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBtn({ label, color, loading, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        padding: '0.3rem 0.7rem',
        background: loading ? '#e5e7eb' : color,
        color: loading ? '#9ca3af' : '#fff',
        border: 'none',
        borderRadius: '6px',
        fontSize: '0.75rem',
        fontWeight: 600,
        cursor: loading ? 'not-allowed' : 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {loading ? '...' : label}
    </button>
  );
}
