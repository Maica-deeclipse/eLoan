import { useState } from 'react';
import { Link } from 'react-router-dom';
import authService from '../services/auth.service';
import '../styles/Login.css';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const response = await authService.forgotPassword(email);
      setMessage(response.message);
      setSubmitted(true);
    } catch (err) {
      if (err.response?.data) {
        setError(err.response.data.error || 'Failed to send password reset email.');
      } else {
        setError('Unable to connect to server. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="logo">
            <img src="/logoo.png" alt="eLoan" className="logo-img" />
          </div>
          <h1 className="login-title">Forgot Password?</h1>
          <p className="login-subtitle">
            {submitted
              ? 'Check your email'
              : 'Enter your email to receive a password reset link'}
          </p>
        </div>

        {submitted ? (
          <div className="success-container">
            <div className="success-icon">✓</div>
            <div className="success-message">
              <p>{message}</p>
              <p className="success-note">
                Please check your email inbox (and spam folder) for the password reset link.
              </p>
            </div>
            <Link to="/login" className="back-to-login">
              Back to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="login-form">
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            {message && (
              <div className="success-message">
                {message}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="login-button"
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>

            <div className="form-footer center">
              <Link to="/login" className="forgot-link">
                Back to Login
              </Link>
            </div>
          </form>
        )}

        <div className="login-footer">
          <p className="footer-text">
            eLoan Management System • Staff Access Only
          </p>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
