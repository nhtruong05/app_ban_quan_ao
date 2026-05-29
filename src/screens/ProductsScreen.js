// ============================================================
// src/screens/ProductsScreen.js
// Quản lý sản phẩm: danh sách, thêm/sửa/xoá + upload ảnh
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, FlatList, Image,
  TouchableOpacity, Alert, RefreshControl,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import AppHeader from '../components/AppHeader';
import { Btn, Input, BottomModal, Pill, Pagination, SearchBar } from '../components/UI';
import { apiFetch, formatVND, getImageUrl, API_BASE } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { colors, globalStyles } from '../services/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_FORM = {
  ten_san_pham: '', gia_ban: '', loai: 'Áo', size: 'S',
  chat_lieu: 'Cotton', gioi_tinh: 'Unisex', mo_ta: '', hinh_anh: '', trang_thai: 'Đang bán',
};

const RadioGroup = ({ options, selected, onSelect }) => (
  <View style={styles.radioGroup}>
    {options.map((opt) => (
      <TouchableOpacity
        key={opt} onPress={() => onSelect(opt)}
        style={[styles.radioBtn, selected === opt && styles.radioBtnActive]}
      >
        <Text style={[styles.radioText, selected === opt && styles.radioTextActive]}>{opt}</Text>
      </TouchableOpacity>
    ))}
  </View>
);

const ProductsScreen = () => {
  console.log('ProductsScreen render');
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [selectedImage, setSelectedImage] = useState(null); // { uri, type, name }
  const [preview, setPreview] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const { showToast } = useToast();

  useEffect(() => { loadProducts(); }, [page, search]);

  const loadProducts = async () => {
    console.log('loadProducts called');
    try {
      const res = await apiFetch(
        `/api/admin/products?page=${page}&page_size=${pageSize}&q=${encodeURIComponent(search)}`
      );
      setProducts(res.data?.items || []);
      setTotal(res.data?.total || 0);
    } catch (e) { showToast('Lỗi: ' + e.message); }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProducts();
    setRefreshing(false);
  };

  const pickImage = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
    if (result.assets && result.assets[0]) {
      const asset = result.assets[0];
      setSelectedImage(asset);
      setPreview(asset.uri);
    }
  };

  const uploadImage = async (asset) => {
    const token = await AsyncStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', {
      uri: asset.uri,
      type: asset.type || 'image/jpeg',
      name: asset.fileName || 'upload.jpg',
    });
    const res = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.message || 'Upload failed');
    return json.data?.path || json.data?.url || '';
  };

  const handleSave = async () => {
    if (!form.ten_san_pham) { showToast('Thiếu tên sản phẩm'); return; }
    try {
      let imageUrl = form.hinh_anh;
      if (selectedImage) imageUrl = await uploadImage(selectedImage);
      // Nếu link ảnh có chứa Base URL, ta chỉ lấy phần path phía sau để lưu vào DB
      if (imageUrl?.startsWith(API_BASE)) {
        imageUrl = imageUrl.replace(API_BASE, '');
      } else if (imageUrl?.startsWith('http')) {
        // Dự phòng nếu URL thuộc một domain khác (vd: Cloudinary, S3)
        const urlParts = imageUrl.split('/');
        imageUrl = '/' + urlParts.slice(3).join('/');
      }
      const body = { ...form, gia_ban: Number(form.gia_ban || 0), hinh_anh: imageUrl };
      if (editingId) {
        await apiFetch(`/api/admin/products/${editingId}`, { method: 'PUT', body: JSON.stringify(body) });
        showToast('Đã cập nhật');
      } else {
        await apiFetch('/api/admin/products', { method: 'POST', body: JSON.stringify(body) });
        showToast('Đã tạo sản phẩm');
      }
      setShowForm(false); resetForm(); loadProducts();
    } catch (e) { showToast('Lỗi: ' + e.message); }
  };

  const handleEdit = async (id) => {
    try {
      const res = await apiFetch(`/api/admin/products/${id}`);
      const p = res.data;
      setForm({
        ten_san_pham: p.ten_san_pham || '', gia_ban: String(p.gia_ban || ''),
        loai: p.loai || 'Áo', size: p.size || 'S', chat_lieu: p.chat_lieu || 'Cotton',
        gioi_tinh: p.gioi_tinh || 'Unisex', mo_ta: p.mo_ta || '',
        hinh_anh: p.hinh_anh || '', trang_thai: p.trang_thai || 'Đang bán',
      });
      setEditingId(id);
      setSelectedImage(null);
      setPreview(p.hinh_anh ? getImageUrl(p.hinh_anh) : null);
      setShowForm(true);
    } catch (e) { showToast('Lỗi: ' + e.message); }
  };

  const handleDelete = (id) => {
    Alert.alert('Xoá sản phẩm', `Xoá sản phẩm #${id}?`, [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xoá', style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch(`/api/admin/products/${id}`, { method: 'DELETE' });
            showToast('Đã xoá'); loadProducts();
          } catch (e) { showToast('Lỗi: ' + e.message); }
        },
      },
    ]);
  };

  const resetForm = () => {
    setForm(DEFAULT_FORM); setEditingId(null);
    setSelectedImage(null); setPreview(null);
  };

  const renderProduct = ({ item: p }) => {
    const imgUrl = getImageUrl(p.hinh_anh);
    console.log('imgUrl:', imgUrl);
    return (
      <View style={globalStyles.card}>
        <View style={styles.productRow}>
          {p.hinh_anh ? (
            <Image
              key={imgUrl}
              source={{ uri: imgUrl }}
              style={styles.thumb}
              resizeMode="cover"
              onError={(e) => console.log('Image error:', imgUrl, e.nativeEvent.error)}
              onLoad={() => console.log('Image loaded OK:', imgUrl)}
            />
          ) : (
            <View style={[styles.thumb, styles.thumbEmpty]}>
              <Text style={{ fontSize: 24 }}>👕</Text>
            </View>
          )}
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.productName} numberOfLines={2}>{p.ten_san_pham}</Text>
            <Text style={styles.productPrice}>{formatVND(p.gia_ban)}</Text>
            <View style={[globalStyles.row, { marginTop: 4 }]}>
              <Pill label={p.size || '-'} />
              <Pill label={p.chat_lieu || '-'} />
              <Pill label={p.gioi_tinh || '-'} />
            </View>
            <Text style={[globalStyles.muted, { marginTop: 4, fontSize: 12 }]}>
              {p.trang_thai} · {p.loai}
            </Text>
          </View>
        </View>
        <View style={[globalStyles.row, { marginTop: 12, justifyContent: 'flex-end', gap: 8 }]}>
          <Btn title="Sửa" variant="secondary" onPress={() => handleEdit(p.products_id)}
            style={styles.actionBtn} />
          <Btn title="Xoá" variant="danger" onPress={() => handleDelete(p.products_id)}
            style={styles.actionBtn} />
        </View>
      </View>
    );
  };

  return (
    <View style={globalStyles.screen}>
      <AppHeader title="👕 Quản lý sản phẩm" />
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <SearchBar
          value={search}
          onChangeText={(v) => { setSearch(v); setPage(1); }}
          onSubmit={loadProducts}
          placeholder="Tìm theo tên/mô tả..."
        />
        <Btn title="+ Thêm sản phẩm" onPress={() => { resetForm(); setShowForm(true); }} />
      </View>
      <FlatList
        data={products}
        keyExtractor={(p) => String(p.products_id)}
        renderItem={renderProduct}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text style={[globalStyles.muted, { textAlign: 'center', marginTop: 40 }]}>Chưa có sản phẩm</Text>}
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
        title={editingId ? `Sửa sản phẩm #${editingId}` : 'Thêm sản phẩm'}
      >
        <Input label="Tên sản phẩm *" value={form.ten_san_pham}
          onChangeText={(v) => setForm({ ...form, ten_san_pham: v })} />
        <Input label="Giá bán (VND)" value={form.gia_ban}
          onChangeText={(v) => setForm({ ...form, gia_ban: v })}
          keyboardType="numeric" />

        <Text style={globalStyles.label}>Loại</Text>
        <RadioGroup options={['Áo', 'Quần']} selected={form.loai}
          onSelect={(v) => setForm({ ...form, loai: v })} />

        <Text style={globalStyles.label}>Size</Text>
        <RadioGroup options={['S', 'M', 'L', 'XL']} selected={form.size}
          onSelect={(v) => setForm({ ...form, size: v })} />

        <Text style={globalStyles.label}>Chất liệu</Text>
        <RadioGroup options={['Cotton', 'Polyester', 'Jean', 'Da']} selected={form.chat_lieu}
          onSelect={(v) => setForm({ ...form, chat_lieu: v })} />

        <Text style={globalStyles.label}>Giới tính</Text>
        <RadioGroup options={['Nam', 'Nữ', 'Unisex']} selected={form.gioi_tinh}
          onSelect={(v) => setForm({ ...form, gioi_tinh: v })} />

        <Text style={globalStyles.label}>Trạng thái</Text>
        <RadioGroup options={['Đang bán', 'Ngừng bán']} selected={form.trang_thai}
          onSelect={(v) => setForm({ ...form, trang_thai: v })} />

        <Text style={globalStyles.label}>Ảnh sản phẩm</Text>
        <Btn title="📷 Chọn ảnh từ thư viện" variant="secondary" onPress={pickImage} />
        {preview && (
          <Image source={{ uri: preview }} style={styles.previewImg} resizeMode="cover" />
        )}

        <Input label="Mô tả" value={form.mo_ta}
          onChangeText={(v) => setForm({ ...form, mo_ta: v })}
          multiline numberOfLines={4}
          style={{ height: 90, textAlignVertical: 'top' }} />

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
  productRow: { flexDirection: 'row', alignItems: 'flex-start' },
  thumb: { width: 72, height: 72, borderRadius: 10, borderWidth: 1, borderColor: colors.border,backgroundColor: '#f5f5f5' },
  thumbEmpty: { backgroundColor: colors.bgSoft, alignItems: 'center', justifyContent: 'center' },
  productName: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 4 },
  productPrice: { fontSize: 16, fontWeight: '700', color: colors.primary },
  actionBtn: { paddingHorizontal: 16, paddingVertical: 9 },
  radioGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  radioBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff',
  },
  radioBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary50 },
  radioText: { fontSize: 13, color: colors.muted, fontWeight: '500' },
  radioTextActive: { color: colors.primary, fontWeight: '700' },
  previewImg: {
    width: '100%', height: 180, borderRadius: 12, marginTop: 12,
    borderWidth: 1, borderColor: colors.border,
  },
});

export default ProductsScreen;
