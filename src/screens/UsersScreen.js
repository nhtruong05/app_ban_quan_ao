// ============================================================
// src/screens/UsersScreen.js
// Quản lý người dùng: danh sách, thêm/sửa/xoá
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, Alert, RefreshControl,
} from 'react-native';
import AppHeader from '../components/AppHeader';
import { Btn, Input, BottomModal, Pagination, SearchBar } from '../components/UI';
import { apiFetch } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { colors, globalStyles } from '../services/theme';

const DEFAULT_FORM = {
  taikhoan: '', matkhau: '', hoten: '', email: '', sdt: '', diachi: '',
};

const UsersScreen = () => {
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [refreshing, setRefreshing] = useState(false);
  const { showToast } = useToast();

  useEffect(() => { loadUsers(); }, [page, search]);

  const loadUsers = async () => {
    try {
      const res = await apiFetch(
        `/api/admin/users?page=${page}&page_size=${pageSize}&q=${encodeURIComponent(search)}`
      );
      setUsers(res.data?.items || []);
      setTotal(res.data?.total || 0);
    } catch (e) { showToast('Lỗi: ' + e.message); }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  };

  const handleSave = async () => {
    if (!form.taikhoan || (!editingId && !form.matkhau) || !form.hoten || !form.email) {
      showToast('Thiếu dữ liệu bắt buộc'); return;
    }
    try {
      const body = { ...form };
      if (editingId && !body.matkhau) delete body.matkhau;
      if (editingId) {
        await apiFetch(`/api/admin/users/${editingId}`, { method: 'PUT', body: JSON.stringify(body) });
        showToast('Đã cập nhật');
      } else {
        await apiFetch('/api/admin/users', { method: 'POST', body: JSON.stringify(body) });
        showToast('Đã tạo user');
      }
      setShowForm(false); resetForm(); loadUsers();
    } catch (e) { showToast('Lỗi: ' + e.message); }
  };

  const handleEdit = async (uid) => {
    const found = users.find((u) => String(u.user_id) === String(uid));
    if (!found) { showToast('Không tìm thấy user'); return; }
    setForm({
      taikhoan: found.taikhoan || '', matkhau: '',
      hoten: found.hoten || '', email: found.email || '',
      sdt: found.sdt || '', diachi: found.diachi || '',
    });
    setEditingId(uid);
    setShowForm(true);
  };

  const handleDelete = (uid) => {
    Alert.alert('Xoá user', `Xoá user #${uid}?`, [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xoá', style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch(`/api/admin/users/${uid}`, { method: 'DELETE' });
            showToast('Đã xoá'); loadUsers();
          } catch (e) { showToast('Lỗi: ' + e.message); }
        },
      },
    ]);
  };

  const resetForm = () => { setForm(DEFAULT_FORM); setEditingId(null); };

  const renderUser = ({ item: u }) => (
    <View style={globalStyles.card}>
      <View style={styles.userHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(u.hoten || u.taikhoan || '?')[0].toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.userName}>{u.hoten || u.taikhoan}</Text>
          <Text style={globalStyles.muted}>@{u.taikhoan}</Text>
          <Text style={[globalStyles.muted, { fontSize: 12 }]}>{u.email}</Text>
          {u.sdt && <Text style={[globalStyles.muted, { fontSize: 12 }]}>{u.sdt}</Text>}
        </View>
        <Text style={styles.userId}>#{u.user_id}</Text>
      </View>
      {u.diachi && (
        <Text style={[globalStyles.muted, { fontSize: 12, marginTop: 8 }]}>
          📍 {u.diachi}
        </Text>
      )}
      <View style={[globalStyles.row, { marginTop: 12, justifyContent: 'flex-end', gap: 8 }]}>
        <Btn title="Sửa" variant="secondary" onPress={() => handleEdit(u.user_id)}
          style={styles.actionBtn} />
        <Btn title="Xoá" variant="danger" onPress={() => handleDelete(u.user_id)}
          style={styles.actionBtn} />
      </View>
    </View>
  );

  return (
    <View style={globalStyles.screen}>
      <AppHeader title="👥 Quản lý người dùng" />
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <SearchBar
          value={search}
          onChangeText={(v) => { setSearch(v); setPage(1); }}
          onSubmit={loadUsers}
          placeholder="Tìm tài khoản / họ tên / email / sđt..."
        />
        <Btn title="+ Thêm user" onPress={() => { resetForm(); setShowForm(true); }} />
      </View>
      <FlatList
        data={users}
        keyExtractor={(u) => String(u.user_id)}
        renderItem={renderUser}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <Text style={[globalStyles.muted, { textAlign: 'center', marginTop: 40 }]}>
            Chưa có user
          </Text>
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListFooterComponent={
          <Pagination page={page} total={total} pageSize={pageSize}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => p + 1)} />
        }
      />

      {/* Form Modal */}
      <BottomModal
        visible={showForm}
        onClose={() => { setShowForm(false); resetForm(); }}
        title={editingId ? `Sửa user #${editingId}` : 'Thêm user mới'}
      >
        <Input label="Tài khoản *" value={form.taikhoan}
          onChangeText={(v) => setForm({ ...form, taikhoan: v })}
          autoCapitalize="none" />
        <Input
          label={editingId ? 'Mật khẩu (để trống nếu không đổi)' : 'Mật khẩu *'}
          value={form.matkhau}
          onChangeText={(v) => setForm({ ...form, matkhau: v })}
          secureTextEntry />
        <Input label="Họ tên *" value={form.hoten}
          onChangeText={(v) => setForm({ ...form, hoten: v })} />
        <Input label="Email *" value={form.email}
          onChangeText={(v) => setForm({ ...form, email: v })}
          keyboardType="email-address" autoCapitalize="none" />
        <Input label="Số điện thoại" value={form.sdt}
          onChangeText={(v) => setForm({ ...form, sdt: v })}
          keyboardType="phone-pad" />
        <Input label="Địa chỉ" value={form.diachi}
          onChangeText={(v) => setForm({ ...form, diachi: v })} />
        <View style={[globalStyles.row, { marginTop: 20, gap: 12 }]}>
          <Btn title="Lưu" onPress={handleSave} style={{ flex: 1 }} />
          <Btn title="Huỷ" variant="secondary" onPress={() => { setShowForm(false); resetForm(); }}
            style={{ flex: 1 }} />
        </View>
        <View style={{ height: 24 }} />
      </BottomModal>
    </View>
  );
};

const styles = StyleSheet.create({
  userHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.primary50, borderWidth: 2, borderColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '700', color: colors.primary },
  userName: { fontSize: 15, fontWeight: '700', color: colors.text },
  userId: { fontSize: 13, color: colors.muted, fontWeight: '500' },
  actionBtn: { paddingHorizontal: 16, paddingVertical: 9 },
});

export default UsersScreen;
