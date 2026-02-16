import { useState, useEffect } from 'react';
import treasurerService from '../../services/treasurer.service';

export default function PaymentRecords() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loans, setLoans] = useState([]);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Payment form state
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchLoans();
  }, []);

  const fetchLoans = async () => {
    try {
      setLoading(true);
      const result = await treasurerService.getDisbursedLoans();
      setLoans(result.loans || []);
    } catch (err) {
      setError('Failed to load loans');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentHistory = async (loanId) => {
    try {
      const result = await treasurerService.getPaymentHistory(loanId);
      setPaymentHistory(result.payments || []);
      const loan = loans.find(l => l.id === loanId);
      setSelectedLoan({ ...loan, ...result.loan });
    } catch (err) {
      console.error(err);
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await treasurerService.recordPayment(selectedLoan.id, amount, paymentMethod, remarks);

      setSuccess('Payment recorded successfully');
      setShowPaymentModal(false);
      setAmount('');
      setRemarks('');

      // Refresh data
      await fetchLoans();
      await fetchPaymentHistory(selectedLoan.id);

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record payment');
    } finally {
      setSubmitting(false);
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

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1f2937', marginBottom: '1.5rem' }}>
        Payment Records
      </h1>

      {error && (
        <div style={{ background: '#fee2e2', color: '#dc2626', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: '1rem', textDecoration: 'underline' }}>Dismiss</button>
        </div>
      )}

      {success && (
        <div style={{ background: '#d1fae5', color: '#065f46', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
          {success}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selectedLoan ? '1fr 1fr' : '1fr', gap: '1.5rem' }}>
        {/* Loans List */}
        <div style={{ background: '#fff', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1f2937', margin: 0 }}>
              Disbursed Loans ({loans.length})
            </h2>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={thStyle}>Borrower</th>
                  <th style={thStyle}>Loan Type</th>
                  <th style={thStyle}>Total Payable</th>
                  <th style={thStyle}>Remaining</th>
                  <th style={thStyle}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loans.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                      No disbursed loans
                    </td>
                  </tr>
                ) : (
                  loans.map((loan) => (
                    <tr
                      key={loan.id}
                      style={{
                        borderBottom: '1px solid #e5e7eb',
                        background: selectedLoan?.id === loan.id ? '#f0fdf4' : 'transparent',
                        cursor: 'pointer',
                      }}
                      onClick={() => fetchPaymentHistory(loan.id)}
                    >
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 500 }}>{loan.borrower.name}</div>
                      </td>
                      <td style={tdStyle}>{loan.loan_type}</td>
                      <td style={tdStyle}>₱{parseFloat(loan.total_payable).toLocaleString()}</td>
                      <td style={tdStyle}>
                        <span style={{
                          color: parseFloat(loan.remaining_balance) === 0 ? '#10b981' : '#dc2626',
                          fontWeight: 600,
                        }}>
                          ₱{parseFloat(loan.remaining_balance).toLocaleString()}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            fetchPaymentHistory(loan.id);
                            setShowPaymentModal(true);
                          }}
                          style={{
                            background: '#10b981',
                            color: '#fff',
                            padding: '0.375rem 0.75rem',
                            borderRadius: '0.375rem',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                          }}
                        >
                          Add Payment
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment History */}
        {selectedLoan && (
          <div style={{ background: '#fff', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1f2937', margin: 0 }}>
                Payment History - {selectedLoan.borrower}
              </h2>
              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem', fontSize: '0.875rem' }}>
                <span>Total: ₱{parseFloat(selectedLoan.total_payable).toLocaleString()}</span>
                <span>Paid: ₱{parseFloat(selectedLoan.total_paid).toLocaleString()}</span>
                <span style={{ color: '#10b981', fontWeight: 600 }}>
                  Balance: ₱{parseFloat(selectedLoan.remaining_balance).toLocaleString()}
                </span>
              </div>
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {paymentHistory.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                  No payments recorded yet
                </div>
              ) : (
                paymentHistory.map((payment) => (
                  <div key={payment.id} style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, color: '#10b981' }}>
                        +₱{parseFloat(payment.amount).toLocaleString()}
                      </span>
                      <span style={{
                        fontSize: '0.75rem',
                        padding: '0.25rem 0.5rem',
                        background: '#e0e7ff',
                        color: '#3730a3',
                        borderRadius: '9999px',
                      }}>
                        {payment.payment_method}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                      {new Date(payment.payment_date).toLocaleDateString()} - by {payment.recorded_by}
                    </div>
                    {payment.remarks && (
                      <div style={{ fontSize: '0.75rem', color: '#1f2937', marginTop: '0.25rem', fontStyle: 'italic' }}>
                        "{payment.remarks}"
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedLoan && (
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
          zIndex: 1000,
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '0.75rem',
            width: '100%',
            maxWidth: '400px',
            padding: '1.5rem',
          }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
              Record Payment
            </h3>
            <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f9fafb', borderRadius: '0.375rem' }}>
              <div style={{ fontWeight: 500 }}>{selectedLoan.borrower}</div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                Balance: ₱{parseFloat(selectedLoan.remaining_balance).toLocaleString()}
              </div>
            </div>

            <form onSubmit={handleRecordPayment}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Amount *</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }}>₱</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    style={{ ...inputStyle, paddingLeft: '1.75rem' }}
                    required
                    min="0.01"
                    step="0.01"
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Payment Method *</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={inputStyle}
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Payroll Deduction">Payroll Deduction</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={labelStyle}>Remarks (Optional)</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Add any notes..."
                  style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowPaymentModal(false);
                    setAmount('');
                    setRemarks('');
                  }}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: submitting ? '#9ca3af' : '#10b981',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {submitting ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
  width: '100%',
  padding: '0.625rem 0.75rem',
  border: '1px solid #d1d5db',
  borderRadius: '0.375rem',
  fontSize: '0.875rem',
  outline: 'none',
  boxSizing: 'border-box',
};
