import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const { showToast } = useToast();

  const handleLogout = () => {
    if (window.confirm('Bạn có chắc muốn đăng xuất?')) {
      logout();
      showToast('Đã đăng xuất');
      navigate('/dashboard');
    }
  };

  const isActive = (path) => {
    return location.pathname === path ? 'active' : '';
  };

  return (
    <header>
      <div className="nav">
        <div className="row" style={{ gap: '20px', flex: 1 }}>
          <div className="brand">👔 Admin Đỗ Nhật Trường</div>
          <div className="tabs">
            <Link to="/dashboard" className={`tab ${isActive('/dashboard')}`}>
              📊 Dashboard
            </Link>
            <Link to="/products" className={`tab ${isActive('/products')}`}>
              👕 Quản lý sản phẩm
            </Link>
            <Link to="/orders" className={`tab ${isActive('/orders')}`}>
              📦 Quản lý đơn hàng
            </Link>
            <Link to="/users" className={`tab ${isActive('/users')}`}>
              👥 Quản lý người dùng
            </Link>
            <Link to="/reports" className={`tab ${isActive('/reports')}`}>
              📈 Báo cáo
            </Link>
          </div>
        </div>
        <div className="row" style={{ gap: '12px', alignItems: 'center' }}>
          <span className="muted" style={{ fontSize: '13px', padding: '8px 14px', background: 'var(--bg-soft)', borderRadius: '10px', whiteSpace: 'nowrap' }}>
            {currentUser
              ? `${currentUser.hoten || currentUser.taikhoan} (${currentUser.email})`
              : 'Chưa đăng nhập'}
          </span>
          {!currentUser ? (
            <button className="btn-secondary" onClick={() => navigate('/auth')}>
              🔐 Đăng nhập
            </button>
          ) : (
            <button className="btn-secondary" onClick={handleLogout}>
              Đăng xuất
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;

