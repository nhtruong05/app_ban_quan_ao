// ============================================================
// src/components/UI.js
// Các component tái sử dụng: Button, Input, Modal, KpiCard, Pill
// ============================================================

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  Modal, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { colors, globalStyles } from '../services/theme';

// ---- Button ----
export const Btn = ({ title, onPress, variant = 'primary', style, disabled, loading }) => {
  const styleMap = {
    primary: { bg: colors.primary, text: '#fff' },
    secondary: { bg: '#fff', text: colors.text },
    danger: { bg: colors.danger, text: '#fff' },
    warn: { bg: colors.warn, text: '#fff' },
  };
  const s = styleMap[variant] || styleMap.primary;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.btn,
        { backgroundColor: s.bg },
        variant === 'secondary' && { borderWidth: 1, borderColor: colors.border },
        (disabled || loading) && { opacity: 0.5 },
        style,
      ]}
      activeOpacity={0.75}
    >
      {loading
        ? <ActivityIndicator color={s.text} size="small" />
        : <Text style={[styles.btnText, { color: s.text }]}>{title}</Text>
      }
    </TouchableOpacity>
  );
};

// ---- Input ----
export const Input = ({ label, ...props }) => {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: 4 }}>
      {label && <Text style={globalStyles.label}>{label}</Text>}
      <TextInput
        style={[globalStyles.input, focused && globalStyles.inputFocused]}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholderTextColor={colors.muted}
        {...props}
      />
    </View>
  );
};

// ---- BottomModal ----
export const BottomModal = ({ visible, onClose, title, children }) => (
  <Modal
    visible={visible}
    animationType="slide"
    transparent
    onRequestClose={onClose}
  >
    <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
    <View style={styles.sheet}>
      <View style={styles.handle} />
      <View style={styles.sheetHeader}>
        <Text style={styles.sheetTitle}>{title}</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={{ fontSize: 22, color: colors.muted }}>✕</Text>
        </TouchableOpacity>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </View>
  </Modal>
);

// ---- KpiCard ----
export const KpiCard = ({ label, value, color }) => (
  <View style={[styles.kpiCard, color && { borderLeftColor: color }]}>
    <Text style={styles.kpiLabel}>{label}</Text>
    <Text style={styles.kpiValue} numberOfLines={2}>{value}</Text>
  </View>
);

// ---- Pill ----
export const Pill = ({ label }) => (
  <View style={styles.pill}>
    <Text style={styles.pillText}>{label}</Text>
  </View>
);

// ---- StatusBadge ----
const STATUS_COLORS = {
  'Chờ xác nhận': { bg: '#fef9c3', text: '#854d0e' },
  'Đã xác nhận': { bg: '#dbeafe', text: '#1d4ed8' },
  'Đang giao': { bg: '#e0f2fe', text: '#0369a1' },
  'Đã thanh toán': { bg: '#dcfce7', text: '#166534' },
  'Hoàn thành': { bg: '#d1fae5', text: '#065f46' },
  'Hủy': { bg: '#fee2e2', text: '#991b1b' },
};
export const StatusBadge = ({ status }) => {
  const s = STATUS_COLORS[status] || { bg: colors.bgSoft, text: colors.muted };
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.badgeText, { color: s.text }]}>{status}</Text>
    </View>
  );
};

// ---- Pagination ----
export const Pagination = ({ page, total, pageSize, onPrev, onNext }) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <View style={[globalStyles.row, { justifyContent: 'center', marginTop: 16, gap: 16 }]}>
      <Btn title="« Trước" variant="secondary" onPress={onPrev} disabled={page === 1}
        style={{ paddingHorizontal: 14, paddingVertical: 9 }} />
      <Text style={globalStyles.muted}>Trang {page} / {totalPages}</Text>
      <Btn title="Sau »" variant="secondary" onPress={onNext} disabled={page >= totalPages}
        style={{ paddingHorizontal: 14, paddingVertical: 9 }} />
    </View>
  );
};

// ---- SearchBar ----
export const SearchBar = ({ value, onChangeText, onSubmit, placeholder }) => (
  <View style={styles.searchWrap}>
    <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
    <TextInput
      style={styles.searchInput}
      value={value}
      onChangeText={onChangeText}
      onSubmitEditing={onSubmit}
      placeholder={placeholder || 'Tìm kiếm...'}
      placeholderTextColor={colors.muted}
      returnKeyType="search"
    />
  </View>
);

const styles = StyleSheet.create({
  btn: {
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 14, fontWeight: '600' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 32,
    maxHeight: '88%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  handle: {
    width: 40, height: 4, backgroundColor: colors.border,
    borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  kpiCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  kpiLabel: { fontSize: 11, color: colors.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  kpiValue: { fontSize: 20, fontWeight: '700', color: colors.text, marginTop: 6 },
  pill: {
    backgroundColor: colors.bgSoft, borderWidth: 1, borderColor: colors.border,
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, marginRight: 4, marginTop: 2,
  },
  pillText: { fontSize: 12, color: colors.text },
  badge: {
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 12, fontWeight: '600' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 8,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },
});
