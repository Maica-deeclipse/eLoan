import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import treasurerService from '../../services/treasurer.service';

export default function ForwardedApplications() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [applications, setApplications] = useState([]);

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const result = await treasurerService.getForwardedApplications();
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
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1f2937', margin: 0 }}>
          Forwarded Applications
        </h1>
        <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>
          {applications.length} application{applications.length !== 1 ? 's' : ''} pending evaluation
        </span>
      </div>

      <div style={{ background: '#fff', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={thStyle}>Borrower</th>
                <th style={thStyle}>Loan Type</th>
                <th style={thStyle}>Amount</th>
                <th style={thStyle}>Monthly Amortization</th>
                <th style={thStyle}>Term</th>
                <th style={thStyle}>Date Forwarded</th>
                <th style={thStyle}>Action</th>
              </tr>
            </thead>
            <tbody>
              {applications.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
                    <div style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>No applications pending evaluation</div>
                    <div style={{ fontSize: '0.875rem' }}>Applications verified by Bookkeeper will appear here</div>
                  </td>
                </tr>
              ) : (
                applications.map((app) => (
                  <tr key={app.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 500 }}>{app.applicant.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{app.applicant.email}</div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ background: '#d1fae5', color: '#065f46', padding: '0.25rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem' }}>
                        {app.loan_type}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>
                      &#8369;{parseFloat(app.amount_requested).toLocaleString()}
                    </td>
                    <td style={tdStyle}>
                      {app.monthly_amortization ? `₱${parseFloat(app.monthly_amortization).toLocaleString()}` : '-'}
                    </td>
                    <td style={tdStyle}>
                      {app.term_months} months
                    </td>
                    <td style={{ ...tdStyle, color: '#6b7280' }}>
                      {new Date(app.application_date).toLocaleDateString()}
                    </td>
                    <td style={tdStyle}>
                      <Link
                        to={`/treasurer/applications/${app.id}`}
                        style={{
                          background: '#10b981',
                          color: '#fff',
                          padding: '0.5rem 1rem',
                          borderRadius: '0.375rem',
                          fontSize: '0.875rem',
                          textDecoration: 'none',
                          display: 'inline-block',
                          fontWeight: 500,
                        }}
                      >
                        Evaluate
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
