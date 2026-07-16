import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch, formatVND } from '../services/api';
import { useToast } from '../contexts/ToastContext';

// Tach chuoi "S,M,L" -> ["S","M","L"]
const splitVals = (s) =>
  (s || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

// Them/bo 1 gia tri trong mang (cho checkbox chon nhieu)
const toggleIn = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

const GENDERS = ['Nam', 'Nữ', 'Unisex'];

const EMPTY_FORM = {
  ten_san_pham: '',
  gia_ban: '',
  category_id: '',
  sizes: [],
  chat_lieus: [],
  gioi_tinhs: ['Unisex'],
  mo_ta: '',
  hinh_anh: '',
  trang_thai: 'Đang bán',
};

const Products = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState(null); // id danh muc dang loc, null = tat ca
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const { showToast } = useToast();

  // Danh muc dang chon trong form (de lay sizes/chat_lieus tuong ung)
  const selectedCategory = useMemo(
    () => categories.find((c) => String(c.id) === String(formData.category_id)) || null,
    [categories, formData.category_id]
  );
  const isFreesize = selectedCategory?.size_type === 'FREESIZE';
  const groups = useMemo(() => [...new Set(categories.map((c) => c.nhom))], [categories]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showForm) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showForm]);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, categoryFilter]);

  const loadCategories = async () => {
    try {
      const json = await apiFetch('/api/categories');
      setCategories(json.data || []);
    } catch (error) {
      showToast('Lỗi tải danh mục: ' + error.message);
    }
  };

  const loadProducts = async () => {
    try {
      let url = `/api/admin/products?page=${page}&page_size=${pageSize}&q=${encodeURIComponent(search)}`;
      if (categoryFilter) url += `&category_id=${categoryFilter}`;
      const res = await apiFetch(url);
      setProducts(res.data?.items || []);
      setTotal(res.data?.total || 0);
    } catch (error) {
      showToast('Lỗi tải sản phẩm: ' + error.message);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreview(url);
    }
  };

  const uploadImage = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('token');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';
    const res = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      body: formData,
      headers,
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.message || 'Upload failed');
    return json.data?.path || json.data?.url || '';
  };

  // Doi danh muc: giu lai size/chat lieu con hop le voi danh muc moi
  const handleCategoryChange = (e) => {
    const id = e.target.value;
    const cat = categories.find((c) => String(c.id) === id);
    setFormData((fd) => ({
      ...fd,
      category_id: id,
      sizes: cat ? fd.sizes.filter((s) => cat.sizes.includes(s)) : [],
      chat_lieus: cat ? fd.chat_lieus.filter((m) => cat.chat_lieus.includes(m)) : [],
    }));
  };

  const handleSave = async () => {
    if (!formData.ten_san_pham) {
      showToast('Thiếu tên sản phẩm');
      return;
    }
    if (!formData.category_id) {
      showToast('Hãy chọn danh mục cho sản phẩm');
      return;
    }
    if (!isFreesize && formData.sizes.length === 0) {
      showToast('Chọn ít nhất 1 size');
      return;
    }
    if (formData.chat_lieus.length === 0) {
      showToast('Chọn ít nhất 1 chất liệu');
      return;
    }
    if (formData.gioi_tinhs.length === 0) {
      showToast('Chọn ít nhất 1 giới tính');
      return;
    }

    try {
      let imageUrl = formData.hinh_anh;
      if (selectedFile) {
        imageUrl = await uploadImage(selectedFile);
      }

      // Normalize image URL: chỉ gửi relative path
      if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
        try {
          const urlObj = new URL(imageUrl);
          imageUrl = urlObj.pathname;
        } catch (e) {
          // Nếu không parse được, giữ nguyên
        }
      }

      const body = {
        ten_san_pham: formData.ten_san_pham,
        gia_ban: Number(formData.gia_ban || 0),
        category_id: Number(formData.category_id),
        // chon nhieu -> luu chuoi "S,M,L" vao cot san co (khong doi schema)
        size: isFreesize ? 'Freesize' : formData.sizes.join(','),
        chat_lieu: formData.chat_lieus.join(','),
        gioi_tinh: formData.gioi_tinhs.join(','),
        mo_ta: formData.mo_ta,
        hinh_anh: imageUrl,
        trang_thai: formData.trang_thai,
        // khong gui "loai": server tu ghi loai = ten danh muc theo category_id
      };

      if (editingId) {
        await apiFetch(`/api/admin/products/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
        showToast('Đã cập nhật');
      } else {
        await apiFetch('/api/admin/products', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        showToast('Đã tạo');
      }

      setShowForm(false);
      resetForm();
      loadProducts();
    } catch (error) {
      showToast('Lỗi: ' + error.message);
    }
  };

  const handleEdit = async (id) => {
    try {
      const res = await apiFetch(`/api/admin/products/${id}`);
      const product = res.data;

      // San pham cu chua co category_id -> thu khop theo ten danh muc (cot loai)
      const catId =
        product.category_id ||
        categories.find((c) => c.ten === product.loai)?.id ||
        '';

      const genders = splitVals(product.gioi_tinh);
      setFormData({
        ten_san_pham: product.ten_san_pham || '',
        gia_ban: product.gia_ban || '',
        category_id: catId ? String(catId) : '',
        sizes: splitVals(product.size).filter((s) => s !== 'Freesize'),
        chat_lieus: splitVals(product.chat_lieu),
        gioi_tinhs: genders.length ? genders : ['Unisex'],
        mo_ta: product.mo_ta || '',
        hinh_anh: product.hinh_anh || '',
        trang_thai: product.trang_thai === 'Đang bán' ? 'Đang bán' : 'Ngừng bán',
      });
      setEditingId(id);
      setSelectedFile(null);
      if (product.hinh_anh) {
        const imageUrl = getImageUrl(product.hinh_anh);
        setPreview(imageUrl);
      } else {
        setPreview(null);
      }
      setShowForm(true);
    } catch (error) {
      showToast('Lỗi tải sản phẩm: ' + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(`Xoá sản phẩm #${id}?`)) return;
    try {
      await apiFetch(`/api/admin/products/${id}`, { method: 'DELETE' });
      showToast('Đã xoá');
      loadProducts();
    } catch (error) {
      showToast('Lỗi: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingId(null);
    setSelectedFile(null);
    setPreview(null);
  };

  const getImageUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    return `${API_BASE}${cleanPath}`;
  };

  return (
    <div className="section">
      <div className="card">
        <div className="row">
          <strong>Quản lý sản phẩm</strong>
          <input
            className="right"
            placeholder="Tìm theo tên/mô tả..."
            style={{ maxWidth: '280px' }}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter') loadProducts();
            }}
          />
          <button className="btn-secondary" onClick={loadProducts}>
            Tìm
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
          >
            + Thêm sản phẩm
          </button>
        </div>

        {/* Thanh loc theo danh muc */}
        <div className="row" style={{ flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
          <button
            className={categoryFilter === null ? '' : 'btn-secondary'}
            onClick={() => {
              setCategoryFilter(null);
              setPage(1);
            }}
          >
            Tất cả
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              className={categoryFilter === c.id ? '' : 'btn-secondary'}
              onClick={() => {
                setCategoryFilter(c.id);
                setPage(1);
              }}
            >
              {c.ten}
            </button>
          ))}
        </div>

        <div className="section">
          {products.length === 0 ? (
            <p className="muted">Chưa có sản phẩm.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Ảnh</th>
                  <th>Tên</th>
                  <th>Giá</th>
                  <th>Size/Chất liệu</th>
                  <th>Phân loại</th>
                  <th>TT</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.products_id}>
                    <td className="muted">#{p.products_id}</td>
                    <td>
                      {p.hinh_anh && (
                        <img
                          className="thumb"
                          src={getImageUrl(p.hinh_anh)}
                          alt={p.ten_san_pham}
                          onError={(e) => (e.target.style.display = 'none')}
                        />
                      )}
                    </td>
                    <td>
                      <div>{p.ten_san_pham || ''}</div>
                      <div className="muted">{p.mo_ta || ''}</div>
                    </td>
                    <td>{formatVND(p.gia_ban)}</td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {splitVals(p.size).map((s) => (
                          <span key={`s-${s}`} className="pill">{s}</span>
                        ))}
                        {splitVals(p.chat_lieu).map((m) => (
                          <span key={`m-${m}`} className="pill">{m}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      {p.gioi_tinh || '-'}
                      <div className="muted">{p.loai || ''}</div>
                    </td>
                    <td>{p.trang_thai || '-'}</td>
                    <td className="actions">
                      <button className="btn-secondary" onClick={() => handleEdit(p.products_id)}>
                        Sửa
                      </button>
                      <button className="btn-danger" onClick={() => handleDelete(p.products_id)}>
                        Xoá
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="row section">
          <button
            className="btn-secondary"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            « Trước
          </button>
          <span className="muted">
            Trang {page} / {Math.max(1, Math.ceil(total / pageSize))}
          </span>
          <button
            className="btn-secondary"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(total / pageSize)}
          >
            Sau »
          </button>
        </div>
      </div>

      {showForm && (
        <>
          <div
            className="modal-overlay active"
            onClick={() => {
              setShowForm(false);
              resetForm();
            }}
          />
          <div className="card modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingId ? `Sửa sản phẩm #${editingId}` : 'Thêm sản phẩm'}</h3>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              <div>
                <label>Tên sản phẩm</label>
                <input
                  value={formData.ten_san_pham}
                  onChange={(e) => setFormData({ ...formData, ten_san_pham: e.target.value })}
                />
                <label>Giá bán (VND)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.gia_ban}
                  onChange={(e) => setFormData({ ...formData, gia_ban: e.target.value })}
                />

                <label>Danh mục</label>
                <select value={formData.category_id} onChange={handleCategoryChange}>
                  <option value="">-- Chọn danh mục --</option>
                  {groups.map((g) => (
                    <optgroup key={g} label={g}>
                      {categories
                        .filter((c) => c.nhom === g)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.ten}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>

                {!selectedCategory && (
                  <p className="muted">Chọn danh mục để hiện size và chất liệu phù hợp.</p>
                )}

                {selectedCategory && !isFreesize && (
                  <>
                    <label>Size (chọn nhiều)</label>
                    <div className="radio-group">
                      {selectedCategory.sizes.map((s) => (
                        <label key={s}>
                          <input
                            type="checkbox"
                            checked={formData.sizes.includes(s)}
                            onChange={() =>
                              setFormData({ ...formData, sizes: toggleIn(formData.sizes, s) })
                            }
                          />
                          {s}
                        </label>
                      ))}
                    </div>
                  </>
                )}
                {selectedCategory && isFreesize && (
                  <p className="muted">Danh mục này là Freesize — không cần chọn size.</p>
                )}

                {selectedCategory && (
                  <>
                    <label>Chất liệu (chọn nhiều)</label>
                    <div className="radio-group">
                      {selectedCategory.chat_lieus.map((mat) => (
                        <label key={mat}>
                          <input
                            type="checkbox"
                            checked={formData.chat_lieus.includes(mat)}
                            onChange={() =>
                              setFormData({
                                ...formData,
                                chat_lieus: toggleIn(formData.chat_lieus, mat),
                              })
                            }
                          />
                          {mat}
                        </label>
                      ))}
                    </div>
                  </>
                )}

                <label>Giới tính (chọn nhiều)</label>
                <div className="radio-group">
                  {GENDERS.map((gender) => (
                    <label key={gender}>
                      <input
                        type="checkbox"
                        checked={formData.gioi_tinhs.includes(gender)}
                        onChange={() =>
                          setFormData({
                            ...formData,
                            gioi_tinhs: toggleIn(formData.gioi_tinhs, gender),
                          })
                        }
                      />
                      {gender}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label>Trạng thái</label>
                <select
                  value={formData.trang_thai}
                  onChange={(e) => setFormData({ ...formData, trang_thai: e.target.value })}
                >
                  <option>Đang bán</option>
                  <option>Ngừng bán</option>
                </select>
                <label>Ảnh</label>
                <input type="file" accept="image/*" onChange={handleFileChange} style={{ width: '100%' }} />
                {(preview || formData.hinh_anh) && (
                  <div className="img-preview">
                    <img
                      src={preview || getImageUrl(formData.hinh_anh)}
                      alt="Preview"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                    <div>
                      <span className="muted">
                        {selectedFile?.name || (editingId ? 'Ảnh hiện tại của sản phẩm' : 'Chưa chọn ảnh')}
                      </span>
                      <button
                        className="btn-secondary"
                        type="button"
                        onClick={() => {
                          setSelectedFile(null);
                          if (editingId && formData.hinh_anh) {
                            setPreview(getImageUrl(formData.hinh_anh));
                          } else {
                            setPreview(null);
                          }
                        }}
                      >
                        Gỡ ảnh
                      </button>
                    </div>
                  </div>
                )}
                <label>Mô tả</label>
                <textarea
                  rows="6"
                  value={formData.mo_ta}
                  onChange={(e) => setFormData({ ...formData, mo_ta: e.target.value })}
                />
              </div>
            </div>
            <div className="row section">
              <button onClick={handleSave}>Lưu</button>
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
              >
                Huỷ
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Products;
