# ============================================================
# admin_categories.py (v3) - CRUD danh muc san pham
# Dung chung ket noi MySQL cua project (extensions.mysql),
# giong het cach admin_products.py dang lam. KHONG can cai them gi.
#
# Dang ky trong app.py - them 1 dong vao cuoi cum register,
# KHONG co url_prefix (vi route ben duoi da chua duong dan day du,
# gom ca /api/categories public va /api/admin/categories cho admin):
#
#     app.register_blueprint(categories_bp)
#
# XAC THUC ADMIN (v3): 3 route POST/PUT/DELETE da gan
# @admin_required tu utils.py. LUU Y THU TU DECORATOR:
# dong route (@categories_bp.route) phai nam TREN,
# @admin_required nam DUOI no, ngay tren def - nguoc lai
# thi admin_required se KHONG chay (Python ap decorator tu duoi len,
# Flask dang ky ham tai thoi diem dong route chay).
# ============================================================

from flask import Blueprint, jsonify, request

from extensions import mysql
from utils import admin_required

categories_bp = Blueprint("categories", __name__)

SIZE_TYPES = {"LETTER", "SHOE", "BELT", "FREESIZE"}


def ok(data=None, message="OK"):
    return jsonify({"success": True, "message": message, "data": data})


def fail(message, status=400):
    return jsonify({"success": False, "message": message, "data": None}), status


def fetch_categories(cur, category_id=None):
    """Doc danh muc kem sizes + chat_lieus. JSON tra ve dung contract
    ma app Android va trang admin React cung parse."""
    if category_id is None:
        cur.execute(
            "SELECT id, name, group_name, size_type FROM categories ORDER BY id"
        )
    else:
        cur.execute(
            "SELECT id, name, group_name, size_type FROM categories WHERE id = %s",
            (category_id,),
        )
    cats = cur.fetchall() or []

    cur.execute(
        """
        SELECT category_id, attr_type, attr_value
        FROM category_attributes
        ORDER BY category_id, attr_type, sort_order
        """
    )
    rows = cur.fetchall() or []

    attrs = {}
    for r in rows:
        item = attrs.setdefault(r["category_id"], {"sizes": [], "chat_lieus": []})
        if r["attr_type"] == "SIZE":
            item["sizes"].append(r["attr_value"])
        else:
            item["chat_lieus"].append(r["attr_value"])

    result = []
    for c in cats:
        a = attrs.get(c["id"], {"sizes": [], "chat_lieus": []})
        result.append(
            {
                "id": c["id"],
                "ten": c["name"],
                "nhom": c["group_name"],
                "size_type": c["size_type"],
                "sizes": a["sizes"],
                "chat_lieus": a["chat_lieus"],
            }
        )
    return result


def validate_body(body):
    """Kiem tra du lieu POST/PUT. Tra ve (data_sach, thong_bao_loi)."""
    ten = (body.get("ten") or "").strip()
    nhom = (body.get("nhom") or "").strip()
    size_type = (body.get("size_type") or "FREESIZE").strip().upper()
    sizes = body.get("sizes") or []
    chat_lieus = body.get("chat_lieus") or []

    if not ten:
        return None, "Tên danh mục không được để trống"
    if not nhom:
        return None, "Nhóm danh mục không được để trống"
    if size_type not in SIZE_TYPES:
        return None, f"size_type phải là một trong: {', '.join(sorted(SIZE_TYPES))}"

    sizes = [str(s).strip() for s in sizes if str(s).strip()]
    chat_lieus = [str(m).strip() for m in chat_lieus if str(m).strip()]
    sizes = list(dict.fromkeys(sizes))          # bo trung, giu thu tu
    chat_lieus = list(dict.fromkeys(chat_lieus))

    if size_type == "FREESIZE":
        sizes = []  # freesize khong luu size
    elif not sizes:
        return None, "Danh mục có size cần ít nhất 1 size"

    return {
        "ten": ten,
        "nhom": nhom,
        "size_type": size_type,
        "sizes": sizes,
        "chat_lieus": chat_lieus,
    }, None


def insert_attributes(cur, category_id, data):
    rows = []
    for i, s in enumerate(data["sizes"], start=1):
        rows.append((category_id, "SIZE", s, i))
    for i, m in enumerate(data["chat_lieus"], start=1):
        rows.append((category_id, "MATERIAL", m, i))
    if rows:
        cur.executemany(
            """
            INSERT INTO category_attributes
                (category_id, attr_type, attr_value, sort_order)
            VALUES (%s, %s, %s, %s)
            """,
            rows,
        )


# ------------------------------------------------------------
# GET /api/categories  (public - app Android va admin dung chung)
# ------------------------------------------------------------
@categories_bp.route("/api/categories", methods=["GET"])
def list_categories():
    cur = mysql.connection.cursor()
    try:
        return ok(fetch_categories(cur))
    except Exception as e:
        return fail(f"Lỗi server: {e}", 500)
    finally:
        cur.close()


# ------------------------------------------------------------
# POST /api/admin/categories  - them danh muc
# Body JSON: { ten, nhom, size_type, sizes: [], chat_lieus: [] }
# ------------------------------------------------------------
@categories_bp.route("/api/admin/categories", methods=["POST"])
@admin_required  
def create_category():
    body = request.get_json(silent=True) or {}
    data, err = validate_body(body)
    if err:
        return fail(err)

    cur = mysql.connection.cursor()
    try:
        cur.execute(
            "SELECT id FROM categories WHERE LOWER(name) = LOWER(%s)",
            (data["ten"],),
        )
        if cur.fetchone():
            return fail("Danh mục này đã tồn tại")

        cur.execute(
            "INSERT INTO categories (name, group_name, size_type) VALUES (%s, %s, %s)",
            (data["ten"], data["nhom"], data["size_type"]),
        )
        new_id = cur.lastrowid
        insert_attributes(cur, new_id, data)

        mysql.connection.commit()
        created = fetch_categories(cur, new_id)
        return ok(created[0] if created else None, "Đã thêm danh mục")
    except Exception as e:
        mysql.connection.rollback()
        return fail(f"Lỗi server: {e}", 500)
    finally:
        cur.close()


# ------------------------------------------------------------
# PUT /api/admin/categories/<id>  - sua danh muc
# Cach lam: cap nhat categories, xoa thuoc tinh cu, chen lai moi
# ------------------------------------------------------------
@categories_bp.route("/api/admin/categories/<int:category_id>", methods=["PUT"])
@admin_required  # DUOI dong route, TREN def - dung thu tu
def update_category(category_id):
    body = request.get_json(silent=True) or {}
    data, err = validate_body(body)
    if err:
        return fail(err)

    cur = mysql.connection.cursor()
    try:
        cur.execute("SELECT id FROM categories WHERE id = %s", (category_id,))
        if not cur.fetchone():
            return fail("Danh mục không tồn tại", 404)

        cur.execute(
            "SELECT id FROM categories WHERE LOWER(name) = LOWER(%s) AND id <> %s",
            (data["ten"], category_id),
        )
        if cur.fetchone():
            return fail("Tên danh mục đã được dùng cho danh mục khác")

        cur.execute(
            "UPDATE categories SET name = %s, group_name = %s, size_type = %s WHERE id = %s",
            (data["ten"], data["nhom"], data["size_type"], category_id),
        )
        cur.execute(
            "DELETE FROM category_attributes WHERE category_id = %s",
            (category_id,),
        )
        insert_attributes(cur, category_id, data)

        mysql.connection.commit()
        updated = fetch_categories(cur, category_id)
        return ok(updated[0] if updated else None, "Đã cập nhật danh mục")
    except Exception as e:
        mysql.connection.rollback()
        return fail(f"Lỗi server: {e}", 500)
    finally:
        cur.close()


# ------------------------------------------------------------
# DELETE /api/admin/categories/<id>  - xoa danh muc
# An toan nghiep vu: KHONG xoa neu con san pham thuoc danh muc
# ------------------------------------------------------------
@categories_bp.route("/api/admin/categories/<int:category_id>", methods=["DELETE"])
@admin_required  # DUOI dong route, TREN def - dung thu tu
def delete_category(category_id):
    cur = mysql.connection.cursor()
    try:
        cur.execute("SELECT id FROM categories WHERE id = %s", (category_id,))
        if not cur.fetchone():
            return fail("Danh mục không tồn tại", 404)

        cur.execute(
            "SELECT COUNT(*) AS total FROM products WHERE category_id = %s",
            (category_id,),
        )
        row = cur.fetchone() or {"total": 0}
        total = int(row.get("total", 0) or 0)
        if total > 0:
            return fail(
                f"Không thể xóa: đang có {total} sản phẩm thuộc danh mục này. "
                "Hãy chuyển các sản phẩm sang danh mục khác trước."
            )

        # category_attributes tu xoa theo (ON DELETE CASCADE)
        cur.execute("DELETE FROM categories WHERE id = %s", (category_id,))
        mysql.connection.commit()
        return ok(None, "Đã xóa danh mục")
    except Exception as e:
        mysql.connection.rollback()
        return fail(f"Lỗi server: {e}", 500)
    finally:
        cur.close()