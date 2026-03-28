import { useState, useEffect, useCallback } from 'react';
import superadminService from '../../services/superadmin.service';

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'suspended', label: 'Suspended' },
  { key: 'terminated', label: 'Terminated' },
  { key: 'voluntary_withdrawal', label: 'Withdrawn' },
];

const STATUS_STYLE = {
  active:               { background: '#d1fae5', color: '#065f46' },
  suspended:            { background: '#fef3c7', color: '#92400e' },
  terminated:           { background: '#fee2e2', color: '#991b1b' },
  voluntary_withdrawal: { background: '#e5e7eb', color: '#374151' },
  deceased:             { background: '#1f2937', color: '#f9fafb' },
  pending:              { background: '#dbeafe', color: '#1e40af' },
};

export default function Members() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('');
  const [selected, setSelected] = useState(null); // case history modal
  const [caseHistory, setCaseHistory] = useState(null);
  const [caseLoading, setCaseLoading] = useState(false);
  const [faceModal, setFaceModal] = useState(null); // member id for face verification modal
  const [faceData, setFaceData] = useState(null);
  const [faceLoading, setFaceLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = activeTab ? { membership_status: activeTab } : {};
      const data = await superadminService.getMembers(params);
      setMembers(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { load(); }, [load]);

  const openFaceVerification = async (memberId) => {
    setFaceModal(memberId);
    setFaceLoading(true);
    setFaceData(null);
    try {
      const data = await superadminService.getMemberFaceVerifications(memberId);
      setFaceData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setFaceLoading(false);
    }
  };

  const openCaseHistory = async (memberId) => {
    setSelected(memberId);
    setCaseLoading(true);
    setCaseHistory(null);
    try {
      const data = await superadminService.getMemberCaseHistory(memberId);
      setCaseHistory(data);
    } catch (e) {
      console.error(e);
    } finally {
      setCaseLoading(false);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1f2937', marginBottom: '0.25rem' }}>Member Overview</h1>
      <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.5rem' }}>View and monitor all cooperative members</p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid #e5e7eb' }}>
        {STATUS_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: '0.5rem 1rem', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: activeTab === t.key ? 600 : 400,
              color: activeTab === t.key ? '#02327a' : '#6b7280',
              borderBottom: activeTab === t.key ? '2px solid #02327a' : '2px solid transparent',
              fontSize: '0.875rem',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>Loading...</div>
      ) : members.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>No members found.</div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Member', 'Type', 'Status', 'Employment', 'Open Violations', 'Since', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr
                  key={m.id}
                  onClick={() => openCaseHistory(m.id)}
                  style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <div style={{ fontWeight: 600, color: '#1f2937' }}>{m.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{m.email}</div>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.8rem', color: '#374151' }}>{m.membership_type || '—'}</td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <span style={{ ...(STATUS_STYLE[m.membership_status] || {}), padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                      {m.membership_status_display}
                    </span>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.8rem', color: '#374151' }}>{m.verified_employment_status || '—'}</td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    {m.violation_count > 0 ? (
                      <span style={{ background: '#fee2e2', color: '#991b1b', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                        {m.violation_count}
                      </span>
                    ) : (
                      <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>0</span>
                    )}
                  </td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.8rem', color: '#6b7280' }}>
                    {new Date(m.member_since).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => openCaseHistory(m.id)}
                        style={{ padding: '0.3rem 0.7rem', background: '#02327a', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Case History
                      </button>
                      <button
                        onClick={() => openFaceVerification(m.id)}
                        style={{ padding: '0.3rem 0.7rem', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Face Verify
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Face Verification Modal */}
      {faceModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '720px', maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff' }}>
              <h3 style={{ margin: 0, color: '#1f2937' }}>Face Verification Records</h3>
              <button onClick={() => { setFaceModal(null); setFaceData(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '1.25rem' }}>✕</button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              {faceLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>Loading...</div>
              ) : !faceData || faceData.verifications?.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>No face verification records found for this member.</div>
              ) : (
                faceData.verifications.map((fv) => (
                  <div key={fv.id} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <div style={{ fontWeight: 600, color: '#1f2937', fontSize: '0.9rem' }}>
                        Loan #{fv.loan_application_id} — {fv.loan_type}
                      </div>
                      <span style={{
                        background: fv.verification_status === 'Verified' ? '#d1fae5' : fv.verification_status === 'Failed' ? '#fee2e2' : '#fef3c7',
                        color: fv.verification_status === 'Verified' ? '#065f46' : fv.verification_status === 'Failed' ? '#991b1b' : '#92400e',
                        padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600,
                      }}>{fv.verification_status}</span>
                    </div>

                    {/* Photos */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.4rem' }}>ID PHOTO</div>
                        {fv.id_photo_url
                          ? <img src={fv.id_photo_url} alt="ID" style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                          : <div style={{ height: 160, background: '#f9fafb', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '0.8rem' }}>No image</div>
                        }
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.4rem' }}>SELFIE</div>
                        {fv.selfie_url
                          ? <img src={fv.selfie_url} alt="Selfie" style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                          : <div style={{ height: 160, background: '#f9fafb', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '0.8rem' }}>No image</div>
                        }
                      </div>
                    </div>

                    {/* Scores */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', fontSize: '0.8rem' }}>
                      <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                        <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}>Similarity</div>
                        <div style={{ fontWeight: 700, fontSize: '1.25rem', color: fv.similarity_score >= 80 ? '#10b981' : fv.similarity_score >= 60 ? '#f59e0b' : '#ef4444' }}>
                          {fv.similarity_score != null ? `${fv.similarity_score}%` : '—'}
                        </div>
                      </div>
                      <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                        <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}>Match</div>
                        <div style={{ fontWeight: 700, color: fv.is_match ? '#10b981' : '#ef4444' }}>
                          {fv.is_match == null ? '—' : fv.is_match ? 'MATCH' : 'NO MATCH'}
                        </div>
                      </div>
                      <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                        <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}>Model</div>
                        <div style={{ fontWeight: 600 }}>{fv.comparison_model || '—'}</div>
                      </div>
                    </div>

                    {fv.error_message && (
                      <div style={{ marginTop: '0.75rem', background: '#fee2e2', color: '#991b1b', padding: '0.6rem 0.8rem', borderRadius: '6px', fontSize: '0.8rem' }}>
                        <strong>Error:</strong> {fv.error_message}
                      </div>
                    )}
                    {fv.processed_at && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#9ca3af' }}>
                        Processed: {new Date(fv.processed_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Case History Modal */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '680px', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff' }}>
              <h3 style={{ margin: 0, color: '#1f2937' }}>Case History</h3>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '1.25rem' }}>✕</button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              {caseLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>Loading...</div>
              ) : caseHistory ? (
                <CaseHistoryPanel data={caseHistory} />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CaseHistoryPanel({ data }) {
  const { member, violations, disciplinary_actions, termination_record, suggested_action } = data;
  const suggestionColor = {
    termination: '#fee2e2',
    suspension: '#fef3c7',
    warning: '#dbeafe',
    null: '#d1fae5',
  }[suggested_action?.action] || '#d1fae5';
  const suggestionText = {
    termination: '#991b1b',
    suspension: '#92400e',
    warning: '#1e40af',
    null: '#065f46',
  }[suggested_action?.action] || '#065f46';

  return (
    <div>
      {/* Member Info */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#1f2937' }}>{member.name}</div>
        <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>{member.email}</div>
        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ background: '#f3f4f6', color: '#374151', padding: '0.2rem 0.6rem', borderRadius: '8px', fontSize: '0.75rem' }}>
            {member.membership_status_display}
          </span>
          <span style={{ background: '#f3f4f6', color: '#374151', padding: '0.2rem 0.6rem', borderRadius: '8px', fontSize: '0.75rem' }}>
            {member.total_violations} violations ({member.open_violations} open)
          </span>
        </div>
      </div>

      {/* Suggested Action */}
      {suggested_action?.action && (
        <div style={{ background: suggestionColor, color: suggestionText, padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 500, marginBottom: '1rem' }}>
          💡 Suggested: <strong>{suggested_action.action.toUpperCase()}</strong> — {suggested_action.reason}
        </div>
      )}

      {/* Violations */}
      <Section title={`Violations (${violations.length})`}>
        {violations.length === 0 ? <EmptyRow text="No violations on record." /> : violations.map(v => (
          <div key={v.id} style={{ padding: '0.6rem 0', borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontWeight: 600, color: '#1f2937', fontSize: '0.875rem' }}>{v.violation_type_display}</span>
                <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: v.severity === 'severe' ? '#991b1b' : v.severity === 'moderate' ? '#92400e' : '#1e40af', background: v.severity === 'severe' ? '#fee2e2' : v.severity === 'moderate' ? '#fef3c7' : '#dbeafe', padding: '0.1rem 0.4rem', borderRadius: '6px' }}>{v.severity}</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: v.status === 'open' ? '#92400e' : v.status === 'escalated' ? '#991b1b' : '#065f46', background: v.status === 'open' ? '#fef3c7' : v.status === 'escalated' ? '#fee2e2' : '#d1fae5', padding: '0.1rem 0.4rem', borderRadius: '6px' }}>{v.status}</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.2rem' }}>{v.description}</div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.2rem' }}>{new Date(v.date_of_violation).toLocaleDateString()} · Logged by {v.logged_by || 'system'}</div>
          </div>
        ))}
      </Section>

      {/* Disciplinary Actions */}
      <Section title={`Disciplinary Actions (${disciplinary_actions.length})`}>
        {disciplinary_actions.length === 0 ? <EmptyRow text="No disciplinary actions." /> : disciplinary_actions.map(a => (
          <div key={a.id} style={{ padding: '0.6rem 0', borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ fontWeight: 600, color: '#1f2937', fontSize: '0.875rem' }}>{a.action_type_display}</div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.2rem' }}>{a.reason}</div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.2rem' }}>Effective {new Date(a.effective_date).toLocaleDateString()} · By {a.decided_by || 'system'}</div>
          </div>
        ))}
      </Section>

      {/* Termination */}
      {termination_record && (
        <Section title="Termination Record">
          <div style={{ padding: '0.6rem 0' }}>
            <div style={{ fontWeight: 600, color: '#991b1b' }}>{termination_record.termination_type_display}</div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.2rem' }}>{termination_record.reason}</div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.2rem' }}>Effective {new Date(termination_record.effective_date).toLocaleDateString()} · By {termination_record.processed_by || 'system'}</div>
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{title}</div>
      {children}
    </div>
  );
}

function EmptyRow({ text }) {
  return <div style={{ fontSize: '0.875rem', color: '#9ca3af', padding: '0.5rem 0' }}>{text}</div>;
}
