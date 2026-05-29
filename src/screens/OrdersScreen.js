// ============================================================
// src/screens/OrdersScreen.js
// Quản lý đơn hàng: xem, cập nhật trạng thái, xoá
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Alert, RefreshControl, Modal, ScrollView, Image,
} from 'react-native';
import AppHeader from '../components/AppHeader';
import { Btn, StatusBadge, Pagination, SearchBar } from '../components/UI';
import { apiFetch, formatVND, getImageUrl, formatDateVietnamese } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { colors, globalStyles } from '../services/theme';

const STATUS_LIST = [
  'Tất cả', 'Chờ xác nhận', 'Đã xác nhận', 'Đang giao', 'Đã thanh toán', 'Hoàn thành', 'Hủy',
];

const OrdersScreen = () => {
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  const [showDetail, setShowDetail] = useState(false);
  const [detail, setDetail] = useState(null);
  const [showStatusSheet, setShowStatusSheet] = useState(null); // order id
  const [refreshing, setRefreshing] = useState(false);
  const { showToast } = useToast();

  useEffect(() => { loadOrders(); }, [page, status]);

  const loadOrders = async () => {
    try {
      const res = await apiFetch(
        `/api/admin/orders?page=${page}&page_size=${pageSize}&status=${encodeURIComponent(status === 'Tất cả' ? '' : status)}`
      );
      setOrders(res.data?.items || []);
      setTotal(res.data?.total || 0);
    } catch (e) { showToast('Lỗi: ' + e.message); }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  const updateStatus = async (id, newStatus) => {
    try {
      await apiFetch(`/api/admin/orders/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ trangthai: newStatus }),
      });
      showToast(`Đã cập nhật đơn #${id}`);
      setShowStatusSheet(null);
      loadOrders();
    } catch (e) { showToast('Lỗi: ' + e.message); }
  };

  const handleDelete = (id) => {
    Alert.alert('Xoá đơn hàng', `Xoá đơn hàng #${id}?`, [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xoá', style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch(`/api/admin/orders/${id}`, { method: 'DELETE' });
            showToast('Đã xoá'); loadOrders();
          } catch (e) { showToast('Lỗi: ' + e.message); }
        },
      },
    ]);
  };

  const handleViewDetail = async (id) => {
    try {
      const res = await apiFetch(`/api/admin/orders/${id}/details`);
      setDetail(res.data);
      setShowDetail(true);
    } catch (e) { showToast('Lỗi: ' + e.message); }
  };

  const renderOrder = ({ item: o }) => (
    <View style={globalStyles.card}>
      <View style={styles.orderHeader}>
        <Text style={styles.orderId}>Đơn #{o.id}</Text>
        <StatusBadge status={o.trangthai} />
      </View>
      <Text style={styles.customerName}>{o.hoten || '—'}</Text>
      <Text style={globalStyles.muted}>{o.sdt || ''}</Text>
      <View style={[globalStyles.row, { marginTop: 8, justifyContent: 'space-between' }]}>
        <View>
          <Text style={styles.amount}>{formatVND(o.tongtien)}</Text>
          <Text style={[globalStyles.muted, { fontSize: 12 }]}>{o.payment_method || '—'}</Text>
          <Text style={[globalStyles.muted, { fontSize: 11 }]}>
            {formatDateVietnamese(o.created_at)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Btn title="Chi tiết" variant="secondary" onPress={() => handleViewDetail(o.id)}
            style={styles.actionBtn} />
          <Btn title="Trạng thái" variant="primary" onPress={() => setShowStatusSheet(o.id)}
            style={styles.actionBtn} />
          <Btn title="Xoá" variant="danger" onPress={() => handleDelete(o.id)}
            style={styles.actionBtn} />
        </View>
      </View>
    </View>
  );

  return (
    <View style={globalStyles.screen}>
      <AppHeader title="📦 Quản lý đơn hàng" />

      {/* Status filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        {STATUS_LIST.map((s) => {
          const active = (s === 'Tất cả' && !status) || status === s;
          return (
            <TouchableOpacity
              key={s}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => { setStatus(s === 'Tất cả' ? '' : s); setPage(1); }}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{s}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        data={orders}
        keyExtractor={(o) => String(o.id)}
        renderItem={renderOrder}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <Text style={[globalStyles.muted, { textAlign: 'center', marginTop: 40 }]}>
            Không có đơn hàng
          </Text>
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListFooterComponent={
          <Pagination page={page} total={total} pageSize={pageSize}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => p + 1)} />
        }
      />

      {/* Status change bottom sheet */}
      <Modal
        visible={showStatusSheet !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setShowStatusSheet(null)}
      >
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowStatusSheet(null)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Cập nhật trạng thái đơn #{showStatusSheet}</Text>
          {STATUS_LIST.filter((s) => s !== 'Tất cả').map((s) => (
            <TouchableOpacity
              key={s}
              style={styles.statusOption}
              onPress={() => updateStatus(showStatusSheet, s)}
            >
              <StatusBadge status={s} />
            </TouchableOpacity>
          ))}
          <View style={{ height: 24 }} />
        </View>
      </Modal>

      {/* Order Detail Modal */}
      <Modal
        visible={showDetail}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDetail(false)}
      >
        <View style={styles.fullModal}>
          <View style={styles.fullModalHeader}>
            <Text style={styles.sheetTitle}>
              Chi tiết đơn #{detail?.order?.id}
            </Text>
            <TouchableOpacity onPress={() => setShowDetail(false)}>
              <Text style={{ fontSize: 22, color: colors.muted }}>✕</Text>
            </TouchableOpacity>
          </View>
          {detail && (
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <View style={[globalStyles.card, { marginBottom: 12 }]}>
                <Text style={styles.detailSection}>👤 Khách hàng</Text>
                <Text style={globalStyles.muted}>Họ tên: {detail.order.hoten || '—'}</Text>
                <Text style={globalStyles.muted}>SĐT: {detail.order.sdt || '—'}</Text>
                <Text style={globalStyles.muted}>Địa chỉ: {detail.order.diachi_giaohang || '—'}</Text>
              </View>
              <View style={[globalStyles.card, { marginBottom: 12 }]}>
                <Text style={styles.detailSection}>📋 Đơn hàng</Text>
                <Text style={globalStyles.muted}>Trạng thái: {detail.order.trangthai}</Text>
                <Text style={globalStyles.muted}>Thanh toán: {detail.order.payment_method || '—'}</Text>
                <Text style={[globalStyles.muted, { color: colors.primary, fontWeight: '700' }]}>
                  Tổng: {formatVND(detail.order.tongtien)}
                </Text>
                <Text style={globalStyles.muted}>Ngày: {formatDateVietnamese(detail.order.created_at)}</Text>
              </View>
              <Text style={styles.detailSection}>📦 Sản phẩm ({detail.items?.length})</Text>
              {detail.items?.map((item, idx) => (
                <View key={idx} style={[globalStyles.card, { flexDirection: 'row', gap: 12, marginBottom: 8 }]}>
                  {item.hinh_anh && (
                    <Image
                      source={{ uri: getImageUrl(item.hinh_anh) }}
                      style={{ width: 64, height: 64, borderRadius: 8 }}
                      resizeMode="cover"
                    />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '600', color: colors.text }}>{item.ten_san_pham}</Text>
                    <Text style={globalStyles.muted}>
                      {item.quantity} × {formatVND(item.unit_price)}
                    </Text>
                    <Text style={{ color: colors.primary, fontWeight: '700' }}>
                      {formatVND(item.line_total)}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  filterScroll: { paddingHorizontal: 16, paddingVertical: 12, flexGrow: 0 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', marginRight: 8,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: 13, color: colors.muted, fontWeight: '500' },
  filterTextActive: { color: '#fff', fontWeight: '700' },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderId: { fontSize: 16, fontWeight: '700', color: colors.text },
  customerName: { fontSize: 15, fontWeight: '600', color: colors.text },
  amount: { fontSize: 17, fontWeight: '700', color: colors.primary },
  actionBtn: { paddingHorizontal: 14, paddingVertical: 8, minWidth: 90 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: 32, elevation: 20,
  },
  sheetHandle: {
    width: 40, height: 4, backgroundColor: colors.border,
    borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 16,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 16 },
  statusOption: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  fullModal: { flex: 1, backgroundColor: '#fff', marginTop: 48, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  fullModalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  detailSection: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 8 },
});

export default OrdersScreen;
