/**
 * Authentication Context
 * Manages user authentication state throughout the app
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import authService from '../services/authService';
import { setOnUnauthorized } from '../services/apiService';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  // When apiService gets 401 and refresh fails, it clears tokens and calls this so we show login
  useEffect(() => {
    setOnUnauthorized(() => {
      setUser(null);
      setIsAuthenticated(false);
    });
    return () => setOnUnauthorized(null);
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = await authService.getToken();
      if (token) {
        // Verify token is still valid by checking if we can get user data
        const isValid = await authService.isTokenValid();
        if (isValid) {
          const userData = await authService.getUserData();
          setUser(userData);
          setIsAuthenticated(true);
        } else {
          // Try to refresh
          const refreshed = await authService.refreshToken();
          if (refreshed) {
            const userData = await authService.getUserData();
            setUser(userData);
            setIsAuthenticated(true);
          } else {
            await logout();
          }
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
      await logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const result = await authService.login(email, password);
      if (result.success) {
        setUser(result.user);
        setIsAuthenticated(true);
        return { success: true };
      }
      return { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: 'Login failed. Please try again.' };
    }
  };

  const googleLogin = async (googleAccessToken) => {
    try {
      const result = await authService.googleLogin(googleAccessToken);
      if (result.success) {
        setUser(result.user);
        setIsAuthenticated(true);
        return { success: true };
      }
      return {
        success: false,
        error: result.error,
        isPending: result.isPending,
        isNew: result.isNew,
        message: result.message,
      };
    } catch (error) {
      return { success: false, error: 'Google login failed. Please try again.' };
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const updateUser = (userData) => {
    setUser(prev => ({ ...prev, ...userData }));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        loading,
        login,
        googleLogin,
        logout,
        updateUser,
        checkAuthStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
