import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../config/api.config';

const REQUEST_TIMEOUT_MS = 30000;

/**
 * Authentication service for applicant mobile app
 * Handles login, logout, password reset, and token management
 */
class AuthService {
  /**
   * Login applicant user
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<Object>} { success: boolean, user?: Object, error?: string }
   */
  async login(email, password) {
    try {
      const response = await axios.post(
        `${API_URL}/applicant/login/`,
        { email, password },
        { timeout: REQUEST_TIMEOUT_MS }
      );

      if (response.data.tokens) {
        // Store tokens securely
        await SecureStore.setItemAsync('accessToken', response.data.tokens.access);
        await SecureStore.setItemAsync('refreshToken', response.data.tokens.refresh);
        // Store user info (not sensitive, can use AsyncStorage if preferred)
        await SecureStore.setItemAsync('user', JSON.stringify(response.data.user));

        return { success: true, user: response.data.user };
      }

      return { success: false, error: 'Invalid response from server' };
    } catch (error) {
      // Transform error for consistent error handling
      const errorMessage = error.response?.data?.error ||
        'Unable to connect to server. Please check your internet connection.';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Logout user (clear stored tokens)
   */
  async logout() {
    try {
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');
      await SecureStore.deleteItemAsync('user');
    } catch (error) {
      console.error('Logout error:', error);
      // Continue even if deletion fails
    }
  }

  /**
   * Request password reset
   * @param {string} email - User email
   * @returns {Promise<Object>} Response message
   */
  async forgotPassword(email) {
    try {
      const response = await axios.post(
        `${API_URL}/forgot-password/`,
        { email },
        { timeout: REQUEST_TIMEOUT_MS }
      );
      return response.data;
    } catch (error) {
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      throw new Error('Unable to send password reset email.');
    }
  }

  /**
   * Validate password reset token
   * @param {string} uid - User ID (base64 encoded)
   * @param {string} token - Reset token
   * @returns {Promise<Object>} Validation result with user info
   */
  async validateToken(uid, token) {
    try {
      const response = await axios.post(
        `${API_URL}/validate-token/`,
        { uid, token },
        { timeout: REQUEST_TIMEOUT_MS }
      );
      return response.data;
    } catch (error) {
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw new Error('Invalid or expired reset link.');
    }
  }

  /**
   * Set new password
   * @param {string} uid - User ID (base64 encoded)
   * @param {string} token - Reset token
   * @param {string} newPassword - New password
   * @param {string} confirmPassword - Password confirmation
   * @returns {Promise<Object>} Success message
   */
  async setPassword(uid, token, newPassword, confirmPassword) {
    try {
      const response = await axios.post(
        `${API_URL}/set-password/`,
        {
          uid,
          token,
          new_password: newPassword,
          confirm_password: confirmPassword,
        },
        { timeout: REQUEST_TIMEOUT_MS }
      );
      return response.data;
    } catch (error) {
      if (error.response?.data) {
        // Handle validation errors
        const errors = error.response.data;
        if (errors.confirm_password) {
          throw new Error(errors.confirm_password);
        }
        if (errors.new_password) {
          throw new Error(errors.new_password);
        }
      }
      throw new Error('Failed to set password. Please try again.');
    }
  }

  /**
   * Refresh access token
   * @returns {Promise<boolean>} True if refresh successful, false otherwise
   */
  async refreshToken() {
    try {
      const refreshToken = await SecureStore.getItemAsync('refreshToken');

      if (!refreshToken) {
        return false;
      }

      const response = await axios.post(
        `${API_URL}/token/refresh/`,
        { refresh: refreshToken },
        { timeout: REQUEST_TIMEOUT_MS }
      );

      if (response.data.access) {
        await SecureStore.setItemAsync('accessToken', response.data.access);
        return true;
      }

      return false;
    } catch (error) {
      // If refresh fails, user needs to log in again
      console.error('Token refresh error:', error);
      return false;
    }
  }

  /**
   * Get current user from secure storage
   * @returns {Promise<Object|null>} User object or null
   */
  async getCurrentUser() {
    try {
      const userStr = await SecureStore.getItemAsync('user');
      if (userStr) {
        return JSON.parse(userStr);
      }
      return null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  /**
   * Get access token
   * @returns {Promise<string|null>} Access token or null
   */
  async getAccessToken() {
    try {
      return await SecureStore.getItemAsync('accessToken');
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  }

  /**
   * Alias for getAccessToken (used by AuthContext)
   * @returns {Promise<string|null>} Access token or null
   */
  async getToken() {
    return this.getAccessToken();
  }

  /**
   * Get user data from storage (alias for getCurrentUser)
   * @returns {Promise<Object|null>} User data or null
   */
  async getUserData() {
    return this.getCurrentUser();
  }

  /**
   * Check if the current token is still valid
   * @returns {Promise<boolean>} True if token is valid
   */
  async isTokenValid() {
    try {
      const token = await this.getAccessToken();
      if (!token) return false;

      // Decode JWT to check expiration (without verification)
      const parts = token.split('.');
      if (parts.length !== 3) return false;

      const payload = JSON.parse(atob(parts[1]));
      const exp = payload.exp;

      if (!exp) return false;

      // Check if token expires in more than 60 seconds
      const now = Math.floor(Date.now() / 1000);
      return exp > now + 60;
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  }

  /**
   * Check if user is authenticated
   * @returns {Promise<boolean>} Authentication status
   */
  async isAuthenticated() {
    const token = await this.getAccessToken();
    return !!token;
  }
}

export default new AuthService();
