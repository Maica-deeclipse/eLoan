import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/auth';
const VALID_ROLES = ['Bookkeeper', 'Treasurer', 'Credit Committee', 'Account Member Officer'];

export default function StaffRegister() {
  const { role: urlRole } = useParams();
  const presetRole = VALID_ROLES.includes(urlRole) ? urlRole : '';

  // step: 'form' | 'google-details' | 'success'
  const [step, setStep] = useState('form');
  const [googleData, setGoogleData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Manual form state
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [selectedRole, setSelectedRole] = useState(presetRole);

  // ── Manual registration ───────────────────────────────────────────────────
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedRole) return setError('Please select a role.');
    if (!firstname.trim()) return setError('First name is required.');
    if (!lastname.trim()) return setError('Last name is required.');
    if (!email.trim()) return setError('Email is required.');
    if (!password) return setError('Password is required.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirmPassword) return setError('Passwords do not match.');
    if (!employeeId.trim()) return setError('Employee ID is required.');

    setLoading(true);
    try {
      await axios.post(`${API_URL}/staff/register/`, {
        firstname: firstname.trim(),
        lastname: lastname.trim(),
        email: email.trim().toLowerCase(),
        password,
        role: selectedRole,
        employee_id: employeeId.trim(),
      });
      setStep('success');
    } catch (err) {
      const data = err.response?.data;
      const firstError = data && typeof data === 'object'
        ? Object.values(data).flat()[0]
        : null;
      setError(firstError || data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Google registration ───────────────────────────────────────────────────
  const googleAuth = useGoogleLogin({
    prompt: 'select_account',
    onSuccess: async (tokenResponse) => {
      setError('');
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const info = await res.json();
        setGoogleData({
          access_token: tokenResponse.access_token,
          firstname: info.given_name || '',
          lastname: info.family_name || '',
          email: info.email || '',
        });
        setStep('google-details');
      } catch {
        setError('Could not retrieve your Google account info. Please try again.');
      }
    },
    onError: () => setError('Google sign-in was cancelled or failed.'),
  });

  const handleGoogleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedRole) return setError('Please select a role.');
    if (!employeeId.trim()) return setError('Employee ID is required.');

    setLoading(true);
    try {
      await axios.post(`${API_URL}/staff/register/google/`, {
        access_token: googleData.access_token,
        role: selectedRole,
        employee_id: googleEmployeeId.trim(),
      });
      setStep('success');
    } catch (err) {
      const data = err.response?.data;
      setError(data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card" style={{ maxWidth: '480px' }}>
        <div className="login-header">
          <div className="logo">
            <img src="/logoo.png" alt="eLoan" className="logo-img" />
          </div>
          <h1 className="login-title">Staff Registration</h1>
          <p className="login-subtitle">
            {selectedRole
              ? <>Registering as <span style={{ fontWeight: 700, color: '#17236a' }}>{selectedRole}</span></>
              : 'Create a staff account'}
          </p>
        </div>

        {/* ── Success ─────────────────────────────────────────────────────── */}
        {step === 'success' && (
          <div style={{ padding: '1.5rem 0' }}>
            <div style={{
              background: '#d1fae5', color: '#065f46', padding: '1rem 1.25rem',
              borderRadius: '10px', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: '1.6',
            }}>
              Registration submitted! Your account is pending Super Admin approval.
              You will be notified once approved.
            </div>
            <Link to="/" className="login-button" style={{ textAlign: 'center', display: 'block', textDecoration: 'none' }}>
              Back to Home
            </Link>
          </div>
        )}

        {/* ── Manual form ─────────────────────────────────────────────────── */}
        {step === 'form' && (
          <form onSubmit={handleManualSubmit} className="login-form">
            {error && <div className="error-message">{error}</div>}

            {/* Role — dropdown when no URL role, locked display when pre-set */}
            {!presetRole && (
              <div className="form-group">
                <label htmlFor="role">Role</label>
                <select
                  id="role"
                  value={selectedRole}
                  onChange={(e) => { setSelectedRole(e.target.value); setError(''); }}
                  disabled={loading}
                  style={{
                    width: '100%', padding: '0.75rem 1rem', border: '1.5px solid #e0e0e0',
                    borderRadius: '8px', fontSize: '0.95rem', color: selectedRole ? '#1f2937' : '#9ca3af',
                    background: '#fff', appearance: 'none', cursor: 'pointer',
                  }}
                >
                  <option value="" disabled>Select a role</option>
                  {VALID_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="firstname">First Name</label>
                <input
                  id="firstname"
                  value={firstname}
                  onChange={(e) => { setFirstname(e.target.value); setError(''); }}
                  disabled={loading}
                  placeholder="Juan"
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="lastname">Last Name</label>
                <input
                  id="lastname"
                  value={lastname}
                  onChange={(e) => { setLastname(e.target.value); setError(''); }}
                  disabled={loading}
                  placeholder="Dela Cruz"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                disabled={loading}
                placeholder="you@buksu.edu.ph"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                disabled={loading}
                placeholder="Minimum 8 characters"
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                disabled={loading}
                placeholder="Re-enter password"
              />
            </div>

            <div className="form-group">
              <label htmlFor="employeeId">Employee ID</label>
              <input
                id="employeeId"
                value={employeeId}
                onChange={(e) => { setEmployeeId(e.target.value); setError(''); }}
                disabled={loading}
                placeholder="EMP-001"
              />
            </div>

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? 'Submitting...' : 'Register'}
            </button>

            {/* Google as secondary option */}
            <div className="auth-divider" style={{ margin: '1.25rem 0' }}>
              <div className="auth-divider-line" />
              <span className="auth-divider-text">or</span>
              <div className="auth-divider-line" />
            </div>

            <button
              type="button"
              className="google-button"
              onClick={() => { setError(''); googleAuth(); }}
              disabled={loading}
            >
              <span className="google-icon">G</span>
              Continue with Google
            </button>

            <Link to="/" className="back-to-login" style={{ marginTop: '1.25rem' }}>
              ← Back to Role Selection
            </Link>
          </form>
        )}

        {/* ── Google details (after OAuth) ─────────────────────────────────── */}
        {step === 'google-details' && googleData && (
          <form onSubmit={handleGoogleSubmit} className="login-form">
            {error && <div className="error-message">{error}</div>}

            {!presetRole && (
              <div className="form-group">
                <label htmlFor="g-role">Role</label>
                <select
                  id="g-role"
                  value={selectedRole}
                  onChange={(e) => { setSelectedRole(e.target.value); setError(''); }}
                  disabled={loading}
                  style={{
                    width: '100%', padding: '0.75rem 1rem', border: '1.5px solid #e0e0e0',
                    borderRadius: '8px', fontSize: '0.95rem', color: selectedRole ? '#1f2937' : '#9ca3af',
                    background: '#fff', appearance: 'none', cursor: 'pointer',
                  }}
                >
                  <option value="" disabled>Select a role</option>
                  {VALID_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="firstname">First Name</label>
                <input id="firstname" name="firstname" autoComplete="given-name" value={googleData.firstname} disabled style={{ opacity: 0.7 }} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="lastname">Last Name</label>
                <input id="lastname" name="lastname" autoComplete="family-name" value={googleData.lastname} disabled style={{ opacity: 0.7 }} />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" autoComplete="email" value={googleData.email} disabled style={{ opacity: 0.7 }} />
            </div>

            <div className="form-group">
              <label htmlFor="g-employee-id">Employee ID</label>
              <input
                id="employee_id"
                name="employee_id"
                autoComplete="off"
                value={employeeId}
                onChange={(e) => { setEmployeeId(e.target.value); setError(''); }}
                required
                disabled={loading}
                placeholder="EMP-001"
              />
            </div>

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? 'Submitting...' : 'Complete Registration'}
            </button>

            <button
              type="button"
              onClick={() => { setStep('form'); setGoogleData(null); setError(''); }}
              style={{
                display: 'block', width: '100%', marginTop: '0.75rem', background: 'none',
                border: 'none', color: '#6b7280', fontSize: '0.875rem', cursor: 'pointer',
              }}
            >
              ← Back to registration form
            </button>
          </form>
        )}

        <div className="login-footer">
          <p className="footer-text">eLoan Management System • Staff Access Only</p>
        </div>
      </div>
    </div>
  );
}
