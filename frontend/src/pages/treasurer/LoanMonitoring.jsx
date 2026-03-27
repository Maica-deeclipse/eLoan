import { useState, useEffect } from 'react';
import treasurerService from '../../services/treasurer.service';

export default function LoanMonitoring() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loans, setLoans] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchLoans();
  }, []);

  const fetchLoans = async () => {
    try {
      setLoading(true);
      const result = await treasurerService.getLoansForMonitoring();
      setLoans(result.loans || []);
    } catch (err) {
      setError('Failed to load loans');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Disbursed':
      case 'Active':
        return { bg: '#dbeafe', color: '#1e40af' };
      case 'Overdue':
        return { bg: '#fee2e2', color: '#dc2626' };
      case 'Paid':
        return { bg: '#d1fae5', color: '#065f46' };
      default:
        return { bg: '#f3f4f6', color: '#6b7280' };
    }
  };

  const filteredLoans = loans.filter(loan => {
    if (filter === 'all') return true;
    if (filter === 'active') return ['Disbursed', 'Active'].includes(loan.status);
    if (filter === 'overdue') return loan.status === 'Overdue';
    if (filter === 'paid') return loan.status === 'Paid';
    return true;
  });

  // Calculate summary stats
  const stats = {
    total: loans.length,
    active: loans.filter(l => ['Disbursed', 'Active'].includes(l.status)).length,
    overdue: loans.filter(l => l.status === 'Overdue').length,
    paid: loans.filter(l => l.status === 'Paid').length,
    totalOutstanding: loans.reduce((sum, l) => sum + parseFloat(l.remaining_balance || 0), 0),
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
        <button onClick={fetchLoans} style={{ marginLeft: '1rem', textDecoration: 'underline' }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1f2937', marginBottom: '1.5rem' }}>
        Loan Monitoring
      </h1>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <SummaryCard label="Total Loans" value={stats.total} color="#17236a" />
        <SummaryCard label="Active" value={stats.active} color="#3b82f6" />
        <SummaryCard label="Overdue" value={stats.overdue} color="#ef4444" />
        <SummaryCard label="Fully Paid" value={stats.paid} color="#10b981" />
        <SummaryCard
          label="Total Outstanding"
          value={`₱${stats.totalOutstanding.toLocaleString()}`}
          color="#f59e0b"
        />
      </div>

      {/* Filter Tabs */}
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
        {['all', 'active', 'overdue', 'paid'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: 'none',
              background: filter === f ? '#10b981' : '#f3f4f6',
              color: filter === f ? '#fff' : '#374151',
              cursor: 'pointer',
              textTransform: 'capitalize',
              fontWeight: 500,
            }}
          >
            {f} ({f === 'all' ? stats.total : f === 'active' ? stats.active : f === 'overdue' ? stats.overdue : stats.paid})
          </button>
        ))}
      </div>

      {/* Loans Table */}
      <div style={{ background: '#fff', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={thStyle}>Borrower</th>
                <th style={thStyle}>Loan Type</th>
                <th style={thStyle}>Original Amount</th>
                <th style={thStyle}>Total Paid</th>
                <th style={thStyle}>Remaining Balance</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredLoans.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                    No loans found
                  </td>
                </tr>
              ) : (
                filteredLoans.map((loan) => {
                  const statusStyle = getStatusColor(loan.status);
                  const progressPercent = parseFloat(loan.total_payable) > 0
                    ? (parseFloat(loan.total_paid) / parseFloat(loan.total_payable)) * 100
                    : 0;

                  return (
                    <tr key={loan.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 500 }}>{loan.borrower.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{loan.borrower.email}</div>
                      </td>
                      <td style={tdStyle}>{loan.loan_type}</td>
                      <td style={tdStyle}>₱{parseFloat(loan.original_amount).toLocaleString()}</td>
                      <td style={tdStyle}>
                        <div>₱{parseFloat(loan.total_paid).toLocaleString()}</div>
                        <div style={{
                          width: '100px',
                          height: '4px',
                          background: '#e5e7eb',
                          borderRadius: '2px',
                          marginTop: '0.25rem',
                        }}>
                          <div style={{
                            width: `${Math.min(progressPercent, 100)}%`,
                            height: '100%',
                            background: '#10b981',
                            borderRadius: '2px',
                          }} />
                        </div>
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>
                        <span style={{ color: parseFloat(loan.remaining_balance) === 0 ? '#10b981' : '#dc2626' }}>
                          ₱{parseFloat(loan.remaining_balance).toLocaleString()}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          background: statusStyle.bg,
                          color: statusStyle.color,
                        }}>
                          {loan.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: '0.75rem',
      padding: '1rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      borderLeft: `4px solid ${color}`,
    }}>
      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1f2937' }}>{value}</div>
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
