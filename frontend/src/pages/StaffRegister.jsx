import { useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import ReCAPTCHA from 'react-google-recaptcha';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/auth';
const VALID_ROLES = ['Bookkeeper', 'Treasurer', 'Credit Committee', 'Account Member Officer'];
const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';

export default function StaffRegister() {
  const { role: urlRole } = useParams();
  const presetRole = VALID_ROLES.includes(urlRole) ? urlRole : '';

  // step: 'form' | 'google-details' | 'success'
  const [step, setStep] = useState('form');
  const [googleData, setGoogleData] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const captchaRef = useRef(null);

  // Manual form state
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [selectedRole, setSelectedRole] = useState(presetRole);

  // Helper: clear a single field error on change
  const clearFieldError = (name) => {
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    setServerError('');
  };

  // ── Manual registration ───────────────────────────────────────────────────
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    const errs = {};
    if (!selectedRole) errs.role = 'Please select a role.';
    if (!firstname.trim()) errs.firstname = 'First name is required.';
    if (!lastname.trim()) errs.lastname = 'Last name is required.';
    if (!email.trim()) errs.email = 'Email is required.';
    if (!password) {
      errs.password = 'Password is required.';
    } else if (password.length < 8) {
      errs.password = 'Password must be at least 8 characters.';
    }
    if (!confirmPassword) {
      errs.confirmPassword = 'Please confirm your password.';
    } else if (password !== confirmPassword) {
      errs.confirmPassword = 'Passwords do not match.';
    }
    if (!employeeId.trim()) errs.employeeId = 'Employee ID is required.';
    const captchaToken = captchaRef.current?.getValue() || '';
    if (RECAPTCHA_SITE_KEY && !captchaToken) errs.captcha = 'Please complete the CAPTCHA verification.';

    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      await axios.post(`${API_URL}/staff/register/`, {
        firstname: firstname.trim(),
        lastname: lastname.trim(),
        email: email.trim().toLowerCase(),
        password,
        role: selectedRole,
        employee_id: employeeId.trim(),
        captcha_token: captchaToken,
      });
      setFieldErrors({});
      setStep('success');
    } catch (err) {
      captchaRef.current?.reset();
      const data = err.response?.data;
      // Map server field errors to inline errors where possible
      if (data && typeof data === 'object') {
        if (data.email) {
          setFieldErrors((prev) => ({ ...prev, email: Array.isArray(data.email) ? data.email[0] : data.email }));
        } else if (data.employee_id) {
          setFieldErrors((prev) => ({ ...prev, employeeId: Array.isArray(data.employee_id) ? data.employee_id[0] : data.employee_id }));
        } else {
          const firstError = Object.values(data).flat()[0];
          setServerError(firstError || data?.error || 'Registration failed. Please try again.');
        }
      } else {
        setServerError('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Google registration ───────────────────────────────────────────────────
  const googleAuth = useGoogleLogin({
    prompt: 'select_account',
    onSuccess: async (tokenResponse) => {
      setServerError('');
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
        setServerError('Could not retrieve your Google account info. Please try again.');
      }
    },
    onError: () => setServerError('Google sign-in was cancelled or failed.'),
  });

  const handleGoogleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    const errs = {};
    if (!selectedRole) errs.role = 'Please select a role.';
    if (!employeeId.trim()) errs.employeeId = 'Employee ID is required.';
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      await axios.post(`${API_URL}/staff/register/google/`, {
        access_token: googleData.access_token,
        role: selectedRole,
        employee_id: employeeId.trim(),
      });
      setFieldErrors({});
      setStep('success');
    } catch (err) {
      const data = err.response?.data;
      setServerError(data?.error || 'Registration failed. Please try again.');
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
            {serverError && <div className="error-message">{serverError}</div>}
            {fieldErrors.captcha && <div className="error-message">{fieldErrors.captcha}</div>}

            {/* Role — dropdown when no URL role, locked display when pre-set */}
            {!presetRole && (
              <div className="form-group">
                <label htmlFor="role">Role <span style={{ color: '#dc2626' }}>*</span></label>
                <select
                  id="role"
                  name="role"
                  value={selectedRole}
                  onChange={(e) => { setSelectedRole(e.target.value); clearFieldError('role'); }}
                  disabled={loading}
                  style={{
                    width: '100%', padding: '0.75rem 1rem',
                    border: `1.5px solid ${fieldErrors.role ? '#dc2626' : '#e0e0e0'}`,
                    borderRadius: '8px', fontSize: '0.95rem', color: selectedRole ? '#1f2937' : '#9ca3af',
                    background: fieldErrors.role ? '#fff5f5' : '#fff', appearance: 'none', cursor: 'pointer',
                  }}
                >
                  <option value="" disabled>Select a role</option>
                  {VALID_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                {fieldErrors.role && <span className="field-error-msg">{fieldErrors.role}</span>}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="firstname">First Name <span style={{ color: '#dc2626' }}>*</span></label>
                <input
                  id="firstname"
                  name="firstname"
                  autoComplete="given-name"
                  value={firstname}
                  onChange={(e) => { setFirstname(e.target.value); clearFieldError('firstname'); }}
                  disabled={loading}
                  placeholder="Juan"
                  className={fieldErrors.firstname ? 'input-error' : ''}
                />
                {fieldErrors.firstname && <span className="field-error-msg">{fieldErrors.firstname}</span>}
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="lastname">Last Name <span style={{ color: '#dc2626' }}>*</span></label>
                <input
                  id="lastname"
                  name="lastname"
                  autoComplete="family-name"
                  value={lastname}
                  onChange={(e) => { setLastname(e.target.value); clearFieldError('lastname'); }}
                  disabled={loading}
                  placeholder="Dela Cruz"
                  className={fieldErrors.lastname ? 'input-error' : ''}
                />
                {fieldErrors.lastname && <span className="field-error-msg">{fieldErrors.lastname}</span>}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="email">Email <span style={{ color: '#dc2626' }}>*</span></label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearFieldError('email'); }}
                disabled={loading}
                placeholder="you@buksu.edu.ph"
                className={fieldErrors.email ? 'input-error' : ''}
              />
              {fieldErrors.email && <span className="field-error-msg">{fieldErrors.email}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="password">Password <span style={{ color: '#dc2626' }}>*</span></label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); clearFieldError('password'); }}
                disabled={loading}
                placeholder="Minimum 8 characters"
                className={fieldErrors.password ? 'input-error' : ''}
              />
              {fieldErrors.password && <span className="field-error-msg">{fieldErrors.password}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password <span style={{ color: '#dc2626' }}>*</span></label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); clearFieldError('confirmPassword'); }}
                disabled={loading}
                placeholder="Re-enter password"
                className={fieldErrors.confirmPassword ? 'input-error' : ''}
              />
              {fieldErrors.confirmPassword && <span className="field-error-msg">{fieldErrors.confirmPassword}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="employeeId">Employee ID <span style={{ color: '#dc2626' }}>*</span></label>
              <input
                id="employeeId"
                name="employeeId"
                autoComplete="off"
                value={employeeId}
                onChange={(e) => { setEmployeeId(e.target.value); clearFieldError('employeeId'); }}
                disabled={loading}
                placeholder="EMP-001"
                className={fieldErrors.employeeId ? 'input-error' : ''}
              />
              {fieldErrors.employeeId && <span className="field-error-msg">{fieldErrors.employeeId}</span>}
            </div>

            {RECAPTCHA_SITE_KEY && (
              <div style={{ display: 'flex', justifyContent: 'center', margin: '0.75rem 0' }}>
                <ReCAPTCHA ref={captchaRef} sitekey={RECAPTCHA_SITE_KEY} />
              </div>
            )}

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
            {serverError && <div className="error-message">{serverError}</div>}

            {!presetRole && (
              <div className="form-group">
                <label htmlFor="g-role">Role <span style={{ color: '#dc2626' }}>*</span></label>
                <select
                  id="g-role"
                  value={selectedRole}
                  onChange={(e) => { setSelectedRole(e.target.value); clearFieldError('role'); }}
                  disabled={loading}
                  style={{
                    width: '100%', padding: '0.75rem 1rem',
                    border: `1.5px solid ${fieldErrors.role ? '#dc2626' : '#e0e0e0'}`,
                    borderRadius: '8px', fontSize: '0.95rem', color: selectedRole ? '#1f2937' : '#9ca3af',
                    background: fieldErrors.role ? '#fff5f5' : '#fff', appearance: 'none', cursor: 'pointer',
                  }}
                >
                  <option value="" disabled>Select a role</option>
                  {VALID_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                {fieldErrors.role && <span className="field-error-msg">{fieldErrors.role}</span>}
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
              <label htmlFor="g-employee-id">Employee ID <span style={{ color: '#dc2626' }}>*</span></label>
              <input
                id="employee_id"
                name="employee_id"
                autoComplete="off"
                value={employeeId}
                onChange={(e) => { setEmployeeId(e.target.value); clearFieldError('employeeId'); }}
                disabled={loading}
                placeholder="EMP-001"
                className={fieldErrors.employeeId ? 'input-error' : ''}
              />
              {fieldErrors.employeeId && <span className="field-error-msg">{fieldErrors.employeeId}</span>}
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
