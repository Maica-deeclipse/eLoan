/**
 * Base API Service
 * Handles API calls with authentication interceptors
 */

import axios from 'axios';
import { getItemAsync, setItemAsync, deleteItemAsync } from '../utils/storage';
import { API_URL } from '../config/api.config';
import logger from '../utils/logger';

/** Called when session is invalid (401 + refresh failed). AuthProvider uses this to logout. */
let onUnauthorized = null;

export function setOnUnauthorized(callback) {
  onUnauthorized = callback;
}

/**
 * In-memory token cache — avoids repeated SecureStore reads on every request.
 * SecureStore is encrypted device storage and each read has I/O overhead.
 * Cleared on logout or when a 401 forces token refresh.
 */
let _cachedAccessToken = null;

export function setCachedToken(token) {
  _cachedAccessToken = token;
}

export function clearCachedToken() {
  _cachedAccessToken = null;
}

// Create axios instance
const apiService = axios.create({
  baseURL: API_URL.replace('/auth', ''), // Remove /auth suffix for general API
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    // Tell Django's GZipMiddleware to compress responses — reduces payload 60-80%
    'Accept-Encoding': 'gzip, deflate',
  },
});

// Request interceptor - add auth token
apiService.interceptors.request.use(
  async (config) => {
    try {
      // Use in-memory cache first; fall back to storage only when necessary
      const token = _cachedAccessToken ?? await getItemAsync('accessToken');
      if (token) {
        _cachedAccessToken = token; // keep cache warm
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      logger.error('Error getting token:', error);
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
      clearCachedToken(); // stale token — force fresh read on next request

      try {
        const refreshToken = await getItemAsync('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        // Attempt to refresh token
        const response = await axios.post(`${API_URL}/token/refresh/`, {
          refresh: refreshToken,
        });

        const { access } = response.data;

        // Store new access token and warm up cache
        await setItemAsync('accessToken', access);
        setCachedToken(access);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${access}`;
        return apiService(originalRequest);
      } catch (refreshError) {
        // Refresh failed - clear tokens and notify app to show login
        clearCachedToken();
        await Promise.all([
          deleteItemAsync('accessToken'),
          deleteItemAsync('refreshToken'),
          deleteItemAsync('user'),
        ]);

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
