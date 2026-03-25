import { useState, useEffect, useCallback } from 'react';
import superadminService from '../../services/superadmin.service';

const ACTION_TYPES = [
  ['warning', 'Warning'],
  ['suspension', 'Suspension'],
  ['termination', 'Termination'],
  ['reinstatement', 'Reinstatement'],
];

const ACTION_STYLE = {
  warning:       { background: '#fef3c7', color: '#92400e' },
  suspension:    { background: '#fee2e2', color: '#991b1b' },
  termination:   { background: '#1f2937', color: '#f9fafb' },
  reinstatement: { background: '#d1fae5', color: '#065f46' },
};

export default function DisciplinaryActions() {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    member_id: '',
    action_type: 'warning',
    reason: '',
    effective_date: '',
    suspension_end_date: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await superadminService.getDisciplinaryActions();
      setActions(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { ...form };
      if (!payload.suspension_end_date) delete payload.suspension_end_date;
      if (!payload.effective_date) delete payload.effective_date;
      await superadminService.createDisciplinaryAction(payload);
      showToast('Disciplinary action recorded.');
      setShowForm(false);
      setForm({ member_id: '', action_type: 'warning', reason: '', effective_date: '', suspension_end_date: '', notes: '' });
      load();
    } catch (e) {
      showToast(e.response?.data?.error || 'Failed to record action.', 'error');
    } finally {
      setSubmitting(false);
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
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1f2937', margin: 0 }}>Disciplinary Actions</h1>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: '0.5rem 1rem', background: '#02327a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}>
          + New Action
        </button>
      </div>
      <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.25rem' }}>Record and review disciplinary decisions</p>

      {/* Form */}
      {showForm && (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '1.5rem', border: '1px solid #e5e7eb' }}>
          <h3 style={{ margin: '0 0 1rem', color: '#1f2937', fontSize: '1rem' }}>Record Disciplinary Action</h3>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <Field label="Member ID" value={form.member_id} onChange={v => setForm(f => ({ ...f, member_id: v }))} type="number" required />
              <SelectField label="Action Type" value={form.action_type} onChange={v => setForm(f => ({ ...f, action_type: v }))} options={ACTION_TYPES} />
              <Field label="Effective Date" value={form.effective_date} onChange={v => setForm(f => ({ ...f, effective_date: v }))} type="date" />
              {form.action_type === 'suspension' && (
                <Field label="Suspension End Date" value={form.suspension_end_date} onChange={v => setForm(f => ({ ...f, suspension_end_date: v }))} type="date" />
              )}
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Reason *</label>
              <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} required rows={2} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Notes</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowForm(false)} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '0.875rem' }}>Cancel</button>
              <button type="submit" disabled={submitting} style={{ padding: '0.5rem 1rem', background: '#02327a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}>
                {submitting ? 'Saving...' : 'Record Action'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>Loading...</div>
      ) : actions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>No disciplinary actions on record.</div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Member', 'Action', 'Reason', 'Effective Date', 'Decided By', 'Member Status'].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {actions.map((a) => (
                <tr key={a.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <div style={{ fontWeight: 600, color: '#1f2937', fontSize: '0.875rem' }}>{a.member_name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{a.member_email}</div>
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <span style={{ ...(ACTION_STYLE[a.action_type] || {}), padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>{a.action_type_display}</span>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.8rem', color: '#374151', maxWidth: '200px' }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.reason}>{a.reason}</div>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.8rem', color: '#6b7280' }}>
                    {new Date(a.effective_date).toLocaleDateString()}
                    {a.suspension_end_date && (
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>→ {new Date(a.suspension_end_date).toLocaleDateString()}</div>
                    )}
                  </td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.8rem', color: '#6b7280' }}>{a.decided_by || '—'}</td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.8rem', color: '#374151' }}>{a.current_member_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
