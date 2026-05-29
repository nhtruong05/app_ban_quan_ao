// ============================================================
// src/contexts/ToastContext.js
// Hiển thị thông báo nhanh (Toast) dạng overlay
// ============================================================

import React, { createContext, useContext, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, Platform,
} from 'react-native';

const ToastContext = createContext(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

export const ToastProvider = ({ children }) => {
  const [message, setMessage] = useState('');
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);

  const showToast = (msg) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMessage(msg);
    Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    timerRef.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() =>
        setMessage('')
      );
    }, 2500);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {message !== '' && (
        <Animated.View style={[styles.toast, { opacity }]}>
          <Text style={styles.text}>{message}</Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 24,
    left: 24,
    right: 24,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    zIndex: 9999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});
