import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import creditCommitteeService from '../../services/creditCommittee.service';

export default function Applications() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [applications, setApplications] = useState([]);

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const result = await creditCommitteeService.getApplications();
      setApplications(result.applications || []);
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
        <div style={{ textAlign: 'center', color: '#6b7280' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: '#fee2e2', color: '#dc2626', padding: '1rem', borderRadius: '0.5rem' }}>
        {error}
        <button onClick={fetchApplications} style={{ marginLeft: '1rem', textDecoration: 'underline' }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1f2937' }}>
          Applications for Decision
        </h1>
        <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>
          {applications.length} pending
        </span>
      </div>

      <div style={{ background: '#fff', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Applicant</th>
                <th style={thStyle}>Loan Type</th>
                <th style={thStyle}>Amount</th>
                <th style={thStyle}>DTI Ratio</th>
                <th style={thStyle}>Risk Level</th>
                <th style={thStyle}>Bookkeeper</th>
                <th style={thStyle}>Treasurer</th>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Action</th>
              </tr>
            </thead>
            <tbody>
              {applications.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>&#128203;</div>
                    <div style={{ fontSize: '1.125rem', fontWeight: 500 }}>No Applications Pending</div>
                    <div style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                      All applications have been processed
                    </div>
                  </td>
                </tr>
              ) : (
                applications.map((app) => (
                  <tr key={app.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 600 }}>#{app.id}</span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 500 }}>{app.applicant.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{app.applicant.email}</div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        background: '#ede9fe',
                        color: '#7c3aed',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem'
                      }}>
                        {app.loan_type}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>
                      &#8369;{parseFloat(app.amount_requested).toLocaleString()}
                    </td>
                    <td style={tdStyle}>
                      {app.dti_ratio ? `${parseFloat(app.dti_ratio).toFixed(1)}%` : 'N/A'}
                    </td>
                    <td style={tdStyle}>
                      <RiskBadge level={app.risk_level} />
                    </td>
                    <td style={tdStyle}>
                      <StatusBadge status={app.bookkeeper_status} color="green" />
                    </td>
                    <td style={tdStyle}>
                      <StatusBadge status={app.treasurer_status} color="blue" />
                    </td>
                    <td style={{ ...tdStyle, color: '#6b7280', fontSize: '0.875rem' }}>
                      {new Date(app.application_date).toLocaleDateString()}
                    </td>
                    <td style={tdStyle}>
                      <Link
                        to={`/credit-committee/applications/${app.id}`}
                        style={{
                          background: '#8b5cf6',
                          color: '#fff',
                          padding: '0.5rem 1rem',
                          borderRadius: '0.375rem',
                          fontSize: '0.875rem',
                          textDecoration: 'none',
                          display: 'inline-block',
                          fontWeight: 500,
                        }}
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RiskBadge({ level }) {
  const styles = {
    Low: { background: '#d1fae5', color: '#065f46' },
    Medium: { background: '#fef3c7', color: '#92400e' },
    High: { background: '#fee2e2', color: '#991b1b' },
  };

  return (
    <span style={{
      ...styles[level] || styles.Medium,
      padding: '0.25rem 0.75rem',
      borderRadius: '9999px',
      fontSize: '0.75rem',
      fontWeight: 500,
    }}>
      {level}
    </span>
  );
}

function StatusBadge({ status, color }) {
  const colors = {
    green: { background: '#d1fae5', color: '#065f46' },
    blue: { background: '#dbeafe', color: '#1e40af' },
  };

  return (
    <span style={{
      ...colors[color],
      padding: '0.25rem 0.5rem',
      borderRadius: '9999px',
      fontSize: '0.75rem',
      fontWeight: 500,
    }}>
      &#10004; {status}
    </span>
  );
}

const thStyle = {
  padding: '0.75rem 1rem',
  textAlign: 'left',
  fontSize: '0.75rem',
  fontWeight: 500,
  color: '#6b7280',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '0.75rem 1rem',
  fontSize: '0.875rem',
};
