import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import amoService from '../../services/amo.service';

export default function Members() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [actionMsg, setActionMsg] = useState('');

  const load = async (q = '') => {
    setLoading(true);
    const data = await amoService.getMembers(q);
    setMembers(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    load(search);
  };

  const openDetail = async (id) => {
    const detail = await amoService.getMemberDetail(id);
    setSelected(detail);
  };

  const toggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      const res = await amoService.setMemberStatus(id, newStatus);
      setActionMsg(res.message);
      if (selected && selected.id === id) setSelected({ ...selected, status: newStatus });
      setMembers(prev => prev.map(m => m.id === id ? { ...m, status: newStatus } : m));
    } catch {
      setActionMsg('Failed to update status.');
    }
  };

  return (
    <div style={{ display: 'flex', gap: '1.5rem' }}>
      {/* Member List */}
      <div style={{ flex: 1 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1f2937', marginBottom: '0.25rem' }}>Members</h1>
        <p style={{ color: '#6b7280', marginBottom: '1.25rem' }}>Manage approved member accounts</p>

        {actionMsg && (
          <div style={{ background: '#d1fae5', color: '#065f46', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>
            {actionMsg}
            <button onClick={() => setActionMsg('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
          </div>
        )}

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, or ID..."
            style={{ flex: 1, padding: '0.625rem 1rem', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
          />
          <button type="submit" style={{ background: '#10b981', color: '#fff', border: 'none', padding: '0.625rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Search</button>
        </form>

        <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Name', 'Membership', 'Status', 'Savings', 'Capital'].map(h => (
                  <th key={h} style={{ padding: '0.875rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Loading...</td></tr>}
              {!loading && members.length === 0 && <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>No members found.</td></tr>}
              {members.map((m, i) => (
                <tr
                  key={m.id}
                  onClick={() => openDetail(m.id)}
                  style={{ borderTop: '1px solid #f3f4f6', background: selected?.id === m.id ? '#f0fdf4' : i % 2 === 0 ? '#fff' : '#fafafa', cursor: 'pointer' }}
                  onMouseEnter={e => { if (selected?.id !== m.id) e.currentTarget.style.background = '#f0fdf4'; }}
                  onMouseLeave={e => { if (selected?.id !== m.id) e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafafa'; }}
                >
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{m.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{m.email}</div>
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <span style={{
                      background: m.membership_type === 'regular' ? '#d1fae5' : '#ede9fe',
                      color: m.membership_type === 'regular' ? '#065f46' : '#5b21b6',
                      padding: '0.2rem 0.65rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600,
                    }}>{m.membership_type}</span>
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <span style={{
                      background: m.status === 'active' ? '#d1fae5' : '#fee2e2',
                      color: m.status === 'active' ? '#065f46' : '#991b1b',
                      padding: '0.2rem 0.65rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600,
                    }}>{m.status}</span>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', color: '#4b5563' }}>₱{parseFloat(m.total_savings).toLocaleString()}</td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', color: '#4b5563' }}>₱{parseFloat(m.total_shared_capital).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Member Detail Panel */}
      {selected && (
        <div style={{ width: '320px', background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', alignSelf: 'flex-start', position: 'sticky', top: '80px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1f2937' }}>Member Profile</h2>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>✕</button>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
            <div style={{
              width: '60px', height: '60px', background: '#10b981', color: '#fff',
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.25rem', fontWeight: 700, margin: '0 auto 0.75rem',
            }}>
              {selected.firstname?.[0]}{selected.lastname?.[0]}
            </div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1f2937' }}>{selected.firstname} {selected.lastname}</div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{selected.email}</div>
          </div>

          {[
            ['Employee ID', selected.employee_id || '—'],
            ['Membership', selected.membership_type],
            ['Member Since', new Date(selected.member_since).toLocaleDateString()],
            ['Total Savings', `₱${parseFloat(selected.total_savings).toLocaleString()}`],
            ['Total Capital', `₱${parseFloat(selected.total_shared_capital).toLocaleString()}`],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6', fontSize: '0.875rem' }}>
              <span style={{ color: '#6b7280' }}>{label}</span>
              <span style={{ fontWeight: 500, color: '#1f2937' }}>{value}</span>
            </div>
          ))}

          <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem' }}>
            <Link to={`/amo/savings-capital?member=${selected.id}`} style={{
              flex: 1, background: '#10b981', color: '#fff', padding: '0.625rem',
              borderRadius: '8px', textAlign: 'center', textDecoration: 'none', fontWeight: 600, fontSize: '0.875rem',
            }}>Savings & Capital</Link>
            <button onClick={() => toggleStatus(selected.id, selected.status)} style={{
              flex: 1, background: selected.status === 'active' ? '#fee2e2' : '#d1fae5',
              color: selected.status === 'active' ? '#991b1b' : '#065f46',
              border: 'none', padding: '0.625rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem',
            }}>
              {selected.status === 'active' ? 'Suspend' : 'Activate'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}