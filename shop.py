# shop.py
from flask import Blueprint, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from utils import ok, err, to_float, get_mysql, get_current_user_id, abs_img as _abs_img, public_base as _public_base
from payments_vnpay import get_vnpay_config, get_vnpay_urls, build_vnpay_payment_url

shop_bp = Blueprint("shop", __name__)

PRODUCT_PK = "products_id"
ORDER_PK = "id"

# ==== Upload (dùng chung) ====
from werkzeug.utils import secure_filename
import os
from urllib.parse import urljoin

ALLOWED_EXT = {"png", "jpg", "jpeg", "gif", "webp"}

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXT

@shop_bp.post("/upload")
def upload_file():
    app = current_app._get_current_object()
    if 'file' not in request.files:
        return err("Không có file")
    f = request.files['file']
    if f.filename == '':
        return err("Tên file rỗng")
    if not allowed_file(f.filename):
        return err("Định dạng không hỗ trợ (png, jpg, jpeg, gif, webp)")

    filename = secure_filename(f.filename)
    name, ext = os.path.splitext(filename)

    upload_folder = app.config.get('UPLOAD_FOLDER') or os.path.join(app.root_path, "static", "uploads")
    os.makedirs(upload_folder, exist_ok=True)

    target = os.path.join(upload_folder, filename)
    i = 1
    while os.path.exists(target):
        filename = f"{name}_{i}{ext}"
        target = os.path.join(upload_folder, filename)
        i += 1

    f.save(target)
    rel_path = f"/static/uploads/{filename}"
    return ok({"url": _abs_img(rel_path), "path": rel_path})

# =========================
# Products (public)
# =========================
@shop_bp.get("/products")
def list_products():
    mysql = get_mysql()
    q = request.args.get("q", "").strip()
    category = request.args.get("category", "").strip()
    category_id = request.args.get("category_id", "").strip()  # NEW: loc theo danh muc dong
    gender = request.args.get("gender", "").strip()
    status = request.args.get("status", "").strip()
    size = request.args.get("size", "").strip()
    material = request.args.get("material", "").strip()
    price_min = request.args.get("price_min", request.args.get("priceMin", "")).strip()
    price_max = request.args.get("price_max", request.args.get("priceMax", "")).strip()
    meta = request.args.get("meta", "0") == "1"

    try:
        page = max(int(request.args.get("page", 1)), 1)
        page_size = max(min(int(request.args.get("page_size", 20)), 100), 1)
    except ValueError:
        return err("page/page_size không hợp lệ")

    offset = (page - 1) * page_size
    wheres, params = [], []

    if q:
        wheres.append("(ten_san_pham LIKE %s OR mo_ta LIKE %s)")
        params.extend([f"%{q}%", f"%{q}%"])
    if category:
        wheres.append("loai=%s"); params.append(category)
    if category_id:  # NEW
        try:
            wheres.append("category_id=%s"); params.append(int(category_id))
        except ValueError:
            return err("category_id không hợp lệ")
    if gender:
        wheres.append("gioi_tinh=%s"); params.append(gender)
    if status:
        wheres.append("trang_thai=%s"); params.append(status)
    if size:
        wheres.append("size=%s"); params.append(size)
    if material:
        wheres.append("chat_lieu=%s"); params.append(material)
    if price_min:
        try:
            wheres.append("gia_ban >= %s"); params.append(float(price_min))
        except ValueError:
            return err("price_min/priceMin không hợp lệ")
    if price_max:
        try:
            wheres.append("gia_ban <= %s"); params.append(float(price_max))
        except ValueError:
            return err("price_max/priceMax không hợp lệ")

    where_sql = ("WHERE " + " AND ".join(wheres)) if wheres else ""
    base_cols = f"{PRODUCT_PK} AS product_id, ten_san_pham, gia_ban, loai, mo_ta, size, chat_lieu, gioi_tinh, hinh_anh, trang_thai, category_id"

    cur = mysql.connection.cursor()
    cur.execute(f"SELECT COUNT(*) AS cnt FROM products {where_sql}", tuple(params))
    total = (cur.fetchone() or {}).get("cnt", 0)

    cur.execute(f"""
        SELECT {base_cols}
        FROM products
        {where_sql}
        ORDER BY {PRODUCT_PK} DESC
        LIMIT %s OFFSET %s
    """, tuple(params + [page_size, offset]))
    items = cur.fetchall() or []

    for r in items:
        r["hinh_anh"] = _abs_img(r.get("hinh_anh"))

    return ok({"items": items, "total": total} if meta else items)

@shop_bp.get("/products/<int:pid>")
def get_product(pid: int):
    mysql = get_mysql()
    cur = mysql.connection.cursor()
    cur.execute(f"""
        SELECT {PRODUCT_PK} AS product_id, ten_san_pham, gia_ban, loai, mo_ta, size, chat_lieu, gioi_tinh, hinh_anh, trang_thai, category_id
        FROM products WHERE {PRODUCT_PK}=%s
    """, (pid,))
    row = cur.fetchone()
    if not row:
        return err("Không tìm thấy sản phẩm", 404)
    row["hinh_anh"] = _abs_img(row.get("hinh_anh"))
    return ok(row)

@shop_bp.get("/products/top")
def top_products():
    mysql = get_mysql()
    try:
        limit = int(request.args.get("limit", 3))
        limit = max(1, min(limit, 10))
    except Exception:
        limit = 3

    cur = mysql.connection.cursor()
    cur.execute(f"""
        SELECT p.{PRODUCT_PK} AS product_id,
               p.ten_san_pham, p.gia_ban, p.loai, p.mo_ta, p.size, p.chat_lieu,
               p.gioi_tinh, p.hinh_anh, p.trang_thai,
               SUM(od.quantity) AS total_sold
        FROM products p
        INNER JOIN order_details od ON od.product_id = p.{PRODUCT_PK}
        INNER JOIN orders o ON o.id = od.order_id AND o.trangthai = 'Đã thanh toán'
        GROUP BY p.{PRODUCT_PK}
        ORDER BY total_sold DESC, p.{PRODUCT_PK} DESC
        LIMIT %s
    """, (limit,))
    rows = cur.fetchall() or []

    for r in rows:
        r["hinh_anh"] = _abs_img(r.get("hinh_anh"))
    return ok(rows)

@shop_bp.get("/products/suggest")
def suggest_products():
    mysql = get_mysql()
    q = (request.args.get("q", "") or "").strip()
    try:
        limit = int(request.args.get("limit", 6))
        limit = max(1, min(limit, 10))
    except Exception:
        limit = 6
    if not q:
        return ok([])

    cur = mysql.connection.cursor()
    cur.execute(f"""
        SELECT {PRODUCT_PK} AS product_id, ten_san_pham, gia_ban, hinh_anh
        FROM products
        WHERE ten_san_pham LIKE %s OR mo_ta LIKE %s
        ORDER BY ten_san_pham ASC
        LIMIT %s
    """, (f"%{q}%", f"%{q}%", limit))
    rows = cur.fetchall() or []

    out = []
    for r in rows:
        out.append({
            "id": int(r["product_id"]),
            "name": r["ten_san_pham"],
            "price": float(to_float(r["gia_ban"])),
            "image": _abs_img(r.get("hinh_anh")),
        })
    return ok(out)

# =========================
# Cart helpers
# =========================
_SESSION_INVALID_MSG = "Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại"

def _user_exists(cur, user_id) -> bool:
    cur.execute("SELECT 1 FROM users WHERE user_id=%s", (user_id,))
    return cur.fetchone() is not None

def _ensure_cart(user_id, cur, conn):
    cur.execute("SELECT id FROM carts WHERE user_id=%s", (user_id,))
    r = cur.fetchone()
    if r:
        return r["id"] if isinstance(r, dict) else r[0]
    # NEW: token con han nhung user co the da bi xoa khoi DB (import lai du lieu,
    # doi database...). Kiem tra truoc khi INSERT de tranh loi khoa ngoai -> 500.
    # Tra ve None de route tra 401 sach thay vi lo traceback ra ngoai.
    if not _user_exists(cur, user_id):
        return None
    cur.execute("INSERT INTO carts(user_id) VALUES (%s)", (user_id,))
    conn.commit()
    return cur.lastrowid

def _validate_choice(chosen, allowed_str, label):
    """
    allowed_str là chuỗi kiểu 'S,M,L' lưu trong products.size / chat_lieu / gioi_tinh.
    Nếu sản phẩm không có lựa chọn loại này (chuỗi rỗng/None) -> không bắt buộc chọn.
    Trả về message lỗi (str) nếu không hợp lệ, None nếu hợp lệ.
    """
    allowed = [x.strip() for x in (allowed_str or "").split(",") if x.strip()]
    if not allowed:
        return None
    if not chosen or chosen not in allowed:
        return f"Vui lòng chọn {label} hợp lệ ({', '.join(allowed)})"
    return None

# =========================
# Cart APIs (schema mới - có chosen_size/chosen_chat_lieu/chosen_gioi_tinh)
# =========================
@shop_bp.get("/cart")
@jwt_required()
def cart_list():
    mysql = get_mysql()
    uid = int(get_jwt_identity())
    conn = mysql.connection; cur = conn.cursor()
    cart_id = _ensure_cart(uid, cur, conn)
    if cart_id is None:  # NEW: user trong token khong ton tai
        return err(_SESSION_INVALID_MSG, 401)

    cur.execute("""
      SELECT ci.cart_item_id, ci.products_id AS product_id, ci.quantity,
             ci.chosen_size, ci.chosen_chat_lieu, ci.chosen_gioi_tinh,
             p.ten_san_pham, p.gia_ban, p.hinh_anh, p.size, p.chat_lieu, p.gioi_tinh
      FROM cart_items ci
      JOIN products p ON p.products_id = ci.products_id
      WHERE ci.cart_id=%s
      ORDER BY ci.cart_item_id DESC
    """, (cart_id,))
    items = cur.fetchall() or []
    for r in items:
        r["hinh_anh"] = _abs_img(r.get("hinh_anh"))
    total = sum(to_float(r["gia_ban"]) * int(r["quantity"]) for r in items)
    return ok({"cart_id": cart_id, "items": items, "total_price": total})

@shop_bp.post("/cart/add")
@jwt_required()
def add_to_cart():
    mysql = get_mysql()
    data = request.get_json(force=True) or {}
    try:
        pid = int(data.get("product_id", 0))
        qty = int(data.get("quantity", 0))
    except Exception:
        return err("product_id/quantity không hợp lệ")
    if pid <= 0 or qty <= 0:
        return err("product_id và quantity phải > 0")

    chosen_size = (data.get("chosen_size") or "").strip() or None
    chosen_chat_lieu = (data.get("chosen_chat_lieu") or "").strip() or None
    chosen_gioi_tinh = (data.get("chosen_gioi_tinh") or "").strip() or None

    uid = int(get_jwt_identity())
    conn = mysql.connection; cur = conn.cursor()
    cart_id = _ensure_cart(uid, cur, conn)
    if cart_id is None:  # NEW
        return err(_SESSION_INVALID_MSG, 401)

    cur.execute("SELECT size, chat_lieu, gioi_tinh FROM products WHERE products_id=%s", (pid,))
    product = cur.fetchone()
    if not product:
        return err("Sản phẩm không tồn tại", 404)

    for msg in (
        _validate_choice(chosen_size, product.get("size"), "size"),
        _validate_choice(chosen_chat_lieu, product.get("chat_lieu"), "chất liệu"),
        _validate_choice(chosen_gioi_tinh, product.get("gioi_tinh"), "giới tính"),
    ):
        if msg:
            return err(msg)

    # gộp số lượng nếu cùng sản phẩm + cùng tổ hợp lựa chọn (dùng <=> để so sánh NULL an toàn trong MySQL)
    cur.execute("""
        SELECT cart_item_id, quantity FROM cart_items
        WHERE cart_id=%s AND products_id=%s
          AND chosen_size <=> %s AND chosen_chat_lieu <=> %s AND chosen_gioi_tinh <=> %s
    """, (cart_id, pid, chosen_size, chosen_chat_lieu, chosen_gioi_tinh))
    row = cur.fetchone()
    if row:
        cur.execute("UPDATE cart_items SET quantity=quantity+%s WHERE cart_item_id=%s",
                    (qty, row["cart_item_id"]))
    else:
        cur.execute("""
            INSERT INTO cart_items(cart_id, products_id, quantity, chosen_size, chosen_chat_lieu, chosen_gioi_tinh)
            VALUES(%s,%s,%s,%s,%s,%s)
        """, (cart_id, pid, qty, chosen_size, chosen_chat_lieu, chosen_gioi_tinh))
    conn.commit()
    return ok({"message": "Đã thêm vào giỏ"}, 201)

@shop_bp.put("/cart/item/<int:item_id>")
@jwt_required()
def cart_update(item_id):
    mysql = get_mysql()
    data = request.get_json(force=True) or {}
    try:
        qty = int(data.get("quantity", -1))
    except Exception:
        return err("quantity không hợp lệ")

    uid = int(get_jwt_identity())
    conn = mysql.connection; cur = conn.cursor()
    cart_id = _ensure_cart(uid, cur, conn)
    if cart_id is None:  # NEW
        return err(_SESSION_INVALID_MSG, 401)

    if qty <= 0:
        cur.execute("DELETE FROM cart_items WHERE cart_id=%s AND cart_item_id=%s", (cart_id, item_id))
    else:
        cur.execute("UPDATE cart_items SET quantity=%s WHERE cart_id=%s AND cart_item_id=%s",
                    (qty, cart_id, item_id))
    conn.commit()
    return ok({"message": "OK"})

@shop_bp.delete("/cart/item/<int:item_id>")
@jwt_required()
def cart_delete(item_id):
    mysql = get_mysql()
    uid = int(get_jwt_identity())
    conn = mysql.connection; cur = conn.cursor()
    cart_id = _ensure_cart(uid, cur, conn)
    if cart_id is None:  # NEW
        return err(_SESSION_INVALID_MSG, 401)
    cur.execute("DELETE FROM cart_items WHERE cart_id=%s AND cart_item_id=%s", (cart_id, item_id))
    conn.commit()
    return ok({"message": "Đã xoá sản phẩm khỏi giỏ"})

@shop_bp.delete("/cart/clear")
@jwt_required()
def cart_clear():
    mysql = get_mysql()
    uid = int(get_jwt_identity())
    conn = mysql.connection; cur = conn.cursor()
    cart_id = _ensure_cart(uid, cur, conn)
    if cart_id is None:  # NEW
        return err(_SESSION_INVALID_MSG, 401)
    cur.execute("DELETE FROM cart_items WHERE cart_id=%s", (cart_id,))
    conn.commit()
    return ok({"message": "Đã làm trống giỏ"})

# =========================
# Buy Now (Mua ngay) - không cần giỏ hàng
# =========================
@shop_bp.post("/buy_now")
@jwt_required()
def buy_now():
    mysql = get_mysql()
    data = request.get_json(force=True) or {}
    uid = int(get_jwt_identity())

    # Debug: In ra data nhận được
    print(f"[DEBUG] buy_now data: {data}")
    print(f"[DEBUG] user_id: {uid}")

    # Lấy thông tin sản phẩm và số lượng
    try:
        pid = int(data.get("product_id", 0))
        qty = int(data.get("quantity", 1))
    except Exception as e:
        print(f"[DEBUG] Error parsing product_id/quantity: {e}")
        return err("product_id/quantity không hợp lệ")
    if pid <= 0 or qty <= 0:
        print(f"[DEBUG] Invalid pid={pid}, qty={qty}")
        return err("product_id và quantity phải > 0")

    chosen_size = (data.get("chosen_size") or "").strip() or None
    chosen_chat_lieu = (data.get("chosen_chat_lieu") or "").strip() or None
    chosen_gioi_tinh = (data.get("chosen_gioi_tinh") or "").strip() or None

    # Lấy thông tin giao hàng
    hoten  = (data.get("hoten") or "").strip()
    email  = (data.get("email") or "").strip()
    sdt    = (data.get("sdt") or "").strip()
    diachi = (data.get("diachi_giaohang") or "").strip()
    method = (data.get("payment_method") or "COD").strip().upper()
    
    print(f"[DEBUG] Customer info: hoten='{hoten}', email='{email}', sdt='{sdt}', diachi='{diachi}'")
    
    if not (hoten and email and sdt and diachi):
        print(f"[DEBUG] Missing required fields")
        return err("Thiếu họ tên / email / SĐT / địa chỉ")

    conn = mysql.connection; cur = conn.cursor()

    if not _user_exists(cur, uid):  # NEW: chan token mo coi truoc khi tao don
        return err(_SESSION_INVALID_MSG, 401)

    # Kiểm tra sản phẩm tồn tại và lấy thông tin (kèm size/chat_lieu/gioi_tinh để validate)
    cur.execute("""
        SELECT products_id, ten_san_pham, gia_ban, trang_thai, size, chat_lieu, gioi_tinh
        FROM products WHERE products_id=%s
    """, (pid,))
    product = cur.fetchone()
    if not product:
        return err("Sản phẩm không tồn tại", 404)
    if product["trang_thai"] != "Đang bán":
        print(f"[DEBUG] Product status is '{product['trang_thai']}', not 'Đang bán'")
        return err("Sản phẩm không còn hàng")

    for msg in (
        _validate_choice(chosen_size, product.get("size"), "size"),
        _validate_choice(chosen_chat_lieu, product.get("chat_lieu"), "chất liệu"),
        _validate_choice(chosen_gioi_tinh, product.get("gioi_tinh"), "giới tính"),
    ):
        if msg:
            return err(msg)

    # Tính tổng tiền
    total = float(product["gia_ban"]) * qty

    # Tạo đơn hàng
    cur.execute("""
        INSERT INTO orders(user_id, tongtien, trangthai, diachi_giaohang, hoten, sdt, payment_method)
        VALUES (%s,%s,'Chờ xác nhận',%s,%s,%s,%s)
    """, (uid, total, diachi, hoten, sdt, method))
    order_id = cur.lastrowid

    # Tạo chi tiết đơn hàng (kèm lựa chọn)
    cur.execute("""
        INSERT INTO order_details(order_id, product_id, unit_price, quantity, chosen_size, chosen_chat_lieu, chosen_gioi_tinh)
        VALUES (%s,%s,%s,%s,%s,%s,%s)
    """, (order_id, pid, float(product["gia_ban"]), qty, chosen_size, chosen_chat_lieu, chosen_gioi_tinh))

    # Xử lý theo phương thức thanh toán
    if method == "VNPAY":
        cfg = get_vnpay_config()
        if not (cfg["VNPAY_TMN_CODE"] and cfg["VNPAY_HASH_SECRET"] and cfg["VNPAY_PAYMENT_URL"]):
            return err("Chưa cấu hình VNPAY đầy đủ trên server")
        VNPAY_RETURN_URL, _ = get_vnpay_urls()
        payment_url = build_vnpay_payment_url(
            amount_vnd=total,
            order_id=str(order_id),
            order_info=f"Thanh toan don hang: {order_id}",
            ip_addr=request.headers.get("X-Forwarded-For", request.remote_addr),
            return_url=VNPAY_RETURN_URL
        )
        cur.execute(f"UPDATE orders SET payment_token=%s WHERE {ORDER_PK}=%s", (f"VNPAY:{order_id}", order_id))
        mysql.connection.commit()  # Commit đơn hàng và chi tiết
        return ok({"order_id": order_id, "total": round(total, 2), "payment_method": method,
                   "payment_url": payment_url, "return_url_prefix": VNPAY_RETURN_URL}, 201)
    elif method == "COD":
        # COD: Tự động chuyển sang "Đã thanh toán" khi đã xác nhận
        cur.execute(f"UPDATE orders SET trangthai='Đã thanh toán', payment_token=%s WHERE {ORDER_PK}=%s",
                   (f"COD_CONFIRMED:{order_id}", order_id))
        mysql.connection.commit()  # Commit đơn hàng và chi tiết
        return ok({"order_id": order_id, "total": round(total, 2), "payment_method": method,
                   "message": "COD payment confirmed"}, 201)
    elif method == "GGPAY":
        # GGPay: Nếu app gọi buy_now với GGPay, có nghĩa là đã thanh toán thành công
        # (vì app chỉ gọi buy_now sau khi Google Pay trả về thành công)
        payment_token = data.get("payment_token", "").strip()
        token_to_save = payment_token if payment_token and payment_token != "examplePaymentMethodToken" else f"GGPAY_TOKEN_{order_id}"
        
        # Tự động cập nhật status thành "Đã thanh toán" vì đã thanh toán thành công
        cur.execute(f"UPDATE orders SET trangthai='Đã thanh toán', payment_token=%s WHERE {ORDER_PK}=%s",
                   (f"GGPAY_CONFIRMED:{token_to_save}", order_id))
        mysql.connection.commit()
        print(f"[BUY-NOW-GGPAY] ✅ Đã tạo đơn hàng #{order_id} với status 'Đã thanh toán' (GGPay payment confirmed)")
        print(f"[BUY-NOW-GGPAY] 📝 Payment token: {token_to_save[:50]}..." if len(token_to_save) > 50 else f"[BUY-NOW-GGPAY] 📝 Payment token: {token_to_save}")
        return ok({
            "order_id": order_id, 
            "total": round(total, 2), 
            "payment_method": method,
            "trangthai": "Đã thanh toán",  # Trả về status để app hiển thị đúng
            "message": "Order created and payment confirmed"
        }, 201)
    else:
        # Phương thức khác: Giữ status "Chờ xác nhận"
        cur.execute(f"UPDATE orders SET payment_token=%s WHERE {ORDER_PK}=%s",
                   (f"{method}_PENDING:{order_id}", order_id))
        mysql.connection.commit()  # Commit đơn hàng và chi tiết
        return ok({"order_id": order_id, "total": round(total, 2), "payment_method": method}, 201)

# =========================
# Orders / Checkout (schema mới)
# =========================
@shop_bp.post("/checkout")
@jwt_required()
def checkout():
    mysql = get_mysql()
    data = request.get_json(force=True) or {}
    uid = int(get_jwt_identity())

    hoten  = (data.get("hoten") or "").strip()
    email  = (data.get("email") or "").strip()
    sdt    = (data.get("sdt") or "").strip()
    diachi = (data.get("diachi_giaohang") or "").strip()
    method = (data.get("payment_method") or "COD").strip().upper()
    if not (hoten and email and sdt and diachi):
        return err("Thiếu họ tên / email / SĐT / địa chỉ")

    conn = mysql.connection; cur = conn.cursor()
    cart_id = _ensure_cart(uid, cur, conn)
    if cart_id is None:  # NEW
        return err(_SESSION_INVALID_MSG, 401)

    # lấy toàn bộ items trong giỏ (kèm lựa chọn đã chọn)
    cur.execute("""
      SELECT ci.products_id, ci.quantity, p.gia_ban,
             ci.chosen_size, ci.chosen_chat_lieu, ci.chosen_gioi_tinh
      FROM cart_items ci JOIN products p ON p.products_id=ci.products_id
      WHERE ci.cart_id=%s
    """, (cart_id,))
    items = cur.fetchall() or []
    if not items:
        return err("Giỏ hàng trống")

    total = sum(float(i["gia_ban"]) * int(i["quantity"]) for i in items)

    # tạo đơn
    cur.execute("""
      INSERT INTO orders(user_id, tongtien, trangthai, diachi_giaohang, hoten, sdt, payment_method)
      VALUES (%s,%s,'Chờ xác nhận',%s,%s,%s,%s)
    """, (uid, total, diachi, hoten, sdt, method))
    order_id = cur.lastrowid

    # chi tiết đơn (snapshot unit_price + lựa chọn)
    cur.executemany("""
      INSERT INTO order_details(order_id, product_id, unit_price, quantity, chosen_size, chosen_chat_lieu, chosen_gioi_tinh)
      VALUES (%s,%s,%s,%s,%s,%s,%s)
    """, [(order_id, r["products_id"], float(r["gia_ban"]), int(r["quantity"]),
           r["chosen_size"], r["chosen_chat_lieu"], r["chosen_gioi_tinh"]) for r in items])

    # xoá giỏ
    cur.execute("DELETE FROM cart_items WHERE cart_id=%s", (cart_id,))
    
    # Xử lý theo phương thức thanh toán
    if method == "VNPAY":
        cfg = get_vnpay_config()
        if not (cfg["VNPAY_TMN_CODE"] and cfg["VNPAY_HASH_SECRET"] and cfg["VNPAY_PAYMENT_URL"]):
            return err("Chưa cấu hình VNPAY đầy đủ trên server")
        VNPAY_RETURN_URL, _ = get_vnpay_urls()
        payment_url = build_vnpay_payment_url(
            amount_vnd=total,
            order_id=str(order_id),
            order_info=f"Thanh toan don hang: {order_id}",
            ip_addr=request.headers.get("X-Forwarded-For", request.remote_addr),
            return_url=VNPAY_RETURN_URL
        )
        cur.execute(f"UPDATE orders SET payment_token=%s WHERE {ORDER_PK}=%s", (f"VNPAY:{order_id}", order_id))
        mysql.connection.commit()  # Commit đơn hàng, chi tiết và xóa giỏ
        return ok({"order_id": order_id, "total": round(total, 2), "payment_method": method,
                   "payment_url": payment_url, "return_url_prefix": VNPAY_RETURN_URL}, 201)
    elif method == "COD":
        # COD: Tự động chuyển sang "Đã thanh toán" khi đã xác nhận
        cur.execute(f"UPDATE orders SET trangthai='Đã thanh toán', payment_token=%s WHERE {ORDER_PK}=%s",
                   (f"COD_CONFIRMED:{order_id}", order_id))
        mysql.connection.commit()  # Commit đơn hàng, chi tiết và xóa giỏ
        return ok({"order_id": order_id, "total": round(total, 2), "payment_method": method,
                   "message": "COD payment confirmed"}, 201)
    elif method == "GGPAY":
        # GGPay: Nếu app gọi checkout với GGPay, có nghĩa là đã thanh toán thành công
        # (vì app chỉ gọi checkout sau khi Google Pay trả về thành công)
        payment_token = data.get("payment_token", "").strip()
        token_to_save = payment_token if payment_token and payment_token != "examplePaymentMethodToken" else f"GGPAY_TOKEN_{order_id}"
        
        # Tự động cập nhật status thành "Đã thanh toán" vì đã thanh toán thành công
        cur.execute(f"UPDATE orders SET trangthai='Đã thanh toán', payment_token=%s WHERE {ORDER_PK}=%s",
                   (f"GGPAY_CONFIRMED:{token_to_save}", order_id))
        mysql.connection.commit()
        print(f"[CHECKOUT-GGPAY] ✅ Đã tạo đơn hàng #{order_id} với status 'Đã thanh toán' (GGPay payment confirmed)")
        print(f"[CHECKOUT-GGPAY] 📝 Payment token: {token_to_save[:50]}..." if len(token_to_save) > 50 else f"[CHECKOUT-GGPAY] 📝 Payment token: {token_to_save}")
        return ok({
            "order_id": order_id, 
            "total": round(total, 2), 
            "payment_method": method,
            "trangthai": "Đã thanh toán",  # Trả về status để app hiển thị đúng
            "message": "Order created and payment confirmed"
        }, 201)
    else:
        # Phương thức khác: Giữ status "Chờ xác nhận"
        cur.execute(f"UPDATE orders SET payment_token=%s WHERE {ORDER_PK}=%s",
                   (f"{method}_PENDING:{order_id}", order_id))
        mysql.connection.commit()  # Commit đơn hàng, chi tiết và xóa giỏ
        return ok({"order_id": order_id, "total": round(total, 2), "payment_method": method}, 201)

# =========================
# Confirm Payment (xác nhận thanh toán từ app)
# =========================
@shop_bp.post("/confirm_payment/<int:order_id>")
@jwt_required()
def confirm_payment(order_id: int):
    """Endpoint để app xác nhận thanh toán thành công (sau khi hoàn tất GGPay/VNPay)"""
    mysql = get_mysql()
    uid = int(get_jwt_identity())
    data = request.get_json(force=True) or {}
    status = str(data.get("status", "success")).strip().lower()
    
    cur = mysql.connection.cursor()
    # Kiểm tra đơn hàng thuộc về user
    cur.execute("SELECT id, trangthai, payment_method FROM orders WHERE id=%s AND user_id=%s", (order_id, uid))
    order = cur.fetchone()
    
    if not order:
        return err("Không tìm thấy đơn hàng hoặc không có quyền", 404)
    
    # Nếu đã thanh toán rồi thì không cần update
    if order.get("trangthai") == "Đã thanh toán":
        return ok({"message": "Đơn hàng đã được xác nhận thanh toán", "order_id": order_id})
    
    if status == "success":
        # Thanh toán thành công - cập nhật status thành "Đã thanh toán"
        payment_method = order.get("payment_method", "UNKNOWN")
        cur.execute("UPDATE orders SET trangthai='Đã thanh toán', payment_token=%s WHERE id=%s",
                   (f"{payment_method}_CONFIRMED:{order_id}", order_id))
        mysql.connection.commit()
        print(f"[CONFIRM-PAYMENT] ✅ Đã cập nhật đơn hàng #{order_id} thành 'Đã thanh toán' (Method: {payment_method})")
        return ok({"message": "Đã xác nhận thanh toán thành công", "order_id": order_id})
    elif status == "failed":
        # Thanh toán thất bại - cập nhật status thành "Hủy"
        payment_method = order.get("payment_method", "UNKNOWN")
        cur.execute("UPDATE orders SET trangthai='Hủy', payment_token=%s WHERE id=%s",
                   (f"{payment_method}_FAILED:{order_id}", order_id))
        mysql.connection.commit()
        print(f"[CONFIRM-PAYMENT] ❌ Đơn hàng #{order_id} thanh toán thất bại (Method: {payment_method})")
        return ok({"message": "Thanh toán thất bại", "order_id": order_id})
    else:
        return err("Status không hợp lệ (success/failed)")

@shop_bp.get("/orders")
@jwt_required()
def my_orders():
    mysql = get_mysql()
    uid = int(get_jwt_identity())
    cur = mysql.connection.cursor()
    cur.execute("""
      SELECT o.id AS order_id, o.tongtien, o.trangthai, o.created_at,
             COALESCE(SUM(od.quantity),0) AS total_items
      FROM orders o
      LEFT JOIN order_details od ON od.order_id=o.id
      WHERE o.user_id=%s
      GROUP BY o.id
      ORDER BY o.id DESC
    """, (uid,))
    orders = cur.fetchall() or []

    # kèm chi tiết từng đơn (kèm lựa chọn đã chọn)
    for o in orders:
        cur.execute("""
          SELECT od.product_id, p.ten_san_pham, od.unit_price, od.quantity, od.line_total,
                 od.chosen_size, od.chosen_chat_lieu, od.chosen_gioi_tinh
          FROM order_details od JOIN products p ON p.products_id=od.product_id
          WHERE od.order_id=%s
        """, (o["order_id"],))
        o["items"] = cur.fetchall() or []
    return ok(orders)

    # =========================
    # Avatar (upload & cập nhật cho user hiện tại qua JWT)
    # =========================
@shop_bp.post("/user/avatar")
@jwt_required()
def upload_avatar():
        app = current_app._get_current_object()
        mysql = get_mysql()
        uid = get_current_user_id()
        if uid is None:
            return err("Token không hợp lệ cho tài khoản người dùng", 403)

        if 'file' not in request.files:
            return err("Không có file")
        f = request.files['file']
        if f.filename == '':
            return err("Tên file rỗng")
        if not allowed_file(f.filename):
            return err("Định dạng không hỗ trợ (png, jpg, jpeg, gif, webp)")

        # Giới hạn dung lượng 5MB
        f.seek(0, os.SEEK_END)
        size = f.tell()
        f.seek(0)
        if size > 5 * 1024 * 1024:
            return err("Ảnh vượt quá 5MB")

        conn = mysql.connection
        cur = conn.cursor()

        # Lấy avatar cũ để xoá sau khi lưu ảnh mới
        cur.execute("SELECT avatar_url FROM users WHERE user_id=%s", (uid,))
        row = cur.fetchone()
        old_avatar = (row.get("avatar_url") if row else None)

        ext = f.filename.rsplit(".", 1)[1].lower()
        filename = secure_filename(f"user_{uid}_avatar.{ext}")

        avatar_folder = os.path.join(app.root_path, "static", "avatars")
        os.makedirs(avatar_folder, exist_ok=True)
        target = os.path.join(avatar_folder, filename)
        f.save(target)

        rel_path = f"/static/avatars/{filename}"
        cur.execute("UPDATE users SET avatar_url=%s WHERE user_id=%s", (rel_path, uid))
        conn.commit()

        # Xoá file avatar cũ nếu khác tên (vd đổi đuôi .png -> .jpg)
        if old_avatar and old_avatar != rel_path:
            old_full = os.path.join(app.root_path, old_avatar.lstrip("/"))
            if os.path.exists(old_full):
                try:
                    os.remove(old_full)
                except OSError:
                    pass

        return ok({"avatar_url": _abs_img(rel_path)}, 201)