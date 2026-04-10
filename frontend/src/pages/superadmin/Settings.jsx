import { useOutletContext } from 'react-router-dom';

export default function SuperAdminSettings() {
  const { user } = useOutletContext() || {};

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1f2937', marginBottom: '1.5rem' }}>
        Settings
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Card 1: Account Information */}
        <div style={{ background: '#fff', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Account Information</h3>
          </div>
          <div style={{ padding: '1.5rem' }}>
            {/* Avatar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              {user?.profile_picture ? (
                <img src={user.profile_picture} alt="Profile"
                  style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid #e5e7eb', flexShrink: 0 }} />
              ) : (
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: '#02327a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  border: '3px solid #e5e7eb',
                  flexShrink: 0,
                }}>
                  {user?.firstname?.[0]?.toUpperCase()}
                </div>
              )}
              <div>
                <div style={{ fontWeight: 600, color: '#1f2937', fontSize: '1rem' }}>
                  {user ? `${user.firstname} ${user.lastname}` : '—'}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{user?.email || '—'}</div>
                <div style={{ fontSize: '0.75rem', color: '#02327a', fontWeight: 500 }}>Super Administrator</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <ReadOnlyField label="Full Name" value={user ? `${user.firstname} ${user.lastname}` : '—'} />
              <ReadOnlyField label="Email" value={user?.email || '—'} />
              <ReadOnlyField label="Role" value="Super Administrator" />
              <ReadOnlyField label="Access Level" value="Full system access" />
            </div>
          </div>
        </div>

        {/* Card 2: Security */}
        <div style={{ background: '#fff', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Security</h3>
          </div>
          <div style={{ padding: '1.5rem' }}>
            <div style={{ padding: '1rem', background: '#f0f4ff', borderRadius: '0.5rem', border: '1px solid #c7d2fe', marginBottom: '1.5rem' }}>
              <div style={{ fontWeight: 500, color: '#3730a3', marginBottom: '0.5rem' }}>Account Protection</div>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0' }}>
                Super Administrator accounts are managed through the Django admin console. Account details and credentials cannot be changed from this portal.
              </p>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.5rem' }}>
                Change Password
              </div>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                Password changes must be done via the Django admin panel.
              </p>
              <a
                href="http://localhost:8000/admin/password_change/"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  padding: '0.5rem 1rem',
                  background: '#02327a',
                  color: '#fff',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  textDecoration: 'none',
                }}
              >
                Open Django Admin
              </a>
            </div>
          </div>
        </div>

        {/* Card 3: System Information */}
        <div style={{ background: '#fff', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>System Information</h3>
          </div>
          <div style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <ReadOnlyField label="System" value="eLoan Super Admin Portal" />
              <ReadOnlyField label="Frontend" value="React + Vite (localhost:3000)" />
              <ReadOnlyField label="Backend" value="Django REST Framework (localhost:8000)" />
            </div>
            <div style={{ marginTop: '1.25rem', padding: '0.75rem', background: '#f9fafb', borderRadius: '0.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                Django admin panel with full model access:{' '}
                <a
                  href="http://localhost:8000/admin"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#02327a', fontWeight: 500 }}
                >
                  localhost:8000/admin
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Admin Notes */}
        <div style={{ background: '#fff', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Admin Notes</h3>
          </div>
          <div style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ padding: '0.75rem', background: '#fef9c3', borderRadius: '0.5rem', border: '1px solid #fde68a' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#92400e', marginBottom: '0.25rem' }}>
                  Account Changes
                </div>
                <div style={{ fontSize: '0.8rem', color: '#78350f' }}>
                  To update account information (name, email), edit the superuser record directly in the Django admin console.
                </div>
              </div>
              <div style={{ padding: '0.75rem', background: '#fef2f2', borderRadius: '0.5rem', border: '1px solid #fecaca' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#991b1b', marginBottom: '0.25rem' }}>
                  Access Control
                </div>
                <div style={{ fontSize: '0.8rem', color: '#7f1d1d' }}>
                  This account has <code style={{ background: '#fee2e2', padding: '0 0.25rem', borderRadius: '3px' }}>is_superuser</code> and full system privileges. Handle credentials with care.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Account Info Footer */}
      <div style={{ marginTop: '1.5rem', padding: '1rem 1.5rem', background: '#f9fafb', borderRadius: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Logged in as: </span>
            <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>
              {user ? `${user.firstname} ${user.lastname}` : '—'}
            </span>
          </div>
          <div>
            <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Role: </span>
            <span style={{
              background: '#e0e7ff',
              color: '#3730a3',
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 500,
            }}>
              Super Administrator
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReadOnlyField({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>
        {label}
      </div>
      <div style={{
        padding: '0.625rem 0.75rem',
        background: '#f3f4f6',
        border: '1px solid #e5e7eb',
        borderRadius: '0.375rem',
        fontSize: '0.875rem',
        color: '#374151',
      }}>
        {value}
      </div>
    </div>
  );
}
