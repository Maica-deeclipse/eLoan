import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import amoService from '../../services/amo.service';
import PasswordInput from '../../components/PasswordInput';

export default function AMOSettings() {
  const { updateUser } = useOutletContext();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  const [profileForm, setProfileForm] = useState({ firstname: '', lastname: '' });
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const fileInputRef = useRef(null);
  const [profileErrors, setProfileErrors] = useState({});
  const [passwordErrors, setPasswordErrors] = useState({});

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await amoService.getProfile();
      setProfile(data);
      setProfileForm({ firstname: data.firstname || '', lastname: data.lastname || '' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!profileForm.firstname.trim()) errs.firstname = 'First name is required.';
    if (!profileForm.lastname.trim()) errs.lastname = 'Last name is required.';
    setProfileErrors(errs);
    if (Object.keys(errs).length > 0) return;
    try {
      setSaving(true);
      await amoService.updateProfile(profileForm);
      setProfile({ ...profile, ...profileForm });
      showMessage('success', 'Profile updated successfully!');
    } catch (err) {
      showMessage('error', err?.response?.data?.error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePictureClick = () => { fileInputRef.current?.click(); };

  const handlePictureChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showMessage('error', 'Please select an image file (JPG, PNG, GIF, or WebP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showMessage('error', 'Image size must be less than 5 MB');
      return;
    }
    if (!window.confirm('Are you sure you want to update your profile picture?')) {
      e.target.value = '';
      return;
    }
    try {
      setSaving(true);
      const result = await amoService.uploadProfilePicture(file);
      setProfile({ ...profile, profile_picture: result.profile_picture });
      updateUser({ profile_picture: result.profile_picture });
      showMessage('success', 'Profile picture updated!');
    } catch (err) {
      showMessage('error', err?.response?.data?.error || 'Failed to upload picture');
    } finally {
      setSaving(false);
      e.target.value = '';
    }
  };

  const handleRemovePicture = async () => {
    if (!window.confirm('Are you sure you want to remove your profile picture?')) return;
    try {
      setSaving(true);
      await amoService.removeProfilePicture();
      setProfile({ ...profile, profile_picture: null });
      updateUser({ profile_picture: null });
      showMessage('success', 'Profile picture removed');
    } catch (err) {
      showMessage('error', err?.response?.data?.error || 'Failed to remove picture');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!passwordForm.current_password) errs.current_password = 'Current password is required.';
    if (!passwordForm.new_password) {
      errs.new_password = 'New password is required.';
    } else if (passwordForm.new_password.length < 8) {
      errs.new_password = 'Password must be at least 8 characters.';
    }
    if (!passwordForm.confirm_password) {
      errs.confirm_password = 'Please confirm new password.';
    } else if (passwordForm.new_password !== passwordForm.confirm_password) {
      errs.confirm_password = 'New passwords do not match.';
    }
    setPasswordErrors(errs);
    if (Object.keys(errs).length > 0) return;
    try {
      setSaving(true);
      await amoService.changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      setPasswordErrors({});
      showMessage('success', 'Password changed successfully!');
    } catch (err) {
      showMessage('error', err?.response?.data?.error || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <div style={{ textAlign: 'center', color: '#6b7280' }}>Loading settings...</div>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1f2937', marginBottom: '1.5rem' }}>
        Settings
      </h1>

      {message.text && (
        <div style={{
          padding: '1rem',
          borderRadius: '0.5rem',
          marginBottom: '1rem',
          background: message.type === 'success' ? '#d1fae5' : '#fee2e2',
          color: message.type === 'success' ? '#065f46' : '#991b1b',
        }}>
          {message.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Card 1: Profile Information */}
        <div style={{ background: '#fff', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Profile Information</h3>
          </div>
          <div style={{ padding: '1.5rem' }}>
            {/* Profile Picture */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div
                onClick={handlePictureClick}
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: profile?.profile_picture ? `url(${profile.profile_picture}) center/cover` : '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '3px solid #e5e7eb',
                  flexShrink: 0,
                }}
              >
                {!profile?.profile_picture && profile?.firstname?.[0]?.toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 600, color: '#1f2937', marginBottom: '0.25rem' }}>{profile?.firstname} {profile?.lastname}</div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>{profile?.email}</div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={handlePictureClick}
                    disabled={saving}
                    style={{
                      background: '#10b981',
                      color: '#fff',
                      border: 'none',
                      padding: '0.4rem 0.875rem',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                    }}
                  >
                    Upload Photo
                  </button>
                  {profile?.profile_picture && (
                    <button
                      onClick={handleRemovePicture}
                      disabled={saving}
                      style={{
                        background: '#f3f4f6',
                        color: '#374151',
                        border: 'none',
                        padding: '0.4rem 0.875rem',
                        borderRadius: '0.375rem',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePictureChange}
                  style={{ display: 'none' }}
                />
                <p style={{ margin: '0.4rem 0 0', fontSize: '0.72rem', color: '#6b7280' }}>
                  JPG, PNG, GIF or WebP &middot; Max 5 MB
                </p>
              </div>
            </div>

            <form onSubmit={handleProfileSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="amo-firstname" style={labelStyle}>First Name <span style={{ color: '#dc2626' }}>*</span></label>
                <input
                  id="amo-firstname"
                  type="text"
                  name="firstname"
                  autoComplete="given-name"
                  value={profileForm.firstname}
                  onChange={e => { setProfileForm({ ...profileForm, firstname: e.target.value }); if (profileErrors.firstname) setProfileErrors(p => ({ ...p, firstname: '' })); }}
                  style={{ ...inputStyle, ...(profileErrors.firstname ? errorInputStyle : {}) }}
                  required
                />
                {profileErrors.firstname && <span style={fieldErrorStyle}>{profileErrors.firstname}</span>}
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="amo-lastname" style={labelStyle}>Last Name <span style={{ color: '#dc2626' }}>*</span></label>
                <input
                  id="amo-lastname"
                  type="text"
                  name="lastname"
                  autoComplete="family-name"
                  value={profileForm.lastname}
                  onChange={e => { setProfileForm({ ...profileForm, lastname: e.target.value }); if (profileErrors.lastname) setProfileErrors(p => ({ ...p, lastname: '' })); }}
                  style={{ ...inputStyle, ...(profileErrors.lastname ? errorInputStyle : {}) }}
                  required
                />
                {profileErrors.lastname && <span style={fieldErrorStyle}>{profileErrors.lastname}</span>}
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="amo-email" style={labelStyle}>Email</label>
                <input
                  id="amo-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={profile?.email || ''}
                  disabled
                  style={{ ...inputStyle, background: '#f3f4f6', cursor: 'not-allowed' }}
                />
                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  Email cannot be changed
                </p>
              </div>
              {profile?.employee_id && (
                <div style={{ marginBottom: '1rem' }}>
                  <label htmlFor="amo-employee-id" style={labelStyle}>Employee ID</label>
                  <input
                    id="amo-employee-id"
                    value={profile.employee_id}
                    disabled
                    style={{ ...inputStyle, background: '#f3f4f6', cursor: 'not-allowed' }}
                  />
                </div>
              )}
              <button
                type="submit"
                disabled={saving}
                style={{
                  background: '#10b981',
                  color: '#fff',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '0.375rem',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>

        {/* Card 2: Change Password */}
        <div style={{ background: '#fff', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Change Password</h3>
          </div>
          <div style={{ padding: '1.5rem' }}>
            <form onSubmit={handlePasswordSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="amo-current-password" style={labelStyle}>Current Password <span style={{ color: '#dc2626' }}>*</span></label>
                <PasswordInput
                  id="amo-current-password"
                  name="current_password"
                  autoComplete="current-password"
                  value={passwordForm.current_password}
                  onChange={e => { setPasswordForm({ ...passwordForm, current_password: e.target.value }); if (passwordErrors.current_password) setPasswordErrors(p => ({ ...p, current_password: '' })); }}
                  style={{ ...inputStyle, ...(passwordErrors.current_password ? errorInputStyle : {}) }}
                  required
                />
                {passwordErrors.current_password && <span style={fieldErrorStyle}>{passwordErrors.current_password}</span>}
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="amo-new-password" style={labelStyle}>New Password <span style={{ color: '#dc2626' }}>*</span></label>
                <PasswordInput
                  id="amo-new-password"
                  name="new_password"
                  autoComplete="new-password"
                  value={passwordForm.new_password}
                  onChange={e => { setPasswordForm({ ...passwordForm, new_password: e.target.value }); if (passwordErrors.new_password) setPasswordErrors(p => ({ ...p, new_password: '' })); }}
                  style={{ ...inputStyle, ...(passwordErrors.new_password ? errorInputStyle : {}) }}
                  minLength={8}
                  required
                />
                {passwordErrors.new_password && <span style={fieldErrorStyle}>{passwordErrors.new_password}</span>}
                {!passwordErrors.new_password && <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>Minimum 8 characters</p>}
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="amo-confirm-password" style={labelStyle}>Confirm New Password <span style={{ color: '#dc2626' }}>*</span></label>
                <PasswordInput
                  id="amo-confirm-password"
                  name="confirm_password"
                  autoComplete="new-password"
                  value={passwordForm.confirm_password}
                  onChange={e => { setPasswordForm({ ...passwordForm, confirm_password: e.target.value }); if (passwordErrors.confirm_password) setPasswordErrors(p => ({ ...p, confirm_password: '' })); }}
                  style={{ ...inputStyle, ...(passwordErrors.confirm_password ? errorInputStyle : {}) }}
                  minLength={8}
                  required
                />
                {passwordErrors.confirm_password && <span style={fieldErrorStyle}>{passwordErrors.confirm_password}</span>}
              </div>
              <button
                type="submit"
                disabled={saving}
                style={{
                  background: '#10b981',
                  color: '#fff',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '0.375rem',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Changing...' : 'Change Password'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Account Info Footer */}
      <div style={{ marginTop: '1.5rem', padding: '1rem 1.5rem', background: '#f9fafb', borderRadius: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Employee ID: </span>
            <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>{profile?.employee_id || 'N/A'}</span>
          </div>
          <div>
            <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Role: </span>
            <span style={{
              background: '#d1fae5',
              color: '#065f46',
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 500,
            }}>
              Account Member Officer
            </span>
          </div>
        </div>
      </div>
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

const errorInputStyle = {
  borderColor: '#dc2626',
  background: '#fff5f5',
  boxShadow: '0 0 0 3px rgba(220,38,38,0.12)',
};

const fieldErrorStyle = {
  display: 'block',
  fontSize: '0.75rem',
  color: '#dc2626',
  marginTop: '0.25rem',
  fontWeight: 500,
};
