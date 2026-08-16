import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import creditCommitteeService from '../../services/creditCommittee.service';
import authService from '../../services/auth.service';
import PasswordInput from '../../components/PasswordInput';

export default function Settings() {
  const { updateUser } = useOutletContext();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [preferences, setPreferences] = useState(null);

  const [profileForm, setProfileForm] = useState({ firstname: '', lastname: '' });
  const [passwordForm, setPasswordForm] = useState({ old_password: '', new_password: '', confirm_password: '' });
  const [deactivatePassword, setDeactivatePassword] = useState('');

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const fileInputRef = useRef(null);
  const [profileErrors, setProfileErrors] = useState({});
  const [passwordErrors, setPasswordErrors] = useState({});

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [profileRes, prefsRes] = await Promise.all([
        creditCommitteeService.getProfile(),
        creditCommitteeService.getNotificationPreferences(),
      ]);
      setProfile(profileRes.profile);
      setProfileForm({
        firstname: profileRes.profile.firstname || '',
        lastname: profileRes.profile.lastname || '',
      });
      setPreferences(prefsRes.preferences);
    } catch (err) {
      console.error('Failed to load settings:', err);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const handleProfileChange = (e) => {
    setProfileForm({ ...profileForm, [e.target.name]: e.target.value });
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
      const result = await creditCommitteeService.updateProfile(profileForm);
      setProfile({ ...profile, ...result.profile });
      showMessage('success', 'Profile updated successfully!');
    } catch (err) {
      showMessage('error', err.response?.data?.error || 'Failed to update profile');
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
      const result = await creditCommitteeService.uploadProfilePicture(file);
      setProfile({ ...profile, profile_picture: result.profile_picture });
      updateUser({ profile_picture: result.profile_picture });
      showMessage('success', 'Profile picture updated!');
    } catch (err) {
      showMessage('error', err.response?.data?.error || 'Failed to upload picture');
    } finally {
      setSaving(false);
      e.target.value = '';
    }
  };

  const handleRemovePicture = async () => {
    if (!window.confirm('Are you sure you want to remove your profile picture?')) return;
    try {
      setSaving(true);
      await creditCommitteeService.removeProfilePicture();
      setProfile({ ...profile, profile_picture: null });
      updateUser({ profile_picture: null });
      showMessage('success', 'Profile picture removed');
    } catch (err) {
      showMessage('error', err.response?.data?.error || 'Failed to remove picture');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = (e) => {
    setPasswordForm({ ...passwordForm, [e.target.name]: e.target.value });
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!passwordForm.old_password) errs.old_password = 'Current password is required.';
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
      await creditCommitteeService.changePassword(
        passwordForm.old_password,
        passwordForm.new_password,
        passwordForm.confirm_password
      );
      setPasswordForm({ old_password: '', new_password: '', confirm_password: '' });
      setPasswordErrors({});
      showMessage('success', 'Password changed successfully!');
    } catch (err) {
      showMessage('error', err.response?.data?.error || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const handlePreferenceToggle = async (key) => {
    const newValue = !preferences[key];
    const updatedPrefs = { ...preferences, [key]: newValue };
    setPreferences(updatedPrefs);
    try {
      await creditCommitteeService.updateNotificationPreferences(updatedPrefs);
      showMessage('success', 'Preferences updated');
    } catch (err) {
      setPreferences(preferences);
      showMessage('error', 'Failed to update preferences');
    }
  };

  const handleLogoutEverywhere = async () => {
    if (!window.confirm('This will log you out from all devices. Continue?')) return;
    try {
      setSaving(true);
      await creditCommitteeService.logoutEverywhere();
      showMessage('success', 'Logged out from all devices. Redirecting...');
      setTimeout(() => {
        authService.logout();
        window.location.href = '/';
      }, 2000);
    } catch (err) {
      showMessage('error', 'Failed to logout from all devices');
      setSaving(false);
    }
  };

  const handleDeactivateAccount = async () => {
    if (!deactivatePassword) {
      showMessage('error', 'Please enter your password');
      return;
    }
    if (!window.confirm('Are you sure you want to deactivate your account? You will need to contact an administrator to reactivate it.')) {
      return;
    }
    try {
      setSaving(true);
      await creditCommitteeService.deactivateAccount(deactivatePassword);
      showMessage('success', 'Account deactivated. Redirecting...');
      setTimeout(() => {
        authService.logout();
        window.location.href = '/';
      }, 2000);
    } catch (err) {
      showMessage('error', err.response?.data?.error || 'Failed to deactivate account');
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
                  background: profile?.profile_picture ? `url(${profile.profile_picture}) center/cover` : '#8b5cf6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '3px solid #e5e7eb',
                }}
              >
                {!profile?.profile_picture && profile?.firstname?.[0]?.toUpperCase()}
              </div>
              <div>
                <button
                  onClick={handlePictureClick}
                  disabled={saving}
                  style={{
                    background: '#8b5cf6',
                    color: '#fff',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    marginRight: '0.5rem',
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
                      padding: '0.5rem 1rem',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                    }}
                  >
                    Remove
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePictureChange}
                  style={{ display: 'none' }}
                />
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.72rem', color: '#6b7280' }}>
                  JPG, PNG, GIF or WebP &middot; Max 5 MB
                </p>
              </div>
            </div>

            <form onSubmit={handleProfileSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="cc-firstname" style={labelStyle}>First Name <span style={{ color: '#dc2626' }}>*</span></label>
                <input
                  id="cc-firstname"
                  type="text"
                  name="firstname"
                  autoComplete="given-name"
                  value={profileForm.firstname}
                  onChange={(e) => { handleProfileChange(e); if (profileErrors.firstname) setProfileErrors(p => ({ ...p, firstname: '' })); }}
                  style={{ ...inputStyle, ...(profileErrors.firstname ? errorInputStyle : {}) }}
                  required
                />
                {profileErrors.firstname && <span style={fieldErrorStyle}>{profileErrors.firstname}</span>}
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="cc-lastname" style={labelStyle}>Last Name <span style={{ color: '#dc2626' }}>*</span></label>
                <input
                  id="cc-lastname"
                  type="text"
                  name="lastname"
                  autoComplete="family-name"
                  value={profileForm.lastname}
                  onChange={(e) => { handleProfileChange(e); if (profileErrors.lastname) setProfileErrors(p => ({ ...p, lastname: '' })); }}
                  style={{ ...inputStyle, ...(profileErrors.lastname ? errorInputStyle : {}) }}
                  required
                />
                {profileErrors.lastname && <span style={fieldErrorStyle}>{profileErrors.lastname}</span>}
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="cc-email" style={labelStyle}>Email</label>
                <input
                  id="cc-email"
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
              <button
                type="submit"
                disabled={saving}
                style={{
                  background: '#8b5cf6',
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
                <label htmlFor="cc-old-password" style={labelStyle}>Current Password <span style={{ color: '#dc2626' }}>*</span></label>
                <PasswordInput
                  id="cc-old-password"
                  name="old_password"
                  autoComplete="current-password"
                  value={passwordForm.old_password}
                  onChange={(e) => { handlePasswordChange(e); if (passwordErrors.old_password) setPasswordErrors(p => ({ ...p, old_password: '' })); }}
                  style={{ ...inputStyle, ...(passwordErrors.old_password ? errorInputStyle : {}) }}
                  required
                />
                {passwordErrors.old_password && <span style={fieldErrorStyle}>{passwordErrors.old_password}</span>}
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="cc-new-password" style={labelStyle}>New Password <span style={{ color: '#dc2626' }}>*</span></label>
                <PasswordInput
                  id="cc-new-password"
                  name="new_password"
                  autoComplete="new-password"
                  value={passwordForm.new_password}
                  onChange={(e) => { handlePasswordChange(e); if (passwordErrors.new_password) setPasswordErrors(p => ({ ...p, new_password: '' })); }}
                  style={{ ...inputStyle, ...(passwordErrors.new_password ? errorInputStyle : {}) }}
                  minLength={8}
                  required
                />
                {passwordErrors.new_password && <span style={fieldErrorStyle}>{passwordErrors.new_password}</span>}
                {!passwordErrors.new_password && <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>Minimum 8 characters</p>}
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="cc-confirm-password" style={labelStyle}>Confirm New Password <span style={{ color: '#dc2626' }}>*</span></label>
                <PasswordInput
                  id="cc-confirm-password"
                  name="confirm_password"
                  autoComplete="new-password"
                  value={passwordForm.confirm_password}
                  onChange={(e) => { handlePasswordChange(e); if (passwordErrors.confirm_password) setPasswordErrors(p => ({ ...p, confirm_password: '' })); }}
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
                  background: '#8b5cf6',
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

        {/* Card 3: Notification Preferences */}
        <div style={{ background: '#fff', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Notification Preferences</h3>
          </div>
          <div style={{ padding: '1.5rem' }}>
            {preferences && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', padding: '0.75rem', background: '#f9fafb', borderRadius: '0.5rem' }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>Email Notifications</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                      Receive email alerts for applications assigned for review
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={preferences.email_notifications}
                    onChange={() => handlePreferenceToggle('email_notifications')}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f9fafb', borderRadius: '0.5rem' }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>In-App Notifications</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                      Show notification badge and alerts within the application
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={preferences.in_app_notifications}
                    onChange={() => handlePreferenceToggle('in_app_notifications')}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Card 4: Account Actions */}
        <div style={{ background: '#fff', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Account Actions</h3>
          </div>
          <div style={{ padding: '1.5rem' }}>
            {/* Logout Everywhere */}
            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f9fafb', borderRadius: '0.5rem' }}>
              <div style={{ fontWeight: 500, marginBottom: '0.5rem' }}>Logout from All Devices</div>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                This will invalidate all your active sessions and require you to log in again on all devices.
              </p>
              <button
                onClick={handleLogoutEverywhere}
                disabled={saving}
                style={{
                  background: '#f59e0b',
                  color: '#fff',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.375rem',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                Logout Everywhere
              </button>
            </div>

            {/* Deactivate Account */}
            <div style={{ padding: '1rem', background: '#fef2f2', borderRadius: '0.5rem', border: '1px solid #fecaca' }}>
              <div style={{ fontWeight: 500, marginBottom: '0.5rem', color: '#991b1b' }}>Deactivate Account</div>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                This will disable your login. Your data will be preserved. Contact an administrator to reactivate.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <PasswordInput
                  value={deactivatePassword}
                  onChange={(e) => setDeactivatePassword(e.target.value)}
                  placeholder="Enter password to confirm"
                  style={{ ...inputStyle, marginBottom: 0 }}
                  wrapperStyle={{ flex: 1 }}
                />
                <button
                  onClick={handleDeactivateAccount}
                  disabled={saving}
                  style={{
                    background: '#dc2626',
                    color: '#fff',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '0.375rem',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Deactivate
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Account Info Footer */}
      <div style={{ marginTop: '1.5rem', padding: '1rem 1.5rem', background: '#f9fafb', borderRadius: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Account created: </span>
            <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>
              {profile?.date_joined ? new Date(profile.date_joined).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric',
              }) : 'N/A'}
            </span>
          </div>
          <div>
            <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Role: </span>
            <span style={{
              background: '#ede9fe',
              color: '#5b21b6',
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 500,
            }}>
              {profile?.role || 'Credit Committee'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      onClick={onChange}
      style={{
        width: '48px',
        height: '24px',
        borderRadius: '12px',
        border: 'none',
        background: checked ? '#8b5cf6' : '#d1d5db',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.2s',
      }}
    >
      <div style={{
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        background: '#fff',
        position: 'absolute',
        top: '2px',
        left: checked ? '26px' : '2px',
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: '0.875rem',
  fontWeight: 500,
  color: '#374151',
  marginBottom: '0.375rem',
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
