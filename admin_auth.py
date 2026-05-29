from flask import Blueprint, request
from werkzeug.security import check_password_hash, generate_password_hash
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from utils import ok, err, get_mysql

admin_auth_bp = Blueprint("admin_auth", __name__)


@admin_auth_bp.post("/login")
def admin_login():
    mysql = get_mysql()
    data = request.get_json(force=True) or {}
    taikhoan = (data.get("taikhoan") or "").strip()
    matkhau  = data.get("matkhau") or ""
    if not taikhoan or not matkhau:
        return err("Thiếu tài khoản hoặc mật khẩu")
    cur = mysql.connection.cursor()
    cur.execute("SELECT * FROM admins WHERE taikhoan=%s", (taikhoan,))
    a = cur.fetchone()
    if not a or not check_password_hash(a["matkhau"], matkhau):
        return err("Sai tài khoản hoặc mật khẩu", 401)
    token = create_access_token(identity=f"admin:{a['admin_id']}", additional_claims={"is_admin": True})
    return ok({
        "access_token": token,
        "admin": {
            "taikhoan": a["taikhoan"],
            "hoten": a.get("hoten", ""),
            "email": a.get("email", "")
        }
    })


@admin_auth_bp.post("/register")
def admin_register():
    mysql = get_mysql()
    data = request.get_json(force=True) or {}
    taikhoan = (data.get("taikhoan") or "").strip()
    matkhau  = data.get("matkhau") or ""
    hoten    = (data.get("hoten") or "").strip()
    email    = (data.get("email") or "").strip().lower()
    if not taikhoan or not matkhau or not hoten or not email:
        return err("Thiếu dữ liệu (cần: taikhoan, matkhau, hoten, email)")
    cur = mysql.connection.cursor()
    cur.execute("SELECT admin_id FROM admins WHERE taikhoan=%s OR email=%s", (taikhoan, email))
    if cur.fetchone():
        return err("Tài khoản hoặc email đã tồn tại", 409)
    hashed = generate_password_hash(matkhau)
    cur.execute(
        "INSERT INTO admins(taikhoan, matkhau, hoten, email) VALUES(%s,%s,%s,%s)",
        (taikhoan, hashed, hoten, email)
    )
    mysql.connection.commit()
    return ok({"message": "Tạo admin thành công"}, 201)


@admin_auth_bp.get("/me")
@jwt_required()
def admin_me():
    ident = str(get_jwt_identity())
    if not ident.startswith("admin:"):
        return err("Forbidden", 403)
    admin_id = int(ident.split(":", 1)[1])
    mysql = get_mysql()
    cur = mysql.connection.cursor()
    cur.execute("SELECT taikhoan, hoten, email FROM admins WHERE admin_id=%s", (admin_id,))
    a = cur.fetchone()
    if not a:
        return err("Không tìm thấy admin", 404)
    return ok(a)


