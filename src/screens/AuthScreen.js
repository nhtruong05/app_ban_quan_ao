// ============================================================
// src/screens/AuthScreen.js
// Màn hình Đăng nhập / Đăng ký
// ============================================================

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { colors, globalStyles } from '../services/theme';
import { Btn, Input } from '../components/UI';

const AuthScreen = () => {
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [loginForm, setLoginForm] = useState({ taikhoan: '', matkhau: '' });
  const [regForm, setRegForm] = useState({ taikhoan: '', matkhau: '', hoten: '', email: '' });
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const { showToast } = useToast();

  const handleLogin = async () => {
    if (!loginForm.taikhoan || !loginForm.matkhau) {
      showToast('Vui lòng nhập đầy đủ thông tin'); return;
    }
    setLoading(true);
    try {
      await login(loginForm.taikhoan, loginForm.matkhau);
      showToast('Đăng nhập thành công!');
    } catch (e) {
      showToast(e.message || 'Đăng nhập thất bại');
    } finally { setLoading(false); }
  };

  const handleRegister = async () => {
    if (!regForm.taikhoan || !regForm.matkhau || !regForm.hoten || !regForm.email) {
      showToast('Vui lòng nhập đầy đủ thông tin'); return;
    }
    setLoading(true);
    try {
      await register(regForm.taikhoan, regForm.matkhau, regForm.hoten, regForm.email);
      showToast('Đăng ký thành công! Vui lòng đăng nhập.');
      setTab('login');
      setRegForm({ taikhoan: '', matkhau: '', hoten: '', email: '' });
    } catch (e) {
      showToast(e.message || 'Đăng ký thất bại');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Logo / Brand */}
        <View style={styles.hero}>
          <Text style={styles.emoji}>👔</Text>
          <Text style={styles.brand}>Admin Đỗ Nhật Trường</Text>
          <Text style={styles.subtitle}>Hệ thống quản lý cửa hàng</Text>
        </View>

        {/* Card */}
        <View style={globalStyles.card}>
          {/* Tab switcher */}
          <View style={styles.tabs}>
            {['login', 'register'].map((t) => (
              <TouchableOpacity
                key={t} onPress={() => setTab(t)}
                style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
              >
                <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                  {t === 'login' ? 'Đăng nhập' : 'Đăng ký'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Login form */}
          {tab === 'login' && (
            <View>
              <Input
                label="Tài khoản"
                value={loginForm.taikhoan}
                onChangeText={(v) => setLoginForm({ ...loginForm, taikhoan: v })}
                placeholder="Nhập tài khoản"
                autoCapitalize="none"
              />
              <Input
                label="Mật khẩu"
                value={loginForm.matkhau}
                onChangeText={(v) => setLoginForm({ ...loginForm, matkhau: v })}
                placeholder="Nhập mật khẩu"
                secureTextEntry
              />
              <View style={{ marginTop: 16 }}>
                <Btn title="Đăng nhập" onPress={handleLogin} loading={loading} />
              </View>
            </View>
          )}

          {/* Register form */}
          {tab === 'register' && (
            <View>
              <Input
                label="Tài khoản"
                value={regForm.taikhoan}
                onChangeText={(v) => setRegForm({ ...regForm, taikhoan: v })}
                placeholder="Nhập tài khoản"
                autoCapitalize="none"
              />
              <Input
                label="Mật khẩu"
                value={regForm.matkhau}
                onChangeText={(v) => setRegForm({ ...regForm, matkhau: v })}
                placeholder="Nhập mật khẩu"
                secureTextEntry
              />
              <Input
                label="Họ tên"
                value={regForm.hoten}
                onChangeText={(v) => setRegForm({ ...regForm, hoten: v })}
                placeholder="Nhập họ tên"
              />
              <Input
                label="Email"
                value={regForm.email}
                onChangeText={(v) => setRegForm({ ...regForm, email: v })}
                placeholder="Nhập email"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <View style={{ marginTop: 16 }}>
                <Btn title="Tạo tài khoản" onPress={handleRegister} loading={loading} />
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  hero: { alignItems: 'center', marginBottom: 32 },
  emoji: { fontSize: 56, marginBottom: 12 },
  brand: { fontSize: 22, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 4 },
  tabs: {
    flexDirection: 'row', gap: 4,
    borderBottomWidth: 2, borderBottomColor: colors.borderLight,
    marginBottom: 24,
  },
  tabBtn: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    borderBottomWidth: 3, borderBottomColor: 'transparent', marginBottom: -2,
  },
  tabBtnActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: 15, fontWeight: '500', color: colors.muted },
  tabTextActive: { color: colors.primary, fontWeight: '700' },
});

export default AuthScreen;
