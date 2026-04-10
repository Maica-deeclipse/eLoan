import { useState, useEffect } from 'react';
import amoService from '../../services/amo.service';

const STATUS_BADGE = {
  pending:  { bg: '#fef3c7', color: '#92400e', label: 'Pending' },
  approved: { bg: '#d1fae5', color: '#065f46', label: 'Approved' },
  rejected: { bg: '#fee2e2', color: '#991b1b', label: 'Rejected' },
};

const EMP_STATUS_LABELS = {
  regular:  'Regular',
  casual:   'Casual',
  job_order: 'Job Order',
  part_time: 'Part-time',
};

function fmtStatus(val) {
  return EMP_STATUS_LABELS[val] || val || '—';
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export default function EmploymentStatusRequests() {
  const [requests, setRequests]         = useState([]);
  const [filterStatus, setFilterStatus] = useState('pending');
  const [loading, setLoading]           = useState(true);
  const [actionMsg, setActionMsg]       = useState('');

  // Reject modal
  const [rejectTarget, setRejectTarget]   = useState(null);
  const [rejectReason, setRejectReason]   = useState('');
  const [rejecting, setRejecting]         = useState(false);

  // Approve loading per-row
  const [approvingId, setApprovingId]     = useState(null);

  useEffect(() => { fetchRequests(); }, [filterStatus]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await amoService.getEmploymentStatusRequests(filterStatus);
      setRequests(data.requests || []);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (req) => {
    setApprovingId(req.id);
    try {
      const res = await amoService.approveEmploymentStatusRequest(req.id);
      setActionMsg(res.message || 'Employment status change approved.');
      fetchRequests();
    } catch (err) {
      setActionMsg(err.response?.data?.error || 'Failed to approve request.');
    } finally {
      setApprovingId(null);
    }
  };

  const openRejectModal = (req) => {
    setRejectTarget(req);
    setRejectReason('');
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setRejecting(true);
    try {
      await amoService.rejectEmploymentStatusRequest(rejectTarget.id, rejectReason);
      setActionMsg('Employment status change request rejected.');
      setRejectTarget(null);
      fetchRequests();
    } catch (err) {
      setActionMsg(err.response?.data?.error || 'Failed to reject request.');
    } finally {
      setRejecting(false);
    }
  };

  const tabs = [
    { key: 'pending',  label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'all',      label: 'All' },
  ];

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e3a5f', marginBottom: '1.25rem' }}>
        Employment Status Requests
      </h2>

      {/* Success / error toast */}
      {actionMsg && (
        <div style={{
          background: '#d1fae5', color: '#065f46',
          padding: '0.75rem 1rem', borderRadius: 8,
          marginBottom: '1rem', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>{actionMsg}</span>
          <button
            onClick={() => setActionMsg('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: '#065f46' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setFilterStatus(t.key)}
            style={{
              padding: '0.4rem 1.1rem',
              borderRadius: 20,
              border: filterStatus === t.key ? 'none' : '1px solid #e5e7eb',
              background: filterStatus === t.key ? '#1e3a5f' : '#fff',
              color: filterStatus === t.key ? '#fff' : '#374151',
              fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ color: '#6b7280' }}>Loading…</p>
      ) : requests.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No requests found.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Applicant', 'Current Status', 'Requested Status', 'Date Submitted', 'COE', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {requests.map(req => {
                const badge = STATUS_BADGE[req.status] || STATUS_BADGE.pending;
                return (
                  <tr key={req.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ fontWeight: 600, color: '#1f2937' }}>{req.applicant_name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{req.applicant_email}</div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#374151' }}>{fmtStatus(req.current_status)}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#374151', fontWeight: 600 }}>{fmtStatus(req.requested_status)}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtDate(req.requested_at)}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {req.coe_document_url ? (
                        <a
                          href={req.coe_document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#2563eb', textDecoration: 'underline', fontWeight: 500 }}
                        >
                          View COE
                        </a>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{
                        background: badge.bg, color: badge.color,
                        padding: '0.2rem 0.65rem', borderRadius: 12,
                        fontSize: '0.75rem', fontWeight: 600,
                      }}>
                        {badge.label}
                      </span>
                      {req.status === 'rejected' && req.rejection_reason && (
                        <div style={{ fontSize: '0.7rem', color: '#991b1b', marginTop: 4, maxWidth: 160 }}>
                          {req.rejection_reason}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {req.status === 'pending' && (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => handleApprove(req)}
                            disabled={approvingId === req.id}
                            style={{
                              background: '#059669', color: '#fff',
                              border: 'none', borderRadius: 6,
                              padding: '0.35rem 0.85rem', cursor: 'pointer',
                              fontWeight: 600, fontSize: '0.8rem',
                              opacity: approvingId === req.id ? 0.6 : 1,
                            }}
                          >
                            {approvingId === req.id ? '…' : 'Approve'}
                          </button>
                          <button
                            onClick={() => openRejectModal(req)}
                            style={{
                              background: '#dc2626', color: '#fff',
                              border: 'none', borderRadius: 6,
                              padding: '0.35rem 0.85rem', cursor: 'pointer',
                              fontWeight: 600, fontSize: '0.8rem',
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {req.status === 'approved' && (
                        <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                          by {req.reviewed_by || '—'}<br />
                          {fmtDate(req.reviewed_at)}
                        </span>
                      )}
                      {req.status === 'rejected' && (
                        <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                          by {req.reviewed_by || '—'}<br />
                          {fmtDate(req.reviewed_at)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Reject Modal */}
      {rejectTarget && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15,28,82,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: '#fff', borderRadius: 16,
            padding: '1.5rem', width: '100%', maxWidth: 420,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e3a5f', marginBottom: '0.5rem' }}>
              Reject Status Change
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
              <strong>{rejectTarget.applicant_name}</strong> requested to change from{' '}
              <strong>{fmtStatus(rejectTarget.current_status)}</strong> to{' '}
              <strong>{fmtStatus(rejectTarget.requested_status)}</strong>.
            </p>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
              Reason (optional)
            </label>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Enter reason for rejection…"
              rows={3}
              style={{
                width: '100%', border: '1.5px solid #e5e7eb',
                borderRadius: 8, padding: '0.6rem 0.75rem',
                fontSize: '0.875rem', resize: 'vertical', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                onClick={() => setRejectTarget(null)}
                disabled={rejecting}
                style={{
                  background: 'none', border: '1px solid #e5e7eb',
                  borderRadius: 8, padding: '0.5rem 1.1rem',
                  cursor: 'pointer', color: '#374151', fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={rejecting}
                style={{
                  background: '#dc2626', color: '#fff',
                  border: 'none', borderRadius: 8,
                  padding: '0.5rem 1.25rem', cursor: 'pointer',
                  fontWeight: 600, opacity: rejecting ? 0.6 : 1,
                }}
              >
                {rejecting ? 'Rejecting…' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
