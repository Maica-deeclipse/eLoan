import { useState, useEffect, useRef } from 'react';
import treasurerService from '../../services/treasurer.service';

const getStatusColor = (status) => {
  const map = {
    'Draft': '#9ca3af',
    'Submitted': '#f59e0b',
    'Verified by Bookkeeper': '#3b82f6',
    'Pending Credit Committee': '#8b5cf6',
    'Approved by Credit Committee': '#10b981',
    'Approved \u2013 For Disbursement': '#7c3aed',
    'Active': '#059669',
    'Overdue': '#dc2626',
    'Completed': '#22c55e',
    'Rejected by Bookkeeper': '#ef4444',
    'Rejected by Treasurer': '#ef4444',
    'Rejected by Credit Committee': '#ef4444',
    'Disbursed': '#059669',
    'Paid': '#22c55e',
    'Closed': '#6b7280',
    'Withdrawn': '#6b7280',
  };
  return map[status] || '#6b7280';
};

export default function ApplicantLoanHistory() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedApplicant, setSelectedApplicant] = useState(null);
  const [history, setHistory] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState('');
  const searchRef = useRef(null);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await treasurerService.searchApplicants(searchQuery);
        setSearchResults(results || []);
        setShowDropdown(true);
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelectApplicant = async (applicant) => {
    setSelectedApplicant(applicant);
    setSearchQuery('');
    setShowDropdown(false);
    setLoadingHistory(true);
    setError('');
    try {
      const data = await treasurerService.getApplicantLoanHistory(applicant.id);
      setHistory(data);
    } catch {
      setError('Failed to load loan history.');
    }
    setLoadingHistory(false);
  };

  const handleClear = () => {
    setSelectedApplicant(null);
    setHistory(null);
    setSearchQuery('');
    setError('');
  };

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1f2937', marginBottom: '0.25rem' }}>Member Loan History</h1>
      <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>Search for a member to view their complete loan application history</p>

      {/* Search Box */}
      <div style={{ background: '#fff', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '1.5rem' }}>
        <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem', display: 'block' }}>
          Search Member
        </label>
        <div ref={searchRef} style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Type a name or email to search..."
            value={selectedApplicant ? `${selectedApplicant.name} (${selectedApplicant.email})` : searchQuery}
            onChange={e => {
              if (selectedApplicant) handleClear();
              setSearchQuery(e.target.value);
            }}
            onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
            style={{ width: '100%', padding: '0.625rem 2.5rem 0.625rem 1rem', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.875rem', boxSizing: 'border-box' }}
          />
          {searching && (
            <span style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: '#6b7280' }}>
              Searching...
            </span>
          )}
          {selectedApplicant && (
            <button
              onClick={handleClear}
              style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '1rem' }}
            >✕</button>
          )}
          {showDropdown && searchResults.length > 0 && (
            <ul style={{
              position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff',
              border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              zIndex: 100, marginTop: '4px', maxHeight: '220px', overflowY: 'auto', listStyle: 'none', padding: 0, margin: '4px 0 0',
            }}>
              {searchResults.map(a => (
                <li
                  key={a.id}
                  onClick={() => handleSelectApplicant(a)}
                  style={{ padding: '0.625rem 1rem', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', fontSize: '0.875rem' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                >
                  <strong style={{ color: '#1f2937' }}>{a.name}</strong>
                  <span style={{ color: '#6b7280', marginLeft: '0.5rem', fontSize: '0.8rem' }}>{a.email}</span>
                  {a.membership_type && (
                    <span style={{ marginLeft: '0.5rem', background: '#eff6ff', color: '#1d4ed8', padding: '0.1rem 0.5rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600 }}>
                      {a.membership_type}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {showDropdown && !searching && searchResults.length === 0 && searchQuery.trim() && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff',
              border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0.75rem 1rem',
              fontSize: '0.875rem', color: '#9ca3af', marginTop: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100,
            }}>
              No members found for "{searchQuery}"
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#fee2e2', color: '#dc2626', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loadingHistory && (
        <div style={{ textAlign: 'center', color: '#6b7280', padding: '2rem' }}>Loading loan history...</div>
      )}

      {/* History */}
      {history && !loadingHistory && (
        <>
          {/* Applicant Summary Card */}
          <div style={{ background: '#fff', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '50px', height: '50px', background: '#17236a', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.25rem', flexShrink: 0 }}>
              {history.applicant.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.125rem', color: '#1f2937' }}>{history.applicant.name}</div>
              <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>{history.applicant.email}</div>
              {history.applicant.membership_type && (
                <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '0.15rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-block', marginTop: '0.25rem' }}>
                  {history.applicant.membership_type}
                </span>
              )}
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#17236a' }}>{history.total_loans}</div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Total Applications</div>
            </div>
          </div>

          {/* Loan History Table */}
          {history.loans.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: '12px', padding: '3rem', textAlign: 'center', color: '#9ca3af', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              No loan applications found for this member.
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['App #', 'Loan Type', 'Amount', 'Status', 'Date Applied', 'Total Paid', 'Balance'].map(h => (
                      <th key={h} style={{ padding: '0.875rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.loans.map((loan, i) => (
                    <tr key={loan.id} style={{ borderTop: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', color: '#374151', fontWeight: 600 }}>#{loan.id}</td>
                      <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', color: '#374151' }}>{loan.loan_type}</td>
                      <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', fontWeight: 600, color: '#1f2937' }}>
                        ₱{parseFloat(loan.amount_requested).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <span style={{
                          background: getStatusColor(loan.status) + '20',
                          color: getStatusColor(loan.status),
                          padding: '0.2rem 0.65rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600,
                        }}>{loan.status}</span>
                      </td>
                      <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                        {loan.application_date ? new Date(loan.application_date).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', color: '#10b981', fontWeight: 500 }}>
                        ₱{parseFloat(loan.total_paid || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', color: parseFloat(loan.remaining_balance) > 0 ? '#ef4444' : '#10b981', fontWeight: 500 }}>
                        ₱{parseFloat(loan.remaining_balance || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Empty state when no applicant selected */}
      {!selectedApplicant && !loadingHistory && (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '3rem', textAlign: 'center', color: '#9ca3af', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔍</div>
          <div style={{ fontWeight: 500, color: '#6b7280', marginBottom: '0.25rem' }}>Search for a member</div>
          <div style={{ fontSize: '0.875rem' }}>Type a name or email above to find a member and view their loan history</div>
        </div>
      )}
    </div>
  );
}
