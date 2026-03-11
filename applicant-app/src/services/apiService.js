/**
 * Base API Service
 * Handles API calls with authentication interceptors
 */

import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../config/api.config';

/** Called when session is invalid (401 + refresh failed). AuthProvider uses this to logout. */
let onUnauthorized = null;

export function setOnUnauthorized(callback) {
  onUnauthorized = callback;
}

// Create axios instance
const apiService = axios.create({
  baseURL: API_URL.replace('/auth', ''), // Remove /auth suffix for general API
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
apiService.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting token:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle token refresh
apiService.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        // Attempt to refresh token
        const response = await axios.post(`${API_URL}/token/refresh/`, {
          refresh: refreshToken,
        });

        const { access } = response.data;

        // Store new access token
        await SecureStore.setItemAsync('accessToken', access);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${access}`;
        return apiService(originalRequest);
      } catch (refreshError) {
        // Refresh failed - clear tokens and notify app to show login
        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');
        await SecureStore.deleteItemAsync('user');

        if (typeof onUnauthorized === 'function') {
          onUnauthorized();
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiService;
