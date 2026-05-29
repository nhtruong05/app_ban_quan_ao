const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';

export const apiFetch = async (path, opts = {}) => {
  const token = localStorage.getItem('token') || '';
  const headers = {
    'Content-Type': 'application/json',
    ...opts.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers,
  });

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!res.ok) {
    if (isJson) {
      const j = await res.json();
      throw new Error(j.message || `${res.status} ${res.statusText}`);
    }
    throw new Error(`${res.status} ${res.statusText}`);
  }

  return isJson ? res.json() : res.text();
};

export const formatVND = (n) => {
  return Number(n || 0).toLocaleString('vi-VN', {
    style: 'currency',
    currency: 'VND',
  });
};

