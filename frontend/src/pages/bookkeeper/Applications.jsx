import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import bookkeeperService from '../../services/bookkeeper.service';

export default function Applications() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [applications, setApplications] = useState([]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const result = await bookkeeperService.getApplications();
      setApplications(result.applications);
      setCount(result.count);
    } catch (err) {
      setError('Failed to load applications');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <div style={{ textAlign: 'center', color: '#6b7280' }}>Loading applications...</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1f2937', margin: 0 }}>
          Loan Applications
        </h1>
        <button
          onClick={fetchApplications}
          style={{
            background: '#f3f4f6',
            border: '1px solid #d1d5db',
            padding: '0.5rem 1rem',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          &#8635; Refresh
        </button>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#dc2626', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1f2937', margin: 0 }}>
            Submitted Applications
            <span style={{
              marginLeft: '0.5rem',
              background: '#fef3c7',
              color: '#92400e',
              padding: '0.25rem 0.5rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
            }}>
              {count} Pending
            </span>
          </h2>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Applicant</th>
                <th style={thStyle}>Loan Type</th>
                <th style={thStyle}>Amount</th>
                <th style={thStyle}>Term</th>
                <th style={thStyle}>Date Submitted</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Action</th>
              </tr>
            </thead>
            <tbody>
              {applications.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>&#128229;</div>
                    <h3 style={{ margin: 0, marginBottom: '0.5rem' }}>No Pending Applications</h3>
                    <p style={{ margin: 0, fontSize: '0.875rem' }}>All submitted applications have been reviewed.</p>
                  </td>
                </tr>
              ) : (
                applications.map((app) => (
                  <tr key={app.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={tdStyle}>
                      <span style={{ background: '#f3f4f6', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem' }}>
                        #{app.id}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          background: '#17236a',
                          color: '#fff',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                        }}>
                          {app.applicant.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500 }}>{app.applicant.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{app.applicant.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        background: '#e0e7ff',
                        color: '#3730a3',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                      }}>
                        {app.loan_type}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>
                      &#8369;{parseFloat(app.amount_requested).toLocaleString()}
                    </td>
                    <td style={tdStyle}>{app.term_months} months</td>
                    <td style={tdStyle}>
                      <div>{formatDate(app.application_date)}</div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{formatTime(app.application_date)}</div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        background: '#fef3c7',
                        color: '#92400e',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                      }}>
                        {app.status}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <Link
                        to={`/bookkeeper/applications/${app.id}`}
                        style={{
                          background: '#17236a',
                          color: '#fff',
                          padding: '0.5rem 1rem',
                          borderRadius: '0.375rem',
                          fontSize: '0.875rem',
                          textDecoration: 'none',
                          display: 'inline-block',
                        }}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Status Legend */}
      <div style={{ marginTop: '1.5rem', background: '#fff', borderRadius: '0.75rem', padding: '1rem 1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', color: '#374151' }}>
          Status Legend
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
          <LegendItem color="#fef3c7" textColor="#92400e" label="Submitted" description="Awaiting your review" />
          <LegendItem color="#d1fae5" textColor="#065f46" label="Verified" description="Forwarded to Treasurer" />
          <LegendItem color="#fee2e2" textColor="#991b1b" label="Rejected" description="Application declined" />
        </div>
      </div>
    </div>
  );
}

function LegendItem({ color, textColor, label, description }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <span style={{
        background: color,
        color: textColor,
        padding: '0.25rem 0.75rem',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: 500,
      }}>
        {label}
      </span>
      <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>{description}</span>
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

function formatTime(dateString) {
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
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
