import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import authService from '../services/auth.service';
import '../styles/Login.css';

function Login() {
  const navigate = useNavigate();
  const { role: urlRole } = useParams(); // Get role from URL parameter

  // Map URL role to actual role name
  const getRoleName = (urlRole) => {
    const roleMap = {
      'admin': 'Super Administrator',
      'Bookkeeper': 'Bookkeeper',
      'Treasurer': 'Treasurer',
      'Credit Committee': 'Credit Committee',
    };
    return roleMap[urlRole] || urlRole || '';
  };

  const roleName = getRoleName(urlRole);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: roleName // Auto-populate role from URL
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Determine page title based on role
  const displayRole = urlRole === 'admin' ? 'Super Administrator' : urlRole;
  const pageTitle = displayRole ? `${displayRole} Login` : 'Staff Login';
  const pageSubtitle = displayRole ? `Sign in to ${displayRole} Portal` : 'Sign in to your account';

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError(''); // Clear error when user types
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate role is selected
    if (!formData.role) {
      setError('Please select your role.');
      return;
    }

    setLoading(true);

    try {
      const response = await authService.login(formData.email, formData.password, formData.role);

      // Redirect based on role
      const role = response.user.role;

      switch (role) {
        case 'Bookkeeper':
          navigate('/bookkeeper/dashboard');
          break;
        case 'Treasurer':
          navigate('/treasurer/dashboard');
          break;
        case 'Credit Committee':
          navigate('/credit-committee/dashboard');
          break;
        case 'Super Administrator':
          navigate('/admin/dashboard');
          break;
        default:
          navigate('/dashboard');
      }
    } catch (err) {
      if (err.response?.data) {
        // Handle different error formats
        if (typeof err.response.data.error === 'string') {
          setError(err.response.data.error);
        } else if (err.response.data.non_field_errors) {
          setError(err.response.data.non_field_errors[0]);
        } else {
          setError('Invalid email or password.');
        }
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
            <span className="logo-icon">$</span>
            <span className="logo-text">eLoan</span>
          </div>
          <h1 className="login-title">{pageTitle}</h1>
          <p className="login-subtitle">{pageSubtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@company.com"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>

          <div className="form-footer">
            <Link to="/forgot-password" className="forgot-link">
              Forgot Password?
            </Link>
          </div>

          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>

          <Link to="/" className="back-to-login">
            ← Back to Role Selection
          </Link>
        </form>

        <div className="login-footer">
          <p className="footer-text">
            eLoan Management System • Staff Access Only
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
