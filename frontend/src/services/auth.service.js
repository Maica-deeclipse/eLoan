import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/auth';

class AuthService {
  /**
   * Login staff member
   * @param {string} email
   * @param {string} password
   * @param {string} role
   * @returns {Promise} User data and tokens
   */
  async login(email, password, role) {
    const response = await axios.post(`${API_URL}/login/`, {
      email,
      password,
      role
    });

    if (response.data.tokens) {
      // Store tokens in localStorage
      localStorage.setItem('accessToken', response.data.tokens.access);
      localStorage.setItem('refreshToken', response.data.tokens.refresh);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }

    return response.data;
  }

  /**
   * Logout user
   */
  logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }

  /**
   * Request password reset
   * @param {string} email
   * @returns {Promise}
   */
  async forgotPassword(email) {
    const response = await axios.post(`${API_URL}/forgot-password/`, {
      email
    });
    return response.data;
  }

  /**
   * Validate password reset token
   * @param {string} uid
   * @param {string} token
   * @returns {Promise}
   */
  async validateToken(uid, token) {
    const response = await axios.post(`${API_URL}/validate-token/`, {
      uid,
      token
    });
    return response.data;
  }

  /**
   * Set new password
   * @param {string} uid
   * @param {string} token
   * @param {string} newPassword
   * @param {string} confirmPassword
   * @returns {Promise}
   */
  async setPassword(uid, token, newPassword, confirmPassword) {
    const response = await axios.post(`${API_URL}/set-password/`, {
      uid,
      token,
      new_password: newPassword,
      confirm_password: confirmPassword
    });
    return response.data;
  }

  /**
   * Refresh access token
   * @returns {Promise}
   */
  async refreshToken() {
    const refreshToken = localStorage.getItem('refreshToken');

    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await axios.post(`${API_URL}/token/refresh/`, {
      refresh: refreshToken
    });

    if (response.data.access) {
      localStorage.setItem('accessToken', response.data.access);
    }

    return response.data;
  }

  /**
   * Get current user from localStorage
   * @returns {Object|null}
   */
  getCurrentUser() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      return JSON.parse(userStr);
    }
    return null;
  }

  /**
   * Get access token
   * @returns {string|null}
   */
  getAccessToken() {
    return localStorage.getItem('accessToken');
  }

  /**
   * Login superadmin via email/password (is_superuser only)
   * @param {string} email
   * @param {string} password
   * @returns {Promise}
   */
  async superAdminLogin(email, password) {
    const response = await axios.post(`${API_URL}/superadmin/login/`, { email, password });
    if (response.data.tokens) {
      localStorage.setItem('accessToken', response.data.tokens.access);
      localStorage.setItem('refreshToken', response.data.tokens.refresh);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  }

  /**
   * Login staff member via Google OAuth
   * @param {string} googleAccessToken - Access token from Google OAuth
   * @returns {Promise} User data and tokens
   */
  async googleLogin(googleAccessToken, role = '') {
    const response = await axios.post(`${API_URL}/google/staff/`, {
      access_token: googleAccessToken,
      role,
    });

    if (response.data.tokens) {
      localStorage.setItem('accessToken', response.data.tokens.access);
      localStorage.setItem('refreshToken', response.data.tokens.refresh);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }

    return response.data;
  }

  /**
   * Check if user is authenticated
   * @returns {boolean}
   */
  isAuthenticated() {
    return !!this.getAccessToken();
  }
}

export default new AuthService();
