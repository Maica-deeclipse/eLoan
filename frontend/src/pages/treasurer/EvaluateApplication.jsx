import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import treasurerService from '../../services/treasurer.service';

export default function EvaluateApplication() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [data, setData] = useState(null);

  // Form state
  const [netSalary, setNetSalary] = useState('');
  const [salaryPrefilled, setSalaryPrefilled] = useState(false);
  const [recommendation, setRecommendation] = useState('');
  const [remarks, setRemarks] = useState('');
  const [problemDocs, setProblemDocs] = useState([]);

  useEffect(() => {
    fetchApplication();
  }, [id]);

  const fetchApplication = async () => {
    try {
      setLoading(true);
      const result = await treasurerService.getApplication(id);
      setData(result);
      if (result.application?.net_salary) {
        // Previously saved treasurer-verified salary (re-evaluation)
        setNetSalary(result.application.net_salary);
        setSalaryPrefilled(false);
      } else if (result.application?.applicant_monthly_income) {
        // First evaluation — pre-fill with applicant's declared income
        setNetSalary(result.application.applicant_monthly_income);
        setSalaryPrefilled(true);
      }
    } catch (err) {
      setError('Failed to load application');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const calculateDTI = () => {
    if (!netSalary || !data?.application?.monthly_amortization) return 0;
    const salary = parseFloat(netSalary);
    const amortization = parseFloat(data.application.monthly_amortization);
    if (salary <= 0) return 0;
    return ((amortization / salary) * 100).toFixed(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!netSalary || parseFloat(netSalary) <= 0) {
      setError('Please enter a valid net salary');
      return;
    }
    if (!recommendation) {
      setError('Please select a recommendation');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const fullRemarks = problemDocs.length > 0
        ? `Documents flagged: ${problemDocs.join(', ')}${remarks ? '\n' + remarks : ''}`
        : remarks;
      await treasurerService.evaluateApplication(id, netSalary, recommendation, fullRemarks);

      setSuccess('Application evaluated successfully');
      setTimeout(() => {
        navigate('/treasurer/applications');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit evaluation');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const openDocument = async (documentId) => {
    const previewWindow = window.open('', '_blank');
    try {
      const blob = await treasurerService.getApplicationDocument(id, documentId);
      const objectUrl = URL.createObjectURL(blob);
      if (previewWindow) {
        previewWindow.location.href = objectUrl;
      } else {
        window.open(objectUrl, '_blank');
      }
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (err) {
      if (previewWindow) previewWindow.close();
      setError(err.response?.data?.error || 'Failed to open document');
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

  if (!data) {
    return (
      <div style={{ background: '#fee2e2', color: '#dc2626', padding: '1rem', borderRadius: '0.5rem' }}>
        Application not found
        <Link to="/treasurer/applications" style={{ marginLeft: '1rem', textDecoration: 'underline' }}>
          Back to Applications
        </Link>
      </div>
    );
  }

  const { application, documents, evaluation_history, can_evaluate } = data;
  const dti = calculateDTI();

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/treasurer/applications" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem' }}>
          &larr; Back to Applications
        </Link>
      </div>

      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1f2937', marginBottom: '1.5rem' }}>
        Evaluate Application #{data?.application?.user_application_number ?? id}
      </h1>

      {error && (
        <div style={{ background: '#fee2e2', color: '#dc2626', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ background: '#d1fae5', color: '#065f46', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
          {success}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Left Column - Application Info */}
        <div>
          {/* Borrower Info */}
          <Card title="Borrower Information">
            <InfoRow label="Name" value={application.applicant.name} />
            <InfoRow label="Email" value={application.applicant.email} />
            <InfoRow label="Status" value={application.applicant.status} />
            <InfoRow label="Member Since" value={new Date(application.applicant.date_joined).toLocaleDateString()} />
          </Card>

          {/* Loan Details */}
          <Card title="Loan Details" style={{ marginTop: '1rem' }}>
            <InfoRow label="Loan Type" value={application.loan_type.name} />
            <InfoRow label="Interest Rate" value={`${application.loan_type.interest_rate}%`} />
            <InfoRow label="Amount Requested" value={`₱${parseFloat(application.amount_requested).toLocaleString()}`} highlight />
            <InfoRow label="Term" value={`${application.term_months} months`} />
            <InfoRow label="Monthly Amortization" value={`₱${parseFloat(application.monthly_amortization || 0).toLocaleString()}`} highlight />
            <InfoRow label="Total Payable" value={`₱${parseFloat(application.total_payable || 0).toLocaleString()}`} />
            <InfoRow label="Purpose" value={application.purpose} />
            <InfoRow label="Application Date" value={new Date(application.application_date).toLocaleDateString()} />
            <InfoRow label="Status" value={application.status} />
          </Card>

          {/* Documents */}
          <Card title="Uploaded Documents" style={{ marginTop: '1rem' }}>
            {documents.length === 0 ? (
              <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>No documents uploaded</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {documents.map((doc) => {
                  return (
                    <div
                      key={doc.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.5rem 0.75rem',
                        background: '#f9fafb',
                        borderRadius: '0.375rem',
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>&#128196; {doc.document_type}</span>
                      {doc.verified ? (
                        <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 600 }}>&#10004; Verified</span>
                      ) : (
                        <button
                          onClick={() => openDocument(doc.id)}
                          style={{
                            background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe',
                            padding: '0.25rem 0.6rem', borderRadius: '0.25rem', fontSize: '0.75rem',
                            cursor: 'pointer', fontWeight: 500,
                          }}
                        >
                          View
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Evaluation History */}
          {evaluation_history.length > 0 && (
            <Card title="Previous Evaluations" style={{ marginTop: '1rem' }}>
              {evaluation_history.map((e) => (
                <div key={e.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      background: e.recommendation === 'recommend' ? '#d1fae5' : '#fee2e2',
                      color: e.recommendation === 'recommend' ? '#065f46' : '#dc2626',
                    }}>
                      {e.recommendation === 'recommend' ? 'Recommended' : 'Not Recommended'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                      DTI: {e.dti_ratio}%
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                    by {e.evaluated_by} on {new Date(e.evaluated_at).toLocaleDateString()}
                  </div>
                  {e.remarks && (
                    <div style={{ fontSize: '0.75rem', color: '#1f2937', marginTop: '0.25rem', fontStyle: 'italic' }}>
                      "{e.remarks}"
                    </div>
                  )}
                </div>
              ))}
            </Card>
          )}
        </div>

        {/* Right Column - Evaluation Form */}
        <div>
          <Card title="DTI Evaluation Form" headerColor="#10b981">
            {!can_evaluate ? (
              <div style={{ color: '#6b7280', padding: '1rem', textAlign: 'center' }}>
                This application cannot be evaluated (status: {application.status})
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {/* Monthly Amortization (readonly) */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={labelStyle}>Monthly Amortization</label>
                  <input
                    type="text"
                    value={`₱${parseFloat(application.monthly_amortization || 0).toLocaleString()}`}
                    readOnly
                    style={{ ...inputStyle, background: '#f3f4f6', cursor: 'not-allowed' }}
                  />
                </div>

                {/* Net Salary */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={labelStyle}>Net Monthly Salary *</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }}>₱</span>
                    <input
                      type="number"
                      value={netSalary}
                      onChange={(e) => { setNetSalary(e.target.value); setSalaryPrefilled(false); }}
                      placeholder="Enter net salary from payslip"
                      style={{ ...inputStyle, paddingLeft: '1.75rem' }}
                      required
                      min="0"
                      step="0.01"
                    />
                  </div>
                  {salaryPrefilled ? (
                    <div style={{ fontSize: '0.75rem', color: '#d97706', marginTop: '0.25rem' }}>
                      ⚠ Pre-filled from applicant's declared income. Verify against the uploaded payslip and correct if needed.
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                      Enter the net monthly salary as shown on the payslip
                    </div>
                  )}
                </div>

                {/* DTI Calculation */}
                <div style={{
                  marginBottom: '1.5rem',
                  padding: '1rem',
                  background: dti > 40 ? '#fef3c7' : dti > 30 ? '#fef9c3' : '#d1fae5',
                  borderRadius: '0.5rem',
                  border: `1px solid ${dti > 40 ? '#f59e0b' : dti > 30 ? '#eab308' : '#10b981'}`,
                }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#1f2937' }}>
                    Debt-to-Income Ratio (DTI)
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: dti > 40 ? '#d97706' : dti > 30 ? '#ca8a04' : '#059669' }}>
                    {dti}%
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    {dti <= 30 && 'Low risk - Recommended range'}
                    {dti > 30 && dti <= 40 && 'Moderate risk - Consider carefully'}
                    {dti > 40 && 'High risk - May affect repayment ability'}
                  </div>
                </div>

                {/* Recommendation */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={labelStyle}>Recommendation *</label>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <label style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      padding: '1rem',
                      border: `2px solid ${recommendation === 'recommend' ? '#10b981' : '#e5e7eb'}`,
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      background: recommendation === 'recommend' ? '#d1fae5' : '#fff',
                    }}>
                      <input
                        type="radio"
                        name="recommendation"
                        value="recommend"
                        checked={recommendation === 'recommend'}
                        onChange={(e) => setRecommendation(e.target.value)}
                        style={{ marginRight: '0.75rem' }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, color: '#059669' }}>Recommend</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Forward to Credit Committee</div>
                      </div>
                    </label>

                    <label style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      padding: '1rem',
                      border: `2px solid ${recommendation === 'not_recommend' ? '#ef4444' : '#e5e7eb'}`,
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      background: recommendation === 'not_recommend' ? '#fee2e2' : '#fff',
                    }}>
                      <input
                        type="radio"
                        name="recommendation"
                        value="not_recommend"
                        checked={recommendation === 'not_recommend'}
                        onChange={(e) => setRecommendation(e.target.value)}
                        style={{ marginRight: '0.75rem' }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, color: '#dc2626' }}>Not Recommend</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Reject application</div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Documents with Issues */}
                {documents && documents.length > 0 && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={labelStyle}>Documents with Issues</label>
                    <div style={{ border: '1px solid #d1d5db', borderRadius: '0.5rem', padding: '0.5rem', maxHeight: '120px', overflowY: 'auto', background: '#fafafa' }}>
                      {documents.map(doc => (
                        <label key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.2rem 0', cursor: 'pointer', fontSize: '0.875rem' }}>
                          <input
                            type="checkbox"
                            checked={problemDocs.includes(doc.document_type)}
                            onChange={(e) => setProblemDocs(prev => e.target.checked ? [...prev, doc.document_type] : prev.filter(d => d !== doc.document_type))}
                          />
                          {doc.document_type}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Remarks */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={labelStyle}>Remarks (Optional)</label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Enter any notes or observations about this evaluation..."
                    style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: submitting ? '#9ca3af' : '#10b981',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    fontWeight: 600,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {submitting ? 'Submitting...' : 'Submit Evaluation'}
                </button>
              </form>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({ title, headerColor, children, style }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: '0.75rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      overflow: 'hidden',
      ...style,
    }}>
      <div style={{
        padding: '0.75rem 1rem',
        borderBottom: '1px solid #e5e7eb',
        background: headerColor ? `${headerColor}15` : '#f9fafb',
      }}>
        <h3 style={{
          fontSize: '0.875rem',
          fontWeight: 600,
          color: headerColor || '#1f2937',
          margin: 0,
        }}>
          {title}
        </h3>
      </div>
      <div style={{ padding: '1rem' }}>
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, value, highlight }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '0.375rem 0',
      borderBottom: '1px solid #f3f4f6',
    }}>
      <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>{label}</span>
      <span style={{
        fontWeight: highlight ? 600 : 400,
        color: highlight ? '#1f2937' : '#374151',
        fontSize: '0.875rem',
      }}>
        {value || '-'}
      </span>
    </div>
  );
}

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
