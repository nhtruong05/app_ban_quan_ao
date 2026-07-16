from flask import Flask, jsonify
from datetime import timedelta
from dotenv import load_dotenv
from flask import send_from_directory
import os
import sys


# Fix encoding cho Windows console
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except:
        pass

# NEW: CORS + ProxyFix
from flask_cors import CORS
from werkzeug.middleware.proxy_fix import ProxyFix

from extensions import init_extensions
from auth import auth_bp
from admin_auth import admin_auth_bp
from admin_users import admin_users_bp
from shop import shop_bp
from admin_products import admin_products_bp
from payments_vnpay import vnpay_bp
from chatbot import chatbot_bp
from admin_orders import admin_orders_bp
from admin_categories import categories_bp 

load_dotenv()

app = Flask(__name__, static_url_path="/static", static_folder="static")
app.json.ensure_ascii = False

# ===== Secrets / JWT =====
app.config['SECRET_KEY'] = os.getenv("FLASK_SECRET", "dev")
app.config['JWT_SECRET_KEY'] = os.getenv("JWT_SECRET", "devjwt")
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=7)
app.config['JWT_TOKEN_LOCATION'] = ['headers', 'query_string']
app.config['JWT_QUERY_STRING_NAME'] = 'token'

# ===== MySQL =====
app.config['MYSQL_HOST'] = os.getenv("MYSQL_HOST", "localhost")
app.config['MYSQL_PORT'] = int(os.getenv("MYSQL_PORT", "3306"))
app.config['MYSQL_USER'] = os.getenv("MYSQL_USER", "root")
app.config['MYSQL_PASSWORD'] = '123456'
app.config['MYSQL_DB'] = os.getenv("MYSQL_DB", "donhattruongapp")
app.config['MYSQL_CURSORCLASS'] = 'DictCursor'

# ===== Public URL =====
# Đặt PUBLIC_BASE_URL=<https://xxxx.ngrok-free.app> trong .env để VNPAY return chuẩn.
app.config['PUBLIC_BASE_URL'] = os.getenv("PUBLIC_BASE_URL")  # có thể None

# ===== Upload config =====
app.config['UPLOAD_FOLDER'] = os.path.join(app.root_path, 'static', 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# ===== NEW: CORS & ProxyFix =====
# expose Authorization để Android đọc token trả về (nếu có).
CORS(app, resources={r"/api/*": {"origins": "*"}}, expose_headers=["Authorization"])
# Tôn trọng X-Forwarded-Proto/Host khi chạy sau ngrok/Nginx (giúp dựng URL trả về VNPAY đúng https://...)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

# ===== Init & register =====
init_extensions(app)
app.register_blueprint(auth_bp, url_prefix="/api")
app.register_blueprint(admin_auth_bp, url_prefix="/api/admin")
app.register_blueprint(admin_users_bp, url_prefix="/api/admin")
app.register_blueprint(shop_bp, url_prefix="/api")
app.register_blueprint(admin_products_bp, url_prefix="/api/admin")
app.register_blueprint(admin_orders_bp, url_prefix="/api/admin")
app.register_blueprint(vnpay_bp, url_prefix="/api")
app.register_blueprint(chatbot_bp, url_prefix="/api")
app.register_blueprint(categories_bp)

# ===== Health =====
@app.get("/api/health")
def health():
    return {"success": True, "data": {"status": "ok"}}

# ===== NEW: tiện kiểm tra config từ app Android / debug =====
@app.get("/api/config")
def get_config():
    # Xuất 1 số info hữu ích; không lộ secret
    public_url = app.config.get("PUBLIC_BASE_URL")
    # dựng return_url theo logic trong payments_vnpay (để tham khảo nhanh)
    try:
        from payments_vnpay import get_vnpay_urls
        return_url, ipn_url = get_vnpay_urls()
    except Exception:
        return_url, ipn_url = None, None

    return jsonify({
        "success": True,
        "data": {
            "public_base_url": public_url,
            "vnpay_return_url": return_url,
            "vnpay_ipn_url": ipn_url
        }
    })

# ===== JWT error handlers (trả JSON gọn gàng) =====
from flask_jwt_extended import JWTManager
jwt = JWTManager(app)

@jwt.unauthorized_loader
def _unauth(err_msg):
    return jsonify({"success": False, "message": "Thiếu hoặc sai token truy cập"}), 401

@jwt.invalid_token_loader
def _invalid_token(err_msg):
    return jsonify({"success": False, "message": "Token không hợp lệ"}), 401

@jwt.expired_token_loader
def _expired_token(jwt_header, jwt_payload):
    return jsonify({"success": False, "message": "Token đã hết hạn"}), 401

if __name__ == "__main__":
    # (tùy chọn) Đồng bộ Chroma lúc khởi động
    try:
        with app.app_context():
            # Khởi tạo bảng admins (nếu chưa có) và seed admin mặc định
            try:
                from extensions import mysql
                cur = mysql.connection.cursor()
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS admins (
                        admin_id INT AUTO_INCREMENT PRIMARY KEY,
                        taikhoan VARCHAR(100) NOT NULL UNIQUE,
                        matkhau VARCHAR(255) NOT NULL,
                        hoten   VARCHAR(255) NULL,
                        email   VARCHAR(255) NULL
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                    """
                )
                mysql.connection.commit()

                cur.execute("SELECT COUNT(*) AS c FROM admins")
                row = cur.fetchone() or {"c": 0}
                if int(row.get("c", 0) or 0) == 0:
                    from werkzeug.security import generate_password_hash
                    default_user = os.getenv("ADMIN_DEFAULT_USERNAME", "admin").strip()
                    default_pass = os.getenv("ADMIN_DEFAULT_PASSWORD", "admin123")
                    cur.execute(
                        "INSERT INTO admins(taikhoan, matkhau, hoten, email) VALUES(%s,%s,%s,%s)",
                        (default_user, generate_password_hash(default_pass), "Administrator", "admin@example.com")
                    )
                    mysql.connection.commit()
                    print(f"Da tao admin mac dinh: {default_user}")
            except Exception as e:
                print(f"Loi khoi tao bang admins: {e}")

            # Bỏ cột role trong bảng users nếu còn tồn tại (đã tách admin riêng)
            try:
                db_name = app.config.get("MYSQL_DB")
                cur = mysql.connection.cursor()
                cur.execute(
                    """
                    SELECT COUNT(*) AS c
                    FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA=%s AND TABLE_NAME='users' AND COLUMN_NAME='role'
                    """,
                    (db_name,)
                )
                row = cur.fetchone() or {"c": 0}
                if int(row.get("c", 0) or 0) > 0:
                    cur.execute("ALTER TABLE users DROP COLUMN role")
                    mysql.connection.commit()
                    print("Da xoa cot users.role")
            except Exception as e:
                print(f"Khong the xoa cot users.role: {e}")

            # Bỏ cột online/last_seen nếu còn tồn tại
            try:
                cur = mysql.connection.cursor()
                db_name = app.config.get("MYSQL_DB")
                cur.execute(
                    """
                    SELECT COLUMN_NAME FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA=%s AND TABLE_NAME='users' AND COLUMN_NAME IN ('is_online','last_seen')
                    """,
                    (db_name,)
                )
                cols = [r.get('COLUMN_NAME') for r in (cur.fetchall() or [])]
                for col in cols:
                    try:
                        cur.execute(f"ALTER TABLE users DROP COLUMN {col}")
                        mysql.connection.commit()
                        print(f"Da xoa cot users.{col}")
                    except Exception as ie:
                        print(f"Khong the xoa cot {col}: {ie}")
            except Exception as e:
                print(f"Khong the kiem tra/xoa cot online/last_seen: {e}")

            # Đồng bộ dữ liệu sản phẩm vào Chroma cho chatbot
            try:
                from chatbot import sync_mysql_to_chromadb
                cnt = sync_mysql_to_chromadb()
                print(f"✅ Khởi động server: Đã đồng bộ {cnt} sản phẩm từ MySQL sang ChromaDB")
            except Exception as e:
                print(f"❌ Lỗi đồng bộ ChromaDB lúc khởi động: {e}")
                import traceback
                traceback.print_exc()
    except Exception as e:
        print(f"Loi khoi tao application: {e}")

    # chạy dev server, tắt autoreloader để tránh lỗi WinError 10038 trên Windows
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True,
        use_reloader=False,   # quan trọng: tắt autoreload
        threaded=True
    )
