import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

const VALID_ROLES = ['Bookkeeper', 'Treasurer', 'Credit Committee', 'Account Member Officer'];

export default function StaffRegister() {
  const { role: urlRole } = useParams();

  const [form, setForm] = useState({
    firstname: '',
    lastname: '',
    email: '',
    employee_id: '',
    password: '',
    confirm_password: '',
    role: VALID_ROLES.includes(urlRole) ? urlRole : '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.role) {
      setError('Role not detected. Please go back and select your role from the Role Selection page.');
      return;
    }
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      await axios.post('http://localhost:8000/api/auth/staff/register/', {
        firstname: form.firstname,
        lastname: form.lastname,
        email: form.email,
        employee_id: form.employee_id,
        password: form.password,
        role: form.role,
      });
      setSuccess('Registration submitted! Your account is pending Super Admin approval. You will be notified once approved.');
    } catch (err) {
      const data = err.response?.data;
      if (data?.email) {
        setError(data.email[0]);
      } else if (data?.error) {
        setError(data.error);
      } else if (data?.non_field_errors) {
        setError(data.non_field_errors[0]);
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card" style={{ maxWidth: '480px' }}>
        <div className="login-header">
          <div className="logo">
            <span className="logo-icon">$</span>
            <span className="logo-text">eLoan</span>
          </div>
          <h1 className="login-title">Staff Registration</h1>
          <p className="login-subtitle">
            Registering as{' '}
            <span style={{ fontWeight: 700, color: '#6366f1' }}>{form.role || 'Staff'}</span>
          </p>
        </div>

        {success ? (
          <div style={{ padding: '1.5rem 0' }}>
            <div style={{
              background: '#d1fae5', color: '#065f46', padding: '1rem 1.25rem',
              borderRadius: '10px', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: '1.6',
            }}>
              {success}
            </div>
            <Link to="/" className="login-button" style={{ textAlign: 'center', display: 'block', textDecoration: 'none' }}>
              Back to Home
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="login-form">
            {error && <div className="error-message">{error}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="firstname">First Name</label>
                <input id="firstname" name="firstname" value={form.firstname} onChange={handleChange} required disabled={loading} placeholder="Juan" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="lastname">Last Name</label>
                <input id="lastname" name="lastname" value={form.lastname} onChange={handleChange} required disabled={loading} placeholder="dela Cruz" />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input type="email" id="email" name="email" value={form.email} onChange={handleChange} required disabled={loading} placeholder="you@company.com" />
            </div>

            <div className="form-group">
              <label htmlFor="employee_id">Employee ID</label>
              <input id="employee_id" name="employee_id" value={form.employee_id} onChange={handleChange} required disabled={loading} placeholder="EMP-001" />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input type="password" id="password" name="password" value={form.password} onChange={handleChange} required disabled={loading} placeholder="Min. 8 characters" />
            </div>

            <div className="form-group">
              <label htmlFor="confirm_password">Confirm Password</label>
              <input type="password" id="confirm_password" name="confirm_password" value={form.confirm_password} onChange={handleChange} required disabled={loading} placeholder="Re-enter password" />
            </div>

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Registration'}
            </button>

            <Link to="/" className="back-to-login">← Back to Role Selection</Link>
          </form>
        )}

        <div className="login-footer">
          <p className="footer-text">eLoan Management System • Staff Access Only</p>
        </div>
      </div>
    </div>
  );
}