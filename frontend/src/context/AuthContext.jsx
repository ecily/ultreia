/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [providerId, setProviderId] = useState(null);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedProviderId = localStorage.getItem('providerId');

    if (storedToken) setToken(storedToken);
    if (storedProviderId) setProviderId(storedProviderId);
  }, []);

  const login = (token, providerId) => {
    localStorage.setItem('token', token);
    localStorage.setItem('providerId', providerId);
    setToken(token);
    setProviderId(providerId);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('providerId');
    setToken(null);
    setProviderId(null);
  };

  return (
    <AuthContext.Provider value={{ token, providerId, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook zum einfachen Zugriff
export const useAuth = () => useContext(AuthContext);
