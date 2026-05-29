from flask import Blueprint, request
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from utils import ok, err, get_mysql

auth_bp = Blueprint("auth", __name__)

@auth_bp.post("/register")
def register():
    mysql = get_mysql()
    data = request.get_json(force=True) or {}
    required = ["taikhoan","matkhau","hoten","email","sdt","diachi"]
    if not all(str(data.get(k,"")).strip() for k in required):
        return err("Thiếu dữ liệu (cần: taikhoan, matkhau, hoten, email, sdt, diachi)")
    taikhoan = data["taikhoan"].strip()
    email = data["email"].strip().lower()
    cur = mysql.connection.cursor()
    cur.execute("SELECT user_id FROM users WHERE taikhoan=%s OR email=%s", (taikhoan, email))
    if cur.fetchone():
        return err("Tài khoản hoặc email đã tồn tại", 409)
    hashed = generate_password_hash(data["matkhau"])
    cur.execute("""
        INSERT INTO users(taikhoan, matkhau, hoten, email, sdt, diachi)
        VALUES(%s,%s,%s,%s,%s,%s)
    """, (taikhoan, hashed, data["hoten"], email, data["sdt"], data["diachi"]))
    mysql.connection.commit()
    return ok({"message":"Đăng ký thành công"}, 201)

@auth_bp.post("/login")
def login():
    mysql = get_mysql()
    data = request.get_json(force=True) or {}
    taikhoan = data.get("taikhoan","").strip()
    matkhau  = data.get("matkhau","")
    if not taikhoan or not matkhau:
        return err("Thiếu tài khoản hoặc mật khẩu")
    cur = mysql.connection.cursor()
    cur.execute("SELECT * FROM users WHERE taikhoan=%s", (taikhoan,))
    u = cur.fetchone()
    if not u or not check_password_hash(u["matkhau"], matkhau):
        return err("Sai tài khoản hoặc mật khẩu", 401)
    token = create_access_token(identity=str(u["user_id"]), additional_claims={"is_admin": False})
    return ok({
        "access_token": token,
        "user": {
            "taikhoan": u["taikhoan"], "hoten": u["hoten"], "email": u["email"],
            "sdt": u.get("sdt",""), "diachi": u["diachi"]
        }
    })

@auth_bp.get("/me")
@jwt_required()
def me():
    mysql = get_mysql()
    uid = int(get_jwt_identity())
    cur = mysql.connection.cursor()
    cur.execute("SELECT taikhoan, hoten, email, sdt, diachi FROM users WHERE user_id=%s", (uid,))
    u = cur.fetchone()
    if not u:
        return err("Không tìm thấy người dùng", 404)
    return ok(u)

