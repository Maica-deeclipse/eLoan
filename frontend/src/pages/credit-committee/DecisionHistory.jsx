import { useState, useEffect } from 'react';
import creditCommitteeService from '../../services/creditCommittee.service';

export default function DecisionHistory() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [decisions, setDecisions] = useState([]);
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    decision: '',
  });

  useEffect(() => {
    fetchDecisions();
  }, []);

  const fetchDecisions = async (filterParams = null) => {
    try {
      setLoading(true);
      const result = await creditCommitteeService.getDecisionHistory(filterParams || filters);
      setDecisions(result.decisions || []);
    } catch (err) {
      setError('Failed to load decision history');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleApplyFilters = () => {
    const activeFilters = Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v !== '')
    );
    fetchDecisions(activeFilters);
  };

  const handleClearFilters = () => {
    setFilters({ start_date: '', end_date: '', decision: '' });
    fetchDecisions({});
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <div style={{ textAlign: 'center', color: '#6b7280' }}>Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: '#fee2e2', color: '#dc2626', padding: '1rem', borderRadius: '0.5rem' }}>
        {error}
        <button onClick={() => fetchDecisions()} style={{ marginLeft: '1rem', textDecoration: 'underline' }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1f2937', marginBottom: '1.5rem' }}>
        Decision History
      </h1>

      {/* Filters */}
      <div style={{
        background: '#fff',
        borderRadius: '0.75rem',
        padding: '1rem 1.5rem',
        marginBottom: '1.5rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
              Start Date
            </label>
            <input
              type="date"
              name="start_date"
              value={filters.start_date}
              onChange={handleFilterChange}
              style={{
                padding: '0.5rem',
                borderRadius: '0.375rem',
                border: '1px solid #d1d5db',
                fontSize: '0.875rem',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
              End Date
            </label>
            <input
              type="date"
              name="end_date"
              value={filters.end_date}
              onChange={handleFilterChange}
              style={{
                padding: '0.5rem',
                borderRadius: '0.375rem',
                border: '1px solid #d1d5db',
                fontSize: '0.875rem',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
              Decision Type
            </label>
            <select
              name="decision"
              value={filters.decision}
              onChange={handleFilterChange}
              style={{
                padding: '0.5rem',
                borderRadius: '0.375rem',
                border: '1px solid #d1d5db',
                fontSize: '0.875rem',
                minWidth: '150px',
              }}
            >
              <option value="">All Decisions</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="returned">Returned</option>
            </select>
          </div>
          <button
            onClick={handleApplyFilters}
            style={{
              background: '#8b5cf6',
              color: '#fff',
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Apply Filters
          </button>
          <button
            onClick={handleClearFilters}
            style={{
              background: '#f3f4f6',
              color: '#374151',
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Decisions Table */}
      <div style={{ background: '#fff', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb' }}>
          <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>
            {decisions.length} decision(s) found
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={thStyle}>Application ID</th>
                <th style={thStyle}>Applicant</th>
                <th style={thStyle}>Loan Type</th>
                <th style={thStyle}>Amount</th>
                <th style={thStyle}>Decision</th>
                <th style={thStyle}>Remarks</th>
                <th style={thStyle}>Meeting Date</th>
                <th style={thStyle}>Committee Member</th>
                <th style={thStyle}>Decided At</th>
              </tr>
            </thead>
            <tbody>
              {decisions.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
                    No decisions found
                  </td>
                </tr>
              ) : (
                decisions.map((d) => (
                  <tr key={d.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 600 }}>#{d.application_id}</span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 500 }}>{d.applicant.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{d.applicant.email}</div>
                    </td>
                    <td style={tdStyle}>{d.loan_type}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>
                      &#8369;{parseFloat(d.amount_requested).toLocaleString()}
                    </td>
                    <td style={tdStyle}>
                      <DecisionBadge decision={d.decision} />
                    </td>
                    <td style={{ ...tdStyle, maxWidth: '200px' }}>
                      <div style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontSize: '0.75rem',
                        color: '#6b7280',
                      }}>
                        {d.remarks}
                      </div>
                    </td>
                    <td style={{ ...tdStyle, color: '#6b7280', fontSize: '0.875rem' }}>
                      {new Date(d.meeting_date).toLocaleDateString()}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{d.decided_by.name}</div>
                    </td>
                    <td style={{ ...tdStyle, color: '#6b7280', fontSize: '0.75rem' }}>
                      {new Date(d.decided_at).toLocaleString()}
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

function DecisionBadge({ decision }) {
  const styles = {
    approved: { background: '#d1fae5', color: '#065f46' },
    rejected: { background: '#fee2e2', color: '#991b1b' },
    returned: { background: '#dbeafe', color: '#1e40af' },
  };

  const labels = {
    approved: 'Approved',
    rejected: 'Rejected',
    returned: 'Returned',
  };

  return (
    <span style={{
      ...styles[decision],
      padding: '0.25rem 0.75rem',
      borderRadius: '9999px',
      fontSize: '0.75rem',
      fontWeight: 500,
    }}>
      {labels[decision]}
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
