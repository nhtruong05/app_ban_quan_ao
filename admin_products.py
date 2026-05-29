# admin_products.py
from flask import Blueprint, request
from math import ceil
from utils import ok, err, get_mysql, to_float, admin_required
from chatbot import sync_one_product_to_chroma, delete_product_from_chroma  # <— thêm import

admin_products_bp = Blueprint("admin_products", __name__)
PRODUCT_PK = "products_id"

STATUS_DB = {"Đang bán", "Ngừng bán"}
VI_TO_DB  = {
    "Đang bán": "Đang bán",
    "Dang ban": "Đang bán",
    "dang ban": "Đang bán",
    "DANG BAN": "Đang bán",
    "Hết hàng": "Ngừng bán",
    "Het hang": "Ngừng bán",
    "het hang": "Ngừng bán",
    "HET HANG": "Ngừng bán",
    "Ngừng bán": "Ngừng bán",
    "Ngung ban": "Ngừng bán",
    "ngung ban": "Ngừng bán",
    "NGUNG BAN": "Ngừng bán",
}

def _coalesce_status(val: str) -> str:
    s = (val or "").strip()
    u = s.upper()
    if s in STATUS_DB:
        return s
    if s in VI_TO_DB:
        return VI_TO_DB[s]
    if u in ("ACTIVE", "DANG BAN", "ĐANG BÁN", "1", "TRUE", "YES"):
        return "Đang bán"
    if u in ("INACTIVE", "HET HANG", "HẾT HÀNG", "0", "FALSE", "NO", "NGUNG BAN", "NGỪNG BÁN"):
        return "Ngừng bán"
    return "Đang bán"

@admin_required
@admin_products_bp.get("/products")
def admin_list_products():
    mysql = get_mysql()
    q         = (request.args.get("q", "") or "").strip()
    category  = (request.args.get("category", "") or "").strip()
    gender    = (request.args.get("gender", "") or "").strip()
    status    = (request.args.get("status", "") or "").strip()
    size      = (request.args.get("size", "") or "").strip()
    material  = (request.args.get("material", "") or "").strip()
    price_min = (request.args.get("price_min", request.args.get("priceMin", "")) or "").strip()
    price_max = (request.args.get("price_max", request.args.get("priceMax", "")) or "").strip()

    try:
        page = max(int(request.args.get("page", 1)), 1)
        page_size = max(min(int(request.args.get("page_size", 20)), 200), 1)
    except ValueError:
        return err("page/page_size không hợp lệ")

    offset = (page - 1) * page_size
    wheres, params = [], []

    if q:
        wheres.append("(ten_san_pham LIKE %s OR mo_ta LIKE %s)")
        params.extend([f"%{q}%", f"%{q}%"])
    if category:
        wheres.append("loai=%s"); params.append(category)
    if gender:
        wheres.append("gioi_tinh=%s"); params.append(gender)
    if status:
        wheres.append("trang_thai=%s"); params.append(_coalesce_status(status))
    if size:
        wheres.append("size=%s"); params.append(size)
    if material:
        wheres.append("chat_lieu=%s"); params.append(material)
    if price_min:
        try:
            wheres.append("gia_ban >= %s"); params.append(float(price_min))
        except Exception:
            return err("price_min/priceMin không hợp lệ")
    if price_max:
        try:
            wheres.append("gia_ban <= %s"); params.append(float(price_max))
        except Exception:
            return err("price_max/priceMax không hợp lệ")

    where_sql = ("WHERE " + " AND ".join(wheres)) if wheres else ""

    cur = mysql.connection.cursor()
    cur.execute(f"SELECT COUNT(*) AS cnt FROM products {where_sql}", tuple(params))
    total = (cur.fetchone() or {}).get("cnt", 0)

    cur.execute(
        f"SELECT * FROM products {where_sql} "
        f"ORDER BY {PRODUCT_PK} DESC LIMIT %s OFFSET %s",
        tuple(params + [page_size, offset])
    )
    items = cur.fetchall() or []

    return ok({
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": ceil((total or 0) / page_size) if page_size else 0
    })

@admin_required
@admin_products_bp.get("/products/<int:pid>")
def admin_get_product(pid: int):
    mysql = get_mysql()
    cur = mysql.connection.cursor()
    cur.execute(f"SELECT * FROM products WHERE {PRODUCT_PK}=%s", (pid,))
    row = cur.fetchone()
    if not row:
        return err("Không tìm thấy sản phẩm", 404)
    return ok(row)

@admin_required
@admin_products_bp.post("/products")
def admin_create_product():
    mysql = get_mysql()
    data = request.get_json(force=True) or {}

    required = ["ten_san_pham", "gia_ban"]
    if not all(str(data.get(k, "")).strip() for k in required):
        return err("Thiếu dữ liệu (cần: ten_san_pham, gia_ban)")

    ten_san_pham = (data.get("ten_san_pham") or "").strip()
    try:
        gia_ban = float(data.get("gia_ban") or 0)
    except Exception:
        return err("gia_ban không hợp lệ")

    loai       = (data.get("loai") or "").strip()
    mo_ta      = (data.get("mo_ta") or "").strip()
    size       = (data.get("size") or "").strip()
    chat_lieu  = (data.get("chat_lieu") or "").strip()
    gioi_tinh  = (data.get("gioi_tinh") or "").strip()
    hinh_anh   = (data.get("hinh_anh") or "").strip()
    # Normalize image URL: chỉ lưu relative path vào database
    if hinh_anh:
        if hinh_anh.startswith("http://") or hinh_anh.startswith("https://"):
            # Extract relative path từ absolute URL
            try:
                from urllib.parse import urlparse
                parsed = urlparse(hinh_anh)
                hinh_anh = parsed.path
            except:
                # Nếu không parse được, giữ nguyên
                pass
        # Đảm bảo bắt đầu bằng /
        if hinh_anh and not hinh_anh.startswith("/"):
            hinh_anh = "/" + hinh_anh
    trang_thai = _coalesce_status(data.get("trang_thai"))

    cols = [
        "ten_san_pham", "gia_ban", "loai", "mo_ta",
        "size", "chat_lieu", "gioi_tinh", "hinh_anh", "trang_thai"
    ]
    vals = [ten_san_pham, gia_ban, loai, mo_ta, size, chat_lieu, gioi_tinh, hinh_anh, trang_thai]

    cur = mysql.connection.cursor()
    cur.execute(
        f"INSERT INTO products({', '.join(cols)}) "
        f"VALUES ({', '.join(['%s'] * len(cols))})",
        tuple(vals)
    )
    new_id = cur.lastrowid
    mysql.connection.commit()

    # Đồng bộ ngay lập tức sang ChromaDB sau khi commit
    print(f"\n{'='*60}")
    print(f"[SYNC-ADMIN][CREATE] 🔄 Bắt đầu đồng bộ sản phẩm #{new_id} sang ChromaDB...")
    try:
        result = sync_one_product_to_chroma(new_id)
        if result.get("error"):
            print(f"[SYNC-ADMIN][CREATE] ⚠️  WARNING: Đồng bộ sản phẩm #{new_id} thất bại: {result.get('error')}")
        elif result.get("upserted"):
            print(f"[SYNC-ADMIN][CREATE] ✅ THÀNH CÔNG: Đã đồng bộ sản phẩm #{new_id} sang ChromaDB")
        elif result.get("deleted"):
            print(f"[SYNC-ADMIN][CREATE] ✅ Đã xóa sản phẩm #{new_id} khỏi ChromaDB")
        else:
            print(f"[SYNC-ADMIN][CREATE] ✅ Đồng bộ sản phẩm #{new_id} hoàn tất: {result}")
    except Exception as e:
        print(f"[SYNC-ADMIN][CREATE] ❌ ERROR: Lỗi khi đồng bộ sản phẩm #{new_id}: {e}")
        import traceback
        traceback.print_exc()
    print(f"{'='*60}\n")

    return ok({"message": "Tạo sản phẩm thành công", "products_id": new_id}, 201)

@admin_required
@admin_products_bp.put("/products/<int:pid>")
def admin_update_product(pid: int):
    mysql = get_mysql()
    data = request.get_json(force=True) or {}

    # Normalize image URL nếu có
    hinh_anh = (data.get("hinh_anh") or "").strip()
    if hinh_anh:
        if hinh_anh.startswith("http://") or hinh_anh.startswith("https://"):
            # Extract relative path từ absolute URL
            try:
                from urllib.parse import urlparse
                parsed = urlparse(hinh_anh)
                hinh_anh = parsed.path
            except:
                pass
        # Đảm bảo bắt đầu bằng /
        if hinh_anh and not hinh_anh.startswith("/"):
            hinh_anh = "/" + hinh_anh
        data["hinh_anh"] = hinh_anh

    updatable = [
        "ten_san_pham", "gia_ban", "loai", "mo_ta",
        "size", "chat_lieu", "gioi_tinh", "hinh_anh", "trang_thai"
    ]

    sets, params = [], []
    for k in updatable:
        if k in data:
            v = data[k]
            if k == "gia_ban":
                try:
                    v = float(v or 0)
                except Exception:
                    return err("gia_ban không hợp lệ")
            if k == "trang_thai":
                v = _coalesce_status(v)
            sets.append(f"{k}=%s")
            params.append(v)

    if not sets:
        return err("Không có trường nào để cập nhật")

    params.append(pid)
    cur = mysql.connection.cursor()
    cur.execute(
        f"UPDATE products SET {', '.join(sets)} WHERE {PRODUCT_PK}=%s",
        tuple(params)
    )
    mysql.connection.commit()

    # Đồng bộ ngay lập tức sang ChromaDB sau khi commit
    print(f"\n{'='*60}")
    print(f"[SYNC-ADMIN][UPDATE] 🔄 Bắt đầu đồng bộ sản phẩm #{pid} sang ChromaDB...")
    try:
        result = sync_one_product_to_chroma(pid)
        if result.get("error"):
            print(f"[SYNC-ADMIN][UPDATE] ⚠️  WARNING: Đồng bộ sản phẩm #{pid} thất bại: {result.get('error')}")
        elif result.get("upserted"):
            print(f"[SYNC-ADMIN][UPDATE] ✅ THÀNH CÔNG: Đã cập nhật sản phẩm #{pid} trong ChromaDB")
        elif result.get("deleted"):
            print(f"[SYNC-ADMIN][UPDATE] ✅ Đã xóa sản phẩm #{pid} khỏi ChromaDB")
        else:
            print(f"[SYNC-ADMIN][UPDATE] ✅ Đồng bộ sản phẩm #{pid} hoàn tất: {result}")
    except Exception as e:
        print(f"[SYNC-ADMIN][UPDATE] ❌ ERROR: Lỗi khi đồng bộ sản phẩm #{pid}: {e}")
        import traceback
        traceback.print_exc()
    print(f"{'='*60}\n")

    return ok({"message": "Cập nhật sản phẩm thành công"})

@admin_required
@admin_products_bp.delete("/products/<int:pid>")
def admin_delete_product(pid: int):
    mysql = get_mysql()
    cur = mysql.connection.cursor()
    
    # Kiểm tra xem sản phẩm có trong order_details không
    cur.execute("SELECT COUNT(*) as cnt FROM order_details WHERE product_id=%s", (pid,))
    order_count = cur.fetchone().get("cnt", 0)
    
    if order_count > 0:
        # Nếu sản phẩm đã có trong đơn hàng, không cho xóa
        return err(f"Không thể xóa sản phẩm vì đã có {order_count} đơn hàng sử dụng sản phẩm này. Vui lòng xóa các đơn hàng liên quan trước.", 400)
    
    # Xóa sản phẩm
    cur.execute(f"DELETE FROM products WHERE {PRODUCT_PK}=%s", (pid,))
    deleted_rows = cur.rowcount
    mysql.connection.commit()
    
    if deleted_rows == 0:
        return err("Không tìm thấy sản phẩm để xóa", 404)

    # Xóa ngay lập tức khỏi ChromaDB sau khi commit
    print(f"\n{'='*60}")
    print(f"[SYNC-ADMIN][DELETE] 🗑️  Bắt đầu xóa sản phẩm #{pid} khỏi ChromaDB...")
    try:
        result = delete_product_from_chroma(pid)
        if result.get("error"):
            print(f"[SYNC-ADMIN][DELETE] ⚠️  WARNING: Xóa sản phẩm #{pid} khỏi ChromaDB thất bại: {result.get('error')}")
        elif result.get("deleted"):
            print(f"[SYNC-ADMIN][DELETE] ✅ THÀNH CÔNG: Đã xóa sản phẩm #{pid} khỏi ChromaDB")
        else:
            print(f"[SYNC-ADMIN][DELETE] ✅ Xóa sản phẩm #{pid} hoàn tất: {result}")
    except Exception as e:
        print(f"[SYNC-ADMIN][DELETE] ❌ ERROR: Lỗi khi xóa sản phẩm #{pid} khỏi ChromaDB: {e}")
        import traceback
        traceback.print_exc()
    print(f"{'='*60}\n")

    return ok({"message": "Đã xoá sản phẩm"})

@admin_required
@admin_products_bp.delete("/products")
def admin_bulk_delete_products():
    mysql = get_mysql()
    data = request.get_json(force=True) or {}

    ids = data.get("ids") or []
    if not ids or not isinstance(ids, list):
        return err("Thiếu danh sách ids")

    ids = [int(i) for i in ids if str(i).isdigit()]
    if not ids:
        return err("Danh sách ids không hợp lệ")

    cur = mysql.connection.cursor()
    
    # Kiểm tra sản phẩm nào có trong order_details
    placeholders = ", ".join(["%s"] * len(ids))
    cur.execute(
        f"SELECT DISTINCT product_id FROM order_details WHERE product_id IN ({placeholders})",
        tuple(ids)
    )
    products_in_orders = {row["product_id"] for row in cur.fetchall()}
    
    # Chỉ xóa những sản phẩm không có trong đơn hàng
    ids_to_delete = [pid for pid in ids if pid not in products_in_orders]
    ids_skipped = [pid for pid in ids if pid in products_in_orders]
    
    if not ids_to_delete:
        return err(f"Không thể xóa bất kỳ sản phẩm nào vì tất cả đều đã có trong đơn hàng. Số lượng: {len(ids_skipped)}", 400)
    
    if ids_skipped:
        print(f"[BULK DELETE] ⚠️  Bỏ qua {len(ids_skipped)} sản phẩm vì đã có trong đơn hàng: {ids_skipped}")
    
    # Xóa các sản phẩm không có trong đơn hàng
    placeholders_delete = ", ".join(["%s"] * len(ids_to_delete))
    cur.execute(
        f"DELETE FROM products WHERE {PRODUCT_PK} IN ({placeholders_delete})",
        tuple(ids_to_delete)
    )
    deleted_count = cur.rowcount
    mysql.connection.commit()

    # Xóa ngay lập tức khỏi ChromaDB sau khi commit
    print(f"\n{'='*60}")
    print(f"[SYNC-ADMIN][BULK DELETE] 🗑️  Bắt đầu xóa {len(ids_to_delete)} sản phẩm khỏi ChromaDB...")
    chroma_deleted = 0
    chroma_failed = 0
    try:
        for _id in ids_to_delete:
            try:
                result = delete_product_from_chroma(_id)
                if result.get("error"):
                    print(f"[SYNC-ADMIN][BULK DELETE] ⚠️  Sản phẩm #{_id}: {result.get('error')}")
                    chroma_failed += 1
                else:
                    print(f"[SYNC-ADMIN][BULK DELETE] ✅ Đã xóa sản phẩm #{_id}")
                    chroma_deleted += 1
            except Exception as e:
                print(f"[SYNC-ADMIN][BULK DELETE] ❌ Lỗi xóa sản phẩm #{_id}: {e}")
                chroma_failed += 1
        print(f"[SYNC-ADMIN][BULK DELETE] 📊 KẾT QUẢ: Đã xóa {chroma_deleted}/{len(ids_to_delete)} sản phẩm khỏi ChromaDB")
        if chroma_failed > 0:
            print(f"[SYNC-ADMIN][BULK DELETE] ⚠️  CẢNH BÁO: {chroma_failed} sản phẩm xóa thất bại")
    except Exception as e:
        print(f"[SYNC-ADMIN][BULK DELETE] ❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
    print(f"{'='*60}\n")

    message = f"Đã xoá {deleted_count} sản phẩm"
    if ids_skipped:
        message += f" ({len(ids_skipped)} sản phẩm bị bỏ qua vì đã có trong đơn hàng)"
    
    return ok({"message": message, "deleted": deleted_count, "skipped": len(ids_skipped)})

@admin_required
@admin_products_bp.put("/products/<int:pid>/status")
def admin_update_status(pid: int):
    mysql = get_mysql()
    data = request.get_json(force=True) or {}

    status = _coalesce_status(data.get("trang_thai"))
    cur = mysql.connection.cursor()
    cur.execute(
        f"UPDATE products SET trang_thai=%s WHERE {PRODUCT_PK}=%s",
        (status, pid)
    )
    mysql.connection.commit()

    # Đồng bộ ngay lập tức sang ChromaDB sau khi commit
    print(f"\n{'='*60}")
    print(f"[SYNC-ADMIN][STATUS] 🔄 Bắt đầu đồng bộ trạng thái sản phẩm #{pid} sang ChromaDB...")
    try:
        result = sync_one_product_to_chroma(pid)
        if result.get("error"):
            print(f"[SYNC-ADMIN][STATUS] ⚠️  WARNING: Đồng bộ trạng thái sản phẩm #{pid} thất bại: {result.get('error')}")
        elif result.get("upserted"):
            print(f"[SYNC-ADMIN][STATUS] ✅ THÀNH CÔNG: Đã cập nhật trạng thái sản phẩm #{pid} trong ChromaDB")
        else:
            print(f"[SYNC-ADMIN][STATUS] ✅ Đồng bộ trạng thái sản phẩm #{pid} hoàn tất: {result}")
    except Exception as e:
        print(f"[SYNC-ADMIN][STATUS] ❌ ERROR: Lỗi khi đồng bộ trạng thái sản phẩm #{pid}: {e}")
        import traceback
        traceback.print_exc()
    print(f"{'='*60}\n")

    return ok({"message": "Đã cập nhật trạng thái"})
