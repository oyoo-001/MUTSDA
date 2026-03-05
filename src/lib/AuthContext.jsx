import React, { createContext, useState, useContext, useEffect } from 'react';
import { apiClient } from '@/api/base44Client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    checkUserAuth();
  }, []);

  const checkUserAuth = async () => {
    // The client now has a sync isAuthenticated check
    if (!apiClient.auth.isAuthenticated()) {
      setIsAuthenticated(false);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const currentUser = await apiClient.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Auth check failed:', error);
      // Token is invalid, log out
      logout(false); // Don't redirect
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (credentials) => {
    try {
      const data = await apiClient.auth.login(credentials);
      localStorage.setItem('token', data.token); // The API client needs this
      setUser(data);
      setIsAuthenticated(true);
      setAuthError(null);
      return data;
    } catch (error) {
      console.error('Login failed:', error);
      setAuthError(error.message || 'Login failed');
      throw error;
    }
  };

  const logout = (shouldRedirect = true) => {
    // Use the client's logout method which handles token removal
    apiClient.auth.logout();
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      setUser, // Expose to allow profile updates to refresh context
      isAuthenticated, 
      isLoading,
      authError,
      login,
      logout,
      checkUserAuth // Expose for re-checking state if needed
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
