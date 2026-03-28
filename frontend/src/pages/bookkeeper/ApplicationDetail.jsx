import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import bookkeeperService from '../../services/bookkeeper.service';

export default function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchApplication();
  }, [id]);

  const fetchApplication = async () => {
    try {
      setLoading(true);
      const result = await bookkeeperService.getApplication(id);
      setData(result);
    } catch (err) {
      setError('Failed to load application');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!window.confirm('Are you sure you want to verify this application?')) return;

    try {
      setProcessing(true);
      await bookkeeperService.verifyApplication(id, notes);
      alert('Application verified successfully!');
      navigate('/bookkeeper/applications');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to verify application');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    try {
      setProcessing(true);
      await bookkeeperService.rejectApplication(id, rejectionReason, notes);
      alert('Application rejected successfully!');
      navigate('/bookkeeper/applications');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reject application');
    } finally {
      setProcessing(false);
      setShowRejectModal(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <div style={{ textAlign: 'center', color: '#6b7280' }}>Loading application...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ background: '#fee2e2', color: '#dc2626', padding: '1rem', borderRadius: '0.5rem' }}>
        {error || 'Application not found'}
        <Link to="/bookkeeper/applications" style={{ marginLeft: '1rem', textDecoration: 'underline' }}>
          Back to Applications
        </Link>
      </div>
    );
  }

  const { application, documents, comakers, verification_history, can_review } = data;

  return (
    <div>
      {/* Back Button */}
      <Link
        to="/bookkeeper/applications"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          color: '#6b7280',
          textDecoration: 'none',
          marginBottom: '1rem',
        }}
      >
        &larr; Back to Applications
      </Link>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        {/* Main Content */}
        <div>
          {/* Application Info */}
          <Card title={`Application #${application.id}`} badge={application.status}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              <div>
                <h4 style={{ color: '#6b7280', marginBottom: '1rem', fontSize: '0.875rem' }}>Loan Information</h4>
                <InfoRow label="Loan Type" value={application.loan_type.name} />
                <InfoRow label="Amount Requested" value={`&#8369;${parseFloat(application.amount_requested).toLocaleString()}`} highlight />
                <InfoRow label="Term" value={`${application.term_months} months`} />
                <InfoRow label="Monthly Amortization" value={application.monthly_amortization ? `&#8369;${parseFloat(application.monthly_amortization).toLocaleString()}` : 'N/A'} />
                <InfoRow label="Total Payable" value={application.total_payable ? `&#8369;${parseFloat(application.total_payable).toLocaleString()}` : 'N/A'} />
                <InfoRow label="Interest Rate" value={`${application.loan_type.interest_rate}%`} />
              </div>
              <div>
                <h4 style={{ color: '#6b7280', marginBottom: '1rem', fontSize: '0.875rem' }}>Application Details</h4>
                <InfoRow label="Application Date" value={formatDateTime(application.application_date)} />
                <InfoRow label="Purpose" value={application.purpose || 'Not specified'} />
              </div>
            </div>
          </Card>

          {/* Applicant Info */}
          <Card title="Applicant Information" style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{
                width: '60px',
                height: '60px',
                background: '#6366f1',
                color: '#fff',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                fontSize: '1.5rem',
              }}>
                {application.applicant.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{application.applicant.name}</h3>
                <div style={{ color: '#6b7280' }}>{application.applicant.email}</div>
              </div>
            </div>
            <InfoRow label="Account Status">
              <span style={{
                background: application.applicant.status === 'active' ? '#d1fae5' : '#fee2e2',
                color: application.applicant.status === 'active' ? '#065f46' : '#991b1b',
                padding: '0.25rem 0.5rem',
                borderRadius: '0.25rem',
                fontSize: '0.75rem',
              }}>
                {application.applicant.status}
              </span>
            </InfoRow>
            <InfoRow label="Member Since" value={formatDate(application.applicant.date_joined)} />
          </Card>

          {/* Documents */}
          <Card title="Uploaded Documents" badge={`${documents.length} files`} style={{ marginTop: '1.5rem' }}>
            {documents.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                No documents uploaded
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    <th style={thStyle}>Document Type</th>
                    <th style={thStyle}>Uploaded</th>
                    <th style={thStyle}>Verified</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => {
                    const mediaBase = new URL(import.meta.env.VITE_API_URL || 'http://localhost:8000').origin;
                    const fileUrl = `${mediaBase}/media/${doc.file_path}`;
                    return (
                      <tr
                        key={doc.id}
                        onClick={() => window.open(fileUrl, '_blank')}
                        style={{ borderBottom: '1px solid #e5e7eb', cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f0f9ff')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}
                        title="Click to open document"
                      >
                        <td style={tdStyle}>&#128196; {doc.document_type}</td>
                        <td style={tdStyle}>{formatDateTime(doc.uploaded_at)}</td>
                        <td style={tdStyle}>
                          <span style={{
                            background: doc.verified ? '#d1fae5' : '#fef3c7',
                            color: doc.verified ? '#065f46' : '#92400e',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '0.25rem',
                            fontSize: '0.75rem',
                          }}>
                            {doc.verified ? 'Verified' : 'Pending'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>

          {/* Co-makers */}
          {comakers.length > 0 && (
            <Card title="Co-makers" style={{ marginTop: '1.5rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    <th style={thStyle}>Name</th>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Agreed At</th>
                  </tr>
                </thead>
                <tbody>
                  {comakers.map((cm) => (
                    <tr key={cm.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={tdStyle}>{cm.name}</td>
                      <td style={tdStyle}>{cm.email}</td>
                      <td style={tdStyle}>{formatDateTime(cm.agreed_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {/* Verification History */}
          {verification_history.length > 0 && (
            <Card title="Verification History" style={{ marginTop: '1.5rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    <th style={thStyle}>Action</th>
                    <th style={thStyle}>Verified By</th>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {verification_history.map((v) => (
                    <tr key={v.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={tdStyle}>
                        <span style={{
                          background: v.action === 'verified' ? '#d1fae5' : '#fee2e2',
                          color: v.action === 'verified' ? '#065f46' : '#991b1b',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                        }}>
                          {v.action === 'verified' ? 'Verified' : 'Rejected'}
                        </span>
                      </td>
                      <td style={tdStyle}>{v.verified_by}</td>
                      <td style={tdStyle}>{formatDateTime(v.verified_at)}</td>
                      <td style={tdStyle}>
                        {v.rejection_reason && <><strong>Reason:</strong> {v.rejection_reason}<br /></>}
                        {v.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div>
          {can_review ? (
            <>
              {/* Verify Card */}
              <Card title="Verify Application" headerColor="#10b981">
                <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem' }}>
                  Verifying this application will forward it to the Treasurer for further review.
                </p>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                    Notes (Optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any notes for the Treasurer..."
                    rows={2}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      resize: 'none',
                    }}
                  />
                </div>
                <button
                  onClick={handleVerify}
                  disabled={processing}
                  style={{
                    width: '100%',
                    background: '#10b981',
                    color: '#fff',
                    padding: '0.75rem',
                    border: 'none',
                    borderRadius: '0.375rem',
                    fontWeight: 600,
                    cursor: processing ? 'not-allowed' : 'pointer',
                    opacity: processing ? 0.7 : 1,
                  }}
                >
                  {processing ? 'Processing...' : '&#10004; Verify & Forward to Treasurer'}
                </button>
              </Card>

              {/* Reject Card */}
              <Card title="Reject Application" headerColor="#ef4444" style={{ marginTop: '1rem' }}>
                <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem' }}>
                  Rejecting will notify the applicant with your rejection reason.
                </p>
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={processing}
                  style={{
                    width: '100%',
                    background: '#ef4444',
                    color: '#fff',
                    padding: '0.75rem',
                    border: 'none',
                    borderRadius: '0.375rem',
                    fontWeight: 600,
                    cursor: processing ? 'not-allowed' : 'pointer',
                    opacity: processing ? 0.7 : 1,
                  }}
                >
                  &#10006; Reject Application
                </button>
              </Card>
            </>
          ) : (
            <Card title="Application Status">
              <div style={{ textAlign: 'center', padding: '1rem' }}>
                {application.status.includes('Verified') ? (
                  <>
                    <div style={{ fontSize: '3rem', color: '#10b981' }}>&#10004;</div>
                    <h4 style={{ color: '#10b981', marginTop: '0.5rem' }}>Verified</h4>
                    <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                      This application has been verified and forwarded to the Treasurer.
                    </p>
                  </>
                ) : application.status.includes('Rejected') ? (
                  <>
                    <div style={{ fontSize: '3rem', color: '#ef4444' }}>&#10006;</div>
                    <h4 style={{ color: '#ef4444', marginTop: '0.5rem' }}>Rejected</h4>
                    <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                      This application has been rejected.
                    </p>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: '3rem', color: '#f59e0b' }}>&#9203;</div>
                    <h4 style={{ color: '#f59e0b', marginTop: '0.5rem' }}>{application.status}</h4>
                    <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                      This application is currently being processed.
                    </p>
                  </>
                )}
              </div>
            </Card>
          )}

          {/* Quick Info */}
          <Card title="Quick Info" style={{ marginTop: '1rem' }}>
            <InfoRow label="Loan Type" value={application.loan_type.name} />
            <InfoRow label="Amount" value={`&#8369;${parseFloat(application.amount_requested).toLocaleString()}`} />
            <InfoRow label="Term" value={`${application.term_months} months`} />
            <InfoRow label="Documents" value={`${documents.length} files`} />
            <InfoRow label="Submitted" value={formatTimeAgo(application.application_date)} />
          </Card>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '0.75rem',
            width: '100%',
            maxWidth: '500px',
            padding: '1.5rem',
          }}>
            <h3 style={{ margin: '0 0 1rem', color: '#ef4444' }}>Reject Application</h3>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.5rem' }}>
                Rejection Reason <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Provide a clear reason for rejection..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  resize: 'none',
                }}
                required
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.5rem' }}>
                Additional Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal notes..."
                rows={2}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  resize: 'none',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setShowRejectModal(false)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  background: '#fff',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={processing}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0.375rem',
                  fontWeight: 600,
                  cursor: processing ? 'not-allowed' : 'pointer',
                  opacity: processing ? 0.7 : 1,
                }}
              >
                {processing ? 'Processing...' : 'Reject Application'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ title, badge, headerColor, children, style }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: '0.75rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      overflow: 'hidden',
      ...style,
    }}>
      <div style={{
        padding: '1rem 1.5rem',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: headerColor ? headerColor : undefined,
        color: headerColor ? '#fff' : undefined,
      }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{title}</h3>
        {badge && (
          <span style={{
            background: headerColor ? 'rgba(255,255,255,0.2)' : '#f3f4f6',
            padding: '0.25rem 0.5rem',
            borderRadius: '0.25rem',
            fontSize: '0.75rem',
          }}>
            {badge}
          </span>
        )}
      </div>
      <div style={{ padding: '1rem 1.5rem' }}>{children}</div>
    </div>
  );
}

function InfoRow({ label, value, highlight, children }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '0.5rem 0',
      borderBottom: '1px solid #f3f4f6',
    }}>
      <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>{label}</span>
      {children || (
        <span
          style={{
            fontWeight: highlight ? 700 : 500,
            color: highlight ? '#6366f1' : '#1f2937',
            fontSize: highlight ? '1.125rem' : '0.875rem',
          }}
          dangerouslySetInnerHTML={{ __html: value }}
        />
      )}
    </div>
  );
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(dateString) {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const thStyle = {
  padding: '0.75rem 1rem',
  textAlign: 'left',
  fontSize: '0.75rem',
  fontWeight: 500,
  color: '#6b7280',
  textTransform: 'uppercase',
};

const tdStyle = {
  padding: '0.75rem 1rem',
  fontSize: '0.875rem',
};
