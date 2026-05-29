// ============================================================
// src/services/api.js
// Giao tiếp với backend Flask (giữ nguyên endpoints như web)
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

// ⚠️  Đổi thành IP máy tính của bạn khi chạy trên thiết bị thật
// Ví dụ: 'http://192.168.1.10:5000'
// Khi dùng Android Emulator: 'http://10.0.2.2:5000'
export const API_BASE = 'http://10.0.2.2:5000';

export const apiFetch = async (path, options = {}) => {
  const token = await AsyncStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.message || json.error || `HTTP ${res.status}`);
  }
  return json;
};

export const formatVND = (value) => {
  const num = Number(value || 0);
  return num.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
};

export const getImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;

  // Đảm bảo luôn bắt đầu bằng /
  let cleanPath = url.startsWith('/') ? url : `/${url}`;

  // NẾU TRONG DATABASE ĐANG LƯU LÀ '/uploads/ao.jpg' MÀ THIẾU CHỮ 'static'
  // TA CẦN CHÈN THÊM '/static' VÀO PHÍA TRƯỚC!
  if (cleanPath.startsWith('/uploads/')) {
     cleanPath = `/static${cleanPath}`;
  }

  return `${API_BASE}${cleanPath}?t=1`;
};

export const formatDateVietnamese = (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString.replace(' ', 'T'));
    const thu = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${thu[date.getDay()]} ${d}/${m}/${y} ${h}:${min}`;
  } catch {
    return dateString;
  }
};
