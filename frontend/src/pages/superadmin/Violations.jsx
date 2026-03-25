import { useState, useEffect, useCallback } from 'react';
import superadminService from '../../services/superadmin.service';

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'escalated', label: 'Escalated' },
  { key: 'resolved', label: 'Resolved' },
];

const SEVERITY_STYLE = {
  minor:    { background: '#dbeafe', color: '#1e40af' },
  moderate: { background: '#fef3c7', color: '#92400e' },
  severe:   { background: '#fee2e2', color: '#991b1b' },
};
const STATUS_STYLE = {
  open:      { background: '#fef3c7', color: '#92400e' },
  escalated: { background: '#fee2e2', color: '#991b1b' },
  resolved:  { background: '#d1fae5', color: '#065f46' },
};

const VIOLATION_TYPES = [
  ['late_payment', 'Late Payment'],
  ['non_payment', 'Non-Payment'],
  ['fraud', 'Fraud'],
  ['misconduct', 'Misconduct'],
  ['policy_violation', 'Policy Violation'],
  ['other', 'Other'],
];

export default function Violations() {
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ member_id: '', violation_type: 'late_payment', description: '', date_of_violation: '', severity: 'minor' });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [editModal, setEditModal] = useState(null); // { id, status, description }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = activeTab ? { severity: activeTab } : {};
      // For status filter we use severity param by tab — actually we want status filter
      const statusParam = activeTab ? { status: activeTab } : {};
      const data = await superadminService.getViolations(activeTab ? { status: activeTab } : {});
      setViolations(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await superadminService.createViolation(form);
      showToast('Violation logged successfully.');
      setShowForm(false);
      setForm({ member_id: '', violation_type: 'late_payment', description: '', date_of_violation: '', severity: 'minor' });
      load();
    } catch (e) {
      showToast(e.response?.data?.error || 'Failed to log violation.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    try {
      await superadminService.updateViolation(editModal.id, { status: editModal.status, description: editModal.description });
      showToast('Violation updated.');
      setEditModal(null);
      load();
    } catch (e) {
      showToast('Failed to update.', 'error');
    }
  };

  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 9999, background: toast.type === 'error' ? '#fee2e2' : '#d1fae5', color: toast.type === 'error' ? '#991b1b' : '#065f46', padding: '0.75rem 1.25rem', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', fontWeight: 500 }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1f2937', margin: 0 }}>Violations</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{ padding: '0.5rem 1rem', background: '#02327a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}
        >
          + Log Violation
        </button>
      </div>
      <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.25rem' }}>Track and manage member violations</p>

      {/* Log Violation Form */}
      {showForm && (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '1.5rem', border: '1px solid #e5e7eb' }}>
          <h3 style={{ margin: '0 0 1rem', color: '#1f2937', fontSize: '1rem' }}>Log New Violation</h3>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <Field label="Member ID" value={form.member_id} onChange={v => setForm(f => ({ ...f, member_id: v }))} type="number" required />
              <Field label="Date of Violation" value={form.date_of_violation} onChange={v => setForm(f => ({ ...f, date_of_violation: v }))} type="date" required />
              <SelectField label="Type" value={form.violation_type} onChange={v => setForm(f => ({ ...f, violation_type: v }))} options={VIOLATION_TYPES} />
              <SelectField label="Severity" value={form.severity} onChange={v => setForm(f => ({ ...f, severity: v }))} options={[['minor','Minor'],['moderate','Moderate'],['severe','Severe']]} />
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Description *</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required rows={2} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowForm(false)} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '0.875rem' }}>Cancel</button>
              <button type="submit" disabled={submitting} style={{ padding: '0.5rem 1rem', background: '#02327a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}>
                {submitting ? 'Logging...' : 'Log Violation'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid #e5e7eb' }}>
        {STATUS_TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ padding: '0.5rem 1rem', border: 'none', background: 'none', cursor: 'pointer', fontWeight: activeTab === t.key ? 600 : 400, color: activeTab === t.key ? '#02327a' : '#6b7280', borderBottom: activeTab === t.key ? '2px solid #02327a' : '2px solid transparent', fontSize: '0.875rem' }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>Loading...</div>
      ) : violations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>No violations found.</div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Member', 'Type', 'Severity', 'Status', 'Date', 'Logged By', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {violations.map((v) => (
                <tr key={v.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <div style={{ fontWeight: 600, color: '#1f2937', fontSize: '0.875rem' }}>{v.member_name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{v.member_email}</div>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', color: '#374151' }}>{v.violation_type_display}</td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <span style={{ ...(SEVERITY_STYLE[v.severity] || {}), padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>{v.severity}</span>
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <span style={{ ...(STATUS_STYLE[v.status] || {}), padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>{v.status}</span>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.8rem', color: '#6b7280' }}>{new Date(v.date_of_violation).toLocaleDateString()}</td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.8rem', color: '#6b7280' }}>{v.logged_by || '—'}</td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <button
                      onClick={() => setEditModal({ id: v.id, status: v.status, description: v.description })}
                      style={{ padding: '0.3rem 0.7rem', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Update
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {editModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', width: '400px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 1rem', color: '#1f2937' }}>Update Violation</h3>
            <SelectField label="Status" value={editModal.status} onChange={v => setEditModal(m => ({ ...m, status: v }))} options={[['open','Open'],['escalated','Escalated'],['resolved','Resolved']]} />
            <div style={{ marginTop: '0.75rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Description</label>
              <textarea value={editModal.description} onChange={e => setEditModal(m => ({ ...m, description: e.target.value }))} rows={3} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setEditModal(null)} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '0.875rem' }}>Cancel</button>
              <button onClick={handleUpdate} style={{ padding: '0.5rem 1rem', background: '#02327a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>{label}{required && ' *'}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} required={required} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', boxSizing: 'border-box' }} />
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', boxSizing: 'border-box' }}>
        {options.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
    </div>
  );
}
