import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

const Auth = () => {
  const [activeTab, setActiveTab] = useState('login');
  const [loginForm, setLoginForm] = useState({ taikhoan: '', matkhau: '' });
  const [registerForm, setRegisterForm] = useState({
    taikhoan: '',
    matkhau: '',
    hoten: '',
    email: '',
  });
  const { login, register, currentUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (currentUser) {
      navigate('/dashboard');
    }
  }, [currentUser, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginForm.taikhoan || !loginForm.matkhau) {
      showToast('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    try {
      await login(loginForm.taikhoan, loginForm.matkhau);
      showToast('Đăng nhập thành công!');
      navigate('/dashboard');
    } catch (error) {
      showToast(error.message || 'Đăng nhập thất bại');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!registerForm.taikhoan || !registerForm.matkhau || !registerForm.hoten || !registerForm.email) {
      showToast('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    try {
      await register(
        registerForm.taikhoan,
        registerForm.matkhau,
        registerForm.hoten,
        registerForm.email
      );
      showToast('Đăng ký thành công! Vui lòng đăng nhập.');
      setActiveTab('login');
      setRegisterForm({ taikhoan: '', matkhau: '', hoten: '', email: '' });
    } catch (error) {
      showToast(error.message || 'Đăng ký thất bại');
    }
  };

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: '500px', margin: '40px auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 style={{ margin: 0 }}>🔐 Đăng nhập/Đăng ký</h3>
        </div>

        <div className="auth-tabs" style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '2px solid var(--border-light)' }}>
          <button
            className={`auth-tab-btn ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => setActiveTab('login')}
            style={{
              padding: '12px 24px',
              background: 'transparent',
              border: 'none',
              borderBottom: `3px solid ${activeTab === 'login' ? 'var(--primary)' : 'transparent'}`,
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: 500,
              color: activeTab === 'login' ? 'var(--primary)' : 'var(--muted)',
              transition: 'all 0.2s ease',
              marginBottom: '-2px',
            }}
          >
            Đăng nhập
          </button>
          <button
            className={`auth-tab-btn ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => setActiveTab('register')}
            style={{
              padding: '12px 24px',
              background: 'transparent',
              border: 'none',
              borderBottom: `3px solid ${activeTab === 'register' ? 'var(--primary)' : 'transparent'}`,
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: 500,
              color: activeTab === 'register' ? 'var(--primary)' : 'var(--muted)',
              transition: 'all 0.2s ease',
              marginBottom: '-2px',
            }}
          >
            Đăng ký
          </button>
        </div>

        {activeTab === 'login' && (
          <form onSubmit={handleLogin}>
            <label>Tài khoản</label>
            <input
              value={loginForm.taikhoan}
              onChange={(e) => setLoginForm({ ...loginForm, taikhoan: e.target.value })}
              placeholder="Nhập tài khoản"
            />
            <label>Mật khẩu</label>
            <input
              type="password"
              value={loginForm.matkhau}
              onChange={(e) => setLoginForm({ ...loginForm, matkhau: e.target.value })}
              placeholder="Nhập mật khẩu"
            />
            <div className="row section" style={{ marginTop: '20px' }}>
              <button type="submit" style={{ flex: 1 }}>
                Đăng nhập
              </button>
            </div>
          </form>
        )}

        {activeTab === 'register' && (
          <form onSubmit={handleRegister}>
            <label>Tài khoản</label>
            <input
              value={registerForm.taikhoan}
              onChange={(e) => setRegisterForm({ ...registerForm, taikhoan: e.target.value })}
              placeholder="Nhập tài khoản"
            />
            <label>Mật khẩu</label>
            <input
              type="password"
              value={registerForm.matkhau}
              onChange={(e) => setRegisterForm({ ...registerForm, matkhau: e.target.value })}
              placeholder="Nhập mật khẩu"
            />
            <label>Họ tên</label>
            <input
              value={registerForm.hoten}
              onChange={(e) => setRegisterForm({ ...registerForm, hoten: e.target.value })}
              placeholder="Nhập họ tên"
            />
            <label>Email</label>
            <input
              type="email"
              value={registerForm.email}
              onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
              placeholder="Nhập email"
            />
            <div className="row section" style={{ marginTop: '20px' }}>
              <button type="submit" style={{ flex: 1 }}>
                Tạo tài khoản
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default Auth;

