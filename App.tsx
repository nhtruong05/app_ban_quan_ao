import React from 'react';
import { AuthProvider } from './src/contexts/AuthContext';
import { ToastProvider } from './src/contexts/ToastContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppNavigator />
      </ToastProvider>
    </AuthProvider>
  );
}