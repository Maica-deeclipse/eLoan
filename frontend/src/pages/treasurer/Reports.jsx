import { useState, useEffect } from 'react';
import treasurerService from '../../services/treasurer.service';

export default function Reports() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reportType, setReportType] = useState('disbursement');
  const [reportData, setReportData] = useState(null);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loanType, setLoanType] = useState('');
  const [loanTypes, setLoanTypes] = useState([]);

  useEffect(() => {
    fetchReport();
  }, [reportType]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);

      const filters = {};
      if (startDate) filters.start_date = startDate;
      if (endDate) filters.end_date = endDate;
      if (loanType) filters.loan_type = loanType;

      const result = await treasurerService.getReport(reportType, filters);
      setReportData(result);
      if (result.loan_types) {
        setLoanTypes(result.loan_types);
      }
    } catch (err) {
      setError('Failed to load report');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = (e) => {
    e.preventDefault();
    fetchReport();
  };

  const renderReport = () => {
    if (!reportData) return null;

    if (reportType === 'disbursement') {
      return (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
            <StatCard label="Total Disbursed" value={`₱${parseFloat(reportData.total_amount || 0).toLocaleString()}`} />
            <StatCard label="Number of Loans" value={reportData.count || 0} />
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={thStyle}>Borrower</th>
                <th style={thStyle}>Loan Type</th>
                <th style={thStyle}>Amount</th>
                <th style={thStyle}>Date</th>
              </tr>
            </thead>
            <tbody>
              {(reportData.loans || []).map((loan) => (
                <tr key={loan.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={tdStyle}>{loan.borrower}</td>
                  <td style={tdStyle}>{loan.loan_type}</td>
                  <td style={tdStyle}>₱{parseFloat(loan.amount).toLocaleString()}</td>
                  <td style={tdStyle}>{loan.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (reportType === 'collection') {
      return (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
            <StatCard label="Total Collected" value={`₱${parseFloat(reportData.total_collected || 0).toLocaleString()}`} />
            <StatCard label="Number of Payments" value={reportData.count || 0} />
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={thStyle}>Borrower</th>
                <th style={thStyle}>Loan Type</th>
                <th style={thStyle}>Amount</th>
                <th style={thStyle}>Method</th>
                <th style={thStyle}>Date</th>
              </tr>
            </thead>
            <tbody>
              {(reportData.payments || []).map((payment) => (
                <tr key={payment.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={tdStyle}>{payment.borrower}</td>
                  <td style={tdStyle}>{payment.loan_type}</td>
                  <td style={tdStyle}>₱{parseFloat(payment.amount).toLocaleString()}</td>
                  <td style={tdStyle}>{payment.method}</td>
                  <td style={tdStyle}>{payment.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (reportType === 'outstanding') {
      return (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
            <StatCard label="Total Outstanding" value={`₱${parseFloat(reportData.total_outstanding || 0).toLocaleString()}`} />
            <StatCard label="Number of Loans" value={reportData.count || 0} />
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={thStyle}>Borrower</th>
                <th style={thStyle}>Loan Type</th>
                <th style={thStyle}>Original Amount</th>
                <th style={thStyle}>Paid</th>
                <th style={thStyle}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {(reportData.loans || []).map((loan) => (
                <tr key={loan.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={tdStyle}>{loan.borrower}</td>
                  <td style={tdStyle}>{loan.loan_type}</td>
                  <td style={tdStyle}>₱{parseFloat(loan.original_amount).toLocaleString()}</td>
                  <td style={tdStyle}>₱{parseFloat(loan.total_paid).toLocaleString()}</td>
                  <td style={{ ...tdStyle, fontWeight: 600, color: '#dc2626' }}>
                    ₱{parseFloat(loan.remaining_balance).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return null;
  };

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1f2937', marginBottom: '1.5rem' }}>
        Reports
      </h1>

      {/* Report Type Tabs */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem' }}>
        {[
          { key: 'disbursement', label: 'Disbursement Report' },
          { key: 'collection', label: 'Collection Report' },
          { key: 'outstanding', label: 'Outstanding Loans' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setReportType(tab.key)}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '0.375rem',
              border: 'none',
              background: reportType === tab.key ? '#10b981' : '#f3f4f6',
              color: reportType === tab.key ? '#fff' : '#374151',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ background: '#fff', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <form onSubmit={handleApplyFilters} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={labelStyle}>Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Loan Type</label>
            <select
              value={loanType}
              onChange={(e) => setLoanType(e.target.value)}
              style={inputStyle}
            >
              <option value="">All Types</option>
              {loanTypes.map((lt) => (
                <option key={lt.id} value={lt.id}>{lt.loan_name}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            style={{
              padding: '0.625rem 1.25rem',
              background: '#10b981',
              color: '#fff',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Apply Filters
          </button>
          <button
            type="button"
            onClick={() => {
              setStartDate('');
              setEndDate('');
              setLoanType('');
              fetchReport();
            }}
            style={{
              padding: '0.625rem 1.25rem',
              background: '#f3f4f6',
              color: '#374151',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        </form>
      </div>

      {/* Report Content */}
      <div style={{ background: '#fff', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1f2937', margin: 0 }}>
            {reportType === 'disbursement' && 'Disbursement Report'}
            {reportType === 'collection' && 'Collection Report'}
            {reportType === 'outstanding' && 'Outstanding Loans Report'}
          </h2>
        </div>
        <div style={{ padding: '1rem 1.5rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>Loading...</div>
          ) : error ? (
            <div style={{ background: '#fee2e2', color: '#dc2626', padding: '1rem', borderRadius: '0.5rem' }}>
              {error}
            </div>
          ) : (
            renderReport()
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={{
      background: '#f9fafb',
      borderRadius: '0.5rem',
      padding: '1rem',
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

const labelStyle = {
  display: 'block',
  fontSize: '0.875rem',
  fontWeight: 500,
  color: '#374151',
  marginBottom: '0.375rem',
};

const inputStyle = {
  padding: '0.625rem 0.75rem',
  border: '1px solid #d1d5db',
  borderRadius: '0.375rem',
  fontSize: '0.875rem',
  outline: 'none',
  minWidth: '150px',
};
