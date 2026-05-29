import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setCurrentUser(null);
        setLoading(false);
        return;
      }
      const res = await apiFetch('/api/admin/me');
      setCurrentUser(res.data);
    } catch (error) {
      setCurrentUser(null);
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMe();
  }, []);

  const login = async (taikhoan, matkhau) => {
    const res = await apiFetch('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ taikhoan, matkhau }),
    });
    localStorage.setItem('token', res.data.access_token);
    setCurrentUser(res.data.admin);
    return res;
  };

  const register = async (taikhoan, matkhau, hoten, email) => {
    const res = await apiFetch('/api/admin/register', {
      method: 'POST',
      body: JSON.stringify({ taikhoan, matkhau, hoten, email }),
    });
    return res;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        loading,
        login,
        register,
        logout,
        fetchMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

