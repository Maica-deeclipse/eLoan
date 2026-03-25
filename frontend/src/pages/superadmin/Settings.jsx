import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import authService from '../../services/auth.service';

export default function SuperAdminSettings() {
  const { user } = useOutletContext() || {};
  const [saved, setSaved] = useState(false);

  const showSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1f2937', marginBottom: '0.25rem' }}>Settings</h1>
      <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.5rem' }}>Manage your superadmin account preferences</p>

      {saved && (
        <div style={{ background: '#d1fae5', color: '#065f46', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem', fontWeight: 500 }}>
          Settings saved.
        </div>
      )}

      {/* Account Info */}
      <Section title="Account Information">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <InfoRow label="Name" value={user ? `${user.firstname} ${user.lastname}` : '—'} />
          <InfoRow label="Email" value={user?.email || '—'} />
          <InfoRow label="Role" value="Super Administrator" />
          <InfoRow label="Access Level" value="Superuser (Django is_superuser)" />
        </div>
      </Section>

      {/* Security */}
      <Section title="Security">
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
          Your account uses Django's superuser flag for access. Password changes must be done via the Django admin console at <code style={{ background: '#f3f4f6', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>localhost:8000/admin</code>.
        </p>
        <a
          href="http://localhost:8000/admin/password_change/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'inline-block', padding: '0.5rem 1rem', background: '#02327a', color: '#fff', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}
        >
          Change Password (Django Admin)
        </a>
      </Section>

      {/* About */}
      <Section title="About">
        <div style={{ fontSize: '0.875rem', color: '#6b7280', lineHeight: 1.7 }}>
          <div><strong style={{ color: '#374151' }}>System:</strong> eLoan Super Admin Portal</div>
          <div><strong style={{ color: '#374151' }}>Frontend:</strong> React + Vite (localhost:3000)</div>
          <div><strong style={{ color: '#374151' }}>Backend:</strong> Django REST Framework (localhost:8000)</div>
          <div style={{ marginTop: '0.5rem' }}>
            Django admin with full model access is also available at{' '}
            <a href="http://localhost:8000/admin" target="_blank" rel="noopener noreferrer" style={{ color: '#02327a', fontWeight: 500 }}>localhost:8000/admin</a>.
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '1.25rem' }}>
      <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid #f3f4f6' }}>{title}</h2>
      {children}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ fontSize: '0.875rem', color: '#1f2937', fontWeight: 500 }}>{value}</div>
    </div>
  );
}
