import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../config/api.config';

/**
 * Authentication service for applicant mobile app
 * Handles login, logout, password reset, and token management
 */
class AuthService {
  /**
   * Login applicant user
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<Object>} User data and tokens
   */
  async login(email, password) {
    try {
      const response = await axios.post(`${API_URL}/applicant/login/`, {
        email,
        password,
      });

      if (response.data.tokens) {
        // Store tokens securely
        await SecureStore.setItemAsync('accessToken', response.data.tokens.access);
        await SecureStore.setItemAsync('refreshToken', response.data.tokens.refresh);
        // Store user info (not sensitive, can use AsyncStorage if preferred)
        await SecureStore.setItemAsync('user', JSON.stringify(response.data.user));
      }

      return response.data;
    } catch (error) {
      // Transform error for consistent error handling
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      throw new Error('Unable to connect to server. Please check your internet connection.');
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
      const response = await axios.post(`${API_URL}/forgot-password/`, {
        email,
      });
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
      const response = await axios.post(`${API_URL}/validate-token/`, {
        uid,
        token,
      });
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
      const response = await axios.post(`${API_URL}/set-password/`, {
        uid,
        token,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
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
   * @returns {Promise<string>} New access token
   */
  async refreshToken() {
    try {
      const refreshToken = await SecureStore.getItemAsync('refreshToken');

      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await axios.post(`${API_URL}/token/refresh/`, {
        refresh: refreshToken,
      });

      if (response.data.access) {
        await SecureStore.setItemAsync('accessToken', response.data.access);
        return response.data.access;
      }

      throw new Error('Failed to refresh token');
    } catch (error) {
      // If refresh fails, user needs to log in again
      await this.logout();
      throw error;
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
   * Check if user is authenticated
   * @returns {Promise<boolean>} Authentication status
   */
  async isAuthenticated() {
    const token = await this.getAccessToken();
    return !!token;
  }
}

export default new AuthService();
