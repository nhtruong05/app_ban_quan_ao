import React, { useState, useEffect } from 'react';
import { apiFetch, formatVND } from '../services/api';
import { useToast } from '../contexts/ToastContext';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    ten_san_pham: '',
    gia_ban: '',
    loai: 'Áo',
    size: 'S',
    chat_lieu: 'Cotton',
    gioi_tinh: 'Unisex',
    mo_ta: '',
    hinh_anh: '',
    trang_thai: 'Đang bán',
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const { showToast } = useToast();

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
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  const loadProducts = async () => {
    try {
      const res = await apiFetch(
        `/api/admin/products?page=${page}&page_size=${pageSize}&q=${encodeURIComponent(search)}`
      );
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

  const handleSave = async () => {
    if (!formData.ten_san_pham) {
      showToast('Thiếu tên sản phẩm');
      return;
    }

    try {
      let imageUrl = formData.hinh_anh;
      if (selectedFile) {
        imageUrl = await uploadImage(selectedFile);
      }

      // Normalize image URL: chỉ gửi relative path hoặc giữ nguyên nếu đã là relative
      // Backend sẽ xử lý normalize
      if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
        // Nếu là absolute URL, extract relative path
        try {
          const urlObj = new URL(imageUrl);
          imageUrl = urlObj.pathname;
        } catch (e) {
          // Nếu không parse được, giữ nguyên
        }
      }

      const body = {
        ...formData,
        gia_ban: Number(formData.gia_ban || 0),
        hinh_anh: imageUrl,
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
      // Dùng endpoint admin để lấy dữ liệu raw (relative path)
      const res = await apiFetch(`/api/admin/products/${id}`);
      const product = res.data;
      setFormData({
        ten_san_pham: product.ten_san_pham || '',
        gia_ban: product.gia_ban || '',
        loai: product.loai || 'Áo',
        size: product.size || 'S',
        chat_lieu: product.chat_lieu || 'Cotton',
        gioi_tinh: product.gioi_tinh || 'Unisex',
        mo_ta: product.mo_ta || '',
        hinh_anh: product.hinh_anh || '',
        trang_thai: product.trang_thai === 'Đang bán' ? 'Đang bán' : 'Ngừng bán',
      });
      setEditingId(id);
      // Reset selectedFile khi edit
      setSelectedFile(null);
      // Set preview với ảnh hiện tại của sản phẩm (convert relative path sang absolute URL)
      if (product.hinh_anh) {
        const imageUrl = getImageUrl(product.hinh_anh);
        console.log('[Products] Edit product:', { id, hinh_anh: product.hinh_anh, imageUrl });
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
    setFormData({
      ten_san_pham: '',
      gia_ban: '',
      loai: 'Áo',
      size: 'S',
      chat_lieu: 'Cotton',
      gioi_tinh: 'Unisex',
      mo_ta: '',
      hinh_anh: '',
      trang_thai: 'Đang bán',
    });
    setEditingId(null);
    setSelectedFile(null);
    setPreview(null);
  };

  const getImageUrl = (url) => {
    if (!url) return '';
    // Nếu đã là absolute URL, dùng luôn
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    // Nếu là relative path, thêm API base
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
                      <span className="pill">{p.size || '-'}</span>{' '}
                      <span className="pill">{p.chat_lieu || '-'}</span>
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
          <div 
            className="card modal"
            onClick={(e) => e.stopPropagation()}
          >
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
                <label>Loại</label>
                <div className="radio-group">
                  {['Áo', 'Quần'].map((type) => (
                    <label key={type}>
                      <input
                        type="radio"
                        name="pType"
                        value={type}
                        checked={formData.loai === type}
                        onChange={(e) => setFormData({ ...formData, loai: e.target.value })}
                      />
                      {type}
                    </label>
                  ))}
                </div>
                <label>Size</label>
                <div className="radio-group">
                  {['S', 'M', 'L', 'XL'].map((size) => (
                    <label key={size}>
                      <input
                        type="radio"
                        name="pSize"
                        value={size}
                        checked={formData.size === size}
                        onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                      />
                      {size}
                    </label>
                  ))}
                </div>
                <label>Chất liệu</label>
                <div className="radio-group">
                  {['Cotton', 'Polyester', 'Jean', 'Da'].map((mat) => (
                    <label key={mat}>
                      <input
                        type="radio"
                        name="pMaterial"
                        value={mat}
                        checked={formData.chat_lieu === mat}
                        onChange={(e) => setFormData({ ...formData, chat_lieu: e.target.value })}
                      />
                      {mat}
                    </label>
                  ))}
                </div>
                <label>Giới tính</label>
                <div className="radio-group">
                  {['Nam', 'Nữ', 'Unisex'].map((gender) => (
                    <label key={gender}>
                      <input
                        type="radio"
                        name="pGender"
                        value={gender}
                        checked={formData.gioi_tinh === gender}
                        onChange={(e) => setFormData({ ...formData, gioi_tinh: e.target.value })}
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
                        console.error('[Products] Image load error:', e.target.src);
                        e.target.style.display = 'none';
                      }}
                      onLoad={() => {
                        console.log('[Products] Image loaded successfully:', preview || getImageUrl(formData.hinh_anh));
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
                          // Nếu đang edit, giữ lại ảnh hiện tại, nếu không thì xóa preview
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

