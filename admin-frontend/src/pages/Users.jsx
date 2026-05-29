import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';
import { useToast } from '../contexts/ToastContext';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    taikhoan: '',
    matkhau: '',
    hoten: '',
    email: '',
    sdt: '',
    diachi: '',
  });
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
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  const loadUsers = async () => {
    try {
      const res = await apiFetch(
        `/api/admin/users?page=${page}&page_size=${pageSize}&q=${encodeURIComponent(search)}`
      );
      setUsers(res.data?.items || []);
      setTotal(res.data?.total || 0);
    } catch (error) {
      showToast('Lỗi tải users: ' + error.message);
    }
  };

  const handleSave = async () => {
    if (!formData.taikhoan || (!editingId && !formData.matkhau) || !formData.hoten || !formData.email) {
      showToast('Thiếu dữ liệu bắt buộc');
      return;
    }

    try {
      const body = { ...formData };
      if (editingId && !body.matkhau) {
        delete body.matkhau;
      }

      if (editingId) {
        await apiFetch(`/api/admin/users/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
        showToast('Đã cập nhật');
      } else {
        await apiFetch('/api/admin/users', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        showToast('Đã tạo user');
      }

      setShowForm(false);
      resetForm();
      loadUsers();
    } catch (error) {
      showToast('Lỗi: ' + error.message);
    }
  };

  const handleEdit = async (uid) => {
    // Tìm user trong danh sách hiện tại
    const found = users.find((x) => String(x.user_id) === String(uid));
    
    if (found) {
      setFormData({
        taikhoan: found.taikhoan || '',
        matkhau: '',
        hoten: found.hoten || '',
        email: found.email || '',
        sdt: found.sdt || '',
        diachi: found.diachi || '',
      });
      setEditingId(uid);
      setShowForm(true);
    } else {
      // Nếu không tìm thấy trong danh sách hiện tại, thử load lại
      try {
        const res = await apiFetch(`/api/admin/users?page=1&page_size=1000`);
        const allUsers = res.data?.items || [];
        const userFound = allUsers.find((x) => String(x.user_id) === String(uid));
        if (!userFound) {
          showToast('Không tìm thấy user');
          return;
        }
        setFormData({
          taikhoan: userFound.taikhoan || '',
          matkhau: '',
          hoten: userFound.hoten || '',
          email: userFound.email || '',
          sdt: userFound.sdt || '',
          diachi: userFound.diachi || '',
        });
        setEditingId(uid);
        setShowForm(true);
      } catch (error) {
        showToast('Lỗi: ' + error.message);
      }
    }
  };

  const handleDelete = async (uid) => {
    if (!window.confirm(`Xoá user #${uid}?`)) return;
    try {
      await apiFetch(`/api/admin/users/${uid}`, { method: 'DELETE' });
      showToast('Đã xoá');
      loadUsers();
    } catch (error) {
      showToast('Lỗi: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      taikhoan: '',
      matkhau: '',
      hoten: '',
      email: '',
      sdt: '',
      diachi: '',
    });
    setEditingId(null);
  };

  return (
    <div className="section">
      <div className="card">
        <div className="row">
          <strong>Quản lý người dùng</strong>
          <input
            className="right"
            placeholder="Tìm theo tài khoản/họ tên/email/sđt..."
            style={{ maxWidth: '280px' }}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter') loadUsers();
            }}
          />
          <button className="btn-secondary" onClick={loadUsers}>
            Tìm
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
          >
            + Thêm user
          </button>
        </div>

        <div className="section">
          {users.length === 0 ? (
            <p className="muted">Chưa có user.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Tài khoản</th>
                  <th>Họ tên</th>
                  <th colSpan={2}>Địa chỉ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.user_id}>
                    <td className="muted">#{u.user_id}</td>
                    <td>
                      {u.taikhoan || ''}
                      <div className="muted">{u.email || ''}</div>
                    </td>
                    <td>
                      {u.hoten || ''}
                      <div className="muted">{u.sdt || ''}</div>
                    </td>
                    <td colSpan={2}>{u.diachi || ''}</td>
                    <td className="actions">
                      <button className="btn-secondary" onClick={() => handleEdit(u.user_id)}>
                        Sửa
                      </button>
                      <button className="btn-danger" onClick={() => handleDelete(u.user_id)}>
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
            <h3>{editingId ? `Sửa user #${editingId}` : 'Thêm user'}</h3>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              <div>
                <label>Tài khoản</label>
                <input
                  value={formData.taikhoan}
                  onChange={(e) => setFormData({ ...formData, taikhoan: e.target.value })}
                />
                <label>Mật khẩu{editingId ? ' (để trống nếu không đổi)' : ''}</label>
                <input
                  type="password"
                  value={formData.matkhau}
                  onChange={(e) => setFormData({ ...formData, matkhau: e.target.value })}
                />
                <label>Họ tên</label>
                <input
                  value={formData.hoten}
                  onChange={(e) => setFormData({ ...formData, hoten: e.target.value })}
                />
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div>
                <label>SĐT</label>
                <input
                  value={formData.sdt}
                  onChange={(e) => setFormData({ ...formData, sdt: e.target.value })}
                />
                <label>Địa chỉ</label>
                <input
                  value={formData.diachi}
                  onChange={(e) => setFormData({ ...formData, diachi: e.target.value })}
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

export default Users;

