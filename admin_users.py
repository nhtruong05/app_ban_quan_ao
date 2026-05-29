from flask import Blueprint, request
from math import ceil
from datetime import datetime
from utils import ok, err, get_mysql, admin_required
from flask import stream_with_context
import json, time

admin_users_bp = Blueprint("admin_users", __name__)


@admin_users_bp.get("/users")
@admin_required
def admin_list_users():
    mysql = get_mysql()
    q = (request.args.get("q","") or "").strip()
    try:
        page = max(int(request.args.get("page",1)),1)
        page_size = max(min(int(request.args.get("page_size",20)),200),1)
    except ValueError:
        return err("page/page_size không hợp lệ")
    offset = (page-1)*page_size

    wheres, params = [], []
    if q:
        wheres.append("(taikhoan LIKE %s OR hoten LIKE %s OR email LIKE %s OR sdt LIKE %s)")
        like = f"%{q}%"; params.extend([like, like, like, like])
    where_sql = ("WHERE "+" AND ".join(wheres)) if wheres else ""

    cur = mysql.connection.cursor()
    cur.execute(f"SELECT COUNT(*) AS cnt FROM users {where_sql}", tuple(params))
    total = (cur.fetchone() or {}).get("cnt",0)

    cur.execute(
        f"""
        SELECT user_id, taikhoan, hoten, email, sdt, diachi
        FROM users {where_sql}
        ORDER BY user_id DESC LIMIT %s OFFSET %s
        """,
        tuple(params+[page_size, offset])
    )
    items = cur.fetchall() or []
    return ok({"items": items, "total": total, "page": page, "page_size": page_size, "total_pages": ceil((total or 0)/page_size) if page_size else 0})


@admin_users_bp.post("/users")
@admin_required
def admin_create_user():
    mysql = get_mysql()
    data = request.get_json(force=True) or {}
    required = ["taikhoan","matkhau","hoten","email"]
    if not all(str(data.get(k,"")).strip() for k in required):
        return err("Thiếu dữ liệu (cần: taikhoan, matkhau, hoten, email)")
    from werkzeug.security import generate_password_hash
    cur = mysql.connection.cursor()
    cur.execute("SELECT user_id FROM users WHERE taikhoan=%s OR email=%s", (data["taikhoan"], data["email"]))
    if cur.fetchone():
        return err("Tài khoản hoặc email đã tồn tại", 409)
    cur.execute(
        """
        INSERT INTO users(taikhoan, matkhau, hoten, email, sdt, diachi)
        VALUES(%s,%s,%s,%s,%s,%s)
        """,
        (
            data["taikhoan"].strip(),
            generate_password_hash(data["matkhau"]),
            data.get("hoten",""), data.get("email",""),
            data.get("sdt",""), data.get("diachi","")
        )
    )
    mysql.connection.commit()
    return ok({"message":"Tạo user thành công", "user_id": cur.lastrowid}, 201)


@admin_users_bp.put("/users/<int:uid>")
@admin_required
def admin_update_user(uid: int):
    mysql = get_mysql()
    data = request.get_json(force=True) or {}
    sets, params = [], []
    updatable = ["taikhoan","hoten","email","sdt","diachi"]
    for k in updatable:
        if k in data:
            v = data[k]
            if k == "is_online":
                v = int(bool(v))
            sets.append(f"{k}=%s"); params.append(v)
    if "matkhau" in data and str(data["matkhau"]).strip():
        from werkzeug.security import generate_password_hash
        sets.append("matkhau=%s"); params.append(generate_password_hash(data["matkhau"]))
    if not sets:
        return err("Không có trường nào để cập nhật")
    params.append(uid)
    cur = mysql.connection.cursor()
    cur.execute(f"UPDATE users SET {', '.join(sets)} WHERE user_id=%s", tuple(params))
    mysql.connection.commit()
    return ok({"message":"Đã cập nhật user"})


@admin_users_bp.delete("/users/<int:uid>")
@admin_required
def admin_delete_user(uid: int):
    mysql = get_mysql()
    cur = mysql.connection.cursor()

    # Kiểm tra user tồn tại không
    cur.execute("SELECT user_id FROM users WHERE user_id=%s", (uid,))
    if not cur.fetchone():
        return err("User không tồn tại", 404)

    # Xóa dữ liệu liên quan trước (tránh lỗi foreign key)
    cur.execute("DELETE FROM carts WHERE user_id=%s", (uid,))
    # Nếu có thêm bảng khác thì thêm vào đây, ví dụ:
    # cur.execute("DELETE FROM orders WHERE user_id=%s", (uid,))
    # cur.execute("DELETE FROM reviews WHERE user_id=%s", (uid,))

    cur.execute("DELETE FROM users WHERE user_id=%s", (uid,))
    mysql.connection.commit()
    return ok({"message": "Đã xoá user"})

    # Trạng thái online/offline realtime đã bỏ


