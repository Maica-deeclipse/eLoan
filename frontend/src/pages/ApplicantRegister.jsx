import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import authService from '../services/auth.service';
import '../styles/Login.css';

export default function ApplicantRegister() {
  const navigate = useNavigate();
  const hasGoogleAuth = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
  const [isManualForm, setIsManualForm] = useState(true);
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/auth';

  const [form, setForm] = useState({
    id: '',
    firstname: '',
    lastname: '',
    email: '',
    password: '',
    confirm_password: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    // Clear field-level error when user starts typing
    if (fieldErrors[e.target.name]) {
      setFieldErrors((prev) => ({ ...prev, [e.target.name]: '' }));
    }
    setServerError('');
  };

  const validateForm = () => {
    const errs = {};
    if (!form.id.trim()) errs.id = 'ID is required.';
    if (!form.firstname.trim()) errs.firstname = 'First name is required.';
    if (!form.lastname.trim()) errs.lastname = 'Last name is required.';
    if (!form.email.trim()) {
      errs.email = 'Email is required.';
    } else if (!form.email.endsWith('@buksu.edu.ph')) {
      errs.email = 'Please use your BukSU institutional email (@buksu.edu.ph).';
    }
    if (!form.password) {
      errs.password = 'Password is required.';
    } else if (form.password.length < 8) {
      errs.password = 'Password must be at least 8 characters.';
    }
    if (!form.confirm_password) {
      errs.confirm_password = 'Please confirm your password.';
    } else if (form.password !== form.confirm_password) {
      errs.confirm_password = 'Passwords do not match.';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API_URL}/register/`, {
        employee_id: form.id,
        firstname: form.firstname,
        lastname: form.lastname,
        email: form.email,
        password: form.password,
      });
      setSuccess('Registration successful! Your account is pending approval. You will be notified once approved.');
      setForm({
        id: '',
        firstname: '',
        lastname: '',
        email: '',
        password: '',
        confirm_password: '',
      });
      setFieldErrors({});
    } catch (err) {
      const data = err.response?.data;
      if (data?.email) {
        setFieldErrors((prev) => ({ ...prev, email: Array.isArray(data.email) ? data.email[0] : data.email }));
      } else if (data?.employee_id) {
        setFieldErrors((prev) => ({ ...prev, id: Array.isArray(data.employee_id) ? data.employee_id[0] : data.employee_id }));
      } else if (data?.error) {
        setServerError(data.error);
      } else if (data?.non_field_errors) {
        const errors = Array.isArray(data.non_field_errors) ? data.non_field_errors : Object.values(data).flat();
        setServerError(errors[0] || 'Registration failed. Please try again.');
      } else {
        setServerError('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setLoading(true);
    try {
      await authService.googleAuth(credentialResponse.credential);
      setSuccess('Registration successful! Welcome to eLoan.');
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err) {
      const data = err.response?.data;
      if (data?.error) {
        setError(data.error);
      } else {
        setError('Google authentication failed. Please try again or use manual registration.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google authentication failed. Please try again or use manual registration.');
  };

  if (success) {
    return (
      <div className="login-container">
        <div className="login-card" style={{ maxWidth: '480px' }}>
          <div className="login-header">
            <div className="logo">
              <span className="logo-icon">$</span>
              <span className="logo-text">eLoan</span>
            </div>
            <h1 className="login-title">Registration Successful</h1>
          </div>

          <div style={{ padding: '1.5rem 0' }}>
            <div
              style={{
                background: '#d1fae5',
                color: '#065f46',
                padding: '1rem 1.25rem',
                borderRadius: '10px',
                fontSize: '0.9rem',
                marginBottom: '1.25rem',
                lineHeight: '1.6',
              }}
            >
              {success}
            </div>
            <Link to="/" className="login-button" style={{ textAlign: 'center', display: 'block', textDecoration: 'none' }}>
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card" style={{ maxWidth: '520px' }}>
        <div className="login-header">
          <div className="logo">
            <span className="logo-icon">$</span>
            <span className="logo-text">eLoan</span>
          </div>
          <h1 className="login-title">Applicant Registration</h1>
          <p className="login-subtitle">Create your account to apply for loans</p>
        </div>

        {serverError && (
          <div
            style={{
              background: '#fee2e2',
              color: '#991b1b',
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              marginBottom: '1.25rem',
              fontSize: '0.9rem',
            }}
          >
            {serverError}
          </div>
        )}

        <div style={{ marginBottom: '1.5rem' }}>
          <button
            onClick={() => setIsManualForm(true)}
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '6px',
              border: '1px solid #e5e7eb',
              background: isManualForm ? '#6366f1' : '#f3f4f6',
              color: isManualForm ? '#fff' : '#374151',
              cursor: 'pointer',
              marginBottom: '0.75rem',
              fontWeight: '500',
              transition: 'all 0.2s',
            }}
          >
            Manual Registration
          </button>
          <button
            onClick={() => {
              if (hasGoogleAuth) {
                setIsManualForm(false);
              }
            }}
            disabled={!hasGoogleAuth}
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '6px',
              border: '1px solid #e5e7eb',
              background: !isManualForm ? '#6366f1' : '#f3f4f6',
              color: !isManualForm ? '#fff' : '#374151',
              cursor: hasGoogleAuth ? 'pointer' : 'not-allowed',
              opacity: hasGoogleAuth ? 1 : 0.6,
              fontWeight: '500',
              transition: 'all 0.2s',
            }}
          >
            Sign in with Google
          </button>
        </div>

        {!hasGoogleAuth && (
          <div
            style={{
              background: '#eff6ff',
              color: '#1d4ed8',
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              marginBottom: '1.25rem',
              fontSize: '0.9rem',
            }}
          >
            Google registration is unavailable because VITE_GOOGLE_CLIENT_ID is not configured.
          </div>
        )}

        {isManualForm ? (
          <form onSubmit={handleSubmit} className="login-form">
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="id" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500', color: '#374151' }}>
                ID <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                id="id"
                name="id"
                value={form.id}
                onChange={handleChange}
                placeholder="Enter your institutional ID"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: `1px solid ${fieldErrors.id ? '#dc2626' : '#d1d5db'}`,
                  borderRadius: '6px',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                  background: fieldErrors.id ? '#fff5f5' : undefined,
                  boxShadow: fieldErrors.id ? '0 0 0 3px rgba(220,38,38,0.12)' : undefined,
                }}
              />
              {fieldErrors.id && <span className="field-error-msg">{fieldErrors.id}</span>}
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="firstname" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500', color: '#374151' }}>
                First Name <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                id="firstname"
                name="firstname"
                value={form.firstname}
                onChange={handleChange}
                placeholder="Enter your first name"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: `1px solid ${fieldErrors.firstname ? '#dc2626' : '#d1d5db'}`,
                  borderRadius: '6px',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                  background: fieldErrors.firstname ? '#fff5f5' : undefined,
                  boxShadow: fieldErrors.firstname ? '0 0 0 3px rgba(220,38,38,0.12)' : undefined,
                }}
              />
              {fieldErrors.firstname && <span className="field-error-msg">{fieldErrors.firstname}</span>}
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="lastname" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500', color: '#374151' }}>
                Last Name <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                id="lastname"
                name="lastname"
                value={form.lastname}
                onChange={handleChange}
                placeholder="Enter your last name"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: `1px solid ${fieldErrors.lastname ? '#dc2626' : '#d1d5db'}`,
                  borderRadius: '6px',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                  background: fieldErrors.lastname ? '#fff5f5' : undefined,
                  boxShadow: fieldErrors.lastname ? '0 0 0 3px rgba(220,38,38,0.12)' : undefined,
                }}
              />
              {fieldErrors.lastname && <span className="field-error-msg">{fieldErrors.lastname}</span>}
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="email" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500', color: '#374151' }}>
                Institutional Email <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="your.name@buksu.edu.ph"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: `1px solid ${fieldErrors.email ? '#dc2626' : '#d1d5db'}`,
                  borderRadius: '6px',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                  background: fieldErrors.email ? '#fff5f5' : undefined,
                  boxShadow: fieldErrors.email ? '0 0 0 3px rgba(220,38,38,0.12)' : undefined,
                }}
              />
              {fieldErrors.email && <span className="field-error-msg">{fieldErrors.email}</span>}
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="password" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500', color: '#374151' }}>
                Password <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="At least 8 characters"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: `1px solid ${fieldErrors.password ? '#dc2626' : '#d1d5db'}`,
                  borderRadius: '6px',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                  background: fieldErrors.password ? '#fff5f5' : undefined,
                  boxShadow: fieldErrors.password ? '0 0 0 3px rgba(220,38,38,0.12)' : undefined,
                }}
              />
              {fieldErrors.password && <span className="field-error-msg">{fieldErrors.password}</span>}
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="confirm_password" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500', color: '#374151' }}>
                Confirm Password <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="password"
                id="confirm_password"
                name="confirm_password"
                value={form.confirm_password}
                onChange={handleChange}
                placeholder="Confirm your password"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: `1px solid ${fieldErrors.confirm_password ? '#dc2626' : '#d1d5db'}`,
                  borderRadius: '6px',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                  background: fieldErrors.confirm_password ? '#fff5f5' : undefined,
                  boxShadow: fieldErrors.confirm_password ? '0 0 0 3px rgba(220,38,38,0.12)' : undefined,
                }}
              />
              {fieldErrors.confirm_password && <span className="field-error-msg">{fieldErrors.confirm_password}</span>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="login-button"
              style={{
                opacity: loading ? 0.6 : 1,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Registering...' : 'Register'}
            </button>
          </form>
        ) : hasGoogleAuth ? (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              locale="en"
              width="320"
              theme="outline"
            />
            <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#6b7280' }}>
              Use your @buksu.edu.ph Google account to register
            </p>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem 0', color: '#6b7280' }}>
            Configure VITE_GOOGLE_CLIENT_ID to enable Google registration.
          </div>
        )}

        <div style={{ marginTop: '1.5rem', textAlign: 'center', borderTop: '1px solid #e5e7eb', paddingTop: '1.5rem' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#6b7280' }}>
            Already have an account?{' '}
            <Link to="/" style={{ color: '#6366f1', textDecoration: 'none', fontWeight: '500' }}>
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
