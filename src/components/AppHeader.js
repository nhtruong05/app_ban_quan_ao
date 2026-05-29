// ============================================================
// src/components/AppHeader.js
// Header chung cho các màn hình (hiển thị tên màn + user info)
// ============================================================

import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, Platform, StatusBar,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { colors } from '../services/theme';

const AppHeader = ({ title }) => {
  const { currentUser, logout } = useAuth();
  const { showToast } = useToast();

  const handleLogout = () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc muốn đăng xuất?', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: async () => {
          await logout();
          showToast('Đã đăng xuất');
        },
      },
    ]);
  };

  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.brand}>👔 Admin Panel</Text>
        <Text style={styles.screenTitle}>{title}</Text>
      </View>
      <View style={styles.right}>
        {currentUser && (
          <Text style={styles.userText} numberOfLines={1}>
            {currentUser.hoten || currentUser.taikhoan}
          </Text>
        )}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 54 : (StatusBar.currentHeight || 24) + 8,
    paddingBottom: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 4,
  },
  brand: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  screenTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  right: { alignItems: 'flex-end', gap: 4 },
  userText: {
    fontSize: 12, color: colors.muted,
    maxWidth: 140, textAlign: 'right',
  },
  logoutBtn: {
    backgroundColor: colors.bgSoft,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 10, borderWidth: 1, borderColor: colors.border,
  },
  logoutText: { fontSize: 13, color: colors.text, fontWeight: '500' },
});

export default AppHeader;
