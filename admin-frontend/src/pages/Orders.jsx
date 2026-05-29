import React, { useState, useEffect } from 'react';
import { apiFetch, formatVND } from '../services/api';
import { useToast } from '../contexts/ToastContext';

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [orderDetails, setOrderDetails] = useState(null);
  const [showStatusMenu, setShowStatusMenu] = useState(null); // orderId đang mở menu
  const { showToast } = useToast();

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status]);

  const loadOrders = async () => {
    try {
      const res = await apiFetch(
        `/api/admin/orders?page=${page}&page_size=${pageSize}&status=${encodeURIComponent(status)}`
      );
      setOrders(res.data?.items || []);
      setTotal(res.data?.total || 0);
    } catch (error) {
      showToast('Lỗi tải đơn hàng: ' + error.message);
    }
  };

  const updateStatus = async (id, newStatus) => {
    try {
      await apiFetch(`/api/admin/orders/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ trangthai: newStatus }),
      });
      showToast(`Đã cập nhật đơn #${id}`);
      loadOrders();
    } catch (error) {
      showToast('Lỗi cập nhật: ' + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(`Bạn có chắc muốn xóa đơn hàng #${id}?`)) return;
    try {
      await apiFetch(`/api/admin/orders/${id}`, { method: 'DELETE' });
      showToast(`Đã xóa đơn hàng #${id}`);
      loadOrders();
    } catch (error) {
      showToast('Lỗi xóa đơn hàng: ' + error.message);
    }
  };

  const handleViewDetails = async (id) => {
    try {
      const res = await apiFetch(`/api/admin/orders/${id}/details`);
      setOrderDetails(res.data);
      setShowDetailModal(true);
    } catch (error) {
      showToast('Lỗi tải chi tiết đơn hàng: ' + error.message);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await updateStatus(id, newStatus);
      setShowStatusMenu(null); // Đóng menu sau khi cập nhật
    } catch (error) {
      // Error đã được xử lý trong updateStatus
    }
  };

  // Đóng menu khi click bên ngoài
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.status-menu-container')) {
        setShowStatusMenu(null);
      }
    };
    if (showStatusMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showStatusMenu]);

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

  const formatDateVietnamese = (dateString) => {
    if (!dateString) return '';
    try {
      // MySQL trả về datetime dạng "YYYY-MM-DD HH:MM:SS" (không có timezone)
      // Giả sử datetime này là ở timezone UTC+7 (Vietnam)
      // Parse string và tạo Date object với timezone UTC+7
      let date;
      
      // Nếu có format ISO với timezone
      if (dateString.includes('T') || dateString.includes('+') || dateString.endsWith('Z')) {
        date = new Date(dateString);
      } else {
        // Format: "YYYY-MM-DD HH:MM:SS" - giả sử là UTC+7
        // Parse thủ công để tránh timezone conversion
        const parts = dateString.trim().split(/[\s-:]/);
        if (parts.length >= 6) {
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1; // JS month is 0-based
          const day = parseInt(parts[2], 10);
          const hours = parseInt(parts[3], 10);
          const minutes = parseInt(parts[4], 10);
          const seconds = parseInt(parts[5], 10);
          
          // Tạo Date object với local time (browser sẽ tự động dùng local timezone)
          // Nhưng vì MySQL datetime đã là UTC+7, cần điều chỉnh
          // Giả sử browser ở UTC+7, thì không cần điều chỉnh
          // Nếu browser ở timezone khác, cần convert
          date = new Date(year, month, day, hours, minutes, seconds);
          
          // Nếu browser timezone offset khác UTC+7, cần điều chỉnh
          const browserOffset = date.getTimezoneOffset(); // minutes, UTC+7 = -420
          const vnOffset = -420; // UTC+7 = -420 minutes
          const diffMinutes = browserOffset - vnOffset;
          
          if (diffMinutes !== 0) {
            // Điều chỉnh để giữ nguyên giờ như MySQL (UTC+7)
            date = new Date(date.getTime() - diffMinutes * 60 * 1000);
          }
        } else {
          // Fallback: parse như bình thường
          date = new Date(dateString);
        }
      }
      
      if (isNaN(date.getTime())) {
        console.error('Invalid date:', dateString);
        return dateString;
      }
      
      // Lấy các giá trị theo local time (đã điều chỉnh)
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      
      // Tên thứ trong tuần (tiếng Việt)
      const thu = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
      const dayOfWeek = thu[date.getDay()];
      
      // Tên tháng (tiếng Việt)
      const thang = ['tháng 1', 'tháng 2', 'tháng 3', 'tháng 4', 'tháng 5', 'tháng 6',
                     'tháng 7', 'tháng 8', 'tháng 9', 'tháng 10', 'tháng 11', 'tháng 12'];
      const monthName = thang[date.getMonth()];
      
      // Format: "Thứ hai, 15 tháng 01 năm 2024, 10:30:45"
      return `${dayOfWeek}, ${day} ${monthName} năm ${year}, ${hours}:${minutes}:${seconds}`;
    } catch (e) {
      console.error('Error formatting date:', e, dateString);
      return dateString;
    }
  };

  return (
    <div className="section">
      <div className="card">
        <div className="row">
          <strong>Quản lý đơn hàng</strong>
          <select
            className="right"
            style={{ maxWidth: '200px' }}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả trạng thái</option>
            <option>Chờ xác nhận</option>
            <option>Đã thanh toán</option>
            <option>Đang giao</option>
            <option>Hoàn thành</option>
            <option>Hủy</option>
          </select>
          <button className="btn-secondary" onClick={loadOrders}>
            Làm mới
          </button>
        </div>

        <div className="section">
          {orders.length === 0 ? (
            <p className="muted">Chưa có đơn.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Ảnh SP</th>
                  <th>Sản phẩm / Khách hàng</th>
                  <th>Tổng</th>
                  <th>Trạng thái</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="muted">#{o.id}</td>
                    <td>
                      {o.hinh_anh && (
                        <img
                          className="thumb"
                          src={getImageUrl(o.hinh_anh)}
                          alt=""
                          onError={(e) => (e.target.style.display = 'none')}
                        />
                      )}
                    </td>
                    <td>
                      <div className="muted">
                        KH: {o.hoten || ''} • {o.sdt || ''}
                      </div>
                      {o.diachi_giaohang && (
                        <div className="muted">Địa chỉ: {o.diachi_giaohang}</div>
                      )}
                      <div className="muted">Tổng trong đơn: {o.order_total_soluong || 0} sp</div>
                      <div className="muted">Sản phẩm trong đơn: {o.order_products_names || '—'}</div>
                    </td>
                    <td>
                      {formatVND(o.tongtien)}
                      <div className="muted">{o.payment_method || ''}</div>
                    </td>
                    <td>
                      <span className="pill">{o.trangthai}</span>
                      <div className="muted">{formatDateVietnamese(o.created_at)}</div>
                    </td>
                    <td className="actions">
                      <button className="btn-secondary" onClick={() => handleViewDetails(o.id)}>
                        Xem chi tiết
                      </button>
                      <div className="status-menu-container" style={{ position: 'relative', display: 'inline-block' }}>
                        <button 
                          className="btn-warn" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowStatusMenu(showStatusMenu === o.id ? null : o.id);
                          }}
                        >
                          Cập nhật trạng thái
                        </button>
                        {showStatusMenu === o.id && (
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            marginTop: '4px',
                            backgroundColor: 'white',
                            border: '1px solid var(--border-light)',
                            borderRadius: '8px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            zIndex: 1000,
                            minWidth: '160px',
                            overflow: 'hidden'
                          }}>
                            <button
                              style={{
                                display: 'block',
                                width: '100%',
                                padding: '10px 16px',
                                textAlign: 'left',
                                border: 'none',
                                backgroundColor: o.trangthai === 'Chờ xác nhận' ? 'var(--primary-light)' : 'white',
                                cursor: 'pointer',
                                fontSize: '14px'
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(o.id, 'Chờ xác nhận');
                              }}
                              onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--primary-light)'}
                              onMouseLeave={(e) => e.target.style.backgroundColor = o.trangthai === 'Chờ xác nhận' ? 'var(--primary-light)' : 'white'}
                            >
                              Chờ xác nhận
                            </button>
                            <button
                              style={{
                                display: 'block',
                                width: '100%',
                                padding: '10px 16px',
                                textAlign: 'left',
                                border: 'none',
                                borderTop: '1px solid var(--border-light)',
                                backgroundColor: o.trangthai === 'Đã thanh toán' ? 'var(--primary-light)' : 'white',
                                cursor: 'pointer',
                                fontSize: '14px'
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(o.id, 'Đã thanh toán');
                              }}
                              onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--primary-light)'}
                              onMouseLeave={(e) => e.target.style.backgroundColor = o.trangthai === 'Đã thanh toán' ? 'var(--primary-light)' : 'white'}
                            >
                              Đã thanh toán
                            </button>
                            <button
                              style={{
                                display: 'block',
                                width: '100%',
                                padding: '10px 16px',
                                textAlign: 'left',
                                border: 'none',
                                borderTop: '1px solid var(--border-light)',
                                backgroundColor: o.trangthai === 'Hủy' ? 'var(--primary-light)' : 'white',
                                cursor: 'pointer',
                                fontSize: '14px'
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(o.id, 'Hủy');
                              }}
                              onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--primary-light)'}
                              onMouseLeave={(e) => e.target.style.backgroundColor = o.trangthai === 'Hủy' ? 'var(--primary-light)' : 'white'}
                            >
                              Hủy
                            </button>
                            <button
                              style={{
                                display: 'block',
                                width: '100%',
                                padding: '10px 16px',
                                textAlign: 'left',
                                border: 'none',
                                borderTop: '1px solid var(--border-light)',
                                backgroundColor: o.trangthai === 'Đang giao' ? 'var(--primary-light)' : 'white',
                                cursor: 'pointer',
                                fontSize: '14px'
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(o.id, 'Đang giao');
                              }}
                              onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--primary-light)'}
                              onMouseLeave={(e) => e.target.style.backgroundColor = o.trangthai === 'Đang giao' ? 'var(--primary-light)' : 'white'}
                            >
                              Đang giao
                            </button>
                            <button
                              style={{
                                display: 'block',
                                width: '100%',
                                padding: '10px 16px',
                                textAlign: 'left',
                                border: 'none',
                                borderTop: '1px solid var(--border-light)',
                                backgroundColor: o.trangthai === 'Hoàn thành' ? 'var(--primary-light)' : 'white',
                                cursor: 'pointer',
                                fontSize: '14px'
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(o.id, 'Hoàn thành');
                              }}
                              onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--primary-light)'}
                              onMouseLeave={(e) => e.target.style.backgroundColor = o.trangthai === 'Hoàn thành' ? 'var(--primary-light)' : 'white'}
                            >
                              Hoàn thành
                            </button>
                          </div>
                        )}
                      </div>
                      <button className="btn-danger" onClick={() => handleDelete(o.id)}>
                        Xóa
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

      {/* Modal chi tiết đơn hàng */}
      {showDetailModal && orderDetails && (
        <div className="modal-overlay active" onClick={() => setShowDetailModal(false)}>
          <div className="card modal" onClick={(e) => e.stopPropagation()}>
            <div className="row">
              <h3>Chi tiết đơn hàng #{orderDetails.order.id}</h3>
              <button className="btn-secondary" onClick={() => setShowDetailModal(false)}>
                Đóng
              </button>
            </div>

            <div className="section">
              <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                <div>
                  <strong>Thông tin khách hàng:</strong>
                  <div className="muted">Họ tên: {orderDetails.order.hoten || '—'}</div>
                  <div className="muted">SĐT: {orderDetails.order.sdt || '—'}</div>
                  <div className="muted">Địa chỉ: {orderDetails.order.diachi_giaohang || '—'}</div>
                </div>
                <div>
                  <strong>Thông tin đơn hàng:</strong>
                  <div className="muted">Trạng thái: {orderDetails.order.trangthai || '—'}</div>
                  <div className="muted">Thanh toán: {orderDetails.order.payment_method || '—'}</div>
                  <div className="muted">Tổng tiền: {formatVND(orderDetails.order.tongtien)}</div>
                  <div className="muted">Ngày tạo: {formatDateVietnamese(orderDetails.order.created_at)}</div>
                </div>
              </div>
            </div>

            <div className="section">
              <strong>Sản phẩm trong đơn ({orderDetails.items.length}):</strong>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', 
                gap: '16px',
                marginTop: '16px'
              }}>
                {orderDetails.items.map((item, idx) => (
                  <div key={idx} style={{ 
                    border: '1px solid var(--border-light)', 
                    borderRadius: '8px',
                    padding: '12px',
                    textAlign: 'center'
                  }}>
                    {item.hinh_anh && (
                      <img
                        src={getImageUrl(item.hinh_anh)}
                        alt={item.ten_san_pham}
                        style={{
                          width: '100%',
                          height: '150px',
                          objectFit: 'cover',
                          borderRadius: '4px',
                          marginBottom: '8px'
                        }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    )}
                    <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>
                      {item.ten_san_pham}
                    </div>
                    <div className="muted" style={{ fontSize: '12px' }}>
                      SL: {item.quantity} × {formatVND(item.unit_price)}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '4px', color: 'var(--primary)' }}>
                      {formatVND(item.line_total)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;

