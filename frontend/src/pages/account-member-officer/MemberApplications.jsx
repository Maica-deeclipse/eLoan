import { useState, useEffect } from 'react';
import amoService from '../../services/amo.service';

const STATUS_BADGE = {
  pending:  { bg: '#fef3c7', color: '#92400e', label: 'Pending' },
  approved: { bg: '#d1fae5', color: '#065f46', label: 'Approved' },
  rejected: { bg: '#fee2e2', color: '#991b1b', label: 'Rejected' },
};

export default function MemberApplications() {
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [selected, setSelected] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [modal, setModal] = useState(null); // 'detail' | 'reject'
  const [actionMsg, setActionMsg] = useState('');

  const load = async (f) => {
    setLoading(true);
    const data = await amoService.getApplications(f);
    setApplicants(data || []);
    setLoading(false);
  };

  useEffect(() => { load(filter); }, [filter]);

  const openDetail = async (id) => {
    const detail = await amoService.getApplicationDetail(id);
    setSelected(detail);
    setModal('detail');
  };

  const handleApprove = async (id) => {
    try {
      const res = await amoService.approveApplication(id);
      setActionMsg(res.message);
      setModal(null);
      load(filter);
    } catch (e) {
      setActionMsg('Failed to approve. Please try again.');
    }
  };

  const handleReject = async () => {
    try {
      const res = await amoService.rejectApplication(selected.id, rejectReason);
      setActionMsg(res.message);
      setModal(null);
      setRejectReason('');
      load(filter);
    } catch (e) {
      setActionMsg('Failed to reject. Please try again.');
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1f2937', marginBottom: '0.25rem' }}>Member Applications</h1>
      <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>Review and process applicant registrations</p>

      {actionMsg && (
        <div style={{ background: '#d1fae5', color: '#065f46', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>
          {actionMsg}
          <button onClick={() => setActionMsg('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#065f46' }}>✕</button>
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {['pending', 'approved', 'rejected', 'all'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '0.5rem 1.25rem', borderRadius: '9999px', border: 'none', cursor: 'pointer',
            background: filter === f ? '#10b981' : '#e5e7eb',
            color: filter === f ? '#fff' : '#374151',
            fontWeight: filter === f ? 600 : 400,
            fontSize: '0.875rem',
            textTransform: 'capitalize',
          }}>{f}</button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['Name', 'Email', 'Employee ID', 'Date Applied', 'Status', 'Actions'].map(h => (
                <th key={h} style={{ padding: '0.875rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Loading...</td></tr>
            )}
            {!loading && applicants.length === 0 && (
              <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>No records found.</td></tr>
            )}
            {applicants.map((a, i) => {
              const badge = STATUS_BADGE[a.account_status] || STATUS_BADGE.pending;
              return (
                <tr key={a.id} style={{ borderTop: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '0.875rem 1rem', fontWeight: 500, fontSize: '0.875rem' }}>{a.name}</td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', color: '#4b5563' }}>{a.email}</td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', color: '#4b5563' }}>{a.employee_id || '—'}</td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', color: '#4b5563' }}>{new Date(a.date_joined).toLocaleDateString()}</td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <span style={{ background: badge.bg, color: badge.color, padding: '0.2rem 0.65rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
                      {badge.label}
                    </span>
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <button onClick={() => openDetail(a.id)} style={{
                      background: '#eff6ff', color: '#1d4ed8', border: 'none', padding: '0.35rem 0.75rem',
                      borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', marginRight: '0.5rem', fontWeight: 500,
                    }}>View</button>
                    {a.account_status === 'pending' && (
                      <>
                        <button onClick={() => handleApprove(a.id)} style={{
                          background: '#d1fae5', color: '#065f46', border: 'none', padding: '0.35rem 0.75rem',
                          borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', marginRight: '0.5rem', fontWeight: 500,
                        }}>Approve</button>
                        <button onClick={() => { setSelected(a); setModal('reject'); }} style={{
                          background: '#fee2e2', color: '#991b1b', border: 'none', padding: '0.35rem 0.75rem',
                          borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 500,
                        }}>Reject</button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {modal === 'detail' && selected && (
        <Modal title="Applicant Details" onClose={() => setModal(null)}>
          <Detail label="Full Name" value={`${selected.firstname} ${selected.lastname}`} />
          <Detail label="Email" value={selected.email} />
          <Detail label="Employee ID" value={selected.employee_id || '—'} />
          <Detail label="Status" value={selected.account_status} />
          <Detail label="Date Applied" value={new Date(selected.date_joined).toLocaleString()} />
          {selected.approved_at && <Detail label="Approved At" value={new Date(selected.approved_at).toLocaleString()} />}
          {selected.approved_by && <Detail label="Approved By" value={selected.approved_by} />}
          {selected.rejection_reason && <Detail label="Rejection Reason" value={selected.rejection_reason} />}
          {selected.account_status === 'pending' && (
            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => handleApprove(selected.id)} style={{
                flex: 1, background: '#10b981', color: '#fff', border: 'none', padding: '0.75rem',
                borderRadius: '8px', fontWeight: 600, cursor: 'pointer',
              }}>Approve</button>
              <button onClick={() => setModal('reject')} style={{
                flex: 1, background: '#ef4444', color: '#fff', border: 'none', padding: '0.75rem',
                borderRadius: '8px', fontWeight: 600, cursor: 'pointer',
              }}>Reject</button>
            </div>
          )}
        </Modal>
      )}

      {/* Reject Modal */}
      {modal === 'reject' && selected && (
        <Modal title="Reject Application" onClose={() => setModal(null)}>
          <p style={{ color: '#4b5563', fontSize: '0.875rem', marginBottom: '1rem' }}>
            Rejecting: <strong>{selected.name || `${selected.firstname} ${selected.lastname}`}</strong>
          </p>
          <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>Reason (optional)</label>
          <textarea
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            rows={4}
            placeholder="Enter rejection reason..."
            style={{ width: '100%', marginTop: '0.5rem', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.875rem', resize: 'vertical', boxSizing: 'border-box' }}
          />
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
            <button onClick={handleReject} style={{
              flex: 1, background: '#ef4444', color: '#fff', border: 'none', padding: '0.75rem',
              borderRadius: '8px', fontWeight: 600, cursor: 'pointer',
            }}>Confirm Rejection</button>
            <button onClick={() => setModal(null)} style={{
              flex: 1, background: '#e5e7eb', color: '#374151', border: 'none', padding: '0.75rem',
              borderRadius: '8px', fontWeight: 600, cursor: 'pointer',
            }}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.625rem 0', borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: '0.875rem', color: '#1f2937', textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '480px', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1f2937' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '1.25rem' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}