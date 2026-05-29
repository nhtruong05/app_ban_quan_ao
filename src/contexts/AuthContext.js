import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = async () => {
    console.log('fetchMe start');
    try {
      const token = await AsyncStorage.getItem('token');
      console.log('token:', token);
      if (!token) {
        setCurrentUser(null);
        setLoading(false);
        console.log('no token, done');
        return;
      }
      const res = await apiFetch('/api/admin/me');
      console.log('me res:', res);
      setCurrentUser(res.data);
    } catch(e) {
      console.log('fetchMe error:', e.message);
      setCurrentUser(null);
      await AsyncStorage.removeItem('token');
    } finally {
      setLoading(false);
      console.log('fetchMe done');
    }
  };

  useEffect(() => { fetchMe(); }, []);

  const login = async (taikhoan, matkhau) => {
    const res = await apiFetch('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ taikhoan, matkhau }),
    });
    await AsyncStorage.setItem('token', res.data.access_token);
    setCurrentUser(res.data.admin);
    return res;
  };

  const register = async (taikhoan, matkhau, hoten, email) => {
    return apiFetch('/api/admin/register', {
      method: 'POST',
      body: JSON.stringify({ taikhoan, matkhau, hoten, email }),
    });
  };

  const logout = async () => {
    await AsyncStorage.removeItem('token');
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider value={{ currentUser, loading, login, register, logout, fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
};