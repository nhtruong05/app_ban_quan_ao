// ============================================================
// src/services/theme.js
// Màu sắc và style dùng chung toàn app
// ============================================================

import { StyleSheet } from 'react-native';

export const colors = {
  primary: '#3b82f6',
  primary600: '#2563eb',
  primary50: '#eff6ff',
  danger: '#ef4444',
  warn: '#f59e0b',
  success: '#10b981',
  bg: '#f8fafc',
  bgSoft: '#f1f5f9',
  panel: '#ffffff',
  text: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
};

export const globalStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: colors.bg,
  },
  card: {
    backgroundColor: colors.panel,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    width: '100%',
    backgroundColor: '#fff',
    color: colors.text,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    marginBottom: 4,
  },
  inputFocused: {
    borderColor: colors.primary,
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  btnSecondary: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  btnDanger: {
    backgroundColor: colors.danger,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  btnDangerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  muted: {
    color: colors.muted,
    fontSize: 13,
  },
  pill: {
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    color: colors.text,
    marginRight: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
});
